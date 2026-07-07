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

  // ─── Telemetry & Locking ──────────────────────────────────────────
  /** Client informs server they selected/hovered a line */
  TELEMETRY_LINE_SELECTED: "telemetry:line_selected",
  
  /** Server broadcasts ghost selection to other operators in room */
  TELEMETRY_GHOST_UPDATE: "telemetry:ghost_update",

  /** Client locks in their final line guess */
  GAME_LOCK_SELECTION: "game:lock_selection",

  /** Server signals all clients that the puzzle has been solved */
  GAME_PUZZLE_SOLVED: "game:puzzle_solved",

  // ─── WebRTC Audio Signaling ───────────────────────────────────────
  /** Peer sends an SDP offer */
  WEBRTC_OFFER: "webrtc:offer",
  
  /** Peer replies with an SDP answer */
  WEBRTC_ANSWER: "webrtc:answer",
  
  /** Peer sends an ICE candidate for NAT traversal */
  WEBRTC_ICE_CANDIDATE: "webrtc:ice_candidate",

  // ─── Server Timer ─────────────────────────────────────────────────
  /** Server emits countdown tick */
  TIMER_TICK: "timer:tick",
  
  /** Server emits timeout failure */
  GAME_TIMEOUT: "game:timeout",

  // ─── Post-Mortem & Lobby Controls ─────────────────────────────────
  /** Server broadcasts end-of-game summary with full views */
  GAME_POST_MORTEM_SUMMARY: "game:post_mortem_summary",
  
  /** Client requests to re-queue the current crew into a new match */
  ROOM_REQUEUE: "room:requeue",

  // ─── Built-in ─────────────────────────────────────────────────────
  CONNECTION: "connection",
  DISCONNECT: "disconnect",
} as const;

/** Union type of all event name strings */
export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
