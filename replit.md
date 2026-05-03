# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Project: Assence — Inteligência Astrológica

Elite Portuguese-language astrological intelligence platform. Generates rich psychological/evolutionary birth chart analyses using the Assence method via OpenAI. All UI in Portuguese.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, TailwindCSS v4, react-markdown + remark-gfm
- **AI**: OpenAI (gpt-5.4, max_completion_tokens: 8192)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

- `artifacts/api-server` — Express API server (port 8080, path `/api`)
- `artifacts/assence` — React+Vite frontend (cosmic dark theme, gold accents)

## DB Schema (lib/db/src/schema/)

- `readings` — birth chart records (clientName, birthDate, birthTime, birthPlace, birthChart JSON, analysis Markdown, analysisStatus)
- `conversations` — chat sessions linked to readings (readingId, title nullable)
- `messages` — chat messages (conversationId, role, content)

## Important Patterns

- **serializeDates()** helper in route files: Drizzle returns JS `Date` objects; Zod schemas expect ISO strings — must map before `.parse()`
- **SSE streaming**: chat uses manual `fetch()` with `text/event-stream` (not generated hooks)
- **Polling**: reading view polls every 3s when `analysisStatus === "pending" | "generating"`
- **Google Fonts**: declared in `artifacts/assence/index.html` `<head>` (not CSS `@import` — avoids PostCSS conflict with `@import "tailwindcss"`)
- **ASSENCE_SYSTEM_PROMPT**: in `artifacts/api-server/src/lib/assence.ts`

## Frontend Pages

- `/` — Dashboard with stats and recent readings
- `/mapas` — Readings list with search and delete
- `/mapa/:id` — Reading view: planet table, markdown analysis (react-markdown), chat button
- `/novo` — New reading form: client data + planetary positions + aspects
- `/chat/:id` — SSE streaming chat about a specific reading

## API Routes

- `GET /api/readings` — list all readings
- `GET /api/readings/stats` — stats (total, completed, thisMonth, mostCommonSign)
- `POST /api/readings` — create + trigger async AI analysis
- `GET /api/readings/:id` — get single reading
- `DELETE /api/readings/:id` — delete reading
- `GET /api/openai/conversations` — list conversations
- `POST /api/openai/conversations` — create conversation
- `GET /api/openai/conversations/:id` — get conversation with messages
- `POST /api/openai/conversations/:id/messages` — send message (SSE stream)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
