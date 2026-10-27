export const createRefundController = (service) => ({
  request: async (req, res, next) => { try { res.status(201).json({ success: true, data: await service.request({ ...req.body, customerAccountId: req.auth.accountId }) }); } catch (error) { next(error); } },
  listMine: async (req, res, next) => { try { res.json({ success: true, data: await service.listMine(req.auth.accountId) }); } catch (error) { next(error); } },
  listManager: async (_req, res, next) => { try { res.json({ success: true, data: await service.listManager() }); } catch (error) { next(error); } },
  approve: async (req, res, next) => { try { res.json({ success: true, data: await service.process({ refundId: req.params.refundId, managerId: req.auth.accountId }) }); } catch (error) { next(error); } },
  retry: async (req, res, next) => { try { res.json({ success: true, data: await service.process({ refundId: req.params.refundId, managerId: req.auth.accountId }) }); } catch (error) { next(error); } },
  confirmCash: async (req, res, next) => { try { res.json({ success: true, data: await service.confirmCash({ refundId: req.params.refundId, managerId: req.auth.accountId }) }); } catch (error) { next(error); } },
  reject: async (req, res, next) => { try { res.json({ success: true, data: await service.reject({ refundId: req.params.refundId, managerId: req.auth.accountId, reason: req.body.reason }) }); } catch (error) { next(error); } },
});
