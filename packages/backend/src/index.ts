/**
 * @synchro/backend — Main Server Entry Point
 *
 * Express + Socket.IO server handling rooms, lobby updates,
 * starting/restarting rounds and disconnect cleanup.
 */

import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

import { createGameSession, destroySession, getSession } from "./gameEngine";
import { registerTelemetryHandlers } from "./telemetryHandler";
import { registerAudioSignalingHandlers } from "./audioSignaling";
import { startGameTimer, stopGameTimer } from "./timer";

import {
  SOCKET_EVENTS,
  MAX_PLAYERS_PER_ROOM,
  type Room,
  type Player,
  type JoinRoomPayload,
  type JoinSuccessPayload,
  type JoinErrorPayload,
  type LobbyUpdatePayload,
  type PlayerJoinedPayload,
  type PlayerLeftPayload,
} from "@synchro/shared";

// ─── Configuration ──────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3001", 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
const GAME_DURATION_SECONDS = 60;
/** Short pause so every client can show its "starting" screen first */
const GAME_START_DELAY_MS = 1500;

// ─── Express + HTTP Server ──────────────────────────────────────────

const app = express();

app.use(cors({ origin: CLIENT_ORIGIN, methods: ["GET", "POST"], credentials: true }));
app.use(express.json());

/** In-memory room storage */
const rooms = new Map<string, Room>();

/** socket ID → { roomId, playerId }, for fast cleanup without scanning every room */
const socketToPlayer = new Map<string, { roomId: string; playerId: string }>();

app.get("/health", (_req, res) => {
  res.json({
    status: "online",
    uptime: process.uptime(),
    rooms: rooms.size,
    timestamp: Date.now(),
  });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"], credentials: true },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// ─── Helpers ────────────────────────────────────────────────────────

function sanitizeRoomId(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
}

function sanitizePlayerName(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[^\p{L}\p{N}_\-\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

/** Sends a friendly error to one client and (optionally) answers its callback */
function sendError(
  socket: Socket,
  message: string,
  callback?: (data: JoinErrorPayload) => void
) {
  const error: JoinErrorPayload = { message };
  socket.emit(SOCKET_EVENTS.JOIN_ERROR, error);
  callback?.(error);
}

/** Removes a player from their room. Cancels any round in progress. */
function leaveCurrentRoom(socket: Socket): { room: Room; player: Player } | null {
  const mapping = socketToPlayer.get(socket.id);
  if (!mapping) return null;
  socketToPlayer.delete(socket.id);

  const room = rooms.get(mapping.roomId);
  if (!room) return null;

  const index = room.players.findIndex((p) => p.id === mapping.playerId);
  if (index === -1) return null;

  const [player] = room.players.splice(index, 1);
  socket.leave(room.id);

  // Someone left, so any round in progress can't continue
  room.gameStarted = false;
  stopGameTimer(room.id);
  destroySession(room.id);

  if (room.players.length === 0) {
    rooms.delete(room.id); // avoid leaking empty rooms
    console.log(`[ROOM] Deleted empty room "${room.id}"`);
  } else {
    const left: PlayerLeftPayload = { playerId: player.id, playerName: player.name, room };
    io.to(room.id).emit(SOCKET_EVENTS.PLAYER_LEFT, left);
    const lobby: LobbyUpdatePayload = { room };
    io.to(room.id).emit(SOCKET_EVENTS.UPDATE_LOBBY, lobby);
  }

  console.log(
    `[LEAVE] "${player.name}" left room "${room.id}" [${room.players.length}/${MAX_PLAYERS_PER_ROOM}]`
  );
  return { room, player };
}

/** Starts a fresh round for a full room (used by both Start and Play Again) */
function launchGame(room: Room) {
  room.gameStarted = true;
  stopGameTimer(room.id);
  destroySession(room.id);

  io.to(room.id).emit(SOCKET_EVENTS.GAME_STARTING, { room });

  const payloads = createGameSession(room.id, room.players);
  const session = getSession(room.id);

  setTimeout(() => {
    // Cancelled in the meantime (someone left or a newer round replaced it)
    if (!session || getSession(room.id) !== session) return;

    for (const [socketId, payload] of payloads) {
      io.to(socketId).emit(SOCKET_EVENTS.GAME_STARTED, payload);
    }
    startGameTimer(room.id, io, GAME_DURATION_SECONDS);
  }, GAME_START_DELAY_MS);
}

function getRoomOf(socket: Socket): Room | undefined {
  const mapping = socketToPlayer.get(socket.id);
  return mapping ? rooms.get(mapping.roomId) : undefined;
}

// ─── Socket.IO Connection Handler ───────────────────────────────────

io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  registerTelemetryHandlers(io, socket);
  registerAudioSignalingHandlers(io, socket);

  // ── JOIN ROOM ───────────────────────────────────────────────────
  socket.on(
    SOCKET_EVENTS.JOIN_ROOM,
    (payload: JoinRoomPayload, callback?: (data: JoinSuccessPayload | JoinErrorPayload) => void) => {
      const roomId = sanitizeRoomId(payload?.roomId);
      const playerName = sanitizePlayerName(payload?.playerName);

      if (roomId.length < 2) {
        return sendError(socket, "Room code must be at least 2 characters (letters, numbers or dashes).", callback);
      }
      if (!playerName) {
        return sendError(socket, "Please enter a name.", callback);
      }

      // Joining a new room means leaving the old one
      if (socketToPlayer.has(socket.id)) leaveCurrentRoom(socket);

      const existing = rooms.get(roomId);

      if (existing) {
        if (existing.players.length >= MAX_PLAYERS_PER_ROOM) {
          return sendError(socket, `Room "${roomId}" is full (${MAX_PLAYERS_PER_ROOM} players max). Try another code.`, callback);
        }
        if (existing.gameStarted) {
          return sendError(socket, `A game is already running in room "${roomId}". Try another code.`, callback);
        }
        if (existing.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
          return sendError(socket, `Someone in room "${roomId}" is already called "${playerName}". Pick a different name.`, callback);
        }
      }

      const room: Room = existing ?? {
        id: roomId,
        players: [],
        createdAt: Date.now(),
        gameStarted: false,
      };
      if (!existing) {
        rooms.set(roomId, room);
        console.log(`[ROOM] Created room "${roomId}"`);
      }

      const dbUserId =
        typeof payload.dbUserId === "string" && payload.dbUserId.length <= 64
          ? payload.dbUserId
          : undefined;

      const player: Player = { id: uuidv4(), name: playerName, socketId: socket.id, dbUserId };
      room.players.push(player);
      socketToPlayer.set(socket.id, { roomId: room.id, playerId: player.id });
      socket.join(room.id);

      console.log(
        `[JOIN] "${playerName}" joined room "${roomId}" [${room.players.length}/${MAX_PLAYERS_PER_ROOM}]`
      );

      const success: JoinSuccessPayload = { playerId: player.id, room };
      socket.emit(SOCKET_EVENTS.JOIN_SUCCESS, success);
      callback?.(success);

      const joined: PlayerJoinedPayload = { player, room };
      socket.to(room.id).emit(SOCKET_EVENTS.PLAYER_JOINED, joined);

      const lobby: LobbyUpdatePayload = { room };
      io.to(room.id).emit(SOCKET_EVENTS.UPDATE_LOBBY, lobby);
    }
  );

  // ── START GAME ──────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.START_GAME, () => {
    const room = getRoomOf(socket);
    if (!room) return;

    if (room.players.length < MAX_PLAYERS_PER_ROOM) {
      return sendError(socket, `You need ${MAX_PLAYERS_PER_ROOM} players to start.`);
    }
    if (room.gameStarted) {
      return sendError(socket, "The game has already started.");
    }

    console.log(`[GAME] Room "${room.id}" — starting`);
    launchGame(room);
  });

  // ── PLAY AGAIN ──────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.ROOM_REQUEUE, () => {
    const room = getRoomOf(socket);
    if (!room || room.players.length < MAX_PLAYERS_PER_ROOM) return;

    // A round is still running, so ignore (also stops double-clicks from restarting twice)
    if (getSession(room.id)) return;

    console.log(`[GAME] Room "${room.id}" — playing again`);
    launchGame(room);
  });

  // ── DISCONNECT ──────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.DISCONNECT, (reason: string) => {
    console.log(`[DISCONNECT] ${socket.id} — ${reason}`);
    leaveCurrentRoom(socket);
  });
});

// ─── Start Server ───────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  const row = (text: string) => `│  ${text.padEnd(44)}│`;
  console.log("");
  console.log("┌" + "─".repeat(46) + "┐");
  console.log(row("SYNCHRO game server"));
  console.log("├" + "─".repeat(46) + "┤");
  console.log(row("Status:  online"));
  console.log(row(`Port:    ${PORT}`));
  console.log(row(`Client:  ${CLIENT_ORIGIN}`));
  console.log("└" + "─".repeat(46) + "┘");
  console.log("");
});

// Log unexpected errors instead of letting one bad event take the whole server down
process.on("unhandledRejection", (reason) => {
  console.error("[ERROR] Unhandled promise rejection:", reason);
});
