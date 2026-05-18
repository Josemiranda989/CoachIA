# E2E tests (Playwright)

## Cómo correr

```bash
TEST_USER_EMAIL=tu-usuario@example.com \
TEST_USER_PASSWORD=tu-password \
PLAYWRIGHT_BASE_URL=http://localhost:3001 \
npm run test:e2e
```

Si la app está corriendo en otro lugar (ej. `coachia.jmlabs.app`), cambiá
`PLAYWRIGHT_BASE_URL`. Por defecto `playwright.config.ts` apunta a
`http://localhost:3001` (el contenedor de Docker local).

## Estructura

- `auth.setup.ts` — proyecto `setup`: loguea con `TEST_USER_EMAIL/PASSWORD` y
  guarda el storageState en `.auth/user.json`. Todos los tests del proyecto
  `chromium` lo reusan.
- `smoke-auth-pages.spec.ts` — verifica que cada page auth-required carga sin
  error JS y muestra el copy esperado.
- `public-pages.spec.ts` — mismas verificaciones para las pages sin auth.
  Corre en el proyecto `public` (no usa el storageState).
- `navigation.spec.ts` — interacciones básicas: clickear los links del
  dashboard, BackLink desde /metrics.

## Credenciales

NO se commitean. Se pasan por env vars en cada corrida. El storageState con
las cookies vive en `.auth/user.json` (gitignored). Si cambiás de máquina,
hay que volver a setearlas.

## Cuándo correr

- Antes de mergear un PR que toque UI o routing
- Después de un rebuild de Docker, para confirmar que el deploy carga
- En CI, idealmente como `npm run test:e2e` con env vars del runner
