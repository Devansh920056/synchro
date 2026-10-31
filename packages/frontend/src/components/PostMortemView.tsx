"use client";

import { useState } from "react";
import type { Socket } from "socket.io-client";
import {
  OPERATOR_LABELS,
  OPERATOR_ROLES,
  SOCKET_EVENTS,
  type PostMortemSummaryPayload,
} from "@synchro/shared";
import { OPERATOR_STYLE } from "@/lib/operators";

interface PostMortemViewProps {
  summary: PostMortemSummaryPayload;
  socket: Socket | null;
  onLeave: () => void;
}

/** End-of-round screen: did you win, what was the bug, and all three screens side by side */
export function PostMortemView({ summary, socket, onLeave }: PostMortemViewProps) {
  const { wasWon, explanation, views } = summary;
  const [requested, setRequested] = useState(false);

  const playAgain = () => {
    if (!socket || requested) return;
    setRequested(true);
    socket.emit(SOCKET_EVENTS.ROOM_REQUEUE);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={wasWon ? "You won" : "Time's up"}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md overflow-y-auto animate-fade-in"
    >
      <div className="max-w-6xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
        {/* Result banner */}
        <div
          className={`rounded-xl border px-6 py-6 text-center shadow-lg ${
            wasWon
              ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-emerald-500/20"
              : "bg-red-950/60 border-red-500/50 text-red-300 shadow-red-500/20"
          }`}
        >
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">{wasWon ? "You fixed it! 🎉" : "Time's up ⏱"}</h1>
          <p className="text-sm opacity-80">
            {wasWon
              ? "All three of you found the line that didn't match."
              : "The bug wasn't found in time. Here's what it was."}
          </p>
        </div>

        {/* Explanation */}
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/80 p-5">
          <h2 className="text-sm font-semibold text-neutral-200 mb-2">What went wrong</h2>
          <p className="text-neutral-300 text-sm leading-relaxed">{explanation}</p>
        </div>

        {/* All three screens */}
        <div>
          <h2 className="text-sm font-semibold text-neutral-200 mb-1">All three screens</h2>
          <p className="text-xs text-neutral-500 mb-3">The highlighted lines are the ones that didn&apos;t match.</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {OPERATOR_ROLES.map((role) => (
              <div
                key={role}
                className={`rounded-xl border bg-neutral-950/80 overflow-hidden ${OPERATOR_STYLE[role].card}`}
              >
                <div className={`px-3 py-2 bg-neutral-900 border-b border-border text-sm font-semibold ${OPERATOR_STYLE[role].text}`}>
                  {OPERATOR_LABELS[role]}
                </div>
                <div className="p-3 overflow-x-auto font-mono text-xs leading-relaxed">
                  {views[role].map((line) => (
                    <div
                      key={line.lineNumber}
                      className={`flex items-center rounded px-1 py-0.5 ${
                        line.isMismatchLine
                          ? "bg-emerald-900/40 text-emerald-200 font-bold border-l-2 border-emerald-400"
                          : "text-neutral-400 border-l-2 border-transparent"
                      }`}
                    >
                      <span className="w-6 shrink-0 text-right pr-2 text-neutral-600 select-none">{line.lineNumber}</span>
                      <span className="whitespace-pre" style={{ paddingLeft: `${line.indent || 0}ch` }}>
                        {line.content || " "}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 pb-6">
          <button
            onClick={playAgain}
            disabled={requested}
            className="px-8 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            {requested ? "Starting next round…" : "Play again with this team"}
          </button>
          <button
            onClick={onLeave}
            className="px-8 py-3 border border-neutral-600 hover:border-neutral-400 text-neutral-300 rounded-lg transition-colors cursor-pointer"
          >
            Leave room
          </button>
        </div>
      </div>
    </div>
  );
}
