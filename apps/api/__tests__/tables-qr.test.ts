import request from "supertest";
import app from "../src/app";
import pool from "../src/db/pool";

let accessToken: string;
let restaurantId: string;

beforeAll(async () => {
  const ts = Date.now();
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({
      email: `s3_${ts}@test.com`,
      password: "Password1!",
      firstName: "Sprint",
      lastName: "Three",
      restaurantName: `S3 Restaurant ${ts}`,
    });
  expect(res.status).toBe(201);
  accessToken = res.body.data.accessToken;
  restaurantId = res.body.data.user.restaurantId;
});

afterAll(async () => { await pool.end(); });

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

// ── Areas ─────────────────────────────────────────────────────

describe("Areas CRUD", () => {
  let areaId: string;

  it("201 — create area", async () => {
    const res = await request(app)
      .post("/api/v1/tables/areas")
      .set(auth())
      .send({ name: "Main Floor", sortOrder: 0 });

    expect(res.status).toBe(201);
    expect(res.body.data.area.name).toBe("Main Floor");
    areaId = res.body.data.area.id;
    (global as Record<string, unknown>).__areaId = areaId;
  });

  it("200 — list areas with table counts", async () => {
    const res = await request(app).get("/api/v1/tables/areas").set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.areas)).toBe(true);
    expect(res.body.data.areas[0]).toHaveProperty("tableCount");
  });

  it("200 — update area", async () => {
    const res = await request(app)
      .patch(`/api/v1/tables/areas/${areaId}`)
      .set(auth())
      .send({ name: "Ground Floor" });
    expect(res.status).toBe(200);
    expect(res.body.data.area.name).toBe("Ground Floor");
  });

  it("400 — empty area name rejected", async () => {
    const res = await request(app)
      .post("/api/v1/tables/areas").set(auth()).send({ name: "" });
    expect(res.status).toBe(400);
  });
});

// ── Tables ────────────────────────────────────────────────────

describe("Tables CRUD", () => {
  let tableId: string;
  let qrToken: string;
  const areaId = () => (global as Record<string, unknown>).__areaId as string;

  it("201 — create table with area", async () => {
    const res = await request(app)
      .post("/api/v1/tables")
      .set(auth())
      .send({ number: "T1", name: "Window Table", capacity: 4, areaId: areaId() });

    expect(res.status).toBe(201);
    expect(res.body.data.table.number).toBe("T1");
    expect(res.body.data.table.qrToken).toBeTruthy();
    expect(res.body.data.table.status).toBe("available");
    tableId = res.body.data.table.id;
    qrToken = res.body.data.table.qrToken;
    (global as Record<string, unknown>).__tableId = tableId;
    (global as Record<string, unknown>).__qrToken = qrToken;
  });

  it("201 — create table without area", async () => {
    const res = await request(app)
      .post("/api/v1/tables")
      .set(auth())
      .send({ number: "T2", capacity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.table.areaId).toBeNull();
  });

  it("200 — list all tables", async () => {
    const res = await request(app).get("/api/v1/tables").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.tables.length).toBeGreaterThanOrEqual(2);
  });

  it("200 — list tables filtered by area", async () => {
    const res = await request(app)
      .get(`/api/v1/tables?areaId=${areaId()}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.tables.every((t: { areaId: string }) => t.areaId === areaId())).toBe(true);
  });

  it("200 — get single table", async () => {
    const res = await request(app).get(`/api/v1/tables/${tableId}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.table.id).toBe(tableId);
  });

  it("200 — update table capacity", async () => {
    const res = await request(app)
      .patch(`/api/v1/tables/${tableId}`)
      .set(auth())
      .send({ capacity: 6 });
    expect(res.status).toBe(200);
    expect(res.body.data.table.capacity).toBe(6);
  });

  it("200 — update table status to occupied", async () => {
    const res = await request(app)
      .patch(`/api/v1/tables/${tableId}/status`)
      .set(auth())
      .send({ status: "occupied" });
    expect(res.status).toBe(200);
    expect(res.body.data.table.status).toBe("occupied");
  });

  it("200 — update table status to available", async () => {
    const res = await request(app)
      .patch(`/api/v1/tables/${tableId}/status`)
      .set(auth())
      .send({ status: "available" });
    expect(res.status).toBe(200);
    expect(res.body.data.table.status).toBe("available");
  });

  it("400 — invalid status rejected", async () => {
    const res = await request(app)
      .patch(`/api/v1/tables/${tableId}/status`)
      .set(auth())
      .send({ status: "messy" });
    expect(res.status).toBe(400);
  });

  it("400 — empty number rejected", async () => {
    const res = await request(app)
      .post("/api/v1/tables").set(auth()).send({ number: "" });
    expect(res.status).toBe(400);
  });
});

// ── QR Code ───────────────────────────────────────────────────

describe("QR Code endpoints", () => {
  const tableId = () => (global as Record<string, unknown>).__tableId as string;

  it("200 — download QR as PNG", async () => {
    const res = await request(app)
      .get(`/api/v1/tables/${tableId()}/qr.png`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");
    expect(res.body.length ?? res.headers["content-length"]).toBeTruthy();
  });

  it("200 — download QR as SVG", async () => {
    const res = await request(app)
      .get(`/api/v1/tables/${tableId()}/qr.svg`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("svg");
  });
});

// ── Diner: QR scan ────────────────────────────────────────────

describe("Diner QR Scan (public)", () => {
  const qrToken = () => (global as Record<string, unknown>).__qrToken as string;

  it("200 — scan returns restaurant + table + menu", async () => {
    const res = await request(app)
      .get(`/api/v1/diner/scan/${qrToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.restaurant.id).toBe(restaurantId);
    expect(res.body.data.table).not.toBeNull();
    expect(res.body.data.session).toHaveProperty("sessionToken");
    expect(Array.isArray(res.body.data.menu.categories)).toBe(true);
    expect(Array.isArray(res.body.data.menu.items)).toBe(true);
  });

  it("200 — second scan reuses existing session", async () => {
    const r1 = await request(app).get(`/api/v1/diner/scan/${qrToken()}`);
    const r2 = await request(app).get(`/api/v1/diner/scan/${qrToken()}`);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.data.session.id).toBe(r2.body.data.session.id);
  });

  it("200 — table becomes occupied after scan", async () => {
    // First set it to available
    const tableId = (global as Record<string, unknown>).__tableId as string;
    await request(app)
      .patch(`/api/v1/tables/${tableId}/status`)
      .set(auth())
      .send({ status: "available" });

    // Scan
    await request(app).get(`/api/v1/diner/scan/${qrToken()}`);

    // Check status
    const res = await request(app).get(`/api/v1/tables/${tableId}`).set(auth());
    expect(res.body.data.table.status).toBe("occupied");
  });

  it("404 — invalid token returns 404", async () => {
    const res = await request(app).get("/api/v1/diner/scan/invalid-token-000");
    expect(res.status).toBe(404);
  });

  it("401 — unauthenticated access to table list denied", async () => {
    const res = await request(app).get("/api/v1/tables");
    expect(res.status).toBe(401);
  });
});
