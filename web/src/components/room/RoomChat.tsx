import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SendHorizontal } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, Button, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { clock, cn } from "@/lib/format";
import { useSocketEvent } from "@/lib/socket";
import type { RoomMessage } from "@/lib/types";

type Data = { messages: RoomMessage[]; hasMore: boolean };

export function RoomChat({ code, roomId, meId }: { code: string; roomId: string; meId: string }) {
  const qc = useQueryClient();
  const key = ["room-messages", code];
  const list = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");

  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api.get<Data>(`/api/rooms/${code}/messages`) });
  const messages = data?.messages ?? [];

  const append = (m: RoomMessage) =>
    qc.setQueryData<Data>(key, (old) => (old && !old.messages.some((x) => x.id === m.id) ? { ...old, messages: [...old.messages, m] } : old));

  useSocketEvent<{ roomId: string; message: RoomMessage }>("room:message", (e) => e.roomId === roomId && append(e.message));

  const send = useMutation({
    mutationFn: () => api.post<{ message: RoomMessage }>(`/api/rooms/${code}/messages`, { body }),
    onSuccess: ({ message }) => {
      append(message);
      setBody("");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);

  return (
    <section aria-label="Room chat" className="flex min-h-0 flex-1 flex-col">
      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-2" aria-live="polite">
        {isLoading ? (
          <div className="grid h-20 place-items-center text-ink-2">
            <Spinner className="size-4" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-2">No messages yet. Say hi to the room.</p>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped = prev?.senderId === m.senderId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
            return (
              <div key={m.id} className={cn("flex gap-2.5", grouped && "-mt-2")}>
                <div className="w-7 shrink-0">{grouped ? null : <Avatar name={m.senderName} size={28} />}</div>
                <div className="min-w-0">
                  {grouped ? null : (
                    <p className="text-[13px]">
                      <span className="font-semibold">{m.senderId === meId ? "You" : m.senderName}</span>{" "}
                      <span className="text-ink-2">{clock(m.createdAt)}</span>
                    </p>
                  )}
                  <p className="text-[14px] leading-snug break-words whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form
        className="flex gap-2 border-t border-line pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate();
        }}
      >
        <label htmlFor="room-chat" className="sr-only">
          Message the room
        </label>
        <input
          id="room-chat"
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message the room"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-[14px] placeholder:text-ink-3 focus:border-focus focus:ring-3 focus:ring-focus/20 focus:outline-none"
        />
        <Button type="submit" size="icon" className="h-10 w-10" aria-label="Send" disabled={!body.trim()} loading={send.isPending}>
          {send.isPending ? null : <SendHorizontal className="size-4" />}
        </Button>
      </form>
    </section>
  );
}
