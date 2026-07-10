import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChildSelector } from '../ChildSelector'
import { ChildSelectionContext } from '../childSelectionContext'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'p1', name: 'Parent', role: 'parent' } }),
}))

const children = [
  { id: 'c1', name: 'Аня', className: '3Б', avatarUrl: '/api/media/avatars/c1.webp?v=1' },
  { id: 'c2', name: 'Пётр', className: '5А' },
]

function renderPicker(childId = 'c1') {
  const setChildId = vi.fn()
  render(
    <ChildSelectionContext.Provider
      value={{
        childId,
        setChildId,
        children,
        isChildrenLoading: false,
        isChildrenError: false,
      }}
    >
      <ChildSelector />
    </ChildSelectionContext.Provider>,
  )
  return { setChildId }
}

describe('ChildSelector', () => {
  it('renders children with avatars and class names', () => {
    renderPicker()
    expect(screen.getByText('Аня')).toBeInTheDocument()
    expect(screen.getByText('3Б')).toBeInTheDocument()
    expect(screen.getByText('Пётр')).toBeInTheDocument()
    expect(screen.getByAltText('Аватар: Аня')).toBeInTheDocument()
  })

  it('calls setChildId when another child is selected', () => {
    const { setChildId } = renderPicker('c1')
    fireEvent.click(screen.getByRole('button', { name: /Пётр/i }))
    expect(setChildId).toHaveBeenCalledWith('c2')
  })
})
