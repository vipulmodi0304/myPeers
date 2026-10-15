import { useState } from "react";
import { useMe } from "@/lib/auth";
import { useSocketEvent } from "@/lib/socket";

const EMOJIS = ["👏", "🔥", "💡", "✅", "😂", "☕"];

type Floating = { id: number; emoji: string; name: string; left: number };

/** Quick reactions that float up over the whiteboard for everyone in the room. */
export function Reactions({ roomId, emit }: { roomId: string; emit: (event: string, payload?: Record<string, unknown>) => void }) {
  const { data: me } = useMe();
  const [floating, setFloating] = useState<Floating[]>([]);

  useSocketEvent<{ roomId: string; emoji: string; userId: string; name: string }>("room:reaction", (e) => {
    if (e.roomId !== roomId) return;
    const item = { id: Math.random(), emoji: e.emoji, name: e.userId === me?.id ? "You" : e.name.split(" ")[0]!, left: 10 + Math.random() * 75 };
    setFloating((f) => [...f.slice(-14), item]);
    setTimeout(() => setFloating((f) => f.filter((x) => x.id !== item.id)), 2300);
  });

  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {floating.map((f) => (
          <span key={f.id} className="float-up absolute bottom-20 flex flex-col items-center" style={{ left: `${f.left}%` }}>
            <span className="text-4xl">{f.emoji}</span>
            <span className="rounded bg-ink/80 px-1.5 text-[11px] font-semibold text-canvas">{f.name}</span>
          </span>
        ))}
      </div>
      <div className="mx-auto mb-3 flex w-fit shrink-0 gap-0.5 rounded-full border border-line bg-surface p-1 shadow-pop" role="group" aria-label="Send a reaction">
        {EMOJIS.map((e) => (
          <button key={e} onClick={() => emit("room:react", { emoji: e })} className="grid size-9 place-items-center rounded-full text-lg hover:bg-surface-2" aria-label={`React ${e}`}>
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
