/**
 * Локальный календарный день в формате YYYY-MM-DD.
 * Не использовать `toISOString().split('T')[0]` — там UTC, в восточных поясах сдвигается день.
 */
export function formatLocalDateYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Разбор YYYY-MM-DD в локальную полночь календарного дня (не UTC, в отличие от `new Date("YYYY-MM-DD")`).
 * Невалидные строки или несуществующие даты → `null`.
 */
export function parseLocalYmdToDate(ymd: string): Date | null {
  const match = YMD_RE.exec(ymd.trim())
  if (!match) return null
  const y = Number(match[1])
  const month = Number(match[2])
  const d = Number(match[3])
  if (!Number.isInteger(y) || !Number.isInteger(month) || !Number.isInteger(d)) return null
  const dt = new Date(y, month - 1, d)
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== d
  ) {
    return null
  }
  return dt
}
