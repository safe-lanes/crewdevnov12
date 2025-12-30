-- Add selected_approvers_for_submission column to promotion_reviews table
-- This stores the approvers selected in Section A4 "Submit for Approval to" dropdown

ALTER TABLE promotion_reviews
ADD COLUMN IF NOT EXISTS selected_approvers_for_submission TEXT;

-- Add comment for documentation
COMMENT ON COLUMN promotion_reviews.selected_approvers_for_submission IS 'JSON array of approver names selected in Section A4 Submit for Approval dropdown';
