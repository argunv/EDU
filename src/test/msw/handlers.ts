import { http, HttpResponse } from 'msw'

/**
 * Базовые ответы без сети: неаутентифицированная сессия.
 * Остальное (`/api/teacher/*`, `/api/me/*`, …) — через `server.use` в конкретных тестах,
 * иначе `onUnhandledRequest: 'error'` в `src/test/setup.ts` поймает расхождение с клиентом.
 */
export const handlers = [
  http.get('/api/auth/me', () => HttpResponse.json({}, { status: 401 })),
  http.post('/api/auth/refresh', () => HttpResponse.json({}, { status: 401 })),
]
