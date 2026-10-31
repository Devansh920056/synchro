/**
 * @synchro/backend — Post-Mortem Analytics
 *
 * Handles end-of-game persistence and broadcasts the summary screen.
 */

import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import {
  SOCKET_EVENTS,
  PUZZLE_DATABASE,
  type PostMortemSummaryPayload,
} from "@synchro/shared";
import { getSession, destroySession } from "./gameEngine";

// Created on first use, so a database problem can never stop the game server from starting
let prismaClient: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  return (prismaClient ??= new PrismaClient());
}

export async function handleGameEnd(roomId: string, wasWon: boolean, io: Server) {
  const session = getSession(roomId);
  if (!session) return; // already ended

  // End the session immediately so a late timer tick or a stray lock
  // can never finish the same round twice.
  destroySession(roomId);

  const puzzle = PUZZLE_DATABASE.find((p) => p.id === session.puzzleId);
  if (!puzzle) return;

  const durationSeconds = Math.floor((Date.now() - session.startedAt) / 1000);

  const payload: PostMortemSummaryPayload = {
    roomId,
    wasWon,
    explanation: puzzle.explanation,
    views: puzzle.views,
  };

  io.to(roomId).emit(SOCKET_EVENTS.GAME_POST_MORTEM_SUMMARY, payload);
  console.log(`[POST-MORTEM] Sent summary for room "${roomId}" (won: ${wasWon})`);

  // Save the result in the background. A database problem must never break the game.
  try {
    const prisma = getPrisma();
    const candidateIds = session.assignments
      .map((a) => a.dbUserId)
      .filter((id): id is string => !!id);

    // Only link users that really exist, so a made-up ID can't cause a foreign-key error
    const validUserIds = candidateIds.length
      ? (
          await prisma.user.findMany({
            where: { id: { in: candidateIds } },
            select: { id: true },
          })
        ).map((u) => u.id)
      : [];

    await prisma.matchHistory.create({
      data: {
        roomId,
        puzzleId: session.puzzleId,
        durationSeconds,
        wasWon,
        ...(validUserIds.length > 0 && {
          users: { connect: validUserIds.map((id) => ({ id })) },
        }),
      },
    });

    if (validUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: validUserIds } },
        data: {
          gamesPlayed: { increment: 1 },
          ...(wasWon && { gamesWon: { increment: 1 } }),
        },
      });
    }
    console.log(`[DB] Saved match for room "${roomId}"`);
  } catch (error) {
    console.error(`[DB ERROR] Could not save match for room "${roomId}":`, error);
  }
}
