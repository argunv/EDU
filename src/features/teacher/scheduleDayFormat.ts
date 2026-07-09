/** День недели и дата выбранного учебного дня (как в сетке Пн–Пт). Время — только если это сегодня. */
export function formatSelectedScheduleDay(
  weekStart: Date,
  dayIndex: number,
  now: Date = new Date(),
): string {
  const d = new Date(weekStart)
  d.setDate(weekStart.getDate() + dayIndex)
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (isToday) {
    d.setHours(now.getHours(), now.getMinutes(), 0, 0)
  }
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(isToday ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
  const value = formatter.format(d)
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function isSelectedScheduleDayToday(
  weekStart: Date,
  dayIndex: number,
  now: Date,
): boolean {
  const d = new Date(weekStart)
  d.setDate(weekStart.getDate() + dayIndex)
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}
