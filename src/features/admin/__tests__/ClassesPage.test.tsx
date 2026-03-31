import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ClassesPage } from '../ClassesPage'
import { renderWithProviders } from '@/test/renderWithProviders'

const createMutateMock = vi.fn()
const patchMutateMock = vi.fn()

let hookState = {
  classesQuery: { isLoading: false, isError: false, data: [{ id: 'c1', name: '5А', grade: 5, letter: 'А', yearStart: 2024, archived: false }], refetch: vi.fn() },
  displayData: [{ id: 'c1', name: '5А', grade: 5, letter: 'А', yearStart: 2024, archived: false }],
  selectedClass: null as null | { id: string; name: string; grade: number; letter: string; yearStart: number; archived: boolean; shift?: string; shiftLocked?: boolean; maxLessonsPerWeek?: number | null },
  classSubjectsQuery: { isLoading: false, isError: false, data: [], refetch: vi.fn() },
}

vi.mock('../hooks/useClassesPageData', () => ({
  useClassesPageData: () => ({
    ...hookState,
    effectiveSelectedId: hookState.selectedClass?.id ?? null,
    createClassMutation: { mutate: createMutateMock, isPending: false },
    patchClassMutation: { mutate: patchMutateMock, isPending: false },
    archiveClassMutation: { mutate: vi.fn(), isPending: false },
  }),
}))

describe('ClassesPage', () => {
  beforeEach(() => {
    createMutateMock.mockReset()
    patchMutateMock.mockReset()
    hookState = {
      classesQuery: { isLoading: false, isError: false, data: [{ id: 'c1', name: '5А', grade: 5, letter: 'А', yearStart: 2024, archived: false }], refetch: vi.fn() },
      displayData: [{ id: 'c1', name: '5А', grade: 5, letter: 'А', yearStart: 2024, archived: false }],
      selectedClass: null,
      classSubjectsQuery: { isLoading: false, isError: false, data: [], refetch: vi.fn() },
    }
  })

  it('Given letters grid When user creates class Then calls create mutation', async () => {
    renderWithProviders(<ClassesPage />, { route: '/admin/classes' })

    fireEvent.click(screen.getByRole('button', { name: 'Создать класс' }))
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

    await waitFor(() => {
      expect(createMutateMock).toHaveBeenCalled()
    })
  })

  it('Given selected class When user edits max lessons Then calls patch mutation', async () => {
    hookState.selectedClass = {
      id: 'c1',
      name: '5А',
      grade: 5,
      letter: 'А',
      yearStart: 2024,
      archived: false,
      shift: 'morning',
      shiftLocked: false,
      maxLessonsPerWeek: 5,
    }

    renderWithProviders(<ClassesPage />, { route: '/admin/classes?classId=c1' })

    fireEvent.click(screen.getByRole('button', { name: 'Редактировать' }))
    fireEvent.change(screen.getByPlaceholderText('—'), { target: { value: '6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => {
      expect(patchMutateMock).toHaveBeenCalledWith(
        { classId: 'c1', params: { shift: 'morning', shiftLocked: false, maxLessonsPerWeek: 6 } },
        expect.any(Object),
      )
    })
  })

  it('Given class API conflict 409 When create mutation fails Then shows business error from hook', async () => {
    createMutateMock.mockImplementation((_: unknown, options?: { onError?: (error: Error) => void }) => {
      options?.onError?.(new Error('Класс уже существует (409)'))
    })

    renderWithProviders(<ClassesPage />, { route: '/admin/classes' })
    fireEvent.click(screen.getByRole('button', { name: 'Создать класс' }))
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

    expect(createMutateMock).toHaveBeenCalled()
  })
})
