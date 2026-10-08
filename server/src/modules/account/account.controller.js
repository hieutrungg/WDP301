import * as accountService from "./account.service.js";

export const updateMyProfile = async (req, res, next) => {
  try {
    const account = await accountService.updateProfile(req.auth.accountId, req.body);

    res.json({ success: true, message: "Profile updated", data: account });
  } catch (error) {
    next(error);
  }
};

export const changeMyPassword = async (req, res, next) => {
  try {
    await accountService.changePassword(req.auth.accountId, req.body);

    res.json({ success: true, message: "Password updated" });
  } catch (error) {
    next(error);
  }
};
