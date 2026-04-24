# CoachIA

**CoachIA** es un entrenador personal para atletas que combinan ciclismo y gimnasio. Genera rutinas semanales con IA basadas en tu historial real de Strava y gym, te notifica por Telegram cuando hay una rutina nueva, y te deja trackear tus sesiones desde el telefono.

La filosofia: **Strava es la fuente de verdad para ciclismo, la DB para gym**. Sin duplicacion de datos.

Instalable como app nativa en Android/iOS via PWA.

---

## Features

### PWA (Progressive Web App)
- Instalable en Android/iOS desde Chrome — icono en el launcher, pantalla completa, sin barra del browser.
- Service worker con cache network-first para soporte offline basico.
- Iconos generados desde el personaje mascota de la app.

### Generacion de rutinas con IA (Gemini)
- Toma tu historial real: PRs, volumen historico, ultimas 5 salidas de Strava, YTD stats.
- Aplica periodizacion semanal obligatoria: sabado = fondo largo prioritario, piernas 72h+ antes del sabado, recovery ride post-piernas.
- Requiere tu aprobacion antes de activar una rutina (flujo `pending_approval`).

### Entrenamiento del dia (`/workout/today`) — Estilo Hevy
- **Foco en un ejercicio a la vez** con navegacion lateral entre ejercicios.
- **Set por set**: ingresa peso y reps, toca "Completar Set" con checkmark.
- **Rest timer automatico** (90s) entre sets, con countdown visual y boton "Saltar".
- **"Siguiente:"** preview mostrando el proximo ejercicio.
- **Barra de progreso** global (series completadas / total).
- **Auto-fill** del peso de la ultima sesion.
- **Persistencia en localStorage** — si cerras la app, al volver restaura donde quedaste.
- **Proteccion contra data loss** — warning al cerrar la pestana o navegar con sets sin guardar.
- **Bici**: vista informativa (objetivo + zona). Los datos reales vienen de Strava.

### Vista semanal (`/routine/week`)
- Acordeon por dia: el dia actual se abre por defecto, el resto colapsados con resumen.
- Checkboxes de Creatina y Finalizado con toggles independientes.
- Highlight del dia actual con borde ambar.

### Metricas (`/metrics`)
- Count-up animation en todos los numeros (~900ms easeOutExpo, respeta prefers-reduced-motion).
- 4 cards de gym (ambar): volumen, record sentadilla, sesiones, series.
- 4 cards de cycling (cyan, desde Strava): km/ano, horas/ano, ride mas largo, desnivel.
- Detalle de todos los PRs en `/metrics/records`.
- Weight chart (Xiaomi S400 → openScale MQTT → n8n).

### UX mobile
- Bottom navigation bar fijo con 4 destinos (Dashboard, Rutina, Hoy, Metricas).
- Toast notifications (react-hot-toast) en lugar de alerts bloqueantes.
- FAB flotante se oculta cuando el teclado virtual esta abierto.
- Transiciones suaves entre rutas (fade + slide-up).
- Focus states accesibles (keyboard-only).
- Dashboard grid responsive: 1 columna en celulares chicos, 2 en phones grandes, 3 en desktop.

### Nutricion ciclismo (`/nutrition`)
- Guia de fueling para salidas largas con productos argentinos (Arcor, Hidromax, Granix).
- Tabla de contenidos con navegacion por anclas a cada seccion.

### Notificaciones
- Telegram bot para avisos de rutinas generadas y resumenes semanales.
- Toast notifications in-app para feedback de acciones (guardar, errores, etc.).

---

## Stack

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router + Turbopack) |
| UI | React 19, Tailwind 4, lucide-react, recharts, react-hot-toast |
| Auth | NextAuth.js |
| DB | SQLite + Prisma |
| IA | Google Gemini (`gemini-flash-latest`) |
| Notificaciones | Telegram Bot API |
| PWA | Web App Manifest + Service Worker |
| Deploy | Docker Compose |

---

## Fuentes de datos

| Fuente | Estado | Datos |
|--------|--------|-------|
| Strava | Integrado (OAuth) | Rides, potencia (iGPSport BSC300T), FC, distancia, desnivel |
| Telegram | Integrado | Notificaciones de rutinas |
| Xiaomi S400 | Pipeline MQTT via openScale + n8n | Peso y composicion corporal |
| Samsung Health / Galaxy Watch 7 | Pendiente | Pasos, entrenamientos de gym |

---

## Setup local

Este proyecto se corre **exclusivamente con Docker Compose** — Prisma tiene problemas de permisos (EPERM) al correrlo con npm directo en Windows.

### 1. Clonar y preparar `.env`

Crea un archivo `.env` en la raiz del proyecto con:

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

Despues de cambios en `prisma/schema.prisma`, aplicalos **dentro del container**:

```bash
docker exec coachia-coach-ia-1 npx prisma db push
```

### 4. Instalar como PWA en Android

1. Abri la app en Chrome
2. Menu (tres puntos) → "Instalar app"
3. En Xiaomi/MIUI: habilitar primero "Crear accesos directos en pantalla de inicio" en Ajustes → Apps → Chrome → Otros permisos

---

## Estructura del proyecto

```
src/
  app/
    manifest.ts              PWA manifest
    layout.tsx               Root layout (viewport, PWA meta, SW registration)
    page.tsx                 Dashboard
    auth/                    Login + Register
    workout/today/           Gym tracker (Hevy-style) + Cycling view
    routine/                 Week view, Generate, Pending approval, Load JSON
    metrics/                 Stats dashboard + Personal records
    nutrition/               Cycling fuel guide
    help/                    FAQ
    api/                     All API routes
  components/
    Providers.tsx            SessionProvider + ThemeProvider + Toaster
    Header.tsx               Desktop navbar
    BottomNav.tsx            Mobile bottom nav (4 tabs)
    BackLink.tsx             Back navigation
    CountUp.tsx              Animated counter (respects reduced-motion)
  lib/
    auth.ts, prisma.ts, strava.ts, telegram.ts, internal-auth.ts
public/
  sw.js                      Service worker
  icons/                     PWA icons
  fondo.png                  Background character
```

---

## Notas

- **Docker restart**: `docker compose restart` despues de cambios en codigo — HMR no detecta cambios de forma confiable a traves del volume mount.
- **Docker recreate**: `docker compose up -d --force-recreate` cuando cambies vars de entorno (restart NO relee docker-compose.yml).
- **Strava**: re-autoriza keys automaticamente si detecta leaks en repos publicos. Mantene `.env` siempre gitignored.
- **Gemini**: usa el alias `gemini-flash-latest` para evitar roturas cuando Google mueve modelos dentro/fuera del free tier.
- **Dev indicator**: desactivado en `next.config.ts` (`devIndicators: false`).

---

## Pendientes

- Integracion Samsung Health / Galaxy Watch 7 (pasos, gym)
- Dashboard unificado agregando todas las fuentes de datos
- Plan mensual adaptativo — ajuste de cargas segun fatiga y adherencia
- Purgar API keys viejas del git history (las keys ya estan rotadas pero quedaron en commits)
