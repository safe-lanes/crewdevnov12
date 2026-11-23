// Real onboard popup and UI primitives with isolated hooks; no tenant writes.
// Run: node tests/e2e/defer-relief-disclosure.browser.mjs
import { build } from "esbuild";
import { chromium } from "playwright";
import { expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { createServer } from "node:http";
import path from "node:path";

const fixtures = {
  permissions: `export const usePermissions=()=>({userType:"Office",permissions:[{menuName:"Vessel",canedit:true}]});`,
  lookup: `export const useVesselLookup=()=>({getVesselName:()=>"Fixture vessel"});`,
  planning: `export const useUpdatePlanningV2=()=>({isPending:false,mutateAsync:async()=>{}});
    export const useCreatePlanningV2=useUpdatePlanningV2;
    export const useVesselPlanningV2=()=>({data:[]});`,
  request: `export const apiRequest=async(method,url,body)=>{
    window.writes.push({method,url,body});
    if(method==="POST") await new Promise(resolve=>window.finishDeferral=resolve);
    return {json:async()=>({})};
  };`,
  requirements: `export const useAssignmentFormRequirements=()=>({isSuccess:false,isError:false});
    export const stageCheckFor=()=>undefined;
    export const stageCheckBlocksActions=()=>true;`,
};
const filters = [
  [/contexts\/PermissionsContext$/, "permissions"],
  [/hooks\/useVesselLookup$/, "lookup"],
  [/hooks\/useVesselV2$/, "planning"],
  [/lib\/queryClient$/, "request"],
  [/assignmentFormRequirementsQuery$/, "requirements"],
];
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(), loader: "tsx",
    contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
      import {TooltipProvider} from "./client/src/components/ui/tooltip";
      import {OnBoardStatusEditDialog_v2} from "./client/src/modules/vessel/components/OnBoardStatusEditDialog_v2";
      window.writes=[];
      const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
      const data={planUuid:"fixture-plan",crewAssignUuid:"fixture-assignment",crewUuid:"fixture-crew",
        crewName:"ANNA RAMOS",onBoardCrewName:"ANNA RAMOS",onBoardCrewNationality:"PHILIPPINES",
        reliefStatus:"Confirmed",crewStatus:"primary",contractPeriodMonths:4,signOnDate:"2026-03-01"};
      createRoot(document.getElementById("root")).render(
        <QueryClientProvider client={client}><TooltipProvider>
          <OnBoardStatusEditDialog_v2 open onOpenChange={()=>{}} rank="Master" rankId="R001"
            vesselUuid="fixture-vessel" planningData={data}/>
        </TooltipProvider></QueryClientProvider>);`,
  },
  bundle: true, write: false, jsx: "automatic", format: "iife",
  define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"test"' },
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  plugins: [{
    name: "isolated-hooks",
    setup(builder) {
      for (const [filter, name] of filters) {
        builder.onResolve({ filter }, () => ({ path: name, namespace: "fixture" }));
      }
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
        loader: "js", contents: fixtures[args.path],
      }));
    },
  }],
});
const css = (await postcss([tailwindcss("./tailwind.config.ts")]).process(
  "@tailwind base; @tailwind components; @tailwind utilities;", { from: undefined },
)).css;
const server = createServer((req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("content-type", "application/javascript");
    return res.end(bundle.outputFiles[0].text);
  }
  res.setHeader("content-type", "text/html");
  res.end(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head>
    <body><div id="root"></div><script src="/bundle.js"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 780 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const toggle = page.getByTestId("button-toggle-defer-relief");
    const panel = page.getByTestId("defer-relief-action");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
    await expect(page.getByText("Available once Relief Status is Planned or Confirmed.")).toBeVisible();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(panel).toBeVisible();
    await page.getByLabel("Written reason").fill("Voyage extension");
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(panel).toBeHidden();
    await toggle.click();
    await expect(page.getByLabel("Written reason")).toHaveValue("Voyage extension");
    expect(await page.evaluate(() => window.writes.length)).toBe(0);
    const box = await panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: `/tmp/defer-relief-${viewport.width}.png` });
    await page.getByTestId("button-defer-relief").click();
    await expect(toggle).toBeDisabled();
    await expect(page.getByLabel("Written reason")).toBeDisabled();
    expect(await page.evaluate(() => window.writes)).toEqual([{
      method: "POST", url: "/api/v2/vessel/planning/fixture-plan/defer-relief",
      body: { reason: "Voyage extension" },
    }]);
    await page.evaluate(() => window.finishDeferral());
    await expect(toggle).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log(`PASS ${viewport.width}px: keyboard disclosure, preserved reason, no implicit writes, pending and success`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
