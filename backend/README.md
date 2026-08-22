# Dayflow Backend

Express + TypeScript + Prisma API for the Dayflow HRMS MVP.

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

Requires PostgreSQL (see repo root `docker-compose.yml`).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | dev server with watch mode |
| `npm run build` | compile TypeScript to `dist/` |
| `npm start` | run compiled output |
| `npm test` | run vitest suite |

## Structure

```text
backend/
├── src/
│   ├── index.ts        # entrypoint
│   ├── app.ts          # express app
│   ├── config/env.ts   # validated env vars
│   ├── lib/prisma.ts   # prisma client singleton
│   ├── middleware/     # error handler, auth guards
│   └── routes/         # api route modules
├── prisma/schema.prisma
└── tests/
```
