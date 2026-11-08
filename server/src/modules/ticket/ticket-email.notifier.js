import QRCode from "qrcode";
import { env } from "../../config/env.js";
import { findAccountById } from "../account/account.repository.js";
import { sendTicketConfirmationEmail } from "../auth/email.service.js";

const vnDateParts = (value) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map(({ type, value: part }) => [type, part]),
  );

// Same QR settings as the E-Ticket screen, so staff can scan the emailed code the same way.
const qrPng = (payload) =>
  QRCode.toBuffer(payload, { type: "png", errorCorrectionLevel: "M", margin: 1, width: 440 });

/**
 * Emails the issued E-Tickets (with QR codes) to the customer who owns the booking.
 * Counter bookings are owned by the staff account that sold them, so they are not emailed.
 */
export const createTicketEmailNotifier = ({
  findAccount = findAccountById,
  sendEmail = sendTicketConfirmationEmail,
  clientUrl = () => env.clientUrl,
} = {}) =>
  async ({ booking, tickets }) => {
    if (booking.channel === "COUNTER") return { sent: false, reason: "COUNTER_BOOKING" };

    const admissible = tickets.filter((ticket) => ticket.qrCode);
    if (admissible.length === 0) return { sent: false, reason: "NO_ADMISSIBLE_TICKET" };

    const account = await findAccount(booking.customerAccountId);
    if (!account?.email) return { sent: false, reason: "NO_EMAIL" };

    const baseUrl = (clientUrl() ?? "").replace(/\/+$/, "");
    const emailTickets = await Promise.all(
      admissible.map(async (ticket) => {
        const parts = vnDateParts(ticket.screening.startAt);
        return {
          ticketCode: ticket.ticketCode,
          movieTitle: ticket.screening.movieTitle,
          ageRating: ticket.screening.ageRating,
          cinemaName: ticket.screening.cinemaName,
          roomName: ticket.screening.roomName,
          roomType: ticket.screening.roomType,
          date: `${parts.day}/${parts.month}/${parts.year}`,
          time: `${parts.hour}:${parts.minute}`,
          seatLabel: ticket.seat.label,
          seatType: ticket.seat.type,
          ticketUrl: `${baseUrl}/tickets/${ticket.ticketId}`,
          qrPng: await qrPng(ticket.qrCode),
        };
      }),
    );

    await sendEmail({
      email: account.email,
      fullName: account.fullName || account.username || account.email,
      bookingCode: booking.bookingCode,
      bookingUrl: `${baseUrl}/bookings/${booking.bookingId}/confirmation`,
      tickets: emailTickets,
    });
    return { sent: true, ticketCount: emailTickets.length };
  };
