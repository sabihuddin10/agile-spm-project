# Coding Standards

## Overview

Follow the patterns already established in each workspace package. Changes should be narrowly scoped, behavior-focused, and verified by the repository's CI-equivalent commands.

## Formatting and Style

- Preserve the surrounding file's established JavaScript, TypeScript, JSX, and CSS style.
- Use two-space indentation, semicolons, and single quotes in JavaScript and TypeScript unless an existing file consistently requires otherwise.
- Keep imports at the top of the module and use ES module syntax.
- Prefer small pure helpers for calculations and validation; keep route handlers and React components readable.
- Comment constraints, rationale, or non-obvious business rules rather than restating the code.
- Do not add commented-out code, generated build output, secrets, or real environment files.

There is no repository-wide formatter command. Avoid mechanical reformatting of unrelated lines.

## Linting and Type Safety

- Frontend code must pass Next.js `core-web-vitals` ESLint rules and TypeScript strict mode.
- Do not introduce `any` when a concrete type or `unknown` plus validation is appropriate.
- Server JavaScript must pass the repository syntax-check script.
- Treat lint, type-check, and build failures as blocking rather than warnings.

## Naming Conventions

- Variables and functions: `camelCase`.
- React components and TypeScript types: `PascalCase`.
- Constants shared as fixed configuration: `UPPER_SNAKE_CASE` where that matches the surrounding module.
- React hooks: `use` followed by a descriptive camel-case name.
- Source files and route/component folders: lowercase kebab-case, matching the existing tree.
- Test files: `<module>.test.js`, `<module>.test.ts`, or `<module>.test.tsx` beside the mirrored module area.
- Boolean names should communicate the predicate with `is`, `has`, `can`, or `should` where practical.

## File and Folder Organization

- `server/src/routes/`: one Express router per business module.
- `server/src/lib/`: reusable domain calculations, validation, authorization support, and API catalog logic.
- `server/src/data/`: in-memory state, snapshots, persistence, and relational adapters.
- `server/test/`: mirror the server source areas with `routes/`, `lib/`, `data/`, and `middleware/` tests.
- `server/test-db/`: tests that exercise a real disposable PostgreSQL database.
- `frontend/src/app/`: App Router routes, with route-level tests in local `__tests__/` directories.
- `frontend/src/components/`: shared or feature-oriented UI components.
- `frontend/src/lib/`, `hooks/`, `context/`, and `types/`: shared behavior organized by responsibility.

Extend an existing module before creating a parallel abstraction. Keep frontend and backend permission or validation rules synchronized when the business rule exists in both places.

## Testing Strategy

- Use Node's built-in `node:test` and `node:assert/strict` for the server.
- Use Vitest, React Testing Library, `user-event`, and `jest-dom` for the frontend.
- Structure tests as Arrange, Act, Assert and include the repository's `// Arrange`, `// Act`, and `// Assert` markers where applicable.
- Test externally visible behavior and business invariants rather than implementation details.
- Add or update route access-matrix and API-catalog coverage when endpoints or role guards change.
- Add database integration coverage when persistence, schema, or SQL changes.
- Prefer deterministic test data and mock external boundaries, not the behavior under test.
- Do not remove or weaken a regression test merely to make a change pass.

Before declaring implementation work complete, run the relevant focused tests and then the full CI gate when the change warrants it:

```bash
pnpm --dir server run lint
pnpm --dir server test
pnpm --dir server test:db
pnpm --dir frontend run lint
pnpm --dir frontend run test
pnpm --dir frontend exec tsc --noEmit
pnpm --dir frontend run build
```

The database test command requires a disposable PostgreSQL database via `DATABASE_URL`.

## Error Handling

- Validate and normalize untrusted input on the server, even when the frontend validates the same field.
- Use the established HTTP status codes and `{ error: string }` response shape for API failures.
- Pass unexpected errors to the Express error boundary; do not expose stack traces, secrets, SQL, or internal state to clients.
- Keep domain and validation errors specific enough for users and tests to act on.
- Handle async failures explicitly and preserve database transaction rollback behavior.
- Use React error/loading/empty states that match the surrounding feature rather than silently swallowing failures.

## Logging and Sensitive Data

- Use existing server logging patterns for startup, requests, persistence failures, and actionable operational errors.
- Never log passwords, JWTs, cookies, database URLs, API keys, raw authorization headers, or unnecessary personal data.
- Include useful context such as the subsystem or operation, but keep client-facing messages separate from diagnostic details.
- Do not add noisy production logs inside high-frequency polling, render, or persistence paths.

## Security and Domain Invariants

- The API is the source of truth for authentication, authorization, input validation, money, and state transitions.
- Use integer cents for money and existing helpers for cent-exact allocation.
- Preserve parameterized SQL and identifier allow-listing.
- Treat every browser-supplied identifier, price, role, status, and account field as untrusted.
- Maintain the current protections against oversized bodies, prototype pollution, multi-valued query parameters, brute force, and cross-site request abuse.
