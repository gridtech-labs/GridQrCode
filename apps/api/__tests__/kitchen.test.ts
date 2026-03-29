import request from "supertest";
import app from "../src/app";
import pool from "../src/db/pool";

let accessToken: string;
let restaurantId: string;
let sessionToken: string;
let qrToken: string;
let menuItemId: string;
let orderId: string;
let orderItemId: string;

beforeAll(async () => {
  const ts = Date.now();

  const reg = await request(app).post("/api/v1/auth/register").send({
    email: `s5_${ts}@test.com`,
    password: "Password1!",
    firstName: "Sprint",
    lastName: "Five",
    restaurantName: `S5 Restaurant ${ts}`,
  });
  expect(reg.status).toBe(201);
  accessToken = reg.body.data.accessToken;
  restaurantId = reg.body.data.user.restaurantId;

  // Create menu item
  const item = await request(app)
    .post("/api/v1/menu/items")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Pasta", price: 14.99, prepTimeMin: 12 });
  menuItemId = item.body.data.item.id;

  // Create table and get QR token
  const tbl = await request(app)
    .post("/api/v1/tables")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ number: "K1", capacity: 4 });
  qrToken = tbl.body.data.table.qrToken;

  // Scan QR to get session
  const scan = await request(app).get(`/api/v1/diner/scan/${qrToken}`);
  sessionToken = scan.body.data.session.sessionToken;

  // Place an order
  const order = await request(app)
    .post(`/api/v1/diner/${restaurantId}/orders`)
    .send({ sessionToken, items: [{ menuItemId, quantity: 1 }] });
  expect(order.status).toBe(201);
  orderId = order.body.data.order.id;
  orderItemId = order.body.data.order.items[0].id;

  // Confirm the order so it shows in kitchen
  await request(app)
    .patch(`/api/v1/orders/${orderId}/status`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ status: "confirmed" });
});

afterAll(async () => { await pool.end(); });

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

// ── Kitchen order list ────────────────────────────────────────

describe("Kitchen: list active orders", () => {
  it("200 — returns active orders for KDS", async () => {
    const res = await request(app)
      .get("/api/v1/kitchen/orders")
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.orders)).toBe(true);
    expect(res.body.data.orders.length).toBeGreaterThan(0);
    // Orders should have items
    const order = res.body.data.orders[0];
    expect(order.items.length).toBeGreaterThan(0);
  });

  it("200 — does not include served or cancelled orders", async () => {
    // Place and immediately serve another order
    const scan2 = await request(app).get(`/api/v1/diner/scan/${qrToken}`);
    const tok2 = scan2.body.data.session.sessionToken;
    const o2 = await request(app)
      .post(`/api/v1/diner/${restaurantId}/orders`)
      .send({ sessionToken: tok2, items: [{ menuItemId, quantity: 1 }] });
    const oid2 = o2.body.data.order.id;

    await request(app).patch(`/api/v1/orders/${oid2}/status`).set(auth()).send({ status: "confirmed" });
    await request(app).patch(`/api/v1/orders/${oid2}/status`).set(auth()).send({ status: "preparing" });
    await request(app).patch(`/api/v1/orders/${oid2}/status`).set(auth()).send({ status: "ready" });
    await request(app).patch(`/api/v1/orders/${oid2}/status`).set(auth()).send({ status: "served" });

    const res = await request(app).get("/api/v1/kitchen/orders").set(auth());
    const servedInList = res.body.data.orders.find((o: { id: string }) => o.id === oid2);
    expect(servedInList).toBeUndefined();
  });

  it("401 — unauthenticated denied", async () => {
    const res = await request(app).get("/api/v1/kitchen/orders");
    expect(res.status).toBe(401);
  });
});

// ── Kitchen stats ─────────────────────────────────────────────

describe("Kitchen: stats", () => {
  it("200 — returns kitchen stats", async () => {
    const res = await request(app).get("/api/v1/kitchen/stats").set(auth());
    expect(res.status).toBe(200);
    const { stats } = res.body.data;
    expect(stats).toHaveProperty("pending");
    expect(stats).toHaveProperty("confirmed");
    expect(stats).toHaveProperty("preparing");
    expect(stats).toHaveProperty("ready");
    expect(stats).toHaveProperty("avgPrepSeconds");
    expect(stats.confirmed).toBeGreaterThan(0);
  });
});

// ── Order item status ─────────────────────────────────────────

describe("Kitchen: update item status", () => {
  it("200 — marks item as preparing", async () => {
    const res = await request(app)
      .patch(`/api/v1/kitchen/orders/${orderId}/items/${orderItemId}`)
      .set(auth())
      .send({ status: "preparing" });
    expect(res.status).toBe(200);
    expect(res.body.data.itemStatus).toBe("preparing");
  });

  it("200 — order status auto-advances to preparing", async () => {
    const res = await request(app).get(`/api/v1/orders/${orderId}`).set(auth());
    expect(res.body.data.order.status).toBe("preparing");
  });

  it("200 — marks item as ready", async () => {
    const res = await request(app)
      .patch(`/api/v1/kitchen/orders/${orderId}/items/${orderItemId}`)
      .set(auth())
      .send({ status: "ready" });
    expect(res.status).toBe(200);
    expect(res.body.data.itemStatus).toBe("ready");
  });

  it("200 — order auto-advances to ready when all items ready", async () => {
    const res = await request(app).get(`/api/v1/orders/${orderId}`).set(auth());
    expect(res.body.data.order.status).toBe("ready");
  });

  it("400 — invalid item status rejected", async () => {
    const res = await request(app)
      .patch(`/api/v1/kitchen/orders/${orderId}/items/${orderItemId}`)
      .set(auth())
      .send({ status: "cooked" });
    expect(res.status).toBe(400);
  });
});

// ── Bump order ────────────────────────────────────────────────

describe("Kitchen: bump order", () => {
  let bumpOrderId: string;
  let bumpItemId: string;

  beforeAll(async () => {
    // New order for bump tests
    const scan = await request(app).get(`/api/v1/diner/scan/${qrToken}`);
    const tok = scan.body.data.session.sessionToken;
    const o = await request(app)
      .post(`/api/v1/diner/${restaurantId}/orders`)
      .send({ sessionToken: tok, items: [{ menuItemId, quantity: 2 }] });
    bumpOrderId = o.body.data.order.id;
    bumpItemId  = o.body.data.order.items[0].id;

    await request(app)
      .patch(`/api/v1/orders/${bumpOrderId}/status`)
      .set(auth()).send({ status: "confirmed" });
  });

  it("200 — bump moves all items to preparing", async () => {
    const res = await request(app)
      .patch(`/api/v1/kitchen/orders/${bumpOrderId}/bump`)
      .set(auth());
    expect(res.status).toBe(200);
    const items = res.body.data.order.items;
    expect(items.every((i: { status: string }) => i.status === "preparing")).toBe(true);
  });

  it("200 — second bump moves all items to ready", async () => {
    const res = await request(app)
      .patch(`/api/v1/kitchen/orders/${bumpOrderId}/bump`)
      .set(auth());
    expect(res.status).toBe(200);
    const items = res.body.data.order.items;
    expect(items.every((i: { status: string }) => i.status === "ready")).toBe(true);
  });
});
