import { STAFF_MESSAGE } from "./account.constants.js";
import * as staffAccountService from "./staff-account.service.js";

export const listStaffAccounts = async (req, res, next) => {
  try {
    const { items, meta } = await staffAccountService.listStaffAccounts(req.validated.query);

    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};

export const getStaffFormOptions = async (_req, res, next) => {
  try {
    res.json({ success: true, data: await staffAccountService.getStaffFormOptions() });
  } catch (error) {
    next(error);
  }
};

export const getStaffAccount = async (req, res, next) => {
  try {
    const account = await staffAccountService.getStaffAccount(req.validated.params.accountId);

    res.json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
};

export const createStaffAccount = async (req, res, next) => {
  try {
    const { account, credentialSetup } = await staffAccountService.createStaffAccount(
      req.auth.accountId,
      req.body,
    );

    res.status(201).json({
      success: true,
      message: STAFF_MESSAGE.CREATED,
      data: account,
      meta: { credentialSetup },
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaffAccount = async (req, res, next) => {
  try {
    const account = await staffAccountService.updateStaffAccount(
      req.auth.accountId,
      req.validated.params.accountId,
      req.body,
    );

    res.json({ success: true, message: STAFF_MESSAGE.SAVED, data: account });
  } catch (error) {
    next(error);
  }
};

export const changeStaffStatus = async (req, res, next) => {
  try {
    const account = await staffAccountService.changeStaffStatus(
      req.auth.accountId,
      req.validated.params.accountId,
      req.body,
    );

    res.json({ success: true, message: STAFF_MESSAGE.SAVED, data: account });
  } catch (error) {
    next(error);
  }
};

export const assignStaffAccess = async (req, res, next) => {
  try {
    const account = await staffAccountService.assignStaffAccess(
      req.auth.accountId,
      req.validated.params.accountId,
      req.body,
    );

    res.json({ success: true, message: STAFF_MESSAGE.PERMISSIONS_ASSIGNED, data: account });
  } catch (error) {
    next(error);
  }
};
