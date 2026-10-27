import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

const testOutbox = [];
let transporter;

const escapeHtml = (value) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[
        character
      ],
  );

const getTransporter = () => {
  if (transporter) return transporter;

  if (!env.emailHost || !env.emailFrom) {
    throw new AppError(
      503,
      "Email verification service is not configured. Please contact support.",
    );
  }

  if (Boolean(env.emailUser) !== Boolean(env.emailPass)) {
    throw new AppError(
      503,
      "Email verification service credentials are incomplete. Please contact support.",
    );
  }

  transporter = nodemailer.createTransport({
    host: env.emailHost,
    port: env.emailPort,
    secure: env.emailPort === 465,
    ...(env.emailUser && env.emailPass
      ? { auth: { user: env.emailUser, pass: env.emailPass } }
      : {}),
  });

  return transporter;
};

export const sendRegistrationOtpEmail = async ({ email, fullName, otp, expiresInMinutes }) => {
  if (env.isTest && process.env.EMAIL_TEST_MODE === "capture") {
    testOutbox.push({ email, fullName, otp, expiresInMinutes });
    return;
  }

  const safeFullName = escapeHtml(fullName);

  await getTransporter().sendMail({
    from: env.emailFrom,
    to: email,
    subject: "Verify your F-Cinema account",
    text: [
      `Hello ${fullName},`,
      "",
      `Your F-Cinema verification code is: ${otp}`,
      `This code expires in ${expiresInMinutes} minutes.`,
      "",
      "If you did not request this account, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f1f24">
        <h2 style="color:#e50914">F-Cinema</h2>
        <p>Hello ${safeFullName},</p>
        <p>Your verification code is:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px">${otp}</p>
        <p>This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
        <p>If you did not request this account, you can safely ignore this email.</p>
      </div>
    `,
  });
};

export const sendPasswordResetOtpEmail = async ({ email, fullName, otp, expiresInMinutes }) => {
  if (env.isTest && process.env.EMAIL_TEST_MODE === "capture") {
    testOutbox.push({ purpose: "RESET_PASSWORD", email, fullName, otp, expiresInMinutes });
    return;
  }

  const safeFullName = escapeHtml(fullName);

  await getTransporter().sendMail({
    from: env.emailFrom,
    to: email,
    subject: "Reset your F-Cinema password",
    text: [
      `Hello ${fullName},`,
      "",
      `Your F-Cinema password reset code is: ${otp}`,
      `This code expires in ${expiresInMinutes} minutes.`,
      "",
      "If you did not ask to reset your password, you can safely ignore this email. Your password will not change.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f1f24">
        <h2 style="color:#e50914">F-Cinema</h2>
        <p>Hello ${safeFullName},</p>
        <p>Your password reset code is:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px">${otp}</p>
        <p>This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
        <p>If you did not ask to reset your password, you can safely ignore this email. Your password will not change.</p>
      </div>
    `,
  });
};

// STAFF-101 / UC35: the Admin never sets the password. The new staff member chooses one through
// the Forgot Password flow (G04), which proves they own the mailbox.
export const sendStaffWelcomeEmail = async ({ email, fullName, username, setPasswordUrl }) => {
  if (env.isTest && process.env.EMAIL_TEST_MODE === "capture") {
    testOutbox.push({ purpose: "STAFF_WELCOME", email, fullName, username, setPasswordUrl });
    return;
  }

  const safeFullName = escapeHtml(fullName);
  const safeUsername = escapeHtml(username);
  const safeUrl = escapeHtml(setPasswordUrl);

  await getTransporter().sendMail({
    from: env.emailFrom,
    to: email,
    subject: "Your F-Cinema staff account is ready",
    text: [
      `Hello ${fullName},`,
      "",
      "An administrator has created an F-Cinema staff account for you.",
      `Username: ${username}`,
      `Email: ${email}`,
      "",
      `To set your password, open ${setPasswordUrl}, enter this email address and follow the verification code we send you.`,
      "",
      "If you were not expecting this account, please contact your administrator.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f1f24">
        <h2 style="color:#e50914">F-Cinema</h2>
        <p>Hello ${safeFullName},</p>
        <p>An administrator has created an F-Cinema staff account for you.</p>
        <p>Username: <strong>${safeUsername}</strong></p>
        <p>To set your password, open <a href="${safeUrl}">${safeUrl}</a>, enter this email address and follow the verification code we send you.</p>
        <p>If you were not expecting this account, please contact your administrator.</p>
      </div>
    `,
  });
};

export const takeTestEmails = () => testOutbox.splice(0, testOutbox.length);
