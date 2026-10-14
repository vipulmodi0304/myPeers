import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CourseInput } from "@/components/CourseInput";
import { Button, Dialog, Empty, Field, Input, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { shortTime } from "@/lib/format";
import { useMyCheckIn } from "@/lib/peers";
import type { RoomSummary } from "@/lib/types";

export default function RoomsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["rooms"], queryFn: () => api.get<{ rooms: RoomSummary[] }>("/api/rooms") });
  const [creating, setCreating] = useState(false);
  const rooms = data?.rooms ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight" style={{ fontStretch: "90%" }}>
            Study rooms
          </h1>
          <p className="mt-1 max-w-md text-slate">A room is a shared space for your group: one whiteboard, one Pomodoro timer everyone follows, and a group chat.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New room
        </Button>
      </div>

      <JoinByCode />

      <section aria-labelledby="my-rooms" className="mt-10">
        <h2 id="my-rooms" className="font-bold">
          Your rooms
        </h2>
        {isLoading ? (
          <div className="grid h-24 place-items-center text-slate">
            <Spinner className="size-5" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line">
            <Empty icon={<Users className="size-8" />} title="You're not in any rooms yet" action={<Button onClick={() => setCreating(true)}>Create a room</Button>}>
              Create one and share its code with your study group, or join with a code someone sent you.
            </Empty>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {rooms.map((r) => (
              <li key={r.id}>
                <Link to={`/app/rooms/${r.code}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.name}</span>
                    <span className="text-[13px] text-slate">
                      {r.memberCount} {r.memberCount === 1 ? "member" : "members"}
                      {r.lastActivity ? `, last message ${shortTime(r.lastActivity)}` : ""}
                    </span>
                  </span>
                  {r.courseCode ? <span className="course-code text-[18px]">{r.courseCode}</span> : null}
                  <span className="hidden rounded-md border border-line px-2 py-0.5 text-[13px] font-semibold tracking-wider text-slate tabular sm:block">{r.code}</span>
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
      className="mt-8 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-end"
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
          className="text-[17px] font-semibold tracking-[0.3em] uppercase tabular placeholder:tracking-[0.3em]"
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
          <p role="alert" className="text-sm text-red">
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
