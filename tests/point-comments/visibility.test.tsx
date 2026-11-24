import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  ConfiguredFormRenderer,
  type ConfiguredFormLiveProps,
  type ConfiguredFormSection,
} from "@/components/configured-form/ConfiguredFormRenderer";

const parts = [{ formPartUuid: "part", partCode: "B", partTitle: "Points", partType: "configurable" }];
const section = (matrix: boolean): ConfiguredFormSection => ({
  section_uuid: "section", section_code: "B1", section_title: "Safety",
  applicable_vessel_types: [], responsible_mode: "not_applicable",
  responsible_role_uuid: null, responsible_department: null, comment_box_required: false,
  effectiveLayout: matrix ? "matrix" : "list",
  questions: [{
    question_uuid: "point", question_code: "B1.1", question_text: "Ready?",
    response_type: "single_select", is_mandatory: false, comment_enabled: true,
    options: [{ option_label: "Yes", option_value: "yes" }, { option_label: "No", option_value: "no" }],
  }],
});
const display = () => screen.getByTestId("preview-comment-display-point");
const editor = () => screen.getByTestId("preview-comment-point");
const commentButton = () => screen.getByTestId("button-preview-comment-point");

for (const matrix of [false, true]) {
  describe(`${matrix ? "matrix" : "list"} saved point comments`, () => {
    function setup(
      comment: string | null = "Saved observation",
      extra: Partial<ConfiguredFormLiveProps> = {},
    ) {
      const onChange = vi.fn();
      const onAnswerChange = vi.fn();
      const ui = (value = comment, state = extra, key = "first") => (
        <ConfiguredFormRenderer key={key} mode="live" embedded parts={parts}
          structures={{ part: [section(matrix)] }} selectedPartUuid="part"
          live={{ answers: { point: "yes" }, answerComments: { point: value },
            onAnswerChange, onAnswerCommentChange: onChange, ...state }} />
      );
      return { ...render(ui()), ui, onChange, onAnswerChange };
    }

    it("shows a saved submitted comment immediately and after remount without writes", () => {
      const state = { sectionStates: { section: { status: "submitted" as const } } };
      const { rerender, ui, onChange, onAnswerChange } = setup("Saved observation", state);
      expect(display()).toHaveTextContent("Saved observation");
      expect(display().tagName).not.toBe("BUTTON");
      expect(screen.queryByTestId("button-preview-comment-point")).toBeNull();
      fireEvent.click(display());
      expect(screen.queryByTestId("preview-comment-point")).toBeNull();
      rerender(ui("Saved observation", state, "reopened"));
      expect(display()).toHaveTextContent("Saved observation");
      expect(onChange).not.toHaveBeenCalled();
      expect(onAnswerChange).not.toHaveBeenCalled();
    });

    it("shows asynchronously supplied saved comments and later server changes", () => {
      const state = { sectionStates: { section: { status: "submitted" as const } } };
      const { rerender, ui, onChange } = setup(null, state);
      expect(screen.queryByTestId("preview-comment-row-point")).toBeNull();
      rerender(ui("Loaded later", state));
      expect(display()).toHaveTextContent("Loaded later");
      rerender(ui("Updated on server", state));
      expect(display()).toHaveTextContent("Updated on server");
      rerender(ui(null, state));
      expect(screen.queryByTestId("preview-comment-row-point")).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    it.each([
      { sectionOwnership: { section: { ownerLabel: "Other role", canEdit: false } } },
      { isLocked: true },
      { isLocked: true, submissionStatus: "completed" as const },
      { isLocked: true, submissionStatus: "voided" as const },
    ])("keeps a saved comment non-interactive under existing locks %j", state => {
      const { onChange } = setup("Saved observation", state);
      expect(display()).toHaveTextContent("Saved observation");
      expect(display().querySelector("input,textarea,button")).toBeNull();
      fireEvent.click(display());
      expect(screen.queryByTestId("preview-comment-point")).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("preserves not-applicable section hiding without writes", () => {
      const { rerender, ui, onChange } = setup("Saved observation", {
        sectionStates: { section: { status: "not_applicable" } },
      });
      expect(screen.queryByTestId("preview-comment-row-point")).toBeNull();
      expect(screen.getByTestId("button-preview-section-toggle-section")).toBeDisabled();
      rerender(ui("Saved observation", { sectionStates: { section: { status: "submitted" } } }));
      expect(display()).toHaveTextContent("Saved observation");
      expect(onChange).not.toHaveBeenCalled();
    });

    it.each([null, "", " \n  "])("omits empty locked comment %j", comment => {
      setup(comment, { isLocked: true });
      expect(screen.queryByTestId("preview-comment-row-point")).toBeNull();
      expect(screen.queryByText("Click to add comment...")).toBeNull();
    });

    it("keeps a saved editable comment visible and allows explicit editing/clearing", () => {
      const { onChange } = setup();
      expect(display()).toHaveTextContent("Saved observation");
      fireEvent.click(display());
      fireEvent.change(editor(), { target: { value: "Changed explicitly" } });
      expect(onChange).toHaveBeenLastCalledWith("point", "Changed explicitly");
      fireEvent.change(editor(), { target: { value: "" } });
      expect(onChange).toHaveBeenLastCalledWith("point", "");
      fireEvent.blur(editor());
      expect(display()).toHaveTextContent("Click to add comment");
    });

    it("can still add a first comment and does not replace an active local edit on refetch", () => {
      const { rerender, ui, onChange } = setup(null);
      expect(screen.queryByTestId("preview-comment-row-point")).toBeNull();
      fireEvent.click(commentButton());
      fireEvent.change(editor(), { target: { value: "Local typing" } });
      rerender(ui("Older server snapshot"));
      expect(editor()).toHaveValue("Local typing");
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("locks an open editor immediately and uses the supplied persisted comment", () => {
      const { rerender, ui, onChange } = setup();
      fireEvent.click(display());
      const oldEditor = editor();
      fireEvent.change(oldEditor, { target: { value: "Typing before lock" } });
      const callsBefore = onChange.mock.calls.length;
      rerender(ui("Committed comment", { sectionStates: { section: { status: "submitted" } } }));
      expect(screen.queryByTestId("preview-comment-point")).toBeNull();
      expect(display()).toHaveTextContent("Committed comment");
      fireEvent.click(display());
      fireEvent.change(oldEditor, { target: { value: "Forbidden stale edit" } });
      expect(onChange).toHaveBeenCalledTimes(callsBefore);
      rerender(ui("Committed comment"));
      fireEvent.click(display());
      expect(editor()).toHaveValue("Committed comment");
    });

    it("keeps comments associated with their points through section and part navigation", () => {
      const first = section(matrix);
      const secondPoint = { ...first.questions[0], question_uuid: "point-two", question_code: "B1.2" };
      const onChange = vi.fn();
      render(<ConfiguredFormRenderer mode="live"
        parts={[...parts, { formPartUuid: "other", partCode: "C", partTitle: "Other points", partType: "configurable" }]}
        structures={{
          part: [{ ...first, questions: [...first.questions, secondPoint] }],
          other: [{ ...first, section_uuid: "other-section", questions: [
            { ...first.questions[0], question_uuid: "other-point" },
          ] }],
        }}
        live={{ answers: { point: "yes", "point-two": "no" },
          answerComments: { point: "First saved comment", "point-two": "Second saved comment", "other-point": "Other part comment" },
          onAnswerChange: vi.fn(), onAnswerCommentChange: onChange, isLocked: true }}
      />);
      expect(display()).toHaveTextContent("First saved comment");
      expect(screen.getByTestId("preview-comment-display-point-two")).toHaveTextContent("Second saved comment");
      fireEvent.click(screen.getByTestId("button-preview-section-toggle-section"));
      expect(screen.queryByTestId("preview-comment-display-point")).toBeNull();
      fireEvent.click(screen.getByTestId("button-preview-section-toggle-section"));
      expect(display()).toHaveTextContent("First saved comment");
      fireEvent.click(screen.getByTestId("button-step-other"));
      expect(screen.getByTestId("preview-comment-display-other-point")).toHaveTextContent("Other part comment");
      expect(screen.queryByTestId("preview-comment-display-point")).toBeNull();
      fireEvent.click(screen.getByTestId("button-step-part"));
      expect(display()).toHaveTextContent("First saved comment");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("does not carry local comments into another reopened submission", () => {
      const { rerender, ui, onChange } = setup();
      fireEvent.click(display());
      fireEvent.change(editor(), { target: { value: "First crew local text" } });
      rerender(ui("Second crew saved text", { isLocked: true }, "second"));
      expect(display()).toHaveTextContent("Second crew saved text");
      expect(screen.queryByText("First crew local text")).toBeNull();
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("shows multiline comments as plain text rather than HTML", () => {
      setup("<script>not executed</script>\nSecond line", { isLocked: true });
      expect(display().textContent).toBe("<script>not executed</script>\nSecond line");
      expect(display().querySelector("script")).toBeNull();
      expect(display()).toHaveClass("whitespace-pre-wrap");
    });
  });
}
