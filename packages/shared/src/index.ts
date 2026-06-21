/**
 * @synchro/shared — Barrel Export
 */
export { SOCKET_EVENTS } from "./socketEvents";
export type { SocketEvent } from "./socketEvents";

export {
  MAX_PLAYERS_PER_ROOM,
} from "./types";

export type {
  Player,
  Room,
  JoinRoomPayload,
  JoinSuccessPayload,
  JoinErrorPayload,
  LobbyUpdatePayload,
  PlayerLeftPayload,
  PlayerJoinedPayload,
} from "./types";
