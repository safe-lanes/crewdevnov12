import { z } from "zod";

// Same validation for standalone and combined saves; identity is never accepted.
export const companyFormGrantsSchema = z.object({
  view: z.boolean(), fill_in: z.boolean(), witness: z.boolean(),
  sign_representative: z.boolean(), void: z.boolean(), void_completed: z.boolean(),
  override_checklist: z.boolean().default(false),
}).strict();
