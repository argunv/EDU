import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TeacherJournalPage } from '../TeacherJournalPage'
import { renderWithProviders } from '@/test/renderWithProviders'

const saveTeacherGradeMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

vi.mock('@/api/teacherJournal', () => ({
  getTeacherJournal: vi.fn().mockResolvedValue({
    classId: 'c1',
    className: '5А',
    subjectId: 's1',
    subject: 'Математика',
    subjects: [],
    dates: ['2026-03-25'],
    students: [{ id: 'st1', name: 'Петров' }],
    grades: { st1: { '2026-03-25': 4 } },
  }),
  saveTeacherGrade: (...args: unknown[]) => saveTeacherGradeMock(...args),
}))

vi.mock('../journal/JournalTable', () => ({
  JournalTable: ({ onSaveGrade }: { onSaveGrade: (studentId: string, date: string, value: number) => Promise<void> }) => (
    <div>
      <button type="button" onClick={() => onSaveGrade('st1', '2026-03-25', 5)}>
        SaveGrade
      </button>
    </div>
  ),
}))

describe('TeacherJournalPage', () => {
  beforeEach(() => {
    saveTeacherGradeMock.mockReset().mockResolvedValue(undefined)
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it('Given journal loaded When grade is saved Then shows success notification', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/teacher/journal/:classId" element={<TeacherJournalPage />} />
      </Routes>,
      { route: '/teacher/journal/c1' },
    )

    fireEvent.click(await screen.findByRole('button', { name: 'SaveGrade' }))
    await waitFor(() => {
      expect(saveTeacherGradeMock).toHaveBeenCalled()
      expect(toastSuccessMock).toHaveBeenCalledWith('Сохранено')
    })
  })

  it('Given save API failure When grade is saved Then shows error notification', async () => {
    saveTeacherGradeMock.mockRejectedValue(new Error('write failed'))
    renderWithProviders(
      <Routes>
        <Route path="/teacher/journal/:classId" element={<TeacherJournalPage />} />
      </Routes>,
      { route: '/teacher/journal/c1' },
    )

    fireEvent.click(await screen.findByRole('button', { name: 'SaveGrade' }))
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Не удалось сохранить')
    })
  })
})
