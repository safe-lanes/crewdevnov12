import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { emptyCompanyFormGrants, type CompanyFormGrants } from "@shared/v2/admin/companyFormPermissions";
import { CompanyFormsPermissionEditor } from "@/modules/admin/CompanyFormsPermissionEditor";

afterEach(cleanup);
function Harness({ initial = emptyCompanyFormGrants(), disabled = false }: { initial?: CompanyFormGrants; disabled?: boolean }) {
  const [grants, setGrants] = useState(initial);
  return <CompanyFormsPermissionEditor grants={grants} onChange={setGrants} disabled={disabled} />;
}
describe("Company Forms controlled permission multiselect", () => {
  it.each([
    [emptyCompanyFormGrants(), "None selected"],
    [{ ...emptyCompanyFormGrants(), view: true, fill_in: true, witness: true, void: true }, "View, Fill in, Witness +1"],
    [Object.fromEntries(Object.keys(emptyCompanyFormGrants()).map(key => [key, true])), "All 7 permissions"],
  ])("shows the saved selections without opening the dropdown", (initial, summary) => {
    render(<Harness initial={initial as CompanyFormGrants} />);
    expect(screen.getByTestId("company-form-permissions-trigger")).toHaveTextContent(summary);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Save Company Forms permissions")).not.toBeInTheDocument();
  });
  it("lists all seven permissions and keeps selections open while updating the summary", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("company-form-permissions-trigger"));
    expect(await screen.findAllByRole("checkbox")).toHaveLength(7);
    fireEvent.click(screen.getByRole("checkbox", { name: "Witness", exact: true }));
    expect(screen.getByRole("checkbox", { name: "Witness", exact: true })).toBeChecked();
    expect(screen.getByTestId("company-form-permissions-trigger")).toHaveTextContent("Witness");
  });
  it.each([
    ["Witness", "acting user’s own identity recorded as the witness"],
    ["Sign as Company Representative", "office user"],
    ["Void", "has not been completed"],
    ["Void completed", "has already been completed"],
    ["Override checklist", "does not allow overriding unfinished required forms"],
  ])("opens tap help for %s without changing its permission", async (label, text) => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("company-form-permissions-trigger"));
    fireEvent.click(await screen.findByRole("button", { name: `Help: ${label}`, exact: true }));
    expect(await screen.findByText(text, { exact: false })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: label, exact: true })).not.toBeChecked();
    expect(screen.getByTestId("company-form-permissions-trigger")).toHaveTextContent("None selected");
  });
  it("retains hover help", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("company-form-permissions-trigger"));
    fireEvent.pointerMove(await screen.findByRole("button", { name: "Help: Witness" }), { pointerType: "mouse" });
    expect(await screen.findByRole("tooltip")).toHaveTextContent("recorded as the witness");
  });
  it("cannot open or change permissions while disabled", () => {
    const change = vi.fn();
    render(<CompanyFormsPermissionEditor grants={emptyCompanyFormGrants()} onChange={change} disabled />);
    expect(screen.getByTestId("company-form-permissions-trigger")).toBeDisabled();
    expect(change).not.toHaveBeenCalled();
  });
});
