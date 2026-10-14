import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useSocket, useSocketEvent } from "./socket";
import type { RoomMember, RoomSummary, Stroke, TimerState } from "./types";

export type RoomDetail = { room: RoomSummary; isMember: boolean; members: RoomMember[]; timer: TimerState | null };

type EnterAck = { roomId: string; strokes: Stroke[]; timer: TimerState; here: string[]; serverNow: number } | { error: string };

/**
 * Everything live about one study room. REST loads the room; then the socket
 * "enters" it and streams whiteboard strokes, timer changes, who is here, and
 * reactions. Re-enters automatically after a reconnect.
 */
export function useRoom(code: string) {
  const qc = useQueryClient();
  const { socket, connected } = useSocket();
  const key = ["room", code];

  const detail = useQuery({ queryKey: key, queryFn: () => api.get<RoomDetail>(`/api/rooms/${code}`), retry: false });
  const roomId = detail.data?.room.id;
  const isMember = detail.data?.isMember ?? false;

  const [entered, setEntered] = useState(false);
  const [here, setHere] = useState<string[]>([]);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [lastTimerBy, setLastTimerBy] = useState<{ name: string; action: string } | null>(null);
  // Difference between the server's clock and this device's, so every screen shows the same countdown.
  const clockOffset = useRef(0);
  const [initialStrokes, setInitialStrokes] = useState<Stroke[] | null>(null);

  useEffect(() => {
    if (!socket || !connected || !isMember) return;
    let cancelled = false;
    socket.emit("room:enter", { code }, (ack: EnterAck) => {
      if (cancelled || "error" in ack) return;
      clockOffset.current = ack.serverNow - Date.now();
      setInitialStrokes(ack.strokes);
      setTimer(ack.timer);
      setHere(ack.here);
      setEntered(true);
    });
    return () => {
      cancelled = true;
      if (roomId) socket.emit("room:exit", { roomId });
      setEntered(false);
    };
  }, [socket, connected, isMember, code, roomId]);

  useSocketEvent<{ roomId: string; userIds: string[] }>("room:here", (e) => e.roomId === roomId && setHere(e.userIds));
  useSocketEvent<{ roomId: string; members: RoomMember[] }>("room:members", (e) => {
    if (e.roomId !== roomId) return;
    qc.setQueryData<RoomDetail>(key, (old) => old && { ...old, members: e.members, room: { ...old.room, memberCount: e.members.length } });
  });
  useSocketEvent<{ roomId: string; timer: TimerState; serverNow: number; by: { name: string }; action: string }>("timer:state", (e) => {
    if (e.roomId !== roomId) return;
    clockOffset.current = e.serverNow - Date.now();
    setTimer(e.timer);
    setLastTimerBy({ name: e.by.name, action: e.action });
  });

  const emit = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      if (socket && roomId) socket.emit(event, { roomId, ...payload });
    },
    [socket, roomId],
  );

  return { detail, roomId, isMember, entered, here, timer, lastTimerBy, clockOffset, initialStrokes, emit };
}
