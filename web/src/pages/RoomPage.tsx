import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Link2, LogOut } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Reactions } from "@/components/room/Reactions";
import { RoomChat } from "@/components/room/RoomChat";
import { RoomTimer } from "@/components/room/RoomTimer";
import { Whiteboard } from "@/components/room/Whiteboard";
import { Avatar, Button, Empty, FullPageSpinner, Spinner } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { cn } from "@/lib/format";
import { useRoom, type RoomDetail } from "@/lib/room";
import { useMediaQuery } from "@/lib/useMediaQuery";

export default function RoomPage() {
  const code = (useParams().code ?? "").toUpperCase();
  const room = useRoom(code);
  const { detail } = room;

  if (detail.isLoading) return <FullPageSpinner />;
  if (detail.isError || !detail.data) {
    const missing = detail.error instanceof ApiError && (detail.error.status === 404 || detail.error.status === 400);
    return (
      <Empty
        title={missing ? `No room with the code ${code}` : "Couldn't open this room"}
        action={
          <Link to="/app/rooms">
            <Button variant="secondary">Back to rooms</Button>
          </Link>
        }
      >
        {missing ? "Check the code with whoever sent it. Rooms disappear when everyone leaves." : errorMessage(detail.error)}
      </Empty>
    );
  }
  if (!detail.data.isMember) return <JoinPrompt code={code} data={detail.data} />;
  return <LiveRoom code={code} room={room} />;
}

function JoinPrompt({ code, data }: { code: string; data: RoomDetail }) {
  const qc = useQueryClient();
  const join = useMutation({
    mutationFn: () => api.post(`/api/rooms/${code}/join`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["room", code] });
      void qc.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-panel">
        {data.room.courseCode ? <p className="course-code text-[32px] leading-none">{data.room.courseCode}</p> : null}
        <h1 className="mt-3 text-xl font-extrabold">{data.room.name}</h1>
        <p className="mt-1 text-sm text-slate">
          {data.room.memberCount} {data.room.memberCount === 1 ? "member" : "members"}. Join to use the shared whiteboard, timer and chat.
        </p>
        <Button size="lg" className="mt-6 w-full" onClick={() => join.mutate()} loading={join.isPending}>
          Join room
        </Button>
      </div>
    </div>
  );
}

type Tab = "board" | "chat" | "people";

function LiveRoom({ code, room }: { code: string; room: ReturnType<typeof useRoom> }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("board");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [copied, setCopied] = useState(false);
  const data = room.detail.data!;
  const roomId = room.roomId!;

  const leave = useMutation({
    mutationFn: () => api.delete(`/api/rooms/${code}/membership`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rooms"] });
      toast(`Left ${data.room.name}`);
      navigate("/app/rooms");
    },
  });

  const invite = async () => {
    const url = `${location.origin}/app/rooms/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(`Share this code: ${code}`);
    }
  };

  const board = (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-surface-2">
      <div className="min-h-0 flex-1">
        <Whiteboard roomId={roomId} initialStrokes={room.initialStrokes ?? []} emit={room.emit} userId={me!.id} />
      </div>
      <Reactions roomId={roomId} emit={room.emit} />
    </div>
  );
  const timer = room.timer ? (
    <RoomTimer timer={room.timer} clockOffset={room.clockOffset} lastBy={room.lastTimerBy} emit={room.emit} />
  ) : null;
  const compactTimer = room.timer ? (
    <RoomTimer compact timer={room.timer} clockOffset={room.clockOffset} lastBy={room.lastTimerBy} emit={room.emit} />
  ) : null;

  const hereSet = new Set(room.here);
  const people = [...data.members].sort((a, b) => Number(hereSet.has(b.id)) - Number(hereSet.has(a.id)));

  const peoplePanel = (
    <section aria-label="People in this room">
      <h2 className="text-[13px] font-semibold text-slate">
        {room.here.length} here now, {data.members.length} {data.members.length === 1 ? "member" : "members"}
      </h2>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {people.map((m) => (
          <li key={m.id} className={cn("flex items-center gap-2 text-sm", !hereSet.has(m.id) && "opacity-55")}>
            <Avatar name={m.name} size={26} live={hereSet.has(m.id)} />
            {m.id === me?.id ? "You" : m.name.split(" ")[0]}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-3">
        <Link to="/app/rooms" className="text-slate hover:text-ink" aria-label="All rooms">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex min-w-0 flex-1 items-baseline gap-3">
          {data.room.courseCode ? <span className="course-code hidden shrink-0 text-[22px] leading-none sm:inline">{data.room.courseCode}</span> : null}
          <h1 className="truncate text-[17px] font-bold">{data.room.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[13px] text-slate sm:inline">
            Code <strong className="tracking-wider text-ink tabular">{code}</strong>
          </span>
          <Button variant="secondary" size="sm" onClick={invite} aria-label="Copy invite link">
            {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            <span className="hidden sm:inline">{copied ? "Link copied" : "Invite"}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => leave.mutate()} loading={leave.isPending} aria-label="Leave room">
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </header>

      {!room.entered || !room.timer || !room.initialStrokes ? (
        <div className="grid flex-1 place-items-center text-slate">
          <span className="flex items-center gap-2 text-sm">
            <Spinner className="size-4" /> Connecting to the room
          </span>
        </div>
      ) : isDesktop ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px]">
          {board}
          <aside className="flex min-h-0 flex-col gap-5 border-l border-line bg-paper p-4">
            {timer}
            {peoplePanel}
            <RoomChat code={code} roomId={roomId} meId={me!.id} />
          </aside>
        </div>
      ) : (
        // Small screens: timer on top, then tabs for the board, chat and people.
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-line p-3">{compactTimer}</div>
          <div role="tablist" aria-label="Room views" className="flex shrink-0 border-b border-line">
            {(["board", "chat", "people"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn("flex-1 py-2.5 text-sm font-semibold text-slate", tab === t && "text-ink shadow-[inset_0_-2px_0_var(--ink)]")}
              >
                {t === "board" ? "Whiteboard" : t === "chat" ? "Chat" : `People (${room.here.length})`}
              </button>
            ))}
          </div>
          {/* The board stays mounted while hidden so strokes keep arriving. */}
          <div className={cn("min-h-[320px] flex-1", tab === "board" ? "flex" : "hidden")}>{board}</div>
          {tab === "chat" ? (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <RoomChat code={code} roomId={roomId} meId={me!.id} />
            </div>
          ) : null}
          {tab === "people" ? <div className="p-4">{peoplePanel}</div> : null}
        </div>
      )}
    </div>
  );
}
