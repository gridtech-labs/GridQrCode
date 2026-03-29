import request from "supertest";
import app from "../src/app";
import pool from "../src/db/pool";

let accessToken: string;
let restaurantId: string;

beforeAll(async () => {
  const ts = Date.now();
  const res = await request(app).post("/api/v1/auth/register").send({
    email: `s6_${ts}@test.com`,
    password: "Password1!",
    firstName: "Sprint",
    lastName: "Six",
    restaurantName: `S6 Restaurant ${ts}`,
  });
  expect(res.status).toBe(201);
  accessToken = res.body.data.accessToken;
  restaurantId = res.body.data.user.restaurantId;
});

afterAll(async () => { await pool.end(); });

const auth = () => ({ Authorization: `Bearer ${accessToken}` });

// ── Plans ─────────────────────────────────────────────────────

describe("Plans", () => {
  it("200 — list all active plans (public)", async () => {
    const res = await request(app).get("/api/v1/billing/plans");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.plans)).toBe(true);
    expect(res.body.data.plans.length).toBe(3);
    const plan = res.body.data.plans[0];
    expect(plan).toHaveProperty("priceMonthly");
    expect(plan).toHaveProperty("features");
    expect(plan.features).toHaveProperty("advancedAnalytics");
  });
});

// ── Usage ─────────────────────────────────────────────────────

describe("Usage stats", () => {
  it("200 — returns usage for restaurant", async () => {
    const res = await request(app).get("/api/v1/billing/usage").set(auth());
    expect(res.status).toBe(200);
    const { usage } = res.body.data;
    expect(usage).toHaveProperty("tables");
    expect(usage).toHaveProperty("menuItems");
    expect(usage).toHaveProperty("staff");
    expect(usage.tables).toHaveProperty("used");
    expect(usage.tables).toHaveProperty("max");
    expect(usage.ordersThisMonth).toBeGreaterThanOrEqual(0);
  });

  it("401 — unauthenticated denied", async () => {
    const res = await request(app).get("/api/v1/billing/usage");
    expect(res.status).toBe(401);
  });
});

// ── Subscription ──────────────────────────────────────────────

describe("Subscription and plan change", () => {
  let planId: string;

  beforeAll(async () => {
    const plans = await request(app).get("/api/v1/billing/plans");
    const proPlan = plans.body.data.plans.find((p: { name: string }) => p.name === "pro");
    planId = proPlan.id;
  });

  it("200 — change plan to pro (monthly)", async () => {
    const res = await request(app)
      .post("/api/v1/billing/change-plan")
      .set(auth())
      .send({ planId, billingCycle: "monthly" });

    expect(res.status).toBe(200);
    expect(res.body.data.subscription.planName).toBe("pro");
    expect(res.body.data.subscription.status).toBe("active");
    expect(res.body.data.subscription.billingCycle).toBe("monthly");
  });

  it("200 — get subscription returns the new plan", async () => {
    const res = await request(app).get("/api/v1/billing/subscription").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.subscription.planName).toBe("pro");
  });

  it("200 — change to yearly billing", async () => {
    const res = await request(app)
      .post("/api/v1/billing/change-plan")
      .set(auth())
      .send({ planId, billingCycle: "yearly" });

    expect(res.status).toBe(200);
    expect(res.body.data.subscription.billingCycle).toBe("yearly");
  });

  it("400 — invalid plan ID rejected", async () => {
    const res = await request(app)
      .post("/api/v1/billing/change-plan")
      .set(auth())
      .send({ planId: "00000000-0000-0000-0000-000000000000" });

    expect(res.status).toBe(404);
  });
});

// ── Analytics ─────────────────────────────────────────────────

describe("Analytics", () => {
  it("200 — returns dashboard stats", async () => {
    const res = await request(app).get("/api/v1/analytics/dashboard").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("summary");
    expect(res.body.data).toHaveProperty("dailyRevenue");
    expect(res.body.data).toHaveProperty("topItems");
    expect(res.body.data).toHaveProperty("hourlyOrders");
    expect(res.body.data.hourlyOrders).toHaveLength(24);
  });

  it("200 — supports days query param", async () => {
    const res = await request(app).get("/api/v1/analytics/dashboard?days=7").set(auth());
    expect(res.status).toBe(200);
  });

  it("401 — unauthenticated denied", async () => {
    const res = await request(app).get("/api/v1/analytics/dashboard");
    expect(res.status).toBe(401);
  });
});
