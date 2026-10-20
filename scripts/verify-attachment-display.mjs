// UI-only main-preview verification with existing development personas.
// Never changes grants, supplies response fixtures, or calls APIs directly.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const root = "generated-artifacts/attachment-display";
fs.mkdirSync(root, { recursive: true });
const vessel = { vessel: "TEST ONLY PDF Layout Vessel", vesselId: "a4120000-0000-4000-8000-000000000001", imoNumber: "" };
const personas = {
  office: { personaKey: "crewing-manager", masterUserId: 3, role: "Crewing Manager",
    roleId: "408d9fe9-1d0f-11f1-925d-5419ffd80f01", userType: "Office" },
  vessel: { personaKey: "registered-pdf-vessel", masterUserId: 412002, role: "PDF Layout Review Vessel",
    roleId: "a4120000-0000-4000-8000-000000000052", userType: "Ship", vessel },
};
const persona = personas[process.env.DISPLAY_PERSONA || "office"];
if (!persona) throw Error("Use only an existing registered persona.");
const steps = JSON.parse(process.env.DISPLAY_STEPS || "[]");
const label = (process.env.DISPLAY_LABEL || "inspect").replace(/[^a-z0-9-]/gi, "-");
const context = await chromium.launchPersistentContext(`${root}/browser-profile-${process.env.DISPLAY_PERSONA || "office"}`, {
  executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
  headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
  viewport: { width: 1560, height: 1080 }, acceptDownloads: true,
});
try {
  await context.addInitScript(state => {
    localStorage.setItem("devPersona", JSON.stringify(state));
    localStorage.setItem("userProfile", JSON.stringify({
      role: state.role, roleId: state.roleId, userId: String(state.masterUserId),
      userType: state.userType, myVessels: state.vessel ? [state.vessel] : [],
    }));
  }, persona);
  const page = await context.newPage();
  const events = [];
  const popupChecks = [];
  context.on("page", popup => {
    events.push({ kind: "popup" });
    popup.on("console", message => { if (message.type() === "error") events.push({ kind: "popup-error", text: message.text() }); });
    const number = popupChecks.length + 1;
    popupChecks.push((async () => {
      await popup.waitForLoadState("networkidle", { timeout: 45000 });
      await popup.screenshot({ path: `${root}/${label}-popup-${number}.png` });
      events.push({ kind: "popup-captured", number, title: await popup.title() });
    })().catch(error => events.push({ kind: "popup-error", message: error.message.split("\n")[0] })));
  });
  page.on("download", async download => {
    const name = download.suggestedFilename().replace(/[^a-z0-9._-]/gi, "_");
    await download.saveAs(`${root}/${label}-${name}`);
    events.push({ kind: "download", file: name });
  });
  page.on("console", m => { if (m.type() === "error") events.push({ kind: "console", text: m.text() }); });
  page.on("requestfailed", request => events.push({ kind: "transport", path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/") && (response.status() >= 400 || /\/raw$|\/pdf$/.test(url.pathname))) {
      events.push({ kind: "response", path: url.pathname, status: response.status(), type: response.headers()["content-type"] });
    }
  });
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}${process.env.DISPLAY_PATH || "/"}`, { waitUntil: "networkidle", timeout: 90000 });
  try {
    try {
      await page.getByTestId("app-root").waitFor({ state: "visible", timeout: 10000 });
    } catch {
      // Retry the real preview once after a transport failure; never replace
      // modules, fulfill requests or alter the application DOM.
      await page.reload({ waitUntil: "networkidle", timeout: 60000 });
      await page.getByTestId("app-root").waitFor({ state: "visible", timeout: 30000 });
    }
  } catch (error) {
    fs.writeFileSync(`${root}/${label}-preflight.json`, JSON.stringify({ events, html: (await page.content()).slice(0, 1500) }, null, 2));
    await page.screenshot({ path: `${root}/${label}-preflight.png` });
    throw error;
  }
  for (const [index, step] of steps.entries()) {
    try {
    if (step.goto) {
      if (!step.goto.startsWith("/") || step.goto.startsWith("/api/") || step.goto.startsWith("//")) throw Error("Only screen navigation is permitted.");
      await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}${step.goto}`, { waitUntil: "networkidle", timeout: 60000 });
    }
    else if (step.reload) await page.reload({ waitUntil: "networkidle", timeout: 60000 });
    else if (step.press) await page.locator(step.selector).press(step.press);
    else if (step.scroll) await page.locator(step.selector).scrollIntoViewIfNeeded();
    else if (step.upload) await page.locator(step.selector || "input[type=file]").setInputFiles(step.upload);
    else if (step.text) await page.getByText(step.text, { exact: true }).waitFor({ state: "visible", timeout: 45000 });
    else if (step.select) await page.locator(step.selector).selectOption(step.select);
    else if (step.fill !== undefined) await page.locator(step.selector).fill(step.fill);
    else if (step.waitFor) await page.locator(step.waitFor).waitFor({ state: step.state || "visible", timeout: 30000 });
    else {
      const locator = step.testId ? page.getByTestId(step.testId) : step.selector ? page.locator(step.selector) : page.getByRole(step.role || "button", { name: step.name, exact: step.exact ?? true });
      await locator.nth(step.nth || 0).click();
    }
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${root}/${label}-${index + 1}.png` });
    } catch (error) {
      events.push({ kind: "step-error", index, step, message: error.message.split("\n").slice(0, 4).join("\n") });
      break;
    }
  }
  // Wait for UI-triggered image requests; do not substitute direct API probes.
  await Promise.allSettled(popupChecks);
  await page.locator("body").waitFor();
  const visibleImages = await page.locator("img").evaluateAll(images => images.filter(i => i.getBoundingClientRect().width > 0).map(i => ({
    alt: i.alt, source: i.src.startsWith("blob:") ? "blob" : i.src.startsWith("data:") ? "data" : new URL(i.src, location.href).pathname,
    loaded: i.complete && i.naturalWidth > 0, width: i.naturalWidth,
  })));
  const report = {
    persona: { id: persona.masterUserId, role: persona.role, roleId: persona.roleId },
    path: new URL(page.url()).pathname, buttons: await page.getByRole("button").allTextContents(),
    testIds: await page.locator("[data-testid]").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-testid"))),
    inputs: await page.locator("input,select").evaluateAll(nodes => nodes.map(n => ({ tag: n.tagName, type: n.type, placeholder: n.getAttribute("placeholder"), testId: n.getAttribute("data-testid") }))),
    body: (await page.locator("body").innerText()).slice(0, 18000), images: visibleImages, events,
  };
  fs.writeFileSync(`${root}/${label}.json`, JSON.stringify(report, null, 2));
  await page.screenshot({ path: `${root}/${label}.png` });
  console.log(JSON.stringify(report, null, 2));
  if (events.some(event => event.kind === "step-error" || event.kind === "popup-error")) process.exitCode = 1;
} finally {
  await context.close();
}
