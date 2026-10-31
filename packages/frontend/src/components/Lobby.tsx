"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_PLAYERS_PER_ROOM, type Room } from "@synchro/shared";
import { TerminalCard } from "./TerminalCard";

interface LobbyProps {
  room: Room;
  playerId: string | null;
  error: string | null;
  onStart: () => void;
  onLeave: () => void;
}

export function Lobby({ room, playerId, error, onStart, onLeave }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the code is still on screen to read out
    }
  };

  const isFull = room.players.length >= MAX_PLAYERS_PER_ROOM;
  const missing = MAX_PLAYERS_PER_ROOM - room.players.length;

  return (
    <TerminalCard
      title={`synchro / room / ${room.id.toLowerCase()}`}
      action={
        <button
          id="btn-leave"
          onClick={onLeave}
          className="text-xs text-neutral-400 hover:text-red-400 underline underline-offset-2 transition-colors cursor-pointer shrink-0"
        >
          Leave room
        </button>
      }
    >
      <div className="p-6 space-y-6">
        {/* Room code */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs text-neutral-500 mb-1">Room code (share this)</div>
            <div className="text-3xl font-bold text-emerald-400 tracking-wider text-glow-emerald">{room.id}</div>
          </div>
          <button
            onClick={copyCode}
            className="px-3 py-1.5 rounded-lg border border-border hover:border-emerald-500/50 text-xs text-neutral-300 transition-colors cursor-pointer"
          >
            {copied ? "Copied ✓" : "Copy code"}
          </button>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border-bright to-transparent" />

        {/* Players */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm text-neutral-300 font-semibold">Players</h2>
            <span className="text-xs text-neutral-500">
              {room.players.length} of {MAX_PLAYERS_PER_ROOM} joined
            </span>
          </div>

          <ul className="space-y-2">
            {room.players.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/60 border border-border animate-slide-up"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
                <span className="text-base text-emerald-300 font-medium truncate">{player.name}</span>
                {player.id === playerId && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    You
                  </span>
                )}
              </li>
            ))}

            {Array.from({ length: missing }).map((_, i) => (
              <li
                key={`empty-${i}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-neutral-700"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-700 shrink-0" aria-hidden="true" />
                <span className="text-sm text-neutral-500 italic">Waiting for a player…</span>
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Start */}
        {isFull ? (
          <div className="space-y-2">
            <button
              id="btn-start-game"
              onClick={onStart}
              disabled={room.gameStarted}
              className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 rounded-lg px-6 py-3.5 text-emerald-200 font-semibold tracking-wide transition-all cursor-pointer glow-emerald-strong disabled:opacity-50 disabled:cursor-wait"
            >
              {room.gameStarted ? "Starting…" : "Start game"}
            </button>
            <p className="text-xs text-center text-neutral-500">
              Tip: turn on your microphone when asked, so you can talk to each other.
            </p>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-neutral-300">
              Waiting for {missing} more player{missing === 1 ? "" : "s"}…
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Send them the room code above. The game starts when all {MAX_PLAYERS_PER_ROOM} are here.
            </p>
          </div>
        )}
      </div>
    </TerminalCard>
  );
}
