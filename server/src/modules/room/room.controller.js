import * as roomService from "./room.service.js";
import * as roomManagement from "./room-management.service.js";

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

export const getRoomSummary = async (req, res, next) => {
  try {
    res.json({ success: true, data: await roomManagement.getRoomSummary(req.validated.query) });
  } catch (error) {
    next(error);
  }
};

export const getRoom = async (req, res, next) => {
  try {
    res.json({ success: true, data: await roomManagement.getRoom(req.validated.params.roomId) });
  } catch (error) {
    next(error);
  }
};

export const createRoom = async (req, res, next) => {
  try {
    const room = await roomManagement.createRoom(req.body);

    res.status(201).json({ success: true, message: "Room created", data: room });
  } catch (error) {
    next(error);
  }
};

export const updateRoom = async (req, res, next) => {
  try {
    const room = await roomManagement.updateRoom(req.validated.params.roomId, req.body);

    res.json({ success: true, message: "Room updated", data: room });
  } catch (error) {
    next(error);
  }
};

export const changeRoomStatus = async (req, res, next) => {
  try {
    const room = await roomManagement.changeRoomStatus(req.validated.params.roomId, req.body.status);

    res.json({ success: true, message: "Room status updated", data: room });
  } catch (error) {
    next(error);
  }
};

export const deleteRoom = async (req, res, next) => {
  try {
    const result = await roomManagement.deleteRoom(req.validated.params.roomId);

    res.json({ success: true, message: "Room deleted", data: result });
  } catch (error) {
    next(error);
  }
};
