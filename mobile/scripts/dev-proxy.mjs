import http from "node:http";

const port = Number(process.env.ATLAS_MOBILE_PROXY_PORT || 5182);
const webPort = Number(process.env.ATLAS_MOBILE_WEB_PORT || 8081);
const host = process.env.ATLAS_MOBILE_BIND || "0.0.0.0";

const server = http.createServer((request, response) => {
  const origin = request.headers.origin;
  // Native requests have no Origin header. Browser previews use this PC's Expo server.
  if (origin) {
    const expected = new URL(`http://${request.headers.host}`).hostname;
    const allowed = [
      `http://localhost:${webPort}`,
      `http://127.0.0.1:${webPort}`,
      `http://${expected}:${webPort}`,
    ];
    if (!allowed.includes(origin)) {
      response.writeHead(403, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          message: "Origine non autorisée pour ce proxy de développement.",
        }),
      );
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    response.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.url === "/mobile-health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ service: "Location Ennour Mobile Proxy" }));
    return;
  }
  if (!request.url?.startsWith("/api/")) {
    response.writeHead(404);
    response.end();
    return;
  }
  const headers = { ...request.headers, host: "127.0.0.1:5180" };
  delete headers.origin;
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: 5180,
      path: request.url,
      method: request.method,
      headers,
    },
    (result) => {
      for (const [name, value] of Object.entries(result.headers)) {
        if (value !== undefined && !name.startsWith("access-control-"))
          response.setHeader(name, value);
      }
      response.writeHead(result.statusCode || 502);
      result.pipe(response);
    },
  );
  upstream.setTimeout(30000, () =>
    upstream.destroy(new Error("Upstream timeout")),
  );
  upstream.on("error", () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        message:
          "API Location Ennour indisponible. Lancez scripts/Start-Local.ps1.",
      }),
    );
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, host, () =>
  console.log(`Location Ennour mobile proxy listening on ${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close();
  });
