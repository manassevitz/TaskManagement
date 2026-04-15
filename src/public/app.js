const form = document.getElementById("task-form");
const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");

const columns = {
  open: document.getElementById("open"),
  in_progress: document.getElementById("in_progress"),
  done: document.getElementById("done"),
};
const priorityCycle = {
  green: "orange",
  orange: "red",
  red: "green",
};

function formatDate(dateString) {
  return new Date(dateString).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createTaskCard(task) {
  const card = document.createElement("div");
  card.className = "task-card";
  card.dataset.id = String(task.id);
  const priority = task.priority || "green";
  const priorityLabel = priority === "red" ? "Hight" : priority === "orange" ? "Medium" : "Low";
  const closeVariant =
    task.status === "open" ? "close-btn--open" : task.status === "in_progress" ? "close-btn--in-progress" : "";
  const closeButton =
    task.status !== "done"
      ? `<button class="close-btn ${closeVariant}" type="button" data-action="close">Cerrar</button>`
      : "";
  const deleteButton =
    task.status === "done"
      ? `<button class="delete-btn" type="button" data-action="delete">Eliminar</button>`
      : "";
  card.innerHTML = `
    <div class="task-top-row">
      <button class="priority-dot priority-dot--${priority}" type="button" data-action="priority" title="Cambiar importancia"></button>
      <span class="priority-label">${priorityLabel}</span>
    </div>
    <h3>${task.title}</h3>
    <p>${task.description || "Sin descripcion"}</p>
    <small>Creada: ${formatDate(task.created_at)}</small>
    <small>In Progress: ${task.in_progress_at ? formatDate(task.in_progress_at) : "-"}</small>
    <small>Cerrada: ${task.done_at ? formatDate(task.done_at) : "-"}</small>
    ${closeButton}
    ${deleteButton}
  `;
  return card;
}

function clearBoard() {
  Object.values(columns).forEach((column) => {
    column.innerHTML = "";
  });
}

async function loadTasks() {
  const response = await fetch("/api/tasks");
  const tasks = await response.json();
  clearBoard();
  tasks.forEach((task) => {
    const card = createTaskCard(task);
    columns[task.status]?.appendChild(card);
  });
}

async function createTask(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  if (title.length < 2) return;

  await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });

  form.reset();
  await loadTasks();
}

async function updateTaskStatus(taskId, status) {
  const response = await fetch(`/api/tasks/${taskId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error("No se pudo actualizar el estado");
  }
}

async function updateTaskPriority(taskId, priority) {
  const response = await fetch(`/api/tasks/${taskId}/priority`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priority }),
  });
  if (!response.ok) {
    throw new Error("No se pudo actualizar la prioridad");
  }
}

async function deleteTask(taskId) {
  await fetch(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });
  await loadTasks();
}

function setupDragAndDrop() {
  Object.values(columns).forEach((column) => {
    new Sortable(column, {
      group: "tasks-board",
      animation: 170,
      draggable: ".task-card",
      filter: "button, .close-btn, .delete-btn",
      preventOnFilter: false,
      onEnd: async (evt) => {
        if (evt.from === evt.to) return;
        const taskId = Number(evt.item.dataset.id);
        const newStatus = evt.to.dataset.status;
        if (!Number.isInteger(taskId) || !newStatus) {
          await loadTasks();
          return;
        }

        try {
          await updateTaskStatus(taskId, newStatus);
          await loadTasks();
        } catch (error) {
          window.alert("No se pudo mover la tarea. Intenta de nuevo.");
          await loadTasks();
        }
      },
    });
  });
}

form.addEventListener("submit", createTask);
document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  if (action !== "delete" && action !== "close" && action !== "priority") return;

  const card = target.closest(".task-card");
  if (!card) return;

  const taskId = Number(card.dataset.id);
  if (!Number.isInteger(taskId)) return;

  if (action === "priority") {
    const currentPriority = target.classList.contains("priority-dot--red")
      ? "red"
      : target.classList.contains("priority-dot--orange")
        ? "orange"
        : "green";
    const nextPriority = priorityCycle[currentPriority];
    try {
      await updateTaskPriority(taskId, nextPriority);
      await loadTasks();
    } catch (error) {
      window.alert("No se pudo cambiar la importancia. Intenta de nuevo.");
    }
    return;
  }

  if (action === "close") {
    try {
      await updateTaskStatus(taskId, "done");
      await loadTasks();
    } catch (error) {
      window.alert("No se pudo cerrar la tarea. Intenta de nuevo.");
    }
    return;
  }

  const confirmed = window.confirm("Quieres eliminar esta tarea terminada?");
  if (!confirmed) return;

  await deleteTask(taskId);
});
setupDragAndDrop();
loadTasks();
