import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { server } from '@/test/msw/server'

import { api, configureAuth, mapUserResponse, waitForAuthRefresh } from './client'

const minimalUser = { id: 'u1', name: 'Test', role: 'student' as const }

afterEach(() => {
  configureAuth({
    getToken: () => null,
    setToken: () => {},
    setUser: () => {},
    logout: () => {},
  })
})

describe('api auth interceptors', () => {
  it('calls logout when refresh response has no access token', async () => {
    const logout = vi.fn()
    configureAuth({
      getToken: () => 'expired',
      setToken: vi.fn(),
      setUser: vi.fn(),
      logout,
    })
    server.use(
      http.get('/api/secure', ({ request }) => {
        const auth = request.headers.get('Authorization')
        if (auth === 'Bearer expired') {
          return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
        }
        return HttpResponse.json({ ok: true })
      }),
      http.post('/api/auth/refresh', () => HttpResponse.json({ user: minimalUser })),
    )

    await expect(api.get('/secure')).rejects.toBeDefined()
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('calls logout when access_token is only whitespace', async () => {
    const logout = vi.fn()
    configureAuth({
      getToken: () => 'expired',
      setToken: vi.fn(),
      setUser: vi.fn(),
      logout,
    })
    server.use(
      http.get('/api/secure', ({ request }) => {
        if (request.headers.get('Authorization') === 'Bearer expired') {
          return HttpResponse.json({}, { status: 401 })
        }
        return HttpResponse.json({ ok: true })
      }),
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({ access_token: '   ', user: minimalUser }),
      ),
    )

    await expect(api.get('/secure')).rejects.toBeDefined()
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('retries request after successful refresh', async () => {
    let token = 'expired'
    const setToken = vi.fn((t: string) => {
      token = t
    })
    configureAuth({
      getToken: () => token,
      setToken,
      setUser: vi.fn(),
      logout: vi.fn(),
    })
    server.use(
      http.get('/api/secure', ({ request }) => {
        if (request.headers.get('Authorization') === 'Bearer expired') {
          return HttpResponse.json({}, { status: 401 })
        }
        if (request.headers.get('Authorization') === 'Bearer newtok') {
          return HttpResponse.json({ data: 'ok' })
        }
        return HttpResponse.json({}, { status: 403 })
      }),
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({
          access_token: 'newtok',
          user: minimalUser,
        }),
      ),
    )

    const res = await api.get<{ data: string }>('/secure')
    expect(res.data).toEqual({ data: 'ok' })
    expect(setToken).toHaveBeenCalledWith('newtok')
  })

  it('calls logout when refresh body fails zod parse', async () => {
    const logout = vi.fn()
    configureAuth({
      getToken: () => 'expired',
      setToken: vi.fn(),
      setUser: vi.fn(),
      logout,
    })
    server.use(
      http.get('/api/secure', ({ request }) => {
        if (request.headers.get('Authorization') === 'Bearer expired') {
          return HttpResponse.json({}, { status: 401 })
        }
        return HttpResponse.json({ ok: true })
      }),
      http.post('/api/auth/refresh', () =>
        HttpResponse.json({ access_token: 123 }),
      ),
    )

    await expect(api.get('/secure')).rejects.toBeDefined()
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('does not restore an obsolete session when logout races with refresh', async () => {
    let sessionVersion = 0
    let releaseRefresh = () => {}
    let markRefreshStarted = () => {}
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve
    })
    const setToken = vi.fn()
    const logout = vi.fn()
    configureAuth({
      getToken: () => 'expired',
      setToken,
      setUser: vi.fn(),
      logout,
      getSessionVersion: () => sessionVersion,
    })
    server.use(
      http.get('/api/secure', () => HttpResponse.json({}, { status: 401 })),
      http.post('/api/auth/refresh', async () => {
        markRefreshStarted()
        await refreshGate
        return HttpResponse.json({ access_token: 'obsolete', user: minimalUser })
      }),
    )

    const request = api.get('/secure')
    await refreshStarted
    sessionVersion += 1
    const waiting = waitForAuthRefresh()
    releaseRefresh()

    await waiting
    await expect(request).rejects.toThrow('Auth session changed during refresh')
    expect(setToken).not.toHaveBeenCalled()
    expect(logout).not.toHaveBeenCalled()
  })
})

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
