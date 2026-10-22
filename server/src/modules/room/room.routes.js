import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { ROOM_ERROR, ROOM_MANAGEMENT_ERROR } from "./room.constants.js";
import {
  changeRoomStatus,
  createRoom,
  createSeatLayout,
  deleteRoom,
  getRoom,
  getRoomSummary,
  getSeatLayout,
  listRooms,
  updateRoom,
  updateSeatLayout,
} from "./room.controller.js";
import {
  changeRoomStatusSchema,
  createRoomSchema,
  createSeatLayoutSchema,
  listRoomsQuerySchema,
  roomIdParamsSchema,
  roomSummaryQuerySchema,
  updateRoomSchema,
  updateSeatLayoutSchema,
} from "./room.validation.js";

const router = Router();

const validateRoomId = validate(roomIdParamsSchema, {
  source: "params",
  code: ROOM_ERROR.INVALID_ROOM_ID,
});
const validateLayout = (schema) => validate(schema, { code: ROOM_ERROR.INVALID_SEAT_LAYOUT });
const validateRoomBody = (schema) =>
  validate(schema, { code: ROOM_MANAGEMENT_ERROR.VALIDATION_FAILED });

// UC41 and Room management share one actor: the Manager. ADMIN holds every permission, so the
// role is checked as well; that is what keeps ADMIN read-only here.
const manageRooms = [requirePermission("room.manage"), requireRole("MANAGER")];

// Default-deny: every route needs a session; reads need room.view, writes need room.manage plus
// the MANAGER role. Branch-scoped RBAC is not approved yet.
router.use(requireAuth);

router.get(
  "/",
  requirePermission("room.view"),
  validate(listRoomsQuerySchema, { source: "query", code: ROOM_ERROR.INVALID_QUERY }),
  listRooms,
);
router.get(
  "/summary",
  requirePermission("room.view"),
  validate(roomSummaryQuerySchema, { source: "query", code: ROOM_ERROR.INVALID_QUERY }),
  getRoomSummary,
);
router.post("/", ...manageRooms, validateRoomBody(createRoomSchema), createRoom);

router.get("/:roomId", requirePermission("room.view"), validateRoomId, getRoom);
router.patch("/:roomId", ...manageRooms, validateRoomId, validateRoomBody(updateRoomSchema), updateRoom);
router.patch(
  "/:roomId/status",
  ...manageRooms,
  validateRoomId,
  validateRoomBody(changeRoomStatusSchema),
  changeRoomStatus,
);
router.delete("/:roomId", ...manageRooms, validateRoomId, deleteRoom);

router.get("/:roomId/seat-layout", requirePermission("room.view"), validateRoomId, getSeatLayout);
router.post(
  "/:roomId/seat-layout",
  ...manageRooms,
  validateRoomId,
  validateLayout(createSeatLayoutSchema),
  createSeatLayout,
);
router.put(
  "/:roomId/seat-layout",
  ...manageRooms,
  validateRoomId,
  validateLayout(updateSeatLayoutSchema),
  updateSeatLayout,
);

export default router;
