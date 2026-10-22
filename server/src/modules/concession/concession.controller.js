import * as catalog from "./concession.service.js";

export const listCategories = async (req, res, next) => {
  try {
    const { items, meta } = await catalog.listCategories(req.validated.query);
    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};
export const listConcessions = async (req, res, next) => {
  try {
    const { items, meta } = await catalog.listConcessions(req.validated.query);
    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};
export const getConcession = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await catalog.getConcession(
        req.validated.params.concessionId,
        req.validated.query,
      ),
    });
  } catch (error) {
    next(error);
  }
};
export const listCombos = async (req, res, next) => {
  try {
    const { items, meta } = await catalog.listCombos(req.validated.query);
    res.json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};
export const getCombo = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await catalog.getCombo(
        req.validated.params.comboId,
        req.validated.query,
      ),
    });
  } catch (error) {
    next(error);
  }
};
