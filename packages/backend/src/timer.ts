/**
 * @synchro/backend — Server Authoritative Timer
 *
 * Manages game countdowns. Emits a tick every second.
 * Triggers a failure state if time runs out before the puzzle is solved.
 */

import { Server } from "socket.io";
import { SOCKET_EVENTS, TimerTickPayload } from "@synchro/shared";
import { handleGameEnd } from "./postMortem";

// Map room IDs to their active setInterval objects
const roomTimers = new Map<string, NodeJS.Timeout>();

export function startGameTimer(roomId: string, io: Server, durationSeconds: number = 60) {
  // Clear any existing timer just in case
  stopGameTimer(roomId);

  let timeRemaining = durationSeconds;

  const timerId = setInterval(() => {
    timeRemaining--;

    // Emit tick
    const payload: TimerTickPayload = { timeRemaining };
    io.to(roomId).emit(SOCKET_EVENTS.TIMER_TICK, payload);

    if (timeRemaining <= 0) {
      // Time is up
      stopGameTimer(roomId);
      io.to(roomId).emit(SOCKET_EVENTS.GAME_TIMEOUT);
      console.log(`[GAME] Room "${roomId}" — CALIBRATION TIMEOUT`);
      handleGameEnd(roomId, false, io);
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
