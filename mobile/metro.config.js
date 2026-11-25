const { getDefaultConfig } = require("expo/metro-config");
const http = require("node:http");

const config = getDefaultConfig(__dirname);
const enhanceMiddleware = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (metroMiddleware, server) => {
  const next = enhanceMiddleware
    ? enhanceMiddleware(metroMiddleware, server)
    : metroMiddleware;

  return (request, response, done) => {
    if (!request.url?.startsWith("/api/")) {
      return next(request, response, done);
    }

    // Prevent unrelated browser origins from calling the development API.
    const { origin, host } = request.headers;
    if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
      response.writeHead(403).end();
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
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.on("error", () => response.destroy());
        result.pipe(response);
      },
    );

    const isChat = request.url.startsWith("/api/chat");
    upstream.setTimeout(isChat ? 125_000 : 30_000, () => upstream.destroy());
    upstream.on("error", () => {
      if (response.headersSent) return response.destroy();
      response.writeHead(502, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          message:
            "Serveur Location Ennour indisponible. Lancez scripts/Start-Mobile.ps1 sur le PC.",
        }),
      );
    });
    response.on("close", () => {
      if (!response.writableEnded) upstream.destroy();
    });
    request.pipe(upstream);
  };
};

module.exports = config;
