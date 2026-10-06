const appdb = db.getSiblingDB("cinema_management");

appdb.accounts.createIndex({ username: 1 }, { unique: true });
appdb.accounts.createIndex({ email: 1 }, { unique: true });
appdb.email_verifications.createIndex(
  { accountId: 1, purpose: 1 },
  { name: "idx_email_verification_account_purpose" }
);
appdb.email_verifications.createIndex(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    name: "ttl_email_verification_expires_at"
  }
);
appdb.roles.createIndex({ name: 1 }, { unique: true });
appdb.permissions.createIndex({ name: 1 }, { unique: true });
appdb.bookings.createIndex({ bookingCode: 1 }, { unique: true });
appdb.tickets.createIndex({ ticketCode: 1 }, { unique: true });
appdb.vouchers.createIndex({ code: 1 }, { unique: true });
appdb.orders.createIndex({ orderCode: 1 }, { unique: true });
appdb.showtime_seats.createIndex({ showtimeId: 1, seatId: 1 }, { unique: true });
appdb.inventories.createIndex({ branchId: 1, concessionId: 1 }, { unique: true });
appdb.movie_reviews.createIndex({ movieId: 1, customerAccountId: 1 }, { unique: true });

print("[OK] SDS indexes created.");
