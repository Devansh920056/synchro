"use client";

/**
 * Side panel: countdown, your screen, the team (with who is talking),
 * and the microphone controls.
 */

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { SOCKET_EVENTS, type GameStartedPayload, type TimerTickPayload } from "@synchro/shared";
import { useWebRTCAudio } from "@/hooks/useWebRTCAudio";
import { OPERATOR_STYLE, formatTime } from "@/lib/operators";

interface StatusDeckProps {
  socket: Socket | null;
  gameData: GameStartedPayload;
  /** Seconds in a round, shown until the first server tick arrives */
  initialSeconds?: number;
  onLeave: () => void;
}

export function StatusDeck({ socket, gameData, initialSeconds = 60, onLeave }: StatusDeckProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds);
  const { activeSpeakers, micStatus, isMuted, toggleMute } = useWebRTCAudio(socket, gameData, true);

  useEffect(() => {
    if (!socket) return;
    const onTick = (payload: TimerTickPayload) => setTimeRemaining(payload.timeRemaining);
    socket.on(SOCKET_EVENTS.TIMER_TICK, onTick);
    return () => {
      socket.off(SOCKET_EVENTS.TIMER_TICK, onTick);
    };
  }, [socket]);

  const isLowTime = timeRemaining <= 15;
  const myRole = gameData.assignment.role;

  return (
    <aside className="border border-border rounded-xl bg-surface/80 backdrop-blur-sm p-5 glow-emerald flex flex-col gap-5">
      {/* Timer */}
      <div className="text-center pb-5 border-b border-border">
        <div className="text-xs text-neutral-500 mb-1">Time left</div>
        <div
          role="timer"
          aria-live="off"
          className={`font-mono text-4xl font-bold tracking-widest tabular-nums transition-colors ${
            isLowTime ? "text-red-400 animate-pulse" : "text-emerald-400"
          }`}
        >
          {formatTime(timeRemaining)}
        </div>
      </div>

      {/* Your screen */}
      <div>
        <div className="text-xs text-neutral-500 mb-2">You are looking at</div>
        <div className={`px-3 py-2.5 rounded-lg bg-neutral-900/70 border text-sm font-semibold ${OPERATOR_STYLE[myRole].card} ${OPERATOR_STYLE[myRole].text}`}>
          {gameData.view.roleLabel}
        </div>
      </div>

      {/* Team */}
      <div className="flex-1">
        <div className="text-xs text-neutral-500 mb-2">Your team</div>
        <ul className="space-y-3">
          {gameData.crew.map((member) => {
            const isMe = member.role === myRole;
            const isSpeaking = activeSpeakers[member.role];
            return (
              <li key={member.role} className="flex items-center gap-3">
                <span className="relative flex items-center justify-center w-3.5 h-3.5 shrink-0" aria-hidden="true">
                  {isSpeaking && (
                    <span className={`absolute inset-0 rounded-full animate-ping opacity-70 ${OPERATOR_STYLE[member.role].dot}`} />
                  )}
                  <span
                    className={`relative rounded-full ${isSpeaking ? "w-2.5 h-2.5" : "w-2 h-2 opacity-60"} ${OPERATOR_STYLE[member.role].dot}`}
                  />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm truncate ${isMe ? "font-bold text-neutral-100" : "text-neutral-300"}`}>
                    {member.playerName}
                    {isMe && " (you)"}
                    {isSpeaking && <span className="sr-only"> is speaking</span>}
                  </span>
                  <span className="block text-xs text-neutral-500">{member.roleLabel}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Microphone */}
      <div className="space-y-2">
        {micStatus === "blocked" ? (
          <p className="text-xs text-yellow-400/90 leading-relaxed" role="status">
            Microphone is off, so teammates can&apos;t hear you. Allow microphone access in your browser to talk.
          </p>
        ) : (
          <button
            onClick={toggleMute}
            disabled={micStatus === "pending"}
            aria-pressed={isMuted}
            className="w-full py-2 border border-border hover:border-neutral-500 rounded-lg text-sm text-neutral-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {micStatus === "pending" ? "Starting microphone…" : isMuted ? "🔇 Unmute microphone" : "🎙️ Mute microphone"}
          </button>
        )}

        <button
          onClick={onLeave}
          className="w-full py-2 border border-red-500/30 hover:bg-red-500/10 text-red-300 text-sm rounded-lg transition-colors cursor-pointer"
        >
          Leave game
        </button>
      </div>
    </aside>
  );
}
