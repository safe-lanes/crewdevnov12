CREATE TABLE IF NOT EXISTS frm_document_branding (
 id bigserial UNIQUE NOT NULL,
 version_uuid text PRIMARY KEY,
 company_name text NOT NULL CHECK(length(btrim(company_name)) BETWEEN 1 AND 200),
 media_type text CHECK(media_type IN('image/png','image/jpeg')),
 bytes_base64 text,
 sha256 text,
 actor jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((media_type IS NULL AND bytes_base64 IS NULL AND sha256 IS NULL) OR
   (media_type IS NOT NULL AND bytes_base64 IS NOT NULL AND sha256 ~ '^[a-f0-9]{64}$'
    AND octet_length(decode(bytes_base64,'base64')) BETWEEN 1 AND 2097152
    AND encode(sha256(decode(bytes_base64,'base64')),'hex')=sha256))
);
CREATE TRIGGER trg_frm_document_branding_immutable BEFORE UPDATE OR DELETE ON frm_document_branding
 FOR EACH ROW EXECUTE FUNCTION frm_document_evidence_immutable();
