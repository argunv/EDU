import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { configureAuth } from '@/api/client'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/msw/server'

import { toast } from 'sonner'

import { LessonPage } from '../LessonPage'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

/** Ответы уроков для MSW: все запросы к `/api/teacher/lessons` должны быть явно замоканы (`onUnhandledRequest: 'error'`). */
function lessonsHandler(rows: Array<Record<string, unknown>>) {
  return http.get('/api/teacher/lessons', () => HttpResponse.json(rows))
}

afterEach(() => {
  configureAuth({
    getToken: () => null,
    setToken: () => {},
    setUser: () => {},
    logout: () => {},
  })
})

describe('LessonPage', () => {
  beforeEach(() => {
    configureAuth({
      getToken: () => 'test-token',
      setToken: () => {},
      setUser: () => {},
      logout: () => {},
    })
  })

  it('Given lesson list When homework edited and saved Then POST grades with homework_text', async () => {
    let posted: Record<string, unknown> | null = null
    server.use(
      lessonsHandler([
        {
          id: 'les-1',
          subject: 'Математика',
          class_id: 'c1',
          class_name: '5А',
          time: '09:00',
          room: '101',
          topic: null,
          homework_text: null,
        },
      ]),
      http.post('/api/teacher/lessons/grades', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ success: true })
      }),
    )

    renderWithProviders(
      <Routes>
        <Route path="/teacher/lesson/:lessonId" element={<LessonPage />} />
      </Routes>,
      { route: '/teacher/lesson/les-1?dayIndex=0&weekOffset=0' },
    )

    expect(await screen.findByText('Математика')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Домашнее задание (опционально)'), {
      target: { value: 'Упражнение 12' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => {
      expect(posted).not.toBeNull()
      expect(posted?.lesson_id).toBe('les-1')
      expect(posted?.homework_text).toBe('Упражнение 12')
      expect(posted?.entries).toEqual([])
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Сохранено')
    })
  })

  it('Given dirty topic When save fails Then shows error toast', async () => {
    server.use(
      lessonsHandler([
        {
          id: 'les-2',
          subject: 'Физика',
          class_id: 'c1',
          class_name: '6Б',
          time: '10:00',
          room: '202',
          topic: null,
          homework_text: null,
        },
      ]),
      http.post('/api/teacher/lessons/grades', () => HttpResponse.json({ detail: 'err' }, { status: 500 })),
    )

    renderWithProviders(
      <Routes>
        <Route path="/teacher/lesson/:lessonId" element={<LessonPage />} />
      </Routes>,
      { route: '/teacher/lesson/les-2' },
    )

    expect(await screen.findByText('Физика')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Тема урока (опционально)'), {
      target: { value: 'Законы Ньютона' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Ошибка сохранения')
    })
  })

  it('Given clean form When page loaded Then save button shows saved state', async () => {
    server.use(
      lessonsHandler([
        {
          id: 'les-3',
          subject: 'История',
          class_id: 'c1',
          class_name: '7В',
          time: '11:00',
          topic: 'Урок 1',
          homework_text: 'Читать п. 2',
        },
      ]),
    )

    renderWithProviders(
      <Routes>
        <Route path="/teacher/lesson/:lessonId" element={<LessonPage />} />
      </Routes>,
      { route: '/teacher/lesson/les-3' },
    )

    expect(await screen.findByText('История')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сохранено' })).toBeDisabled()
  })

  it('Given lessons request fails When page loads Then shows list error and retry', async () => {
    server.use(http.get('/api/teacher/lessons', () => HttpResponse.json({ detail: 'err' }, { status: 500 })))

    renderWithProviders(
      <Routes>
        <Route path="/teacher/lesson/:lessonId" element={<LessonPage />} />
      </Routes>,
      { route: '/teacher/lesson/les-1' },
    )

    expect(await screen.findByText(/Не удалось загрузить уроки/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument()
  })

  it('Given empty lessons When lesson id missing from day Then shows not found hint', async () => {
    server.use(lessonsHandler([]))

    renderWithProviders(
      <Routes>
        <Route path="/teacher/lesson/:lessonId" element={<LessonPage />} />
      </Routes>,
      { route: '/teacher/lesson/les-missing' },
    )

    expect(await screen.findByText(/Урок не найден в выбранном дне/)).toBeInTheDocument()
  })
})
