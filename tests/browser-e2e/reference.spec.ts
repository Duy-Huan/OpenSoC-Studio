import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("GitHub PicoRV32 imports in the workbench and real RTL evidence downloads with matching hash", async ({
  page,
  request,
}) => {
  test.skip(
    !existsSync(".cache/upstream/picorv32/picorv32.v") ||
      !existsSync("docs/test-evidence/real-soc/regression.json"),
    "Run the pinned native reference regression first",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const name = `PicoRV32 upstream ${Date.now()}`;
  await page.getByLabel("Project name").fill(name);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page.getByLabel("Current project")).toContainText(name);
  await page.getByRole("button", { name: "Import RTL", exact: true }).click();
  await page.getByLabel("RTL source files").setInputFiles(
    ["picorv32.v", "testbench_ez.v"].map((name) => ({
      name,
      mimeType: "text/plain",
      buffer: readFileSync(`.cache/upstream/picorv32/${name}`),
    })),
  );
  await page
    .getByLabel("Source license expression")
    .fill("ISC AND LicenseRef-Public-Domain-Declaration");
  await page
    .getByRole("button", { name: "Import snapshot", exact: true })
    .click();
  await expect(page.locator(".editor-breadcrumb")).toContainText("picorv32.v");
  await page.getByLabel("Top module").fill("testbench");
  await page.getByRole("button", { name: "Analyze RTL", exact: true }).click();
  await expect(page.getByTestId("run-state")).toHaveText("COMPLETED PASS");
  await expect(page.locator(".hierarchy-row")).toContainText([
    "testbench",
    "uut",
  ]);
  await page.screenshot({
    path: "docs/test-evidence/real-soc/source-import.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Open RTL Regression", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "Actual RTL regression cases" }),
  ).toContainText("EXPECTED_FAIL_DETECTED");
  await expect(page.locator(".reference-evidence")).toContainText(
    "Regression PASS",
  );
  const reportResponse = await request.get("/api/v1/reference-regression");
  const report = await reportResponse.json();
  expect(report.cases).toHaveLength(7);
  expect(
    report.cases.every(
      (c: { regression_passed: boolean }) => c.regression_passed,
    ),
  ).toBeTruthy();
  const wave = Object.keys(report.downloads).find(
    (p) =>
      p.endsWith("baseline\\waveform.vcd") ||
      p.endsWith("baseline/waveform.vcd"),
  )!;
  const download = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "baseline/waveform.vcd", exact: true })
    .click();
  const file = await (await download).path();
  const raw = readFileSync(file!);
  expect(createHash("sha256").update(raw).digest("hex")).toBe(
    report.downloads[wave].sha256,
  );
  expect(raw.subarray(0, 1000).toString()).toContain("$timescale");
  await page.locator(".reference-evidence").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: "docs/test-evidence/real-soc/workbench.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
