import { http, HttpResponse } from 'msw'

export const handlers = [
  // Default handlers keep tests deterministic and force explicit overrides only where needed.
  http.get('/api/auth/me', () => HttpResponse.json({}, { status: 401 })),
  http.post('/api/auth/refresh', () => HttpResponse.json({}, { status: 401 })),
]
