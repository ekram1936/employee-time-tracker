import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  Palmtree,
  X,
} from "lucide-react";
import * as api from "../api/client";
import { minsToHHMM, monthLabel, isWeekend } from "../utils/time";
import { toast } from "sonner";
import EntryModal from "../components/EntryModal";

// ─── Holiday fetching (nager.date — free, no auth) ────────────────────────────
interface NagerHoliday {
  date: string; // "2026-01-01"
  localName: string;
  name: string;
  global: boolean;
  counties: string[] | null;
}

// Cache by year so we only fetch once per year
const holidayCache = new Map<number, Map<string, string>>();

async function fetchBavariaHolidays(
  year: number,
): Promise<Map<string, string>> {
  if (holidayCache.has(year)) return holidayCache.get(year)!;
  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/DE`,
    );
    if (!res.ok) throw new Error("Failed");
    const data: NagerHoliday[] = await res.json();
    const map = new Map<string, string>();
    for (const h of data) {
      // Include if global (nationwide) OR applies to Bavaria (DE-BY)
      const isBavaria = h.global || h.counties?.includes("DE-BY") || false;
      if (isBavaria) map.set(h.date, h.localName);
    }
    holidayCache.set(year, map);
    return map;
  } catch {
    return new Map();
  }
}

// ─── Vacation range modal ─────────────────────────────────────────────────────
interface VacationRangeModalProps {
  onSave: (from: string, to: string) => Promise<void>;
  onClose: () => void;
  holidays: Map<string, string>;
}

function VacationRangeModal({
  onSave,
  onClose,
  holidays,
}: VacationRangeModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [saving, setSaving] = useState(false);

  // Count working days (skip weekends + holidays)
  const countWorkingDays = () => {
    let count = 0;
    const cur = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6 && !holidays.has(ds)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const isInvalid = from > to;
  const workDays = !isInvalid ? countWorkingDays() : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalid) {
      toast.error("Start date must be before or equal to end date.");
      return;
    }
    if (workDays === 0) {
      toast.error("No working days in this range.");
      return;
    }
    setSaving(true);
    try {
      await onSave(from, to);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Add Vacation Range</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                className="input"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
          </div>

          {isInvalid && (
            <p className="text-xs text-red-600 font-medium bg-red-50 px-3 py-2 rounded-xl">
              ⛔ Start date must be before or equal to end date.
            </p>
          )}

          {!isInvalid && workDays > 0 && (
            <p className="text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-2 rounded-xl">
              ✅ {workDays} working day{workDays !== 1 ? "s" : ""} will be
              marked as vacation. Weekends and public holidays are skipped
              automatically.
            </p>
          )}

          {!isInvalid && workDays === 0 && from <= to && (
            <p className="text-xs text-amber-700 font-medium bg-amber-50 px-3 py-2 rounded-xl">
              ⚠️ No working days in this range (all weekends or holidays).
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || isInvalid || workDays === 0}
              className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="spinner" />
              ) : (
                `Save ${workDays > 0 ? workDays + "d" : ""}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main CalendarView ────────────────────────────────────────────────────────
export default function CalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [entries, setEntries] = useState<api.TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  const [modal, setModal] = useState<{
    date: string;
    entry?: api.TimeEntry;
  } | null>(null);
  const [showVacRange, setShowVacRange] = useState(false);

  // ── Load entries ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const m = String(month + 1).padStart(2, "0");
    const last = new Date(year, month + 1, 0).getDate();
    setIsLoading(true);
    try {
      setEntries(
        await api.getTimeEntries(
          `${year}-${m}-01`,
          `${year}-${m}-${String(last).padStart(2, "0")}`,
        ),
      );
    } catch {
      toast.error("Failed to load entries");
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Load Bavaria holidays whenever year changes ─────────────────────────────
  useEffect(() => {
    fetchBavariaHolidays(year).then(setHolidays);
    // Also prefetch next year if in December
    if (month === 11) fetchBavariaHolidays(year + 1).then(() => {});
  }, [year, month]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const prev = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const entryMap = new Map(entries.map((e) => [e.date, e]));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const today = new Date().toISOString().slice(0, 10);
  const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // ── Save single entry (from day-click modal) ────────────────────────────────
  const handleSave = async (
    payload: api.CreateTimeEntryPayload,
    id?: string,
  ) => {
    try {
      if (!id) {
        if (payload.type === "work") {
          if (
            entries.some((e) => e.date === payload.date && e.type === "work")
          ) {
            toast.error("You already have a work entry for this day.");
            return;
          }
          if (
            entries.some((e) => e.date === payload.date && e.type !== "work")
          ) {
            toast.error(
              "This day is marked as vacation/sick. Cannot add work.",
            );
            return;
          }
        } else {
          if (
            entries.some(
              (e) => e.date === payload.date && e.type !== payload.type,
            )
          ) {
            toast.error("This day already has a different type entry.");
            return;
          }
        }
      }
      if (id) await api.updateTimeEntry(id, payload);
      else await api.createTimeEntry(payload);
      toast.success("Saved");
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ── Save vacation range ─────────────────────────────────────────────────────
  const handleVacationRange = async (from: string, to: string) => {
    const cur = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    const toCreate: string[] = [];

    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      const dow = cur.getDay();
      // Skip weekends and holidays
      if (dow !== 0 && dow !== 6 && !holidays.has(ds)) {
        // Skip days that already have any entry
        if (!entryMap.has(ds)) toCreate.push(ds);
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (toCreate.length === 0) {
      toast.error(
        "All days in range already have entries or are non-working days.",
      );
      return;
    }

    try {
      // Create all vacation entries in parallel
      await Promise.all(
        toCreate.map((date) =>
          api.createTimeEntry({
            date,
            start_time: "",
            end_time: "",
            break_minutes: 0,
            work_minutes: 0,
            type: "vacation",
            note: "",
          }),
        ),
      );
      toast.success(
        `${toCreate.length} vacation day${toCreate.length !== 1 ? "s" : ""} saved.`,
      );
      setShowVacRange(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ── Month stats ─────────────────────────────────────────────────────────────
  const monthStats = {
    work: entries
      .filter((e) => e.type === "work")
      .reduce((s, e) => s + e.work_minutes, 0),
    days: entries.filter((e) => e.type === "work").length,
    vacation: entries.filter((e) => e.type === "vacation").length,
    sick: entries.filter((e) => e.type === "sick").length,
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Monthly overview</p>
        </div>
        {/* Vacation range button */}
        <button
          onClick={() => setShowVacRange(true)}
          className="btn-secondary gap-2"
        >
          <Palmtree size={16} /> Add vacation range
        </button>
      </div>

      {/* Nav + stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={prev} className="btn-ghost p-2">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-slate-900 w-44 text-center">
            {monthLabel(year, month)}
          </h2>
          <button onClick={next} className="btn-ghost p-2">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex gap-6">
          {[
            { label: "Days logged", val: monthStats.days || "—" },
            {
              label: "Hours",
              val: monthStats.work > 0 ? minsToHHMM(monthStats.work) : "—",
            },
            {
              label: "Vacation",
              val: monthStats.vacation > 0 ? `${monthStats.vacation}d` : "—",
            },
            {
              label: "Sick",
              val: monthStats.sick > 0 ? `${monthStats.sick}d` : "—",
            },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-base font-bold text-slate-900 tabular-nums">
                {s.val}
              </p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div
        className={`card overflow-hidden transition-opacity duration-150 ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
      >
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-semibold text-slate-400"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {/* Leading empty cells */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div
              key={`e${i}`}
              className="h-20 border-b border-r border-slate-50 bg-slate-50/40"
            />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const entry = entryMap.get(dateStr);
            const weekend = isWeekend(dateStr);
            const holiday = holidays.get(dateStr); // holiday name or undefined
            const isBlocked = weekend || !!holiday; // weekends + holidays = blocked
            const isToday = dateStr === today;
            const col = (firstDow + day - 1) % 7;

            // Clickable: not blocked OR has an existing entry (to allow edit/view)
            const isClickable = !isBlocked || !!entry;

            const bg =
              entry?.type === "work"
                ? "bg-blue-50"
                : entry?.type === "vacation"
                  ? "bg-emerald-50"
                  : entry?.type === "sick"
                    ? "bg-red-50"
                    : holiday
                      ? "bg-amber-50/60" // holiday tint
                      : weekend
                        ? "bg-slate-50/60"
                        : "bg-white hover:bg-slate-50";

            return (
              <div
                key={dateStr}
                onClick={() =>
                  isClickable && setModal({ date: dateStr, entry })
                }
                className={`
                  h-20 border-b border-r border-slate-100 p-2 transition-colors relative group
                  ${col === 6 ? "border-r-0" : ""}
                  ${bg}
                  ${isClickable ? "cursor-pointer" : "cursor-default"}
                `}
              >
                {/* Day number */}
                <span
                  className={`
                  text-xs font-semibold leading-none
                  ${
                    isToday
                      ? "bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center"
                      : isBlocked && !entry
                        ? "text-slate-300"
                        : "text-slate-500"
                  }
                `}
                >
                  {day}
                </span>

                {/* Holiday label (only if no entry — entry takes priority) */}
                {holiday && !entry && (
                  <p className="mt-0.5 text-[9px] font-semibold text-amber-600 leading-tight truncate">
                    {holiday}
                  </p>
                )}

                {/* Work entry */}
                {entry?.type === "work" && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs font-semibold text-blue-700 tabular-nums leading-tight">
                      {minsToHHMM(entry.work_minutes)}
                    </p>
                    <p className="text-[10px] text-blue-400 leading-tight">
                      {entry.start_time}–{entry.end_time}
                    </p>
                  </div>
                )}

                {/* Vacation entry */}
                {entry?.type === "vacation" && (
                  <p className="mt-1 text-[10px] font-semibold text-emerald-600">
                    Vacation
                  </p>
                )}

                {/* Sick entry */}
                {entry?.type === "sick" && (
                  <p className="mt-1 text-[10px] font-semibold text-red-500">
                    Sick
                  </p>
                )}

                {/* Hover icons — only on non-blocked working days */}
                {!entry && !isBlocked && (
                  <Plus
                    size={12}
                    className="absolute bottom-2 right-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                )}
                {entry && isClickable && (
                  <Edit3
                    size={12}
                    className="absolute bottom-2 right-2 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1">
        {[
          { color: "bg-blue-100", label: "Work" },
          { color: "bg-emerald-100", label: "Vacation" },
          { color: "bg-red-100", label: "Sick" },
          { color: "bg-amber-100", label: "Public holiday" },
          { color: "bg-slate-100", label: "Weekend" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${l.color}`} />
            <span className="text-xs text-slate-400">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Day-click modal */}
      {modal && (
        <EntryModal
          entry={modal.entry}
          defaultDate={modal.date}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Vacation range modal */}
      {showVacRange && (
        <VacationRangeModal
          onSave={handleVacationRange}
          onClose={() => setShowVacRange(false)}
          holidays={holidays}
        />
      )}
    </div>
  );
}
