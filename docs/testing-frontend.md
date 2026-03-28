# Frontend Testing Guide

## Stack

- Runner: `Vitest`
- UI tests: `@testing-library/react` + `@testing-library/jest-dom`
- Environment: `jsdom`
- Network mocking: `MSW` (`src/test/msw`)

## Test Types

- Unit: pure functions, mappers, validators, utility logic.
- Component/integration: user behavior in pages/components with mocked network responses.
- Contract tests: frontend API-layer mapping and error normalization.
- E2E smoke: stage 2 (not included in stage 1 scope).

## Project Conventions

- Place unit tests near source modules: `*.test.ts`.
- Place page integration tests in `src/features/**/__tests__`.
- Reuse shared test helpers from `src/test`:
  - `renderWithProviders`
  - `createTestQueryClient`
  - MSW server lifecycle from `src/test/setup.ts`

## Naming Convention

Use clear Given/When/Then naming:

- `Given valid credentials When submit succeeds Then calls login with trimmed login`
- `Given route loader error When boundary renders Then shows status title`

## Stability Rules

- No `sleep`/hard delays.
- Use `findBy*` or `waitFor` for async UI expectations.
- Keep each test independent and order-agnostic.
- Reset mocks/handlers between tests.

## MSW Pattern

```ts
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'

server.use(
  http.post('/api/auth/login', () =>
    HttpResponse.json({ access_token: 'token', user: { id: 'u1', name: 'A', role: 'admin' } }),
  ),
)
```

## renderWithProviders Pattern

```tsx
import { renderWithProviders } from '@/test/renderWithProviders'

renderWithProviders(<MyPage />, { route: '/admin/users' })
```

## Anti-Patterns

- Asserting internal implementation details instead of user-visible behavior.
- Excessive mocks that hide business behavior.
- Leaving focused tests (`.only`) in committed code.
- Coupled tests relying on side effects from previous tests.

## Coverage and CI Gates

- Global minimums (stage 1):
  - `statements/lines >= 50%`
  - `branches >= 40%`
- Critical modules:
  - `src/features/admin/**` statements >= 70%
  - `src/api/**` statements >= 70%
- CI job `frontend-tests` runs:
  - `npm ci`
  - `npm run test -- --run --coverage`
- Coverage report is uploaded as artifact (`frontend-coverage`).

## Definition of Done Checklist

- [ ] Mandatory scenarios covered (login, admin pages, journal, routing/errors).
- [ ] Tests pass locally and in CI.
- [ ] Coverage thresholds are met.
- [ ] No flaky behavior in repeated CI runs.
- [ ] PR contains a short test report and remaining risks.

## PR Test Report Template

```md
## Frontend test report
- Covered: <scenarios/modules>
- New tests: <count and locations>
- Coverage: <summary numbers>
- Risks left: <known gaps, stage-2 e2e items>
```

## Stage 1 Residual Risks

- No browser E2E smoke yet (planned for stage 2).
- Visual/pixel regression testing is out of stage 1 scope.
