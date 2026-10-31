"use client";

import { useEffect, useRef } from "react";

export interface LogEntry {
  id: number;
  message: string;
  type: "info" | "success" | "error" | "warning";
  timestamp: number;
}

const TYPE_STYLE: Record<LogEntry["type"], string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-neutral-400",
};

/** A small, auto-scrolling list of what has happened in the room */
export function ActivityLog({ logs }: { logs: LogEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <section className="border border-border rounded-xl bg-surface/60 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-neutral-900/30 text-xs text-neutral-500 tracking-wide uppercase">
        Recent activity
      </div>
      <div ref={containerRef} className="max-h-36 overflow-y-auto p-3 space-y-1.5" aria-live="polite">
        {logs.length === 0 ? (
          <p className="text-xs text-neutral-600 italic">Nothing yet.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-3 text-xs">
              <span className="text-neutral-600 shrink-0 tabular-nums">
                {new Date(log.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </span>
              <span className={TYPE_STYLE[log.type]}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
