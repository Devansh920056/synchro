/**
 * @synchro/shared — Core Type Definitions
 *
 * Canonical interfaces shared across frontend and backend.
 * Every player, room, and socket payload is typed here.
 */

// ─── Domain Models ──────────────────────────────────────────────────

/** Represents a single connected operator in the Synchro system */
export interface Player {
  /** Unique player identifier (UUID v4) */
  id: string;
  /** Display name chosen by the operator */
  name: string;
  /** The Socket.IO socket ID for this connection */
  socketId: string;
}

/** Represents an active game room / calibration deck */
export interface Room {
  /** The human-readable room code (e.g., "ALPHA-7") */
  id: string;
  /** Connected operators — max 3 */
  players: Player[];
  /** Timestamp of room creation */
  createdAt: number;
  /** Whether the game has been started */
  gameStarted: boolean;
}

// ─── Socket Payloads ────────────────────────────────────────────────

/** Payload sent by client when requesting to join a room */
export interface JoinRoomPayload {
  roomId: string;
  playerName: string;
}

/** Payload sent by server on successful join */
export interface JoinSuccessPayload {
  playerId: string;
  room: Room;
}

/** Payload sent by server when a join attempt fails */
export interface JoinErrorPayload {
  message: string;
}

/** Payload broadcast when the lobby state changes */
export interface LobbyUpdatePayload {
  room: Room;
}

/** Payload broadcast when a player leaves */
export interface PlayerLeftPayload {
  playerId: string;
  playerName: string;
  room: Room;
}

/** Payload broadcast when a new player joins */
export interface PlayerJoinedPayload {
  player: Player;
  room: Room;
}

// ─── Constants ──────────────────────────────────────────────────────

/** Maximum number of operators per room */
export const MAX_PLAYERS_PER_ROOM = 3;
