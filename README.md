# Task Manager

App de tareas estilo Kanban con:

- Node.js + Express
- PostgreSQL
- Docker Compose
- Drag & Drop entre `Open`, `In Progress`, `Done`
- UI oscura con acentos de color
- Prioridad por color (`Low`, `Medium`, `Hight`)
- Login por usuario/clave y sesiones

## Levantar con Docker (recomendado)

```bash
docker compose up --build
```

Luego abre:

`http://localhost:3000`

## Variables de entorno

Si quieres correr sin Docker para Node, copia:

```bash
cp .env.example .env
```

## Desarrollo local (Node fuera de Docker)

1. Levanta solo Postgres con Docker:

```bash
docker compose up db -d
```

2. Instala dependencias:

```bash
npm install
```

3. Ejecuta en modo dev:

```bash
npm run dev
```

## Usuarios y seguridad local

- La app ahora requiere login.
- Si no defines credenciales de admin en `.env`, en local crea por defecto:
  - `usuario`: `admin`
  - `clave`: `admin123`
- Como admin puedes crear usuarios desde la propia interfaz.

## Deploy gratis (Render + Neon)

### 1) Crear base de datos en Neon

- Crea una cuenta en [Neon](https://neon.tech/).
- Crea un proyecto PostgreSQL nuevo.
- Guarda estos datos:
  - `host`
  - `port` (usualmente `5432`)
  - `database`
  - `user`
  - `password`

### 2) Crear Web Service en Render

- Entra a [Render](https://render.com/) y conecta tu GitHub.
- Crea un **New Web Service** usando tu repo `TaskManagement`.
- Configura:
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`
  - **Runtime**: Node

### 3) Variables de entorno en Render

Agrega estas variables:

- `PORT=3000`
- `POSTGRES_HOST=<host de Neon>`
- `POSTGRES_PORT=5432`
- `POSTGRES_USER=<user de Neon>`
- `POSTGRES_PASSWORD=<password de Neon>`
- `POSTGRES_DB=<database de Neon>`
- `POSTGRES_SSL=true`
- `SESSION_SECRET=<una clave larga y unica>`

Opcional (recomendado para Neon), en lugar de las variables `POSTGRES_*`:

- `DATABASE_URL=postgresql://...?...sslmode=require`

### 4) Deploy

- Guarda y despliega.
- Al iniciar, la app crea la tabla `tasks` automáticamente si no existe.
- Cuando termine, Render te da una URL publica.

### 5) Verificacion

- Abre la URL.
- Crea una tarea.
- Muévela entre estados.
- Cambia prioridad con el punto de color.
