import type { ReactNode } from "react";

interface TerminalCardProps {
  /** Text shown in the title bar, like a browser address */
  title: string;
  /** Optional control on the right of the title bar */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A card styled like a small terminal window. Used for the main panels. */
export function TerminalCard({ title, action, children, className = "" }: TerminalCardProps) {
  return (
    <section
      className={`border border-border rounded-xl bg-surface/80 backdrop-blur-sm overflow-hidden glow-emerald ${className}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-neutral-900/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex gap-1.5 shrink-0" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="text-xs text-neutral-500 tracking-wide truncate">{title}</span>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
