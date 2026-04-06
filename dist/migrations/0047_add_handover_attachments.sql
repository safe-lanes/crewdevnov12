-- Migration: Add handover_attachments column to vessel_planning table
-- This stores JSON array of file attachments for handover documentation

ALTER TABLE vessel_planning
ADD COLUMN IF NOT EXISTS handover_attachments TEXT;

-- Add comment for documentation
COMMENT ON COLUMN vessel_planning.handover_attachments IS 'JSON array of handover file attachments: [{filename, fileType, uploadDate, uploadedBy, fileSize, fileData}, ...]';
