import { z } from "zod";

const normalizedEmail = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "Email is too long");

export const strongPassword = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/\d/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

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

export const googleLoginSchema = z.object({
  credential: z
    .string({ error: "Google credential is required" })
    .min(1, "Google credential is required")
    .max(4096, "Google credential is too long"),
  rememberMe: z.boolean().optional().default(false),
});

export const fullNameField = z
  .string({ error: "Full name is required" })
  .trim()
  .min(2, "Full name must be at least 2 characters")
  .max(100, "Full name is too long");

export const phoneField = z
  .string({ error: "Phone number is required" })
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ""))
  .refine(
    (value) => /^(?:\+84|0)\d{9,10}$/.test(value),
    "Enter a valid phone number",
  );

export const usernameField = z
  .string({ error: "Username is required" })
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username is too long")
  .regex(
    /^[A-Za-z0-9_]+$/,
    "Username may only contain letters, numbers, and underscores",
  );

export const registerSchema = z
  .object({
    fullName: fullNameField,
    email: normalizedEmail,
    phone: phoneField,
    username: usernameField,
    password: strongPassword,
    confirmPassword: z.string({ error: "Please confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const verifyEmailSchema = z.object({
  email: normalizedEmail,
  otp: z
    .string({ error: "Verification code is required" })
    .trim()
    .regex(/^\d{6}$/, "Verification code must be 6 digits"),
});

export const resendVerificationSchema = z.object({
  email: normalizedEmail,
});
