# Testing Guide

## Environment Setup
- Package manager: npm
- Required env vars: `DATABASE_URL` (PostgreSQL via Neon), `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`
- Database: PostgreSQL via Neon (managed). Run `npx prisma db push` for schema sync.
- Services: none (Neon Auth is external)

## Running Tests

### Unit Tests
Command: `npm run test:run`
Watch mode: `npm test`
Location: `src/**/__tests__/*.test.ts`
Framework: Vitest with jsdom

### Integration Tests
Command: `npm run test:run`
Location: `src/**/__tests__/*.test.ts` (same runner, mock fetch for API tests)

### E2E Tests (Playwright)
Command: `npx playwright test`
Setup: `npx playwright install chromium`
Base URL: `http://localhost:3000`
Location: `tests/e2e/`
Framework: @playwright/test with Chromium

## Debugging Failed Tests
- Single test: `npx vitest run src/path/to/test.test.ts`
- Filter by name: `npx vitest run -t "test name pattern"`
- Headed browser (Playwright): `npx playwright test --headed`
- Traces (Playwright): `npx playwright show-trace test-results/*/trace.zip`

## Test Patterns
- Zustand stores are tested directly via `useStore.getState()` — no React rendering needed
- Pure helper functions get their own `__tests__/` directory co-located with the source
- Mock `fetch` with `vi.stubGlobal("fetch", vi.fn())` and `vi.unstubAllGlobals()` in afterEach
- localStorage requires the polyfill in `src/test-setup.ts` (Node.js 25+ compatibility)
