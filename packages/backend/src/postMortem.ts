/**
 * @synchro/backend — Post-Mortem Analytics
 *
 * Handles end-of-game persistence and broadcasting summary screens.
 */

import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { SOCKET_EVENTS, PostMortemSummaryPayload, OperatorRole, CodeLine, PUZZLE_DATABASE } from "@synchro/shared";
import { getSession } from "./gameEngine";

// Using a shared Prisma client instance
const prisma = new PrismaClient();

export async function handleGameEnd(roomId: string, wasWon: boolean, io: Server) {
  const session = getSession(roomId);
  if (!session) return;

  const durationSeconds = Math.floor((Date.now() - session.startedAt) / 1000);

  // We map the operators to get their views. Since we don't store views in GameSession,
  // we must reconstruct them from PUZZLE_DATABASE in a real scenario.
  const puzzle = PUZZLE_DATABASE.find(p => p.id === session.puzzleId);
  
  if (!puzzle) return;

  const views: Record<OperatorRole, CodeLine[]> = {
    operator_1: puzzle.views.operator_1,
    operator_2: puzzle.views.operator_2,
    operator_3: puzzle.views.operator_3,
  };

  const payload: PostMortemSummaryPayload = {
    roomId,
    wasWon,
    explanation: `Mismatch detected in ${puzzle.title}. The team ${wasWon ? 'successfully aligned' : 'failed to align'} the corrupted data signatures.`,
    views,
  };

  // Broadcast summary to everyone in the room
  io.to(roomId).emit(SOCKET_EVENTS.GAME_POST_MORTEM_SUMMARY, payload);
  console.log(`[POST-MORTEM] Broadcasted summary for room "${roomId}". wasWon: ${wasWon}`);

  // Background Database Persistence
  try {
    // If the frontend didn't pass real user IDs, we might not be able to link properly,
    // but we will attempt to link if IDs look like valid CUIDs, or we just create the match.
    // For now, we will create the match and ignore users if they are guests.
    // The prompt assumed we'd link them. Let's assume session.assignments[x].playerId is the DB id.
    const potentialUserIds = session.assignments
      .map(a => a.dbUserId)
      .filter((id): id is string => !!id);

    // Verify they actually exist in the DB to prevent P2025 foreign key errors
    // (e.g. if a user was deleted, or if someone passed a fake CUID)
    let validUserIds: string[] = [];
    if (potentialUserIds.length > 0) {
      const existingUsers: Array<{ id: string }> = await prisma.user.findMany({
        where: { id: { in: potentialUserIds } },
        select: { id: true }
      });
      validUserIds = existingUsers.map(u => u.id);
    }

    if (validUserIds.length > 0) {
      await prisma.matchHistory.create({
        data: {
          roomId,
          puzzleId: session.puzzleId,
          durationSeconds,
          wasWon,
          users: {
            connect: validUserIds.map(id => ({ id }))
          }
        }
      });

      // Increment stats for connected users
      await prisma.user.updateMany({
        where: { id: { in: validUserIds } },
        data: {
          gamesPlayed: { increment: 1 },
          gamesWon: wasWon ? { increment: 1 } : undefined
        }
      });
      console.log(`[DB] Saved match "${roomId}" to MatchHistory.`);
    } else {
      // If we don't have valid users, we can still create an anonymous MatchHistory!
      // This ensures we can still calculate total games played across the server.
      await prisma.matchHistory.create({
        data: {
          roomId,
          puzzleId: session.puzzleId,
          durationSeconds,
          wasWon,
        }
      });
      console.log(`[DB] Saved anonymous match "${roomId}" to MatchHistory.`);
    }
  } catch (error) {
    console.error(`[DB ERROR] Failed to save MatchHistory for room "${roomId}":`, error);
  }
}
