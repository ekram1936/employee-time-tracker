import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { TimeEntry, CreateTimeEntryPayload } from "../api/client";
import { calcWorkMinutes, todayStr } from "../utils/time";

interface Props {
  entry?: TimeEntry | null;
  defaultDate?: string;
  onSave: (payload: CreateTimeEntryPayload, id?: string) => Promise<void>;
  onClose: () => void;
}

export default function EntryModal({
  entry,
  defaultDate,
  onSave,
  onClose,
}: Props) {
  const [form, setForm] = useState({
    date: entry?.date ?? defaultDate ?? todayStr(),
    start_time: entry?.start_time ?? "09:00",
    end_time: entry?.end_time ?? "17:00",
    break_minutes: entry?.break_minutes ?? 30,
    note: entry?.note ?? "",
    type: (entry?.type ?? "work") as "work" | "vacation" | "sick",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ─── Derived calculations ─────────────────────────────────────────────────
  const { work } = calcWorkMinutes(form.start_time, form.end_time);
  const breakMinutes = Number(form.break_minutes || 0);

  // Invalid range: end time is not after start time
  const isInvalidTimeRange = form.type === "work" && work <= 0;

  // Raw net before enforcing minimum break
  const net = Math.max(0, work - breakMinutes);

  // Minimum required break based on total span
  // span > 10h → 60m required | span > 8h → 30m required | else → 0
  const minRequiredBreak = work > 600 ? 60 : work > 480 ? 30 : 0;

  const enforcedBreakMinutes = Math.max(breakMinutes, minRequiredBreak);
  const NEED_AUTOBREAK = enforcedBreakMinutes > breakMinutes;

  // Final net after enforced break — this is what gets saved
  const enforcedNet = Math.max(0, work - enforcedBreakMinutes);

  // Over limit: enforcedNet still exceeds 10h (span > 11h with 60m break = 660+ mins)
  const isOverLimit =
    form.type === "work" && !isInvalidTimeRange && enforcedNet > 600;

  // Break longer than or equal to the total span
  const isBreakTooLong =
    form.type === "work" && work > 0 && breakMinutes >= work;

  const canSubmit =
    !saving && !isOverLimit && !isInvalidTimeRange && !isBreakTooLong;

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isInvalidTimeRange) {
      toast.error("End time must be after start time.");
      return;
    }
    if (isBreakTooLong) {
      toast.error("Break cannot be longer than the total work span.");
      return;
    }
    if (form.type === "work" && enforcedNet > 600) {
      toast.error(
        "Net work must be ≤ 10:00 h. Shorten your end time or increase the break.",
      );
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          date: form.date,
          start_time: form.type === "work" ? form.start_time : "",
          end_time: form.type === "work" ? form.end_time : "",
          break_minutes: form.type === "work" ? enforcedBreakMinutes : 0,
          work_minutes: form.type === "work" ? enforcedNet : 0,
          note: form.note,
          type: form.type,
        },
        entry?.id,
      );
    } finally {
      setSaving(false);
    }
  };

  // ─── Escape to close ──────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            {entry ? "Edit Entry" : "Add Entry"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Date + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input
                className="input"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) =>
                  set("type", e.target.value as "work" | "vacation" | "sick")
                }
              >
                <option value="work">Work</option>
                <option value="vacation">Vacation</option>
                <option value="sick">Sick</option>
              </select>
            </div>
          </div>

          {/* Work-only fields */}
          {form.type === "work" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start time</label>
                  <input
                    className="input"
                    type="time"
                    value={form.start_time}
                    onChange={(e) => set("start_time", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">End time</label>
                  <input
                    className="input"
                    type="time"
                    value={form.end_time}
                    onChange={(e) => set("end_time", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Invalid time range error */}
              {isInvalidTimeRange && (
                <p className="text-xs text-red-600 font-medium bg-red-50 px-3 py-2 rounded-xl">
                  ⛔ End time must be after start time.
                </p>
              )}

              <div>
                <label className="label">Break (minutes)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={180}
                  value={form.break_minutes}
                  onChange={(e) => set("break_minutes", e.target.value)}
                />
              </div>

              {/* Break too long error */}
              {isBreakTooLong && (
                <p className="text-xs text-red-600 font-medium bg-red-50 px-3 py-2 rounded-xl">
                  ⛔ Break cannot be longer than the total work span.
                </p>
              )}

              {/* Net preview OR over-limit error — never both */}
              {!isInvalidTimeRange &&
                work > 0 &&
                (isOverLimit ? (
                  <p className="text-xs text-red-600 font-medium bg-red-50 px-3 py-2 rounded-xl">
                    ⛔ Net work exceeds 10:00 h. Shorten your end time or
                    increase the break.
                  </p>
                ) : (
                  !isBreakTooLong &&
                  enforcedNet > 0 && (
                    <p className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-2 rounded-xl">
                      Net work:{" "}
                      {String(Math.floor(enforcedNet / 60)).padStart(2, "0")}:
                      {String(enforcedNet % 60).padStart(2, "0")} h
                      {NEED_AUTOBREAK &&
                        ` · auto break enforced: ${enforcedBreakMinutes}m`}
                    </p>
                  )
                ))}
            </>
          )}

          {/* Vacation / sick note */}
          {form.type !== "work" && (
            <p className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl">
              Marking this day as {form.type}. No work hours will be added.
            </p>
          )}

          {/* Note */}
          <div>
            <label className="label">Note (optional)</label>
            <input
              className="input"
              placeholder="Home office, client meeting…"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>

          {/* Actions */}
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
              disabled={!canSubmit}
              className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="spinner" />
              ) : entry ? (
                "Update"
              ) : (
                "Add entry"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
