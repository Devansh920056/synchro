/**
 * @synchro/backend — Server Authoritative Timer
 *
 * Manages game countdowns. Emits a tick every second and triggers the
 * failure state if time runs out before the puzzle is solved.
 * The remaining time is computed from a fixed deadline, so it never drifts.
 */

import { Server } from "socket.io";
import { SOCKET_EVENTS, TimerTickPayload } from "@synchro/shared";
import { getSession } from "./gameEngine";
import { handleGameEnd } from "./postMortem";

/** Maps room IDs to their active interval */
const roomTimers = new Map<string, NodeJS.Timeout>();

export function startGameTimer(roomId: string, io: Server, durationSeconds = 60) {
  stopGameTimer(roomId);

  const deadline = Date.now() + durationSeconds * 1000;

  const emitTick = (timeRemaining: number) => {
    const payload: TimerTickPayload = { timeRemaining };
    io.to(roomId).emit(SOCKET_EVENTS.TIMER_TICK, payload);
  };

  // Show the full time straight away instead of waiting a second
  emitTick(durationSeconds);

  const timerId = setInterval(() => {
    // The round was cancelled (player left) or already finished
    if (!getSession(roomId)) {
      stopGameTimer(roomId);
      return;
    }

    const timeRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    emitTick(timeRemaining);

    if (timeRemaining <= 0) {
      stopGameTimer(roomId);
      io.to(roomId).emit(SOCKET_EVENTS.GAME_TIMEOUT);
      console.log(`[GAME] Room "${roomId}" — time ran out`);
      void handleGameEnd(roomId, false, io);
    }
  }, 1000);

  roomTimers.set(roomId, timerId);
  console.log(`[TIMER] Started ${durationSeconds}s timer for room "${roomId}"`);
}

export function stopGameTimer(roomId: string) {
  const timerId = roomTimers.get(roomId);
  if (timerId) {
    clearInterval(timerId);
    roomTimers.delete(roomId);
    console.log(`[TIMER] Stopped timer for room "${roomId}"`);
  }
}
