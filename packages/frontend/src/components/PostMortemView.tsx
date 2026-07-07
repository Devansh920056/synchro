"use client";

import { PostMortemSummaryPayload, OperatorRole, CodeLine } from "@synchro/shared";
import { Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@synchro/shared";

interface PostMortemViewProps {
  summary: PostMortemSummaryPayload;
  socket: Socket | null;
}

export function PostMortemView({ summary, socket }: PostMortemViewProps) {
  const { wasWon, explanation, views } = summary;

  const handleRequeue = () => {
    if (socket) {
      socket.emit(SOCKET_EVENTS.ROOM_REQUEUE);
    }
  };

  const renderCodeBlock = (role: OperatorRole, lines: CodeLine[]) => {
    return (
      <div key={role} className="flex-1 flex flex-col border border-border rounded bg-neutral-950/80 overflow-hidden">
        <div className="px-3 py-1 bg-neutral-900 border-b border-border text-xs tracking-widest text-neutral-500 uppercase">
          {role.replace('_', ' ')}
        </div>
        <div className="p-3 overflow-y-auto text-[10px] font-mono leading-relaxed max-h-[400px]">
          {lines.map((line, idx) => (
            <div
              key={idx}
              className={`flex rounded px-1 py-0.5 ${
                line.isMismatchLine
                  ? "bg-emerald-900/40 text-emerald-300 font-bold border-l-2 border-emerald-500"
                  : "text-neutral-400"
              }`}
            >
              <div className="w-6 shrink-0 text-right pr-2 text-neutral-600 select-none">
                {line.lineNumber}
              </div>
              <div
                className="whitespace-pre"
                style={{ paddingLeft: `${(line.indent || 0) * 0.5}rem` }}
              >
                {line.content || " "}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-8 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className={`w-full py-4 px-6 rounded-lg mb-6 border flex flex-col items-center justify-center text-center shadow-lg ${
        wasWon 
          ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-400 shadow-emerald-500/20" 
          : "bg-red-950/50 border-red-500/50 text-red-400 shadow-red-500/20"
      }`}>
        <h1 className="text-3xl font-bold tracking-[0.3em] uppercase mb-2">
          {wasWon ? "Calibration Success" : "Core Critical Collapse"}
        </h1>
        <p className="text-sm tracking-widest opacity-80 uppercase">
          Post-Mortem Diagnostic
        </p>
      </div>

      {/* Side-by-side Code Views */}
      <div className="flex-1 flex gap-4 min-h-0 mb-6">
        {renderCodeBlock("operator_1", views.operator_1)}
        {renderCodeBlock("operator_2", views.operator_2)}
        {renderCodeBlock("operator_3", views.operator_3)}
      </div>

      {/* Explanation Footer */}
      <div className="bg-neutral-900/80 border border-neutral-700 rounded-lg p-6 mb-6">
        <h3 className="text-xs tracking-widest text-neutral-500 uppercase mb-3">Diagnostic Analysis</h3>
        <p className="text-neutral-300 text-sm leading-relaxed">
          {explanation}
        </p>
      </div>

      {/* Action Bar */}
      <div className="flex justify-center gap-6 mt-auto">
        <button
          onClick={handleRequeue}
          className="px-8 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500 text-emerald-400 text-xs font-bold tracking-widest uppercase rounded shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all"
        >
          Re-Queue With Crew
        </button>
      </div>
    </div>
  );
}
