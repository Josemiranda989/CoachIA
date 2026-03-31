# CoachIA

**CoachIA** es un entrenador personal inteligente que agrega datos de múltiples fuentes (Strava, Samsung Health, Xiaomi) para generar planes de entrenamiento personalizados mediante IA.

Diseñado para atletas que combinan ciclismo y gimnasio, CoachIA unifica métricas de rendimiento, carga de entrenamiento y composición corporal en un único dashboard, y usa esa información para ofrecer coaching basado en datos reales.

---

## Dispositivos y fuentes de datos soportadas

| Fuente | Datos |
|--------|-------|
| Strava | Actividades de ciclismo, potencia, ritmo cardíaco (iGPSport BSC300T) |
| Samsung Health / Galaxy Watch 7 | Pasos diarios, entrenamientos de fuerza/gym |
| Xiaomi S400 (báscula) | Peso corporal, composición corporal |

---

## Estado del proyecto

### Completado

- [x] Autenticación con NextAuth (Google OAuth)
- [x] Integración Strava OAuth — sincronización de actividades de ciclismo
- [x] Vista `/metrics` con datos de actividades de Strava
- [x] Gestión de rutinas y entrenamientos (CRUD básico)
- [x] Navbar rediseñado (esquema de colores rojo/gris/blanco)
- [x] Fixes de layout en `/workout/today`
- [x] Dockerización del proyecto

### Pendiente — Integraciones de datos

- [ ] **Samsung Health / Galaxy Watch 7** — importar pasos diarios y sesiones de entrenamiento de pesas
- [ ] **Xiaomi S400** — importar registros de peso y composición corporal
- [ ] **Dashboard unificado** — agregar métricas de todas las fuentes en una sola vista

### Pendiente — AI Coach (objetivo final)

- [ ] Diseñar modelo de datos para planes de entrenamiento (estructura semanal/mensual)
- [ ] UI para visualizar y editar planes generados por la IA
- [ ] Motor de generación de planes: integrar LLM con contexto de:
  - Historial de ciclismo y HR de Strava/iGPSport BSC300T
  - Datos de pasos y gym del Galaxy Watch 7
  - Peso y composición corporal del Xiaomi S400
  - Historial de entrenamientos y progresión en el tiempo
- [ ] Recomendaciones adaptativas (ajustes según fatiga, adherencia y progreso)

---

## Primeros pasos

### Desarrollo local

```bash
npm run dev
# o
yarn dev
# o
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

### Con Docker

```bash
docker-compose up --build
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

---

## Stack tecnológico

- [Next.js](https://nextjs.org) — framework principal
- [Prisma](https://www.prisma.io) — ORM y esquema de base de datos
- [NextAuth.js](https://next-auth.js.org) — autenticación
- [Strava API](https://developers.strava.com) — integración de ciclismo

---

## Recursos

- [Documentación de Next.js](https://nextjs.org/docs)
- [Tutorial interactivo de Next.js](https://nextjs.org/learn)
