const appSection = document.getElementById("app-section");
const loginSection = document.getElementById("login-section");
const loginForm = document.getElementById("login-form");
const loginUsernameInput = document.getElementById("login-username");
const loginPasswordInput = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const sessionInfo = document.getElementById("session-info");
const logoutButton = document.getElementById("logout-btn");
const openUserModalButton = document.getElementById("open-user-modal-btn");
const openDeleteUserModalButton = document.getElementById("open-delete-user-modal-btn");
const userModal = document.getElementById("user-modal");
const closeUserModalButton = document.getElementById("close-user-modal-btn");
const userForm = document.getElementById("user-form");
const userFormMessage = document.getElementById("user-form-message");
const newUsernameInput = document.getElementById("new-username");
const newPasswordInput = document.getElementById("new-password");
const newRoleInput = document.getElementById("new-role");
const deleteUserModal = document.getElementById("delete-user-modal");
const closeDeleteUserModalButton = document.getElementById("close-delete-user-modal-btn");
const deleteUserForm = document.getElementById("delete-user-form");
const deleteUserSelect = document.getElementById("delete-user-select");
const deleteUserMessage = document.getElementById("delete-user-message");
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
let currentSession = null;

function setUserModalOpen(open) {
  userModal.classList.toggle("hidden", !open);
  if (!open) {
    setUserFormMessage("", "error");
  }
}

function setDeleteUserModalOpen(open) {
  deleteUserModal.classList.toggle("hidden", !open);
  if (!open) {
    setDeleteUserMessage("", "error");
  }
}

function setLoginError(message) {
  if (!message) {
    loginError.textContent = "";
    loginError.classList.add("hidden");
    return;
  }
  loginError.textContent = message;
  loginError.classList.remove("hidden");
}

function setUserFormMessage(message, type = "error") {
  if (!message) {
    userFormMessage.textContent = "";
    userFormMessage.classList.add("hidden");
    userFormMessage.classList.remove("form-message--error", "form-message--success");
    return;
  }
  userFormMessage.textContent = message;
  userFormMessage.classList.remove("hidden");
  userFormMessage.classList.remove("form-message--error", "form-message--success");
  userFormMessage.classList.add(type === "success" ? "form-message--success" : "form-message--error");
}

function setDeleteUserMessage(message, type = "error") {
  if (!message) {
    deleteUserMessage.textContent = "";
    deleteUserMessage.classList.add("hidden");
    deleteUserMessage.classList.remove("form-message--error", "form-message--success");
    return;
  }
  deleteUserMessage.textContent = message;
  deleteUserMessage.classList.remove("hidden");
  deleteUserMessage.classList.remove("form-message--error", "form-message--success");
  deleteUserMessage.classList.add(type === "success" ? "form-message--success" : "form-message--error");
}

async function loadUsersForDelete() {
  const response = await fetch("/auth/users");
  if (!response.ok) {
    throw new Error("No se pudieron cargar los usuarios");
  }
  const users = await response.json();
  const options = users
    .filter((user) => user.id !== currentSession?.id)
    .map((user) => `<option value="${user.id}">${user.username} (${user.role})</option>`)
    .join("");

  deleteUserSelect.innerHTML = `<option value="">Selecciona un usuario</option>${options}`;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setAuthUI(session) {
  currentSession = session;
  const isLogged = Boolean(session);
  loginSection.classList.toggle("hidden", isLogged);
  appSection.classList.toggle("hidden", !isLogged);
  if (!isLogged) {
    sessionInfo.textContent = "";
    openUserModalButton.classList.add("hidden");
    openDeleteUserModalButton.classList.add("hidden");
    setUserModalOpen(false);
    setDeleteUserModalOpen(false);
    clearBoard();
    return;
  }

  sessionInfo.textContent = `Usuario: ${session.username} (${session.role})`;
  const isAdmin = session.role === "admin";
  openUserModalButton.classList.toggle("hidden", !isAdmin);
  openDeleteUserModalButton.classList.toggle("hidden", !isAdmin);
  if (!isAdmin) {
    setUserModalOpen(false);
    setDeleteUserModalOpen(false);
  }
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

async function getSession() {
  const response = await fetch("/auth/me");
  if (!response.ok) return null;
  return response.json();
}

async function login(event) {
  event.preventDefault();
  setLoginError("");
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  const response = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    setLoginError("Usuario o clave incorrectos.");
    return;
  }

  loginForm.reset();
  const session = await response.json();
  setAuthUI(session);
  await loadTasks();
}

async function logout() {
  await fetch("/auth/logout", { method: "POST" });
  setAuthUI(null);
}

async function createUser(event) {
  event.preventDefault();
  setUserFormMessage("", "error");
  const username = newUsernameInput.value.trim();
  const password = newPasswordInput.value;
  const role = newRoleInput.value;

  const response = await fetch("/auth/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    setUserFormMessage(payload.error || "No se pudo crear el usuario.", "error");
    return;
  }

  userForm.reset();
  setUserFormMessage("Usuario creado correctamente.", "success");
}

async function deleteUser(event) {
  event.preventDefault();
  setDeleteUserMessage("", "error");
  const userId = Number(deleteUserSelect.value);
  if (!Number.isInteger(userId) || userId <= 0) {
    setDeleteUserMessage("Selecciona un usuario valido.", "error");
    return;
  }

  const response = await fetch(`/auth/users/${userId}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    setDeleteUserMessage(payload.error || "No se pudo eliminar el usuario.", "error");
    return;
  }

  setDeleteUserMessage("Usuario eliminado correctamente.", "success");
  await loadUsersForDelete();
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
loginForm.addEventListener("submit", login);
loginUsernameInput.addEventListener("input", () => setLoginError(""));
loginPasswordInput.addEventListener("input", () => setLoginError(""));
logoutButton.addEventListener("click", logout);
openUserModalButton.addEventListener("click", () => setUserModalOpen(true));
openDeleteUserModalButton.addEventListener("click", async () => {
  try {
    await loadUsersForDelete();
    setDeleteUserModalOpen(true);
  } catch (error) {
    setDeleteUserMessage("No se pudo cargar la lista de usuarios.", "error");
    setDeleteUserModalOpen(true);
  }
});
closeUserModalButton.addEventListener("click", () => setUserModalOpen(false));
closeDeleteUserModalButton.addEventListener("click", () => setDeleteUserModalOpen(false));
newUsernameInput.addEventListener("input", () => setUserFormMessage("", "error"));
newPasswordInput.addEventListener("input", () => setUserFormMessage("", "error"));
newRoleInput.addEventListener("change", () => setUserFormMessage("", "error"));
deleteUserSelect.addEventListener("change", () => setDeleteUserMessage("", "error"));
userModal.addEventListener("click", (event) => {
  if (event.target === userModal) {
    setUserModalOpen(false);
  }
});
deleteUserModal.addEventListener("click", (event) => {
  if (event.target === deleteUserModal) {
    setDeleteUserModalOpen(false);
  }
});
userForm.addEventListener("submit", createUser);
deleteUserForm.addEventListener("submit", deleteUser);
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

async function init() {
  const session = await getSession();
  setAuthUI(session);
  if (session) {
    await loadTasks();
  }
}

init();
