import request from "supertest";
import app from "../src/app";
import pool from "../src/db/pool";

let accessToken: string;
let restaurantId: string;
let sessionToken: string;
let qrToken: string;
let categoryId: string;
let menuItemId: string;
let orderId: string;

beforeAll(async () => {
  const ts = Date.now();

  // Register restaurant
  const reg = await request(app).post("/api/v1/auth/register").send({
    email: `s4_${ts}@test.com`,
    password: "Password1!",
    firstName: "Sprint",
    lastName: "Four",
    restaurantName: `S4 Restaurant ${ts}`,
  });
  expect(reg.status).toBe(201);
  accessToken = reg.body.data.accessToken;
  restaurantId = reg.body.data.user.restaurantId;

  // Create a category
  const cat = await request(app)
    .post("/api/v1/menu/categories")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Mains" });
  categoryId = cat.body.data.category.id;

  // Create a menu item
  const item = await request(app)
    .post("/api/v1/menu/items")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Burger", price: 12.99, categoryId, prepTimeMin: 15 });
  menuItemId = item.body.data.item.id;

  // Create a table (generates qrToken)
  const tbl = await request(app)
    .post("/api/v1/tables")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ number: "T1", capacity: 4 });
  qrToken = tbl.body.data.table.qrToken;

  // Scan QR to create a diner session
  const scan = await request(app).get(`/api/v1/diner/scan/${qrToken}`);
  expect(scan.status).toBe(200);
  sessionToken = scan.body.data.session.sessionToken;
});

afterAll(async () => { await pool.end(); });

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

// ── Place order ───────────────────────────────────────────────

describe("Place Order (diner)", () => {
  it("201 — places a valid order", async () => {
    const res = await request(app)
      .post(`/api/v1/diner/${restaurantId}/orders`)
      .send({
        sessionToken,
        items: [{ menuItemId, quantity: 2, notes: "No onions" }],
        notes: "Window table",
      });

    expect(res.status).toBe(201);
    const order = res.body.data.order;
    expect(order.status).toBe("pending");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);
    expect(order.items[0].itemName).toBe("Burger");
    expect(order.subtotal).toBeCloseTo(25.98);
    expect(order.orderNumber).toMatch(/^\d{6}-\d{3}$/);
    orderId = order.id;
    (global as Record<string, unknown>).__orderId = orderId;
  });

  it("400 — rejects empty items array", async () => {
    const res = await request(app)
      .post(`/api/v1/diner/${restaurantId}/orders`)
      .send({ sessionToken, items: [] });
    expect(res.status).toBe(400);
  });

  it("400 — rejects unavailable item", async () => {
    // Toggle item off
    await request(app)
      .post(`/api/v1/menu/items/${menuItemId}/toggle`)
      .set(auth());

    const res = await request(app)
      .post(`/api/v1/diner/${restaurantId}/orders`)
      .send({ sessionToken, items: [{ menuItemId, quantity: 1 }] });
    expect(res.status).toBe(400);

    // Re-enable
    await request(app).post(`/api/v1/menu/items/${menuItemId}/toggle`).set(auth());
  });

  it("404 — rejects invalid session token", async () => {
    const res = await request(app)
      .post(`/api/v1/diner/${restaurantId}/orders`)
      .send({ sessionToken: "invalid-session-xyz", items: [{ menuItemId, quantity: 1 }] });
    expect(res.status).toBe(404);
  });
});

// ── Staff: list and manage orders ─────────────────────────────

describe("Staff Order Management", () => {
  it("200 — lists orders for restaurant", async () => {
    const res = await request(app)
      .get("/api/v1/orders")
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.orders)).toBe(true);
    expect(res.body.data.orders.length).toBeGreaterThan(0);
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  it("200 — filters orders by status", async () => {
    const res = await request(app)
      .get("/api/v1/orders?status=pending")
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.orders.every((o: { status: string }) => o.status === "pending")).toBe(true);
  });

  it("200 — gets single order with items", async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${(global as Record<string, unknown>).__orderId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.order.items.length).toBeGreaterThan(0);
  });

  it("200 — gets today's stats", async () => {
    const res = await request(app)
      .get("/api/v1/orders/stats")
      .set(auth());
    expect(res.status).toBe(200);
    const { stats } = res.body.data;
    expect(stats).toHaveProperty("totalOrders");
    expect(stats).toHaveProperty("totalRevenue");
    expect(stats.totalOrders).toBeGreaterThan(0);
  });

  it("401 — unauthenticated access denied", async () => {
    const res = await request(app).get("/api/v1/orders");
    expect(res.status).toBe(401);
  });
});

// ── Order status lifecycle ────────────────────────────────────

describe("Order Status Lifecycle", () => {
  const oid = () => (global as Record<string, unknown>).__orderId as string;

  it("200 — confirmed", async () => {
    const res = await request(app)
      .patch(`/api/v1/orders/${oid()}/status`)
      .set(auth()).send({ status: "confirmed" });
    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe("confirmed");
    expect(res.body.data.order.confirmedAt).not.toBeNull();
  });

  it("200 — preparing", async () => {
    const res = await request(app)
      .patch(`/api/v1/orders/${oid()}/status`)
      .set(auth()).send({ status: "preparing" });
    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe("preparing");
  });

  it("200 — ready", async () => {
    const res = await request(app)
      .patch(`/api/v1/orders/${oid()}/status`)
      .set(auth()).send({ status: "ready" });
    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe("ready");
    expect(res.body.data.order.readyAt).not.toBeNull();
  });

  it("200 — served (table freed)", async () => {
    const res = await request(app)
      .patch(`/api/v1/orders/${oid()}/status`)
      .set(auth()).send({ status: "served" });
    expect(res.status).toBe(200);
    expect(res.body.data.order.status).toBe("served");
    expect(res.body.data.order.servedAt).not.toBeNull();
  });

  it("400 — invalid status rejected", async () => {
    const res = await request(app)
      .patch(`/api/v1/orders/${oid()}/status`)
      .set(auth()).send({ status: "flying" });
    expect(res.status).toBe(400);
  });
});

// ── Diner: check own orders ───────────────────────────────────

describe("Diner Order Tracking", () => {
  it("200 — diner can view their orders by session token", async () => {
    const res = await request(app)
      .get(`/api/v1/diner/${restaurantId}/orders/${sessionToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.orders)).toBe(true);
    expect(res.body.data.orders.length).toBeGreaterThan(0);
    expect(res.body.data.orders[0].items.length).toBeGreaterThan(0);
  });

  it("200 — returns empty array for unknown session", async () => {
    const res = await request(app)
      .get(`/api/v1/diner/${restaurantId}/orders/nonexistent-session-token`);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(0);
  });
});
