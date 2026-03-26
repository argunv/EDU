import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    pool: 'threads',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/api/auth.ts',
        'src/api/client.ts',
        'src/api/contracts.ts',
        'src/features/auth/LoginPage.tsx',
        'src/features/auth/ProtectedRoute.tsx',
        'src/features/admin/AdminSchedulePage.tsx',
        'src/features/admin/AdminUsersPage.tsx',
        'src/features/admin/ClassesPage.tsx',
        'src/features/admin/JournalPage.tsx',
        'src/features/teacher/TeacherJournalPage.tsx',
        'src/features/teacher/journal/JournalTable.tsx',
        'src/components/shared/NotFoundPage.tsx',
        'src/components/shared/RouteErrorBoundary.tsx',
        'src/components/shared/StateWrapper.tsx',
      ],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/test/**',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 50,
        statements: 50,
        branches: 40,
        functions: 50,
        'src/api/{client.ts,contracts.ts}': {
          statements: 67,
        },
        'src/features/admin/{AdminUsersPage.tsx,JournalPage.tsx}': {
          statements: 70,
        },
      },
    },
  },
})
