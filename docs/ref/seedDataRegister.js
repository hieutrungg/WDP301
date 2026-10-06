// ============================================================
// seedDataRegister.js
// Cinema Management System - Auth / Register seed data
//
// Dùng cho:
// - MongoDB Compass Shell
// - mongosh --file seedDataRegister.js
//
// Database:
// cinema_management
//
// Script này:
// 1. Tạo email_verifications nếu chưa có
// 2. Tạo OTP indexes
// 3. Seed permissions
// 4. Seed roles: CUSTOMER, STAFF, MANAGER, ADMIN
//
// Script có thể chạy lại nhiều lần.
// ============================================================

var appdb = db.getSiblingDB("cinema_management");

print("");
print("==================================================");
print("F-CINEMA - AUTH / REGISTER SEED");
print("Database: cinema_management");
print("==================================================");
print("");

// ============================================================
// 1. EMAIL VERIFICATIONS COLLECTION
// ============================================================

if (!appdb.getCollectionNames().includes("email_verifications")) {
  appdb.createCollection("email_verifications", {
    validator: {
      $jsonSchema: {
        bsonType: "object",

        required: [
          "accountId",
          "email",
          "purpose",
          "otpHash",
          "expiresAt",
          "attemptCount",
          "createdAt"
        ],

        properties: {
          accountId: {
            bsonType: "objectId"
          },

          email: {
            bsonType: "string"
          },

          purpose: {
            bsonType: "string",
            enum: [
              "REGISTER_EMAIL",
              "RESET_PASSWORD",
              "CHANGE_EMAIL"
            ]
          },

          otpHash: {
            bsonType: "string"
          },

          expiresAt: {
            bsonType: "date"
          },

          attemptCount: {
            bsonType: "int",
            minimum: 0
          },

          createdAt: {
            bsonType: "date"
          },

          verifiedAt: {
            bsonType: [
              "date",
              "null"
            ]
          }
        }
      }
    }
  });

  print("[OK] Created collection: email_verifications");
} else {
  print("[SKIP] email_verifications already exists");
}

// ============================================================
// 2. EMAIL VERIFICATION INDEXES
// ============================================================

// Dùng để tìm OTP của một account theo mục đích
appdb.email_verifications.createIndex(
  {
    accountId: 1,
    purpose: 1
  },
  {
    name: "idx_email_verification_account_purpose"
  }
);

// TTL index.
// MongoDB sẽ tự dọn các OTP đã hết hạn.
appdb.email_verifications.createIndex(
  {
    expiresAt: 1
  },
  {
    expireAfterSeconds: 0,
    name: "ttl_email_verification_expires_at"
  }
);

print("[OK] Ensured email_verifications indexes");

// ============================================================
// 3. PERMISSIONS
// ============================================================

var permissionSeeds = [

  // ----------------------------------------------------------
  // PROFILE
  // ----------------------------------------------------------

  {
    name: "profile.view",
    description: "View own profile"
  },

  {
    name: "profile.update",
    description: "Update own profile"
  },


  // ----------------------------------------------------------
  // MOVIE
  // ----------------------------------------------------------

  {
    name: "movie.view",
    description: "View movies"
  },

  {
    name: "movie.create",
    description: "Create movies"
  },

  {
    name: "movie.update",
    description: "Update movies"
  },

  {
    name: "movie.archive",
    description: "Archive movies"
  },


  // ----------------------------------------------------------
  // SHOWTIME
  // ----------------------------------------------------------

  {
    name: "showtime.view",
    description: "View showtimes"
  },

  {
    name: "showtime.create",
    description: "Create showtimes"
  },

  {
    name: "showtime.update",
    description: "Update showtimes"
  },

  {
    name: "showtime.cancel",
    description: "Cancel showtimes"
  },


  // ----------------------------------------------------------
  // BOOKING / TICKETING
  // ----------------------------------------------------------

  {
    name: "booking.create",
    description: "Create ticket bookings"
  },

  {
    name: "booking.view_own",
    description: "View own bookings"
  },

  {
    name: "booking.view_all",
    description: "View all bookings"
  },

  {
    name: "ticket.sell_counter",
    description: "Sell tickets at cinema counter"
  },

  {
    name: "ticket.validate",
    description: "Validate ticket QR codes"
  },


  // ----------------------------------------------------------
  // CONCESSION
  // ----------------------------------------------------------

  {
    name: "concession.view",
    description: "View concessions"
  },

  {
    name: "concession.manage",
    description: "Manage concession products"
  },


  // ----------------------------------------------------------
  // PAYMENT
  // ----------------------------------------------------------

  {
    name: "payment.view",
    description: "View payment information"
  },


  // ----------------------------------------------------------
  // PROMOTION
  // ----------------------------------------------------------

  {
    name: "promotion.view",
    description: "View promotions"
  },

  {
    name: "promotion.manage",
    description: "Manage promotions"
  },


  // ----------------------------------------------------------
  // REFUND
  // ----------------------------------------------------------

  {
    name: "refund.request",
    description: "Request booking refund"
  },

  {
    name: "refund.manage",
    description: "Manage refund requests"
  },


  // ----------------------------------------------------------
  // BRANCH
  // ----------------------------------------------------------

  {
    name: "branch.view",
    description: "View cinema branches"
  },

  {
    name: "branch.manage",
    description: "Manage cinema branches"
  },


  // ----------------------------------------------------------
  // ROOM
  // ----------------------------------------------------------

  {
    name: "room.view",
    description: "View cinema rooms"
  },

  {
    name: "room.manage",
    description: "Manage rooms and seat maps"
  },


  // ----------------------------------------------------------
  // INVENTORY
  // ----------------------------------------------------------

  {
    name: "inventory.view",
    description: "View inventory"
  },

  {
    name: "inventory.manage",
    description: "Manage inventory"
  },


  // ----------------------------------------------------------
  // STAFF
  // ----------------------------------------------------------

  {
    name: "staff.view",
    description: "View staff information"
  },

  {
    name: "staff.manage",
    description: "Manage staff accounts"
  },


  // ----------------------------------------------------------
  // SHIFT
  // ----------------------------------------------------------

  {
    name: "shift.view",
    description: "View staff shifts"
  },

  {
    name: "shift.manage",
    description: "Manage staff shifts"
  },


  // ----------------------------------------------------------
  // REPORTING / ANALYTICS
  // ----------------------------------------------------------

  {
    name: "report.view",
    description: "View reports"
  },

  {
    name: "report.export",
    description: "Export reports"
  },

  {
    name: "analytics.view",
    description: "View analytics dashboard"
  },


  // ----------------------------------------------------------
  // ACCOUNT / RBAC
  // ----------------------------------------------------------

  {
    name: "account.manage",
    description: "Manage accounts"
  },

  {
    name: "role.view",
    description: "View roles"
  },

  {
    name: "role.manage",
    description: "Create and update roles"
  },

  {
    name: "permission.view",
    description: "View permissions"
  },

  {
    name: "permission.assign",
    description: "Assign permissions to roles"
  }

];

// ============================================================
// 4. UPSERT PERMISSIONS
// ============================================================

permissionSeeds.forEach(function (permission) {
  appdb.permissions.updateOne(
    {
      name: permission.name
    },
    {
      $set: {
        description: permission.description
      },

      $setOnInsert: {
        name: permission.name
      }
    },
    {
      upsert: true
    }
  );
});

print(
  "[OK] Seeded/updated " +
  permissionSeeds.length +
  " permissions"
);

// ============================================================
// 5. BUILD PERMISSION MAP
// ============================================================

var permissionMap = {};

appdb.permissions.find({}).forEach(function (permission) {
  permissionMap[permission.name] = permission._id;
});

function getPermissionIds(names) {
  var ids = [];

  names.forEach(function (name) {

    if (!permissionMap[name]) {
      throw new Error(
        "Permission not found: " + name
      );
    }

    ids.push(
      permissionMap[name]
    );
  });

  return ids;
}

// ============================================================
// 6. CUSTOMER PERMISSIONS
// ============================================================

var customerPermissionNames = [

  "profile.view",
  "profile.update",

  "movie.view",
  "showtime.view",

  "booking.create",
  "booking.view_own",

  "concession.view",

  "payment.view",

  "promotion.view",

  "refund.request",

  "branch.view"

];

// ============================================================
// 7. STAFF PERMISSIONS
// ============================================================

var staffPermissionNames = [

  "profile.view",
  "profile.update",

  "movie.view",
  "showtime.view",

  "booking.view_all",

  "ticket.sell_counter",
  "ticket.validate",

  "concession.view",

  "payment.view",

  "promotion.view",

  "branch.view",

  "room.view",

  "inventory.view"

];

// ============================================================
// 8. MANAGER PERMISSIONS
// ============================================================

var managerPermissionNames = [

  "profile.view",
  "profile.update",


  "movie.view",
  "movie.create",
  "movie.update",
  "movie.archive",


  "showtime.view",
  "showtime.create",
  "showtime.update",
  "showtime.cancel",


  "booking.view_all",


  "ticket.sell_counter",
  "ticket.validate",


  "concession.view",
  "concession.manage",


  "payment.view",


  "promotion.view",
  "promotion.manage",


  "refund.manage",


  "branch.view",
  "branch.manage",


  "room.view",
  "room.manage",


  "inventory.view",
  "inventory.manage",


  "staff.view",
  "staff.manage",


  "shift.view",
  "shift.manage",


  "report.view",
  "report.export",
  "analytics.view"

];

// ============================================================
// 9. ADMIN PERMISSIONS
// ============================================================

// ADMIN lấy toàn bộ permission có trong DB.

var adminPermissionIds = [];

appdb.permissions.find({}).forEach(function (permission) {
  adminPermissionIds.push(
    permission._id
  );
});

// ============================================================
// 10. ROLE SEEDS
// ============================================================

var roleSeeds = [

  {
    name: "CUSTOMER",
    description: "Cinema customer",
    permissionIds: getPermissionIds(
      customerPermissionNames
    )
  },

  {
    name: "STAFF",
    description: "Cinema staff member",
    permissionIds: getPermissionIds(
      staffPermissionNames
    )
  },

  {
    name: "MANAGER",
    description: "Cinema branch or operations manager",
    permissionIds: getPermissionIds(
      managerPermissionNames
    )
  },

  {
    name: "ADMIN",
    description: "System administrator",
    permissionIds: adminPermissionIds
  }

];

// ============================================================
// 11. UPSERT ROLES
// ============================================================

roleSeeds.forEach(function (role) {

  appdb.roles.updateOne(
    {
      name: role.name
    },
    {
      $set: {
        description: role.description,
        permissionIds: role.permissionIds
      },

      $setOnInsert: {
        name: role.name
      }
    },
    {
      upsert: true
    }
  );

});

print(
  "[OK] Seeded/updated roles: " +
  "CUSTOMER, STAFF, MANAGER, ADMIN"
);

// ============================================================
// 12. SUMMARY
// ============================================================

print("");
print("==================================================");
print("SEED COMPLETE");
print("==================================================");

print(
  "Permissions: " +
  appdb.permissions.countDocuments({})
);

print(
  "Roles: " +
  appdb.roles.countDocuments({})
);

print(
  "Email verification collection: READY"
);

print("");
print("Roles:");
print("  - CUSTOMER");
print("  - STAFF");
print("  - MANAGER");
print("  - ADMIN");

print("");
print("Next step:");
print("Create bcrypt test accounts using Node.js.");

print("==================================================");