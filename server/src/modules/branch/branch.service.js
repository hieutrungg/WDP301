import { AppError } from "../../utils/AppError.js";
import {
  countAllRooms,
  countFuturePublishedShowtimes,
  countRoomsByBranchIds,
} from "./branch-dependency.repository.js";
import { BRANCH_ERROR, BRANCH_STATUS } from "./branch.constants.js";
import {
  countBranches,
  countBranchesByStatus,
  createBranch as insertBranch,
  findBranchById,
  findBranchByName,
  findBranches,
  findBranchesByIds,
  setBranchStatus,
  updateBranchById,
} from "./branch.repository.js";

const OPTIONAL_CONTACT_FIELDS = ["email", "hotline"];

const notFoundError = () => new AppError(404, "Branch not found", [], BRANCH_ERROR.NOT_FOUND);

const nameTakenError = () =>
  new AppError(
    409,
    "A branch with this name already exists",
    [{ field: "branchName", message: "A branch with this name already exists" }],
    BRANCH_ERROR.NAME_TAKEN,
  );

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const serializeBranch = (branch, extras = {}) => ({
  id: branch._id.toString(),
  branchName: branch.branchName,
  address: branch.address,
  email: branch.email ?? null,
  hotline: branch.hotline ?? null,
  status: branch.status,
  createdAt: branch.createdAt,
  updatedAt: branch.updatedAt,
  ...extras,
});

const toBranchDetail = async (branch) => {
  const [roomCounts, upcomingShowtimeCount] = await Promise.all([
    countRoomsByBranchIds([branch._id]),
    countFuturePublishedShowtimes(branch._id),
  ]);

  return serializeBranch(branch, {
    roomCount: roomCounts.get(branch._id.toString()) ?? 0,
    upcomingShowtimeCount,
  });
};

const requireBranch = async (branchId) => {
  const branch = await findBranchById(branchId);
  if (!branch) throw notFoundError();
  return branch;
};

const assertNameAvailable = async (branchName, excludeId) => {
  if (await findBranchByName(branchName, { excludeId })) throw nameTakenError();
};

// The unique index is the real guard: two concurrent requests can both pass the pre-check.
const rethrowDuplicateName = (error) => {
  if (error?.code === 11000) throw nameTakenError();
  throw error;
};

const buildListFilter = ({ q, status }) => {
  const filter = {};
  if (status) filter.status = status;

  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { branchName: pattern },
      { address: pattern },
      { email: pattern },
      { hotline: pattern },
    ];
  }

  return filter;
};

export const listBranches = async ({ q, status, page, limit, sort, order }) => {
  const filter = buildListFilter({ q, status });
  const direction = order === "desc" ? -1 : 1;

  const [branches, total] = await Promise.all([
    findBranches({
      filter,
      sort: { [sort]: direction, _id: direction },
      skip: (page - 1) * limit,
      limit,
    }),
    countBranches(filter),
  ]);

  const roomCounts = await countRoomsByBranchIds(branches.map(({ _id }) => _id));

  return {
    items: branches.map((branch) =>
      serializeBranch(branch, { roomCount: roomCounts.get(branch._id.toString()) ?? 0 }),
    ),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getBranchSummary = async () => {
  const [byStatus, roomCount] = await Promise.all([countBranchesByStatus(), countAllRooms()]);
  const active = byStatus[BRANCH_STATUS.ACTIVE] ?? 0;
  const inactive = byStatus[BRANCH_STATUS.INACTIVE] ?? 0;

  return { total: active + inactive, active, inactive, roomCount };
};

export const getBranch = async (branchId) => toBranchDetail(await requireBranch(branchId));

// Read contract for other modules (Room): id -> { id, branchName, status }, no dependency counts.
export const getBranchSummariesByIds = async (branchIds) => {
  if (branchIds.length === 0) return new Map();

  const branches = await findBranchesByIds(branchIds, { branchName: 1, status: 1 });
  return new Map(
    branches.map(({ _id, branchName, status }) => [
      _id.toString(),
      { id: _id.toString(), branchName, status },
    ]),
  );
};

export const createBranch = async (input) => {
  await assertNameAvailable(input.branchName);

  const branch = { branchName: input.branchName, address: input.address, status: input.status };
  for (const field of OPTIONAL_CONTACT_FIELDS) {
    if (input[field]) branch[field] = input[field];
  }

  try {
    return toBranchDetail(await insertBranch(branch));
  } catch (error) {
    return rethrowDuplicateName(error);
  }
};

export const updateBranch = async (branchId, changes) => {
  const current = await requireBranch(branchId);

  if (changes.branchName !== undefined) {
    await assertNameAvailable(changes.branchName, current._id);
  }

  const set = {};
  const unset = {};
  for (const [field, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (value === null) unset[field] = "";
    else set[field] = value;
  }

  try {
    const updated = await updateBranchById(current._id, { set, unset });
    if (!updated) throw notFoundError();
    return toBranchDetail(updated);
  } catch (error) {
    return rethrowDuplicateName(error);
  }
};

export const changeBranchStatus = async (branchId, status) => {
  const branch = await requireBranch(branchId);

  if (branch.status === status) {
    return toBranchDetail(branch);
  }

  // A-24: a branch cannot go INACTIVE while it still has a future PUBLISHED showtime.
  if (status === BRANCH_STATUS.INACTIVE) {
    const upcomingShowtimeCount = await countFuturePublishedShowtimes(branch._id);

    if (upcomingShowtimeCount > 0) {
      throw new AppError(
        409,
        `This branch still has ${upcomingShowtimeCount} upcoming published showtime(s). ` +
          "Cancel or reschedule them before setting the branch to inactive.",
        [],
        BRANCH_ERROR.HAS_FUTURE_SHOWTIMES,
      );
    }
  }

  const result = await setBranchStatus(branch._id, branch.status, status);
  if (result.matchedCount !== 1) {
    throw new AppError(
      409,
      "Branch status changed while you were editing. Refresh and try again.",
      [],
      BRANCH_ERROR.STATUS_CONFLICT,
    );
  }

  return getBranch(branch._id);
};
