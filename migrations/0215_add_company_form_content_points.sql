-- Content points keep sanitized display HTML separate from their short label.
ALTER TABLE frm_questions ADD COLUMN IF NOT EXISTS content_html TEXT;

ALTER TABLE frm_questions DROP CONSTRAINT IF EXISTS chk_frm_questions_response_type;
ALTER TABLE frm_questions ADD CONSTRAINT chk_frm_questions_response_type
  CHECK (response_type IN (
    'yes_no', 'yes_no_na', 'single_select', 'multi_select',
    'free_text', 'date', 'number', 'checkbox', 'info_only', 'content'
  ));