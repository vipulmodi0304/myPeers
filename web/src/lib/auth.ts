import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Me } from "./types";

export const meKey = ["me"] as const;

/** The signed-in user (or null). Loaded once and updated by the auth pages. */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => (await api.get<{ user: Me | null }>("/api/auth/me")).user,
    staleTime: Infinity,
  });
}

export function useSetMe() {
  const qc = useQueryClient();
  return (user: Me | null) => {
    if (user === null) qc.clear(); // drop every cached query from the previous account
    qc.setQueryData(meKey, user);
  };
}

export const canUseApp = (me: Me | null | undefined) => Boolean(me && (me.emailVerified || me.isDemo));
