import { render, screen, waitFor } from '@testing-library/react'
import { Suspense, lazy } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AdminLayout } from '../AdminLayout'

vi.mock('../ClassesPage', () => ({ ClassesPage: () => <div>Classes stub</div> }))
vi.mock('../JournalPage', () => ({ JournalPage: () => <div>Journal stub</div> }))

const LazyClassesPage = lazy(() => import('../ClassesPage').then((m) => ({ default: m.ClassesPage })))
const LazyJournalPage = lazy(() => import('../JournalPage').then((m) => ({ default: m.JournalPage })))

function createAdminRouter(initialEntry: string) {
  return createMemoryRouter(
    [
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          { path: 'classes', element: <LazyClassesPage /> },
          { path: 'journal/:classId/:subjectId', element: <LazyJournalPage /> },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  )
}

describe('admin routing', () => {
  it('Given classes route When navigating to journal Then outlet switches page', async () => {
    const router = createAdminRouter('/admin/classes')

    render(
      <Suspense fallback={<div>Root loading</div>}>
        <RouterProvider router={router} />
      </Suspense>,
    )

    expect(await screen.findByText('Classes stub')).toBeInTheDocument()

    await router.navigate('/admin/journal/c1/s1')

    await waitFor(() => {
      expect(screen.getByText('Journal stub')).toBeInTheDocument()
    })
    expect(screen.queryByText('Classes stub')).not.toBeInTheDocument()
  })
})
