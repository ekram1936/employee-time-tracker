import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import * as api from "../api/client";
import { minsToHHMM, monthLabel, formatDate } from "../utils/time";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";

export default function Summary() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [entries, setEntries] = useState<api.TimeEntry[]>([]);
  const [freshTarget, setFreshTarget] = useState<number | null>(null);

  const dailyTargetHours = freshTarget ?? user?.daily_target_hours ?? 8;

  // ─── Load entries + fresh user profile ──────────────────────────────────────
  const load = useCallback(async () => {
    const m = String(month + 1).padStart(2, "0");
    const last = new Date(year, month + 1, 0).getDate();
    try {
      const [data, freshUser] = await Promise.all([
        api.getTimeEntries(
          `${year}-${m}-01`,
          `${year}-${m}-${String(last).padStart(2, "0")}`,
        ),
        api.getMe(),
      ]);
      setEntries(data);
      setFreshTarget(freshUser.daily_target_hours);
    } catch {
      toast.error("Failed to load");
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Navigation ─────────────────────────────────────────────────────────────
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

  // ─── Derived data ────────────────────────────────────────────────────────────
  const workEntries = entries.filter((e) => e.type === "work");
  const vacationEntries = entries.filter((e) => e.type === "vacation");
  const sickEntries = entries.filter((e) => e.type === "sick");

  const totalWork = workEntries.reduce((s, e) => s + e.work_minutes, 0);
  const daysWorked = workEntries.length;
  const target = daysWorked * dailyTargetHours * 60;
  const over = totalWork - target;

  // ─── CSV Export ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const userName = (user?.name ?? "user").replace(/\s+/g, "_").toLowerCase();
    const monthNum = String(month + 1).padStart(2, "0");
    const monthName = new Date(year, month, 1)
      .toLocaleString("en-GB", { month: "long" })
      .toLowerCase();
    const fileName = `${userName}_timesheet_${monthName}_${year}.csv`;

    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

    // ── helper ───────────────────────────────────────────────────────────────
    const row = (cols: string[]) => cols.map((c) => `"${c}"`).join(",");
    const blank = () => "";

    const lines: string[] = [];

    // ── Section 1: Employee info ─────────────────────────────────────────────
    lines.push(row(["TIMESHEET REPORT", ""]));
    lines.push(row(["Employee", user?.name ?? "—"]));
    lines.push(row(["Department", user?.department ?? "—"]));
    lines.push(row(["Position", user?.position ?? "—"]));
    lines.push(
      row([
        "Period",
        `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`,
      ]),
    );
    lines.push(
      row([
        "Generated",
        new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
      ]),
    );
    lines.push(blank());

    // ── Section 2: Monthly summary ───────────────────────────────────────────
    lines.push(row(["MONTHLY SUMMARY", ""]));
    lines.push(row(["Days Worked", String(daysWorked)]));
    lines.push(row(["Vacation Days", String(vacationEntries.length)]));
    lines.push(row(["Sick Days", String(sickEntries.length)]));
    lines.push(row(["Daily Target (h)", String(dailyTargetHours)]));
    lines.push(row(["Total Hours Worked", minsToHHMM(totalWork)]));
    lines.push(row(["Target Hours", minsToHHMM(target)]));
    lines.push(
      row([
        over >= 0 ? "Overtime" : "Deficit",
        `${over >= 0 ? "+" : "-"}${minsToHHMM(Math.abs(over))}`,
      ]),
    );
    lines.push(blank());

    // ── Section 3: Day-by-day entries ────────────────────────────────────────
    lines.push(row(["DAILY ENTRIES", ""]));
    lines.push(
      row([
        "Date",
        "Day",
        "Type",
        "Start",
        "End",
        "Break (min)",
        "Worked (hh:mm)",
        "Note",
      ]),
    );

    for (const e of sorted) {
      const dayName = new Date(e.date + "T00:00:00").toLocaleString("en-GB", {
        weekday: "long",
      });
      lines.push(
        row([
          e.date,
          dayName,
          e.type,
          e.start_time || "—",
          e.end_time || "—",
          String(e.break_minutes),
          e.type === "work" ? minsToHHMM(e.work_minutes) : "—",
          e.note || "",
        ]),
      );
    }

    lines.push(blank());

    // ── Section 4: Totals row ────────────────────────────────────────────────
    lines.push(row(["", "", "", "", "", "TOTAL", minsToHHMM(totalWork), ""]));

    // ── Write file ────────────────────────────────────────────────────────────
    const csv = lines.join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title">Summary</h1>
          <p className="page-subtitle">Overview and export</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary gap-2">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3 mb-6">
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Days worked", val: daysWorked },
          { label: "Vacation days", val: vacationEntries.length },
          { label: "Sick days", val: sickEntries.length },
          { label: "Total hours", val: minsToHHMM(totalWork) },
          { label: "Target", val: minsToHHMM(target) },
          {
            label: over >= 0 ? "Overtime" : "Deficit",
            val: `${over >= 0 ? "+" : "-"}${minsToHHMM(Math.abs(over))}`,
          },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="stat-value">{s.val}</p>
            <p className="stat-label">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Entries table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">All entries</h2>
          <span className="text-xs text-slate-400">{entries.length} total</span>
        </div>

        {entries.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-sm">
            No entries for this month.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs font-medium text-slate-400 border-b border-slate-100">
                  {[
                    "Date",
                    "Type",
                    "Start",
                    "End",
                    "Break",
                    "Worked",
                    "Note",
                  ].map((h) => (
                    <th key={h} className="text-left px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...entries]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((e) => (
                    <tr key={e.id} className="table-row">
                      <td className="px-5 py-3 text-sm text-slate-700">
                        {formatDate(e.date)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`
                          inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                          ${
                            e.type === "work"
                              ? "bg-blue-50 text-blue-700"
                              : e.type === "vacation"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                          }
                        `}
                        >
                          {e.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-600">
                        {e.start_time || "—"}
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums text-slate-600">
                        {e.end_time || "—"}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-400">
                        {e.break_minutes ? `${e.break_minutes}m` : "—"}
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-blue-700 tabular-nums">
                        {e.type === "work" ? minsToHHMM(e.work_minutes) : "—"}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-400 max-w-[160px] truncate">
                        {e.note || "—"}
                      </td>
                    </tr>
                  ))}
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold">
                  <td className="px-5 py-3 text-sm text-slate-700" colSpan={2}>
                    Total
                  </td>
                  <td colSpan={3} />
                  <td className="px-5 py-3 text-sm text-blue-700 tabular-nums">
                    {minsToHHMM(totalWork)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
