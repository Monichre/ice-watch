## Contributing and Development Workflow

This project has been migrated to a **Next.js App Router + Convex** architecture with some legacy Expo/Express/Drizzle code still present under `legacy/` and `server/`. This document describes how to get a development environment running, what scripts are available, and how to run tests.

> **Single source of truth**  
> Runtime scripts are derived from `package.json`. Environment variables should be defined in `.env.example` (not yet present – see Environment Setup).

---

## Development Workflow

### 1. Install dependencies

```bash
pnpm install
```

### 2. Run the main dev stack (Next.js + Convex)

```bash
pnpm dev
```

This will:

- Start the Convex dev server.
- Start the Next.js dev server (App Router) on `http://localhost:3000` by default.

You can also run each side individually:

```bash
pnpm dev:convex   # Convex dev server (functions, database, storage)
pnpm dev:next     # Next.js dev server (web UI)
```

### 3. Legacy stack (Expo + Express)

The legacy mobile/web stack is still available for reference and gradual decommissioning:

```bash
pnpm legacy:dev      # Runs legacy server + Expo web
pnpm legacy:server   # Legacy Express/tRPC/Drizzle server (development)
pnpm legacy:metro    # Expo dev server (web) for the legacy app
```

Use these primarily for comparison and troubleshooting during migration.

---

## Available Scripts

All scripts below come directly from `package.json`.

| Script           | Command                                                                                         | Description                                                                                                  |
|------------------|-------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `dev`            | `concurrently -k "pnpm dev:convex" "pnpm dev:next"`                                             | Run Convex dev server and Next.js dev server together for the main web + backend stack.                     |
| `dev:convex`     | `npx convex dev`                                                                               | Start Convex dev server (database, queries, mutations, actions).                                            |
| `dev:next`       | `next dev -p ${PORT:-3000}`                                                                    | Start Next.js dev server on `PORT` (default `3000`).                                                        |
| `build`          | `next build`                                                                                   | Build the Next.js application for production.                                                               |
| `start`          | `next start -p ${PORT:-3000}`                                                                  | Start a production Next.js server using the last build.                                                     |
| `check`          | `tsc --noEmit`                                                                                 | Type-check the TypeScript codebase without emitting output.                                                 |
| `lint`           | `eslint .`                                                                                     | Run ESLint across the repo.                                                                                 |
| `format`         | `prettier --write .`                                                                           | Format the codebase with Prettier.                                                                          |
| `test`           | `vitest run`                                                                                   | Run the test suite once using Vitest.                                                                       |
| `legacy:dev`     | `concurrently -k "pnpm legacy:server" "pnpm legacy:metro"`                                     | Run legacy server and Expo dev server together.                                                             |
| `legacy:server`  | `cross-env NODE_ENV=development tsx watch server/_core/index.ts`                              | Start the legacy Express/tRPC/Drizzle server in watch mode.                                                |
| `legacy:metro`   | `cross-env EXPO_USE_METRO_WORKSPACE_ROOT=1 npx expo start --web --port ${EXPO_PORT:-8081}`    | Start the Expo dev server for the legacy app (web), typically on `EXPO_PORT` (default `8081`).             |
| `db:push`        | `drizzle-kit generate && drizzle-kit migrate`                                                  | Generate and apply Drizzle migrations for the legacy SQL database.                                         |

---

## Environment Setup

> **Note:** A `.env.example` file was not found at the repository root when these docs were generated.

To keep environment configuration consistent:

1. **Create `.env.example`**
   - Add all required environment variables with example or placeholder values.
   - This file should be treated as the single source of truth for env var names and formats.

2. **Local environment files**
   - Create a `.env.local` (or Next.js‑style `.env.*.local`) file for your actual secrets and environment values.
   - Use the keys and formats defined in `.env.example`.

3. **Convex environment**
   - Use `npx convex dev` or the Convex dashboard to manage Convex environment variables as needed.

Until `.env.example` exists, developers should coordinate on environment keys via code review and this documentation.

---

## Testing Procedures

### Type checking

```bash
pnpm check
```

### Linting

```bash
pnpm lint
```

### Unit / integration tests

```bash
pnpm test
```

### Formatting

```bash
pnpm format
```

Run `check`, `lint`, and `test` before opening a PR or pushing to `main`. Format as needed to keep diffs clean and consistent.
