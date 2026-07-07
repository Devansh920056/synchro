/**
 * @synchro/shared — Post-Mortem Types
 *
 * Types for the end-of-game summary screen.
 */

import { CodeLine, OperatorRole } from "./gameTypes";

/**
 * Payload sent to clients when a game ends (either solved or timed out).
 */
export interface PostMortemSummaryPayload {
  roomId: string;
  /** Whether the team successfully aligned the data types in time */
  wasWon: boolean;
  /** Technical explanation of the core bug / mismatch */
  explanation: string;
  /** Full code views of all operators so players can review the codebase */
  views: Record<OperatorRole, CodeLine[]>;
}
