import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import type { Server } from "http";

const TEST_SECRET = "obsolete-crew-assignment-paths-test";
const crewUuid = randomUUID();
const vesselUuid = randomUUID();
const planUuid = randomUUID();
const assignmentUuids: string[] = [];
let db: Client;
let server: Server;

const authorization = () =>
  `Bearer ${jwt.sign({ id: 990313, domain: "test", userType: "Admin" }, TEST_SECRET)}`;

beforeAll(async () => {
  db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(
    `INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name)
     VALUES ($1, $2, 'Canonical', 'Assignment')`,
    [crewUuid, `EMP-${crewUuid}`],
  );
  process.env.JWT_SECRET = TEST_SECRET;
  delete process.env.AUTH_BYPASS;
  const { authMiddleware } = await import("@server/middleware/authMiddleware");
  const { default: crewRouter } = await import("@server/v2/crew-pool/routes");
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use("/api/v2/crew-pool", crewRouter);
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  await new Promise<void>(resolve => server?.close(() => resolve()));
  await db.query("DELETE FROM vessel_planning_v2 WHERE plan_uuid = $1", [planUuid]);
  if (assignmentUuids.length) {
    await db.query(
      "DELETE FROM crew_assignments WHERE assign_uuid = ANY($1::text[])",
      [assignmentUuids],
    );
  }
  await db.query("DELETE FROM crew_members_v2 WHERE crew_uuid = $1", [crewUuid]);
  await db.end();
});

describe("canonical Crew Pool assignment paths", () => {
  it("retires the lowercase-primary assign endpoint", async () => {
    const response = await request(server)
      .post(`/api/v2/crew-pool/crew/${crewUuid}/assign`)
      .set("Authorization", authorization())
      .send({ vesselUuid, assignmentType: "primary" });
    expect(response.status).toBe(404);
    const rows = await db.query("SELECT assign_uuid FROM crew_assignments WHERE crew_uuid = $1", [crewUuid]);
    expect(rows.rows).toHaveLength(0);
  });

  it("rejects obsolete types through generic creation and updates", async () => {
    for (const assignmentType of ["primary", "secondary", null]) {
      const response = await request(server)
        .post(`/api/v2/crew-pool/crew/${crewUuid}/assignments`)
        .set("Authorization", authorization())
        .send({ vesselUuid, assignmentType });
      expect(response.status).toBe(400);
    }
    const created = await request(server)
      .post(`/api/v2/crew-pool/crew/${crewUuid}/assignments`)
      .set("Authorization", authorization())
      .send({ vesselUuid, assignmentType: "Planned", isCurrent: false });
    expect(created.status).toBe(201);
    assignmentUuids.push(created.body.assignUuid);
    const update = await request(server)
      .patch(`/api/v2/crew-pool/crew/${crewUuid}/assignments/${created.body.assignUuid}`)
      .set("Authorization", authorization())
      .send({ assignmentType: "primary" });
    expect(update.status).toBe(400);
    const current = await db.query(
      "SELECT assignment_type FROM crew_assignments WHERE assign_uuid = $1",
      [created.body.assignUuid],
    );
    expect(current.rows[0].assignment_type).toBe("Planned");
  });

  it("still lists and signs off an OnBoard assignment without changing its type", async () => {
    const created = await request(server)
      .post(`/api/v2/crew-pool/crew/${crewUuid}/assignments`)
      .set("Authorization", authorization())
      .send({ vesselUuid, assignmentType: "OnBoard", isCurrent: true, signOnDate: "2026-09-01" });
    expect(created.status).toBe(201);
    assignmentUuids.push(created.body.assignUuid);
    await db.query(
      `INSERT INTO vessel_planning_v2 (plan_uuid, vessel_uuid, rank_id, rank, crew_uuid, crew_assign_uuid)
       VALUES ($1, $2, 'Test Officer', 'Test Officer', $3, $4)`,
      [planUuid, vesselUuid, crewUuid, created.body.assignUuid],
    );
    const onboard = await request(server)
      .get(`/api/v2/crew-pool/vessels/${vesselUuid}/crew`)
      .set("Authorization", authorization());
    expect(onboard.status).toBe(200);
    expect(onboard.body.map((row: { assignUuid: string }) => row.assignUuid))
      .toContain(created.body.assignUuid);
    const signedOff = await request(server)
      .post(`/api/v2/crew-pool/crew/${crewUuid}/sign-off`)
      .set("Authorization", authorization())
      .send({ planUuid, signOffDate: "2026-09-30" });
    expect(signedOff.status).toBe(200);
    expect(signedOff.body).toMatchObject({
      assignUuid: created.body.assignUuid,
      assignmentType: "OnBoard",
      isCurrent: false,
      signOffDate: "2026-09-30",
    });
    const history = await request(server)
      .get(`/api/v2/crew-pool/crew/${crewUuid}/assignments/history`)
      .set("Authorization", authorization());
    expect(history.status).toBe(200);
    expect(history.body.map((row: { assignUuid: string }) => row.assignUuid))
      .toContain(created.body.assignUuid);
  });
});