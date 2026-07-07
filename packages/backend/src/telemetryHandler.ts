/**
 * @synchro/backend — Telemetry & Selection Handler
 *
 * Highly optimized sub-50ms handlers for live ghost selections.
 * Also handles the stateful locking logic and verifying puzzle completion.
 */

import { Server, Socket } from "socket.io";
import { SOCKET_EVENTS, SelectionPayload, LockPayload, OPERATOR_ROLES, PUZZLE_DATABASE } from "@synchro/shared";
import { getSession } from "./gameEngine";
import { stopGameTimer } from "./timer";
import { handleGameEnd } from "./postMortem";

export function registerTelemetryHandlers(io: Server, socket: Socket) {
  // ─── GHOST HIGHLIGHTS (TELEMETRY) ─────────────────────────────────
  socket.on(SOCKET_EVENTS.TELEMETRY_LINE_SELECTED, (payload: SelectionPayload) => {
    // We explicitly use socket.to(roomId).emit to broadcast to EVERYONE ELSE
    // in the room. The sender already knows what they selected.
    // This is the fastest path for real-time visual feedback.
    socket.to(payload.roomId).emit(SOCKET_EVENTS.TELEMETRY_GHOST_UPDATE, payload);
  });

  // ─── SELECTION LOCKING & VERIFICATION ─────────────────────────────
  socket.on(SOCKET_EVENTS.GAME_LOCK_SELECTION, (payload: LockPayload) => {
    const session = getSession(payload.roomId);
    if (!session) return;

    // 1. Record the lock
    session.lockedLines[payload.operatorRole] = payload.lockedLineIndex;
    console.log(`[GAME] Operator "${payload.operatorRole}" locked line ${payload.lockedLineIndex} in room "${payload.roomId}"`);

    // 2. Check if all 3 operators have locked in their guesses
    const allLocked = OPERATOR_ROLES.every((role) => session.lockedLines[role] !== undefined);
    
    if (allLocked) {
      console.log(`[GAME] Room "${payload.roomId}" — All operators locked. Verifying alignment...`);
      
      // 3. Retrieve the master puzzle to check correctness
      const masterPuzzle = PUZZLE_DATABASE.find(p => p.id === session.puzzleId);
      if (!masterPuzzle) return;

      // 4. Verify each operator's locked line matches the intended mismatch
      const isCorrect = OPERATOR_ROLES.every((role) => {
        const lockedIndex = session.lockedLines[role];
        const linesForRole = masterPuzzle.views[role];
        const selectedLine = linesForRole.find(l => l.lineNumber === lockedIndex);
        
        return selectedLine && selectedLine.isMismatchLine === true;
      });

      if (isCorrect) {
        console.log(`[GAME] Room "${payload.roomId}" — CALIBRATION SUCCESSFUL!`);
        stopGameTimer(payload.roomId);
        io.to(payload.roomId).emit(SOCKET_EVENTS.GAME_PUZZLE_SOLVED, {
          message: "Data Alignment Complete. System Restored.",
        });
        // Run post mortem for win
        handleGameEnd(payload.roomId, true, io);
      } else {
        console.log(`[GAME] Room "${payload.roomId}" — CALIBRATION FAILED! Incorrect mismatch selected.`);
        // For now, if they fail, we can just log it or unlock them.
        // As a simple reset, we can clear the locks and let them try again.
        session.lockedLines = {};
      }
    }
  });
}
