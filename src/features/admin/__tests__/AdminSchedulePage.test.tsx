import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminSchedulePage } from '../AdminSchedulePage'
import { renderWithProviders } from '@/test/renderWithProviders'

let currentRole: 'admin' | 'teacher' = 'admin'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'User', role: currentRole } }),
}))

vi.mock('@/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/admin')>()
  return {
    ...actual,
    getAdminClasses: vi.fn().mockResolvedValue([{ id: 'c1', name: '5А', shift: 'morning', shiftLocked: false }]),
    getAdminSchoolSettings: vi.fn().mockResolvedValue({ isTwoShift: true, classShiftRules: {} }),
    getAdminScheduleWeek: vi.fn().mockResolvedValue([]),
    saveAdminScheduleChanges: vi.fn(),
  }
})

vi.mock('../schedule/ScheduleGridDesktop', () => ({
  ScheduleGridDesktop: () => <div>DesktopGrid</div>,
}))

vi.mock('../schedule/ScheduleGridMobile', () => ({
  ScheduleGridMobile: () => <div>MobileGrid</div>,
}))

vi.mock('../schedule/ScheduleEditModal', () => ({
  ScheduleEditModal: () => null,
}))

vi.mock('../schedule/ScheduleSaveBar', () => ({
  ScheduleSaveBar: () => null,
}))

describe('AdminSchedulePage', () => {
  beforeEach(() => {
    currentRole = 'admin'
  })

  it('Given admin role When page loads Then shows schedule editing guidance', async () => {
    renderWithProviders(<AdminSchedulePage />, { route: '/admin/schedule?classId=c1' })
    expect(await screen.findByText('Нажмите на ячейку, чтобы назначить или изменить урок.')).toBeInTheDocument()
  })

  it('Given non-admin role When page opens Then shows restricted access message', async () => {
    currentRole = 'teacher'
    renderWithProviders(<AdminSchedulePage />, { route: '/admin/schedule?classId=c1' })
    expect(await screen.findByText('Страница расписания доступна только администратору.')).toBeInTheDocument()
  })
})
