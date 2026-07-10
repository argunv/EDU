export function getProfileValue(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) return 'Не указано'
  return value
}

export { getInitials } from '../../lib/userDisplay'

export function formatProfileDate(iso: string | undefined | null): string {
  if (!iso) return 'Не указано'
  const datePart = iso.slice(0, 10)
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return 'Не указано'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  teacher: 'Учитель',
  student: 'Ученик',
  parent: 'Родитель',
}

export function getCurrentYearStart(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= 9 ? year : year - 1
}

export function getCurrentSemester(): 1 | 2 {
  const now = new Date()
  const month = now.getMonth() + 1
  if (month >= 9 || month === 1) return 1
  return 2
}
