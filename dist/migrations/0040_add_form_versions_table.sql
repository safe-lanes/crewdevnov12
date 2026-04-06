-- Add form_versions table for tracking draft and released form versions
CREATE TABLE IF NOT EXISTS form_versions (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  version_no TEXT NOT NULL,
  version_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  configuration TEXT,
  shared_config TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  released_at TIMESTAMP
);

-- Create index for efficient lookups by form_id
CREATE INDEX IF NOT EXISTS idx_form_versions_form_id ON form_versions(form_id);

-- Create index for finding draft versions
CREATE INDEX IF NOT EXISTS idx_form_versions_status ON form_versions(status);
