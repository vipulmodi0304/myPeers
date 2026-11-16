import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { meKey } from "./auth";

type SocketState = { socket: Socket | null; connected: boolean };
const SocketContext = createContext<SocketState>({ socket: null, connected: false });

/**
 * One Socket.IO connection for the whole app, opened only while signed in.
 * The session cookie authenticates it, same as the REST API.
 *
 * Events that arrive while disconnected are lost, so after every reconnect we
 * refetch the queries that realtime keeps up to date.
 */
export function SocketProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<SocketState>({ socket: null, connected: false });

  useEffect(() => {
    if (!enabled) return;
    const socket = io({ path: "/socket.io", withCredentials: true, transports: ["websocket", "polling"] });
    let firstConnect = true;
    socket.on("connect", () => {
      setState({ socket, connected: true });
      if (!firstConnect) void qc.invalidateQueries();
      firstConnect = false;
    });
    socket.on("disconnect", (reason) => {
      setState({ socket, connected: false });
      // The server closes sockets when a password changes. Socket.IO doesn't retry
      // after that on its own, so reconnect: a still-valid session gets back in.
      if (reason === "io server disconnect") socket.connect();
    });
    // The session behind this socket is gone (signed out elsewhere, expired): re-check who we are,
    // which sends the user to the sign-in page.
    socket.on("connect_error", (err) => {
      if (err.message === "unauthorized" || err.message === "unverified") void qc.invalidateQueries({ queryKey: meKey });
    });
    setState({ socket, connected: false });
    return () => {
      socket.disconnect();
      setState({ socket: null, connected: false });
    };
  }, [enabled, qc]);

  return <SocketContext.Provider value={state}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/** Subscribe to a socket event for as long as the component is mounted. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!socket) return;
    const fn = (payload: T) => ref.current(payload);
    socket.on(event, fn);
    return () => {
      socket.off(event, fn);
    };
  }, [socket, event]);
}
