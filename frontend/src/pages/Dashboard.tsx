import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Square, Plus, Edit3, Trash2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import * as api from "../api/client";
import { minsToHHMM, todayStr, nowTimeStr, formatDate } from "../utils/time";
import { toast } from "sonner";
import EntryModal from "../components/EntryModal";

// ─── Bavaria holiday fetching ─────────────────────────────────────────────────
// Move to utils/holidays.ts and import from there if CalendarView also uses it
interface NagerHoliday {
  date: string;
  localName: string;
  global: boolean;
  counties: string[] | null;
}

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
      if (h.global || h.counties?.includes("DE-BY"))
        map.set(h.date, h.localName);
    }
    holidayCache.set(year, map);
    return map;
  } catch {
    return new Map();
  }
}

// ─── Session type ─────────────────────────────────────────────────────────────
interface Session {
  startTime: string;
  localStart: string;
  date: string;
  existingEntryId?: string;
  alreadyWorkedMins: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<api.TimeEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = sessionStorage.getItem("tt_active_session");
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  });
  const [elapsed, setElapsed] = useState("00:00");
  const [modal, setModal] = useState<{ entry?: api.TimeEntry } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = todayStr();
  const dailyTargetMins = (user?.daily_target_hours ?? 8) * 60;

  // ─── Fetch Bavaria holidays for current year ────────────────────────────────
  useEffect(() => {
    const year = new Date().getFullYear();
    fetchBavariaHolidays(year).then(setHolidays);
  }, []);

  // ─── Today's holiday name (if any) ─────────────────────────────────────────
  const todayHoliday = holidays.get(today);

  // ─── Load entries ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setIsLoadingEntries(true);
    try {
      setEntries(await api.getTimeEntries());
    } catch {
      toast.error("Failed to load entries");
    }
    setIsLoadingEntries(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Persist session ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      if (!session) sessionStorage.removeItem("tt_active_session");
      else sessionStorage.setItem("tt_active_session", JSON.stringify(session));
    } catch {}
  }, [session]);

  // ─── Sync alreadyWorkedMins if entry edited while session is active ─────────
  useEffect(() => {
    if (!session?.existingEntryId) return;
    const updated = entries.find((e) => e.id === session.existingEntryId);
    if (!updated) return;
    if (updated.work_minutes !== session.alreadyWorkedMins) {
      setSession((prev) =>
        prev ? { ...prev, alreadyWorkedMins: updated.work_minutes } : prev,
      );
    }
  }, [entries]);

  // ─── Elapsed timer: already worked + current live session ──────────────────
  useEffect(() => {
    if (!session) {
      setElapsed("00:00");
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () => {
      const sessionSecs = Math.floor(
        (Date.now() - new Date(session.startTime).getTime()) / 1000,
      );
      const totalSecs = session.alreadyWorkedMins * 60 + sessionSecs;
      const h = String(Math.floor(totalSecs / 3600)).padStart(2, "0");
      const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, "0");
      setElapsed(`${h}:${m}`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session]);

  // ─── Clock in (fresh) ───────────────────────────────────────────────────────
  const startWork = () => {
    //Block on public holidays
    if (todayHoliday) {
      toast.error(
        `Today is a public holiday (${todayHoliday}). You cannot clock in.`,
      );
      return;
    }
    const blocked = entries.find((e) => e.date === today && e.type !== "work");
    if (blocked) {
      toast.error(
        `${blocked.type === "sick" ? "Sick" : "Vacation"} day set. You cannot clock in.`,
      );
      return;
    }
    const hasWorkToday = entries.some(
      (e) => e.date === today && e.type === "work",
    );
    if (hasWorkToday) {
      toast.error("You already have a work entry for today.");
      return;
    }
    const s: Session = {
      startTime: new Date().toISOString(),
      localStart: nowTimeStr(),
      date: today,
      existingEntryId: undefined,
      alreadyWorkedMins: 0,
    };
    setSession(s);
    toast.success(`Clocked in at ${s.localStart}`);
  };

  // ─── Resume ─────────────────────────────────────────────────────────────────
  const continueWork = async () => {
    //Block on public holidays
    if (todayHoliday) {
      toast.error(
        `Today is a public holiday (${todayHoliday}). You cannot clock in.`,
      );
      return;
    }
    const blocked = entries.find((e) => e.date === today && e.type !== "work");
    if (blocked) {
      toast.error(
        `${blocked.type === "sick" ? "Sick" : "Vacation"} day set. You cannot clock in.`,
      );
      return;
    }

    // Fetch fresh — do NOT rely on stale React state closure
    let freshEntries: api.TimeEntry[] = [];
    try {
      freshEntries = await api.getTimeEntries();
      setEntries(freshEntries);
    } catch {
      toast.error("Failed to load entries. Try again.");
      return;
    }

    const existing = freshEntries.find(
      (e) => e.date === today && e.type === "work",
    );

    // Entry was deleted between render and click — fall back to fresh clock-in
    if (!existing) {
      startWork();
      return;
    }

    if (existing.work_minutes >= 600) {
      toast.error("Daily 10 h net limit already reached.");
      return;
    }

    const s: Session = {
      startTime: new Date().toISOString(),
      localStart: nowTimeStr(),
      date: today,
      existingEntryId: existing.id,
      alreadyWorkedMins: existing.work_minutes,
    };
    setSession(s);
    toast.success(
      `Resumed at ${s.localStart} · ${minsToHHMM(existing.work_minutes)} already logged`,
    );
  };

  // ─── Clock out ──────────────────────────────────────────────────────────────
  const stopWork = async () => {
    try {
      sessionStorage.removeItem("tt_active_session");
    } catch {}
    if (!session) return;

    const workEnd = nowTimeStr();
    const [sh, sm] = session.localStart.split(":").map(Number);
    const [eh, em] = workEnd.split(":").map(Number);
    const sessionSpan = eh * 60 + em - (sh * 60 + sm);

    // Midnight crossing guard
    if (sessionSpan < 0) {
      setSession(null);
      toast.error("Session crossed midnight. Please add the entry manually.");
      return;
    }

    const totalSpan = session.alreadyWorkedMins + sessionSpan;
    const breakMin = totalSpan > 600 ? 60 : totalSpan > 480 ? 30 : 0;
    const net = Math.max(0, totalSpan - breakMin);

    // Always clear session so timer stops
    setSession(null);

    if (net > 600) {
      toast.error(
        "Net work exceeds 10 h. Entry not saved — please add manually.",
      );
      return;
    }

    try {
      if (session.existingEntryId) {
        // Resume path: UPDATE existing entry
        let originalStart = session.localStart;
        try {
          const fresh = await api.getTimeEntries();
          const orig = fresh.find((e) => e.id === session.existingEntryId);
          if (orig?.start_time) originalStart = orig.start_time;
        } catch {}

        await api.updateTimeEntry(session.existingEntryId, {
          date: session.date,
          start_time: originalStart,
          end_time: workEnd,
          break_minutes: breakMin,
          work_minutes: net,
          type: "work",
        });
      } else {
        // Fresh path: CREATE new entry
        await api.createTimeEntry({
          date: session.date,
          start_time: session.localStart,
          end_time: workEnd,
          break_minutes: breakMin,
          work_minutes: net,
          type: "work",
        });
      }
      toast.success(`Clocked out · ${minsToHHMM(net)} total today`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ─── Delete entry ───────────────────────────────────────────────────────────
  const deleteEntry = async (id: string) => {
    if (session?.existingEntryId === id) {
      setSession(null);
      try {
        sessionStorage.removeItem("tt_active_session");
      } catch {}
      toast.info("Active session cleared because the entry was deleted.");
    }
    try {
      await api.deleteTimeEntry(id);
      toast.success("Entry deleted");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ─── Save from modal ────────────────────────────────────────────────────────
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

  // ─── Derived state ──────────────────────────────────────────────────────────
  const todayVacationOrSick = entries.find(
    (e) => e.date === today && e.type !== "work",
  );
  const todayEntry = entries.find((e) => e.date === today && e.type === "work");

  const thisWeek = entries.filter((e) => {
    const d = new Date(e.date + "T00:00:00");
    const now = new Date();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    mon.setHours(0, 0, 0, 0);
    return d >= mon && e.type === "work";
  });
  const weekMins = thisWeek.reduce((s, e) => s + e.work_minutes, 0);
  const weekTarget = (user?.daily_target_hours ?? 8) * 5 * 60;
  const recent = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{formatDate(today)}</p>
        </div>
        <button
          onClick={() => {
            // Block adding work on holidays
            if (todayHoliday) {
              toast.error(
                `Today is a public holiday (${todayHoliday}). Cannot add work entries.`,
              );
              return;
            }
            const hasNonWorkToday = entries.some(
              (e) => e.date === today && e.type !== "work",
            );
            if (hasNonWorkToday) {
              const blocked = entries.find(
                (e) => e.date === today && e.type !== "work",
              );
              toast.error(
                blocked?.type === "sick"
                  ? "Sick day set. You cannot add work entries."
                  : "Vacation day set. You cannot add work entries.",
              );
              if (blocked) setModal({ entry: blocked });
              return;
            }
            setModal({});
          }}
          className="btn-primary gap-2"
        >
          <Plus size={16} /> Add entry
        </button>
      </div>

      {/* Clock widget */}
      <div className="card p-6 mb-6">
        {session ? (
          // ── Active session ────────────────────────────────────────────────
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                  Working
                </span>
              </div>
              <p className="text-4xl font-bold text-slate-900 tabular-nums">
                {elapsed}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Session started at{" "}
                {new Date(session.startTime).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {session.alreadyWorkedMins > 0 &&
                  ` · ${minsToHHMM(session.alreadyWorkedMins)} previously logged`}
              </p>
            </div>
            <button onClick={stopWork} className="btn-danger gap-2 btn-lg">
              <Square size={16} /> Clock out
            </button>
          </div>
        ) : todayEntry ? (
          // ── Entry exists, not clocked in ──────────────────────────────────
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide mb-1">
                Today's work
              </p>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">
                {minsToHHMM(todayEntry.work_minutes)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {todayEntry.start_time} – {todayEntry.end_time}
              </p>
            </div>
            <button
              onClick={continueWork}
              className="btn-primary gap-2 btn-lg"
              disabled={todayEntry.work_minutes >= 600}
              title={
                todayEntry.work_minutes >= 600
                  ? "Daily 10 h net limit reached"
                  : undefined
              }
            >
              <Play size={16} />
              {todayEntry.work_minutes >= 600 ? "Limit reached" : "Continue"}
            </button>
          </div>
        ) : todayHoliday ? (
          // ── Public holiday ────────────────────────────────────────────────
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide mb-1">
                Public Holiday
              </p>
              <p className="text-lg font-semibold text-slate-700">
                {todayHoliday}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                No work today — enjoy your day off 🎉
              </p>
            </div>
            <span className="text-4xl select-none">🎌</span>
          </div>
        ) : todayVacationOrSick ? (
          // ── Vacation / sick ───────────────────────────────────────────────
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide mb-1">
                {todayVacationOrSick.type === "sick"
                  ? "Sick day"
                  : "Vacation day"}
              </p>
              <p className="text-lg font-semibold text-slate-500">
                You can't clock in today.
              </p>
              {todayVacationOrSick.note && (
                <p className="text-xs text-slate-400 mt-1">
                  Note: {todayVacationOrSick.note}
                </p>
              )}
            </div>
            <button
              onClick={() => setModal({ entry: todayVacationOrSick })}
              className="btn-secondary gap-2 btn-lg"
            >
              <Edit3 size={16} /> View
            </button>
          </div>
        ) : (
          // ── Ready to clock in ─────────────────────────────────────────────
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide mb-1">
                Ready to work?
              </p>
              <p className="text-lg font-semibold text-slate-500">
                Start tracking your day
              </p>
            </div>
            <button onClick={startWork} className="btn-primary gap-2 btn-lg">
              <Play size={16} /> Clock in
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Today",
            val: todayEntry ? minsToHHMM(todayEntry.work_minutes) : "—",
          },
          { label: "This week", val: minsToHHMM(weekMins) },
          { label: "Week target", val: minsToHHMM(weekTarget) },
          {
            label: "Overtime",
            val:
              weekMins > weekTarget
                ? `+${minsToHHMM(weekMins - weekTarget)}`
                : "—",
          },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="stat-value">{s.val}</p>
            <p className="stat-label">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent entries table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent entries</h2>
          <span className="text-xs text-slate-400">{entries.length} total</span>
        </div>
        {recent.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-sm">
            No entries yet. Clock in or add manually.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs font-medium text-slate-400 border-b border-slate-100">
                  {["Date", "Start", "End", "Break", "Worked", "Note", ""].map(
                    (h) => (
                      <th key={h} className="text-left px-5 py-3">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => (
                  <tr key={e.id} className="table-row">
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {formatDate(e.date)}
                    </td>
                    <td className="px-5 py-3 text-sm tabular-nums">
                      {e.start_time || "—"}
                    </td>
                    <td className="px-5 py-3 text-sm tabular-nums">
                      {e.end_time || "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-400">
                      {e.break_minutes}m
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-blue-700 tabular-nums">
                      {minsToHHMM(e.work_minutes)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-400 max-w-[140px] truncate">
                      {e.note || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setModal({ entry: e })}
                          className="btn-ghost btn-sm p-1.5"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => deleteEntry(e.id)}
                          className="btn-ghost btn-sm p-1.5 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <EntryModal
          entry={modal.entry}
          defaultDate={today}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
