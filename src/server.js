const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const pool = require("./db");

const app = express();
const port = Number(process.env.PORT || 3000);
const validStatuses = new Set(["open", "in_progress", "done"]);
const validPriorities = new Set(["green", "orange", "red"]);

// Render/Heroku-style platforms terminate TLS at proxy level.
app.set("trust proxy", 1);

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-session-secret-change-me",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);
app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "No autenticado" });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (req.session?.role !== "admin") {
    return res.status(403).json({ error: "Acceso restringido a admin" });
  }
  return next();
}

app.get("/auth/me", (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "No autenticado" });
  }
  return res.json({
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role,
  });
});

app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y clave son requeridos" });
  }

  try {
    const result = await pool.query(
      "SELECT id, username, password_hash, role FROM users WHERE username = $1",
      [String(username).trim()]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    return res.json({ id: user.id, username: user.username, role: user.role });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo iniciar sesion" });
  }
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(204).send();
  });
});

app.post("/auth/users", requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role = "user" } = req.body;
  if (!username || String(username).trim().length < 3) {
    return res.status(400).json({ error: "Usuario debe tener minimo 3 caracteres" });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: "Clave debe tener minimo 6 caracteres" });
  }
  if (role !== "user" && role !== "admin") {
    return res.status(400).json({ error: "Rol invalido" });
  }

  try {
    const hash = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at",
      [String(username).trim(), hash, role]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (String(error?.message || "").includes("duplicate key")) {
      return res.status(409).json({ error: "Ese usuario ya existe" });
    }
    return res.status(500).json({ error: "No se pudo crear el usuario" });
  }
});

app.get("/auth/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, role, created_at FROM users ORDER BY created_at ASC"
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron obtener los usuarios" });
  }
});

app.delete("/auth/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID invalido" });
  }
  if (id === req.session.userId) {
    return res.status(400).json({ error: "No puedes eliminar tu propio usuario" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id, username",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    return res.json({ ok: true, deletedUser: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo eliminar el usuario" });
  }
});

app.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, description, status, created_at, in_progress_at, done_at, priority FROM tasks WHERE user_id = $1 ORDER BY created_at DESC",
      [req.session.userId]
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron obtener las tareas" });
  }
});

app.post("/api/tasks", requireAuth, async (req, res) => {
  const { title, description = "" } = req.body;
  if (!title || typeof title !== "string" || title.trim().length < 2) {
    return res.status(400).json({ error: "El titulo debe tener al menos 2 caracteres" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO tasks (user_id, title, description, status, priority) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, description, status, created_at, in_progress_at, done_at, priority",
      [req.session.userId, title.trim(), String(description).trim(), "open", "green"]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: "No se pudo crear la tarea" });
  }
});

app.patch("/api/tasks/:id/status", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID invalido" });
  }
  if (!validStatuses.has(status)) {
    return res.status(400).json({ error: "Estado invalido" });
  }

  try {
    const current = await pool.query(
      "SELECT id, in_progress_at, done_at FROM tasks WHERE id = $1 AND user_id = $2",
      [id, req.session.userId]
    );
    if (current.rowCount === 0) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    const row = current.rows[0];
    let inProgressAt = row.in_progress_at;
    let doneAt = row.done_at;

    if (status === "in_progress" && !inProgressAt) {
      inProgressAt = new Date();
    }
    if (status === "done") {
      doneAt = new Date();
    } else {
      doneAt = null;
    }

    const result = await pool.query(
      `UPDATE tasks
       SET status = $1, in_progress_at = $2, done_at = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, title, description, status, created_at, in_progress_at, done_at, priority`,
      [status, inProgressAt, doneAt, id, req.session.userId]
    );
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: "No se pudo actualizar la tarea" });
  }
});

app.patch("/api/tasks/:id/priority", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { priority } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID invalido" });
  }
  if (!validPriorities.has(priority)) {
    return res.status(400).json({ error: "Prioridad invalida" });
  }

  try {
    const result = await pool.query(
      `UPDATE tasks
       SET priority = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, title, description, status, created_at, in_progress_at, done_at, priority`,
      [priority, id, req.session.userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: "No se pudo actualizar la prioridad" });
  }
});

app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID invalido" });
  }

  try {
    const statusResult = await pool.query(
      "SELECT status FROM tasks WHERE id = $1 AND user_id = $2",
      [id, req.session.userId]
    );
    if (statusResult.rowCount === 0) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }
    if (statusResult.rows[0].status !== "done") {
      return res.status(400).json({ error: "Solo puedes eliminar tareas en Done" });
    }

    await pool.query("DELETE FROM tasks WHERE id = $1 AND user_id = $2", [id, req.session.userId]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "No se pudo eliminar la tarea" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    in_progress_at TIMESTAMP NULL,
    done_at TIMESTAMP NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'green'
  )`);

  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id INTEGER");
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMP NULL");
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_at TIMESTAMP NULL");
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'green'");
}

async function ensureDefaultAdmin() {
  const seedUser = process.env.ADMIN_USERNAME || "admin";
  const seedPass = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "admin123");
  if (!seedPass) return;

  const existing = await pool.query("SELECT id FROM users WHERE username = $1", [seedUser]);
  if (existing.rowCount > 0) return;

  const hash = await bcrypt.hash(seedPass, 10);
  await pool.query(
    "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')",
    [seedUser, hash]
  );
  console.log(`Admin inicial creado: ${seedUser}`);
}

async function assignOrphanTasksToAdmin() {
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const adminResult = await pool.query("SELECT id FROM users WHERE username = $1", [adminUser]);
  if (adminResult.rowCount === 0) return;

  const adminId = adminResult.rows[0].id;
  await pool.query("UPDATE tasks SET user_id = $1 WHERE user_id IS NULL", [adminId]);
}

async function startServer() {
  try {
    await ensureSchema();
    await ensureDefaultAdmin();
    await assignOrphanTasksToAdmin();
    app.listen(port, () => {
      console.log(`App corriendo en http://localhost:${port}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error);
    process.exit(1);
  }
}

startServer();
