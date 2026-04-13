# CoachIA

**CoachIA** es un entrenador personal para atletas que combinan ciclismo y gimnasio. Genera rutinas semanales con IA basadas en tu historial real de Strava y gym, te notifica por Telegram cuando hay una rutina nueva, y te deja trackear tus sesiones desde el teléfono.

La filosofía: **Strava es la fuente de verdad para ciclismo, la DB para gym**. Sin duplicación de datos.

---

## Features

### Generación de rutinas con IA (Gemini)
- Toma tu historial real: PRs, volumen histórico, últimas 5 salidas de Strava, YTD stats.
- Aplica periodización semanal obligatoria: sábado = fondo largo prioritario, piernas 72h+ antes del sábado, recovery ride post-piernas.
- Requiere tu aprobación antes de activar una rutina (flujo `pending_approval`).

### Vista semanal (`/routine/week`)
- Acordeón por día: el día actual se abre por defecto, el resto colapsados con resumen.
- Checkboxes de Creatina y Finalizado con toggles independientes.
- Highlight del día actual con borde ámbar.

### Entrenamiento del día (`/workout/today`)
- **Gym**: inputs táctiles (48px mín.) para kg y reps, peso sugerido del último log.
- **Bici**: vista informativa (objetivo + zona). Los datos reales (km, tiempo, FC, watts) vienen de Strava automáticamente.
- FAB fijo en mobile para guardar.

### Métricas (`/metrics`)
- Count-up animation en todos los números (~900ms easeOutExpo).
- 4 cards de gym (ámbar): volumen, récord sentadilla, sesiones, series.
- 4 cards de cycling (cian, desde Strava): km/año, horas/año, ride más largo, desnivel.
- Detalle de todos los PRs en `/metrics/records`.
- Weight chart (Xiaomi S400 → openScale MQTT → n8n).

### UX mobile
- Bottom navigation bar fijo con 4 destinos (Dashboard, Rutina, Hoy, Métricas).
- Header compacto arriba.
- Transiciones suaves entre rutas (fade + slide-up).
- Focus states accesibles (keyboard-only).

### Nutrición ciclismo (`/nutrition`)
- Guía de fueling para salidas largas con productos argentinos (Arcor, Hidromax, Granix).

### Notificaciones
- Telegram bot para avisos de rutinas generadas y resúmenes semanales.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router + Turbopack) |
| UI | React 19, Tailwind 4, lucide-react, recharts |
| Auth | NextAuth.js |
| DB | SQLite + Prisma |
| IA | Google Gemini (`gemini-flash-latest`) |
| Notificaciones | Telegram Bot API |
| Deploy | Docker Compose |

---

## Fuentes de datos

| Fuente | Estado | Datos |
|--------|--------|-------|
| Strava | ✅ Integrado (OAuth) | Rides, potencia (iGPSport BSC300T), FC, distancia, desnivel |
| Telegram | ✅ Integrado | Notificaciones de rutinas |
| Xiaomi S400 | 🟡 Pipeline MQTT vía openScale + n8n | Peso y composición corporal |
| Samsung Health / Galaxy Watch 7 | ❌ Pendiente | Pasos, entrenamientos de gym |

---

## Setup local

Este proyecto se corre **exclusivamente con Docker Compose** — Prisma tiene problemas de permisos (EPERM) al correrlo con npm directo en Windows.

### 1. Clonar y preparar `.env`

Creá un archivo `.env` en la raíz del proyecto con:

```
GEMINI_API_KEY=<tu key de https://aistudio.google.com/apikey>
NEXTAUTH_SECRET=<base64 random de 48 bytes>
TELEGRAM_BOT_TOKEN=<token de @BotFather>
TELEGRAM_CHAT_ID=<tu chat id>
INTERNAL_API_KEY=<base64 random de 24 bytes, para n8n/triggers externos>
```

Generar secrets desde PowerShell:
```powershell
# NEXTAUTH_SECRET
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))

# INTERNAL_API_KEY
[Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 2. Levantar

```bash
docker compose up -d --build
```

La app queda disponible en [http://localhost:3001](http://localhost:3001).

### 3. Sincronizar schema de Prisma

Después de cambios en `prisma/schema.prisma`, aplicalos **dentro del container**:

```bash
docker exec coachia-coach-ia-1 npx prisma db push
```

---

## Estructura del proyecto

```
src/
  app/
    api/                       Endpoints server-side
      routines/generate/       Generación semanal con Gemini
      routines/generate-monthly/  Generación mensual (cron/n8n) + notifica Telegram
      stats/                   Stats mensuales, cycling stats (desde Strava)
      strava/                  OAuth callback
      workouts/                Toggle completed, mark-cycling-complete
      weight/                  Pipeline de peso desde n8n
    routine/week/              Vista semanal con acordeón
    routine/generate/          Form + preview con loading skeleton
    routine/pending/           Aprobar/rechazar rutinas generadas
    workout/today/             Tracking de gym y bici
    metrics/                   Stats con count-up, Strava integration
    nutrition/                 Guía de nutrición para ciclismo
  components/
    Header.tsx                 Navbar superior
    BottomNav.tsx              Bottom nav mobile (fixed)
    BackLink.tsx               Link "Volver" unificado
    CountUp.tsx                Animación numérica
    PageTransition.tsx         Fade entre rutas
    WeightChart.tsx            Gráfico de peso (recharts)
    StravaActivities.tsx       Lista de actividades de Strava
  lib/
    strava.ts                  OAuth + fetch de Strava API
    telegram.ts                Bot notifications
    prisma.ts                  Client Prisma
    auth.ts                    NextAuth config
```

---

## Pendientes

- **Samsung Health / Galaxy Watch 7** — integración para pasos y gym
- **Dashboard unificado** agregando todas las fuentes
- **Plan mensual adaptativo** — ajuste de cargas según fatiga y adherencia
- **Purgar API keys leaked en commits viejos** del git history (las keys ya fueron rotadas)

---

## Notas

- Strava re-autoriza keys automáticamente si detecta leaks en repos públicos. Mantené `.env` siempre gitignored.
- El modelo Gemini usa el alias `gemini-flash-latest` para evitar roturas cuando Google mueve modelos dentro/fuera del free tier.
- `docker compose restart` NO relee `docker-compose.yml` — usá `docker compose up -d --force-recreate` cuando cambies vars de entorno.
