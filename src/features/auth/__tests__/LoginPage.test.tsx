import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginPage } from '../LoginPage'

const navigateMock = vi.fn()
const loginMock = vi.fn()
let authUser: { id: string; name: string; role: 'pending' | 'rejected' } | null = null

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../useAuth', () => ({
  useAuth: () => ({
    user: authUser,
    login: loginMock,
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    loginMock.mockReset()
    authUser = null
  })

  it('Given valid credentials When submit succeeds Then calls login with trimmed login', async () => {
    loginMock.mockResolvedValue(undefined)

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Логин (email)'), {
      target: { value: '  admin@example.com  ' },
    })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({ login: 'admin@example.com', password: 'secret' })
    })
  })

  it('Given rejected password When submit fails Then shows user-visible error', async () => {
    loginMock.mockRejectedValue(new Error('Неверный логин или пароль'))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Логин (email)'), {
      target: { value: 'student@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'bad-pass' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный логин или пароль')
  })

  it('Given pending user session When component mounts Then redirects to pending page', async () => {
    authUser = { id: 'u1', name: 'P', role: 'pending' }

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/pending', { replace: true })
    })
  })
})
