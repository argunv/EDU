export function getInitials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  const [lastName, firstName] = parts
  return `${(lastName[0] ?? '').toUpperCase()}${(firstName[0] ?? '').toUpperCase()}`
}
