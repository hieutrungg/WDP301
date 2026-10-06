// Clean MongoDB database initializer - NO seed/sample documents
const dbName = "cinema_management";
const appdb = db.getSiblingDB(dbName);
print("Creating empty database: " + dbName);

if (!appdb.getCollectionNames().includes("accounts")) {
  appdb.createCollection("accounts", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "required": [
      "username",
      "email",
      "passwordHash"
    ],
    "properties": {
      "username": {
        "bsonType": "string"
      },
      "email": {
        "bsonType": "string"
      },
      "passwordHash": {
        "bsonType": "string"
      },
      "phone": {
        "bsonType": "string"
      },
      "roleIds": {
        "bsonType": "array",
        "items": {
          "bsonType": "objectId"
        }
      },
      "directPermissionIds": {
        "bsonType": "array",
        "items": {
          "bsonType": "objectId"
        }
      },
      "status": {
        "bsonType": "string"
      },
      "profile": {
        "bsonType": "object",
        "properties": {
          "fullName": {
            "bsonType": "string"
          },
          "dateOfBirth": {
            "bsonType": "date"
          },
          "address": {
            "bsonType": "string"
          }
        }
      },
      "employeeProfile": {
        "bsonType": "object",
        "properties": {
          "branchId": {
            "bsonType": "objectId"
          },
          "position": {
            "bsonType": "string"
          }
        }
      },
      "createdAt": {
        "bsonType": "date"
      },
      "updatedAt": {
        "bsonType": "date"
      }
    }
  }
} });
  print("[OK] created accounts");
} else {
  appdb.runCommand({ collMod: "accounts", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "required": [
      "username",
      "email",
      "passwordHash"
    ],
    "properties": {
      "username": {
        "bsonType": "string"
      },
      "email": {
        "bsonType": "string"
      },
      "passwordHash": {
        "bsonType": "string"
      },
      "phone": {
        "bsonType": "string"
      },
      "roleIds": {
        "bsonType": "array",
        "items": {
          "bsonType": "objectId"
        }
      },
      "directPermissionIds": {
        "bsonType": "array",
        "items": {
          "bsonType": "objectId"
        }
      },
      "status": {
        "bsonType": "string"
      },
      "profile": {
        "bsonType": "object",
        "properties": {
          "fullName": {
            "bsonType": "string"
          },
          "dateOfBirth": {
            "bsonType": "date"
          },
          "address": {
            "bsonType": "string"
          }
        }
      },
      "employeeProfile": {
        "bsonType": "object",
        "properties": {
          "branchId": {
            "bsonType": "objectId"
          },
          "position": {
            "bsonType": "string"
          }
        }
      },
      "createdAt": {
        "bsonType": "date"
      },
      "updatedAt": {
        "bsonType": "date"
      }
    }
  }
} });
  print("[OK] updated validator for existing accounts");
}

const emailVerificationValidator = {
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
};

if (!appdb.getCollectionNames().includes("email_verifications")) {
  appdb.createCollection("email_verifications", {
    validator: emailVerificationValidator
  });
  print("[OK] created email_verifications");
} else {
  appdb.runCommand({
    collMod: "email_verifications",
    validator: emailVerificationValidator
  });
  print("[OK] updated validator for existing email_verifications");
}

if (!appdb.getCollectionNames().includes("roles")) {
  appdb.createCollection("roles", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "description": {
        "bsonType": "string"
      },
      "permissionIds": {
        "bsonType": "array",
        "items": {
          "bsonType": "objectId"
        }
      }
    }
  }
} });
  print("[OK] created roles");
} else {
  appdb.runCommand({ collMod: "roles", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "description": {
        "bsonType": "string"
      },
      "permissionIds": {
        "bsonType": "array",
        "items": {
          "bsonType": "objectId"
        }
      }
    }
  }
} });
  print("[OK] updated validator for existing roles");
}

if (!appdb.getCollectionNames().includes("permissions")) {
  appdb.createCollection("permissions", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "description": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created permissions");
} else {
  appdb.runCommand({ collMod: "permissions", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "description": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing permissions");
}

if (!appdb.getCollectionNames().includes("staff_shifts")) {
  appdb.createCollection("staff_shifts", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "employeeAccountId": {
        "bsonType": "objectId"
      },
      "branchId": {
        "bsonType": "objectId"
      },
      "startTime": {
        "bsonType": "date"
      },
      "endTime": {
        "bsonType": "date"
      },
      "station": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created staff_shifts");
} else {
  appdb.runCommand({ collMod: "staff_shifts", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "employeeAccountId": {
        "bsonType": "objectId"
      },
      "branchId": {
        "bsonType": "objectId"
      },
      "startTime": {
        "bsonType": "date"
      },
      "endTime": {
        "bsonType": "date"
      },
      "station": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing staff_shifts");
}

if (!appdb.getCollectionNames().includes("movies")) {
  appdb.createCollection("movies", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "title": {
        "bsonType": "string"
      },
      "synopsis": {
        "bsonType": "string"
      },
      "genres": {
        "bsonType": "array",
        "items": {
          "bsonType": "string"
        }
      },
      "cast": {
        "bsonType": "array",
        "items": {
          "bsonType": "string"
        }
      },
      "duration": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "releaseDate": {
        "bsonType": "date"
      },
      "language": {
        "bsonType": "string"
      },
      "director": {
        "bsonType": "string"
      },
      "ageRating": {
        "bsonType": "string"
      },
      "posterUrl": {
        "bsonType": "string"
      },
      "trailerUrl": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created movies");
} else {
  appdb.runCommand({ collMod: "movies", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "title": {
        "bsonType": "string"
      },
      "synopsis": {
        "bsonType": "string"
      },
      "genres": {
        "bsonType": "array",
        "items": {
          "bsonType": "string"
        }
      },
      "cast": {
        "bsonType": "array",
        "items": {
          "bsonType": "string"
        }
      },
      "duration": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "releaseDate": {
        "bsonType": "date"
      },
      "language": {
        "bsonType": "string"
      },
      "director": {
        "bsonType": "string"
      },
      "ageRating": {
        "bsonType": "string"
      },
      "posterUrl": {
        "bsonType": "string"
      },
      "trailerUrl": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing movies");
}

if (!appdb.getCollectionNames().includes("movie_reviews")) {
  appdb.createCollection("movie_reviews", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "movieId": {
        "bsonType": "objectId"
      },
      "customerAccountId": {
        "bsonType": "objectId"
      },
      "rating": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "content": {
        "bsonType": "string"
      },
      "createdAt": {
        "bsonType": "date"
      },
      "updatedAt": {
        "bsonType": "date"
      }
    }
  }
} });
  print("[OK] created movie_reviews");
} else {
  appdb.runCommand({ collMod: "movie_reviews", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "movieId": {
        "bsonType": "objectId"
      },
      "customerAccountId": {
        "bsonType": "objectId"
      },
      "rating": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "content": {
        "bsonType": "string"
      },
      "createdAt": {
        "bsonType": "date"
      },
      "updatedAt": {
        "bsonType": "date"
      }
    }
  }
} });
  print("[OK] updated validator for existing movie_reviews");
}

if (!appdb.getCollectionNames().includes("branches")) {
  appdb.createCollection("branches", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "branchName": {
        "bsonType": "string"
      },
      "address": {
        "bsonType": "string"
      },
      "email": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created branches");
} else {
  appdb.runCommand({ collMod: "branches", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "branchName": {
        "bsonType": "string"
      },
      "address": {
        "bsonType": "string"
      },
      "email": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing branches");
}

if (!appdb.getCollectionNames().includes("rooms")) {
  appdb.createCollection("rooms", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "branchId": {
        "bsonType": "objectId"
      },
      "roomName": {
        "bsonType": "string"
      },
      "roomType": {
        "bsonType": "string"
      },
      "capacity": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "status": {
        "bsonType": "string"
      },
      "seats": {
        "bsonType": "array",
        "items": {
          "bsonType": "object",
          "properties": {
            "_id": {
              "bsonType": "objectId"
            },
            "row": {
              "bsonType": "string"
            },
            "number": {
              "bsonType": [
                "int",
                "long",
                "double",
                "decimal"
              ]
            },
            "type": {
              "bsonType": "string"
            },
            "status": {
              "bsonType": "string"
            }
          }
        }
      }
    }
  }
} });
  print("[OK] created rooms");
} else {
  appdb.runCommand({ collMod: "rooms", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "branchId": {
        "bsonType": "objectId"
      },
      "roomName": {
        "bsonType": "string"
      },
      "roomType": {
        "bsonType": "string"
      },
      "capacity": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "status": {
        "bsonType": "string"
      },
      "seats": {
        "bsonType": "array",
        "items": {
          "bsonType": "object",
          "properties": {
            "_id": {
              "bsonType": "objectId"
            },
            "row": {
              "bsonType": "string"
            },
            "number": {
              "bsonType": [
                "int",
                "long",
                "double",
                "decimal"
              ]
            },
            "type": {
              "bsonType": "string"
            },
            "status": {
              "bsonType": "string"
            }
          }
        }
      }
    }
  }
} });
  print("[OK] updated validator for existing rooms");
}

if (!appdb.getCollectionNames().includes("showtimes")) {
  appdb.createCollection("showtimes", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "movieId": {
        "bsonType": "objectId"
      },
      "roomId": {
        "bsonType": "objectId"
      },
      "startTime": {
        "bsonType": "date"
      },
      "endTime": {
        "bsonType": "date"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created showtimes");
} else {
  appdb.runCommand({ collMod: "showtimes", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "movieId": {
        "bsonType": "objectId"
      },
      "roomId": {
        "bsonType": "objectId"
      },
      "startTime": {
        "bsonType": "date"
      },
      "endTime": {
        "bsonType": "date"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing showtimes");
}

if (!appdb.getCollectionNames().includes("showtime_seats")) {
  appdb.createCollection("showtime_seats", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "showtimeId": {
        "bsonType": "objectId"
      },
      "seatId": {
        "bsonType": "objectId"
      },
      "status": {
        "bsonType": "string"
      },
      "lockedBy": {
        "bsonType": [
          "objectId",
          "null"
        ]
      },
      "lockedUntil": {
        "bsonType": [
          "date",
          "null"
        ]
      }
    }
  }
} });
  print("[OK] created showtime_seats");
} else {
  appdb.runCommand({ collMod: "showtime_seats", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "showtimeId": {
        "bsonType": "objectId"
      },
      "seatId": {
        "bsonType": "objectId"
      },
      "status": {
        "bsonType": "string"
      },
      "lockedBy": {
        "bsonType": [
          "objectId",
          "null"
        ]
      },
      "lockedUntil": {
        "bsonType": [
          "date",
          "null"
        ]
      }
    }
  }
} });
  print("[OK] updated validator for existing showtime_seats");
}

if (!appdb.getCollectionNames().includes("bookings")) {
  appdb.createCollection("bookings", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "bookingCode": {
        "bsonType": "string"
      },
      "customerAccountId": {
        "bsonType": "objectId"
      },
      "showtimeId": {
        "bsonType": "objectId"
      },
      "seatIds": {
        "bsonType": "array",
        "items": {
          "bsonType": "objectId"
        }
      },
      "voucherId": {
        "bsonType": [
          "objectId",
          "null"
        ]
      },
      "bookingTime": {
        "bsonType": "date"
      },
      "subtotal": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ],
        "minimum": 0
      },
      "discountAmount": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ],
        "minimum": 0
      },
      "totalAmount": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ],
        "minimum": 0
      },
      "status": {
        "bsonType": "string"
      },
      "createdAt": {
        "bsonType": "date"
      },
      "updatedAt": {
        "bsonType": "date"
      }
    }
  }
} });
  print("[OK] created bookings");
} else {
  appdb.runCommand({ collMod: "bookings", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "bookingCode": {
        "bsonType": "string"
      },
      "customerAccountId": {
        "bsonType": "objectId"
      },
      "showtimeId": {
        "bsonType": "objectId"
      },
      "seatIds": {
        "bsonType": "array",
        "items": {
          "bsonType": "objectId"
        }
      },
      "voucherId": {
        "bsonType": [
          "objectId",
          "null"
        ]
      },
      "bookingTime": {
        "bsonType": "date"
      },
      "subtotal": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ],
        "minimum": 0
      },
      "discountAmount": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ],
        "minimum": 0
      },
      "totalAmount": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ],
        "minimum": 0
      },
      "status": {
        "bsonType": "string"
      },
      "createdAt": {
        "bsonType": "date"
      },
      "updatedAt": {
        "bsonType": "date"
      }
    }
  }
} });
  print("[OK] updated validator for existing bookings");
}

if (!appdb.getCollectionNames().includes("tickets")) {
  appdb.createCollection("tickets", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "ticketCode": {
        "bsonType": "string"
      },
      "bookingId": {
        "bsonType": "objectId"
      },
      "showtimeId": {
        "bsonType": "objectId"
      },
      "seatId": {
        "bsonType": "objectId"
      },
      "qrCode": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      },
      "checkedInAt": {
        "bsonType": [
          "date",
          "null"
        ]
      }
    }
  }
} });
  print("[OK] created tickets");
} else {
  appdb.runCommand({ collMod: "tickets", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "ticketCode": {
        "bsonType": "string"
      },
      "bookingId": {
        "bsonType": "objectId"
      },
      "showtimeId": {
        "bsonType": "objectId"
      },
      "seatId": {
        "bsonType": "objectId"
      },
      "qrCode": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      },
      "checkedInAt": {
        "bsonType": [
          "date",
          "null"
        ]
      }
    }
  }
} });
  print("[OK] updated validator for existing tickets");
}

if (!appdb.getCollectionNames().includes("payments")) {
  appdb.createCollection("payments", { validator: {
  "$and": [
    {
      "$jsonSchema": {
        "bsonType": "object",
        "properties": {
          "bookingId": {
            "bsonType": [
              "objectId",
              "null"
            ]
          },
          "orderId": {
            "bsonType": [
              "objectId",
              "null"
            ]
          },
          "gatewayTransactionId": {
            "bsonType": "string"
          },
          "method": {
            "bsonType": "string"
          },
          "amount": {
            "bsonType": [
              "int",
              "long",
              "double",
              "decimal"
            ]
          },
          "status": {
            "bsonType": "string"
          },
          "paidAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "gatewayResponse": {
            "bsonType": "object"
          }
        }
      }
    },
    {
      "$or": [
        {
          "bookingId": {
            "$type": "objectId"
          }
        },
        {
          "orderId": {
            "$type": "objectId"
          }
        }
      ]
    }
  ]
} });
  print("[OK] created payments");
} else {
  appdb.runCommand({ collMod: "payments", validator: {
  "$and": [
    {
      "$jsonSchema": {
        "bsonType": "object",
        "properties": {
          "bookingId": {
            "bsonType": [
              "objectId",
              "null"
            ]
          },
          "orderId": {
            "bsonType": [
              "objectId",
              "null"
            ]
          },
          "gatewayTransactionId": {
            "bsonType": "string"
          },
          "method": {
            "bsonType": "string"
          },
          "amount": {
            "bsonType": [
              "int",
              "long",
              "double",
              "decimal"
            ]
          },
          "status": {
            "bsonType": "string"
          },
          "paidAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "gatewayResponse": {
            "bsonType": "object"
          }
        }
      }
    },
    {
      "$or": [
        {
          "bookingId": {
            "$type": "objectId"
          }
        },
        {
          "orderId": {
            "$type": "objectId"
          }
        }
      ]
    }
  ]
} });
  print("[OK] updated validator for existing payments");
}

if (!appdb.getCollectionNames().includes("refund_requests")) {
  appdb.createCollection("refund_requests", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "bookingId": {
        "bsonType": "objectId"
      },
      "paymentId": {
        "bsonType": "objectId"
      },
      "customerAccountId": {
        "bsonType": "objectId"
      },
      "refundAmount": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "reason": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      },
      "requestedAt": {
        "bsonType": "date"
      },
      "processedAt": {
        "bsonType": [
          "date",
          "null"
        ]
      },
      "processedBy": {
        "bsonType": [
          "objectId",
          "null"
        ]
      }
    }
  }
} });
  print("[OK] created refund_requests");
} else {
  appdb.runCommand({ collMod: "refund_requests", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "bookingId": {
        "bsonType": "objectId"
      },
      "paymentId": {
        "bsonType": "objectId"
      },
      "customerAccountId": {
        "bsonType": "objectId"
      },
      "refundAmount": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "reason": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      },
      "requestedAt": {
        "bsonType": "date"
      },
      "processedAt": {
        "bsonType": [
          "date",
          "null"
        ]
      },
      "processedBy": {
        "bsonType": [
          "objectId",
          "null"
        ]
      }
    }
  }
} });
  print("[OK] updated validator for existing refund_requests");
}

if (!appdb.getCollectionNames().includes("promotions")) {
  appdb.createCollection("promotions", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "discountType": {
        "bsonType": "string"
      },
      "discountValue": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "startDate": {
        "bsonType": "date"
      },
      "endDate": {
        "bsonType": "date"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created promotions");
} else {
  appdb.runCommand({ collMod: "promotions", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "discountType": {
        "bsonType": "string"
      },
      "discountValue": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "startDate": {
        "bsonType": "date"
      },
      "endDate": {
        "bsonType": "date"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing promotions");
}

if (!appdb.getCollectionNames().includes("vouchers")) {
  appdb.createCollection("vouchers", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "promotionId": {
        "bsonType": "objectId"
      },
      "code": {
        "bsonType": "string"
      },
      "usageLimit": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "usedCount": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "validFrom": {
        "bsonType": "date"
      },
      "validTo": {
        "bsonType": "date"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created vouchers");
} else {
  appdb.runCommand({ collMod: "vouchers", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "promotionId": {
        "bsonType": "objectId"
      },
      "code": {
        "bsonType": "string"
      },
      "usageLimit": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "usedCount": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "validFrom": {
        "bsonType": "date"
      },
      "validTo": {
        "bsonType": "date"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing vouchers");
}

if (!appdb.getCollectionNames().includes("orders")) {
  appdb.createCollection("orders", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "orderCode": {
        "bsonType": "string"
      },
      "customerAccountId": {
        "bsonType": "objectId"
      },
      "branchId": {
        "bsonType": "objectId"
      },
      "type": {
        "bsonType": "string"
      },
      "items": {
        "bsonType": "array",
        "items": {
          "bsonType": "object",
          "properties": {
            "itemType": {
              "bsonType": "string"
            },
            "itemId": {
              "bsonType": "objectId"
            },
            "name": {
              "bsonType": "string"
            },
            "unitPrice": {
              "bsonType": [
                "int",
                "long",
                "double",
                "decimal"
              ],
              "minimum": 0
            },
            "quantity": {
              "bsonType": [
                "int",
                "long",
                "double",
                "decimal"
              ],
              "exclusiveMinimum": 0
            },
            "subtotal": {
              "bsonType": [
                "int",
                "long",
                "double",
                "decimal"
              ],
              "minimum": 0
            }
          }
        }
      },
      "totalAmount": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "paymentStatus": {
        "bsonType": "string"
      },
      "pickupStatus": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      },
      "createdAt": {
        "bsonType": "date"
      }
    }
  }
} });
  print("[OK] created orders");
} else {
  appdb.runCommand({ collMod: "orders", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "orderCode": {
        "bsonType": "string"
      },
      "customerAccountId": {
        "bsonType": "objectId"
      },
      "branchId": {
        "bsonType": "objectId"
      },
      "type": {
        "bsonType": "string"
      },
      "items": {
        "bsonType": "array",
        "items": {
          "bsonType": "object",
          "properties": {
            "itemType": {
              "bsonType": "string"
            },
            "itemId": {
              "bsonType": "objectId"
            },
            "name": {
              "bsonType": "string"
            },
            "unitPrice": {
              "bsonType": [
                "int",
                "long",
                "double",
                "decimal"
              ],
              "minimum": 0
            },
            "quantity": {
              "bsonType": [
                "int",
                "long",
                "double",
                "decimal"
              ],
              "exclusiveMinimum": 0
            },
            "subtotal": {
              "bsonType": [
                "int",
                "long",
                "double",
                "decimal"
              ],
              "minimum": 0
            }
          }
        }
      },
      "totalAmount": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "paymentStatus": {
        "bsonType": "string"
      },
      "pickupStatus": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      },
      "createdAt": {
        "bsonType": "date"
      }
    }
  }
} });
  print("[OK] updated validator for existing orders");
}

if (!appdb.getCollectionNames().includes("concession_categories")) {
  appdb.createCollection("concession_categories", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "description": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created concession_categories");
} else {
  appdb.runCommand({ collMod: "concession_categories", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "description": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing concession_categories");
}

if (!appdb.getCollectionNames().includes("concessions")) {
  appdb.createCollection("concessions", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "categoryId": {
        "bsonType": "objectId"
      },
      "name": {
        "bsonType": "string"
      },
      "size": {
        "bsonType": "string"
      },
      "price": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "imageUrl": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created concessions");
} else {
  appdb.runCommand({ collMod: "concessions", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "categoryId": {
        "bsonType": "objectId"
      },
      "name": {
        "bsonType": "string"
      },
      "size": {
        "bsonType": "string"
      },
      "price": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "imageUrl": {
        "bsonType": "string"
      },
      "status": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing concessions");
}

if (!appdb.getCollectionNames().includes("combos")) {
  appdb.createCollection("combos", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "description": {
        "bsonType": "string"
      },
      "price": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "status": {
        "bsonType": "string"
      },
      "items": {
        "bsonType": "array",
        "items": {
          "bsonType": "object",
          "properties": {
            "concessionId": {
              "bsonType": "objectId"
            },
            "quantity": {
              "bsonType": [
                "int",
                "long",
                "double",
                "decimal"
              ],
              "exclusiveMinimum": 0
            }
          }
        }
      }
    }
  }
} });
  print("[OK] created combos");
} else {
  appdb.runCommand({ collMod: "combos", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "description": {
        "bsonType": "string"
      },
      "price": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ]
      },
      "status": {
        "bsonType": "string"
      },
      "items": {
        "bsonType": "array",
        "items": {
          "bsonType": "object",
          "properties": {
            "concessionId": {
              "bsonType": "objectId"
            },
            "quantity": {
              "bsonType": [
                "int",
                "long",
                "double",
                "decimal"
              ],
              "exclusiveMinimum": 0
            }
          }
        }
      }
    }
  }
} });
  print("[OK] updated validator for existing combos");
}

if (!appdb.getCollectionNames().includes("inventories")) {
  appdb.createCollection("inventories", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "branchId": {
        "bsonType": "objectId"
      },
      "concessionId": {
        "bsonType": "objectId"
      },
      "quantity": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ],
        "minimum": 0
      },
      "updatedAt": {
        "bsonType": "date"
      }
    }
  }
} });
  print("[OK] created inventories");
} else {
  appdb.runCommand({ collMod: "inventories", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "branchId": {
        "bsonType": "objectId"
      },
      "concessionId": {
        "bsonType": "objectId"
      },
      "quantity": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ],
        "minimum": 0
      },
      "updatedAt": {
        "bsonType": "date"
      }
    }
  }
} });
  print("[OK] updated validator for existing inventories");
}

if (!appdb.getCollectionNames().includes("suppliers")) {
  appdb.createCollection("suppliers", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "email": {
        "bsonType": "string"
      },
      "phone": {
        "bsonType": "string"
      },
      "address": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created suppliers");
} else {
  appdb.runCommand({ collMod: "suppliers", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "name": {
        "bsonType": "string"
      },
      "email": {
        "bsonType": "string"
      },
      "phone": {
        "bsonType": "string"
      },
      "address": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing suppliers");
}

if (!appdb.getCollectionNames().includes("stock_transactions")) {
  appdb.createCollection("stock_transactions", { validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "branchId": {
        "bsonType": "objectId"
      },
      "concessionId": {
        "bsonType": "objectId"
      },
      "supplierId": {
        "bsonType": [
          "objectId",
          "null"
        ]
      },
      "type": {
        "bsonType": "string"
      },
      "quantity": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ],
        "exclusiveMinimum": 0
      },
      "recordedBy": {
        "bsonType": "objectId"
      },
      "transactionDate": {
        "bsonType": "date"
      },
      "note": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] created stock_transactions");
} else {
  appdb.runCommand({ collMod: "stock_transactions", validator: {
  "$jsonSchema": {
    "bsonType": "object",
    "properties": {
      "branchId": {
        "bsonType": "objectId"
      },
      "concessionId": {
        "bsonType": "objectId"
      },
      "supplierId": {
        "bsonType": [
          "objectId",
          "null"
        ]
      },
      "type": {
        "bsonType": "string"
      },
      "quantity": {
        "bsonType": [
          "int",
          "long",
          "double",
          "decimal"
        ],
        "exclusiveMinimum": 0
      },
      "recordedBy": {
        "bsonType": "objectId"
      },
      "transactionDate": {
        "bsonType": "date"
      },
      "note": {
        "bsonType": "string"
      }
    }
  }
} });
  print("[OK] updated validator for existing stock_transactions");
}
