import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { apiLogin, apiMe } from './auth'
import { server } from '@/test/msw/server'

describe('auth api contracts', () => {
  it('Given valid login response When apiLogin is called Then maps payload to frontend model', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({
          access_token: 'token-1',
          user: { id: 'u1', name: 'Admin', role: 'admin', class_name: null, parent_names: null },
        }),
      ),
    )

    const result = await apiLogin({ login: 'admin@example.com', password: 'secret' })
    expect(result.accessToken).toBe('token-1')
    expect(result.user.role).toBe('admin')
    expect(result.user.className).toBeUndefined()
  })

  it('Given malformed login payload When apiLogin is called Then throws mapping error', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({
          access_token: 'token-2',
          user: { id: 'u1', role: 'admin' },
        }),
      ),
    )

    await expect(apiLogin({ login: 'admin@example.com', password: 'secret' })).rejects.toThrow(
      'Invalid user payload in auth response',
    )
  })

  it('Given auth/me returns 401 When apiMe is called Then returns null session', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({}, { status: 401 })))

    await expect(apiMe()).resolves.toBeNull()
  })

  it('Given network failure When apiMe is called Then returns null without crashing', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.error()))

    await expect(apiMe()).resolves.toBeNull()
  })
})
