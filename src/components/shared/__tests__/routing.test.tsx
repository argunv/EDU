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
          updateUser: () => {},
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

  it('Given student role When visiting admin-only route Then redirects to schedule home', () => {
    render(
      <AuthContext.Provider
        value={{
          user: { id: 's1', name: 'Student', role: 'student' },
          accessToken: 't',
          ready: true,
          login: async () => {},
          logout: () => {},
          setUserFromToken: () => {},
          updateUser: () => {},
        }}
      >
        <MemoryRouter initialEntries={['/admin/classes']}>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/classes" element={<div>Admin page</div>} />
            </Route>
            <Route path="/me/schedule" element={<div>Student schedule</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(screen.getByText('Student schedule')).toBeInTheDocument()
  })

  it('Given pending role When visiting teacher-only route Then redirects to pending home', () => {
    render(
      <AuthContext.Provider
        value={{
          user: { id: 'p1', name: 'Wait', role: 'pending' },
          accessToken: 't',
          ready: true,
          login: async () => {},
          logout: () => {},
          setUserFromToken: () => {},
          updateUser: () => {},
        }}
      >
        <MemoryRouter initialEntries={['/teacher/today']}>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
              <Route path="/teacher/today" element={<div>Teacher today</div>} />
            </Route>
            <Route path="/pending" element={<div>Pending home</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(screen.getByText('Pending home')).toBeInTheDocument()
  })

  it('Given rejected role When visiting student route Then redirects to login', () => {
    render(
      <AuthContext.Provider
        value={{
          user: { id: 'r1', name: 'Rejected', role: 'rejected' },
          accessToken: 't',
          ready: true,
          login: async () => {},
          logout: () => {},
          setUserFromToken: () => {},
          updateUser: () => {},
        }}
      >
        <MemoryRouter initialEntries={['/me/schedule']}>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['student']} />}>
              <Route path="/me/schedule" element={<div>Student schedule page</div>} />
            </Route>
            <Route path="/auth/login" element={<div>Login page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('Given parent role When visiting admin-only route Then redirects to schedule home', () => {
    render(
      <AuthContext.Provider
        value={{
          user: { id: 'par1', name: 'Parent', role: 'parent' },
          accessToken: 't',
          ready: true,
          login: async () => {},
          logout: () => {},
          setUserFromToken: () => {},
          updateUser: () => {},
        }}
      >
        <MemoryRouter initialEntries={['/admin/classes']}>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/classes" element={<div>Admin classes</div>} />
            </Route>
            <Route path="/me/schedule" element={<div>Parent schedule home</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(screen.getByText('Parent schedule home')).toBeInTheDocument()
  })
})
