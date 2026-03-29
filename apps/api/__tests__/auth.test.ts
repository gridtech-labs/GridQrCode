import request from "supertest";
import app from "../src/app";
import pool from "../src/db/pool";

// ── Helpers ───────────────────────────────────────────────────

const baseUser = {
  email: `test_${Date.now()}@example.com`,
  password: "Password123!",
  firstName: "Jane",
  lastName: "Doe",
  restaurantName: `Test Restaurant ${Date.now()}`,
};

async function registerUser(overrides = {}) {
  return request(app)
    .post("/api/v1/auth/register")
    .send({ ...baseUser, ...overrides });
}

// ── Tests ─────────────────────────────────────────────────────

describe("POST /api/v1/auth/register", () => {
  it("201 — creates user + restaurant + returns tokens", async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: expect.any(Number),
      user: {
        email: baseUser.email,
        role: "owner",
        restaurantId: expect.any(String),
      },
    });
    // httpOnly refresh cookie set
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("409 — duplicate email returns conflict", async () => {
    await registerUser();
    const res = await registerUser(); // same email
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("CONFLICT");
  });

  it("400 — weak password rejected", async () => {
    const res = await registerUser({ password: "weak" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(res.body.details.password).toBeDefined();
  });

  it("400 — invalid email rejected", async () => {
    const res = await registerUser({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.details.email).toBeDefined();
  });
});

describe("POST /api/v1/auth/login", () => {
  beforeAll(async () => {
    await registerUser();
  });

  it("200 — valid credentials return tokens", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: baseUser.email, password: baseUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("401 — wrong password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: baseUser.email, password: "WrongPass1!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("INVALID_TOKEN");
  });

  it("401 — unknown email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "unknown@test.com", password: "Password123!" });

    expect(res.status).toBe(401);
  });

  it("400 — missing fields", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: baseUser.email });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  let refreshToken: string;

  beforeAll(async () => {
    const res = await registerUser({
      email: `refresh_${Date.now()}@example.com`,
      restaurantName: `Refresh Test ${Date.now()}`,
    });
    // Extract refresh token from cookie
    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    const match = cookie.match(/refreshToken=([^;]+)/);
    refreshToken = match?.[1] ?? "";
  });

  it("200 — valid refresh token rotates tokens", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it("401 — invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: "bogus_token_xyz" });

    expect(res.status).toBe(401);
  });

  it("401 — missing refresh token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({});

    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/auth/me", () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await registerUser({
      email: `me_${Date.now()}@example.com`,
      restaurantName: `Me Test ${Date.now()}`,
    });
    accessToken = res.body.data.accessToken;
  });

  it("200 — returns current user", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe("owner");
  });

  it("401 — no token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("401 — malformed token", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not.a.jwt");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("200 — logs out and clears cookie", async () => {
    const loginRes = await registerUser({
      email: `logout_${Date.now()}@example.com`,
      restaurantName: `Logout Test ${Date.now()}`,
    });
    const cookie = loginRes.headers["set-cookie"]?.[0] ?? "";
    const match = cookie.match(/refreshToken=([^;]+)/);
    const refreshToken = match?.[1] ?? "";

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/logged out/i);
  });
});

describe("GET /api/v1/health", () => {
  it("200 — health check", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// ── Teardown ──────────────────────────────────────────────────

afterAll(async () => {
  await pool.end();
});
