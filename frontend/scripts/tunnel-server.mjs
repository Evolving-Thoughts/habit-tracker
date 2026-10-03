import { createServer, request } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const hopHeaders = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];
function safeHeaders(headers) {
  const result = { ...headers };
  const nominated = String(headers.connection ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  for (const name of [...hopHeaders, ...nominated]) delete result[name];
  // The backend deliberately uses the socket IP for limits, not untrusted forwarding headers.
  for (const name of Object.keys(result))
    if (
      name === "forwarded" ||
      name.startsWith("x-forwarded-") ||
      name === "cf-connecting-ip"
    )
      delete result[name];
  return result;
}
export function port(value, fallback) {
  const text = String(value ?? fallback);
  if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 65535)
    throw new Error("Port must be an integer between 1 and 65535");
  return Number(text);
}
function originHost(value) {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.origin !== value ||
    url.username ||
    url.password
  )
    throw new Error(
      "TUNNEL_ORIGIN must be an exact HTTPS origin without a trailing slash",
    );
  return url.host;
}
export function createTunnelServer({
  distDir,
  apiPort = 3000,
  publicOrigin,
} = {}) {
  const root = resolve(
    distDir ?? fileURLToPath(new URL("../dist", import.meta.url)),
  );
  const targetPort = port(apiPort, 3000);
  const publicHost = originHost(publicOrigin);
  const server = createServer(async (req, res) => {
    const reply = (status, message) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ message }));
    };
    try {
      const localPort = server.address()?.port;
      const allowed = [
        `127.0.0.1:${localPort}`,
        `localhost:${localPort}`,
        publicHost,
      ].filter(Boolean);
      if (!allowed.includes(req.headers.host))
        return reply(403, "Unknown host");
      const rawPath = req.url ?? "/";
      if (!rawPath.startsWith("/") || rawPath.startsWith("//"))
        return reply(400, "Invalid path");
      const url = new URL(rawPath, "http://localhost");
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
        const headers = safeHeaders(req.headers);
        headers.host = `127.0.0.1:${targetPort}`;
        // Preserve Origin, Cookie, Content-Type and upstream Set-Cookie. Never manufacture a trusted Origin.
        const upstream = request(
          {
            hostname: "127.0.0.1",
            port: targetPort,
            path: (url.pathname.slice(4) || "/") + url.search,
            method: req.method,
            headers,
          },
          (result) => {
            res.writeHead(result.statusCode ?? 502, {
              ...safeHeaders(result.headers),
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
            });
            result.on("error", () => res.destroy());
            result.pipe(res);
          },
        );
        upstream.setTimeout(15_000, () =>
          upstream.destroy(new Error("Upstream timeout")),
        );
        upstream.on("error", () =>
          reply(
            502,
            "Backend nicht erreichbar. Prüfe den lokalen Backend-Prozess.",
          ),
        );
        req.on("aborted", () => upstream.destroy());
        res.on("close", () => {
          if (!res.writableFinished) upstream.destroy();
        });
        req.pipe(upstream);
        return;
      }
      if (!["GET", "HEAD"].includes(req.method))
        return reply(405, "Method not allowed");
      let path;
      try {
        path = decodeURIComponent(url.pathname);
      } catch {
        return reply(400, "Invalid path");
      }
      if (
        path.includes("\\") ||
        path.includes("\0") ||
        path.split("/").some((part) => part.startsWith("."))
      )
        return reply(404, "Not found");
      const name = path === "/" ? "/index.html" : path;
      // Serve built app files only. Never expose source, .env, Mailpit or another local service.
      if (!(
        name.startsWith("/assets/") ||
        [
          "/index.html",
          "/sw.js",
          "/manifest.webmanifest",
          "/favicon.svg",
          "/icon-192.svg",
          "/icon-512.svg",
        ].includes(name)
      ))
        return reply(404, "Not found");
      const filename = resolve(root, `.${name}`);
      if (!filename.startsWith(root + sep)) return reply(404, "Not found");
      let info;
      try {
        info = await stat(filename);
      } catch {
        return reply(404, "Not found");
      }
      if (!info.isFile()) return reply(404, "Not found");
      const body = req.method === "HEAD" ? undefined : await readFile(filename);
      res.writeHead(200, {
        "Content-Type": types[extname(filename)] ?? "application/octet-stream",
        "Content-Length": info.size,
        "Cache-Control": name.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        ...(name === "/sw.js" ? { "Service-Worker-Allowed": "/" } : {}),
      });
      res.end(body);
    } catch {
      reply(500, "Local app server error");
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 20_000;
  return server;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const distDir = fileURLToPath(new URL("../dist", import.meta.url));
  await stat(resolve(distDir, "index.html")).catch(() => {
    throw new Error("Build the frontend first: npm run build");
  });
  const listenPort = port(process.env.TUNNEL_PORT, 4173);
  const server = createTunnelServer({
    distDir,
    apiPort: process.env.TUNNEL_API_PORT ?? 3000,
    publicOrigin: process.env.TUNNEL_ORIGIN,
  });
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(listenPort, "127.0.0.1", () => {
    console.log(
      `Built app: http://127.0.0.1:${listenPort}; API: loopback:${process.env.TUNNEL_API_PORT ?? 3000}`,
    );
    console.log(
      process.env.TUNNEL_ORIGIN
        ? `Allowed HTTPS origin: ${process.env.TUNNEL_ORIGIN}`
        : "Local-only until TUNNEL_ORIGIN is set. See docs/pwa-and-tunnel.md.",
    );
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      server.close();
      server.closeAllConnections();
    });
}
