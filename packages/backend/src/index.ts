/**
 * @synchro/backend — Main Server Entry Point
 *
 * Express + Socket.IO server handling room creation, player joins,
 * lobby state broadcasting, and disconnect cleanup.
 */

import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

import { createGameSession, destroySession } from "./gameEngine";

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

// ─── Express + HTTP Server ──────────────────────────────────────────

const app = express();

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

/** Health check endpoint */
app.get("/health", (_req, res) => {
  res.json({
    status: "online",
    uptime: process.uptime(),
    rooms: rooms.size,
    timestamp: Date.now(),
  });
});

const httpServer = createServer(app);

// ─── Socket.IO Server ──────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// ─── In-Memory Room Storage ─────────────────────────────────────────

const rooms: Map<string, Room> = new Map();

/**
 * Maps a socket ID → { roomId, playerId } for fast disconnect cleanup.
 * Without this we'd need to scan every room on every disconnect.
 */
const socketToPlayer: Map<string, { roomId: string; playerId: string }> =
  new Map();

// ─── Helper Functions ───────────────────────────────────────────────

function getOrCreateRoom(roomId: string): Room {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const newRoom: Room = {
    id: roomId,
    players: [],
    createdAt: Date.now(),
    gameStarted: false,
  };

  rooms.set(roomId, newRoom);
  console.log(`[ROOM] Created room "${roomId}"`);
  return newRoom;
}

function removePlayerFromRoom(
  socketId: string
): { room: Room; player: Player } | null {
  const mapping = socketToPlayer.get(socketId);
  if (!mapping) return null;

  const room = rooms.get(mapping.roomId);
  if (!room) {
    socketToPlayer.delete(socketId);
    return null;
  }

  const playerIndex = room.players.findIndex(
    (p) => p.id === mapping.playerId
  );
  if (playerIndex === -1) {
    socketToPlayer.delete(socketId);
    return null;
  }

  const [removedPlayer] = room.players.splice(playerIndex, 1);
  socketToPlayer.delete(socketId);

  // Clean up empty rooms to prevent memory leaks
  if (room.players.length === 0) {
    rooms.delete(room.id);
    console.log(`[ROOM] Deleted empty room "${room.id}"`);
  }

  return { room, player: removedPlayer };
}

function sanitizeRoomId(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 20);
}

function sanitizePlayerName(input: string): string {
  return input.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "").slice(0, 24);
}

// ─── Socket.IO Connection Handler ───────────────────────────────────

io.on(SOCKET_EVENTS.CONNECTION, (socket: Socket) => {
  console.log(`[CONNECT] Socket ${socket.id} connected`);

  // ── JOIN ROOM ───────────────────────────────────────────────────
  socket.on(
    SOCKET_EVENTS.JOIN_ROOM,
    (payload: JoinRoomPayload, callback?: (data: JoinSuccessPayload | JoinErrorPayload) => void) => {
      const roomId = sanitizeRoomId(payload.roomId);
      const playerName = sanitizePlayerName(payload.playerName);

      // Validation
      if (!roomId || roomId.length < 2) {
        const error: JoinErrorPayload = {
          message: "INVALID ROOM CODE — must be at least 2 characters.",
        };
        socket.emit(SOCKET_EVENTS.JOIN_ERROR, error);
        callback?.(error);
        return;
      }

      if (!playerName || playerName.length < 1) {
        const error: JoinErrorPayload = {
          message: "INVALID OPERATOR NAME — cannot be empty.",
        };
        socket.emit(SOCKET_EVENTS.JOIN_ERROR, error);
        callback?.(error);
        return;
      }

      const room = getOrCreateRoom(roomId);

      // Check capacity
      if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
        const error: JoinErrorPayload = {
          message: `ROOM "${roomId}" IS FULL — maximum ${MAX_PLAYERS_PER_ROOM} operators.`,
        };
        socket.emit(SOCKET_EVENTS.JOIN_ERROR, error);
        callback?.(error);
        return;
      }

      // Check for duplicate names in the same room
      if (room.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
        const error: JoinErrorPayload = {
          message: `OPERATOR NAME "${playerName}" already registered in room "${roomId}".`,
        };
        socket.emit(SOCKET_EVENTS.JOIN_ERROR, error);
        callback?.(error);
        return;
      }

      // Check if this socket is already in a room (prevent double-join)
      if (socketToPlayer.has(socket.id)) {
        removePlayerFromRoom(socket.id);
      }

      // Create the player
      const player: Player = {
        id: uuidv4(),
        name: playerName,
        socketId: socket.id,
      };

      room.players.push(player);
      socketToPlayer.set(socket.id, { roomId: room.id, playerId: player.id });

      // Join the Socket.IO room for targeted broadcasts
      socket.join(roomId);

      console.log(
        `[JOIN] "${playerName}" (${player.id}) joined room "${roomId}" ` +
          `[${room.players.length}/${MAX_PLAYERS_PER_ROOM}]`
      );

      // Confirm to the joining client
      const successPayload: JoinSuccessPayload = {
        playerId: player.id,
        room,
      };
      socket.emit(SOCKET_EVENTS.JOIN_SUCCESS, successPayload);
      callback?.(successPayload);

      // Broadcast to other players in the room
      const joinedPayload: PlayerJoinedPayload = { player, room };
      socket.to(roomId).emit(SOCKET_EVENTS.PLAYER_JOINED, joinedPayload);

      // Broadcast updated lobby state to everyone in the room
      const lobbyPayload: LobbyUpdatePayload = { room };
      io.to(roomId).emit(SOCKET_EVENTS.UPDATE_LOBBY, lobbyPayload);
    }
  );

  // ── START GAME ──────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.START_GAME, () => {
    const mapping = socketToPlayer.get(socket.id);
    if (!mapping) return;

    const room = rooms.get(mapping.roomId);
    if (!room) return;

    if (room.players.length < MAX_PLAYERS_PER_ROOM) {
      socket.emit(SOCKET_EVENTS.JOIN_ERROR, {
        message: `Cannot start — need exactly ${MAX_PLAYERS_PER_ROOM} operators.`,
      } satisfies JoinErrorPayload);
      return;
    }

    if (room.gameStarted) {
      socket.emit(SOCKET_EVENTS.JOIN_ERROR, {
        message: "Calibration sequence already initiated.",
      } satisfies JoinErrorPayload);
      return;
    }

    room.gameStarted = true;
    console.log(`[GAME] Room "${room.id}" — calibration sequence initiated`);

    io.to(room.id).emit(SOCKET_EVENTS.GAME_STARTING, { room });

    // Generate puzzle data and individual operator views
    const payloads = createGameSession(room.id, room.players);

    // Give the frontend a brief moment to show the "Starting" UI,
    // then blast the personalized views to each operator
    setTimeout(() => {
      for (const [socketId, payload] of payloads) {
        io.to(socketId).emit(SOCKET_EVENTS.GAME_STARTED, payload);
      }
    }, 1500);
  });

  // ── DISCONNECT ──────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.DISCONNECT, (reason: string) => {
    console.log(`[DISCONNECT] Socket ${socket.id} — reason: ${reason}`);

    const result = removePlayerFromRoom(socket.id);
    if (!result) return;

    const { room, player } = result;

    // Reset game state if someone drops and destroy the active session
    room.gameStarted = false;
    destroySession(room.id);

    // Notify remaining players
    const leftPayload: PlayerLeftPayload = {
      playerId: player.id,
      playerName: player.name,
      room,
    };
    io.to(room.id).emit(SOCKET_EVENTS.PLAYER_LEFT, leftPayload);

    // Broadcast updated lobby state
    const lobbyPayload: LobbyUpdatePayload = { room };
    io.to(room.id).emit(SOCKET_EVENTS.UPDATE_LOBBY, lobbyPayload);

    console.log(
      `[LEAVE] "${player.name}" left room "${room.id}" ` +
        `[${room.players.length}/${MAX_PLAYERS_PER_ROOM}]`
    );
  });
});

// ─── Start Server ───────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║       SYNCHRO — Calibration Server           ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Status:  ONLINE                              ║`);
  console.log(`║  Port:    ${String(PORT).padEnd(36)}║`);
  console.log(`║  Client:  ${CLIENT_ORIGIN.padEnd(36)}║`);
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");
});
