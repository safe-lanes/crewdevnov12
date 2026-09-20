-- 0200: Register Travel Document Type (027) in the Data Masters list.
-- The actual document type values live in master_travel_document_types (migration 0199);
-- this entry only makes Travel Document Type appear in the Admin > Masters list.

INSERT INTO data_masters (id, name, description)
VALUES ('027', 'Travel Document Type', 'Travel & identification document types used in Crew Pool C1 and Recruitment A2.1')
ON CONFLICT (id) DO NOTHING;
