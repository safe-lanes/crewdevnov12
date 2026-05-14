import { Pool } from "pg";
import { randomUUID } from "crypto";

const TAG = "demo-seed-2026";
const VESSEL_ID = "744cf286-841a-11ed-aa7c-7003bca91a86";

interface PromotionSeed {
  crew: string;
  rank: string;
  date: string;
  vessel: string;
}

const FALLBACK_PROMOTIONS: PromotionSeed[] = [
  { crew: "A000030",   rank: "Chief Officer",  date: "2026-01-15", vessel: "Atlantic Star" },
  { crew: "A000031",   rank: "Chief Officer",  date: "2026-02-10", vessel: "Atlantic Star" },
  { crew: "A000036",   rank: "2nd Officer",    date: "2026-03-05", vessel: "Pacific Dawn" },
  { crew: "A000040",   rank: "3rd Officer",    date: "2026-04-12", vessel: "Pacific Dawn" },
  { crew: "A000041",   rank: "Chief Engineer", date: "2026-05-20", vessel: "Northern Light" },
  { crew: "A000042",   rank: "2nd Engineer",   date: "2026-06-18", vessel: "Northern Light" },
  { crew: "A000043",   rank: "Bosun",          date: "2026-07-22", vessel: "Southern Cross" },
  { crew: "A000044",   rank: "AB",             date: "2026-08-08", vessel: "Southern Cross" },
  { crew: "V2-000001", rank: "Master",         date: "2026-09-14", vessel: "Atlantic Star" },
  { crew: "A0029",     rank: "OS",             date: "2026-10-30", vessel: "Pacific Dawn" },
  { crew: "A00102",    rank: "Master",         date: "2026-11-11", vessel: "Northern Light" },
  { crew: "A00103",    rank: "Chief Engineer", date: "2026-12-05", vessel: "Northern Light" },
];

const RANK_ROTATION = [
  "Master", "Chief Officer", "2nd Officer", "3rd Officer", "Chief Engineer",
  "2nd Engineer", "3rd Engineer", "Bosun", "AB", "OS",
];
const VESSELS = ["Atlantic Star", "Pacific Dawn", "Northern Light", "Southern Cross"];

async function buildPromotions(client: any): Promise<PromotionSeed[]> {
  const candidatesRes = await client.query(
    `SELECT file_no FROM recruitment_candidates_v2
       WHERE file_no IS NOT NULL AND COALESCE(is_deleted,false)=false
       ORDER BY id`
  );
  const crewIdsRes = await client.query(
    `SELECT DISTINCT crew_member_id FROM promotion_reviews_v2
       WHERE crew_member_id IS NOT NULL ORDER BY crew_member_id`
  );
  const candidateFileNos: string[] = candidatesRes.rows.map((r: any) => r.file_no);
  const knownCrewIds: string[] = crewIdsRes.rows.map((r: any) => r.crew_member_id);
  const pool = Array.from(new Set([...candidateFileNos, ...knownCrewIds]));
  if (pool.length === 0) {
    console.warn("[seed] no existing crew/recruitment IDs found; using fallback synthetic IDs");
    return FALLBACK_PROMOTIONS;
  }

  const existingPairsRes = await client.query(
    `SELECT crew_member_id, promotion_to_rank FROM promotion_reviews_v2
       WHERE crew_member_id IS NOT NULL AND promotion_to_rank IS NOT NULL`
  );
  const taken = new Set(
    existingPairsRes.rows.map((r: any) => `${r.crew_member_id}|${r.promotion_to_rank}`)
  );

  const seeds: PromotionSeed[] = [];
  let monthIndex = 0;
  outer: for (let i = 0; i < pool.length; i++) {
    for (let r = 0; r < RANK_ROTATION.length; r++) {
      const crew = pool[i];
      const rank = RANK_ROTATION[(i + r) % RANK_ROTATION.length];
      const key = `${crew}|${rank}`;
      if (taken.has(key)) continue;
      taken.add(key);
      const month = (monthIndex % 12) + 1;
      const day = ((monthIndex * 7) % 26) + 2;
      seeds.push({
        crew,
        rank,
        date: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        vessel: VESSELS[monthIndex % VESSELS.length],
      });
      monthIndex++;
      if (seeds.length >= 12) break outer;
      break;
    }
  }
  if (seeds.length < 5) {
    console.warn(
      `[seed] only ${seeds.length} unique (crew, rank) pairs available — filling with synthetic IDs`
    );
    for (const f of FALLBACK_PROMOTIONS) {
      const key = `${f.crew}|${f.rank}`;
      if (taken.has(key)) continue;
      taken.add(key);
      seeds.push(f);
      if (seeds.length >= 12) break;
    }
  }
  return seeds;
}

interface DaParent {
  testType: string;
  status: string;
  dateField: "dateTimeTestCompleted" | "incidentDateTime";
  date: string;
  comments: string;
}

const DA_PARENTS: DaParent[] = [
  { testType: "post-incident", status: "submitted", dateField: "incidentDateTime",     date: "2026-03-12T08:30", comments: "Post-incident screening" },
  { testType: "periodic",      status: "submitted", dateField: "dateTimeTestCompleted", date: "2026-05-22T14:00", comments: "Quarterly random testing" },
  { testType: "monthly",       status: "submitted", dateField: "dateTimeTestCompleted", date: "2026-08-09T11:15", comments: "Monthly compliance check" },
  { testType: "post-incident", status: "submitted", dateField: "incidentDateTime",     date: "2026-10-04T22:45", comments: "Galley fire incident screening" },
];

interface DaChild {
  parentIdx: number;
  crewId: string;
  rank: string;
  name: string;
  alcoholViolation: boolean;
  drugViolation: boolean;
}

const DA_CHILDREN: DaChild[] = [
  { parentIdx: 0, crewId: "cd6cb1ee-54e3-4ad6-b4d3-bbff77ea0f17", rank: "Chief Officer", name: "Jack Sparrow",      alcoholViolation: true,  drugViolation: false },
  { parentIdx: 0, crewId: "A000041",                               rank: "AB",            name: "Marco Polo",         alcoholViolation: false, drugViolation: true  },
  { parentIdx: 1, crewId: "A000042",                               rank: "OS",            name: "Vasco da Gama",      alcoholViolation: true,  drugViolation: false },
  { parentIdx: 1, crewId: "A000043",                               rank: "2nd Engineer",  name: "Ferdinand Magellan", alcoholViolation: false, drugViolation: true  },
  { parentIdx: 2, crewId: "A000044",                               rank: "Bosun",         name: "James Cook",         alcoholViolation: true,  drugViolation: true  },
  { parentIdx: 2, crewId: "A000040",                               rank: "AB",            name: "Henry Hudson",       alcoholViolation: true,  drugViolation: false },
  { parentIdx: 3, crewId: "A000036",                               rank: "3rd Officer",   name: "Francis Drake",      alcoholViolation: false, drugViolation: true  },
  { parentIdx: 3, crewId: "A000031",                               rank: "Chief Engineer",name: "Roald Amundsen",     alcoholViolation: true,  drugViolation: false },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const delPromos = await client.query(
      `DELETE FROM promotion_reviews_v2 WHERE created_by_uuid = $1`,
      [TAG]
    );

    const c = await client.query(
      `DELETE FROM da_personnel_tested_v2 WHERE created_by_uuid = $1`,
      [TAG]
    );
    const delChildren = c.rowCount ?? 0;
    const p = await client.query(
      `DELETE FROM da_test_records_v2 WHERE created_by_uuid = $1`,
      [TAG]
    );
    const delParents = p.rowCount ?? 0;

    const promotions = await buildPromotions(client);
    let promoInserted = 0;
    for (const p of promotions) {
      await client.query(
        `INSERT INTO promotion_reviews_v2
          (review_uuid, crew_member_id, promotion_to_rank, promotion_confirmed,
           vessel_assigned, promotion_date, promotion_timing, status,
           sort_order, created_by_uuid, updated_by_uuid, is_deleted, is_sync)
         VALUES ($1, $2, $3, 'yes', $4, $5, 'immediate', 'approved', 0, $6, $6, false, false)`,
        [randomUUID(), p.crew, p.rank, p.vessel, p.date, TAG]
      );
      promoInserted++;
    }

    const parentUuids: string[] = [];
    for (const parent of DA_PARENTS) {
      const daUuid = randomUUID();
      parentUuids.push(daUuid);

      const dateTimeTestCompleted =
        parent.dateField === "dateTimeTestCompleted" ? parent.date : null;
      const incidentDateTime =
        parent.dateField === "incidentDateTime" ? parent.date : null;

      await client.query(
        `INSERT INTO da_test_records_v2
          (da_uuid, vessel_id, test_type, place_location,
           date_time_test_completed, incident_date_time, test_date_time,
           equipment_not_applicable, frequency_months, violations,
           status, sort_order, comments, initiated_by,
           created_by_uuid, updated_by_uuid, is_deleted, is_sync)
         VALUES ($1, $2, $3, 'At Sea',
                 $4, $5, $6,
                 true, 12, 0,
                 $7, 0, $8, 'Demo Seed',
                 $9, $9, false, false)`,
        [
          daUuid,
          VESSEL_ID,
          parent.testType,
          dateTimeTestCompleted,
          incidentDateTime,
          parent.date,
          parent.status,
          parent.comments,
          TAG,
        ]
      );
    }

    let childInserted = 0;
    for (const c of DA_CHILDREN) {
      const parentUuid = parentUuids[c.parentIdx];
      const dateOnly = DA_PARENTS[c.parentIdx].date.substring(0, 10);
      await client.query(
        `INSERT INTO da_personnel_tested_v2
          (pt_uuid, test_record_uuid, crew_id, rank, name,
           alcohol_test_checked, alcohol_test_date, alcohol_results, alcohol_violation,
           drug_test_checked,    drug_test_date,    drug_results,    drug_violation,
           sort_order, created_by_uuid, updated_by_uuid, is_deleted, is_sync)
         VALUES ($1, $2, $3, $4, $5,
                 true, $6, $7, $8,
                 true, $6, $9, $10,
                 0, $11, $11, false, false)`,
        [
          randomUUID(),
          parentUuid,
          c.crewId,
          c.rank,
          c.name,
          dateOnly,
          c.alcoholViolation ? "Positive" : "Negative",
          c.alcoholViolation,
          c.drugViolation ? "Positive" : "Negative",
          c.drugViolation,
          TAG,
        ]
      );
      childInserted++;
    }

    await client.query("COMMIT");

    console.log("=== Demo seed complete (tag = " + TAG + ") ===");
    console.log("Removed before insert:");
    console.log("  promotion_reviews_v2:    " + (delPromos.rowCount ?? 0) + " rows");
    console.log("  da_test_records_v2:      " + delParents + " rows");
    console.log("  da_personnel_tested_v2:  " + delChildren + " rows");
    console.log("Inserted:");
    console.log("  promotion_reviews_v2:    " + promoInserted + " rows");
    console.log("  da_test_records_v2:      " + parentUuids.length + " rows");
    console.log("  da_personnel_tested_v2:  " + childInserted + " rows");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed, rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
