import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTunnelServer, port } from "./tunnel-server.mjs";

const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server.address().port)),
  );
const close = (server) =>
  new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
const get = (port, path, headers = {}, method = "GET", body) =>
  new Promise((resolve, reject) => {
    const req = request(
      { hostname: "127.0.0.1", port, path, method, headers },
      (res) => {
        let text = "";
        res.on("data", (part) => (text += part));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, text }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
async function setup(t, upstream) {
  const dir = await mkdtemp(join(tmpdir(), "habit-tunnel-"));
  await mkdir(join(dir, "assets"));
  for (const [name, data] of [
    ["index.html", "<title>Habit Tracker</title>"],
    ["sw.js", "// network only"],
    ["manifest.webmanifest", "{}"],
    ["assets/test.js", "console.log('app')"],
    [".env", "SECRET=never-public"],
  ])
    await writeFile(join(dir, name), data);
  const api = createServer(
    upstream ??
      ((req, res) => {
        res.end("api");
      }),
  );
  const apiPort = await listen(api);
  const server = createTunnelServer({
    distDir: dir,
    apiPort,
    publicOrigin: "https://test.trycloudflare.com",
  });
  const serverPort = await listen(server);
  t.after(async () => {
    await close(server);
    await close(api);
    await rm(dir, { recursive: true });
  });
  return { serverPort, api, apiPort };
}
test("serves only the built shell, with correct manifest/worker headers and HEAD", async (t) => {
  const { serverPort } = await setup(t);
  const shell = await get(serverPort, "/");
  assert.equal(shell.status, 200);
  assert.equal(shell.headers["cache-control"], "no-store");
  const worker = await get(serverPort, "/sw.js");
  assert.equal(worker.headers["service-worker-allowed"], "/");
  assert.match(worker.headers["content-type"], /javascript/);
  assert.equal(worker.headers["cache-control"], "no-store");
  const manifest = await get(serverPort, "/manifest.webmanifest");
  assert.equal(manifest.headers["content-type"], "application/manifest+json");
  const head = await get(serverPort, "/", {}, "HEAD");
  assert.equal(head.text, "");
  assert.ok(Number(head.headers["content-length"]) > 0);
  const asset = await get(serverPort, "/assets/test.js");
  assert.match(asset.headers["cache-control"], /immutable/);
});
test("preserves exact Origin, cookies, method, JSON body and query without trusting forwarded headers", async (t) => {
  const { serverPort } = await setup(t, (req, res) => {
    let body = "";
    req.on("data", (p) => (body += p));
    req.on("end", () => {
      res.writeHead(201, {
        "Set-Cookie":
          "habit_session=fake; HttpOnly; Secure; SameSite=Strict; Path=/",
        "Cache-Control": "public",
      });
      res.end(
        JSON.stringify({
          path: req.url,
          method: req.method,
          cookie: req.headers.cookie,
          origin: req.headers.origin,
          type: req.headers["content-type"],
          forwarded: req.headers["x-forwarded-for"] ?? null,
          body,
        }),
      );
    });
  });
  const response = await get(
    serverPort,
    "/api/todos?date=2026-10-03",
    {
      host: "test.trycloudflare.com",
      origin: "https://test.trycloudflare.com",
      cookie: "habit_session=fake",
      "content-type": "application/json",
      "x-forwarded-for": "spoof",
      "x-forwarded-host": "spoof",
      forwarded: "for=spoof",
    },
    "POST",
    '{"title":"Test"}',
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(
    response.headers["set-cookie"][0],
    /HttpOnly; Secure; SameSite=Strict/,
  );
  assert.deepEqual(JSON.parse(response.text), {
    path: "/todos?date=2026-10-03",
    method: "POST",
    cookie: "habit_session=fake",
    origin: "https://test.trycloudflare.com",
    type: "application/json",
    forwarded: null,
    body: '{"title":"Test"}',
  });
});
test("never replaces missing or malicious Origin with the trusted public origin", async (t) => {
  const { serverPort } = await setup(t, (req, res) => {
    res.statusCode =
      req.headers.origin === "https://test.trycloudflare.com" ? 200 : 403;
    res.end();
  });
  assert.equal(
    (await get(serverPort, "/api/auth/login", {}, "POST", "{}")).status,
    403,
  );
  assert.equal(
    (
      await get(
        serverPort,
        "/api/auth/login",
        { origin: "https://evil.example" },
        "POST",
        "{}",
      )
    ).status,
    403,
  );
});
test("blocks unknown hosts, source files, dotfiles, traversal and arbitrary proxy routes", async (t) => {
  const { serverPort } = await setup(t);
  assert.equal(
    (await get(serverPort, "/", { host: "evil.example" })).status,
    403,
  );
  for (const path of [
    "/.env",
    "/src/main.ts",
    "/%2eenv",
    "/assets/%2e%2e/.env",
    "/assets/%2e%2e%2f.env",
    "/apiX",
    "/mailpit",
    "/%5c..%5c.env",
  ])
    assert.equal((await get(serverPort, path)).status, 404, path);
  assert.equal((await get(serverPort, "/", {}, "POST")).status, 405);
});
test("unavailable API returns actionable JSON 502, not the SPA shell", async (t) => {
  const { serverPort, api } = await setup(t);
  await close(api);
  const result = await get(serverPort, "/api/auth/me");
  assert.equal(result.status, 502);
  assert.match(JSON.parse(result.text).message, /Backend nicht erreichbar/);
  assert.equal(result.headers["cache-control"], "no-store");
});
test("configuration refuses non-origin URLs and invalid ports", () => {
  for (const publicOrigin of [
    "http://test.trycloudflare.com",
    "https://test.trycloudflare.com/",
    "https://test.trycloudflare.com/path",
    "https://user:pass@test.trycloudflare.com",
  ])
    assert.throws(() => createTunnelServer({ publicOrigin }));
  for (const value of ["0", "65536", "3000evil", "1.5", "-1"])
    assert.throws(() => port(value, 3000));
  assert.equal(port(undefined, 4173), 4173);
});
