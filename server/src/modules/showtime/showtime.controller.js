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
    const result = await showtimeService.listManagerShowtimes(req.validated.query);
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
    const data = await showtimeService.createShowtime(req.validated.body);
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
    });
    res.json({ success: true, message: "Showtime updated", data });
  } catch (error) {
    next(error);
  }
};

export const cancelShowtime = async (req, res, next) => {
  try {
    const data = await showtimeService.cancelShowtime({ ...req.validated.params, managerId: req.auth.accountId });
    res.json({ success: true, message: "Showtime cancelled", data });
  } catch (error) {
    next(error);
  }
};
