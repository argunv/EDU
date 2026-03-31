import { render, screen } from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { NotFoundPage } from '../NotFoundPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { AuthContext } from '@/features/auth/AuthContext'

describe('routing and boundaries', () => {
  it('Given unknown path view When rendering NotFoundPage Then shows 404 and return link', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Вернуться' })).toHaveAttribute('href', '/')
  })

  it('Given route loader error When boundary renders Then shows status title', async () => {
    const { RouteErrorBoundary } = await import('../RouteErrorBoundary')
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <div>root</div>,
          errorElement: <RouteErrorBoundary />,
          loader: () => {
            throw new Response('Ошибка сервера', { status: 500, statusText: 'Internal Server Error' })
          },
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)
    expect(await screen.findByText('500 Internal Server Error')).toBeInTheDocument()
  })

  it('Given unauthorized role When protected route is visited Then redirects to role home', () => {
    render(
      <AuthContext.Provider
        value={{
          user: { id: 'u1', name: 'Teacher', role: 'teacher' },
          accessToken: 't',
          ready: true,
          login: async () => {},
          logout: () => {},
          setUserFromToken: () => {},
        }}
      >
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<div>Admin page</div>} />
            </Route>
            <Route path="/teacher/today" element={<div>Teacher home</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(screen.getByText('Teacher home')).toBeInTheDocument()
  })
})
