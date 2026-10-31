"use client";

/**
 * One line of code or log text on a player's screen.
 * Shows the player's own selection and ghost highlights from teammates.
 */

import type { CodeLine as CodeLineData, OperatorRole } from "@synchro/shared";
import { OPERATOR_STYLE } from "@/lib/operators";

export interface Ghost {
  operatorRole: OperatorRole;
  playerName: string;
}

interface CodeLineProps {
  line: CodeLineData;
  isSelected: boolean;
  isLocked: boolean;
  /** True once the round is over or locked, so lines can no longer be changed */
  disabled: boolean;
  ghosts: Ghost[];
  onSelect: (lineNumber: number) => void;
}

export function CodeLine({ line, isSelected, isLocked, disabled, ghosts, onSelect }: CodeLineProps) {
  let stateClass = "border-transparent hover:bg-emerald-900/20";
  if (isSelected) {
    stateClass = isLocked
      ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.4)]"
      : "border-emerald-500/60 bg-emerald-900/30";
  } else if (ghosts.length > 0) {
    stateClass = OPERATOR_STYLE[ghosts[0].operatorRole].line;
  }

  const select = () => {
    if (!disabled) onSelect(line.lineNumber);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={isSelected}
      aria-label={`Line ${line.lineNumber}: ${line.content || "blank"}`}
      onClick={select}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select();
        }
      }}
      className={`group flex items-stretch rounded-md my-0.5 border transition-colors ${
        disabled ? "cursor-default" : "cursor-pointer"
      } ${stateClass}`}
    >
      <div className="w-10 shrink-0 flex items-center justify-end pr-3 text-xs text-neutral-600 select-none border-r border-neutral-800 group-hover:border-emerald-500/30">
        {line.lineNumber}
      </div>

      <div
        className="flex-1 flex items-center justify-between gap-3 py-1.5 pr-2 whitespace-pre font-mono text-sm text-emerald-300"
        style={{ paddingLeft: `calc(${line.indent || 0}ch + 1rem)` }}
      >
        <span>{line.content || " "}</span>

        <span className="flex gap-1.5 shrink-0">
          {ghosts.map((ghost) => (
            <span
              key={ghost.operatorRole}
              className={`text-[11px] font-sans px-2 py-0.5 rounded-full border ${OPERATOR_STYLE[ghost.operatorRole].tag}`}
            >
              {ghost.playerName}
            </span>
          ))}
          {isSelected && (
            <span className="text-[11px] font-sans px-2 py-0.5 rounded-full border text-emerald-200 bg-emerald-500/20 border-emerald-400/50">
              {isLocked ? "Locked 🔒" : "Your pick"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
