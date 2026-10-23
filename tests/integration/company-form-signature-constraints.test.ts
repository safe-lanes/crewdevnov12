import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { v4 as uuid } from "uuid";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const officerDesignationMigration = await readFile(
  "migrations/0228_company_form_officer_designation.sql",
  "utf8",
);

type SectionInput = {
  responsibleMode: string;
  responsibleRoleUuid?: string | null;
  responsibleDepartment?: string | null;
};

async function insertSection(
  client: PoolClient,
  formVersionUuid: string,
  formPartUuid: string,
  input: SectionInput,
) {
  await client.query(
    `INSERT INTO frm_sections(
       section_uuid, form_version_uuid, form_part_uuid, section_code,
       section_title, responsible_mode, responsible_role_uuid, responsible_department
     ) VALUES ($1, $2, $3, $4, 'Signature constraints fixture', $5, $6, $7)`,
    [
      uuid(),
      formVersionUuid,
      formPartUuid,
      uuid(),
      input.responsibleMode,
      input.responsibleRoleUuid ?? null,
      input.responsibleDepartment ?? null,
    ],
  );
}

async function expectConstraintFailure(
  client: PoolClient,
  query: string,
  values: unknown[],
  constraintName: string,
) {
  await client.query("SAVEPOINT expected_check_failure");
  try {
    await expect(client.query(query, values)).rejects.toMatchObject(
      constraintName === "Invalid form structure"
        ? { code: "23514", message: constraintName }
        : { code: "23514", constraint: constraintName },
    );
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT expected_check_failure");
    await client.query("RELEASE SAVEPOINT expected_check_failure");
  }
}

async function addSignatureContext(
  client: PoolClient,
  formVersionUuid: string,
  formPartUuid: string,
) {
  const sectionUuid = uuid();
  const sectionStateUuid = uuid();
  const signatureAttUuid = uuid();
  await client.query(
    `INSERT INTO frm_sections(
       section_uuid, form_version_uuid, form_part_uuid, section_code,
       section_title, responsible_mode
     ) VALUES ($1, $2, $3, $4, 'Signature fixture', 'not_applicable')`,
    [sectionUuid, formVersionUuid, formPartUuid, uuid()],
  );
  await client.query(
    `INSERT INTO frm_section_states(section_state_uuid, submission_uuid, section_uuid)
     VALUES ($1, $2, $3)`,
    [sectionStateUuid, uuid(), sectionUuid],
  );
  await client.query(
    `INSERT INTO frm_signature_attachments(sig_att_uuid, file_path)
     VALUES ($1, 'company-form-constraints-test')`,
    [signatureAttUuid],
  );
  return { sectionStateUuid, signatureAttUuid };
}

async function insertSignature(
  client: PoolClient,
  formVersionUuid: string,
  formPartUuid: string,
  signature: {
    type: "officer" | "seafarer";
    method: "officer" | "witnessed" | "authenticated";
    name: string;
    rank: string | null;
  },
) {
  const context = await addSignatureContext(client, formVersionUuid, formPartUuid);
  await client.query(
    `INSERT INTO frm_section_signatures(
       section_signature_uuid, section_state_uuid, signature_type,
       signature_att_uuid, signer_name, signer_rank, signed_at,
       signed_by_uuid, signature_method
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
    [
      uuid(),
      context.sectionStateUuid,
      signature.type,
      context.signatureAttUuid,
      signature.name,
      signature.rank,
      uuid(),
      signature.method,
    ],
  );
}

describe.sequential("company form responsibility and signature constraints", () => {
  afterAll(async () => pool.end());

  it("installs the expanded CHECK contracts and accepts only the supported row shapes", async () => {
    expect(officerDesignationMigration).not.toMatch(
      /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?frm_section_signatures\b/i,
    );
    const client = await pool.connect();
    let digestBefore: string | undefined;
    let transactionStarted = false;
    try {
      const constraints = await client.query<{ conname: string; definition: string }>(
        `SELECT conname, pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
         WHERE conrelid IN ('public.frm_sections'::regclass,
                            'public.frm_section_signatures'::regclass)
           AND conname = ANY($1::text[])`,
        [[
          "chk_frm_sections_responsible_mode",
          "chk_frm_sections_responsible_target",
          "chk_frm_section_signatures_officer",
          "chk_frm_section_signatures_seafarer",
        ]],
      );
      const definitions = Object.fromEntries(
        constraints.rows.map(({ conname, definition }) => [conname, definition.toLowerCase()]),
      );
      expect(Object.keys(definitions).sort()).toEqual([
        "chk_frm_section_signatures_officer",
        "chk_frm_section_signatures_seafarer",
        "chk_frm_sections_responsible_mode",
        "chk_frm_sections_responsible_target",
      ]);
      expect(definitions.chk_frm_sections_responsible_mode).toContain("seafarer");
      expect(definitions.chk_frm_sections_responsible_target).toContain("btrim(responsible_department)");
      expect(definitions.chk_frm_sections_responsible_target).toContain("'seafarer'");
      expect(definitions.chk_frm_section_signatures_officer).toContain("signature_method = 'officer'");
      expect(definitions.chk_frm_section_signatures_officer).toContain("signer_rank is null");
      expect(definitions.chk_frm_section_signatures_officer).toContain("btrim(signer_rank)");
      expect(definitions.chk_frm_section_signatures_seafarer).toContain("witnessed");
      expect(definitions.chk_frm_section_signatures_seafarer).toContain("authenticated");
      expect(definitions.chk_frm_section_signatures_seafarer).toContain("btrim(signer_name)");
      expect(definitions.chk_frm_section_signatures_seafarer).toContain("btrim(signer_rank)");

      await client.query("BEGIN");
      transactionStarted = true;
      const existingSignatures = await client.query<{ digest: string }>(
        `SELECT md5(COALESCE(string_agg(to_jsonb(signature)::text, E'\\n' ORDER BY id), '')) AS digest
         FROM frm_section_signatures AS signature`,
      );
      digestBefore = existingSignatures.rows[0].digest;

      const formUuid = uuid();
      const form = await client.query<{ id: number }>(
        `INSERT INTO adm_forms_v2(
           form_uuid, name, category, rank_group, version_no, version_date, is_lock_form
         ) VALUES ($1, $2, 'briefing', 'Constraint fixture', '1', '01-Jan-2026', true)
         RETURNING id`,
        [formUuid, `Constraint fixture ${formUuid}`],
      );
      const rankGroupUuid = uuid();
      const rankGroup = await client.query<{ id: number }>(
        `INSERT INTO adm_rank_groups_v2(rg_uuid, form_id, name, ranks)
         VALUES ($1, $2, 'Constraint fixture', '[]') RETURNING id`,
        [rankGroupUuid, form.rows[0].id],
      );
      const formVersionUuid = uuid();
      await client.query(
        `INSERT INTO adm_form_versions_v2(
           fv_uuid, form_id, rank_group_id, version_no, version_date, status
         ) VALUES ($1, $2, $3, '1', '01-Jan-2026', 'draft')`,
        [formVersionUuid, form.rows[0].id, rankGroup.rows[0].id],
      );
      const formPartUuid = uuid();
      await client.query(
        `INSERT INTO frm_form_parts(
           form_part_uuid, form_uuid, form_version_uuid, part_code, part_title, part_type
         ) VALUES ($1, $2, $3, 'B', 'Constraint fixture', 'configurable')`,
        [formPartUuid, formUuid, formVersionUuid],
      );

      const roleUuid = uuid();
      await client.query(
        `INSERT INTO adm_rolemaster_ac(ruid, assigned_role, roletype)
         VALUES ($1, 'Company form constraint fixture', 'office')`,
        [roleUuid],
      );
      await insertSection(client, formVersionUuid, formPartUuid, {
        responsibleMode: "role",
        responsibleRoleUuid: roleUuid,
      });
      await insertSection(client, formVersionUuid, formPartUuid, {
        responsibleMode: "department",
        responsibleDepartment: "Operations",
      });
      await insertSection(client, formVersionUuid, formPartUuid, {
        responsibleMode: "not_applicable",
      });
      await insertSection(client, formVersionUuid, formPartUuid, {
        responsibleMode: "seafarer",
      });

      const sectionInsert = `INSERT INTO frm_sections(
        section_uuid, form_version_uuid, form_part_uuid, section_code,
        section_title, responsible_mode, responsible_role_uuid, responsible_department
      ) VALUES ($1, $2, $3, $4, 'Invalid responsibility fixture', $5, $6, $7)`;
      const invalidResponsibility = async (
        mode: string,
        role: string | null,
        department: string | null,
      ) => expectConstraintFailure(
        client,
        sectionInsert,
        [uuid(), formVersionUuid, formPartUuid, uuid(), mode, role, department],
        (mode === "role" && role === null && department === null)
          || (mode === "department" && role === null && !department?.trim())
          ? "Invalid form structure"
          : "chk_frm_sections_responsible_target",
      );
      await invalidResponsibility("role", null, null);
      await invalidResponsibility("role", roleUuid, "Operations");
      await invalidResponsibility("department", null, null);
      await invalidResponsibility("department", null, "   ");
      await invalidResponsibility("department", roleUuid, "Operations");
      await invalidResponsibility("seafarer", roleUuid, null);
      await invalidResponsibility("seafarer", null, "Operations");
      await invalidResponsibility("not_applicable", roleUuid, null);
      await invalidResponsibility("not_applicable", null, "Operations");

      await insertSignature(client, formVersionUuid, formPartUuid, {
        type: "officer",
        method: "officer",
        name: "Designated Officer",
        rank: "Fleet Superintendent",
      });
      await insertSignature(client, formVersionUuid, formPartUuid, {
        type: "officer",
        method: "officer",
        name: "Legacy Officer",
        rank: null,
      });
      await expectConstraintFailure(
        client,
        `INSERT INTO frm_section_signatures(
           section_signature_uuid, section_state_uuid, signature_type,
           signature_att_uuid, signer_name, signer_rank, signed_at,
           signed_by_uuid, signature_method
         ) VALUES ($1, $2, 'officer', $3, 'Wrong method', NULL, NOW(), $4, 'witnessed')`,
        await (async () => {
          const context = await addSignatureContext(client, formVersionUuid, formPartUuid);
          return [uuid(), context.sectionStateUuid, context.signatureAttUuid, uuid()];
        })(),
        "chk_frm_section_signatures_officer",
      );

      await insertSignature(client, formVersionUuid, formPartUuid, {
        type: "seafarer",
        method: "witnessed",
        name: "Witnessed Seafarer",
        rank: "Master",
      });
      await insertSignature(client, formVersionUuid, formPartUuid, {
        type: "seafarer",
        method: "authenticated",
        name: "Authenticated Seafarer",
        rank: "Chief Engineer",
      });
      const invalidSeafarer = async (method: string, name: string, rank: string | null) => {
        const context = await addSignatureContext(client, formVersionUuid, formPartUuid);
        await expectConstraintFailure(
          client,
          `INSERT INTO frm_section_signatures(
             section_signature_uuid, section_state_uuid, signature_type,
             signature_att_uuid, signer_name, signer_rank, signed_at,
             signed_by_uuid, signature_method
           ) VALUES ($1, $2, 'seafarer', $3, $4, $5, NOW(), $6, $7)`,
          [uuid(), context.sectionStateUuid, context.signatureAttUuid, name, rank, uuid(), method],
          "chk_frm_section_signatures_seafarer",
        );
      };
      await invalidSeafarer("officer", "Invalid method", "Master");
      await invalidSeafarer("witnessed", "  ", "Master");
      await invalidSeafarer("authenticated", "Missing rank", null);
      await invalidSeafarer("witnessed", "Blank rank", "  ");
    } finally {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }
      client.release();
    }

    const clientAfterRollback = await pool.connect();
    try {
      const signaturesAfterRollback = await clientAfterRollback.query<{ digest: string }>(
        `SELECT md5(COALESCE(string_agg(to_jsonb(signature)::text, E'\\n' ORDER BY id), '')) AS digest
         FROM frm_section_signatures AS signature`,
      );
      expect(signaturesAfterRollback.rows[0].digest).toBe(digestBefore);
    } finally {
      clientAfterRollback.release();
    }
  });
});