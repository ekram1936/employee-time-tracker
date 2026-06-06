// ─── Token storage ────────────────────────────────────────────────────────────
const TOKEN_KEY = "tt_access_token";
const tok = {
  get: (): string | null => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {}
  },
  clear: () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
  has: (): boolean => {
    try {
      return !!sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return false;
    }
  },
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  country: string;
  annual_vacation_days: number;
  daily_target_hours: number;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  work_minutes: number;
  note: string;
  type: "work" | "vacation" | "sick";
  created_at: string;
  updated_at: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  department: string;
  position: string;
  country: string;
  annual_vacation_days?: number;
  daily_target_hours?: number;
}

export interface CreateTimeEntryPayload {
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  work_minutes: number;
  note?: string;
  type?: "work" | "vacation" | "sick";
}

// ─── Core request helper ──────────────────────────────────────────────────────
async function req<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = tok.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.detail === "string"
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail.map((d: any) => d.msg ?? d.message).join(", ")
          : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

const get = <T>(p: string) => req<T>("GET", p);
const post = <T>(p: string, b: unknown) => req<T>("POST", p, b);
const put = <T>(p: string, b: unknown) => req<T>("PUT", p, b);
const del = <T>(p: string) => req<T>("DELETE", p);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail ?? `Login failed (${res.status})`);
  if (!data?.access_token)
    throw new Error("No access_token in server response");
  tok.set(data.access_token);
}

export async function register(p: RegisterPayload): Promise<void> {
  const data = await post<{ access_token: string }>("/auth/register", p);
  tok.set(data.access_token);
}

export const logout = () => tok.clear();
export const hasToken = () => tok.has();

// ─── Users ────────────────────────────────────────────────────────────────────
export const getMe = () => get<User>("/users/me");
export const updateMe = (id: string, p: Partial<RegisterPayload>) =>
  put<User>(`/users/${id}`, p);
export const changePassword = (p: {
  current_password: string;
  new_password: string;
}) => post<{ message: string }>("/auth/change-password", p);

// ─── Time entries ─────────────────────────────────────────────────────────────
export const getTimeEntries = (startDate?: string, endDate?: string) => {
  const p = new URLSearchParams();
  if (startDate) p.set("start_date", startDate);
  if (endDate) p.set("end_date", endDate);
  return get<TimeEntry[]>(`/time-entries${p.toString() ? "?" + p : ""}`);
};

export const createTimeEntry = (p: CreateTimeEntryPayload) =>
  post<TimeEntry>("/time-entries", p);

export const updateTimeEntry = (
  id: string,
  p: Partial<CreateTimeEntryPayload>,
) => put<TimeEntry>(`/time-entries/${id}`, p);

export const deleteTimeEntry = (id: string) => del<void>(`/time-entries/${id}`);
