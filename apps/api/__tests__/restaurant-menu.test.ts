import request from "supertest";
import app from "../src/app";
import pool from "../src/db/pool";

// ── Helpers ───────────────────────────────────────────────────

let accessToken: string;
let restaurantId: string;

async function authHeader() {
  return { Authorization: `Bearer ${accessToken}` };
}

beforeAll(async () => {
  const ts = Date.now();
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({
      email: `s2_${ts}@test.com`,
      password: "Password1!",
      firstName: "Sprint",
      lastName: "Two",
      restaurantName: `S2 Restaurant ${ts}`,
    });

  expect(res.status).toBe(201);
  accessToken = res.body.data.accessToken;
  restaurantId = res.body.data.user.restaurantId;
});

afterAll(async () => {
  await pool.end();
});

// ── Restaurant ────────────────────────────────────────────────

describe("GET /api/v1/restaurant", () => {
  it("200 — returns restaurant with plan info", async () => {
    const res = await request(app)
      .get("/api/v1/restaurant")
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.restaurant).toMatchObject({
      id: restaurantId,
      subscriptionStatus: "trial",
    });
    expect(res.body.data.restaurant.planName).toBe("pro");
  });

  it("401 — unauthenticated", async () => {
    const res = await request(app).get("/api/v1/restaurant");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/v1/restaurant", () => {
  it("200 — updates restaurant fields", async () => {
    const res = await request(app)
      .patch("/api/v1/restaurant")
      .set(await authHeader())
      .send({
        description: "The best test restaurant",
        currency: "GBP",
        taxRate: 0.20,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.restaurant.description).toBe("The best test restaurant");
    expect(res.body.data.restaurant.currency).toBe("GBP");
    expect(res.body.data.restaurant.taxRate).toBeCloseTo(0.20);
  });

  it("400 — invalid currency length", async () => {
    const res = await request(app)
      .patch("/api/v1/restaurant")
      .set(await authHeader())
      .send({ currency: "INVALID" });

    expect(res.status).toBe(400);
  });
});

// ── Menu Categories ───────────────────────────────────────────

describe("Menu Categories CRUD", () => {
  let categoryId: string;

  it("201 — create category", async () => {
    const res = await request(app)
      .post("/api/v1/menu/categories")
      .set(await authHeader())
      .send({ name: "Starters", description: "Light bites", sortOrder: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.category.name).toBe("Starters");
    categoryId = res.body.data.category.id;
  });

  it("200 — list categories", async () => {
    const res = await request(app)
      .get("/api/v1/menu/categories")
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.categories)).toBe(true);
    expect(res.body.data.categories.length).toBeGreaterThan(0);
  });

  it("200 — update category", async () => {
    const res = await request(app)
      .patch(`/api/v1/menu/categories/${categoryId}`)
      .set(await authHeader())
      .send({ name: "Appetisers" });

    expect(res.status).toBe(200);
    expect(res.body.data.category.name).toBe("Appetisers");
  });

  it("400 — empty name rejected", async () => {
    const res = await request(app)
      .post("/api/v1/menu/categories")
      .set(await authHeader())
      .send({ name: "" });

    expect(res.status).toBe(400);
  });

  // Keep categoryId for item tests
  afterAll(() => {
    (global as unknown as Record<string, unknown>).__categoryId = categoryId;
  });
});

// ── Menu Items ────────────────────────────────────────────────

describe("Menu Items CRUD", () => {
  let itemId: string;
  const categoryId = () => (global as unknown as Record<string, unknown>).__categoryId as string;

  it("201 — create item", async () => {
    const res = await request(app)
      .post("/api/v1/menu/items")
      .set(await authHeader())
      .send({
        name: "Bruschetta",
        description: "Toasted bread with tomatoes",
        price: 8.50,
        categoryId: categoryId(),
        tags: ["vegetarian"],
        prepTimeMin: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.item.name).toBe("Bruschetta");
    expect(res.body.data.item.price).toBeCloseTo(8.50);
    itemId = res.body.data.item.id;
  });

  it("200 — list items", async () => {
    const res = await request(app)
      .get("/api/v1/menu/items")
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it("200 — list items filtered by category", async () => {
    const res = await request(app)
      .get(`/api/v1/menu/items?categoryId=${categoryId()}`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.items.every((i: { categoryId: string }) => i.categoryId === categoryId())).toBe(true);
  });

  it("200 — get item by id", async () => {
    const res = await request(app)
      .get(`/api/v1/menu/items/${itemId}`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.item.id).toBe(itemId);
  });

  it("200 — update item price", async () => {
    const res = await request(app)
      .patch(`/api/v1/menu/items/${itemId}`)
      .set(await authHeader())
      .send({ price: 9.00 });

    expect(res.status).toBe(200);
    expect(res.body.data.item.price).toBeCloseTo(9.00);
  });

  it("200 — toggle availability", async () => {
    const before = await request(app)
      .get(`/api/v1/menu/items/${itemId}`)
      .set(await authHeader());
    const wasAvailable = before.body.data.item.isAvailable;

    const res = await request(app)
      .post(`/api/v1/menu/items/${itemId}/toggle`)
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.item.isAvailable).toBe(!wasAvailable);
  });

  it("400 — negative price rejected", async () => {
    const res = await request(app)
      .post("/api/v1/menu/items")
      .set(await authHeader())
      .send({ name: "Bad Item", price: -5 });

    expect(res.status).toBe(400);
  });

  it("200 — delete item", async () => {
    const res = await request(app)
      .delete(`/api/v1/menu/items/${itemId}`)
      .set(await authHeader());

    expect(res.status).toBe(200);
  });
});

// ── Modifiers ─────────────────────────────────────────────────

describe("Modifiers CRUD", () => {
  let modifierId: string;

  it("201 — create modifier with options", async () => {
    const res = await request(app)
      .post("/api/v1/menu/modifiers")
      .set(await authHeader())
      .send({
        name: "Spice Level",
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: "Mild", priceDelta: 0 },
          { name: "Medium", priceDelta: 0 },
          { name: "Hot", priceDelta: 0.50 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.modifier.options).toHaveLength(3);
    modifierId = res.body.data.modifier.id;
  });

  it("200 — list modifiers", async () => {
    const res = await request(app)
      .get("/api/v1/menu/modifiers")
      .set(await authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.modifiers.length).toBeGreaterThan(0);
  });

  it("400 — modifier with no options rejected", async () => {
    const res = await request(app)
      .post("/api/v1/menu/modifiers")
      .set(await authHeader())
      .send({ name: "Empty Mod", options: [] });

    expect(res.status).toBe(400);
  });

  it("200 — delete modifier", async () => {
    const res = await request(app)
      .delete(`/api/v1/menu/modifiers/${modifierId}`)
      .set(await authHeader());

    expect(res.status).toBe(200);
  });
});
