import { Role } from "./role.model.js";
import { Permission } from "./permission.model.js";

// Case-insensitive name comparison, same collation as account identities.
const NAME_COLLATION = { locale: "en", strength: 2 };

export const findRoleByName = (name) => Role.findOne({ name }).exec();

export const findRoleByNameInsensitive = (name, { excludeId } = {}) =>
  Role.findOne({ name, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
    .collation(NAME_COLLATION)
    .lean()
    .exec();

export const findRoles = ({ filter, sort, skip, limit }) =>
  Role.find(filter).collation(NAME_COLLATION).sort(sort).skip(skip).limit(limit).lean().exec();

export const countRoles = (filter) => Role.countDocuments(filter).exec();

export const findAllRoles = () => Role.find({}).sort({ name: 1 }).lean().exec();

export const findRoleById = (roleId) => Role.findById(roleId).lean().exec();

export const findRolesByIds = (roleIds) => Role.find({ _id: { $in: roleIds } }).lean().exec();

export const createRole = async (role) => (await Role.create(role)).toObject();

export const updateRoleById = (roleId, changes) =>
  Role.findByIdAndUpdate(roleId, { $set: changes }, { returnDocument: "after" }).lean().exec();

export const findAllPermissions = () => Permission.find({}).sort({ name: 1 }).lean().exec();

export const findPermissionsByIds = (permissionIds) =>
  Permission.find({ _id: { $in: permissionIds } }).lean().exec();
