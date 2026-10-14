import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { ArrowLeft, FileText, MessageCircle, Paperclip, SendHorizontal, X } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Avatar, Button, Empty, Spinner } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { clock, cn, fileSize, shortTime } from "@/lib/format";
import { useSocket, useSocketEvent } from "@/lib/socket";
import type { Attachment, Conversation, Message, Thread } from "@/lib/types";

export default function MessagesPage() {
  const { userId } = useParams();
  return (
    <div className="mx-auto h-full max-w-6xl md:px-4 md:py-6">
      <div className="grid h-full overflow-hidden border-line bg-surface md:grid-cols-[300px_minmax(0,1fr)] md:rounded-2xl md:border md:shadow-panel">
        <div className={cn("min-h-0 border-line md:border-r", userId ? "hidden md:block" : "block")}>
          <ConversationList activeId={userId} />
        </div>
        <div className={cn("min-h-0", userId ? "flex" : "hidden md:flex")}>
          {userId ? (
            <ThreadView key={userId} otherId={userId} />
          ) : (
            <div className="m-auto">
              <Empty icon={<MessageCircle className="size-8" />} title="Pick a conversation">
                Or find someone studying your course on the{" "}
                <Link to="/app" className="font-semibold text-ink underline underline-offset-2">
                  Study now
                </Link>{" "}
                page and say hi.
              </Empty>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Inbox ---------------- */

function ConversationList({ activeId }: { activeId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await api.get<{ conversations: Conversation[] }>("/api/conversations")).conversations,
  });

  return (
    <div className="flex h-full flex-col">
      <h1 className="border-b border-line px-4 py-4 text-lg font-extrabold tracking-tight">Messages</h1>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid h-32 place-items-center text-slate">
            <Spinner className="size-5" />
          </div>
        ) : !data?.length ? (
          <p className="px-4 py-8 text-sm text-slate">
            No messages yet. Tap Message next to anyone on the Study now page to start a conversation.
          </p>
        ) : (
          <ul>
            {data.map((c) => (
              <li key={c.user.id}>
                <Link
                  to={`/app/messages/${c.user.id}`}
                  aria-current={activeId === c.user.id ? "page" : undefined}
                  className={cn("flex items-center gap-3 px-4 py-3 hover:bg-surface-2", activeId === c.user.id && "bg-surface-2")}
                >
                  <Avatar name={c.user.name} size={40} live={c.user.live} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate", c.unread ? "font-bold" : "font-semibold")}>{c.user.name}</span>
                      <span className="shrink-0 text-[12px] text-slate">{shortTime(c.lastMessage.createdAt)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-[13px]", c.unread ? "text-ink" : "text-slate")}>
                        {c.lastMessage.fromMe ? "You: " : ""}
                        {c.lastMessage.preview}
                      </span>
                      {c.unread ? (
                        <span className="min-w-5 shrink-0 rounded-full bg-red px-1.5 text-center text-[11px] leading-5 text-white tabular">{c.unread}</span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- One conversation ---------------- */

type Page = Thread;

function ThreadView({ otherId }: { otherId: string }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const key = ["thread", otherId];
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [typing, setTyping] = useState(false);

  // Pages of 50, newest page first; "Load earlier" fetches older pages.
  const thread = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.get<Page>(`/api/conversations/${otherId}/messages${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (last) => (last.hasMore ? last.messages[0]?.createdAt ?? null : null),
  });

  const pages = thread.data?.pages ?? [];
  const other = pages[0]?.user;
  const messages = [...pages].reverse().flatMap((p) => p.messages);

  const markRead = () =>
    api.post(`/api/conversations/${otherId}/read`).then(() => {
      void qc.invalidateQueries({ queryKey: ["unread"] });
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    });

  useEffect(() => {
    if (thread.isSuccess) void markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.isSuccess, otherId]);

  /** Add a message to the newest page, ignoring duplicates (HTTP reply and socket event can both arrive). */
  const append = (m: Message) =>
    qc.setQueryData<InfiniteData<Page>>(key, (old) => {
      if (!old || old.pages.some((p) => p.messages.some((x) => x.id === m.id))) return old;
      const [first, ...rest] = old.pages;
      return { ...old, pages: [{ ...first!, messages: [...first!.messages, m] }, ...rest] };
    });

  useSocketEvent<Message>("dm:new", (m) => {
    const inThread = (m.senderId === otherId && m.recipientId === me?.id) || (m.senderId === me?.id && m.recipientId === otherId);
    if (!inThread) return;
    append(m);
    if (m.senderId === otherId) {
      setTyping(false);
      void markRead();
    }
  });
  useSocketEvent<{ readerId: string; at: string }>("dm:read", ({ readerId, at }) => {
    if (readerId !== otherId) return;
    qc.setQueryData<InfiniteData<Page>>(key, (old) =>
      old && {
        ...old,
        pages: old.pages.map((p) => ({ ...p, messages: p.messages.map((m) => (m.senderId === me?.id && !m.readAt ? { ...m, readAt: at } : m)) })),
      },
    );
  });
  useSocketEvent<{ userId: string }>("dm:typing", ({ userId }) => userId === otherId && setTyping(true));
  useSocketEvent<{ userId: string }>("dm:typing-stop", ({ userId }) => userId === otherId && setTyping(false));
  useEffect(() => {
    if (!typing) return;
    const t = setTimeout(() => setTyping(false), 5000);
    return () => clearTimeout(t);
  }, [typing]);

  // Keep the view pinned to the newest message unless the user scrolled up to read history.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing]);

  if (thread.isError) {
    const notFound = thread.error instanceof ApiError && thread.error.status === 404;
    return (
      <div className="m-auto">
        <Empty title={notFound ? "This person isn't on myPeers" : "Couldn't load this conversation"}>{errorMessage(thread.error)}</Empty>
      </div>
    );
  }

  const lastMineId = [...messages].reverse().find((m) => m.senderId === me?.id)?.id;

  return (
    <div className="flex min-h-0 w-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 md:px-5">
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Back to messages" onClick={() => navigate("/app/messages")}>
          <ArrowLeft className="size-5" />
        </Button>
        {other ? (
          <>
            <Avatar name={other.name} size={38} live={other.live} />
            <div className="min-w-0">
              <p className="truncate font-bold">{other.name}</p>
              <p className="truncate text-[13px] text-slate">
                {other.checkIn ? (
                  <>
                    <span className="course-code text-[14px] text-ink">{other.checkIn.courseCode}</span>
                    {other.checkIn.topic ? ` ${other.checkIn.topic}` : ""}
                    {other.checkIn.location ? `, ${other.checkIn.location}` : ""}
                  </>
                ) : other.live ? (
                  "Online"
                ) : (
                  "Not studying right now"
                )}
              </p>
            </div>
          </>
        ) : (
          <div className="h-10" />
        )}
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6"
        aria-live="polite"
      >
        {thread.hasNextPage ? (
          <div className="mb-4 text-center">
            <Button variant="ghost" size="sm" onClick={() => void thread.fetchNextPage()} loading={thread.isFetchingNextPage}>
              Load earlier messages
            </Button>
          </div>
        ) : null}
        {thread.isLoading ? (
          <div className="grid h-full place-items-center text-slate">
            <Spinner className="size-5" />
          </div>
        ) : messages.length === 0 && other ? (
          <div className="grid h-full place-items-center">
            <Empty title={`Say hi to ${other.name.split(" ")[0]}`}>
              {other.checkIn ? `They're studying ${other.checkIn.courseCode} right now.` : "Start the conversation."}
            </Empty>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {messages.map((m, i) => {
              const mine = m.senderId === me?.id;
              const prev = messages[i - 1];
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              const grouped = prev && !newDay && prev.senderId === m.senderId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
              return (
                <Fragment key={m.id}>
                  {newDay ? (
                    <li className="py-3 text-center text-[12px] font-semibold text-slate">
                      {new Date(m.createdAt).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                    </li>
                  ) : null}
                  <li className={cn("flex flex-col", mine ? "items-end" : "items-start", !grouped && "pt-2")}>
                    <Bubble message={m} mine={mine} />
                    {!grouped || m.id === lastMineId ? (
                      <span className="mt-0.5 px-1 text-[11px] text-slate">
                        {clock(m.createdAt)}
                        {m.id === lastMineId && m.readAt ? ", seen" : ""}
                      </span>
                    ) : null}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}
        {typing && other ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-slate">
            <span className="inline-flex gap-0.5">
              <span className="size-1.5 animate-bounce rounded-full bg-slate [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate" />
            </span>
            {other.name.split(" ")[0]} is typing
          </p>
        ) : null}
      </div>

      <Composer
        otherId={otherId}
        canAttach={!me?.isDemo}
        onSent={(m) => {
          stickToBottom.current = true;
          append(m);
        }}
      />
    </div>
  );
}

function Bubble({ message: m, mine }: { message: Message; mine: boolean }) {
  const a = m.attachment;
  const isImage = a?.mimeType.startsWith("image/");
  return (
    <div
      className={cn(
        "max-w-[78%] rounded-2xl text-[15px] leading-snug break-words whitespace-pre-wrap",
        mine ? "rounded-br-md bg-ink text-paper" : "rounded-bl-md border border-line bg-surface-2",
        a && isImage ? "overflow-hidden p-1" : "px-3.5 py-2",
      )}
    >
      {a ? (
        isImage ? (
          <a href={a.url} target="_blank" rel="noreferrer" className="block">
            <img src={a.url} alt={a.fileName} className="max-h-72 rounded-xl object-cover" loading="lazy" />
          </a>
        ) : (
          <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 py-0.5">
            <FileText className="size-5 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate font-semibold underline-offset-2 hover:underline">{a.fileName}</span>
              <span className="text-[12px] opacity-70">{fileSize(a.size)}</span>
            </span>
          </a>
        )
      ) : null}
      {m.body ? <p className={cn(a && isImage && "px-2.5 py-1.5")}>{m.body}</p> : null}
    </div>
  );
}

function Composer({ otherId, canAttach, onSent }: { otherId: string; canAttach: boolean; onSent: (m: Message) => void }) {
  const { socket } = useSocket();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);

  const send = useMutation({
    mutationFn: async () => {
      let attachment: Attachment | undefined;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        attachment = (await api.upload<{ attachment: Attachment }>("/api/uploads", form)).attachment;
      }
      return api.post<{ message: Message }>(`/api/conversations/${otherId}/messages`, { body, attachmentId: attachment?.id });
    },
    onSuccess: ({ message }) => {
      onSent(message);
      setBody("");
      setFile(null);
      socket?.emit("dm:typing-stop", { toUserId: otherId });
      textarea.current?.focus();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Grow the box with its content, up to a limit.
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [body]);

  const canSend = (body.trim().length > 0 || file) && !send.isPending;

  return (
    <form
      className="border-t border-line p-3 md:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) send.mutate();
      }}
    >
      {file ? (
        <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface-2 py-1.5 pr-1.5 pl-3 text-sm">
          <Paperclip className="size-3.5 shrink-0 text-slate" />
          <span className="truncate">{file.name}</span>
          <span className="shrink-0 text-slate">{fileSize(file.size)}</span>
          <Button type="button" variant="ghost" size="icon" className="size-6" aria-label="Remove file" onClick={() => setFile(null)}>
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        {canAttach ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 10 * 1024 * 1024) return void toast.error("Files can be up to 10 MB.");
                setFile(f);
              }}
            />
            <Button type="button" variant="ghost" size="icon" aria-label="Attach an image or PDF" onClick={() => fileInput.current?.click()}>
              <Paperclip className="size-5" />
            </Button>
          </>
        ) : null}
        <label className="sr-only" htmlFor="composer">
          Message
        </label>
        <textarea
          id="composer"
          ref={textarea}
          rows={1}
          value={body}
          maxLength={2000}
          placeholder="Write a message"
          onChange={(e) => {
            setBody(e.target.value);
            const now = Date.now();
            if (socket && now - lastTyping.current > 2500) {
              lastTyping.current = now;
              socket.emit("dm:typing", { toUserId: otherId });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) send.mutate();
            }
          }}
          className="min-h-10 flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2 text-[15px] placeholder:text-slate/70 focus:border-focus focus:ring-3 focus:ring-focus/20 focus:outline-none"
        />
        <Button type="submit" size="icon" className="h-10 w-10 rounded-xl" disabled={!canSend} loading={send.isPending} aria-label="Send">
          {send.isPending ? null : <SendHorizontal className="size-4.5" />}
        </Button>
      </div>
    </form>
  );
}
