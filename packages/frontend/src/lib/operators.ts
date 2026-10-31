import type { OperatorRole } from "@synchro/shared";

/**
 * One colour per screen, so players can tell teammates apart at a glance.
 * Full class names are written out so Tailwind can detect them.
 */
export const OPERATOR_STYLE: Record<
  OperatorRole,
  { text: string; dot: string; tag: string; line: string; card: string }
> = {
  operator_1: {
    text: "text-cyan-300",
    dot: "bg-cyan-400",
    tag: "text-cyan-200 bg-cyan-500/20 border-cyan-400/50",
    line: "border-cyan-400/70 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.25)]",
    card: "border-cyan-500/30",
  },
  operator_2: {
    text: "text-fuchsia-300",
    dot: "bg-fuchsia-400",
    tag: "text-fuchsia-200 bg-fuchsia-500/20 border-fuchsia-400/50",
    line: "border-fuchsia-400/70 bg-fuchsia-500/10 shadow-[0_0_12px_rgba(232,121,249,0.25)]",
    card: "border-fuchsia-500/30",
  },
  operator_3: {
    text: "text-amber-300",
    dot: "bg-amber-400",
    tag: "text-amber-200 bg-amber-500/20 border-amber-400/50",
    line: "border-amber-400/70 bg-amber-500/10 shadow-[0_0_12px_rgba(251,191,36,0.25)]",
    card: "border-amber-500/30",
  },
};

export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60).toString().padStart(2, "0");
  const s = (safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
