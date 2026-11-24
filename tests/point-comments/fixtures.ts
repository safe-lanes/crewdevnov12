// Isolated saved-response fixtures; never point these tests at a tenant API.
export const formFamilies = ["briefing", "debriefing", "interview", "company"] as const;
export type FormFamily = typeof formFamilies[number];
export type StoredPoint = { comment: string | null; value: string; submitted: boolean };

export function legacyFixture(stored: StoredPoint, matrix: boolean) {
  return {
    submission: { status: "in_progress", vessel_type_uuid: "all" },
    parts: [{ form_part_uuid: "part", part_code: "B", part_title: "Discussion points", part_type: "configurable" }],
    structure: {
      sections: [{
        form_part_uuid: "part", section_uuid: "section", section_code: "B1", section_title: "Safety",
        applicable_vessel_types: [], responsible_mode: "not_applicable", responsible_role_uuid: null,
        responsible_department: null, comment_box_required: false,
        layout_preference: matrix ? "auto" : "list", default_option_set_uuid: "options",
      }],
      questions: [{
        section_uuid: "section", question_uuid: "point", question_code: "B1.1",
        question_text: "Safety briefing complete?", response_type: "single_select",
        is_mandatory: false, comment_enabled: true, option_set_uuid: "options",
      }],
      options: [
        { option_set_uuid: "options", option_uuid: "opt-yes", option_label: "Yes", option_value: "yes" },
        { option_set_uuid: "options", option_uuid: "opt-no", option_label: "No", option_value: "no" },
      ],
    },
    answers: [{ question_uuid: "point", answer_value: stored.value, answer_comment: stored.comment }],
    section_states: [{
      section_state_uuid: "state", section_uuid: "section",
      status: stored.submitted ? "submitted" : "not_started", section_comment: null,
    }],
    signatures: [],
  };
}

export function companyFixture(stored: StoredPoint, matrix: boolean) {
  return {
    submission: {
      submissionUuid: "saved", subjectType: "crew_assignment", subjectRef: "assignment",
      formUuid: "form", formVersionUuid: "version", stageKey: "on_board", status: "in_progress",
      canEdit: true, canVoid: false, createdAt: "2026-11-01", completedAt: null,
      replacedBySubmissionUuid: null, replacesSubmissionUuid: null,
    },
    form: { formName: "Company declaration", description: null, category: "dynamic", archivedAt: null },
    version: { formVersionUuid: "version", versionNo: "01", versionDate: "2026-11-01",
      status: "released", stageKey: "on_board", stageLabel: "On board", releasedAt: "2026-11-01" },
    signatureMethodOptions: {}, systemFields: [], replacementHistory: [],
    optionSets: [{
      optionSetUuid: "options", setName: "Yes/No", sortOrder: 0,
      options: [
        { optionUuid: "opt-yes", optionLabel: "Yes", optionValue: "yes", sortOrder: 0 },
        { optionUuid: "opt-no", optionLabel: "No", optionValue: "no", sortOrder: 1 },
      ],
    }],
    parts: [{
      formPartUuid: "part", partCode: "B", partTitle: "Discussion points", partType: "configurable",
      isOfficeOnly: false, sortOrder: 0,
      sections: [{
        sectionUuid: "section", sectionCode: "B1", sectionTitle: "Safety", sortOrder: 0,
        applicableVesselTypes: [], responsibleMode: "not_applicable", responsibleRoleUuid: null,
        responsibleRole: null, responsibleDepartment: null, commentBoxRequired: false,
        signatureOfficerRequired: false, signatureSeafarerRequired: false, signatureVesselManagementRequired: false,
        requiresSubmission: true, isApplicable: true, canSubmit: !stored.submitted,
        canEdit: !stored.submitted, canSign: {}, defaultOptionSetUuid: "options",
        layoutPreference: matrix ? "matrix" : "list", effectiveLayout: matrix ? "matrix" : "list",
        questions: [{
          questionUuid: "point", questionCode: "B1.1", questionText: "Safety briefing complete?",
          responseType: "single_select", commentEnabled: true, isMandatory: false,
          optionSetUuid: "options", sortOrder: 0,
          options: [
            { optionUuid: "opt-yes", optionLabel: "Yes", optionValue: "yes", sortOrder: 0 },
            { optionUuid: "opt-no", optionLabel: "No", optionValue: "no", sortOrder: 1 },
          ],
        }],
      }],
    }],
    answers: [{
      answerUuid: "answer", questionUuid: "point", answerValue: stored.value,
      answerComment: stored.comment, createdAt: "2026-11-01", updatedAt: "2026-11-01",
    }],
    states: [{
      sectionStateUuid: "state", sectionUuid: "section", sectionComment: null,
      status: stored.submitted ? "submitted" : "not_started", signatures: [],
    }],
  };
}
