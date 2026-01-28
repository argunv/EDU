import type { ProgressGrade } from '../types/progress'

export function getAverageFromGrades(grades: ProgressGrade[]): number | null {
  const numeric = grades
    .filter((g) => g !== 'Н' && g != null)
    .map((g) => (typeof g === 'number' ? g : Number(g)))
    .filter((n) => !Number.isNaN(n))

  if (numeric.length === 0) return null

  const sum = numeric.reduce<number>((acc, grade) => acc + grade, 0)
  return Math.round((sum / numeric.length) * 10) / 10
}

