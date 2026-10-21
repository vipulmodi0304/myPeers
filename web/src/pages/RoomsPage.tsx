import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRooms } from "@/components/AppShell";
import { DoorOpen, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CourseInput } from "@/components/CourseInput";
import { DoorDoodle } from "@/components/doodles";
import { Button, CourseTag, Dialog, Empty, Field, Input, PageHeader, Spinner } from "@/components/ui";
import { courseVars } from "@/lib/courseColor";
import { api, errorMessage } from "@/lib/api";
import { cn, shortTime } from "@/lib/format";
import { useMyCheckIn } from "@/lib/peers";
import type { RoomSummary } from "@/lib/types";

export default function RoomsPage() {
  const { data: rooms = [], isLoading } = useRooms();
  const [params, setParams] = useSearchParams();
  const [creating, setCreatingState] = useState(params.get("new") === "1");
  const setCreating = (open: boolean) => {
    setCreatingState(open);
    if (!open && params.has("new")) setParams({}, { replace: true });
  };
  useEffect(() => {
    if (params.get("new") === "1") setCreatingState(true);
  }, [params]);

  return (
    <div className="mx-auto max-w-[920px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Rooms"
        sub="A room gives your study group one whiteboard, one Pomodoro timer everyone follows, and a group chat."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New room
          </Button>
        }
      />

      <JoinByCode />

      <section aria-labelledby="my-rooms" className="mt-8">
        <h2 id="my-rooms" className="heading pb-3 text-[20px]">
          Your rooms
        </h2>
        {isLoading ? (
          <div className="grid h-24 place-items-center text-ink-3">
            <Spinner className="size-5" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-xl border-[1.5px] border-dashed border-rule-strong">
            <Empty icon={<DoorDoodle size={58} />} title="You're not in any rooms yet" action={<Button onClick={() => setCreating(true)}>Create a room</Button>}>
              Create one and share its code with your study group, or open one with a code someone sent you.
            </Empty>
          </div>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {rooms.map((r) => (
              <li key={r.id}>
                <Link to={`/app/rooms/${r.code}`} className="group flex items-center gap-4 px-1 py-3.5 transition-colors hover:bg-paper-2 sm:px-2">
                  <span
                    style={courseVars(r.courseCode)}
                    className={cn("grid size-10 shrink-0 place-items-center rounded-full", r.courseCode ? "bg-course-soft text-course" : "bg-paper-2 text-ink-2")}
                  >
                    <Users className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-semibold group-hover:underline">{r.name}</span>
                    <span className="text-[13px] text-ink-2">
                      {r.memberCount} {r.memberCount === 1 ? "member" : "members"}
                      {r.lastActivity ? <span className="text-ink-3">, last message {shortTime(r.lastActivity)}</span> : null}
                    </span>
                  </span>
                  {r.courseCode ? <CourseTag code={r.courseCode} size="sm" className="hidden sm:inline-flex" /> : null}
                  <span className="code hidden w-20 text-right text-[13px] tracking-wider text-ink-3 sm:block">{r.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateRoomDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function JoinByCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const valid = /^[A-Z0-9]{6}$/.test(code);
  return (
    <form
      className="mt-6 flex flex-col gap-3 rounded-xl bg-paper-2 p-4 sm:flex-row sm:items-end sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) navigate(`/app/rooms/${code}`);
      }}
    >
      <Field label="Have a room code?" htmlFor="room-code" className="flex-1">
        <Input
          id="room-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="K7QX2M"
          autoComplete="off"
          className="code text-[17px] tracking-[0.2em] uppercase placeholder:tracking-[0.2em]"
        />
      </Field>
      <Button type="submit" variant="secondary" disabled={!valid}>
        <DoorOpen className="size-4" /> Open room
      </Button>
    </form>
  );
}

function CreateRoomDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: checkIn } = useMyCheckIn();
  const [name, setName] = useState("");
  const [course, setCourse] = useState(checkIn?.courseCode ?? "");

  const create = useMutation({
    mutationFn: () => api.post<{ room: RoomSummary }>("/api/rooms", { name, courseCode: course || null }),
    onSuccess: ({ room }) => {
      void qc.invalidateQueries({ queryKey: ["rooms"] });
      onOpenChange(false);
      navigate(`/app/rooms/${room.code}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New study room" description="You'll get a code to share with your group.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Room name" htmlFor="room-name">
          <Input id="room-name" required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} placeholder="Finals grind" autoFocus />
        </Field>
        <Field label="Course" htmlFor="room-course" hint="Optional">
          <CourseInput id="room-course" value={course} onChange={setCourse} />
        </Field>
        {create.error ? (
          <p role="alert" className="text-sm font-medium text-red">
            {errorMessage(create.error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            Create room
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
