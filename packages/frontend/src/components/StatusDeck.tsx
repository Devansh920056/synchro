"use client";

/**
 * Synchro — StatusDeck Component
 *
 * Renders the global countdown timer and the crew manifest, including
 * visual indicators for voice activity via WebRTC.
 */

import { useEffect, useState } from "react";
import { GameStartedPayload, SOCKET_EVENTS, TimerTickPayload } from "@synchro/shared";
import { Socket } from "socket.io-client";
import { useWebRTCAudio } from "../hooks/useWebRTCAudio";

interface StatusDeckProps {
  socket: Socket | null;
  gameData: GameStartedPayload;
  isActiveApp: boolean;
  onDisconnect: () => void;
}

export function StatusDeck({ socket, gameData, isActiveApp, onDisconnect }: StatusDeckProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(60);

  // Initialize WebRTC and get voice activity status for each role
  const { activeSpeakers } = useWebRTCAudio(socket, gameData, isActiveApp);

  useEffect(() => {
    if (!socket || !isActiveApp) return;

    const onTimerTick = (payload: TimerTickPayload) => {
      setTimeRemaining(payload.timeRemaining);
    };

    socket.on(SOCKET_EVENTS.TIMER_TICK, onTimerTick);
    
    return () => {
      socket.off(SOCKET_EVENTS.TIMER_TICK, onTimerTick);
    };
  }, [socket, isActiveApp]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isLowTime = timeRemaining <= 15;

  return (
    <div className="col-span-1 border border-border rounded-lg bg-surface/80 backdrop-blur-sm p-5 glow-emerald flex flex-col">
      {/* Timer Section */}
      <div className="mb-6 pb-6 border-b border-border text-center">
        <div className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase mb-2">
          Time Remaining
        </div>
        <div className={`font-mono text-3xl font-bold tracking-widest transition-colors duration-300 ${isLowTime ? "text-red-500 animate-pulse" : "text-emerald-400"}`}>
          {formatTime(timeRemaining)}
        </div>
      </div>

      {/* Assignment Info */}
      <div className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase mb-3">
        Assignment
      </div>
      <div className="px-3 py-2.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs tracking-wider font-bold shadow-[0_0_10px_rgba(52,211,153,0.2)]">
        {gameData.view.roleLabel}
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent my-5" />

      {/* Crew Manifest & Voice Activity */}
      <div className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase mb-3">
        Crew Manifest
      </div>
      <div className="space-y-3 flex-1">
        {gameData.crew.map((c) => {
          const isMe = c.role === gameData.assignment.role;
          const isSpeaking = activeSpeakers[c.role] || false;
          
          return (
            <div key={c.role} className="flex items-center gap-2">
              <div className="relative flex items-center justify-center w-3 h-3">
                {/* Voice activity indicator */}
                {isSpeaking ? (
                  <>
                    <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                    <div className="relative rounded-full bg-emerald-400 w-2 h-2" />
                  </>
                ) : (
                  <div className={`rounded-full w-1.5 h-1.5 ${isMe ? "bg-emerald-600" : "bg-neutral-600"}`} />
                )}
              </div>
              
              <div className="flex flex-col">
                <span className={`text-xs ${isMe ? "text-emerald-400 font-bold" : "text-neutral-300"}`}>
                  {c.playerName} {isMe && "(YOU)"}
                </span>
                <span className="text-[9px] text-neutral-500 tracking-wider">
                  {c.roleLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      <button
        onClick={onDisconnect}
        className="mt-4 w-full py-2 border border-red-500/30 hover:bg-red-500/10 text-red-400 text-[10px] tracking-wider uppercase rounded transition-colors cursor-pointer"
      >
        ABORT MISSION
      </button>
    </div>
  );
}
