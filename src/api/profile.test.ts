import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import {
  changeMyPassword,
  deleteMyAvatar,
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
} from './profile'
import { server } from '@/test/msw/server'

describe('profile api', () => {
  const rawProfile = {
    id: 'u1',
    name: 'Тест',
    role: 'teacher' as const,
    email: 't@test.com',
    phone: '+79401234567',
    birth_date: '1990-01-15',
    created_at: '2026-01-01T00:00:00Z',
    last_login_at: '2026-03-01T10:00:00Z',
    avatar_url: '/api/media/avatars/u1.webp?v=1',
    assignments: [{ class_name: '5A', subject_name: 'Математика' }],
  }

  it('getMyProfile maps snake_case fields', async () => {
    server.use(http.get('/api/me/profile', () => HttpResponse.json(rawProfile)))

    const profile = await getMyProfile()
    expect(profile.name).toBe('Тест')
    expect(profile.phone).toBe('+79401234567')
    expect(profile.birthDate).toBe('1990-01-15')
    expect(profile.avatarUrl).toBe('/api/media/avatars/u1.webp?v=1')
    expect(profile.assignments?.[0]?.subjectName).toBe('Математика')
  })

  it('updateMyProfile sends snake_case body', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.patch('/api/me/profile', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ ...rawProfile, name: 'Новое имя' })
      }),
    )

    const updated = await updateMyProfile({ name: 'Новое имя', phone: '', birthDate: null })
    expect(body).toEqual({ name: 'Новое имя', phone: '', birth_date: null })
    expect(updated.name).toBe('Новое имя')
  })

  it('changeMyPassword posts credentials', async () => {
    let body: Record<string, string> = {}
    server.use(
      http.post('/api/me/change-password', async ({ request }) => {
        body = (await request.json()) as Record<string, string>
        return HttpResponse.json({ ok: true })
      }),
    )

    await changeMyPassword({ currentPassword: 'old', newPassword: 'newpass123' })
    expect(body).toEqual({ current_password: 'old', new_password: 'newpass123' })
  })

  it('uploadMyAvatar sends multipart file', async () => {
    server.use(
      http.post('/api/me/avatar', () =>
        HttpResponse.json({ ...rawProfile, avatar_url: '/api/media/avatars/u1.webp?v=2' }),
      ),
    )

    const file = new File(['img'], 'avatar.jpg', { type: 'image/jpeg' })
    const profile = await uploadMyAvatar(file)
    expect(profile.avatarUrl).toContain('/api/media/avatars/')
  })

  it('deleteMyAvatar clears avatar url', async () => {
    server.use(
      http.delete('/api/me/avatar', () =>
        HttpResponse.json({ ...rawProfile, avatar_url: null }),
      ),
    )

    const profile = await deleteMyAvatar()
    expect(profile.avatarUrl).toBeUndefined()
  })
})
