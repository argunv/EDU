import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UserAvatar } from '@/components/shared/UserAvatar'

describe('UserAvatar', () => {
  it('renders initials when no avatar url', () => {
    render(<UserAvatar name="Иванов Петр" />)
    expect(screen.getByText('ИП')).toBeInTheDocument()
  })

  it('renders image when avatar url is provided', () => {
    render(
      <UserAvatar
        name="Иванов Петр"
        avatarUrl="/api/media/avatars/u1.webp?v=1"
      />,
    )
    const img = screen.getByRole('img', { name: 'Аватар: Иванов Петр' })
    expect(img).toHaveAttribute('src', `${window.location.origin}/api/media/avatars/u1.webp?v=1`)
  })
})
