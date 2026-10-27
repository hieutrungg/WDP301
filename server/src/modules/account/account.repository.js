import mongoose from "mongoose";
import { Account } from "./account.model.js";
import "../role-permission/role.model.js";
import "../role-permission/permission.model.js";

export const findAccountForLogin = (identity) =>
  Account.findOne({
    $or: [{ email: identity }, { username: identity }],
  })
    .collation({ locale: "en", strength: 2 })
    .select("+passwordHash")
    .exec();

export const findAccountWithAccessById = (accountId) =>
  Account.findById(accountId)
    .populate({
      path: "roleIds",
      populate: { path: "permissionIds" },
    })
    .populate("directPermissionIds")
    .exec();

export const findAccountByEmail = (email) => Account.findOne({ email }).exec();

export const findAccountByUsername = (username) =>
  Account.findOne({ username }).collation({ locale: "en", strength: 2 }).exec();

export const findDuplicateAccount = (email, username) =>
  Account.findOne({ $or: [{ email }, { username }] })
    .collation({ locale: "en", strength: 2 })
    .exec();

export const createAccount = (account) => Account.create(account);

export const activateAccount = (accountId) =>
  Account.updateOne(
    { _id: accountId, status: "PENDING_VERIFICATION" },
    { $set: { status: "ACTIVE" } },
  ).exec();

export const deletePendingAccount = (accountId) =>
  Account.deleteOne({ _id: accountId, status: "PENDING_VERIFICATION" }).exec();

export const findAccountById = (accountId) => Account.findById(accountId).exec();

export const findAccountWithPasswordById = (accountId) =>
  Account.findById(accountId).select("+passwordHash").exec();

export const updateAccountProfile = (accountId, changes) =>
  Account.updateOne({ _id: accountId }, { $set: changes }).exec();

export const setAccountPasswordHash = (accountId, passwordHash) =>
  Account.updateOne({ _id: accountId }, { $set: { passwordHash } }).exec();

// ---- Staff account management (STAFF-101) ----
const IDENTITY_COLLATION = { locale: "en", strength: 2 };

export const findStaffAccounts = ({ filter, sort, skip, limit }) =>
  Account.find(filter)
    .collation(IDENTITY_COLLATION)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate({ path: "roleIds", select: "name" })
    .lean()
    .exec();

export const countAccounts = (filter) => Account.countDocuments(filter).exec();

export const countAccountsByStatus = async (filter) => {
  const rows = await Account.aggregate([
    { $match: filter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]).exec();
  return Object.fromEntries(rows.map(({ _id, count }) => [_id ?? "UNKNOWN", count]));
};

export const findAccountDocumentById = (accountId) => Account.findById(accountId).lean().exec();

export const findAccountsByIds = (accountIds, projection) =>
  Account.find({ _id: { $in: accountIds } }, projection).lean().exec();

// Every account already using one of these identities, other than `excludeId`.
export const findIdentityConflicts = ({ email, username, phone, excludeId }) => {
  const or = [];
  if (email) or.push({ email });
  if (username) or.push({ username });
  if (phone) or.push({ phone });
  if (or.length === 0) return [];

  return Account.find(
    { $or: or, ...(excludeId ? { _id: { $ne: excludeId } } : {}) },
    { email: 1, username: 1, phone: 1 },
  )
    .collation(IDENTITY_COLLATION)
    .lean()
    .exec();
};

export const updateAccountById = (accountId, { set = {}, unset = {} }) =>
  Account.updateOne(
    { _id: accountId },
    {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    },
  ).exec();

// Compare-and-set so a concurrent change of the same account is never silently overwritten.
export const setAccountStatus = (accountId, fromStatus, toStatus, updatedBy) =>
  Account.updateOne(
    { _id: accountId, status: fromStatus },
    { $set: { status: toStatus, updatedBy } },
  ).exec();

// roleId -> number of ACTIVE accounts holding it.
export const countActiveAccountsGroupedByRole = async (roleIds) => {
  if (roleIds.length === 0) return new Map();
  // Aggregation does not cast, so string ids are converted here.
  const ids = roleIds.map((id) => new mongoose.Types.ObjectId(String(id)));

  const rows = await Account.aggregate([
    { $match: { status: "ACTIVE", roleIds: { $in: ids } } },
    { $unwind: "$roleIds" },
    { $match: { roleIds: { $in: ids } } },
    { $group: { _id: "$roleIds", count: { $sum: 1 } } },
  ]).exec();
  return new Map(rows.map(({ _id, count }) => [_id.toString(), count]));
};
