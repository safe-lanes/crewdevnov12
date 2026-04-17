import type { Request, Response } from "express";
import { z } from "zod";
import { adminUsersService, type CreateUserInput, type UpdateUserInput } from "./service";
import { userPasswordSchema } from "@shared/schema";
import type { AdminUserRow } from "./repository";

// Accept the wire-format value ("Vessel") that the UI sends; the controller
// translates it to the DB-format ("Ship") via wireToDbType before invoking
// the service.
const userTypeSchema = z.enum(["Office", "Vessel"]);

const createSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: userPasswordSchema,
  email: z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
  firstName: z.string().trim().min(1).max(128),
  lastName: z.string().trim().max(128).optional().nullable(),
  designation: z.string().trim().max(256).optional().nullable(),
  department: z.string().trim().max(256).optional().nullable(),
  preferredAuthMethod: z.enum(["TOTP", "NA"]).optional(),
  userType: userTypeSchema,
  roleId: z.string().trim().max(128).optional().nullable(),
  isActive: z.boolean().optional(),
  assignedVesselIds: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  username: z.string().trim().min(1).max(128).optional(),
  password: userPasswordSchema.optional(),
  email: z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
  firstName: z.string().trim().min(1).max(128).optional(),
  lastName: z.string().trim().max(128).optional().nullable(),
  designation: z.string().trim().max(256).optional().nullable(),
  department: z.string().trim().max(256).optional().nullable(),
  preferredAuthMethod: z.enum(["TOTP", "NA"]).optional(),
  userType: userTypeSchema.optional(),
  roleId: z.string().trim().max(128).optional().nullable(),
  isActive: z.boolean().optional(),
  assignedVesselIds: z.array(z.string()).optional(),
});

type ReqUser = {
  id?: unknown;
  username?: unknown;
  domain?: unknown;
};

function callerDomain(req: Request): string | null {
  const u = (req.user ?? {}) as ReqUser;
  if (typeof u.domain === "string" && u.domain.trim()) return u.domain.trim();
  return null;
}

function callerActor(req: Request): { id?: number; username?: string } {
  const u = (req.user ?? {}) as ReqUser;
  return {
    id: typeof u.id === "number" ? u.id : undefined,
    username: typeof u.username === "string" ? u.username : undefined,
  };
}

// Maps wire-format type ('Office' | 'Vessel') ↔ DB-format ('Office' | 'Ship')
function wireToDbType(t?: string | null): "Office" | "Ship" | undefined {
  if (!t) return undefined;
  if (t === "Vessel") return "Ship";
  if (t === "Office" || t === "Ship") return t;
  return undefined;
}
function dbToWireType(t?: string | null): "Office" | "Vessel" | undefined {
  if (t === "Ship") return "Vessel";
  if (t === "Office") return "Office";
  return undefined;
}

type AdminUserShaped = Omit<AdminUserRow, "userType"> & {
  userType: "Office" | "Vessel" | string;
  assignedVesselIds?: string[];
};

function shape(
  u: (AdminUserRow & { assignedVesselIds?: string[] }) | null | undefined,
): AdminUserShaped | null | undefined {
  if (!u) return u;
  const { ...rest } = u as AdminUserRow & { assignedVesselIds?: string[] };
  return { ...rest, userType: dbToWireType(u.userType) ?? u.userType };
}

export const adminUsersController = {
  async list(req: Request, res: Response) {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const typeRaw = typeof req.query.type === "string" ? req.query.type : undefined;
      const type = wireToDbType(typeRaw);
      const domain = callerDomain(req);
      const rows = await adminUsersService.list({ search, type, domain });
      res.json(rows.map(shape));
    } catch (err) {
      console.error("[admin-users] list failed:", err);
      res.status(500).json({ error: "server_error", message: "Failed to fetch users" });
    }
  },

  async getOne(req: Request, res: Response) {
    try {
      const uuid = req.params.uuid;
      const domain = callerDomain(req);
      const row = await adminUsersService.getByUuid(uuid, domain);
      if (!row) return res.status(404).json({ error: "not_found", message: "User not found" });
      res.json(shape(row));
    } catch (err) {
      console.error("[admin-users] get failed:", err);
      res.status(500).json({ error: "server_error", message: "Failed to fetch user" });
    }
  },

  async usernameAvailable(req: Request, res: Response) {
    try {
      const username = typeof req.query.username === "string" ? req.query.username : "";
      const excludeUuid = typeof req.query.excludeUuid === "string" ? req.query.excludeUuid : undefined;
      const domain = callerDomain(req);
      if (!domain) return res.status(400).json({ error: "no_domain", message: "Caller has no domain" });
      if (!username.trim()) return res.json({ available: false });
      const available = await adminUsersService.usernameAvailable(username, domain, excludeUuid);
      res.json({ available });
    } catch (err) {
      console.error("[admin-users] username-available failed:", err);
      res.status(500).json({ error: "server_error", message: "Failed to check username" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "validation_failed",
          message: parsed.error.issues[0]?.message || "Invalid request body",
          details: parsed.error.issues,
        });
      }
      const domain = callerDomain(req);
      if (!domain) return res.status(400).json({ error: "no_domain", message: "Caller has no domain" });
      const dbType = wireToDbType(parsed.data.userType);
      if (dbType !== "Office" && dbType !== "Ship") {
        return res.status(400).json({ error: "validation_failed", message: "Invalid userType" });
      }
      const createInput: CreateUserInput = {
        ...parsed.data,
        userType: dbType,
        domain,
      };
      const created = await adminUsersService.create(createInput, callerActor(req));
      res.status(201).json(shape(created));
    } catch (err: unknown) {
      if (err && typeof err === "object" && (err as { code?: string }).code === "username_taken") {
        return res.status(409).json({ error: "username_taken", message: "This username is already taken." });
      }
      console.error("[admin-users] create failed:", err);
      res.status(500).json({ error: "server_error", message: "Failed to create user" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "validation_failed",
          message: parsed.error.issues[0]?.message || "Invalid request body",
          details: parsed.error.issues,
        });
      }
      const userType = parsed.data.userType ? wireToDbType(parsed.data.userType) : undefined;
      const domain = callerDomain(req);
      const { userType: _wireType, ...rest } = parsed.data;
      const updateInput: UpdateUserInput = {
        ...rest,
        ...(userType ? { userType } : {}),
      };
      const updated = await adminUsersService.update(
        req.params.uuid,
        updateInput,
        callerActor(req),
        domain,
      );
      res.json(shape(updated));
    } catch (err: unknown) {
      const code = err && typeof err === "object" ? (err as { code?: string }).code : undefined;
      if (code === "not_found") {
        return res.status(404).json({ error: "not_found", message: "User not found" });
      }
      if (code === "username_taken") {
        return res.status(409).json({ error: "username_taken", message: "This username is already taken." });
      }
      console.error("[admin-users] update failed:", err);
      res.status(500).json({ error: "server_error", message: "Failed to update user" });
    }
  },
};
