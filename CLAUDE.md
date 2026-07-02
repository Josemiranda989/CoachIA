# CoachIA — Project Instructions

## Quick Start

This project runs **exclusively via Docker Compose** (Prisma has EPERM issues on Windows with npm directly).

```bash
cd D:/docker-containers/CoachIA
docker compose up -d
# App available at http://localhost:3001
# Public: https://coachia.jmlabs.app
```

**After any code change**: `docker compose up -d --build` — the compose runs `NODE_ENV=production` with no source volume mount, so the image must be rebuilt to pick up changes. Plain `docker compose restart` only restarts the existing image and **will not** apply your edits.

**After schema changes**: `docker exec coachia-coach-ia-1 npx prisma db push`

## Stack

- Next.js 16 (App Router, Turbopack build) — runs in production mode inside Docker (no HMR)
- React 19, Tailwind 4, lucide-react, recharts, react-hot-toast
- SQLite + Prisma, NextAuth (CredentialsProvider)
- DeepSeek V4 vía OpenCode Zen (generación de rutinas + Chat Coach). Cliente propio con `node:https` en `src/lib/opencode.ts` — NO usar el SDK de OpenAI ni fetch/undici acá (bug UND_ERR_HEADERS_TIMEOUT). Env: `OPENCODE_API_KEY`.
- Docker Compose with volume mounts

## Conventions

- **Language**: UI in Spanish (Rioplatense). Code in English.
- **Styling**: CSS custom properties in `globals.css` (--accent-primary, --accent-gym, --accent-cycling, --bg-card, etc.). Glassmorphism cards. Dark mode default, light mode supported.
- **Theming**: CSS custom properties only. **Do NOT use Tailwind's `dark:` modifier.** Light mode is implemented via the `.light` class on `<html>` (set by `next-themes` with `attribute="class"`), which redefines the CSS vars in `globals.css`. To add a themed token, add it to both `:root` and `.light` blocks; do not introduce `dark:` utility classes. New utility classes that need theme awareness should follow the `.bg-surface-low` pattern (one rule for dark, a `.light X` override for light).
- **Components**: Client components use `"use client"` directive. Server components for data fetching in page.tsx files.
- **Notifications**: Use `toast.success()` / `toast.error()` from react-hot-toast. **Never use `alert()`**.
- **Auth**: Browser sessions via NextAuth JWT. Internal API calls (n8n, cron) use `X-Internal-Key` header. Helper: `src/lib/internal-auth.ts`.
- **Timezone**: `America/Argentina/Tucuman` for day-of-week detection.

## PWA

The app is installable on Android/iOS as a PWA:
- Manifest: `src/app/manifest.ts`
- Service Worker: `public/sw.js` (network-first, skips /api/ and /auth/)
- Icons: `public/icons/` (generated from fondo.png character face)
- Registration: `next/script` with `beforeInteractive` strategy in layout.tsx

## Known Pre-existing TS Errors (do NOT fix unless asked)

These exist before any changes and are not blockers (dev mode ignores them):
- `src/app/api/weight/route.ts` — Prisma type mismatch (userId_scaleId, scaleId)
- `src/app/metrics/WeightChart.tsx` — recharts Formatter type incompatibility
- `src/app/api/google-fit/` — Routes reference deleted Google Fit integration

## Key Architecture Decisions

- **Strava is source of truth for cycling** — no manual cycling data entry. Stats come from Strava API.
- **Gym workout uses Hevy-style focused flow** — one exercise at a time, set-by-set with rest timer, not a long scroll form.
- **localStorage persistence** for gym sessions — key `coachia-gym-session`, auto-restores on page load, clears on save.
- **Routine approval flow**: AI generates → status `pending_approval` → Telegram notification → user approves/rejects in app → active.
- **Monthly routine generation**: Claude Code scheduled task on 1st of month at 8am Buenos Aires.
- **Chat Coach (`/coach`)**: adaptación intra-semana vía chat con tool calling (ADR-001). El modelo PROPONE mutaciones (move_workout, set_rest_day, replace_cycling_blocks, update_day_notes), el usuario confirma en la UI, cada cambio guarda snapshot en `RoutineChangeLog` para deshacer. Contexto: rutina de la semana + Strava + balanza + CTL/ATL/TSB. Gym NO se edita por chat: solo se mueve (también disponible determinista en `/api/routine/move-day` + select en la vista semanal).

## File Structure

```
src/
  app/
    manifest.ts              PWA manifest
    layout.tsx               Root layout (viewport, theme-color, SW registration)
    page.tsx                 Dashboard (greeting, progress bar, nav grid)
    auth/login/              Login page
    auth/register/           Register page
    workout/today/           Hevy-style gym tracker + cycling view
    coach/                   Chat Coach (consultas + adaptación de la semana con propose/confirm/undo)
    routine/week/            Accordion week view with day cards
    routine/generate/        AI routine generation form
    routine/pending/         Approve/reject AI-generated routines
    routine/load/            Manual JSON paste
    metrics/                 Stats dashboard (gym amber, cycling cyan)
    metrics/records/         Personal records detail
    nutrition/               Cycling fuel guide with TOC navigation
    help/                    FAQ and JSON format docs
    api/                     All API routes
  components/
    Providers.tsx            SessionProvider + ThemeProvider + Toaster
    Header.tsx               Desktop navbar
    BottomNav.tsx            Mobile bottom navigation (4 tabs)
    BackLink.tsx             Unified back navigation
    CountUp.tsx              Animated number counter (respects reduced-motion)
  lib/
    auth.ts                  NextAuth config
    prisma.ts                Prisma client
    strava.ts                Strava OAuth + API
    telegram.ts              Telegram Bot API
    internal-auth.ts         Dual auth (session + API key)
    opencode.ts              Cliente LLM (DeepSeek vía OpenCode Zen, node:https, tool calling)
    coach-tools.ts           Tools del Chat Coach: definiciones, validación, applyProposal, undo
    coach-context.ts         Contexto del coach (semana + Strava + balanza + fitness + zonas)
    fitness.ts               TSS estimado (TRIMP) + CTL/ATL/TSB (EMA 42/7 días)
    fitness-data.ts          computeFitnessForUser: fitness desde actividades Strava
public/
  sw.js                      Service worker
  icons/                     PWA icons (192, 512, maskable)
  fondo.png                  Background character image
```
