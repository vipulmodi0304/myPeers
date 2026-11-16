import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "./api";

/** Block or unblock someone, then refresh everything a block changes. */
export function useSetBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, block }: { id: string; name: string; block: boolean }) =>
      block ? api.put(`/api/users/${id}/block`) : api.delete(`/api/users/${id}/block`),
    onSuccess: (_data, { id, name, block }) => {
      for (const queryKey of [["thread", id], ["conversations"], ["unread"], ["peers"], ["blocks"]]) void qc.invalidateQueries({ queryKey });
      toast(block ? `Blocked ${name}. You won't see or hear from each other.` : `Unblocked ${name}.`);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
