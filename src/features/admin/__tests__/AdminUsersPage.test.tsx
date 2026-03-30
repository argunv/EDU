import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminUsersPage } from '../AdminUsersPage'
import { renderWithProviders } from '@/test/renderWithProviders'

const approveAdminUserMock = vi.fn()
const patchAdminUserRoleMock = vi.fn()
const rejectMutateMock = vi.fn()

const pendingUser = {
  id: 'u1',
  name: 'Петров Петр',
  role: 'pending' as const,
  createdAt: '2026-03-20T10:00:00.000Z',
  email: 'petrov@mail.ru',
}

const allUsers = [
  {
    id: 'u2',
    name: 'Иванова Анна',
    role: 'teacher' as const,
    createdAt: '2026-03-20T10:00:00.000Z',
    email: 'anna@mail.ru',
  },
]

let pendingFiltered = [pendingUser]
let allFiltered = allUsers
let pendingIsError = false

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}))

vi.mock('../hooks/useAdminUsersData', () => ({
  useAdminUsersData: () => ({
    pendingQuery: { isLoading: false, isError: pendingIsError, refetch: vi.fn() },
    allQuery: { isLoading: false, isError: false, refetch: vi.fn() },
    rejectMutation: { mutate: rejectMutateMock },
    classById: {},
    pendingFiltered,
    allFiltered,
  }),
}))

vi.mock('@/api/adminUsers', () => ({
  getAdminAllStudents: vi.fn().mockResolvedValue([]),
  getAdminAllSubjects: vi.fn().mockResolvedValue([]),
  approveAdminUser: (...args: unknown[]) => approveAdminUserMock(...args),
  patchAdminUserRole: (...args: unknown[]) => patchAdminUserRoleMock(...args),
}))

vi.mock('@/api/admin', () => ({
  getAdminClasses: vi.fn().mockResolvedValue([{ id: 'c1', name: '5А' }]),
}))

describe('AdminUsersPage', () => {
  beforeEach(() => {
    approveAdminUserMock.mockReset().mockResolvedValue(undefined)
    patchAdminUserRoleMock.mockReset().mockResolvedValue(undefined)
    rejectMutateMock.mockReset()
    pendingFiltered = [pendingUser]
    allFiltered = allUsers
    pendingIsError = false
  })

  it('Given pending users list When page opens Then renders applications and allows approve', async () => {
    renderWithProviders(<AdminUsersPage />, { queryClient: new QueryClient() })

    expect(screen.getByText('Петров Петр')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Принять' }))
    fireEvent.click(screen.getByRole('button', { name: 'Учитель' }))
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }))

    await waitFor(() => {
      expect(approveAdminUserMock).toHaveBeenCalledWith('u1', { role: 'teacher', classIds: undefined, subjectIds: undefined })
    })
  })

  it('Given all users tab When filter and search applied Then shows matching user', () => {
    const { rerender } = renderWithProviders(<AdminUsersPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Все пользователи' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск по ФИО или email' }), {
      target: { value: 'Анна' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Учитель' }))
    rerender(<AdminUsersPage />)

    expect(screen.getByText('Иванова Анна')).toBeInTheDocument()
  })

  it('Given reject action When user confirms Then calls reject mutation', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    renderWithProviders(<AdminUsersPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Отклонить' }))
    expect(rejectMutateMock).toHaveBeenCalledWith('u1')
  })

  it('Given API error state When pending tab active Then shows error fallback', () => {
    pendingIsError = true
    renderWithProviders(<AdminUsersPage />)

    expect(screen.getByText('Ошибка')).toBeInTheDocument()
  })
})
