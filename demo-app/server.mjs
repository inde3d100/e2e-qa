// Demo app for the e2e-qa skill test: "Corner Bakery orders". It has known bugs on purpose.
// Start: node server.mjs   (PORT default 4810, DEMO_PASSWORD default demo-pass-123)
import http from "node:http";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 4810);
const PASSWORD = process.env.DEMO_PASSWORD || "demo-pass-123";
const sessions = new Set();
let orders = [
  { id: 1, name: "Sourdough loaf", qty: 2 },
  { id: 2, name: "Bread rolls", qty: 12 },
];
let nextId = 3;
const files = {
  "/": ["text/html; charset=utf-8", readFileSync(new URL("./public/index.html", import.meta.url))],
  "/app.js": ["text/javascript; charset=utf-8", readFileSync(new URL("./public/app.js", import.meta.url))],
};

function send(res, code, body, headers = {}) {
  const data = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json", ...headers });
  res.end(data);
}
function sid(req) {
  const m = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || "");
  return m ? m[1] : null;
}
const authed = (req) => sessions.has(sid(req));
async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || "{}"); } catch { return null; }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  if (req.method === "GET" && files[path]) {
    res.writeHead(200, { "content-type": files[path][0] });
    return res.end(files[path][1]);
  }
  if (path === "/api/health") return send(res, 200, { ok: true });
  if (path === "/api/login" && req.method === "POST") {
    const b = await readBody(req);
    if (!b || b.password !== PASSWORD) return send(res, 401, { error: "Wrong password" });
    const id = randomUUID();
    sessions.add(id);
    return send(res, 200, { ok: true }, { "set-cookie": `sid=${id}; HttpOnly; SameSite=Lax; Path=/` });
  }
  if (path === "/api/logout" && req.method === "POST") {
    sessions.delete(sid(req));
    return send(res, 200, { ok: true }, { "set-cookie": "sid=; Max-Age=0; Path=/" });
  }
  if (path === "/api/orders" && req.method === "GET") {
    if (!authed(req)) return send(res, 401, { error: "Please log in" });
    return send(res, 200, orders);
  }
  if (path === "/api/orders" && req.method === "POST") {
    if (!authed(req)) return send(res, 401, { error: "Please log in" });
    const b = await readBody(req);
    if (!b) return send(res, 400, { error: "Bad JSON" });
    if (typeof b.name !== "string" || !b.name.trim()) return send(res, 400, { error: "Name is needed" });
    // Known bug B-1: qty is not checked (0, -5 and "abc" are accepted).
    const order = { id: nextId++, name: b.name.trim(), qty: b.qty };
    await new Promise((r) => setTimeout(r, 150));
    orders.push(order);
    return send(res, 201, order);
  }
  const m = /^\/api\/orders\/(\d+)$/.exec(path);
  if (m && req.method === "DELETE") {
    // Known bug B-2: no login check here.
    const before = orders.length;
    orders = orders.filter((o) => o.id !== Number(m[1]));
    return orders.length < before ? send(res, 204) : send(res, 404, { error: "No such order" });
  }
  send(res, 404, { error: "Not found" });
}).listen(PORT, "127.0.0.1", () => console.log(`demo app on http://127.0.0.1:${PORT}`));
