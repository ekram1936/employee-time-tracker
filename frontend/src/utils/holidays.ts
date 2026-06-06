// utils/holidays.ts
interface NagerHoliday {
  date: string;
  localName: string;
  global: boolean;
  counties: string[] | null;
}

const cache = new Map<string, Map<string, string>>();

export async function fetchHolidays(
  year: number,
  country: string,
): Promise<Map<string, string>> {
  const key = `${country}-${year}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
    );
    if (!res.ok) throw new Error("Failed");
    const data: NagerHoliday[] = await res.json();
    const map = new Map<string, string>();

    for (const h of data) {
      // ✅ Include ALL holidays (global + regional)
      // global=false just means it's not observed in all regions
      // but we still want to show it
      map.set(h.date, h.localName);
    }

    cache.set(key, map);
    return map;
  } catch {
    return new Map();
  }
}
