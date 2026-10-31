"use client";

import type { Socket } from "socket.io-client";
import type { GameStartedPayload, OperatorRole } from "@synchro/shared";
import { CodeLine } from "./CodeLine";
import { StatusDeck } from "./StatusDeck";

interface GameViewProps {
  socket: Socket | null;
  gameData: GameStartedPayload;
  selectedLine: number | null;
  isLocked: boolean;
  isFinished: boolean;
  ghostSelections: Record<OperatorRole, number | null>;
  /** A short message such as "Not quite, try again" */
  notice: string | null;
  onSelectLine: (lineNumber: number) => void;
  onLock: () => void;
  onLeave: () => void;
}

export function GameView({
  socket,
  gameData,
  selectedLine,
  isLocked,
  isFinished,
  ghostSelections,
  notice,
  onSelectLine,
  onLock,
  onLeave,
}: GameViewProps) {
  const myRole = gameData.assignment.role;
  const nameByRole = new Map(gameData.crew.map((c) => [c.role, c.playerName]));

  let lockHint = "Click a line to pick it.";
  if (isFinished) lockHint = "Round finished.";
  else if (isLocked) lockHint = "Locked in. Waiting for your teammates…";
  else if (selectedLine !== null) lockHint = `Ready? Lock in line ${selectedLine}.`;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* The shared problem */}
      <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-4 flex items-start gap-3">
        <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden="true" />
        <div>
          <div className="text-xs text-red-300 font-semibold mb-0.5">The problem (everyone sees this)</div>
          <div className="text-base text-red-100">{gameData.session.sharedAlert}</div>
        </div>
      </div>

      {/* What to do */}
      <p className="text-sm text-neutral-300 px-1">
        <span className="text-emerald-400 font-semibold">Your job: </span>
        tell your team what&apos;s on your screen, and listen to theirs. Find the one line that doesn&apos;t match the
        others, click it, then lock it in.
      </p>

      {notice && (
        <div role="alert" className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-200">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Side panel (below the code on small screens) */}
        <div className="flex flex-col gap-4 order-last lg:order-first">
          <StatusDeck key={gameData.session.startedAt} socket={socket} gameData={gameData} onLeave={onLeave} />

          <div className="space-y-2">
            <button
              onClick={onLock}
              disabled={selectedLine === null || isLocked || isFinished}
              className="w-full py-3.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/20"
            >
              {isLocked ? "Locked 🔒" : "Lock in my pick"}
            </button>
            <p className="text-xs text-center text-neutral-500" aria-live="polite">
              {lockHint}
            </p>
          </div>
        </div>

        {/* The code / log */}
        <section className="lg:col-span-3 border border-border rounded-xl bg-neutral-950/90 overflow-hidden glow-emerald flex flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-neutral-900/60">
            <h2 className="text-sm font-semibold text-neutral-200">{gameData.view.roleLabel}</h2>
            <span className="text-xs text-neutral-500">Puzzle: {gameData.session.puzzleTitle}</span>
          </div>

          <div className="p-4 overflow-x-auto">
            <div className="min-w-[440px]">
              {gameData.view.lines.map((line) => {
                const ghosts = (Object.keys(ghostSelections) as OperatorRole[])
                  .filter((role) => role !== myRole && ghostSelections[role] === line.lineNumber)
                  .map((role) => ({ operatorRole: role, playerName: nameByRole.get(role) ?? "Teammate" }));

                return (
                  <CodeLine
                    key={line.lineNumber}
                    line={line}
                    isSelected={selectedLine === line.lineNumber}
                    isLocked={isLocked}
                    disabled={isLocked || isFinished}
                    ghosts={ghosts}
                    onSelect={onSelectLine}
                  />
                );
              })}
            </div>
          </div>

          <p className="px-4 py-2.5 border-t border-border text-xs text-neutral-500">
            Coloured tags show where teammates are looking right now.
          </p>
        </section>
      </div>
    </div>
  );
}
