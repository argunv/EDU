import { describe, expect, it } from 'vitest'

import {
  AVATAR_MAX_BYTES,
  resolveMediaUrl,
  validateAvatarFile,
} from './mediaUrl'

describe('mediaUrl', () => {
  it('resolveMediaUrl returns undefined for empty path', () => {
    expect(resolveMediaUrl(null)).toBeUndefined()
    expect(resolveMediaUrl(undefined)).toBeUndefined()
  })

  it('resolveMediaUrl builds absolute URL for /api/media paths', () => {
    const url = resolveMediaUrl('/api/media/avatars/u1.webp?v=1')
    expect(url).toBe(`${window.location.origin}/api/media/avatars/u1.webp?v=1`)
  })

  it('validateAvatarFile rejects unsupported mime type', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    expect(validateAvatarFile(file)).toMatch(/формат/i)
  })

  it('validateAvatarFile rejects oversized file', () => {
    const big = new Uint8Array(AVATAR_MAX_BYTES + 1)
    const file = new File([big], 'big.png', { type: 'image/png' })
    expect(validateAvatarFile(file)).toMatch(/большой/i)
  })

  it('validateAvatarFile accepts valid png', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'ok.png', { type: 'image/png' })
    expect(validateAvatarFile(file)).toBeNull()
  })
})
