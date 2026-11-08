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

// STAFF-101 / UC35: the system generates a password and only the staff member receives it, by
// email. The Admin never sees it; the staff member may change it later in Profile.
export const sendStaffWelcomeEmail = async ({ email, fullName, username, temporaryPassword }) => {
  if (env.isTest && process.env.EMAIL_TEST_MODE === "capture") {
    testOutbox.push({ purpose: "STAFF_WELCOME", email, fullName, username, temporaryPassword });
    return;
  }

  const safeFullName = escapeHtml(fullName);
  const safeUsername = escapeHtml(username);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(temporaryPassword);

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
      `Password: ${temporaryPassword}`,
      "",
      "Sign in on the F-Cinema staff sign-in page with your username or email and this password.",
      "You can change the password at any time in Profile > Change password.",
      "Do not share this email. If you were not expecting this account, please contact your administrator.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f1f24">
        <h2 style="color:#e50914">F-Cinema</h2>
        <p>Hello ${safeFullName},</p>
        <p>An administrator has created an F-Cinema staff account for you.</p>
        <table role="presentation" cellpadding="6" cellspacing="0" style="border:1px solid #e3e3e8;border-radius:8px">
          <tr><td style="color:#6b6b76">Username</td><td><strong>${safeUsername}</strong></td></tr>
          <tr><td style="color:#6b6b76">Email</td><td><strong>${safeEmail}</strong></td></tr>
          <tr><td style="color:#6b6b76">Password</td>
            <td><strong style="font-family:Consolas,monospace;font-size:18px;letter-spacing:2px">${safePassword}</strong></td></tr>
        </table>
        <p>Sign in on the F-Cinema staff sign-in page with your username or email and this password.
           You can change the password at any time in <strong>Profile &gt; Change password</strong>.</p>
        <p style="color:#6b6b76;font-size:13px">Do not share this email. If you were not expecting this account, please contact your administrator.</p>
      </div>
    `,
  });
};

const ticketInfoCell = (label, value, { sub = "", colspan = 1 } = {}) => `
    <td colspan="${colspan}" style="padding:10px 12px;border:1px solid #2c2c33;border-radius:10px;background:#141417;vertical-align:top">
      <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#f5a3a0">${label}</div>
      <div style="margin-top:4px;font-size:16px;font-weight:700;color:#ffffff">${escapeHtml(value ?? "")}</div>
      ${sub ? `<div style="font-size:12px;color:#c9c5ca">${escapeHtml(sub)}</div>` : ""}
    </td>`;

// Mirrors the E-Ticket screen (/tickets/:ticketId): title, QR, ticket code, cinema/room, date,
// showtime and seat. Email clients ignore most CSS, so it is table-based with inline styles.
const ticketCardHtml = (ticket, cid) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto 24px;background:#1f1f22;border-radius:18px;border:1px solid #2c2c33">
      <tr><td style="padding:22px 24px 6px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#ffffff">${escapeHtml(ticket.movieTitle ?? "")}</div>
        ${ticket.ageRating ? `<span style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:6px;background:#4a2b2b;color:#ffb4ab;font-size:12px;font-weight:700">${escapeHtml(ticket.ageRating)}</span>` : ""}
      </td></tr>
      <tr><td style="padding:16px 24px;text-align:center;border-top:1px dashed #3a3a42">
        <img src="cid:${cid}" width="220" height="220" alt="QR code of ticket ${escapeHtml(ticket.ticketCode)}"
             style="display:block;margin:0 auto;background:#ffffff;border-radius:16px;padding:10px;border:3px solid #4a3a3a" />
        <div style="margin-top:12px;font-size:11px;letter-spacing:1.5px;color:#f5a3a0">TICKET CODE</div>
        <div style="font-size:24px;font-weight:800;letter-spacing:4px;color:#ffc94d">${escapeHtml(ticket.ticketCode)}</div>
      </td></tr>
      <tr><td style="padding:16px 24px 8px;border-top:1px dashed #3a3a42">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="6">
          <tr>${ticketInfoCell("Cinema &amp; Room", ticket.cinemaName, { sub: [ticket.roomName, ticket.roomType].filter(Boolean).join(" • "), colspan: 2 })}</tr>
          <tr>${ticketInfoCell("Date", ticket.date)}${ticketInfoCell("Showtime", ticket.time, { sub: "Vietnam time (GMT+7)" })}</tr>
          <tr>${ticketInfoCell("Seat", ticket.seatLabel, { sub: ticket.seatType, colspan: 2 })}</tr>
        </table>
      </td></tr>
      <tr><td style="padding:8px 24px 22px;text-align:center">
        <a href="${escapeHtml(ticket.ticketUrl)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#e50914;color:#ffffff;font-weight:700;font-size:13px;text-decoration:none">Open E-Ticket</a>
      </td></tr>
    </table>`;

// Sent once per online booking right after its tickets are issued. Each QR code is an inline
// (cid) PNG attachment, because most mail clients block data: image URLs.
export const sendTicketConfirmationEmail = async ({
  email,
  fullName,
  bookingCode,
  bookingUrl,
  tickets,
}) => {
  if (env.isTest && process.env.EMAIL_TEST_MODE === "capture") {
    testOutbox.push({
      purpose: "TICKET_CONFIRMATION",
      email,
      fullName,
      bookingCode,
      ticketCodes: tickets.map((ticket) => ticket.ticketCode),
    });
    return;
  }

  const first = tickets[0];
  const attachments = tickets.map((ticket, index) => ({
    filename: `${ticket.ticketCode}.png`,
    content: ticket.qrPng,
    contentType: "image/png",
    cid: `ticket-qr-${index}@f-cinema`,
  }));

  await getTransporter().sendMail({
    from: env.emailFrom,
    to: email,
    subject: `Your F-Cinema E-Tickets: ${first.movieTitle} - ${first.date} ${first.time}`,
    text: [
      `Hello ${fullName},`,
      "",
      `Your booking ${bookingCode} is confirmed.`,
      `${first.movieTitle} - ${first.cinemaName}, ${first.roomName}`,
      `${first.date} ${first.time} (Vietnam time)`,
      "",
      ...tickets.map((ticket) => `Seat ${ticket.seatLabel}: ticket ${ticket.ticketCode} - ${ticket.ticketUrl}`),
      "",
      "Show the QR code of each ticket at the entrance. Check-in opens 30 minutes before the showtime.",
      `View your booking: ${bookingUrl}`,
    ].join("\n"),
    html: `
      <div style="margin:0;padding:24px 12px;background:#0d0d10;font-family:Arial,Helvetica,sans-serif;color:#ffffff">
        <div style="max-width:520px;margin:0 auto 20px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:#e50914">F-CINEMA</div>
          <p style="color:#e4e1e6;font-size:14px;line-height:1.6">
            Hello ${escapeHtml(fullName)}, your booking <strong>${escapeHtml(bookingCode)}</strong> is confirmed.
            Show the QR code of each ticket at the entrance. Check-in opens 30 minutes before the showtime.
          </p>
        </div>
        ${tickets.map((ticket, index) => ticketCardHtml(ticket, attachments[index].cid)).join("")}
        <p style="max-width:520px;margin:0 auto;text-align:center;font-size:12px;color:#a19ea4">
          <a href="${escapeHtml(bookingUrl)}" style="color:#ffb4ab">View your booking</a> ·
          Do not share these QR codes. Each ticket can be checked in only once.
        </p>
      </div>
    `,
    attachments,
  });
};

export const takeTestEmails = () => testOutbox.splice(0, testOutbox.length);
