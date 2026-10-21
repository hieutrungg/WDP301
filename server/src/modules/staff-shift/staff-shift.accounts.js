import mongoose from "mongoose";

// Read-only lookups of who an account is, for shift screens. They stay inside this module: two
// minimal Mongoose views over the existing `accounts` and `roles` collections, registered under
// their own model names, so no file of the account module is imported or changed. They map only
// original account fields (username, phone, profile.fullName, roleIds, status and
// employeeProfile.branchId / position) and never write. The role decides who is staff; the
// employee profile says which branch they work at and their job title.

const ACTIVE_STATUS = "ACTIVE";

const accountView = mongoose.model(
  "StaffShiftAccountView",
  new mongoose.Schema(
    {
      username: String,
      phone: String,
      profile: { fullName: String },
      roleIds: [mongoose.Schema.Types.ObjectId],
      status: String,
      employeeProfile: { branchId: mongoose.Schema.Types.ObjectId, position: String },
    },
    { collection: "accounts", versionKey: false, strict: true },
  ),
);

const roleView = mongoose.model(
  "StaffShiftRoleView",
  new mongoose.Schema({ name: String }, { collection: "roles", versionKey: false, strict: true }),
);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toSummary = (account) => ({
  id: account._id.toString(),
  fullName: account.profile?.fullName ?? account.username,
  username: account.username,
  phone: account.phone ?? null,
  position: account.employeeProfile?.position ?? null,
});

const SUMMARY_FIELDS = "username phone profile.fullName employeeProfile.position";

const nameOrUsername = (text) => {
  const pattern = new RegExp(escapeRegex(text), "i");
  return [{ "profile.fullName": pattern }, { username: pattern }];
};

export const findAccountSummaries = async (accountIds) => {
  if (accountIds.length === 0) return new Map();

  const accounts = await accountView.find({ _id: { $in: accountIds } }).select(SUMMARY_FIELDS).lean();
  return new Map(accounts.map((account) => [account._id.toString(), toSummary(account)]));
};

// Matches an account's full name or username.
export const findAccountIdsByText = async (text) => {
  const accounts = await accountView.find({ $or: nameOrUsername(text) }).select("_id").lean();
  return accounts.map(({ _id }) => _id);
};

// ACTIVE accounts holding `roleName` that work at `branchId`, optionally narrowed by name text.
export const findActiveAccountsByRole = async (roleName, { branchId, q, limit }) => {
  const role = await roleView.findOne({ name: roleName }).select("_id").lean();
  if (!role) return [];

  const filter = {
    roleIds: role._id,
    status: ACTIVE_STATUS,
    "employeeProfile.branchId": branchId,
    ...(q ? { $or: nameOrUsername(q) } : {}),
  };
  const accounts = await accountView
    .find(filter)
    .select(SUMMARY_FIELDS)
    .sort({ "profile.fullName": 1, username: 1 })
    .limit(limit)
    .lean();

  return accounts.map(toSummary);
};

// The account when it is ACTIVE, holds `roleName` and works at `branchId`, otherwise null.
export const findActiveAccountWithRole = async (accountId, roleName, branchId) => {
  const role = await roleView.findOne({ name: roleName }).select("_id").lean();
  if (!role) return null;

  const account = await accountView
    .findOne({ _id: accountId, roleIds: role._id, status: ACTIVE_STATUS, "employeeProfile.branchId": branchId })
    .select(SUMMARY_FIELDS)
    .lean();

  return account ? toSummary(account) : null;
};
