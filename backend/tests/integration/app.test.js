import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "service-role-test-key";
process.env.SUPABASE_ANON_KEY ||= "anon-test-key";
process.env.FRONTEND_URL ||= "https://allowed.example.com";
process.env.PAYSTACK_SECRET_KEY ||= "paystack-test-key";
process.env.PAYSTACK_CALLBACK_URL ||= "https://allowed.example.com/payments/callback";

const { createApp } = await import("../../src/index.js");

async function startServer(app) {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind test server"));
        return;
      }

      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });

    server.on("error", reject);
  });
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test("GET /health returns ok", async () => {
  const app = createApp({ isProduction: false, enableTestRoutes: false });
  const { server, baseUrl } = await startServer(app);

  try {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.status, "ok");
  } finally {
    await stopServer(server);
  }
});

test("test routes are enabled outside production", async () => {
  const app = createApp({ isProduction: false, enableTestRoutes: true });
  const { server, baseUrl } = await startServer(app);

  try {
    const response = await fetch(`${baseUrl}/me`);
    assert.equal(response.status, 401);

    const payload = await response.json();
    assert.equal(payload.message, "Missing or invalid Authorization header");
  } finally {
    await stopServer(server);
  }
});

test("test routes are disabled in production", async () => {
  const app = createApp({
    isProduction: true,
    frontendOrigins: ["https://allowed.example.com"],
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const response = await fetch(`${baseUrl}/me`);
    assert.equal(response.status, 404);

    const payload = await response.json();
    assert.equal(payload.error, "Route not found");
  } finally {
    await stopServer(server);
  }
});

test("production CORS blocks unknown browser origins", async () => {
  const app = createApp({
    isProduction: true,
    frontendOrigins: ["https://allowed.example.com"],
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const blocked = await fetch(`${baseUrl}/health`, {
      headers: {
        Origin: "https://blocked.example.com",
      },
    });
    assert.equal(blocked.status, 403);

    const blockedPayload = await blocked.json();
    assert.equal(blockedPayload.error, "CORS blocked this origin");

    const allowed = await fetch(`${baseUrl}/health`, {
      headers: {
        Origin: "https://allowed.example.com",
      },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://allowed.example.com");
  } finally {
    await stopServer(server);
  }
});

test("production mode fails fast when required env vars are missing", () => {
  const previous = process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYSTACK_SECRET_KEY;

  try {
    assert.throws(
      () => createApp({ isProduction: true }),
      /Missing required environment variables for production/,
    );
  } finally {
    process.env.PAYSTACK_SECRET_KEY = previous;
  }
});
