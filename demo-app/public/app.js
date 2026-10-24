const $ = (id) => document.getElementById(id);
let orders = [];

async function load() {
  const res = await fetch("/api/orders");
  if (res.status === 401) { $("login").hidden = false; $("main").hidden = true; return; }
  orders = await res.json();
  $("login").hidden = true; $("main").hidden = false;
  render();
}

function render() {
  const q = $("search").value.trim().toLowerCase();
  const list = orders.filter((o) => o.name.toLowerCase().includes(q));
  // Known bug F-1: the name goes into innerHTML, so HTML in a name runs.
  $("orders").innerHTML = list.map((o) => `<li data-id="${o.id}">${o.name} x ${o.qty} <button class="del" aria-label="Delete ${o.id}">Delete</button></li>`).join("");
  $("empty").hidden = list.length > 0;
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: $("password").value }) });
  if (!res.ok) { $("login-error").textContent = "Wrong password"; return; }
  $("login-error").textContent = "";
  $("password").value = "";
  load();
});

$("logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  load();
});

$("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  // Known bug F-2: no guard against a double click, so two orders are made.
  const res = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: $("name").value, qty: Number($("qty").value) }) });
  const data = await res.json();
  // Known bug F-3: the server sends "error", the page reads "message", so it shows "Error: undefined".
  if (!res.ok) { $("add-error").textContent = "Error: " + data.message; return; }
  $("add-error").textContent = "";
  $("name").value = "";
  orders.push(data);
  render();
});

$("orders").addEventListener("click", async (e) => {
  const li = e.target.closest("li");
  if (!e.target.classList.contains("del") || !li) return;
  await fetch(`/api/orders/${li.dataset.id}`, { method: "DELETE" });
  orders = orders.filter((o) => String(o.id) !== li.dataset.id);
  render();
});

$("search").addEventListener("input", render);
load();
