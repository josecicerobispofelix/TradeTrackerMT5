import { test, expect, request } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:18100";

test.describe("API smoke", () => {
  test("health endpoint responde OK", async () => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${BASE_URL}/health`, { timeout: 5000 });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json).toHaveProperty("status");
  });
});
