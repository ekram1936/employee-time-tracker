import { useState, useEffect, useCallback } from "react";
import { Palmtree, Trash2, CalendarDays, Edit3 } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";
import { formatDate } from "../utils/time";
import EntryModal from "../components/EntryModal";

export default function Vacation() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<api.TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [freshQuota, setFreshQuota] = useState<number | null>(null);
  const [modal, setModal] = useState<{ entry: api.TimeEntry } | null>(null);

  // DB-first: freshQuota from getMe(), falls back to auth context, then 30
  const totalDays = freshQuota ?? user?.annual_vacation_days ?? 30;

  // ─── Load entries + fresh user quota from DB in parallel ───────────────────
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const year = new Date().getFullYear();
      const [all, freshUser] = await Promise.all([
        api.getTimeEntries(`${year}-01-01`, `${year}-12-31`),
        api.getMe(), // fresh from DB
      ]);
      setEntries(all.filter((e) => e.type === "vacation" || e.type === "sick"));
      setFreshQuota(freshUser.annual_vacation_days); // always in sync
    } catch {
      toast.error("Failed to load vacation data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Derived counts ─────────────────────────────────────────────────────────
  const vacationEntries = entries.filter((e) => e.type === "vacation");
  const sickEntries = entries.filter((e) => e.type === "sick");
  const usedDays = vacationEntries.length;
  const remaining = totalDays - usedDays;
  const pct = totalDays > 0 ? Math.min(100, (usedDays / totalDays) * 100) : 0;

  // ─── Delete — reflects back to calendar immediately ─────────────────────────
  const deleteEntry = async (id: string) => {
    try {
      await api.deleteTimeEntry(id);
      toast.success("Entry removed");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ─── Edit existing entry only — no creation, no type change to work ─────────
  const handleSave = async (
    payload: api.CreateTimeEntryPayload,
    id?: string,
  ) => {
    if (!id) {
      toast.error("Use the Calendar to add vacation days.");
      return;
    }
    if (payload.type === "work") {
      toast.error(
        "Cannot change a leave entry to a work entry from this page.",
      );
      return;
    }
    try {
      await api.updateTimeEntry(id, payload);
      toast.success("Saved");
      setModal(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ─── Group vacation entries by month ────────────────────────────────────────
  const grouped = vacationEntries
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce<Record<string, api.TimeEntry[]>>((acc, e) => {
      const key = e.date.slice(0, 7);
      if (!acc[key]) acc[key] = [];
      acc[key].push(e);
      return acc;
    }, {});

  const toMonthLabel = (key: string) => {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-GB", {
      month: "long",
      year: "numeric",
    });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">Vacation</h1>
        <p className="page-subtitle">
          Track your leave balance · add days from the{" "}
          <span className="text-blue-600 font-medium">Calendar</span>
        </p>
      </div>

      {/* Balance card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-6">
          <Palmtree size={18} className="text-emerald-500" />
          <h2 className="font-semibold text-slate-900">
            Leave balance {new Date().getFullYear()}
          </h2>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Annual quota",
              val: totalDays,
              color: "text-slate-900",
            },
            {
              label: "Used",
              val: usedDays,
              color: "text-amber-600",
            },
            {
              label: "Remaining",
              val: remaining,
              color: remaining < 5 ? "text-red-600" : "text-emerald-600",
            },
            {
              label: "Sick days",
              val: sickEntries.length,
              color: "text-red-500",
            },
          ].map((s) => (
            <div key={s.label}>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>
                {s.val}
              </p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
          <div
            className="bg-amber-400 rounded-full h-2 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">
          Used {Math.round(pct)}% of annual quota · {usedDays} of {totalDays}{" "}
          days
        </p>
      </div>

      {/* Vacation entries list */}
      <div className="card overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-900">Vacation days</h2>
          </div>
          <span className="text-xs text-slate-400">
            {usedDays} day{usedDays !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            Loading…
          </div>
        ) : vacationEntries.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-sm">
            <Palmtree size={32} className="mx-auto mb-3 text-slate-200" />
            <p>No vacation days recorded yet.</p>
            <p className="mt-1 text-xs">
              Add them from the <span className="text-blue-500">Calendar</span>{" "}
              page.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {Object.entries(grouped).map(([monthKey, days]) => (
              <div key={monthKey}>
                {/* Month header */}
                <div className="px-5 py-2 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    {toMonthLabel(monthKey)}
                    <span className="ml-2 font-normal normal-case">
                      · {days.length} day{days.length !== 1 ? "s" : ""}
                    </span>
                  </p>
                </div>

                {/* Days in month */}
                {days.map((e) => {
                  const isPast = e.date < today;
                  const isToday = e.date === today;
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`
                          w-2 h-2 rounded-full flex-shrink-0
                          ${
                            isToday
                              ? "bg-blue-500"
                              : isPast
                                ? "bg-emerald-400"
                                : "bg-amber-400"
                          }
                        `}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {formatDate(e.date)}
                            {isToday && (
                              <span className="ml-2 text-xs text-blue-500 font-semibold">
                                Today
                              </span>
                            )}
                            {!isPast && !isToday && (
                              <span className="ml-2 text-xs text-amber-500 font-semibold">
                                Upcoming
                              </span>
                            )}
                          </p>
                          {e.note && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {e.note}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ entry: e })}
                          className="btn-ghost btn-sm p-1.5 text-slate-400 hover:text-slate-700"
                          title="Edit note"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => deleteEntry(e.id)}
                          className="btn-ghost btn-sm p-1.5 text-slate-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sick days list */}
      {sickEntries.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Sick days</h2>
            <span className="text-xs text-slate-400">
              {sickEntries.length} day{sickEntries.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {sickEntries
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-red-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {formatDate(e.date)}
                      </p>
                      {e.note && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {e.note}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setModal({ entry: e })}
                      className="btn-ghost btn-sm p-1.5 text-slate-400 hover:text-slate-700"
                      title="Edit note"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => deleteEntry(e.id)}
                      className="btn-ghost btn-sm p-1.5 text-slate-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Edit modal — existing entries only, no creation */}
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
