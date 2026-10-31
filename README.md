# Synchro

A co-op puzzle game for **3 players**. Each player sees a different screen (code or logs) and has to talk to the others to find the one line that doesn't match. Lock in the right lines within 60 seconds to win.

## How to play

1. **Join a room.** Pick a name and a room code. Share the code with two friends.
2. **Compare screens.** Everyone sees something different. Describe what you see (voice chat is built in) and spot the mismatch.
3. **Lock in.** Click your line, press *Lock in my pick*. If all three picks are right, you win.

## Features

- Room-based multiplayer (3 players per room)
- Real-time sync and built-in peer-to-peer voice chat
- Each player gets a different view of the same bug
- Optional GitHub / Discord sign-in and match history

## Tech stack

Next.js · React · TypeScript · Tailwind CSS · Socket.IO · WebRTC · PostgreSQL · Prisma

## Getting started

```bash
pnpm install
cp .env.example .env        # then fill in the values
pnpm db:generate            # generate the Prisma client
pnpm db:push                # create the database tables
pnpm dev                    # starts the game server (3001) and the website (3000)
```

Open <http://localhost:3000> in three browser tabs (or on three devices) to try it.

Other commands: `pnpm build`, `pnpm lint`, `pnpm clean`.

## Project layout

| Folder | What's in it |
| --- | --- |
| `packages/shared` | Types, event names and the puzzle bank used by both sides |
| `packages/backend` | Express + Socket.IO game server |
| `packages/frontend` | Next.js website |
| `prisma` | Database schema |

## Status

🚧 In active development
