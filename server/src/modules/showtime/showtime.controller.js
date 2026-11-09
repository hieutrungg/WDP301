import * as showtimeService from "./showtime.service.js";

export const listShowtimes = async (req, res, next) => {
  try {
    const result = await showtimeService.listShowtimes(req.validated.query);
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

export const listManagerShowtimes = async (req, res, next) => {
  try {
    // Always pin Manager queries to the account's assigned branch, ignoring client scope.
    const result = await showtimeService.listManagerShowtimes({
      ...req.validated.query,
      cinemaId: req.auth.branchId,
    });
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

export const getShowtimeById = async (req, res, next) => {
  try {
    const data = await showtimeService.getPublicShowtimeById(req.validated.params.showtimeId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const listMovieShowtimes = async (req, res, next) => {
  try {
    const result = await showtimeService.listShowtimes({
      ...req.validated.query,
      movieId: req.validated.params.movieId,
    });
    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

export const createShowtime = async (req, res, next) => {
  try {
    const data = await showtimeService.createShowtime({
      ...req.validated.body,
      branchId: req.auth.branchId,
    });
    res.status(201).json({ success: true, message: "Showtime published", data });
  } catch (error) {
    next(error);
  }
};

export const rescheduleShowtime = async (req, res, next) => {
  try {
    const data = await showtimeService.rescheduleShowtime({
      ...req.validated.params,
      ...req.validated.body,
      branchId: req.auth.branchId,
    });
    res.json({ success: true, message: "Showtime updated", data });
  } catch (error) {
    next(error);
  }
};

export const cancelShowtime = async (req, res, next) => {
  try {
    const data = await showtimeService.cancelShowtime({
      ...req.validated.params,
      managerId: req.auth.accountId,
      branchId: req.auth.branchId,
    });
    res.json({ success: true, message: "Showtime cancelled", data });
  } catch (error) {
    next(error);
  }
};
