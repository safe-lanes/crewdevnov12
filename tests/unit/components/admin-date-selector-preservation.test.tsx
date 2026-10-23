import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { format, parseISO } from "date-fns";
import { AdminDateInput } from "../../../client/src/components/AdminDateInput";
import { formatIsoDate } from "../../../client/src/components/ui/formatted-date-input";

afterEach(cleanup);

const nativeDateSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

function setNativeDate(input: HTMLInputElement, value: string) {
  // Bypass React's value tracker, as the browser's picker does before firing events.
  nativeDateSetter.call(input, value);
}

type NativeOrder = "blur-first" | "input-then-blur" | "change-then-blur";

function selectNative(input: HTMLInputElement, value: string, order: NativeOrder) {
  act(() => {
    setNativeDate(input, value);
    if (order === "input-then-blur") {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (order === "change-then-blur") {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    fireEvent.blur(input);
  });
}

function setup(initial = "2026-04-10", disabled = false) {
  const changes: string[] = [];
  const blurs: string[] = [];
  function Controlled() {
    const [value, setValue] = React.useState(initial);
    return (
      <AdminDateInput
        value={value}
        disabled={disabled}
        onChange={event => {
          changes.push(event.target.value);
          setValue(event.target.value);
        }}
        onBlur={event => blurs.push(event.target.value)}
        data-testid="admin-date"
      />
    );
  }
  render(<Controlled />);
  return {
    calendar: screen.getByTestId("admin-date") as HTMLInputElement,
    manual: screen.getByTestId("admin-date-manual") as HTMLInputElement,
    changes,
    blurs,
  };
}

describe("AdminDateInput native picker event sequencing (real shared selector)", () => {
  it.each<NativeOrder>(["blur-first", "input-then-blur", "change-then-blur"])(
    "accepts a selection in %s order exactly once before blur",
    order => {
      const { calendar, manual, changes, blurs } = setup();
      selectNative(calendar, "2026-05-11", order);
      expect(changes).toEqual(["2026-05-11"]);
      expect(blurs).toEqual(["2026-05-11"]);
      expect(calendar.value).toBe("2026-05-11");
      expect(manual.value).toBe("11-May-2026");
    },
  );

  it.each<NativeOrder>(["blur-first", "input-then-blur", "change-then-blur"])(
    "accepts native clearing in %s order exactly once",
    order => {
      const { calendar, manual, changes, blurs } = setup();
      selectNative(calendar, "", order);
      expect(changes).toEqual([""]);
      expect(blurs).toEqual([""]);
      expect(calendar.value).toBe("");
      expect(manual.value).toBe("");
    },
  );

  it("does not emit a change when the picker closes without a selection", () => {
    const { calendar, manual, changes, blurs } = setup();
    act(() => {
      calendar.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      fireEvent.blur(calendar);
    });
    expect(changes).toEqual([]);
    expect(blurs).toEqual(["2026-04-10"]);
    expect(calendar.value).toBe("2026-04-10");
    expect(manual.value).toBe("10-Apr-2026");
  });

  it("ignores picker events on a disabled control", () => {
    const { calendar, manual, changes } = setup("2026-04-10", true);
    expect(calendar).toBeDisabled();
    expect(manual).toBeDisabled();
    expect(screen.getByRole("button", { name: /choose date/i })).toBeDisabled();
    selectNative(calendar, "2026-05-11", "blur-first");
    expect(changes).toEqual([]);
    expect(manual.value).toBe("10-Apr-2026");
  });

  it("accepts valid manual dates as canonical values", () => {
    const { manual, changes } = setup();
    fireEvent.change(manual, { target: { value: "29/Feb/2024" } });
    expect(changes).toEqual(["2024-02-29"]);
    expect(manual.value).toBe("29-Feb-2024");
  });

  it("retains invalid manual text without changing the accepted date", () => {
    const { manual, calendar, changes } = setup();
    fireEvent.change(manual, { target: { value: "31-Feb-2026" } });
    fireEvent.blur(manual);
    expect(changes).toEqual([]);
    expect(manual.value).toBe("31-Feb-2026");
    expect(manual).toHaveAttribute("aria-invalid", "true");
    expect(calendar.value).toBe("2026-04-10");
  });

  it("does not infer a clear from a browser-sanitized unsupported saved value", () => {
    const { calendar, manual, changes } = setup("legacy-date");
    expect(calendar.value).toBe("");
    selectNative(calendar, "", "blur-first");
    expect(changes).toEqual([]);
    expect(manual.value).toBe("");
  });

  it("allows correcting an unsupported saved value with a picker selection", () => {
    const { calendar, manual, changes } = setup("legacy-date");
    selectNative(calendar, "2026-05-11", "blur-first");
    expect(changes).toEqual(["2026-05-11"]);
    expect(calendar.value).toBe("2026-05-11");
    expect(manual.value).toBe("11-May-2026");
  });

  it("still permits an explicit manual clear of an unsupported saved value", () => {
    const { manual, changes } = setup("legacy-date");
    fireEvent.change(manual, { target: { value: "not a date" } });
    expect(changes).toEqual([]);
    fireEvent.change(manual, { target: { value: "" } });
    expect(changes).toEqual([""]);
    expect(manual.value).toBe("");
  });
});

// These are controlled editor adapters, not mounted FormEditor/AdminModule screens.
// They exercise the approved Date-backed and string-backed prop/guard contracts
// without pretending to verify mutations, persistence, or navigation.
type Adapter = "version" | "rank" | "training";

function adapterSetup(kind: Adapter, initial: string) {
  const accepted: string[] = [];
  const validity: boolean[] = [];
  const saves: string[] = [];
  const rejected = vi.fn();
  let currentValue = initial;
  let currentValid = true;

  function Editor() {
    const [value, setValue] = React.useState(initial);
    const validRef = React.useRef(true);
    const date = kind === "version" && value ? parseISO(value) : undefined;
    const iso = kind === "version" ? (date ? format(date, "yyyy-MM-dd") : "") : value;
    currentValue = iso;
    const valid = () => validRef.current && (!iso || Boolean(formatIsoDate(iso)));
    return (
      <>
        <AdminDateInput
          key={kind === "version"
            ? `form:rank:${iso && !formatIsoDate(iso) ? iso : "supported"}`
            : `${kind}-date:${iso && !formatIsoDate(iso) ? iso : "supported"}`}
          value={iso}
          initialDraft={kind === "version"
            ? (date ? format(date, "dd-MMM-yyyy") : "")
            : formatIsoDate(iso) || iso}
          onChange={event => {
            accepted.push(event.target.value);
            setValue(event.target.value);
          }}
          onDraftValidityChange={isValid => {
            validRef.current = isValid;
            currentValid = isValid;
            validity.push(isValid);
          }}
          placeholder={kind === "version" ? "today in DD-MMM-YYYY" : "DD-MMM-YYYY"}
          data-testid="editor-date"
        />
        <button onClick={() => {
          if (valid()) saves.push(kind === "version" && iso ? format(parseISO(iso), "dd-MMM-yyyy") : iso);
          else rejected();
        }}>Submit</button>
      </>
    );
  }
  render(<Editor />);
  return {
    accepted, validity, saves, rejected,
    get value() { return currentValue; },
    get valid() { return currentValid; },
    get manual() { return screen.getByTestId("editor-date-manual") as HTMLInputElement; },
    get calendar() { return screen.getByTestId("editor-date") as HTMLInputElement; },
    submit: () => fireEvent.click(screen.getByRole("button", { name: "Submit" })),
  };
}

describe.each<Adapter>(["version", "rank", "training"])("%s controlled adapter contract (not screen integration)", kind => {
  it("formats accepted values, preserves the node/focus, and blocks invalid nonempty drafts", () => {
    const editor = adapterSetup(kind, "2026-04-10");
    const input = editor.manual;
    input.focus();
    fireEvent.change(input, { target: { value: "11-May-2026" } });
    expect(editor.value).toBe("2026-05-11");
    expect(editor.manual).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("11-May-2026");
    editor.submit();
    expect(editor.saves).toEqual([kind === "version" ? "11-May-2026" : "2026-05-11"]);

    fireEvent.change(input, { target: { value: "31-Feb-2026" } });
    expect(editor.value).toBe("2026-05-11");
    expect(editor.valid).toBe(false);
    editor.submit();
    expect(editor.rejected).toHaveBeenCalledOnce();
    expect(editor.saves).toHaveLength(1);
    expect(input.value).toBe("31-Feb-2026");
    expect(editor.manual).toBe(input);

    fireEvent.change(input, { target: { value: "29-Feb-2024" } });
    expect(editor.value).toBe("2024-02-29");
    expect(editor.valid).toBe(true);
    expect(input.value).toBe("29-Feb-2024");
    editor.submit();
    expect(editor.saves.at(-1)).toBe(kind === "version" ? "29-Feb-2024" : "2024-02-29");
  });

  it("allows explicit empty values through the date guard (required/default handling remains external)", () => {
    const editor = adapterSetup(kind, "2026-04-10");
    fireEvent.change(editor.manual, { target: { value: "" } });
    expect(editor.accepted).toEqual([""]);
    expect(editor.value).toBe("");
    expect(editor.valid).toBe(true);
    editor.submit();
    expect(editor.saves).toEqual([""]);
    expect(editor.rejected).not.toHaveBeenCalled();
  });
});

describe("string-backed saved value handling in the controlled adapter", () => {
  it.each<Adapter>(["rank", "training"])("%s retains unsupported raw data until explicit correction", kind => {
    const editor = adapterSetup(kind, "legacy-date");
    expect(editor.value).toBe("legacy-date");
    expect(editor.manual.value).toBe("legacy-date");
    expect(editor.calendar.value).toBe("");
    selectNative(editor.calendar, "", "blur-first");
    expect(editor.accepted).toEqual([]);
    editor.submit();
    expect(editor.rejected).toHaveBeenCalledOnce();
    fireEvent.change(editor.manual, { target: { value: "12-Jun-2026" } });
    expect(editor.accepted).toEqual(["2026-06-12"]);
    expect(editor.value).toBe("2026-06-12");
    expect(editor.manual.value).toBe("12-Jun-2026");
  });
});