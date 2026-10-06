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
