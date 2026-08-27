import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { v4 as uuidv4 } from "uuid";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationSql = await readFile("migrations/0200_form_version_option_sets.sql", "utf8");

async function createLegacyFixture(client: PoolClient) {
  const formUuid = uuidv4();
  const versionUuid = uuidv4();
  const partUuid = uuidv4();
  const sectionUuid = uuidv4();
  const questionUuid = uuidv4();
  const activeOptionUuid = uuidv4();
  const deletedOptionUuid = uuidv4();
  const form = await client.query<{ id: number }>(`
    INSERT INTO adm_forms_v2(
      form_uuid, name, category, rank_group, version_no, version_date, is_lock_form
    ) VALUES ($1, $2, 'briefing', 'migration test', '00', '27-Aug-2026', false)
    RETURNING id
  `, [formUuid, `Option migration ${formUuid}`]);
  await client.query(`
    INSERT INTO adm_form_versions_v2(
      fv_uuid, form_id, version_no, version_date, status
    ) VALUES ($1, $2, '01', '27-Aug-2026', 'draft')
  `, [versionUuid, form.rows[0].id]);
  await client.query(`
    INSERT INTO frm_form_parts(
      form_part_uuid, form_uuid, part_code, part_title, part_type
    ) VALUES ($1, $2, 'B', 'Points', 'configurable')
  `, [partUuid, formUuid]);
  await client.query(`
    INSERT INTO frm_sections(
      section_uuid, form_version_uuid, form_part_uuid, section_code,
      section_title, responsible_mode
    ) VALUES ($1, $2, $3, 'B1', 'Points', 'not_applicable')
  `, [sectionUuid, versionUuid, partUuid]);
  await client.query(`
    INSERT INTO frm_questions(
      question_uuid, section_uuid, question_code, question_text, response_type
    ) VALUES ($1, $2, 'B1Q1', 'Choose', 'single_select')
  `, [questionUuid, sectionUuid]);
  await client.query(`
    CREATE TABLE frm_question_options (
      id SERIAL PRIMARY KEY,
      option_uuid TEXT NOT NULL UNIQUE,
      question_uuid TEXT NOT NULL REFERENCES frm_questions(question_uuid),
      option_label TEXT NOT NULL,
      option_value TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      created_by_uuid TEXT,
      updated_by_uuid TEXT,
      is_deleted BOOLEAN DEFAULT FALSE,
      is_sync BOOLEAN DEFAULT FALSE
    )
  `);
  await client.query(`
    INSERT INTO frm_question_options(
      option_uuid, question_uuid, option_label, option_value, sort_order, is_deleted
    ) VALUES
      ($1, $3, 'Active', 'active', 0, false),
      ($2, $3, 'Archived', 'archived', 1, true)
  `, [activeOptionUuid, deletedOptionUuid, questionUuid]);
  return { questionUuid, activeOptionUuid, deletedOptionUuid };
}

describe.sequential("form option-set migration", () => {
  afterAll(async () => pool.end());

  it("preserves active and soft-deleted legacy options and succeeds twice", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const fixture = await createLegacyFixture(client);
      await client.query(migrationSql);
      await client.query(migrationSql);
      const question = await client.query<{ option_set_uuid: string }>(
        "SELECT option_set_uuid FROM frm_questions WHERE question_uuid = $1",
        [fixture.questionUuid],
      );
      const options = await client.query<{ option_uuid: string; is_deleted: boolean }>(
        "SELECT option_uuid, is_deleted FROM frm_options WHERE option_set_uuid = $1 ORDER BY sort_order",
        [question.rows[0].option_set_uuid],
      );
      expect(options.rows).toEqual([
        { option_uuid: fixture.activeOptionUuid, is_deleted: false },
        { option_uuid: fixture.deletedOptionUuid, is_deleted: true },
      ]);
      const legacy = await client.query("SELECT to_regclass('public.frm_question_options') AS table_name");
      expect(legacy.rows[0].table_name).toBeNull();
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("refuses to remove the legacy table while an answer foreign key depends on it", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await createLegacyFixture(client);
      await client.query(`
        CREATE TABLE task246_fake_answers (
          id SERIAL PRIMARY KEY,
          option_uuid TEXT REFERENCES frm_question_options(option_uuid)
        )
      `);
      await expect(client.query(migrationSql)).rejects.toThrow("foreign-key dependenc");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});