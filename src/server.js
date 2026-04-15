const path = require("path");
const express = require("express");
const pool = require("./db");

const app = express();
const port = Number(process.env.PORT || 3000);
const validStatuses = new Set(["open", "in_progress", "done"]);
const validPriorities = new Set(["green", "orange", "red"]);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/tasks", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, description, status, created_at, in_progress_at, done_at, priority FROM tasks ORDER BY created_at DESC"
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron obtener las tareas" });
  }
});

app.get("/api/tasks/recent-closed", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, title, done_at FROM tasks WHERE status = 'done' AND done_at IS NOT NULL ORDER BY done_at DESC LIMIT 10"
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron obtener las tareas cerradas" });
  }
});

app.post("/api/tasks", async (req, res) => {
  const { title, description = "" } = req.body;
  if (!title || typeof title !== "string" || title.trim().length < 2) {
    return res.status(400).json({ error: "El titulo debe tener al menos 2 caracteres" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO tasks (title, description, status, priority) VALUES ($1, $2, $3, $4) RETURNING id, title, description, status, created_at, in_progress_at, done_at, priority",
      [title.trim(), String(description).trim(), "open", "green"]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: "No se pudo crear la tarea" });
  }
});

app.patch("/api/tasks/:id/status", async (req, res) => {
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
      "SELECT id, in_progress_at, done_at FROM tasks WHERE id = $1",
      [id]
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
       WHERE id = $4
       RETURNING id, title, description, status, created_at, in_progress_at, done_at, priority`,
      [status, inProgressAt, doneAt, id]
    );
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("PATCH /api/tasks/:id/status", error);
    return res.status(500).json({ error: "No se pudo actualizar la tarea" });
  }
});

app.patch("/api/tasks/:id/priority", async (req, res) => {
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
       WHERE id = $2
       RETURNING id, title, description, status, created_at, in_progress_at, done_at, priority`,
      [priority, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: "No se pudo actualizar la prioridad" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID invalido" });
  }

  try {
    const statusResult = await pool.query("SELECT status FROM tasks WHERE id = $1", [id]);
    if (statusResult.rowCount === 0) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }
    if (statusResult.rows[0].status !== "done") {
      return res.status(400).json({ error: "Solo puedes eliminar tareas en Done" });
    }

    await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "No se pudo eliminar la tarea" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function ensureSchema() {
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMP NULL");
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS done_at TIMESTAMP NULL");
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'green'");
}

async function startServer() {
  try {
    await ensureSchema();
    app.listen(port, () => {
      console.log(`App corriendo en http://localhost:${port}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error);
    process.exit(1);
  }
}

startServer();
