import { test, expect, turn } from "../support";

// Example only. Replace it with the real frontend journeys.
// A journey is one test: turns in a user order. Tag each journey: @core, @change or @edge.
// Opening a page and checks are free. Only a turn() counts in the budget.

test("F01 home page opens without errors", { tag: "@core" }, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
  expect(errors, "script errors on the page").toEqual([]);

  // A turn in the page, with the check of its result:
  // await turn("ui", "Create the project 'Spring menu'", async () => {
  //   await page.getByLabel("Project name").fill("Spring menu");
  //   await page.getByRole("button", { name: "Create project" }).click();
  //   await expect(page.getByText("Project created")).toBeVisible();
  // });
  void turn;
});
