import { env } from "../../config/env.js";
import * as authService from "./auth.service.js";

const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax",
  path: "/",
};

export const login = async (req, res, next) => {
  try {
    const { token, rememberMe } = await authService.login(req.body);
    const options = rememberMe
      ? { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }
      : cookieOptions;

    res.cookie("accessToken", token, options).json({
      success: true,
      message: "Signed in successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const account = await authService.getCurrentAccount(req.auth.accountId);

    res.json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
};

export const logout = (_req, res) => {
  res.clearCookie("accessToken", cookieOptions).json({
    success: true,
    message: "Signed out successfully",
  });
};
