/**
 * @synchro/shared — Telemetry Types
 *
 * Types for real-time interactions, such as hovering over lines,
 * highlighting selections, and locking in guesses.
 */

import { OperatorRole } from "./gameTypes";

/** Payload emitted when a player hovers/clicks a line (ghost highlight) */
export interface SelectionPayload {
  roomId: string;
  userId: string;
  operatorRole: OperatorRole;
  /** The line number index they selected, or null if they deselected */
  selectedLineIndex: number | null;
}

/** Payload emitted when a player locks in their final guess */
export interface LockPayload {
  roomId: string;
  userId: string;
  operatorRole: OperatorRole;
  /** The final line number index they locked in */
  lockedLineIndex: number;
}
