"use client";

/**
 * useSocket — Singleton Socket.IO connection hook
 *
 * Initializes a single Socket.IO-client instance per app lifecycle.
 * Prevents duplicate connection handshakes on component re-renders
 * using a module-level ref pattern.
 */

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

/** Module-level singleton — survives component re-mounts in Strict Mode */
let globalSocket: Socket | null = null;
let connectionCount = 0;

export function useSocket(): {
  socket: Socket | null;
  isConnected: boolean;
} {
  const [isConnected, setIsConnected] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Reuse existing connection if available
    if (!globalSocket) {
      globalSocket = io(SOCKET_SERVER_URL, {
        transports: ["websocket", "polling"],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
    }

    const socket = globalSocket;
    connectionCount++;

    const onConnect = () => {
      console.log("[SOCKET] Connected:", socket.id);
      setIsConnected(true);
    };

    const onDisconnect = (reason: string) => {
      console.log("[SOCKET] Disconnected:", reason);
      setIsConnected(false);
    };

    const onConnectError = (err: Error) => {
      console.error("[SOCKET] Connection error:", err.message);
      setIsConnected(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    // If already connected (hot reload), sync state
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);

      connectionCount--;

      // Only disconnect if no components are using the socket
      if (connectionCount <= 0) {
        socket.disconnect();
        globalSocket = null;
        connectionCount = 0;
      }
    };
  }, []);

  return { socket: globalSocket, isConnected };
}
