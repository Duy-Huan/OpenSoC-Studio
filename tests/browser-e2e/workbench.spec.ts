import { test, expect, type Page } from "@playwright/test";
const RTL = `module child(input logic [7:0] data_i, output logic [7:0] data_o);
assign data_o = data_i;
endmodule
module top(input logic clk_i, input logic [7:0] data_i, output logic [7:0] data_o);
child u_child(data_i, data_o);
endmodule`;

async function createProject(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByLabel("Project name").fill(name);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page.getByLabel("Current project")).toContainText(name);
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
async function importAndAnalyze(page: Page, code = RTL, top = "top") {
  await page.getByRole("button", { name: "Import RTL", exact: true }).click();
  await page.getByLabel("RTL source files").setInputFiles({
    name: "top.sv",
    mimeType: "text/plain",
    buffer: Buffer.from(code),
  });
  await page.getByLabel("Source license expression").fill("MIT"); // Synthetic browser-test rights metadata, not release approval.
  await page
    .getByRole("button", { name: "Import snapshot", exact: true })
    .click();
  await expect(page.locator(".editor-breadcrumb")).toContainText("top.sv");
  await page.getByLabel("Top module").fill(top);
  await page.getByRole("button", { name: "Analyze RTL", exact: true }).click();
}

test("real import, slang elaboration, source selection, persistence and evidence export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const externalRequests: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      externalRequests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByText("Backend connected", { exact: true }),
  ).toBeVisible();
  await createProject(page, `RTL lab ${Date.now()}`);
  await importAndAnalyze(page);
  await expect(page.getByTestId("run-state")).toHaveText("COMPLETED PASS");
  await expect(page.locator(".hierarchy-row")).toContainText([
    "top",
    "u_child",
  ]);
  await page.locator(".port-row").filter({ hasText: "data_i" }).first().click();
  await expect(page.locator(".statusbar")).toContainText("top");
  await expect(page.locator(".inspector")).toContainText("EXACT");
  await expect(page.locator(".console-output")).toContainText(
    "simulation not executed",
  );
  await page.waitForTimeout(650); // Allow the intentional workspace debounce to commit.
  await page.reload();
  await expect(page.locator(".editor-breadcrumb")).toContainText("top.sv");
  await expect(page.getByTestId("run-state")).toHaveText("COMPLETED PASS");
  const downloaded = page.waitForEvent("download");
  await page.getByTitle("Export actual run evidence").click();
  expect((await downloaded).suggestedFilename()).toContain("evidence.json");
  await page.screenshot({
    path: "docs/test-evidence/M1/workbench.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test("compiler errors show actual source diagnostics", async ({ page }) => {
  await page.goto("/");
  await createProject(page, `Diagnostics ${Date.now()}`);
  await importAndAnalyze(
    page,
    "module top(input logic a); assign b = missing_name; endmodule",
  );
  await expect(page.getByTestId("run-state")).toHaveText("COMPLETED FAIL");
  await page.getByRole("button", { name: /Problems/ }).click();
  await expect(page.locator(".diagnostic")).toContainText([
    "implicit",
    "missing_name",
  ]);
});

test("IP review/reuse and canonical composer reject conflicting MMIO without committing", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, `Composer ${Date.now()}`);
  await importAndAnalyze(page);
  await expect(page.getByTestId("run-state")).toHaveText("COMPLETED PASS");
  await page
    .getByRole("button", { name: "Open IP Registry", exact: true })
    .click();
  const namespace = `test${Date.now()}`;
  await page.getByLabel("Package namespace").fill(namespace);
  await page.getByLabel("Package name", { exact: true }).fill("register_block");
  await page
    .getByRole("button", { name: "Create IP draft", exact: true })
    .click();
  const card = page
    .locator(".registry-item")
    .filter({ hasText: `${namespace}:rtl:register_block:1.0.0` });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Review metadata" }).click();
  await expect(card).toContainText("REVIEWED");
  await page
    .getByRole("button", { name: "Open SoC Composer", exact: true })
    .click();
  await page.getByRole("button", { name: "Instance", exact: true }).click();
  await page.getByLabel("Instance ID").fill("regs0");
  await page
    .getByLabel("IP package", { exact: true })
    .selectOption(`${namespace}:rtl:register_block:1.0.0`);
  await page.getByRole("button", { name: "Add instance", exact: true }).click();
  await expect(page.locator(".hardware-node")).toContainText("regs0");
  await page.getByRole("button", { name: "Add region", exact: true }).click();
  await page
    .getByRole("button", { name: "Commit topology", exact: true })
    .click();
  await expect(page.locator(".topology-message")).toContainText(
    "Committed revision 1",
  );
  await page.getByRole("button", { name: "Add region", exact: true }).click();
  await page
    .getByRole("button", { name: "Commit topology", exact: true })
    .click();
  await expect(page.locator(".topology-message")).toContainText(
    "ADDRESS_OVERLAP",
  );
  await expect(page.locator(".invalid-region")).toBeVisible();
  await expect(page.locator(".hardware-node.invalid")).toBeVisible();
  const projectId = await page.getByLabel("Current project").inputValue();
  const stored = await (
    await page.request.get(`/api/v1/projects/${projectId}/soc-config`)
  ).json();
  expect(stored.revision).toBe(1);
  expect(stored.address_regions).toHaveLength(1);
  await page.screenshot({
    path: "docs/test-evidence/M5/composer-errors.png",
    fullPage: true,
  });
  await createProject(page, `Reuse ${Date.now()}`);
  await page
    .getByRole("button", { name: "Open IP Registry", exact: true })
    .click();
  await page
    .locator(".registry-item")
    .filter({ hasText: `${namespace}:rtl:register_block:1.0.0` })
    .getByRole("button", { name: "Pin to project" })
    .click();
  const second = await page.getByLabel("Current project").inputValue();
  const deps = await (
    await page.request.get(`/api/v1/projects/${second}/dependencies`)
  ).json();
  expect(deps[0].package_id).toBe(`${namespace}:rtl:register_block:1.0.0`);
  expect(deps[0].simulation_verified).toBe(false);
});

test("command palette opens waveform panel with honest unavailable state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Backend connected", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByLabel("Search commands").fill("waveform");
  await page
    .getByRole("button", { name: "Open waveform", exact: true })
    .click();
  await expect(page.getByText("No waveform artifact available")).toBeVisible();
  await expect(
    page.getByText("SIMULATION UNAVAILABLE", { exact: true }),
  ).toBeVisible();
});

test("firmware UI rejects invalid ELF and labels structural-only validation", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, `Firmware ${Date.now()}`);
  await page.keyboard.press("Control+k");
  await page.getByLabel("Search commands").fill("firmware");
  await page
    .getByRole("button", { name: "Open firmware", exact: true })
    .click();
  await page.getByLabel("Firmware ELF file").setInputFiles({
    name: "invalid.elf",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("invalid image"),
  });
  await expect(page.locator(".toast")).toContainText("Expected an ELF image");
  const data = Buffer.alloc(260);
  data.set([0x7f, 0x45, 0x4c, 0x46, 1, 1, 1], 0);
  data.writeUInt16LE(2, 16);
  data.writeUInt16LE(243, 18);
  data.writeUInt32LE(1, 20);
  data.writeUInt32LE(0x100080, 24);
  data.writeUInt32LE(52, 28);
  data.writeUInt16LE(52, 40);
  data.writeUInt16LE(32, 42);
  data.writeUInt16LE(1, 44);
  [1, 0x100, 0x100000, 0x100000, 4, 0x100, 5, 0x100].forEach((n, i) =>
    data.writeUInt32LE(n, 52 + i * 4),
  );
  data.set([0x13, 0, 0, 0], 256);
  await page.getByLabel("Firmware ELF file").setInputFiles({
    name: "synthetic-parser-fixture.elf",
    mimeType: "application/octet-stream",
    buffer: data,
  });
  await expect(page.locator(".firmware-image")).toContainText(
    "STRUCTURAL CHECKS PASSED",
  );
  await expect(page.locator(".firmware-image")).toContainText("NOT EXECUTED");
  await page.screenshot({
    path: "docs/test-evidence/M6/firmware-validation.png",
    fullPage: true,
  });
});
