import { Role } from "./role.model.js";

export const findRoleByName = (name) => Role.findOne({ name }).exec();
