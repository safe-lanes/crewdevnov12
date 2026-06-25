-- Migration: Create promotions checklist attachments table
-- Target: promo_checklist_attachments_v2
-- Description: Establishes the new table for promotions attachments under the canonical schema (without file_data).

CREATE TABLE IF NOT EXISTS public.promo_checklist_attachments_v2 (
    id SERIAL PRIMARY KEY,
    att_uuid TEXT NOT NULL UNIQUE,
    checklist_progress_uuid TEXT NOT NULL REFERENCES public.promo_checklist_progress_v2(cp_uuid) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size TEXT,
    file_type TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_uuid TEXT,
    updated_by_uuid TEXT,
    is_deleted BOOLEAN DEFAULT false,
    is_sync BOOLEAN DEFAULT false
);

-- Indexes for performance & lookups
CREATE INDEX IF NOT EXISTS idx_promo_checklist_attachments_progress_uuid ON public.promo_checklist_attachments_v2(checklist_progress_uuid);
CREATE INDEX IF NOT EXISTS idx_promo_checklist_attachments_is_deleted ON public.promo_checklist_attachments_v2(is_deleted);
