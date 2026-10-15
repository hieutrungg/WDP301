import { BRANCH_NAME_COLLATION } from "./branch.constants.js";
import { Branch } from "./branch.model.js";

export const findBranches = ({ filter, sort, skip, limit }) =>
  Branch.find(filter)
    .collation(BRANCH_NAME_COLLATION)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean()
    .exec();

export const countBranches = (filter) => Branch.countDocuments(filter).exec();

export const countBranchesByStatus = async () => {
  const rows = await Branch.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).exec();
  return Object.fromEntries(rows.map(({ _id, count }) => [_id, count]));
};

export const findBranchById = (branchId) => Branch.findById(branchId).lean().exec();

export const findBranchesByIds = (branchIds, projection) =>
  Branch.find({ _id: { $in: branchIds } }, projection).lean().exec();

// Uses the same collation as the unique index, so "f-cinema central" matches "F-Cinema Central".
export const findBranchByName = (branchName, { excludeId } = {}) =>
  Branch.findOne({ branchName, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
    .collation(BRANCH_NAME_COLLATION)
    .lean()
    .exec();

export const createBranch = async (branch) => (await Branch.create(branch)).toObject();

export const updateBranchById = (branchId, { set, unset }) =>
  Branch.findByIdAndUpdate(
    branchId,
    {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    },
    { returnDocument: "after", runValidators: true },
  )
    .lean()
    .exec();

// Compare-and-set: only flips the status the caller observed, never a concurrently changed one.
export const setBranchStatus = (branchId, fromStatus, toStatus) =>
  Branch.updateOne({ _id: branchId, status: fromStatus }, { $set: { status: toStatus } }).exec();
