const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

/** Абсолютный URL медиафайла с API (аватары, логотипы школы). */
export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://')) return path

  const normalized = path.startsWith('/') ? path : `/${path}`
  if (normalized.startsWith('/api/')) {
    return `${window.location.origin}${normalized}`
  }
  return `${window.location.origin}${API_BASE}${normalized}`
}

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function validateAvatarFile(file: File): string | null {
  const type = file.type.split(';')[0].trim().toLowerCase()
  if (!AVATAR_ALLOWED_TYPES.includes(type as (typeof AVATAR_ALLOWED_TYPES)[number])) {
    return 'Недопустимый формат. Разрешены JPEG, PNG и WebP'
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return 'Файл слишком большой. Максимум 5 МБ'
  }
  if (file.size === 0) {
    return 'Пустой файл'
  }
  return null
}
