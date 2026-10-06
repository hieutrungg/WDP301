import { z } from "zod";

export const loginSchema = z.object({
  identity: z
    .string({ error: "Email or username is required" })
    .trim()
    .min(1, "Email or username is required")
    .max(254, "Email or username is too long"),
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required")
    .max(128, "Password is too long"),
  rememberMe: z.boolean().optional().default(false),
});
