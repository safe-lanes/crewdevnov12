import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { crewTerminations } from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewTermination,
  InsertCrewTermination,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export class CrewTerminationsRepository {
  async create(
    data: Omit<InsertCrewTermination, "termUuid">,
    tx?: any,
  ): Promise<CrewTermination> {
    const db = tx || getDb();
    const results = await db
      .insert(crewTerminations)
      .values({ ...data, termUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async listAll(): Promise<CrewTermination[]> {
    const db = getDb();
    return db
      .select()
      .from(crewTerminations)
      .where(eq(crewTerminations.isDeleted, false))
      .orderBy(desc(crewTerminations.createdAt));
  }

  async findLatestByCrewUuid(
    crewUuid: string,
  ): Promise<CrewTermination | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewTerminations)
      .where(
        and(
          eq(crewTerminations.crewUuid, crewUuid),
          eq(crewTerminations.isDeleted, false),
        ),
      )
      .orderBy(desc(crewTerminations.createdAt))
      .limit(1);
    return results[0];
  }
}

export const crewTerminationsRepository = new CrewTerminationsRepository();
