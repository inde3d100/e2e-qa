import { test, expect, turn } from "../support";

// Example only. Replace it with the real backend journeys.
// Backend journeys use "request" (HTTP) and no browser. A read is free. Only a turn() counts in the budget.

test("B01 home address answers", { tag: "@core" }, async ({ request }) => {
  const res = await request.get("/");
  expect(res.status(), "HTTP status").toBeLessThan(400);

  // A turn through the API, with the check of its result:
  // await turn("api", "POST /api/people with an empty name", async () => {
  //   const res = await request.post("/api/people", { data: { name: "" } });
  //   expect(res.status()).toBe(400);
  // });
  void turn;
});
