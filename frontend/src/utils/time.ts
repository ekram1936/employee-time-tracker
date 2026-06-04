export const todayStr   = () => new Date().toISOString().slice(0, 10)
export const nowTimeStr = () => {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}
export const minsToHHMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function calcWorkMinutes(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const total    = (eh * 60 + em) - (sh * 60 + sm)
  const breakMin = total > 360 ? 30 : 0
  return { work: Math.max(0, total - breakMin), breakMin }
}

export const formatDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

export const formatDateShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export const monthLabel = (y: number, m: number) =>
  new Date(y, m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

export const isWeekend = (d: string) => {
  const dow = new Date(d + 'T00:00:00').getDay()
  return dow === 0 || dow === 6
}