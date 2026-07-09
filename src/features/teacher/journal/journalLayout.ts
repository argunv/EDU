const DATE_COLUMN_MIN_WIDTH_PX = 56
const AVERAGE_COLUMN_WIDTH_PX = 56

export function getFillerColumnCount(
  containerWidth: number,
  nameColumnWidthPx: number,
  dateColumnCount: number,
  isFewDates: boolean,
): number {
  if (containerWidth <= 0 || isFewDates) return 0
  const contentWidth =
    nameColumnWidthPx +
    dateColumnCount * DATE_COLUMN_MIN_WIDTH_PX +
    AVERAGE_COLUMN_WIDTH_PX
  const remaining = containerWidth - contentWidth
  if (remaining < DATE_COLUMN_MIN_WIDTH_PX) return 0
  return Math.ceil(remaining / DATE_COLUMN_MIN_WIDTH_PX)
}
