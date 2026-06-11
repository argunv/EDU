import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { getMyChildren, getMyHomework, getMyProgress, getMySchedule } from './me'
import { server } from '@/test/msw/server'

describe('me api', () => {
  it('Given /me/children payload When getMyChildren Then maps snake_case fields', async () => {
    server.use(
      http.get('/api/me/children', () =>
        HttpResponse.json([{ id: 'c1', name: 'Аня', class_name: '3Б' }]),
      ),
    )

    const rows = await getMyChildren()
    expect(rows).toEqual([{ id: 'c1', name: 'Аня', className: '3Б' }])
  })

  it('Given /me/schedule with query params When getMySchedule Then requests view and child_id', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/me/schedule', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      }),
    )

    await getMySchedule('week', 'child-1', '2026-01-06')
    const u = new URL(capturedUrl)
    expect(u.searchParams.get('view')).toBe('week')
    expect(u.searchParams.get('child_id')).toBe('child-1')
    expect(u.searchParams.get('week_start_iso')).toBe('2026-01-06')
  })

  it('Given /me/homework When getMyHomework Then forwards range and optional child', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/me/homework', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([
          { id: 'h1', due_date_label: 'завтра', subject: 'Математика', text: 'стр. 5' },
        ])
      }),
    )

    const items = await getMyHomework('today', 'child-2')
    const u = new URL(capturedUrl)
    expect(u.searchParams.get('range')).toBe('today')
    expect(u.searchParams.get('child_id')).toBe('child-2')
    expect(items[0]?.dueDateLabel).toBe('завтра')
    expect(items[0]?.text).toBe('стр. 5')
  })

  it('Given odd grade strings When getMyProgress Then normalizes to Н or 0–5', async () => {
    server.use(
      http.get('/api/me/progress', () =>
        HttpResponse.json([
          {
            subject: 'Русский',
            teacher_name: 'Иванова',
            grades: ['Н', '4.6', '99', null],
            grade_dates: ['2026-01-01'],
            absences_count: 1,
          },
        ]),
      ),
    )

    const progress = await getMyProgress(undefined, 2025, 1)
    expect(progress[0]?.grades).toEqual(['Н', 5, 'Н', 'Н'])
    expect(progress[0]?.absencesCount).toBe(1)
  })
})
