# Mission Control Tasks

App de tareas estilo Kanban con:

- Node.js + Express
- PostgreSQL
- Docker Compose
- Drag & Drop entre `Open`, `In Progress`, `Done`
- UI oscura con acentos de color

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
