const JOURNAL_BLOCK_DAYS = 14

/** Начальный диапазон журнала: последние 14 дней (включительно сегодня). */
export function getInitialJournalRange(): { fromDate: string; toDate: string } {
  const today = new Date()
  const toDate = today.toISOString().slice(0, 10)
  const from = new Date(today)
  from.setDate(from.getDate() - (JOURNAL_BLOCK_DAYS - 1))
  const fromDate = from.toISOString().slice(0, 10)
  return { fromDate, toDate }
}

/** Диапазон для догрузки «ещё блок назад»: от (olderThanDate - blockDays) до (olderThanDate - 1). */
export function getOlderBlockRange(olderThanDate: string): {
  fromDate: string
  toDate: string
} {
  const end = new Date(olderThanDate)
  end.setDate(end.getDate() - 1)
  const toDate = end.toISOString().slice(0, 10)
  const start = new Date(end)
  start.setDate(start.getDate() - (JOURNAL_BLOCK_DAYS - 1))
  const fromDate = start.toISOString().slice(0, 10)
  return { fromDate, toDate }
}
