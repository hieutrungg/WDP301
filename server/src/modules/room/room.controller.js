import * as roomService from "./room.service.js";

export const listRooms = async (req, res, next) => {
  try {
    const { items, meta } = await roomService.listRooms(req.validated.query);

    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};

export const getSeatLayout = async (req, res, next) => {
  try {
    res.json({ success: true, data: await roomService.getSeatLayout(req.validated.params.roomId) });
  } catch (error) {
    next(error);
  }
};

export const createSeatLayout = async (req, res, next) => {
  try {
    const result = await roomService.createSeatLayout(
      req.validated.params.roomId,
      req.body,
      req.auth.accountId,
    );

    res.status(201).json({ success: true, message: "Seat map created", data: result });
  } catch (error) {
    next(error);
  }
};

export const updateSeatLayout = async (req, res, next) => {
  try {
    const result = await roomService.updateSeatLayout(
      req.validated.params.roomId,
      req.body,
      req.auth.accountId,
    );

    res.json({
      success: true,
      message: result.changed ? "Seat map saved" : "No changes to save",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
