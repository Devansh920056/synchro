/**
 * @synchro/backend — Telemetry & Selection Handler
 *
 * Relays live "ghost" selections to teammates and handles locking in,
 * then checks whether all three operators found the mismatch.
 *
 * The server never trusts the role or room a client claims: both are
 * looked up from the session, so a player can't act as someone else.
 */

import { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  OPERATOR_ROLES,
  PUZZLE_DATABASE,
  type SelectionPayload,
  type LockPayload,
  type LockResetPayload,
} from "@synchro/shared";
import { getSession, getAssignment } from "./gameEngine";
import { stopGameTimer } from "./timer";
import { handleGameEnd } from "./postMortem";

export function registerTelemetryHandlers(io: Server, socket: Socket) {
  // ─── GHOST HIGHLIGHTS ─────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.TELEMETRY_LINE_SELECTED, (payload: SelectionPayload) => {
    const roomId = payload?.roomId;
    if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;

    const me = getAssignment(roomId, socket.id);
    if (!me) return;

    const index = payload.selectedLineIndex;
    if (index !== null && !Number.isInteger(index)) return;

    // Send to everyone else in the room (the sender already knows)
    const ghost: SelectionPayload = {
      roomId,
      userId: me.playerId,
      operatorRole: me.role,
      selectedLineIndex: index,
    };
    socket.to(roomId).emit(SOCKET_EVENTS.TELEMETRY_GHOST_UPDATE, ghost);
  });

  // ─── LOCKING & VERIFICATION ───────────────────────────────────────
  socket.on(SOCKET_EVENTS.GAME_LOCK_SELECTION, (payload: LockPayload) => {
    const roomId = payload?.roomId;
    if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;

    const session = getSession(roomId);
    const me = getAssignment(roomId, socket.id);
    if (!session || !me) return;

    // Each operator can only lock once per attempt
    if (session.lockedLines[me.role] !== undefined) return;
    if (!Number.isInteger(payload.lockedLineIndex)) return;

    session.lockedLines[me.role] = payload.lockedLineIndex;
    console.log(`[GAME] ${me.role} locked line ${payload.lockedLineIndex} in room "${roomId}"`);

    const allLocked = OPERATOR_ROLES.every((role) => session.lockedLines[role] !== undefined);
    if (!allLocked) return;

    const puzzle = PUZZLE_DATABASE.find((p) => p.id === session.puzzleId);
    if (!puzzle) return;

    const isCorrect = OPERATOR_ROLES.every((role) => {
      const line = puzzle.views[role].find((l) => l.lineNumber === session.lockedLines[role]);
      return line?.isMismatchLine === true;
    });

    if (isCorrect) {
      console.log(`[GAME] Room "${roomId}" — solved`);
      stopGameTimer(roomId);
      io.to(roomId).emit(SOCKET_EVENTS.GAME_PUZZLE_SOLVED, {
        message: "You found the bug together. System restored!",
      });
      void handleGameEnd(roomId, true, io);
    } else {
      console.log(`[GAME] Room "${roomId}" — wrong lines, resetting locks`);
      session.lockedLines = {};
      const reset: LockResetPayload = {
        message: "Not quite. At least one of you picked the wrong line. Talk it over and try again.",
      };
      io.to(roomId).emit(SOCKET_EVENTS.GAME_LOCK_RESET, reset);
    }
  });
}
