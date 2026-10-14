import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "./api";
import { useMe } from "./auth";
import { useSocketEvent } from "./socket";
import type { Peer } from "./types";

export const peersKey = ["peers"] as const;
export const checkInKey = ["check-in"] as const;

/**
 * The live list of classmates. Loaded once over REST, then kept current by
 * socket events (no polling): peer:upsert when someone checks in or edits,
 * peer:remove when they check out or go offline.
 */
export function useLivePeers() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [arrived, setArrived] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: peersKey,
    queryFn: async () => (await api.get<{ peers: Peer[] }>("/api/peers")).peers,
  });

  useSocketEvent<Peer>("peer:upsert", (peer) => {
    if (peer.userId === me?.id) return;
    let isNew = false;
    qc.setQueryData<Peer[]>(peersKey, (old = []) => {
      isNew = !old.some((p) => p.userId === peer.userId);
      return isNew ? [peer, ...old] : old.map((p) => (p.userId === peer.userId ? peer : p));
    });
    if (isNew) {
      setArrived((s) => new Set(s).add(peer.userId));
      setTimeout(() => setArrived((s) => {
        const n = new Set(s);
        n.delete(peer.userId);
        return n;
      }), 2000);
    }
  });

  useSocketEvent<{ userId: string }>("peer:remove", ({ userId }) => {
    qc.setQueryData<Peer[]>(peersKey, (old = []) => old.filter((p) => p.userId !== userId));
  });

  return { ...query, arrived };
}

export function useMyCheckIn() {
  return useQuery({
    queryKey: checkInKey,
    queryFn: async () => (await api.get<{ checkIn: Peer | null }>("/api/check-in")).checkIn,
  });
}

export type Shelf = { courseCode: string; peers: Peer[]; mine: boolean };

/** Group peers by course; your course first, then the busiest courses. */
export function shelves(peers: Peer[], myCourse: string | null): Shelf[] {
  const map = new Map<string, Peer[]>();
  for (const p of peers) map.set(p.courseCode, [...(map.get(p.courseCode) ?? []), p]);
  return [...map.entries()]
    .map(([courseCode, list]) => ({
      courseCode,
      mine: courseCode === myCourse,
      // Studying before on-break, then longest session first.
      peers: list.sort((a, b) => (a.status === b.status ? a.startedAt.localeCompare(b.startedAt) : a.status === "studying" ? -1 : 1)),
    }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || b.peers.length - a.peers.length || a.courseCode.localeCompare(b.courseCode));
}
