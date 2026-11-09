export const createPromotionController = (service) => {
  const handle =
    (action, status = 200) =>
    async (req, res, next) => {
      try {
        const result = await action(req);
        if (result.meta) {
          const { items, meta, ...extra } = result;
          res
            .status(status)
            .json({ success: true, data: { items, ...extra }, meta });
        } else res.status(status).json({ success: true, data: result });
      } catch (e) {
        next(e);
      }
    };
  return {
    list: handle((req) =>
      service.listPromotions(req.validated.query, req.auth.account),
    ),
    get: handle((req) =>
      service.getPromotion(req.params.promotionId, req.auth.account),
    ),
    create: handle(
      (req) => service.createPromotion(req.body, req.auth.account),
      201,
    ),
    update: handle((req) =>
      service.updatePromotion(
        req.params.promotionId,
        req.body,
        req.auth.account,
      ),
    ),
    listVouchers: handle((req) =>
      service.listVouchers(
        req.params.promotionId,
        req.validated.query,
        req.auth.account,
      ),
    ),
    createVoucher: handle(
      (req) =>
        service.createVoucher(
          req.params.promotionId,
          req.body,
          req.auth.account,
        ),
      201,
    ),
    updateVoucher: handle((req) =>
      service.updateVoucher(req.params.voucherId, req.body, req.auth.account),
    ),
  };
};
