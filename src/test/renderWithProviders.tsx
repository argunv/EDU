import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { AuthContext } from '@/features/auth/AuthContext'
import type { User } from '@/types/user'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

type AuthOverride = {
  user?: User | null
  accessToken?: string | null
  ready?: boolean
  login?: () => Promise<void>
  logout?: () => void
  setUserFromToken?: () => void
}

type RenderOptions = {
  route?: string
  queryClient?: QueryClient
  auth?: AuthOverride
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient()
  const authValue = {
    user: options.auth?.user ?? null,
    accessToken: options.auth?.accessToken ?? null,
    ready: options.auth?.ready ?? true,
    login: options.auth?.login ?? (async () => {}),
    logout: options.auth?.logout ?? (() => {}),
    setUserFromToken: options.auth?.setUserFromToken ?? (() => {}),
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authValue}>
          <MemoryRouter initialEntries={[options.route ?? '/']}>{children}</MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    )
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper }),
  }
}
