import type { JournalGrade } from '../types/journal'

/**
 * Класс для отображения оценки в журнале. Цвета фиксированы и не зависят от темы
 * (задаются в index.css с !important).
 * 5 — зелёный, 4 — светло-зелёный, 3 — оранжевый, 2 — красный, Н/пусто — серый.
 */
export function getGradeClass(grade: JournalGrade): string {
  const n = grade === null || grade === 'Н' ? null : Number(grade)
  if (n === 5) return 'journal-grade-5'
  if (n === 4) return 'journal-grade-4'
  if (n === 3) return 'journal-grade-3'
  if (n === 2) return 'journal-grade-2'
  return 'journal-grade-n'
}

/** Цвет текста для оценки (hex), если нужны инлайн-стили. Предпочтительно использовать getGradeClass. */
export function getGradeColor(grade: JournalGrade): string {
  const n = grade === null || grade === 'Н' ? null : Number(grade)
  if (n === 5) return '#16a34a'
  if (n === 4) return '#84cc16'
  if (n === 3) return '#f59e0b'
  if (n === 2) return '#ef4444'
  return '#6b7280'
}
