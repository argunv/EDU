export function getInitials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.match(/[\p{L}\p{N}]+/gu) ?? []
  if (parts.length === 0) return '?'
  const initial = (value: string | undefined): string =>
    value ? (Array.from(value)[0]?.toUpperCase() ?? '') : ''
  if (parts.length === 1) return initial(parts[0]) || '?'
  const [lastName, firstName] = parts
  return `${initial(lastName)}${initial(firstName)}` || '?'
}
