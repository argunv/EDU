import { describe, expect, it } from 'vitest'

import { mapUserResponse } from './client'

describe('mapUserResponse', () => {
  it('maps snake_case payload to frontend user shape', () => {
    const result = mapUserResponse({
      access_token: 'token',
      user: {
        id: 'u1',
        name: 'User',
        role: 'student',
        email: 'u@test.dev',
        class_name: '5A',
      },
    })

    expect(result.accessToken).toBe('token')
    expect(result.user.className).toBe('5A')
    expect(result.user.role).toBe('student')
  })

  it('accepts nullable class_name and parent_names', () => {
    const result = mapUserResponse({
      access_token: 'token',
      user: {
        id: 'u2',
        name: 'Admin',
        role: 'admin',
        email: 'admin@test.dev',
        class_name: null as unknown as string,
        parent_names: null as unknown as string[],
      },
    })

    expect(result.accessToken).toBe('token')
    expect(result.user.className).toBeUndefined()
    expect(result.user.parentNames).toBeUndefined()
  })

  it('throws on invalid payload', () => {
    expect(() => mapUserResponse({ access_token: 'token' })).toThrow()
  })
})
