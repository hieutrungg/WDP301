import { Router } from "express";
import { validate } from "../../middlewares/validateMiddleware.js";
import { listPublicCinemas } from "./branch.controller.js";
import { BRANCH_ERROR } from "./branch.constants.js";
import { publicCinemasQuerySchema } from "./branch.validation.js";

const router = Router();

router.get(
  "/",
  validate(publicCinemasQuerySchema, { source: "query", code: BRANCH_ERROR.INVALID_QUERY }),
  listPublicCinemas,
);

export default router;
