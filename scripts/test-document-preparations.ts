import type { Express } from "express";
import { createDocumentPreparationQueue } from "../server/v2/company-forms/documentArchive";
import { getDb } from "../server/v2/db";

type Batch = { selected: number; ready: number; failed: number };

/** One explicitly owned drain, joined by teardown; no timer or detached promise. */
export function createAwaitedPreparationDrain(drainBatch: () => Promise<Batch>) {
  let inFlight: Promise<Batch> | undefined;
  return () => {
    if (!inFlight) {
      const work = (async () => {
        const total: Batch = { selected: 0, ready: 0, failed: 0 };
        let batch: Batch;
        do {
          batch = await drainBatch();
          total.selected += batch.selected;
          total.ready += batch.ready;
          total.failed += batch.failed;
          // Process subsequent batches, not retries: the product queue excludes
          // already-ready and failed requests from its next selection.
        } while (batch.selected > 0);
        return total;
      })();
      inFlight = work.then(
        result => { inFlight = undefined; return result; },
        error => { inFlight = undefined; throw error; },
      );
    }
    return inFlight;
  };
}

export function installTestDocumentPreparations(app: Express) {
  if (process.env.TEST_BACKEND !== "true" || process.env.TEST_DATABASE_VERIFIED !== "true" ||
      process.env.PORT === "5000" || !process.env.TEST_BACKEND_INSTANCE) {
    throw new Error("Awaited document preparation belongs only to the isolated test backend.");
  }
  const queue = createDocumentPreparationQueue();
  const finish = createAwaitedPreparationDrain(() => queue.drain(getDb()));
  app.post("/api/test-document-preparations/drain", async (req, res) => {
    if (req.header("X-Test-Backend-Instance") !== process.env.TEST_BACKEND_INSTANCE) {
      res.status(403).json({ error: "Wrong test backend instance." });
      return;
    }
    try {
      const result = await finish();
      res.json({ ...result, ...JSON.parse(process.env.TEST_DATABASE_IDENTITY!),
        instance: process.env.TEST_BACKEND_INSTANCE, documentPreparationMode: "awaited" });
    } catch {
      res.status(500).json({ error: "Test document preparation did not finish." });
    }
  });
}
