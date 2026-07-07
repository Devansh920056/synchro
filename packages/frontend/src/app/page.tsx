"use client";

/**
 * Synchro — Main Interface
 *
 * State 1 (Landing): Terminal-like form for Operator Name + Room Code
 * State 2 (Lobby):   Real-time operator list with Start Game control
 */

import { useState, useEffect, useCallback, useRef } from "react";
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
  type OperatorRole,
} from "@synchro/shared";
import { CodeLine } from "@/components/CodeLine";
import { StatusDeck } from "@/components/StatusDeck";
import { PostMortemView } from "@/components/PostMortemView";
import { useSession, signIn, signOut } from "next-auth/react";
import { PostMortemSummaryPayload } from "@synchro/shared";

// ─── Types ────────────────────────────────────────────────────────

type AppState = "landing" | "connecting" | "lobby" | "active";

interface SystemLog {
  id: number;
  message: string;
  type: "info" | "success" | "error" | "warning";
  timestamp: number;
}

// ─── Component ────────────────────────────────────────────────────

export default function SynchroPage() {
  const { socket, isConnected } = useSocket();
  const { data: session, status } = useSession();

  // ── Form State ──────────────────────────────────────────────────
  const [operatorName, setOperatorName] = useState(session?.user?.name || "");

  // Update operatorName if session loads later
  useEffect(() => {
    if (session?.user?.name && !operatorName) {
      setOperatorName(session.user.name);
    }
  }, [session, operatorName]);
  const [roomCode, setRoomCode] = useState("");

  // ── App State ───────────────────────────────────────────────────
  const [appState, setAppState] = useState<AppState>("landing");
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<GameStartedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Game State ──────────────────────────────────────────────────
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [ghostSelections, setGhostSelections] = useState<Record<OperatorRole, number | null>>({
    operator_1: null,
    operator_2: null,
    operator_3: null,
  });
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [missionFailed, setMissionFailed] = useState(false);
  const [postMortemSummary, setPostMortemSummary] = useState<PostMortemSummaryPayload | null>(null);

  // ── System Logs ─────────────────────────────────────────────────
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback(
    (message: string, type: SystemLog["type"] = "info") => {
      const id = ++logIdRef.current;
      setLogs((prev) => [...prev.slice(-50), { id, message, type, timestamp: Date.now() }]);
    },
    []
  );

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // ── Socket Event Listeners ──────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onJoinSuccess = (data: JoinSuccessPayload) => {
      setPlayerId(data.playerId);
      setRoom(data.room);
      setAppState("lobby");
      setError(null);
      addLog(`CONNECTION ESTABLISHED — assigned ID ${data.playerId.slice(0, 8)}`, "success");
      addLog(`Room "${data.room.id}" — ${data.room.players.length}/${MAX_PLAYERS_PER_ROOM} operators online`, "info");
    };

    const onJoinError = (data: JoinErrorPayload) => {
      setError(data.message);
      setAppState("landing");
      addLog(`ERROR: ${data.message}`, "error");
    };

    const onLobbyUpdate = (data: LobbyUpdatePayload) => {
      setRoom(data.room);
    };

    const onPlayerJoined = (data: PlayerJoinedPayload) => {
      setRoom(data.room);
      addLog(`OPERATOR "${data.player.name}" connected — ${data.room.players.length}/${MAX_PLAYERS_PER_ROOM}`, "success");
    };

    const onPlayerLeft = (data: PlayerLeftPayload) => {
      setRoom(data.room);
      addLog(`OPERATOR "${data.playerName}" disconnected — ${data.room.players.length}/${MAX_PLAYERS_PER_ROOM}`, "warning");
    };

    const onGameStarting = () => {
      addLog("CALIBRATION SEQUENCE INITIATED — standby...", "success");
    };

    const onGameStarted = (data: GameStartedPayload) => {
      setGameData(data);
      setAppState("active");
      addLog(`CALIBRATION IN PROGRESS — Operator assigned: ${data.view.roleLabel}`, "success");
    };

    const onGhostUpdate = (data: SelectionPayload) => {
      setGhostSelections((prev) => ({
        ...prev,
        [data.operatorRole]: data.selectedLineIndex,
      }));
    };

    const onPuzzleSolved = (data: { message: string }) => {
      setPuzzleSolved(true);
      addLog(`[SUCCESS] ${data.message}`, "success");
    };

    const onTimeout = () => {
      setMissionFailed(true);
      addLog("[CRITICAL] TIME EXPIRED. CALIBRATION FAILED.", "error");
    };

    const onPostMortemSummary = (payload: PostMortemSummaryPayload) => {
      setPostMortemSummary(payload);
    };

    socket.on(SOCKET_EVENTS.JOIN_SUCCESS, onJoinSuccess);
    socket.on(SOCKET_EVENTS.JOIN_ERROR, onJoinError);
    socket.on(SOCKET_EVENTS.UPDATE_LOBBY, onLobbyUpdate);
    socket.on(SOCKET_EVENTS.PLAYER_JOINED, onPlayerJoined);
    socket.on(SOCKET_EVENTS.PLAYER_LEFT, onPlayerLeft);
    socket.on(SOCKET_EVENTS.GAME_STARTING, onGameStarting);
    socket.on(SOCKET_EVENTS.GAME_STARTED, onGameStarted);
    socket.on(SOCKET_EVENTS.TELEMETRY_GHOST_UPDATE, onGhostUpdate);
    socket.on(SOCKET_EVENTS.GAME_PUZZLE_SOLVED, onPuzzleSolved);
    socket.on(SOCKET_EVENTS.GAME_TIMEOUT, onTimeout);
    socket.on(SOCKET_EVENTS.GAME_POST_MORTEM_SUMMARY, onPostMortemSummary);

    return () => {
      socket.off(SOCKET_EVENTS.JOIN_SUCCESS, onJoinSuccess);
      socket.off(SOCKET_EVENTS.JOIN_ERROR, onJoinError);
      socket.off(SOCKET_EVENTS.UPDATE_LOBBY, onLobbyUpdate);
      socket.off(SOCKET_EVENTS.PLAYER_JOINED, onPlayerJoined);
      socket.off(SOCKET_EVENTS.PLAYER_LEFT, onPlayerLeft);
      socket.off(SOCKET_EVENTS.GAME_STARTING, onGameStarting);
      socket.off(SOCKET_EVENTS.GAME_STARTED, onGameStarted);
      socket.off(SOCKET_EVENTS.TELEMETRY_GHOST_UPDATE, onGhostUpdate);
      socket.off(SOCKET_EVENTS.GAME_PUZZLE_SOLVED, onPuzzleSolved);
      socket.off(SOCKET_EVENTS.GAME_TIMEOUT, onTimeout);
      socket.off(SOCKET_EVENTS.GAME_POST_MORTEM_SUMMARY, onPostMortemSummary);
    };
  }, [socket, addLog]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleEstablishConnection = useCallback(() => {
    if (!socket || !isConnected) {
      setError("SOCKET OFFLINE — server unreachable.");
      addLog("ERROR: Socket connection not established", "error");
      return;
    }

    const trimmedName = operatorName.trim();
    const trimmedCode = roomCode.trim().toUpperCase();

    if (!trimmedName) {
      setError("OPERATOR NAME required.");
      return;
    }
    if (trimmedName.length < 2) {
      setError("OPERATOR NAME must be at least 2 characters.");
      return;
    }
    if (!trimmedCode) {
      setError("ROOM CODE required.");
      return;
    }
    if (trimmedCode.length < 2) {
      setError("ROOM CODE must be at least 2 characters.");
      return;
    }

    setError(null);
    setAppState("connecting");
    addLog(`Initiating handshake — OPERATOR: ${trimmedName} / ROOM: ${trimmedCode}`, "info");

    const payload: JoinRoomPayload = {
      playerName: trimmedName,
      roomId: trimmedCode,
      dbUserId: (session?.user as any)?.id,
    };

    socket.emit(SOCKET_EVENTS.JOIN_ROOM, payload);
  }, [socket, isConnected, operatorName, roomCode, addLog]);

  const handleStartGame = useCallback(() => {
    if (!socket || !room) return;
    if (room.players.length < MAX_PLAYERS_PER_ROOM) return;

    addLog("Requesting calibration initialization...", "info");
    socket.emit(SOCKET_EVENTS.START_GAME);
  }, [socket, room, addLog]);

  const handleDisconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setTimeout(() => socket.connect(), 100);
    }
    setAppState("landing");
    setRoom(null);
    setPlayerId(null);
    setGameData(null);
    setSelectedLine(null);
    setIsLocked(false);
    setGhostSelections({ operator_1: null, operator_2: null, operator_3: null });
    setPuzzleSolved(false);
    setMissionFailed(false);
    setPostMortemSummary(null);
    setError(null);
    setLogs([]);
    addLog("Session terminated. Ready for new connection.", "info");
  }, [socket, addLog]);

  const handleLineSelect = useCallback((lineNumber: number) => {
    if (!socket || !gameData || isLocked || puzzleSolved) return;
    
    const newSelection = selectedLine === lineNumber ? null : lineNumber;
    setSelectedLine(newSelection);

    const payload: SelectionPayload = {
      roomId: gameData.session.roomId,
      userId: playerId!,
      operatorRole: gameData.assignment.role,
      selectedLineIndex: newSelection
    };
    socket.emit(SOCKET_EVENTS.TELEMETRY_LINE_SELECTED, payload);
  }, [socket, gameData, isLocked, puzzleSolved, selectedLine, playerId]);

  const handleLockSelection = useCallback(() => {
    if (!socket || !gameData || selectedLine === null || isLocked || puzzleSolved) return;

    setIsLocked(true);
    addLog(`Locked in line ${selectedLine}. Awaiting teammates...`, "info");

    const payload: LockPayload = {
      roomId: gameData.session.roomId,
      userId: playerId!,
      operatorRole: gameData.assignment.role,
      lockedLineIndex: selectedLine
    };
    socket.emit(SOCKET_EVENTS.GAME_LOCK_SELECTION, payload);
  }, [socket, gameData, selectedLine, isLocked, puzzleSolved, playerId, addLog]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && appState === "landing") {
        handleEstablishConnection();
      }
    },
    [appState, handleEstablishConnection]
  );

  // ── Derived State ───────────────────────────────────────────────
  const isRoomFull = room ? room.players.length >= MAX_PLAYERS_PER_ROOM : false;
  const canStart = isRoomFull && !room?.gameStarted;
  const emptySlots = room
    ? MAX_PLAYERS_PER_ROOM - room.players.length
    : MAX_PLAYERS_PER_ROOM;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="scanline-overlay" />

      {/* Background grid effect */}
      <div
        className="fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(52, 211, 153, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(52, 211, 153, 1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Data stream background */}
      <div className="fixed inset-0 bg-data-stream opacity-50" />

      {/* Connection Status Indicator */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <div className="relative">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-400" : "bg-red-500"
            }`}
          />
          {isConnected && (
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse-ring" />
          )}
        </div>
        <span className="text-[10px] tracking-widest uppercase text-neutral-500">
          {isConnected ? "LINK ACTIVE" : "NO SIGNAL"}
        </span>
      </div>

      {/* Main Content Container */}
      <div className={`relative z-10 w-full transition-all duration-500 ${appState === "active" ? "max-w-5xl" : "max-w-xl"}`}>
        {/* Header */}
        <header className="text-center mb-8 animate-slide-up">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-500/50" />
            <span className="text-[10px] tracking-[0.3em] text-emerald-500/60 uppercase">
              System v0.1.0
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-500/50" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight animate-flicker">
            <span className="text-emerald-400 text-glow-emerald">SYNCHRO</span>
          </h1>
          <p className="text-[11px] tracking-[0.25em] text-neutral-500 mt-2 uppercase">
            Calibration Deck Interface
          </p>
        </header>

        {/* ─── STATE: LANDING ────────────────────────────────────── */}
        {(appState === "landing" || appState === "connecting") && (
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="border border-border rounded-lg bg-surface/80 backdrop-blur-sm overflow-hidden glow-emerald">
              {/* Terminal Header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-neutral-900/50">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <span className="text-[10px] text-neutral-500 ml-2 tracking-wider">
                  synchro://connect
                </span>
              </div>

              {/* Terminal Body */}
              <div className="p-6 space-y-5">
                {/* Operator Name */}
                <div>
                  <label
                    htmlFor="operator-name"
                    className="block text-[10px] tracking-[0.2em] text-neutral-500 uppercase mb-2"
                  >
                    ▸ Operator Designation
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/40 text-sm">
                      $
                    </span>
                    <input
                      id="operator-name"
                      type="text"
                      value={operatorName}
                      onChange={(e) => {
                        setOperatorName(e.target.value);
                        setError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter callsign..."
                      maxLength={24}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={appState === "connecting"}
                      className="w-full bg-neutral-900/80 border border-border rounded px-3 py-2.5 pl-8 text-sm text-emerald-400 placeholder:text-neutral-600 focus:border-emerald-500/50 transition-colors duration-200 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Room Code */}
                <div>
                  <label
                    htmlFor="room-code"
                    className="block text-[10px] tracking-[0.2em] text-neutral-500 uppercase mb-2"
                  >
                    ▸ Room Access Code
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/40 text-sm">
                      #
                    </span>
                    <input
                      id="room-code"
                      type="text"
                      value={roomCode}
                      onChange={(e) => {
                        setRoomCode(e.target.value.toUpperCase());
                        setError(null);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="e.g. ALPHA-7"
                      maxLength={20}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={appState === "connecting"}
                      className="w-full bg-neutral-900/80 border border-border rounded px-3 py-2.5 pl-8 text-sm text-emerald-400 uppercase tracking-wider placeholder:text-neutral-600 placeholder:normal-case placeholder:tracking-normal focus:border-emerald-500/50 transition-colors duration-200 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded bg-red-500/5 border border-red-500/20">
                    <span className="text-red-400 text-xs shrink-0 mt-0.5">
                      ✕
                    </span>
                    <p className="text-xs text-red-400/90 leading-relaxed">
                      {error}
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  id="btn-establish-connection"
                  onClick={handleEstablishConnection}
                  disabled={
                    appState === "connecting" ||
                    !isConnected ||
                    !operatorName.trim() ||
                    !roomCode.trim()
                  }
                  className="w-full relative group cursor-pointer"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 via-emerald-400/30 to-emerald-500/20 rounded-lg blur-sm opacity-0 group-hover:opacity-100 group-disabled:opacity-0 transition-opacity duration-300" />
                  <div className="relative bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400/50 rounded-lg px-6 py-3 text-emerald-400 text-sm tracking-widest uppercase transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10 disabled:hover:border-emerald-500/30">
                    {appState === "connecting" ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        Establishing Link...
                      </span>
                    ) : (
                      "Establish Connection"
                    )}
                  </div>
                </button>

                {/* Connection Hint */}
                {!isConnected && (
                  <p className="text-[10px] text-center text-neutral-600 tracking-wider">
                    Awaiting server handshake...
                  </p>
                )}

                {/* Auth Controls */}
                <div className="pt-4 border-t border-border/50">
                  {status === "loading" ? (
                     <p className="text-[10px] text-center text-neutral-600 tracking-wider">Verifying Identity...</p>
                  ) : session ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-[10px] text-center text-emerald-500/70 tracking-wider">
                        Identified as: {session.user?.name}
                      </p>
                      <button
                        onClick={() => signOut()}
                        className="text-[10px] text-neutral-500 hover:text-red-400 uppercase tracking-widest transition-colors cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] text-center text-neutral-500 tracking-wider uppercase mb-1">
                        Authenticate Identity (Optional)
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => signIn("github")}
                          className="flex-1 py-2 bg-neutral-900 border border-border hover:border-neutral-500 rounded text-[10px] text-neutral-400 uppercase tracking-widest transition-colors cursor-pointer"
                        >
                          GitHub
                        </button>
                        <button
                          onClick={() => signIn("discord")}
                          className="flex-1 py-2 bg-neutral-900 border border-border hover:border-neutral-500 rounded text-[10px] text-neutral-400 uppercase tracking-widest transition-colors cursor-pointer"
                        >
                          Discord
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── STATE: LOBBY ──────────────────────────────────────── */}
        {appState === "lobby" && room && (
          <div className="space-y-4 animate-slide-up">
            {/* Room Header Card */}
            <div className="border border-border rounded-lg bg-surface/80 backdrop-blur-sm overflow-hidden glow-emerald">
              {/* Terminal Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-neutral-900/50">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                  </div>
                  <span className="text-[10px] text-neutral-500 ml-2 tracking-wider">
                    synchro://room/{room.id.toLowerCase()}
                  </span>
                </div>
                <button
                  id="btn-disconnect"
                  onClick={handleDisconnect}
                  className="text-[10px] text-neutral-600 hover:text-red-400 tracking-wider uppercase transition-colors cursor-pointer"
                >
                  [DISCONNECT]
                </button>
              </div>

              <div className="p-6">
                {/* Room Info */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase mb-1">
                      Room Code
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 tracking-wider text-glow-emerald">
                      {room.id}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase mb-1">
                      Crew Status
                    </div>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: MAX_PLAYERS_PER_ROOM }).map(
                        (_, i) => (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-sm transition-all duration-300 ${
                              i < room.players.length
                                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                : "bg-neutral-800 border border-neutral-700"
                            }`}
                          />
                        )
                      )}
                      <span className="text-xs text-neutral-500 ml-2">
                        {room.players.length}/{MAX_PLAYERS_PER_ROOM}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-border-bright to-transparent mb-6" />

                {/* Player List */}
                <div className="space-y-2">
                  <div className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase mb-3">
                    ▸ Connected Operators
                  </div>

                  {room.players.map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-3 rounded bg-neutral-900/50 border border-border hover:border-emerald-500/20 transition-all duration-200 animate-slide-up"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      {/* Status indicator */}
                      <div className="relative shrink-0">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse-ring" />
                      </div>

                      {/* Player info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-emerald-400 font-medium truncate">
                            {player.name}
                          </span>
                          {player.id === playerId && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 tracking-wider">
                              YOU
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Operator number */}
                      <span className="text-[10px] text-neutral-600 tracking-wider">
                        OP-{String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  ))}

                  {/* Empty Slots */}
                  {Array.from({ length: emptySlots }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center gap-3 p-3 rounded border border-dashed border-neutral-800"
                    >
                      <div className="w-2 h-2 rounded-full bg-neutral-800" />
                      <span className="text-xs text-neutral-700 italic">
                        Awaiting operator...
                      </span>
                      <span className="ml-auto text-[10px] text-neutral-800 tracking-wider">
                        OP-{String(room.players.length + i + 1).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-border-bright to-transparent my-6" />

                {/* Start Game / Waiting Indicator */}
                {canStart ? (
                  <button
                    id="btn-start-game"
                    onClick={handleStartGame}
                    className="w-full relative group cursor-pointer"
                  >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-600/30 via-emerald-400/40 to-emerald-600/30 rounded-lg blur-sm group-hover:blur-md transition-all duration-300 animate-pulse" />
                    <div className="relative bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/50 hover:border-emerald-400/70 rounded-lg px-6 py-3.5 text-emerald-400 text-sm tracking-widest uppercase transition-all duration-200 glow-emerald-strong">
                      <span className="flex items-center justify-center gap-3">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Initialize Calibration
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="text-center py-3">
                    <div className="flex items-center justify-center gap-2 text-neutral-500">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500/70 animate-pulse" />
                      <span className="text-xs tracking-widest uppercase">
                        Awaiting Crew
                      </span>
                      <span className="animate-blink text-yellow-500/70">
                        ▊
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-600 mt-1.5 tracking-wider">
                      {emptySlots} more operator{emptySlots !== 1 ? "s" : ""}{" "}
                      needed to initialize
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* System Log */}
            <div className="border border-border rounded-lg bg-surface/60 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-neutral-900/30">
                <span className="text-[10px] text-neutral-500 tracking-wider uppercase">
                  System Log
                </span>
                <span className="text-[10px] text-neutral-700">
                  {logs.length} entries
                </span>
              </div>
              <div
                ref={logContainerRef}
                className="max-h-32 overflow-y-auto p-3 space-y-1"
              >
                {logs.length === 0 ? (
                  <p className="text-[10px] text-neutral-700 italic">
                    No system events recorded.
                  </p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex gap-2 text-[10px]">
                      <span className="text-neutral-700 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString("en-US", {
                          hour12: false,
                        })}
                      </span>
                      <span
                        className={
                          log.type === "success"
                            ? "text-emerald-500"
                            : log.type === "error"
                              ? "text-red-400"
                              : log.type === "warning"
                                ? "text-yellow-500"
                                : "text-neutral-500"
                        }
                      >
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── STATE: ACTIVE GAME ────────────────────────────────── */}
        {appState === "active" && gameData && (
          <div className="space-y-4 animate-slide-up">
            {/* Top Banner - Shared Alert */}
            <div className="border border-red-500/30 bg-red-500/10 backdrop-blur-sm rounded-lg p-4 flex items-start gap-4 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <div className="mt-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse-ring shrink-0" />
              <div>
                <div className="text-[10px] tracking-[0.2em] text-red-400 uppercase mb-1 font-bold">
                  System Alert Broadcast
                </div>
                <div className="text-sm font-medium text-red-200 tracking-wide">
                  {gameData.session.sharedAlert}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {postMortemSummary && (
                <PostMortemView summary={postMortemSummary} socket={socket} />
              )}
              {/* Left Panel - Status & Voice */}
              <div className="col-span-1 flex flex-col gap-4">
                <StatusDeck 
                  socket={socket} 
                  gameData={gameData} 
                  isActiveApp={appState === "active"} 
                  onDisconnect={handleDisconnect} 
                />
                
                {selectedLine !== null && !isLocked && !puzzleSolved && !missionFailed && (
                  <button
                    onClick={handleLockSelection}
                    className="w-full py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500 text-emerald-400 font-bold text-xs tracking-widest uppercase rounded shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all animate-pulse cursor-pointer"
                  >
                    LOCK IN SELECTION
                  </button>
                )}
              </div>

              {/* Center Workspace - Code/Text Lines */}
              <div className="col-span-1 md:col-span-3 border border-border rounded-lg bg-neutral-950/90 backdrop-blur-md p-0 font-mono text-sm overflow-hidden glow-emerald flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-neutral-900/50">
                  <div className="text-[10px] tracking-[0.2em] text-emerald-500/50 uppercase">
                    Data Stream: {gameData.session.puzzleTitle}
                  </div>
                  <div className="text-[10px] tracking-widest text-neutral-500">
                    ID: {gameData.session.puzzleId}
                  </div>
                </div>
                
                <div className="p-4 overflow-x-auto flex-1 relative">
                  {puzzleSolved && (
                    <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center animate-pulse">
                      <div className="text-emerald-400 font-bold text-2xl tracking-widest mb-2 border border-emerald-500 px-6 py-4 rounded bg-emerald-900/50">
                        SYSTEM RESTORED
                      </div>
                      <div className="text-emerald-300/70 text-xs uppercase tracking-[0.3em]">
                        Data Alignment Verified
                      </div>
                    </div>
                  )}
                  {missionFailed && (
                    <div className="absolute inset-0 bg-red-950/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center animate-pulse">
                      <div className="text-red-400 font-bold text-3xl tracking-widest mb-2 border border-red-500 px-6 py-4 rounded bg-red-900/50 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                        MISSION FAILED
                      </div>
                      <div className="text-red-300/70 text-sm uppercase tracking-[0.3em]">
                        System Compromised
                      </div>
                      <button
                        onClick={handleDisconnect}
                        className="mt-8 px-8 py-3 border border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs tracking-widest uppercase rounded transition-colors cursor-pointer"
                      >
                        RETURN TO LOBBY
                      </button>
                    </div>
                  )}
                  <div className="min-w-[500px]">
                    {gameData.view.lines.map((line) => {
                      const ghosts = (Object.keys(ghostSelections) as OperatorRole[])
                        .filter(role => role !== gameData.assignment.role && ghostSelections[role] === line.lineNumber)
                        .map(role => ({
                          operatorRole: role,
                          roleLabel: gameData.crew.find(c => c.role === role)?.roleLabel || role
                        }));

                      return (
                        <CodeLine
                          key={line.lineNumber}
                          line={line}
                          isLocalSelected={selectedLine === line.lineNumber}
                          isLocked={isLocked && selectedLine === line.lineNumber}
                          ghosts={ghosts}
                          onSelect={handleLineSelect}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center mt-8 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <p className="text-[9px] tracking-[0.3em] text-neutral-700 uppercase">
            Synchro Protocol v0.1.0 • 3-Operator System • Encrypted Channel
          </p>
        </footer>
      </div>
    </main>
  );
}
