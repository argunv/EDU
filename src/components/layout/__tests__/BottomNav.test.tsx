import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { BottomNav } from '../BottomNav'

describe('BottomNav', () => {
  it('Given teacher role When rendered Then shows today, journal and profile tabs', () => {
    render(
      <MemoryRouter initialEntries={['/teacher/today']}>
        <BottomNav role="teacher" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Сегодня' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Журнал' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Профиль' })).toBeInTheDocument()
  })

  it('Given parent role When rendered Then shows schedule and profile tabs', () => {
    render(
      <MemoryRouter initialEntries={['/me/schedule']}>
        <BottomNav role="parent" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Расписание' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Профиль' })).toBeInTheDocument()
  })
})
