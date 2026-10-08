import { z } from "zod";
import { fullNameField, phoneField, strongPassword } from "../auth/auth.validation.js";

export const updateProfileSchema = z
  .object({
    fullName: fullNameField.optional(),
    phone: phoneField.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });

export const changePasswordSchema = z
  .object({
    // Proof of ownership: either the current password or a fresh Google ID token.
    currentPassword: z.string().max(128, "Password is too long").optional(),
    credential: z.string().max(4096, "Google credential is too long").optional(),
    newPassword: strongPassword,
    confirmPassword: z.string({ error: "Please confirm your password" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
