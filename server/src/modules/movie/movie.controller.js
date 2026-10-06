export const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};