# CoachIA — Changelog

## 2026-04-15/16: PWA + Hevy-style Workout + Mobile UX Audit

### PWA Support
- Web App Manifest (`src/app/manifest.ts`) — standalone, portrait, dark theme
- Service Worker (`public/sw.js`) — network-first cache, skips /api/ and /auth/
- Icons generated from fondo.png character face with red border
- Installable on Android (tested on Xiaomi 14 with Chrome and Brave)
- Note: Xiaomi MIUI requires enabling "Create home screen shortcuts" permission for the browser

### Hevy-style Gym Workout Tracker
- Rewrote `GymWorkoutClient.tsx` from scroll-all layout to focused single-exercise view
- One exercise at a time with left/right navigation
- Set-by-set input with "Completar Set" button
- 90-second rest timer (auto-starts, skippable) between sets
- "Siguiente:" preview showing next exercise
- Progress bar (completed/total series)
- Auto-advance to next exercise when all sets done
- Trophy completion screen

### Mobile UX Audit Fixes

**Critical:**
- localStorage persistence for gym sessions (auto-restore on page load, clear on save)
- Replaced all `alert()` with react-hot-toast notifications (app-wide)
- FAB hides when mobile keyboard is open

**Major:**
- Dashboard grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (was 2-col on all mobile)
- Pending routine buttons repositioned above BottomNav (`bottom: 72px`)
- Navigation confirmation when leaving workout with unsaved sets
- Nutrition page: added table of contents with anchor navigation to 7 sections

**Minor:**
- `autocomplete` attributes on login/register forms (email, password, name)
- Light mode input backgrounds fixed (was `rgba(0,0,0,0.2)`, now `rgba(0,0,0,0.04)`)
- CountUp respects `prefers-reduced-motion`
- Next.js dev indicator disabled

---

## 2026-04-12/13: Initial Build

### Core Features
- Next.js 16 app with dark theme, glassmorphism cards
- AI routine generation with Gemini (periodization rules, Strava data)
- Routine approval flow (pending_approval → active)
- Weekly view with accordion day cards
- Gym workout logging with numeric inputs
- Cycling view (Strava as source of truth)
- Metrics dashboard with count-up animations
- Weight tracking pipeline (Xiaomi S400 → openScale → MQTT → n8n → API)
- Telegram notifications for routine generation
- Strava OAuth integration
- Nutrition guide for cycling with Argentine products

### UI/UX
- Bottom navigation bar (mobile)
- Page transitions (fade + slide-up)
- Responsive grid layouts
- Focus states for accessibility
- Theme toggle (dark/light)
