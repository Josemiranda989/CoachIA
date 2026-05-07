# Frontend Audit — TODO

> **Fecha**: 2026-05-07
> **Stack**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Prisma SQLite
> **Skills aplicadas**: react-best-practices, next-best-practices, composition-patterns, next-cache-components, accessibility, seo, tailwind-css-patterns (instaladas via `npx autoskills`)
> **Cómo usar**: marcá cada item al completarlo. Las referencias `archivo:línea` son al estado del código del 2026-05-07.

---

## 🔴 Sprint 1 — Críticos (estimado 2-3 hs) ✅ COMPLETADO (PR #2 — merge `ae9e290`)

### [x] #1 Data leak entre usuarios en métricas (SECURITY BUG)
- **Dónde**: `src/app/metrics/page.tsx:24-34` y `src/app/metrics/records/page.tsx:7-16`
- **Problema**: `prisma.workoutLog.findMany()` se llama sin filtrar por `userId`. Hoy es app de un solo usuario, pero apenas haya un segundo usuario, todos ven los PRs y volumen total de todos.
- **Fix**:
  ```ts
  where: { exercise: { dailyWorkout: { routine: { userId } } } }
  ```
- **Severidad**: CRITICAL (security latente).

### [x] #2 Zoom del viewport bloqueado (WCAG 1.4.4)
- **Dónde**: `src/app/layout.tsx:27`
- **Problema**: `maximumScale: 1, userScalable: false` bloquea zoom. Bloqueante para gente con baja visión.
- **Fix**: eliminar ambas propiedades del `viewport`. El "PWA feel" no justifica romper a11y.

### [x] #3 Forms con labels rotos (a11y)
- **Dónde**: `src/app/auth/login/page.tsx:47-92`, `src/app/auth/register/page.tsx:55-124`, `src/app/auth/forgot-password/page.tsx:93-108`, `src/app/auth/reset-password/page.tsx`, `src/components/ProfileClient.tsx:113-183`
- **Problema**: `<label>` está como hermano del `<input>` sin `htmlFor`/`id`. Screen readers no anuncian el campo al enfocarlo.
- **Fix**: `<label htmlFor="email">Email</label><input id="email" ...>` o envolver el input dentro del label.

### [x] #4 Errores de auth no anunciados
- **Dónde**: `src/app/auth/login/page.tsx:48-52`, `src/app/auth/register/page.tsx:56-60`
- **Problema**: el `<div>` con error aparece sin `role="alert"` ni `aria-live`. SR no se entera de que falló el submit.
- **Fix**: `<div role="alert" aria-live="assertive">{error}</div>` y enfocar programáticamente el primer campo inválido.

### [x] #5 Header dropdown sin keyboard handling
- **Dónde**: `src/components/Header.tsx:157-236`
- **Problema**: dropdown con `role="menu"` no cierra con `Escape`, no enfoca el primer `menuitem` al abrir, no maneja `ArrowUp/Down`. Quien navega con teclado queda atrapado.
- **Fix**: agregar `onKeyDown` con `Escape → setMenuOpen(false)` + return focus al trigger; manejar arrows entre items; cerrar también en `focusout` fuera del menú.

### [x] #6 `aria-current="page"` faltante en navegación
- **Dónde**: `src/components/BottomNav.tsx:38-69`, `src/components/Header.tsx:65-86`
- **Problema**: hay color visual del item activo, pero asistencias no perciben "estás acá". WCAG 2.4.8.
- **Fix**: `aria-current={isActive ? "page" : undefined}` en cada link.

---

## 🟡 Sprint 2 — Performance + arquitectura (estimado 3-4 hs)

### [x] #7 N+1 queries en workout/today
- **Dónde**: `src/app/workout/today/page.tsx:115-126`
- **Problema**: `Promise.all(todayWorkout.exercises.map(async ex => prisma.workoutLog.findFirst(...)))`. 8 ejercicios = 8 queries.
- **Fix**: una sola query con `where: { exercise: { name: { in: names } }, weekStart: { lt: weekStart } }` agrupando in-memory, o usar el include `logs` ya hidratado.
- **Bonus**: el query original NO filtraba por usuario (mismo bug latente que #1). Se scopeó con `dailyWorkout: { routine: { userId } }`.

### [x] #8 Strava bloquea toda la página de métricas
- **Dónde**: `src/app/metrics/page.tsx:57` (fetchStats) + 5 queries en serie con `force-dynamic`
- **Problema**: si Strava está lento, la página entera espera. Sin streaming.
- **Fix**: envolver `<StravaActivities>` y otras secciones independientes en `<Suspense>`. Mover el fetch de Strava a un Server Component que se streamee.
- **Done**: extraída lógica de cycling cards a `<CyclingCards>` (server async), `<StravaActivities>` ahora server async, ambas envueltas en `<Suspense>` separadas. Las 4 cards de gym + records link son síncronas y se ven al instante; cycling/strava se streamean.

### [x] #9 useEffect para data fetching en componentes que deberían ser Server Components
- **Dónde**: `src/app/metrics/WeightChart.tsx:34-56`, `src/components/StravaActivities.tsx:61-73`
- **Problema**: ambos hacen `fetch("/api/...")` desde cliente. El padre `metrics/page.tsx` ya es Server Component con sesión. Genera doble waterfall (SSR → hydrate → fetch) y flash de "Cargando…".
- **Fix**: convertir a async Server Components y pasar data por props. O Server Component padre + Client Component hijo con `use(promise)` (React 19).
- **Done**: `WeightChart` ahora es server (fetch a Prisma) + `WeightChartView` cliente (recharts). `StravaActivities` server async, recibe `userId` y hace el fetch directo. Eliminada la doble fetch de Strava (antes pegaba 2 veces: una para cycling cards desde server, otra para activities desde cliente). Ahora `getStravaStats`/`getStravaActivities` están memoizadas con `React.cache()` en `src/lib/strava-cached.ts` — `<CyclingCards>` y `<StravaActivities>` comparten el resultado dentro del mismo render.

### [x] #10 `(session as any).user.id` en 14 archivos
- **Problema**: TypeScript hack repetido por todo el codebase.
- **Fix**: tipá la session una vez en `src/types/next-auth.d.ts`:
  ```ts
  declare module "next-auth" {
    interface Session { user: { id: string; ... } }
  }
  ```
  Después eliminá los `as any` con un find/replace.
- **Done**: creado `src/types/next-auth.d.ts` con augmentation de `Session.user.id` (`& DefaultSession["user"]`) y `JWT.id`. 19 ocurrencias de `(session as any)` eliminadas en 17 archivos. Bonus: detectó un bug latente en `routines/route.ts:127` (usaba `session.user.id` cuando había un fallback a `firstUser` — el `as any` lo silenciaba; ahora usa el `userId` del `let`).

### [x] #11 Listener `focusin/focusout` con closure stale
- **Dónde**: `src/app/workout/today/GymWorkoutClient.tsx:287-304`
- **Problema**: el `useEffect` de tracking de "click en `<a>`" tiene closure stale sobre `logs`. Re-monta el listener en cada cambio de logs (= cada keystroke).
- **Fix**: sacar `hasUnsaved` afuera como `useRef` para tracking transient.
- **Done**: introduje `hasUnsavedRef` y `loadingRef`. Los listeners de `beforeunload` y de click en anchors ahora se montan **una sola vez** (deps `[]`); leen el estado actual via refs. Antes se desmontaban/remountaban en cada keystroke.

### [x] #12 Derived state en useEffect (anti-pattern)
- **Dónde**: `src/app/workout/today/GymWorkoutClient.tsx:323-331`
- **Problema**: calcula "primer ejercicio incompleto" en `useEffect` con `eslint-disable exhaustive-deps`. Render extra garantizado.
- **Fix**: computar en el initializer del `useState`.
- **Done**: `exIdx` ahora se inicializa con el primer ejercicio incompleto via `useState(() => ...)` (corre solo una vez en mount). Eliminado el `useEffect` con `exhaustive-deps disabled` y el render extra que causaba.

### [x] #13 `force-dynamic` por todos lados
- **Dónde**: `metrics`, `metrics/records`, `wiki`, `wiki/[slug]`, `routine/pending`
- **Problema**: en Next 16 con cache components, esto es anti-pattern. La wiki cambia poco — perfecta para cachear.
- **Fix**: sacar `force-dynamic` y usar `'use cache'` con `cacheLife('hours')` + `cacheTag('exercises')` para la wiki. Envolver lo dinámico en `<Suspense>`.
- **Done**: `force-dynamic` eliminado de los 5 archivos. Para `wiki/*` (queries globales sobre `ExerciseDefinition`) extraje las queries a `src/lib/exercise-cache.ts` con `unstable_cache` (revalidate 1h, tag `exercises`) — preferí `unstable_cache` sobre la directiva `'use cache'` porque esta última requiere habilitar `experimental.cacheComponents` (feature experimental que afecta toda la app). Las páginas per-user (`metrics/records`, `routine/pending`) quedan dynamic via `cookies()` automáticamente; no se cachean cross-request porque el contenido depende del usuario.

---

## 🟢 Sprint 3 — Refactor DRY / consistencia (estimado 4-6 hs)

### [x] #14 Patrón "buscar rutina activa" duplicado 3 veces
- **Dónde**: `src/app/page.tsx:28-67`, `src/app/routine/week/page.tsx:21-59`, `src/app/workout/today/page.tsx:21-59`
- **Fix**: extraer a `src/lib/queries/getActiveRoutine.ts` y envolver con `cache()` de React para deduplicar entre componentes en el mismo request.
- **Done**: creado `src/lib/queries/getActiveRoutine.ts` con un `findActiveRoutine<T>` interno (genérico tipado vía `Prisma.RoutineInclude`) que encapsula el patrón "lte weekStart → fallback gt weekStart", más 4 presets envueltos con `React.cache()`: `getActiveRoutineLight` (home — solo `type` + `completions`), `getActiveRoutineWithBlocks` (week — full days + blocks), `getActiveRoutineWithLogs` (today — full days + per-week logs), y `getActiveRoutineDay` (descubierto durante el refactor: misma lógica también estaba en `src/app/api/today/route.ts` filtrando por `dayOfWeek`). 4 call sites unificados, ~150 líneas de duplicación eliminadas. Tipos derivados exportados (`ActiveRoutineLight`, `ActiveRoutineWithBlocks`, `ActiveRoutineWithLogs`) listos para alimentar el #22.

### [x] #15 `TODAY_EN` calculado a nivel de módulo
- **Dónde**: `src/app/routine/week/DayCardClient.tsx:18-22`
- **Problema**: `new Date()` a nivel de módulo se evalúa al import-time del bundle. El "hoy" puede quedar congelado.
- **Fix**: mover dentro del componente o pasarlo como prop desde el Server Component padre.

### [x] #16 7 cards repetidas en home
- **Dónde**: `src/app/page.tsx:187-323`
- **Problema**: misma estructura repetida 7 veces (`mb-4 p-3 bg-X-soft rounded-xl w-fit` + título + descripción + ArrowRight).
- **Fix**: `<DashboardCard href icon iconBg accentColor title description delay>` — ahorrás 100+ líneas.
- **Done**: creado `src/components/DashboardCard.tsx` (Server Component) con props `href`, `icon: LucideIcon`, `iconBgClass`, `iconColorClass`, `hoverBorderClass`, `title`, `description`, `delayMs` y `badge?` opcional (para la card "Generar con IA" que tiene la badge "Nuevo"). Las 7 cards inline se convirtieron en un array `dashboardCards` + `.map()` con `delayMs = 120 + idx * 60` (mantiene la cascada de animación 120/180/240/300/360/420/480ms idéntica). Decisión clave: paso las `className` tal cual como props, no inferí semántica de los colores — fidelidad visual exacta sin cambiar UX. `page.tsx`: -172 / +81 líneas (neto −91 en el archivo). Las 4 cards "secundarias" siguen con su patrón `bg-X-500/20 group-hover:bg-X-500/30 transition-colors`; las 3 "principales" siguen con tokens `bg-accent-X-soft`. Los hovers de border independientes del iconBg (ej. Métricas usa `text-accent-cycling` con `hover:border-emerald-500/50`) se respetan literal.

### [x] #17 Botones idénticos sin extraer
- **Dónde**: `src/app/routine/pending/PendingRoutineActions.tsx:57,69`
- **Problema**: dos botones full-width con misma estructura (solo cambia color). Y la clase `.btn` ya existe en `globals.css:196` pero no se usa.
- **Fix**: `<ActionButton variant="approve" | "reject">` o usar `.btn-approve` / `.btn-reject` en CSS.

### [x] #18 347 `style={{...}}` inline
- **Concentración**: `nutrition/page.tsx` (70), `workout/today/GymWorkoutClient.tsx` (48), `help/page.tsx` (43).
- **Problema**: la mayoría son `color-mix()`, gradientes, `var(--accent-*)`, `animationDelay`. Inline performance OK pero rompe consistencia.
- **Fix**: registrá los gradientes y soft-bgs como utilidades en `@theme` o `globals.css` (siguiendo el patrón de `bg-accent-*-soft` que ya tenés).
- **Done**: el patrón más repetido (con largo) era `style={{ color: "var(--text-primary)" }}` / `var(--text-secondary)` — 75 ocurrencias en los 3 archivos calientes. Esos colors ya estaban registrados como tokens en `@theme inline` (`text-text-primary`, `text-text-secondary`) pero nadie los usaba en JSX. Migré los 75 a utility classes existentes; quedan solo 3 casos legítimos (1 en `nutrition` que es `accent-gym`, 2 en `GymWorkoutClient` que son ternarios condicionales `exIdx === 0 ? "var(--glass-border)" : "var(--text-primary)"` — esos tienen que ser inline). Agregué `.bg-surface-low { background: rgba(255,255,255,0.04); }` con override `.light` para reemplazar el `rgba(255,255,255,0.04)` repetido 7+ veces en `nutrition` (subtle stat tiles, hydration cards, pre-ride options). NO toqué los **gradientes hero específicos** (`linear-gradient(135deg, rgba(X,Y,Z,0.12) 0%, rgba(24,24,27,0.7) 60%)`) — son contenido-específicos por sección y registrarlos como 6 utilities (gym, red, blue, cyan, violet, emerald) sería más ruido que beneficio. Tampoco toqué `animationDelay: ${i * 80}ms` y otros inline dinámicos legítimos. Reducción real medida: `var(--text-X)` inline pasó de 75 → 3 (96% reducción del problema específico que causaba ruido visual en JSX).

### [x] #19 `routine/generate/page.tsx` todo `"use client"` (425 líneas)
- **Problema**: `GOALS`, `FOCUS_AREAS`, `DAY_LABELS`, `DayTypeIcon`, `TypeBadge` son puramente estáticos pero corren en el cliente.
- **Fix**: page como Server Component que renderice `<GenerateRoutineForm>` cliente, y los componentes de preview (sin estado) como Server Components compuestos vía children.
- **Done**: split en 5 archivos. `page.tsx` ahora es Server Component (24 líneas, header + `<GenerateRoutineForm/>` + `<Link>` Volver + metadata `{ title: "Generar rutina" }`). `GenerateRoutineForm.tsx` (client) tiene todo el state/handlers y renderiza condicionalmente loading/form/preview. Los componentes puros viven sin `"use client"` y son shared/server-compatible: `constants.ts` (GOALS, FOCUS_AREAS, DAY_LABELS, types `DayType`/`GeneratedRoutine`), `PreviewCards.tsx` (`DayTypeIcon`, `TypeBadge`, `DayPreviewCard` — extraído también el render de cada day porque era estático), `LoadingSkeleton.tsx`. Resultado: page.tsx pasó de 425 → 24 líneas (−401). El bundle del cliente ya no incluye el header, el botón "Volver" ni las constantes redundantes; el form sigue en cliente porque tiene state, pero los componentes de preview pueden reusarse desde un Server Component si en el futuro se decide pre-renderizar la preview en server. Decisión: NO tomé el patrón "compose via children" para el preview porque la preview depende de `routine` (state cliente); solo se renderiza cuando existe — pasarla como children desde el server la fija al render inicial.

### [x] #20 Tokens de spacing/border inconsistentes
- **Problema**: `gap-2/3/4/5` mezclados en mismo componente (ej. `routine/week/DayCardClient.tsx`). `rounded-*`: 28× xl, 17× lg, 10× 2xl, 2× md. `--radius-sm/md/lg` en CSS vars (`globals.css:90-92`) pero nadie los usa.
- **Fix**: definir 2-3 tokens (gap-2 inline, gap-4 cards, gap-6 secciones) y respetarlos. O eliminar las CSS vars muertas.
- **Done**: convención adoptada: `gap-2` para items inline (icon+texto, label+input), `gap-4` para containers (header rows, vertical content stacks), `gap-6` para secciones grandes. Aplicado en `DayCardClient.tsx`: `gap-3` outer header → `gap-4`, `gap-5` checkboxes → `gap-4`, `flex flex-col gap-3` content stack → `gap-4`. Los `gap-2` inline (icon+texto, checkbox+label) se mantienen, son tight intra-row. Sobre `--radius-*`: el TODO decía "nadie los usa" pero no es verdad — `.card` usa `var(--radius-md)`, `.btn`/`.input`/`.btn-outline-cycling` usan `var(--radius-sm)`. NO son CSS vars muertas. La inconsistencia REAL es entre las clases Tailwind (`rounded-xl/lg/2xl/md` por todo el JSX) y las CSS vars de los componentes base — son universos distintos. Mass-refactor de los `rounded-X` por todo el codebase es scope grande con riesgo cosmético; NO lo ataco en este pase. Si en el futuro se decide unificarlos, el camino limpio sería extender `@theme` para que `rounded-card` y `rounded-input` usen las CSS vars existentes.

### [x] #21 `navLinks` duplicado en Header y BottomNav
- **Fix**: extraer a `src/lib/nav.ts` y reusar.
- **Done**: creado `src/lib/nav.ts` con shape `{ href, label, shortLabel?, icon, mobile }`. Header consume todos los items, BottomNav filtra por `mobile: true` y usa `shortLabel ?? label` para el label corto ("Hoy" vs "Entrenamiento").

### [x] #22 Tipos `any` en data shapes
- **Dónde**: `routine/pending/page.tsx:160` (`(day as any).blocks`), `metrics/page.tsx:84-95` (`icon: any` en `Metric`), Client Components con `workout: any`, `day: any`, `ex: any`.
- **Fix**: exportar tipos desde Prisma con `Prisma.RoutineGetPayload<typeof include>`. Usar `LucideIcon` de `lucide-react` para iconos.
- **Done**: el #14 ya había dejado el helper genérico tipado; acá lo aproveché. En `src/lib/queries/getActiveRoutine.ts` exporté tipos derivados `DayWithBlocks`, `DayWithLogs`, `ExerciseWithLogs` (vía `Prisma.RoutineGetPayload<{ include: T }>` + indexed access). Eliminé `any` en data shapes de routine/day/exercise: `workout/today/page.tsx` (2 maps + narrowing limpio en `isRestLike`), `routine/week/page.tsx` (filter), `GymWorkoutClient.tsx` (export `GymWorkoutData = Omit<DayWithLogs, "exercises"> & { completed; exercises: (ExerciseWithLogs & { lastWeight? })[] }`), `CyclingWorkoutClient.tsx` (export `CyclingWorkoutData = DayWithLogs & { completed }`), `DayCardClient.tsx` (export `DayCardData = DayWithBlocks & { completed; creatineTaken }` + map sin cast), `routine/pending/page.tsx` (`(day as any).blocks` → `day.blocks`, ya estaba en el include), `metrics/page.tsx` (`icon: typeof Dumbbell` → `LucideIcon` importado de `lucide-react`). Fuera de scope: `catch (err: any)` y shapes de Strava activities (otro item, no el modelo Prisma de la app). El `findActiveRoutine<T>` interno tiene anotación de retorno explícita `Promise<Prisma.RoutineGetPayload<{ include: T }> | null>` para que el genérico no pierda inferencia en los presets.

---

## 🔵 Sprint 4 — A11y nice-to-have (estimado 2-3 hs) ✅ MAYORÍA COMPLETADA (#29 diferido)

### [x] #23 `.input:focus-visible` sin estilos
- **Dónde**: `src/app/globals.css:286-296`
- **Problema**: `.input` no define `:focus-visible`. El estilo global de `a, button` no incluye `input`. Foco invisible en formularios.
- **Fix**: `.input:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }`.

### [x] #24 Salto de jerarquía de headings
- **Dónde**: `src/app/wiki/page.tsx:32, 68`
- **Problema**: `h1` → `h3` (no hay `h2`).
- **Fix**: cambiar `h3` por `h2`.

### [x] #25 Logo "CoachIA" partido en dos `<span>`
- **Dónde**: `src/components/Header.tsx:50`
- **Problema**: SR lee "Coach. IA".
- **Fix**: envolver con `aria-label="CoachIA"` o usar un solo span.

### [x] #26 Loading states sin `aria-live`
- **Dónde**: `src/components/StravaActivities.tsx:75-81` y otros loaders
- **Fix**: `<div role="status" aria-live="polite">Cargando…</div>`.

### [x] #27 Toggle de tema con label genérico
- **Dónde**: `src/components/Header.tsx:94-110`
- **Fix**: `aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}` y `aria-pressed`.

### [x] #28 Iconos `lucide-react` sin `aria-hidden` (parcial)
- **Problema**: la mayoría son decorativos junto a texto. SR los lee duplicado.
- **Fix**: agregar `aria-hidden="true"` a iconos decorativos.

### [ ] #29 `confirm()` bloqueante sin alternativa accesible — DIFERIDO

> Requiere refactor del flow del listener de click en anchor: el `<dialog>` accesible es async, pero el `confirm()` corre síncrono dentro del listener (necesita preventDefault inmediato). Se ataca en otro PR convirtiendo el navigation a un guard pattern.
- **Dónde**: `src/app/workout/today/GymWorkoutClient.tsx:297` ("Tenés sets sin guardar…")
- **Fix**: usar elemento `<dialog>` accesible con focus trap.

### [x] #30 Skip link "Saltar al contenido"
- **Problema**: Header sticky sin opción de skip. WCAG 2.4.1.
- **Fix**: agregar `<a href="#main" class="sr-only focus:not-sr-only">Saltar al contenido</a>` antes del Header.

### [x] #31 `prefers-reduced-motion` solo aplicado a `.page-transition`
- **Problema**: `animate-fade-up`, `badge-pulse`, `card-hover-lift` siguen animando.
- **Fix**: extender el `@media (prefers-reduced-motion: reduce)` para todas las animations.

---

## ⚪ Sprint 5 — SEO básico (estimado 1 h) ✅ COMPLETADO

### [x] #32 Falta `robots.ts` con `Disallow: /` (PRIVATE APP)
- **Dónde**: crear `src/app/robots.ts`
- **Por qué**: app privada de un solo usuario expuesta a internet. NO querés que se indexe.
- **Fix**:
  ```ts
  import type { MetadataRoute } from 'next';
  export default function robots(): MetadataRoute.Robots {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  ```

### [x] #33 Falta `metadataBase` en root layout
- **Dónde**: `src/app/layout.tsx:9`
- **Problema**: sin esto, `openGraph.url` y rutas relativas en metadata generan warnings.
- **Fix**: `metadataBase: new URL("https://coachia.jmlabs.app")` en el `metadata` export.

### [x] #34 Pages internas heredan title genérico
- **Problema**: `/metrics`, `/wiki`, `/nutrition`, `/help`, `/profile`, `/auth/*` muestran "CoachIA - Entreno" en la pestaña.
- **Fix**: en root layout `title: { default: "CoachIA", template: "%s · CoachIA" }`. Después en cada page: `export const metadata = { title: "Métricas" }`.

### [x] #35 OG/Twitter cards genéricas
- **Problema**: si pegás `coachia.jmlabs.app` en WhatsApp/Telegram queda feo.
- **Fix**: agregar `openGraph` y `twitter` en root layout con `images` apuntando a `/icons/icon-512.png`.

### [x] #36 `next/image` con `unoptimized` en wiki
- **Dónde**: `src/app/wiki/[slug]/page.tsx:120`, `src/app/wiki/page.tsx:60`
- **Problema**: perdés conversión automática a WebP/AVIF.
- **Fix**: sacar `unoptimized` si las imágenes son locales.

---

## Decisiones pendientes

- [x] **Dark mode strategy** — RESUELTA: CSS vars + `.light` override. NO usar `dark:` de Tailwind. Convención lockeada en `CLAUDE.md` (sección Conventions, bullet "Theming").
- [x] **`scaleId` en `BodyWeight`** — RESUELTA: removido. Migration `20260507_drop_bodyweight_scaleid.sql` aplica `ALTER TABLE DROP COLUMN`. Razón documentada en la migration y reforzada en el comment de la migration anterior (openScale-sync siempre manda `id=0`, nunca tuvo valor real). Después de mergear, correr `docker exec coachia-coach-ia-1 npx prisma db push` para aplicar.

---

## Comandos útiles

```bash
# Sincronizar src local para análisis
scp -r homelab:D:/docker-containers/CoachIA/src /tmp/coachia-frontend/

# Re-correr autoskills si querés actualizar skills
cd D:\docker-containers\CoachIA && npx autoskills -y --dry-run

# Buscar todos los `as any` de session
rg "session as any" src/

# Contar inline styles
rg -c "style=\\{\\{" src/

# Verificar que metrics queries no filtran por userId
rg -A 5 "workoutLog.findMany" src/app/metrics/
```
