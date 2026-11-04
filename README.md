# Mapa Regadores Web

Dashboard web para monitoreo de recorridos GPS de regadores. React + Vite + Leaflet. Conecta con PostgreSQL (esquema `mapa_regadores`) via serverless functions en Vercel.

## Requisitos

- Node.js 18+
- PostgreSQL con el esquema `mapa_regadores` configurado

## Variables de entorno

Crear archivo `.env.local` en la raíz:

```
DATABASE_URL=postgresql://usuario:password@host:5432/db_control_operacional
```

## Instalación

```bash
npm install
```

## Ejecutar en desarrollo

Se necesitan **2 terminales**:

**Terminal 1** — API local (serverless functions):
```bash
node api-server.mjs
```
Levanta los endpoints en `http://localhost:3001`.

**Terminal 2** — Frontend Vite:
```bash
npm run dev
```
Abre en `http://localhost:5173`. Vite hace proxy de `/api` al puerto 3001 automáticamente.

## Build para producción

```bash
npm run build
```

Genera la carpeta `dist/`.

## Estructura

```
src/
  App.tsx              — Layout principal y lógica de filtrado
  components/
    MapView.tsx        — Mapa Leaflet con tracks GPS
    Sidebar.tsx        — Panel lateral con sesiones
    UsersAdmin.tsx     — Gestión de usuarios autorizados
    DevicesAdmin.tsx   — Gestión de dispositivos
    AreasAdmin.tsx     — Maestro de áreas (Campo, Transporte, Almacén)
    ReportesView.tsx   — Reportes y exportación Excel
    AlertsBell.tsx     — Campana de alertas
    LoginPage.tsx      — Login con Microsoft
  services/
    api.ts             — Cliente HTTP para todos los endpoints
    kmzLoader.ts       — Carga de polígonos KMZ
    msalConfig.ts      — Configuración Microsoft Auth
api/
  sessions.ts          — Endpoint sesiones
  points.ts            — Endpoint puntos GPS
  dispositivos.ts      — Endpoint dispositivos
  usuarios.ts          — Endpoint usuarios
  areas.ts             — Endpoint áreas
  paradas.ts           — Endpoint paradas
  parada-fotos.ts      — Endpoint fotos de paradas
  alertas.ts           — Endpoint alertas
```

## Deploy

Desplegado en Vercel. Push a `main` despliega automáticamente. Las funciones en `api/` se despliegan como serverless functions.
