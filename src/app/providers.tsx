import { type PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '../features/auth/AuthContext'
import { ChildSelectionProvider } from '../features/student/ChildSelectionProvider'
import { queryClient } from '../lib/queryClient'

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChildSelectionProvider>{children}</ChildSelectionProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
