"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@/lib/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";

interface UseWebSocketOptions {
  onMessage?: (msg: ServerMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const connectingRef = useRef(false);

  const connect = useCallback(function doConnect() {
    if (connectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("[WS] No token found, connect skipped");
      return;
    }

    connectingRef.current = true;
    console.log("[WS] Connecting to:", WS_URL);

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connection established");
      setIsConnected(true);
      connectingRef.current = false;
      optionsRef.current.onConnect?.();

      // Start ping interval
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);

      const cleanup = () => {
        clearInterval(pingInterval);
        ws.removeEventListener("close", cleanup);
      };
      ws.addEventListener("close", cleanup);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        optionsRef.current.onMessage?.(msg);
      } catch (e) {
        console.log("[WS] Failed to parse message:", e);
      }
    };

    ws.onclose = (event) => {
      console.log("[WS] Connection closed:", event.code, event.reason);
      setIsConnected(false);
      connectingRef.current = false;
      optionsRef.current.onDisconnect?.();
      wsRef.current = null;

      // Reconnect after delay
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = undefined;
          doConnect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.log("[WS] Error:", error);
      connectingRef.current = false;
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    connectingRef.current = false;
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn(
        "[WS] Send skipped: readyState is",
        wsRef.current?.readyState,
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { isConnected, connect, disconnect, send };
}
