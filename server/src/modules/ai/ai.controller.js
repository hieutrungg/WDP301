// HTTP adapter of the AI module. No business rules; everything is in ai-chat.service.js.

export const createAiController = ({ getService, runKnowledgeSync }) => {
  const handle = (work) => async (req, res, next) => {
    try {
      await work(req, res, getService());
    } catch (error) {
      next(error);
    }
  };

  return {
    chat: handle(async (req, res, service) => {
      const { actor, accessToken } = req.ai;
      const data = await service.chat({ actor, accessToken, ...req.body });
      res.json({ success: true, data });
    }),

    confirmAction: handle(async (req, res, service) => {
      const { actor, accessToken } = req.ai;
      const data = await service.confirmAction({ actor, accessToken, actionId: req.validated.params.actionId });
      res.json({ success: true, data });
    }),

    cancelAction: handle(async (req, res, service) => {
      const data = await service.cancelAction({ actor: req.ai.actor, actionId: req.validated.params.actionId });
      res.json({ success: true, data });
    }),

    getConversation: handle(async (req, res, service) => {
      const data = await service.getConversation({
        actor: req.ai.actor,
        conversationId: req.validated.params.conversationId,
      });
      res.json({ success: true, data });
    }),

    listTraces: handle(async (req, res, service) => {
      const query = req.validated.query;
      const { items, total } = await service.listTraces(query);
      res.json({
        success: true,
        data: items,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      });
    }),

    getTrace: handle(async (req, res, service) => {
      res.json({ success: true, data: await service.getTrace(req.validated.params.traceId) });
    }),

    syncKnowledge: handle(async (req, res) => {
      res.json({ success: true, data: await runKnowledgeSync(req.body) });
    }),
  };
};
