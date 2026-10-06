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
