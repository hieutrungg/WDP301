import { Ticket } from "./ticket.model.js";
import { TICKET_STATUS } from "./ticket.constants.js";

const DUPLICATE_KEY = 11000;

const isDuplicateKeyOnly = (error) => {
  if (error?.code === DUPLICATE_KEY) return true;
  const writeErrors = error?.writeErrors;
  return (
    Array.isArray(writeErrors) &&
    writeErrors.length > 0 &&
    writeErrors.every((item) => (item?.code ?? item?.err?.code) === DUPLICATE_KEY)
  );
};

const hasBookingSeatUniqueIndex = (indexes) =>
  indexes.some(
    (index) =>
      index.unique === true &&
      !index.partialFilterExpression &&
      JSON.stringify(index.key) === JSON.stringify({ bookingId: 1, seatId: 1 }),
  );

export const createTicketRepository = ({ ticketModel = Ticket } = {}) => {
  let idempotencyIndexReady = false;

  // autoIndex is off, so issuance fails closed until migration 20261027-ticket-001-indexes.js
  // has created the (bookingId, seatId) unique index; without it a concurrent replay could
  // insert a second ticket for the same seat.
  const assertIdempotencyIndex = async () => {
    if (idempotencyIndexReady) return;
    let indexes = [];
    try {
      indexes = await ticketModel.collection.listIndexes().toArray();
    } catch (error) {
      if (error.code !== 26) throw error;
    }
    if (!hasBookingSeatUniqueIndex(indexes)) {
      throw new Error(
        "Ticket indexes are missing; run src/migrations/20261027-ticket-001-indexes.js",
      );
    }
    idempotencyIndexReady = true;
  };

  return {
    findById(ticketId, session) {
      return ticketModel.findById(ticketId).session(session ?? null).lean().exec();
    },

    findByBookingId(bookingId, session) {
      return ticketModel
        .find({ bookingId })
        .sort({ "seat.label": 1, _id: 1 })
        .session(session ?? null)
        .lean()
        .exec();
    },

    // Unordered insert: a duplicate (booking, seat) from a concurrent or replayed issuance is the
    // expected idempotent outcome, so only non-duplicate failures are surfaced. The caller re-reads.
    async insertMissing(documents, session) {
      if (documents.length === 0) return;
      await assertIdempotencyIndex();
      try {
        await ticketModel.insertMany(documents, {
          ordered: false,
          ...(session ? { session } : {}),
        });
      } catch (error) {
        if (!isDuplicateKeyOnly(error)) throw error;
      }
    },

    // Only ISSUED tickets change; USED and INVALIDATED are left untouched so the call is idempotent.
    async invalidateIssuedByBooking(bookingId, { at, reason }, session) {
      const result = await ticketModel
        .updateMany(
          { bookingId, status: TICKET_STATUS.ISSUED },
          {
            $set: {
              status: TICKET_STATUS.INVALIDATED,
              invalidatedAt: at,
              invalidationReason: reason,
            },
          },
          session ? { session } : {},
        )
        .exec();
      return result.modifiedCount ?? 0;
    },
  };
};

export const ticketRepository = createTicketRepository();
