"use client";

/**
 * Synchro — CodeLine Component
 *
 * Renders a single line of the puzzle code.
 * Handles local selection and displays ghost highlights from teammates.
 */

import { CodeLine as ICodeLine, OperatorRole } from "@synchro/shared";

interface GhostData {
  operatorRole: OperatorRole;
  roleLabel: string;
}

interface CodeLineProps {
  line: ICodeLine;
  isLocalSelected: boolean;
  isLocked: boolean;
  ghosts: GhostData[];
  onSelect: (lineNumber: number) => void;
}

export function CodeLine({
  line,
  isLocalSelected,
  isLocked,
  ghosts,
  onSelect,
}: CodeLineProps) {
  // Determine ghost styling.
  // We prioritize rendering the borders based on who is looking.
  // OP_1 = Cyan, OP_2 = Fuchsia, OP_3 = Amber
  const ghostColors: Record<OperatorRole, string> = {
    operator_1: "border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)] bg-cyan-500/10",
    operator_2: "border-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.3)] bg-fuchsia-500/10",
    operator_3: "border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)] bg-amber-500/10",
  };

  const ghostTagColors: Record<OperatorRole, string> = {
    operator_1: "text-cyan-400 bg-cyan-500/20 border-cyan-500/30",
    operator_2: "text-fuchsia-400 bg-fuchsia-500/20 border-fuchsia-500/30",
    operator_3: "text-amber-400 bg-amber-500/20 border-amber-500/30",
  };

  // If there are ghosts, grab the first one to determine the primary line color.
  // If multiple operators look at the same line, they will stack tags but share the border color of the first.
  const activeGhost = ghosts.length > 0 ? ghosts[0] : null;

  let containerClass = "flex items-center group transition-colors cursor-crosshair rounded my-0.5 border border-transparent";
  
  if (isLocalSelected) {
    // Local player has selected this line
    containerClass += isLocked
      ? " border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)] bg-emerald-500/20" // Locked state
      : " border-emerald-500/50 bg-emerald-900/30"; // Selected but not locked
  } else if (activeGhost) {
    // Teammate has selected this line
    containerClass += ` ${ghostColors[activeGhost.operatorRole]}`;
  } else {
    // Default state
    containerClass += " hover:bg-emerald-900/10";
  }

  return (
    <div
      className={containerClass}
      onClick={() => {
        if (!isLocked) onSelect(line.lineNumber);
      }}
    >
      <div className="w-8 shrink-0 text-right pr-3 text-neutral-600 select-none border-r border-neutral-800 group-hover:border-emerald-500/30 text-xs pt-0.5 self-stretch flex items-center justify-end">
        {line.lineNumber}
      </div>
      
      <div
        className="pl-4 whitespace-pre text-emerald-400/90 py-1 transition-colors flex-1 flex items-center justify-between"
        style={{ paddingLeft: `${(line.indent || 0) * 0.5 + 1}rem` }}
      >
        <span>{line.content || " "}</span>
        
        {/* Render tags for ghosts and local selection */}
        <div className="flex gap-1 pr-2">
          {ghosts.map(ghost => (
            <span
              key={ghost.operatorRole}
              className={`text-[9px] px-1.5 py-0.5 rounded border tracking-wider uppercase animate-pulse ${ghostTagColors[ghost.operatorRole]}`}
            >
              [{ghost.operatorRole === "operator_1" ? "OP_1" : ghost.operatorRole === "operator_2" ? "OP_2" : "OP_3"}]
            </span>
          ))}
          {isLocalSelected && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border tracking-wider uppercase text-emerald-400 bg-emerald-500/20 border-emerald-500/30">
              {isLocked ? "[LOCKED]" : "[YOU]"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
