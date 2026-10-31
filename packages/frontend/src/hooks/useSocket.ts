"use client";

/**
 * useSocket — one shared Socket.IO connection for the whole app.
 *
 * The socket is created once and lives as long as the browser tab, so React
 * Strict Mode's double-mount can't leave us with a dead connection.
 * Connection status is read with useSyncExternalStore, which keeps the UI
 * in step with the socket without any setState-inside-effect.
 */

import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

let socket: Socket | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function ensureSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socket.on("connect", notify);
    socket.on("disconnect", notify);
    socket.on("connect_error", (err) => {
      console.error("[SOCKET] Connection error:", err.message);
      notify();
    });
  }
  return socket;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureSocket();
  listener(); // pick up the socket we may just have created
  return () => {
    listeners.delete(listener);
  };
}

const getSocketSnapshot = () => socket;
const getConnectedSnapshot = () => socket?.connected ?? false;
const getServerSnapshot = () => null;
const getServerConnectedSnapshot = () => false;

export function useSocket(): { socket: Socket | null; isConnected: boolean } {
  const current = useSyncExternalStore(subscribe, getSocketSnapshot, getServerSnapshot);
  const isConnected = useSyncExternalStore(
    subscribe,
    getConnectedSnapshot,
    getServerConnectedSnapshot
  );
  return { socket: current, isConnected };
}
