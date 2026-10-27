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
    list: handle((req) => service.listPromotions(req.validated.query)),
    get: handle((req) => service.getPromotion(req.params.promotionId)),
    create: handle(
      (req) => service.createPromotion(req.body, req.auth.accountId),
      201,
    ),
    update: handle((req) =>
      service.updatePromotion(
        req.params.promotionId,
        req.body,
        req.auth.accountId,
      ),
    ),
    listVouchers: handle((req) =>
      service.listVouchers(req.params.promotionId, req.validated.query),
    ),
    createVoucher: handle(
      (req) =>
        service.createVoucher(
          req.params.promotionId,
          req.body,
          req.auth.accountId,
        ),
      201,
    ),
    updateVoucher: handle((req) =>
      service.updateVoucher(req.params.voucherId, req.body, req.auth.accountId),
    ),
  };
};
