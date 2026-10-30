import bcrypt from "bcrypt";
import { branchSeeds } from "./seed-branches.js";
import { deterministicObjectId, summarizeBulkWrite } from "./seed-utils.js";

export const DEVELOPMENT_STAFF_PASSWORD = "Staff@12345";

export const staffAccountSeeds = branchSeeds.map((branch) => {
  const slug = branch.seedKey.replace("branch:f-cinema-", "").replaceAll("-", "_");
  return {
    seedKey: `account:staff:${slug}`,
    branchSeedKey: branch.seedKey,
    username: `staff_${slug}`,
    email: `staff.${slug}@f-cinema.example`,
    fullName: `${branch.branchName} Staff`,
    status: branch.status === "ACTIVE" ? "ACTIVE" : "DISABLED",
  };
});

export const seedStaffAccounts = async (database) => {
  const staffRole = await database.collection("roles").findOne({ name: "STAFF" }, { projection: { _id: 1 } });
  if (!staffRole) throw new Error("STAFF role must exist before seeding cinema staff accounts");
  const passwordHash = await bcrypt.hash(DEVELOPMENT_STAFF_PASSWORD, 10);
  const now = new Date();
  const operations = staffAccountSeeds.map(({ seedKey, branchSeedKey, fullName, ...identity }) => ({
    updateOne: {
      filter: { _id: deterministicObjectId(seedKey) },
      update: {
        $set: {
          status: identity.status,
          profile: { fullName },
          employeeProfile: {
            branchId: deterministicObjectId(branchSeedKey),
            position: "Cinema Staff",
          },
          updatedAt: now,
        },
        $setOnInsert: {
          _id: deterministicObjectId(seedKey),
          username: identity.username,
          email: identity.email,
          passwordHash,
          roleIds: [staffRole._id],
          directPermissionIds: [],
          createdAt: now,
        },
      },
      upsert: true,
    },
  }));
  return summarizeBulkWrite(await database.collection("accounts").bulkWrite(operations, { ordered: true }));
};
