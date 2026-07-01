/**
 * @synchro/shared — Socket.IO Event Constants
 *
 * Strongly-typed string constants for every Socket.IO event in the Synchro protocol.
 * Both client and server import from here to guarantee type-safe, typo-free event names.
 */

export const SOCKET_EVENTS = {
  // ─── Client → Server ──────────────────────────────────────────────
  /** Client requests to join (or create) a room */
  JOIN_ROOM: "room:join",

  /** Host client requests to start the calibration sequence */
  START_GAME: "game:start",

  // ─── Server → Client ──────────────────────────────────────────────
  /** Broadcast: a new operator connected to the room */
  PLAYER_JOINED: "room:player_joined",

  /** Broadcast: full lobby state update (player list, room metadata) */
  UPDATE_LOBBY: "room:update_lobby",

  /** Broadcast: an operator disconnected from the room */
  PLAYER_LEFT: "room:player_left",

  /** Server confirms the client successfully joined */
  JOIN_SUCCESS: "room:join_success",

  /** Server rejects the join attempt (room full, invalid code, etc.) */
  JOIN_ERROR: "room:join_error",

  /** Server signals all clients that the game is starting */
  GAME_STARTING: "game:starting",

  /** Server sends each client their personalized puzzle view */
  GAME_STARTED: "game:started",

  // ─── Built-in ─────────────────────────────────────────────────────
  CONNECTION: "connection",
  DISCONNECT: "disconnect",
} as const;

/** Union type of all event name strings */
export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
