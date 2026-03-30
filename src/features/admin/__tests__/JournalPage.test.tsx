import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { JournalPage } from '../JournalPage'
import { renderWithProviders } from '@/test/renderWithProviders'

vi.mock('@/api/admin', () => ({
  getAdminClasses: vi.fn().mockResolvedValue([{ id: 'c1', name: '5А' }]),
  getAdminClassSubjects: vi.fn().mockResolvedValue([{ id: 's1', name: 'Математика', teachers: ['Иванов'] }]),
  getAdminJournal: vi.fn().mockResolvedValue({
    lessonMeta: { title: 'Математика', lastUpdated: '2026-03-27' },
    dates: ['2026-03-25'],
    students: [{ id: 'st1', name: 'Петров', grades: [5], absences: 0 }],
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ classId: 'c1', subjectId: 's1' }),
  }
})

describe('JournalPage', () => {
  it('Given class+subject route When data loads Then renders journal title and student', async () => {
    renderWithProviders(<JournalPage />)

    expect(await screen.findByText('Журнал 5А класса')).toBeInTheDocument()
    const studentNames = await screen.findAllByText('Петров')
    expect(studentNames.length).toBeGreaterThan(0)
  })
})
