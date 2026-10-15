import { Router } from "express";
import { requireAuth } from "../../middlewares/authMiddleware.js";
import { requirePermission, requireRole } from "../../middlewares/permissionMiddleware.js";
import { validate } from "../../middlewares/validateMiddleware.js";
import { ROOM_ERROR } from "./room.constants.js";
import {
  createSeatLayout,
  getSeatLayout,
  listRooms,
  updateSeatLayout,
} from "./room.controller.js";
import {
  createSeatLayoutSchema,
  listRoomsQuerySchema,
  roomIdParamsSchema,
  updateSeatLayoutSchema,
} from "./room.validation.js";

const router = Router();

const validateRoomId = validate(roomIdParamsSchema, {
  source: "params",
  code: ROOM_ERROR.INVALID_ROOM_ID,
});
const validateLayout = (schema) => validate(schema, { code: ROOM_ERROR.INVALID_SEAT_LAYOUT });

// UC41's actor is the Manager. ADMIN holds every permission, so the role is checked as well.
const manageLayout = [requirePermission("room.manage"), requireRole("MANAGER")];

// Default-deny: every route needs a session; reads need room.view, layout writes need
// room.manage plus the MANAGER role (UC41 Manager workflow). Branch-scoped RBAC is not approved yet.
router.use(requireAuth);

router.get(
  "/",
  requirePermission("room.view"),
  validate(listRoomsQuerySchema, { source: "query", code: ROOM_ERROR.INVALID_QUERY }),
  listRooms,
);
router.get("/:roomId/seat-layout", requirePermission("room.view"), validateRoomId, getSeatLayout);
router.post(
  "/:roomId/seat-layout",
  ...manageLayout,
  validateRoomId,
  validateLayout(createSeatLayoutSchema),
  createSeatLayout,
);
router.put(
  "/:roomId/seat-layout",
  ...manageLayout,
  validateRoomId,
  validateLayout(updateSeatLayoutSchema),
  updateSeatLayout,
);

export default router;
