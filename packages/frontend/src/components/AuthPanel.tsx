"use client";

import { useSession, signIn, signOut } from "next-auth/react";

/** Optional sign-in, used to save match history and stats */
export function AuthPanel() {
  const { data: session, status } = useSession();

  return (
    <div className="pt-5 border-t border-border/60">
      {status === "loading" ? (
        <p className="text-xs text-center text-neutral-600">Checking sign-in…</p>
      ) : session ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-400/80 truncate">
            Signed in as <span className="font-semibold">{session.user?.name ?? "player"}</span>. Your games are saved.
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-xs text-neutral-500 hover:text-red-400 underline underline-offset-2 transition-colors cursor-pointer shrink-0"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-center text-neutral-500">
            Optional: sign in to save your game history.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["github", "discord"] as const).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => signIn(provider)}
                className="py-2 bg-neutral-900 border border-border hover:border-neutral-500 rounded-lg text-xs text-neutral-300 capitalize transition-colors cursor-pointer"
              >
                {provider}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
