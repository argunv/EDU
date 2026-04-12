import { formatLocalDateYmd, parseLocalYmdToDate } from './localDate'

const JOURNAL_BLOCK_DAYS = 14

/** Начальный диапазон журнала: последние 14 дней (включительно сегодня), по локальному календарю. */
export function getInitialJournalRange(): { fromDate: string; toDate: string } {
  const today = new Date()
  const toDate = formatLocalDateYmd(today)
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  from.setDate(from.getDate() - (JOURNAL_BLOCK_DAYS - 1))
  const fromDate = formatLocalDateYmd(from)
  return { fromDate, toDate }
}

/**
 * Диапазон для догрузки «ещё блок назад»: от (olderThanDate - blockDays) до (olderThanDate - 1).
 * `olderThanDate` — YYYY-MM-DD в локальном смысле (как с бэкенда).
 */
export function getOlderBlockRange(olderThanDate: string): {
  fromDate: string
  toDate: string
} {
  const anchor = parseLocalYmdToDate(olderThanDate)
  if (!anchor) {
    throw new RangeError(`getOlderBlockRange: invalid date "${olderThanDate}"`)
  }
  const end = new Date(anchor)
  end.setDate(end.getDate() - 1)
  const toDate = formatLocalDateYmd(end)
  const start = new Date(end)
  start.setDate(start.getDate() - (JOURNAL_BLOCK_DAYS - 1))
  const fromDate = formatLocalDateYmd(start)
  return { fromDate, toDate }
}
