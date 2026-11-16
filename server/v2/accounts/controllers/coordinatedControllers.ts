import type { Request, Response, NextFunction } from "express";
import { coordinateAccounts } from "../accountCoordination";

export function coordinatedControllers<T extends Record<string, Record<string, unknown>>>(controllers: T): T {
  const result: Record<string, Record<string, unknown>> = {};
  for (const [controllerName, controller] of Object.entries(controllers)) {
    const wrapped: Record<string, unknown> = {};
    for (const [methodName, value] of Object.entries(controller)) {
      if (typeof value !== "function") {
        wrapped[methodName] = value;
        continue;
      }
      wrapped[methodName] = async (req: Request, res: Response, next: NextFunction) => {
        const mode = controllerName === "wageScalesController" && methodName === "activate"
          ? "exclusive" : "shared";
        try {
          await coordinateAccounts(mode, () => Promise.resolve(value.call(controller, req, res, next)));
        } catch (error: any) {
          if (res.headersSent) { next(error); return; }
          if (error?.code === "CONFLICT") {
            res.status(409).json({ error: error.message });
            return;
          }
          next(error);
        }
      };
    }
    result[controllerName] = wrapped;
  }
  return result as T;
}
