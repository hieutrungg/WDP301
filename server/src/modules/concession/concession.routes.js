import { Router } from "express";
import { validate } from "../../middlewares/validateMiddleware.js";
import * as controller from "./concession.controller.js";
import * as schema from "./concession.validation.js";

const router = Router();
const query = (validation) =>
  validate(validation, { source: "query", code: "INVALID_QUERY" });
// UC24 Guest browsing. No write route or protected Inventory route is exposed here.
router.get(
  "/concession-categories",
  query(schema.categoriesQuery),
  controller.listCategories,
);
router.get(
  "/concessions",
  query(schema.concessionsQuery),
  controller.listConcessions,
);
router.get(
  "/concessions/:concessionId",
  validate(schema.concessionParams, {
    source: "params",
    code: "INVALID_CONCESSION_ID",
  }),
  query(schema.detailQuery),
  controller.getConcession,
);
router.get("/combos", query(schema.combosQuery), controller.listCombos);
router.get(
  "/combos/:comboId",
  validate(schema.comboParams, { source: "params", code: "INVALID_COMBO_ID" }),
  query(schema.detailQuery),
  controller.getCombo,
);

export default router;
