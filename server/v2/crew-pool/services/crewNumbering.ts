import { desc, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";

export async function generateNextCrewEmpNo(): Promise<string> {
  const rows: { empNo: string }[] = await getDb()
    .select({ empNo: crewMembersV2.empNo })
    .from(crewMembersV2)
    .orderBy(
      sql`${crewMembersV2.createdAt} DESC NULLS LAST`,
      desc(crewMembersV2.id),
    );

  if (rows.length === 0) return "A000001";

  const parsed = rows.map(({ empNo }) => {
    // Only the last group of digits changes; all other characters stay intact.
    const match = /^(.*?)([0-9]+)([^0-9]*)$/s.exec(empNo);
    if (!match) {
      throw new Error("Cannot generate a Crew ID: an existing ID contains no number.");
    }
    return {
      prefix: match[1],
      digits: match[2],
      suffix: match[3],
      number: BigInt(match[2]),
    };
  });

  // Rows are newest first. Equal-number ties keep the newest row's format.
  let reference = parsed[0];
  if (parsed.every(row => row.prefix === reference.prefix)) {
    for (const row of parsed) {
      if (row.number > reference.number) reference = row;
    }
  }

  const usedIds = new Set(rows.map(row => row.empNo));
  let next = reference.number + 1n;
  while (true) {
    const candidate = reference.prefix
      + next.toString().padStart(reference.digits.length, "0")
      + reference.suffix;
    if (!usedIds.has(candidate)) return candidate;
    next += 1n;
  }
}
