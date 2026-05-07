# CoachIA — Project Instructions

## Quick Start

This project runs **exclusively via Docker Compose** (Prisma has EPERM issues on Windows with npm directly).

```bash
cd D:/docker-containers/CoachIA
docker compose up -d
# App available at http://localhost:3001
# Public: https://gym.homelab989.duckdns.org
```

**After any code change**: `docker compose up -d --build` — the compose runs `NODE_ENV=production` with no source volume mount, so the image must be rebuilt to pick up changes. Plain `docker compose restart` only restarts the existing image and **will not** apply your edits.

**After schema changes**: `docker exec coachia-coach-ia-1 npx prisma db push`

## Stack

- Next.js 16 (App Router, Turbopack build) — runs in production mode inside Docker (no HMR)
- React 19, Tailwind 4, lucide-react, recharts, react-hot-toast
- SQLite + Prisma, NextAuth (CredentialsProvider)
- Google Gemini (routine generation)
- Docker Compose with volume mounts

## Conventions

- **Language**: UI in Spanish (Rioplatense). Code in English.
- **Styling**: CSS custom properties in `globals.css` (--accent-primary, --accent-gym, --accent-cycling, --bg-card, etc.). Glassmorphism cards. Dark mode default, light mode supported.
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
public/
  sw.js                      Service worker
  icons/                     PWA icons (192, 512, maskable)
  fondo.png                  Background character image
```
