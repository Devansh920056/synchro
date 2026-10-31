"use client";

/**
 * Synchro — main page
 *
 * Landing (join form) → Lobby (wait for 3 players) → Game → Post-mortem.
 * This file only wires the socket to the screens; each screen lives in components/.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSocket } from "@/hooks/useSocket";
import {
  SOCKET_EVENTS,
  MAX_PLAYERS_PER_ROOM,
  type Room,
  type JoinRoomPayload,
  type JoinSuccessPayload,
  type JoinErrorPayload,
  type LobbyUpdatePayload,
  type PlayerJoinedPayload,
  type PlayerLeftPayload,
  type GameStartedPayload,
  type SelectionPayload,
  type LockPayload,
  type LockResetPayload,
  type OperatorRole,
  type PostMortemSummaryPayload,
} from "@synchro/shared";
import { JoinForm } from "@/components/JoinForm";
import { Lobby } from "@/components/Lobby";
import { GameView } from "@/components/GameView";
import { PostMortemView } from "@/components/PostMortemView";
import { ActivityLog, type LogEntry } from "@/components/ActivityLog";

type AppState = "landing" | "joining" | "lobby" | "game";

const NO_GHOSTS: Record<OperatorRole, number | null> = {
  operator_1: null,
  operator_2: null,
  operator_3: null,
};

const MAX_LOG_ENTRIES = 50;

/** A short, easy-to-share room code like "KITE-4" */
function randomRoomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const word = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `${word}-${Math.floor(Math.random() * 9) + 1}`;
}

export default function SynchroPage() {
  const { socket, isConnected } = useSocket();
  const { data: session } = useSession();

  // ── Form ────────────────────────────────────────────────────────
  // Until the player types, use the name from their sign-in
  const [typedName, setTypedName] = useState<string | null>(null);
  const operatorName = typedName ?? session?.user?.name ?? "";
  const [roomCode, setRoomCode] = useState("");

  // ── App ─────────────────────────────────────────────────────────
  const [appState, setAppState] = useState<AppState>("landing");
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<GameStartedPayload | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Round ───────────────────────────────────────────────────────
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [ghostSelections, setGhostSelections] = useState(NO_GHOSTS);
  const [isRoundOver, setIsRoundOver] = useState(false);
  const [summary, setSummary] = useState<PostMortemSummaryPayload | null>(null);

  // ── Activity log ────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const leavingRef = useRef(false);

  // Lets socket handlers read the current screen without re-subscribing on every change
  const appStateRef = useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const id = ++logIdRef.current;
    setLogs((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), { id, message, type, timestamp: Date.now() }]);
  }, []);

  /** Clears everything that belongs to a single round */
  const resetRound = useCallback(() => {
    setSelectedLine(null);
    setIsLocked(false);
    setGhostSelections(NO_GHOSTS);
    setIsRoundOver(false);
    setSummary(null);
    setNotice(null);
  }, []);

  /** Back to the join screen with a clean slate */
  const resetAll = useCallback(() => {
    resetRound();
    setAppState("landing");
    setRoom(null);
    setPlayerId(null);
    setGameData(null);
    setIsStarting(false);
    setLogs([]);
  }, [resetRound]);

  // ── Socket events ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onJoinSuccess = (data: JoinSuccessPayload) => {
      setPlayerId(data.playerId);
      setRoom(data.room);
      setAppState("lobby");
      setError(null);
      addLog(`You joined room ${data.room.id}.`, "success");
    };

    const onJoinError = (data: JoinErrorPayload) => {
      setError(data.message);
      // Only go back to the form if we were still trying to join
      setAppState((prev) => (prev === "joining" ? "landing" : prev));
      addLog(data.message, "error");
    };

    const onLobbyUpdate = (data: LobbyUpdatePayload) => setRoom(data.room);

    const onPlayerJoined = (data: PlayerJoinedPayload) => {
      setRoom(data.room);
      addLog(`${data.player.name} joined (${data.room.players.length}/${MAX_PLAYERS_PER_ROOM}).`, "success");
    };

    const onPlayerLeft = (data: PlayerLeftPayload) => {
      setRoom(data.room);
      addLog(`${data.playerName} left the room.`, "warning");
      // The server cancels a running round when someone leaves
      if (appStateRef.current === "game") {
        setError(`${data.playerName} left, so the round was cancelled. Wait for a new player, then start again.`);
        setAppState("lobby");
      }
      setGameData(null);
      setIsStarting(false);
      resetRound();
    };

    const onGameStarting = (data: { room: Room }) => {
      setRoom(data.room);
      setError(null);
      resetRound();
      setIsStarting(true);
      addLog("Starting the game…", "success");
    };

    const onGameStarted = (data: GameStartedPayload) => {
      setGameData(data);
      setIsStarting(false);
      setAppState("game");
      addLog(`Round started. You have ${data.view.roleLabel}.`, "success");
    };

    const onGhostUpdate = (data: SelectionPayload) => {
      setGhostSelections((prev) => ({ ...prev, [data.operatorRole]: data.selectedLineIndex }));
    };

    const onLockReset = (data: LockResetPayload) => {
      setIsLocked(false);
      setSelectedLine(null);
      setGhostSelections(NO_GHOSTS);
      setNotice(data.message);
    };

    const onPuzzleSolved = (data: { message: string }) => {
      setIsRoundOver(true);
      setNotice(null);
      addLog(data.message, "success");
    };

    const onTimeout = () => {
      setIsRoundOver(true);
      setNotice(null);
      addLog("Time's up!", "error");
    };

    const onSummary = (payload: PostMortemSummaryPayload) => setSummary(payload);

    const onDisconnect = () => {
      if (leavingRef.current) return; // we left on purpose
      resetAll();
      setError("Lost connection to the server. Please join again.");
    };

    socket.on(SOCKET_EVENTS.JOIN_SUCCESS, onJoinSuccess);
    socket.on(SOCKET_EVENTS.JOIN_ERROR, onJoinError);
    socket.on(SOCKET_EVENTS.UPDATE_LOBBY, onLobbyUpdate);
    socket.on(SOCKET_EVENTS.PLAYER_JOINED, onPlayerJoined);
    socket.on(SOCKET_EVENTS.PLAYER_LEFT, onPlayerLeft);
    socket.on(SOCKET_EVENTS.GAME_STARTING, onGameStarting);
    socket.on(SOCKET_EVENTS.GAME_STARTED, onGameStarted);
    socket.on(SOCKET_EVENTS.TELEMETRY_GHOST_UPDATE, onGhostUpdate);
    socket.on(SOCKET_EVENTS.GAME_LOCK_RESET, onLockReset);
    socket.on(SOCKET_EVENTS.GAME_PUZZLE_SOLVED, onPuzzleSolved);
    socket.on(SOCKET_EVENTS.GAME_TIMEOUT, onTimeout);
    socket.on(SOCKET_EVENTS.GAME_POST_MORTEM_SUMMARY, onSummary);
    socket.on(SOCKET_EVENTS.DISCONNECT, onDisconnect);

    return () => {
      socket.off(SOCKET_EVENTS.JOIN_SUCCESS, onJoinSuccess);
      socket.off(SOCKET_EVENTS.JOIN_ERROR, onJoinError);
      socket.off(SOCKET_EVENTS.UPDATE_LOBBY, onLobbyUpdate);
      socket.off(SOCKET_EVENTS.PLAYER_JOINED, onPlayerJoined);
      socket.off(SOCKET_EVENTS.PLAYER_LEFT, onPlayerLeft);
      socket.off(SOCKET_EVENTS.GAME_STARTING, onGameStarting);
      socket.off(SOCKET_EVENTS.GAME_STARTED, onGameStarted);
      socket.off(SOCKET_EVENTS.TELEMETRY_GHOST_UPDATE, onGhostUpdate);
      socket.off(SOCKET_EVENTS.GAME_LOCK_RESET, onLockReset);
      socket.off(SOCKET_EVENTS.GAME_PUZZLE_SOLVED, onPuzzleSolved);
      socket.off(SOCKET_EVENTS.GAME_TIMEOUT, onTimeout);
      socket.off(SOCKET_EVENTS.GAME_POST_MORTEM_SUMMARY, onSummary);
      socket.off(SOCKET_EVENTS.DISCONNECT, onDisconnect);
    };
  }, [socket, addLog, resetRound, resetAll]);

  // ── Actions ─────────────────────────────────────────────────────
  const handleJoin = useCallback(() => {
    if (!socket || !isConnected) {
      setError("Can't reach the game server. Check that it's running, then try again.");
      return;
    }

    const name = operatorName.trim();
    const code = roomCode.trim().toUpperCase();

    if (name.length < 2) return setError("Your name needs at least 2 characters.");
    if (code.length < 2) return setError("The room code needs at least 2 characters.");

    setError(null);
    setAppState("joining");

    const payload: JoinRoomPayload = { playerName: name, roomId: code, dbUserId: session?.user?.id };
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, payload);
  }, [socket, isConnected, operatorName, roomCode, session?.user?.id]);

  const handleStart = useCallback(() => {
    if (!socket || !room || room.players.length < MAX_PLAYERS_PER_ROOM) return;
    setError(null);
    socket.emit(SOCKET_EVENTS.START_GAME);
  }, [socket, room]);

  /** Leaving a room = dropping the connection (the server cleans up) and reconnecting */
  const handleLeave = useCallback(() => {
    if (socket) {
      leavingRef.current = true;
      socket.disconnect();
      leavingRef.current = false;
      socket.connect();
    }
    resetAll();
    setError(null);
  }, [socket, resetAll]);

  const handleSelectLine = useCallback(
    (lineNumber: number) => {
      if (!socket || !gameData || isLocked || isRoundOver) return;

      const next = selectedLine === lineNumber ? null : lineNumber;
      setSelectedLine(next);
      setNotice(null);

      const payload: SelectionPayload = {
        roomId: gameData.session.roomId,
        userId: playerId ?? "",
        operatorRole: gameData.assignment.role,
        selectedLineIndex: next,
      };
      socket.emit(SOCKET_EVENTS.TELEMETRY_LINE_SELECTED, payload);
    },
    [socket, gameData, isLocked, isRoundOver, selectedLine, playerId]
  );

  const handleLock = useCallback(() => {
    if (!socket || !gameData || selectedLine === null || isLocked || isRoundOver) return;

    setIsLocked(true);
    addLog(`You locked in line ${selectedLine}. Waiting for teammates…`, "info");

    const payload: LockPayload = {
      roomId: gameData.session.roomId,
      userId: playerId ?? "",
      operatorRole: gameData.assignment.role,
      lockedLineIndex: selectedLine,
    };
    socket.emit(SOCKET_EVENTS.GAME_LOCK_SELECTION, payload);
  }, [socket, gameData, selectedLine, isLocked, isRoundOver, playerId, addLog]);

  // ── Render ──────────────────────────────────────────────────────
  const inGame = appState === "game" && gameData;

  return (
    <main className="flex-1 flex flex-col items-center p-4 sm:p-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="scanline-overlay" aria-hidden="true" />
      <div className="fixed inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div className="fixed inset-0 bg-data-stream opacity-50 pointer-events-none" aria-hidden="true" />

      {/* Server status */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/80 border border-border backdrop-blur-sm">
        <span className="relative flex w-2 h-2" aria-hidden="true">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-red-500"}`} />
          {isConnected && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-pulse-ring" />}
        </span>
        <span className="text-xs text-neutral-400">{isConnected ? "Online" : "Offline"}</span>
      </div>

      <div className={`relative z-10 w-full my-auto transition-all duration-500 ${inGame ? "max-w-6xl" : "max-w-xl"}`}>
        {/* Header */}
        <header className="text-center mb-8 animate-slide-up">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight animate-flicker">
            <span className="text-emerald-400 text-glow-emerald">SYNCHRO</span>
          </h1>
          <p className="text-sm sm:text-base text-neutral-400 mt-3">
            A co-op puzzle for 3 players. Each of you sees something different. Find the bug together.
          </p>
        </header>

        {(appState === "landing" || appState === "joining") && (
          <div className="animate-slide-up">
            <JoinForm
              name={operatorName}
              roomCode={roomCode}
              error={error}
              isJoining={appState === "joining"}
              isServerOnline={isConnected}
              onNameChange={(v) => {
                setTypedName(v);
                setError(null);
              }}
              onRoomCodeChange={(v) => {
                setRoomCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
                setError(null);
              }}
              onRandomCode={() => {
                setRoomCode(randomRoomCode());
                setError(null);
              }}
              onSubmit={handleJoin}
            />
          </div>
        )}

        {appState === "lobby" && room && (
          <div className="space-y-4 animate-slide-up">
            <Lobby room={room} playerId={playerId} error={error} onStart={handleStart} onLeave={handleLeave} />
            <ActivityLog logs={logs} />
          </div>
        )}

        {inGame && (
          <GameView
            socket={socket}
            gameData={gameData}
            selectedLine={selectedLine}
            isLocked={isLocked}
            isFinished={isRoundOver}
            ghostSelections={ghostSelections}
            notice={notice}
            onSelectLine={handleSelectLine}
            onLock={handleLock}
            onLeave={handleLeave}
          />
        )}

        <footer className="text-center mt-10">
          <p className="text-xs text-neutral-600">Synchro v0.1.0 · 3 players · 60 seconds · talk to each other!</p>
        </footer>
      </div>

      {/* Full-screen overlays */}
      {isStarting && (
        <div
          role="status"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 animate-fade-in"
        >
          <span className="inline-block w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xl font-semibold text-emerald-300">Get ready…</p>
          <p className="text-sm text-neutral-400">Each player is getting a different screen.</p>
        </div>
      )}

      {summary && <PostMortemView summary={summary} socket={socket} onLeave={handleLeave} />}
    </main>
  );
}
