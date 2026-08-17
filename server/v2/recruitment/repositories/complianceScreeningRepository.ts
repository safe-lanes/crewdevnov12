import { v4 as uuidv4 } from "uuid";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
    recCandidateScreening,
    type RecCandidateScreening,
    type InsertRecCandidateScreening,
} from "../../../../shared/v2/recruitment/schema";

export class ScreeningRepository {
    /** ONE row per candidate: insert on first screen, overwrite on re-screen. */
    async upsert(
        recCanUuid: string,
        data: Partial<InsertRecCandidateScreening>,
    ): Promise<RecCandidateScreening> {
        const db = getDb();
        const rows = await db
            .insert(recCandidateScreening)
            .values({
                screeningUuid: uuidv4(),
                recCanUuid,
                ...data,
            })
            .onConflictDoUpdate({
                target: recCandidateScreening.recCanUuid,
                set: {
                    ...data,
                    isDeleted: false,
                    updatedAt: new Date(),
                },
            })
            .returning();
        return rows[0];
    }

    async findByCandidate(recCanUuid: string): Promise<RecCandidateScreening | undefined> {
        const db = getDb();
        const rows = await db
            .select()
            .from(recCandidateScreening)
            .where(
                and(
                    eq(recCandidateScreening.recCanUuid, recCanUuid),
                    eq(recCandidateScreening.isDeleted, false),
                ),
            )
            .limit(1);
        return rows[0];
    }

    async updateRemark(
        recCanUuid: string,
        remark: string | null,
        remarkByUuid?: string | null,
    ): Promise<RecCandidateScreening | undefined> {
        const db = getDb();
        const rows = await db
            .update(recCandidateScreening)
            .set({
                remark,
                remarkByUuid: remarkByUuid ?? null,
                remarkOn: new Date(),
                updatedAt: new Date(),
                updatedByUuid: remarkByUuid ?? null,
            })
            .where(
                and(
                    eq(recCandidateScreening.recCanUuid, recCanUuid),
                    eq(recCandidateScreening.isDeleted, false),
                ),
            )
            .returning();
        return rows[0];
    }
}

export const screeningRepository = new ScreeningRepository();