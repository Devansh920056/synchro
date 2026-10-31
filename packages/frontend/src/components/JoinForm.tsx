"use client";

import type { FormEvent } from "react";
import { TerminalCard } from "./TerminalCard";
import { AuthPanel } from "./AuthPanel";

interface JoinFormProps {
  name: string;
  roomCode: string;
  error: string | null;
  isJoining: boolean;
  isServerOnline: boolean;
  onNameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onRandomCode: () => void;
  onSubmit: () => void;
}

const HOW_TO_PLAY = [
  {
    title: "Join the same room",
    text: "Pick a name and a room code. Share the code with two friends. You need exactly 3 players.",
  },
  {
    title: "Compare your screens",
    text: "Each of you sees different code or logs. Talk it through (voice chat is built in) and spot the line that doesn't match.",
  },
  {
    title: "Lock in within 60 seconds",
    text: "Everyone picks their line and locks it in. If all three are right, you win.",
  },
];

const inputClass =
  "w-full bg-neutral-900/80 border border-border rounded-lg px-3 py-3 text-base text-emerald-300 placeholder:text-neutral-600 focus:border-emerald-500/60 transition-colors disabled:opacity-50";

export function JoinForm({
  name,
  roomCode,
  error,
  isJoining,
  isServerOnline,
  onNameChange,
  onRoomCodeChange,
  onRandomCode,
  onSubmit,
}: JoinFormProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const canSubmit = isServerOnline && !isJoining && name.trim() !== "" && roomCode.trim() !== "";

  return (
    <div className="space-y-6">
      <TerminalCard title="synchro / join a room">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="player-name" className="block text-sm text-neutral-300 mb-2">
              Your name
            </label>
            <input
              id="player-name"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={24}
              autoComplete="nickname"
              spellCheck={false}
              disabled={isJoining}
              className={inputClass}
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label htmlFor="room-code" className="text-sm text-neutral-300">
                Room code
              </label>
              <button
                type="button"
                onClick={onRandomCode}
                disabled={isJoining}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 cursor-pointer disabled:opacity-50"
              >
                Make one up
              </button>
            </div>
            <input
              id="room-code"
              type="text"
              value={roomCode}
              onChange={(e) => onRoomCodeChange(e.target.value)}
              placeholder="e.g. ALPHA-7"
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
              disabled={isJoining}
              className={`${inputClass} uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal`}
            />
            <p className="text-xs text-neutral-500 mt-2">
              Everyone who types the same code lands in the same room.
            </p>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <span className="text-red-400 text-sm shrink-0" aria-hidden="true">
                ⚠
              </span>
              <p className="text-sm text-red-300 leading-relaxed">{error}</p>
            </div>
          )}

          <button
            id="btn-join"
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/50 rounded-lg px-6 py-3.5 text-emerald-300 font-semibold tracking-wide transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/15"
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                Joining…
              </span>
            ) : (
              "Join room"
            )}
          </button>

          {!isServerOnline && (
            <p className="text-xs text-center text-yellow-500/90" role="status">
              Connecting to the game server… if this takes long, make sure the server is running.
            </p>
          )}

          <AuthPanel />
        </form>
      </TerminalCard>

      <section aria-labelledby="how-to-play">
        <h2 id="how-to-play" className="text-xs text-neutral-500 tracking-[0.2em] uppercase mb-3 text-center">
          How to play
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {HOW_TO_PLAY.map((step, i) => (
            <li key={step.title} className="rounded-xl border border-border bg-surface/60 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                  {i + 1}
                </span>
                <h3 className="text-sm font-semibold text-neutral-200">{step.title}</h3>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
