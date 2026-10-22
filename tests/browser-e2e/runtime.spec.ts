import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

test("UI builds real SystemC and Yosys workflows and navigates actual Wellen signal values", async ({
  page,
}) => {
  test.skip(
    !existsSync(".tools/runtime-ready.json"),
    "Dedicated Linux runtime not prepared",
  );
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByLabel("Project name").fill(`Native stages ${Date.now()}`);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Open Engine Runtime", exact: true })
    .click();
  await page.getByLabel("Runtime workflow").selectOption("systemc_tlm");
  await page.getByRole("button", { name: "Build & Run", exact: true }).click();
  await expect(page.getByTestId("runtime-state")).toHaveText("COMPLETED_PASS", {
    timeout: 45000,
  });
  await expect(
    page.getByRole("table", { name: "Runtime stages" }),
  ).toContainText("paired_transactions");
  await page.getByLabel("Runtime workflow").selectOption("yosys_netlist");
  await page.getByRole("button", { name: "Build & Run", exact: true }).click();
  await expect(page.getByTestId("runtime-state")).toHaveText("COMPLETED_PASS", {
    timeout: 45000,
  });
  await expect(
    page.getByRole("table", { name: "Runtime stages" }),
  ).toContainText("wellen_waveform");
  await page.getByLabel("Wave end tick").fill("200000");
  await page
    .getByRole("button", { name: "Load waveform window", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Actual waveform values" }),
  ).toBeVisible();
  await expect(page.locator(".runtime-wave")).toContainText("pywellen 0.25.7");
  await page
    .getByRole("img", { name: "Actual waveform values" })
    .click({ position: { x: 180, y: 30 } });
  await expect(page.getByLabel("Wave cursor tick")).not.toHaveText("0");
  await page
    .getByLabel("Wave signal")
    .selectOption({ label: "register_compare.rtl_value [32]" });
  await page
    .getByRole("button", { name: "Load waveform window", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Actual waveform values" }).locator("g"),
  ).toHaveCount(1);
  await page
    .getByRole("img", { name: "Actual waveform values" })
    .click({ position: { x: 180, y: 30 } });
  await page.screenshot({
    path: "docs/test-evidence/runtime/workbench.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("UI builds Ibex firmware on actual RTL and opens its FST with Wellen", async ({
  page,
}) => {
  test.skip(
    !existsSync(".tools/runtime-ready.json") ||
      !JSON.parse(readFileSync(".tools/runtime-ready.json", "utf8")).tools.ibex
        ?.available,
    "Ibex toolchain not prepared",
  );
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByLabel("Project name").fill(`Ibex RTL firmware ${Date.now()}`);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Open Engine Runtime", exact: true })
    .click();
  await page.getByLabel("Runtime workflow").selectOption("ibex_simple_system");
  await page.getByRole("button", { name: "Build & Run", exact: true }).click();
  await expect(page.getByTestId("runtime-state")).toHaveText("COMPLETED_PASS", {
    timeout: 120000,
  });
  await expect(
    page.getByRole("table", { name: "Runtime stages" }),
  ).toContainText("ibex_oracle");
  await expect(
    page.getByRole("table", { name: "Runtime stages" }),
  ).toContainText("Hello simple system");
  const response = page.waitForResponse((r) => r.url().includes("/waveform/"));
  await page
    .getByRole("button", { name: "Load waveform window", exact: true })
    .click();
  const actual = await (await response).json();
  expect(actual.format).toBe("FST");
  expect(actual.window.length).toBeGreaterThan(0);
  await expect(
    page.getByRole("img", { name: "Actual waveform values" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Wave cursor values" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/test-evidence/runtime/ibex-workbench.png",
    fullPage: true,
  });
  await page
    .getByRole("img", { name: "Actual waveform values" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/test-evidence/runtime/ibex-waveform.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
