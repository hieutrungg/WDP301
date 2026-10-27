import { ROLE_MESSAGE } from "./role.constants.js";
import * as roleService from "./role.service.js";

export const listPermissions = async (_req, res, next) => {
  try {
    res.json({ success: true, data: await roleService.listPermissions() });
  } catch (error) {
    next(error);
  }
};

export const listRoles = async (req, res, next) => {
  try {
    const { items, meta } = await roleService.listRoles(req.validated.query);

    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};

export const getRole = async (req, res, next) => {
  try {
    res.json({ success: true, data: await roleService.getRole(req.validated.params.roleId) });
  } catch (error) {
    next(error);
  }
};

export const createRole = async (req, res, next) => {
  try {
    const role = await roleService.createRole(req.auth.accountId, req.body);

    res.status(201).json({ success: true, message: ROLE_MESSAGE.CREATED, data: role });
  } catch (error) {
    next(error);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const role = await roleService.updateRole(req.auth.accountId, req.validated.params.roleId, req.body);

    res.json({ success: true, message: ROLE_MESSAGE.SAVED, data: role });
  } catch (error) {
    next(error);
  }
};

export const assignRolePermissions = async (req, res, next) => {
  try {
    const role = await roleService.assignRolePermissions(
      req.auth.accountId,
      req.validated.params.roleId,
      req.body,
    );

    res.json({ success: true, message: ROLE_MESSAGE.PERMISSIONS_ASSIGNED, data: role });
  } catch (error) {
    next(error);
  }
};
