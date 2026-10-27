import { Account } from "./account.model.js";

// Internal read contract: identifiers are used only for joining, never public DTOs.
export const getPublicAuthorNames = async (accountIds) => {
  if (!accountIds.length) return new Map();
  const accounts = await Account.find({ _id: { $in: accountIds } })
    .select({ _id: 1, "profile.fullName": 1 }).lean();
  return new Map(accounts.map((account) => [account._id.toString(), account.profile?.fullName]));
};
