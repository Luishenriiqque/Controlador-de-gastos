const form = document.querySelector("#expenseForm");
const expenseIdInput = document.querySelector("#expenseId");
const titleInput = document.querySelector("#title");
const amountInput = document.querySelector("#amount");
const dateInput = document.querySelector("#date");
const categoryInput = document.querySelector("#category");
const paymentMethodInput = document.querySelector("#paymentMethod");
const notesInput = document.querySelector("#notes");
const formMessage = document.querySelector("#formMessage");
const formTitle = document.querySelector("#formTitle");
const cancelEditButton = document.querySelector("#cancelEditButton");
const expenseList = document.querySelector("#expenseList");
const filterCategory = document.querySelector("#filterCategory");
const filterMonth = document.querySelector("#filterMonth");
const searchInput = document.querySelector("#search");
const totalAmount = document.querySelector("#totalAmount");
const todayAmount = document.querySelector("#todayAmount");
const monthAmount = document.querySelector("#monthAmount");
const countAmount = document.querySelector("#countAmount");
const installButton = document.querySelector("#installButton");

let expenses = [];
let deferredInstallPrompt = null;
const LOCAL_STORAGE_KEY = "gastos-app-expenses";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthISO() {
  return todayISO().slice(0, 7);
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFilteredExpenses() {
  const category = filterCategory.value;
  const month = filterMonth.value;
  const query = searchInput.value.trim().toLowerCase();

  return expenses.filter((expense) => {
    const categoryMatches = category === "Todas" || expense.category === category;
    const monthMatches = !month || expense.date.startsWith(month);
    const queryMatches =
      !query ||
      expense.title.toLowerCase().includes(query) ||
      expense.category.toLowerCase().includes(query) ||
      String(expense.notes || "").toLowerCase().includes(query);

    return categoryMatches && monthMatches && queryMatches;
  });
}

function sum(values) {
  return values.reduce((total, expense) => total + Number(expense.amount), 0);
}

function renderCategoryOptions() {
  const categories = [...new Set(expenses.map((expense) => expense.category))].sort();
  const current = filterCategory.value || "Todas";

  filterCategory.innerHTML = [
    '<option value="Todas">Todas</option>',
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
  ].join("");

  filterCategory.value = categories.includes(current) ? current : "Todas";
}

function renderSummary(filtered) {
  const today = todayISO();
  const month = currentMonthISO();

  totalAmount.textContent = currency.format(sum(filtered));
  todayAmount.textContent = currency.format(sum(expenses.filter((expense) => expense.date === today)));
  monthAmount.textContent = currency.format(sum(expenses.filter((expense) => expense.date.startsWith(month))));
  countAmount.textContent = String(filtered.length);
}

function renderExpenses() {
  renderCategoryOptions();

  const filtered = getFilteredExpenses();
  renderSummary(filtered);

  if (!filtered.length) {
    expenseList.innerHTML = '<div class="empty-state">Nenhum gasto encontrado.</div>';
    return;
  }

  expenseList.innerHTML = filtered
    .map(
      (expense) => `
        <article class="expense-item">
          <div class="expense-main">
            <h3>${escapeHtml(expense.title)}</h3>
            <div class="expense-meta">
              <span class="pill">${escapeHtml(expense.category)}</span>
              <span>${formatDate(expense.date)}</span>
              <span>${escapeHtml(expense.paymentMethod)}</span>
              ${expense.notes ? `<span>${escapeHtml(expense.notes)}</span>` : ""}
            </div>
          </div>
          <div class="expense-side">
            <span class="expense-amount">${currency.format(expense.amount)}</span>
            <div class="actions">
              <button class="icon-button" type="button" data-action="edit" data-id="${expense.id}" title="Editar">Editar</button>
              <button class="icon-button delete-button" type="button" data-action="delete" data-id="${expense.id}" title="Excluir">Excluir</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function localExpenses() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalExpenses(nextExpenses) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextExpenses));
}

function sortExpenses(items) {
  return [...items].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

function localId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadExpenses() {
  expenses = sortExpenses(localExpenses());
  renderExpenses();
}

function getFormPayload() {
  return {
    title: titleInput.value,
    amount: amountInput.value,
    date: dateInput.value,
    category: categoryInput.value,
    paymentMethod: paymentMethodInput.value,
    notes: notesInput.value
  };
}

function resetForm() {
  form.reset();
  dateInput.value = todayISO();
  expenseIdInput.value = "";
  formTitle.textContent = "Adicionar gasto";
  cancelEditButton.classList.add("hidden");
  formMessage.textContent = "";
}

function startEdit(expense) {
  expenseIdInput.value = expense.id;
  titleInput.value = expense.title;
  amountInput.value = expense.amount;
  dateInput.value = expense.date;
  categoryInput.value = expense.category;
  paymentMethodInput.value = expense.paymentMethod;
  notesInput.value = expense.notes || "";
  formTitle.textContent = "Editar gasto";
  cancelEditButton.classList.remove("hidden");
  titleInput.focus();
}

async function saveExpense(event) {
  event.preventDefault();
  formMessage.textContent = "";

  const id = expenseIdInput.value;
  const payload = getFormPayload();

  const currentExpenses = localExpenses();
  const nextExpense = {
    id: id || localId(),
    ...payload,
    amount: Math.round(Number(payload.amount) * 100) / 100,
    createdAt: id ? currentExpenses.find((item) => item.id === id)?.createdAt : new Date().toISOString(),
    updatedAt: id ? new Date().toISOString() : undefined
  };

  const nextExpenses = id
    ? currentExpenses.map((expense) => (expense.id === id ? nextExpense : expense))
    : [...currentExpenses, nextExpense];

  saveLocalExpenses(nextExpenses);
  resetForm();
  await loadExpenses();
}

async function deleteExpense(id) {
  saveLocalExpenses(localExpenses().filter((expense) => expense.id !== id));
  await loadExpenses();
}

form.addEventListener("submit", saveExpense);
cancelEditButton.addEventListener("click", resetForm);

expenseList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const expense = expenses.find((item) => item.id === button.dataset.id);
  if (!expense) return;

  if (button.dataset.action === "edit") {
    startEdit(expense);
  }

  if (button.dataset.action === "delete") {
    await deleteExpense(expense.id);
  }
});

[filterCategory, filterMonth, searchInput].forEach((field) => {
  field.addEventListener("input", renderExpenses);
});

dateInput.value = todayISO();
filterMonth.value = currentMonthISO();
loadExpenses();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.classList.remove("hidden");
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.classList.add("hidden");
});
