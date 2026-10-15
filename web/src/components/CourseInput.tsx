import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { courseVars } from "@/lib/courseColor";
import { cn } from "@/lib/format";
import { inputClass } from "./ui";

/**
 * Course code box with suggestions from the server's catalogue.
 * Accessible combobox: arrow keys move, Enter picks, Escape closes.
 */
export function CourseInput({
  id,
  value,
  onChange,
  autoFocus,
  invalid,
  placeholder = "COMP 251",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  invalid?: boolean;
  placeholder?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 120);
    return () => clearTimeout(t);
  }, [value]);

  const { data } = useQuery({
    queryKey: ["courses", debounced],
    queryFn: () => api.get<{ courses: string[] }>(`/api/courses?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
    staleTime: Infinity,
  });
  const options = (debounced.length >= 2 ? data?.courses ?? [] : []).filter((c) => c !== value.trim().toUpperCase());
  const show = open && options.length > 0;

  const pick = (c: string) => {
    onChange(c);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        className={cn(inputClass, "course-code text-[17px] uppercase placeholder:font-semibold placeholder:text-ink-3")}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + options.length) % options.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(options[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {show ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full min-w-40 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-pop"
        >
          {options.map((c, i) => (
            <li
              key={c}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
              style={courseVars(c)} className={cn("course-code cursor-pointer rounded-md px-2.5 py-1.5 text-[16px] text-course", i === active && "bg-surface-2")}
            >
              {c}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
