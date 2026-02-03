import { Router } from "express";
import { getDb } from "../db";
import { masterPorts } from "@shared/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    const searchTerm = typeof q === "string" ? q.trim() : "";
    
    if (searchTerm.length < 2) {
      return res.json([]);
    }

    const db = getDb();
    const searchPattern = `%${searchTerm}%`;
    
    const results = await db
      .select({
        portUuid: masterPorts.portUuid,
        name: masterPorts.name,
        country: masterPorts.country,
        portCode: masterPorts.portcode,
      })
      .from(masterPorts)
      .where(
        and(
          eq(masterPorts.isDeleted, false),
          eq(masterPorts.isActive, true),
          or(
            ilike(masterPorts.name, searchPattern),
            ilike(masterPorts.country, searchPattern),
            ilike(masterPorts.portcode, searchPattern)
          )
        )
      )
      .orderBy(masterPorts.name)
      .limit(50);

    res.json(results);
  } catch (error) {
    console.error("Port search error:", error);
    res.status(500).json({ error: "Failed to search ports" });
  }
});

router.get("/:portUuid", async (req, res) => {
  try {
    const { portUuid } = req.params;
    const db = getDb();
    
    const results = await db
      .select({
        portUuid: masterPorts.portUuid,
        name: masterPorts.name,
        country: masterPorts.country,
        portCode: masterPorts.portcode,
      })
      .from(masterPorts)
      .where(
        and(
          eq(masterPorts.portUuid, portUuid),
          eq(masterPorts.isDeleted, false),
          eq(masterPorts.isActive, true)
        )
      )
      .limit(1);

    if (results.length === 0) {
      return res.status(404).json({ error: "Port not found" });
    }

    res.json(results[0]);
  } catch (error) {
    console.error("Port fetch error:", error);
    res.status(500).json({ error: "Failed to fetch port" });
  }
});

export default router;
