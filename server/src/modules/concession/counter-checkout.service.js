import crypto, { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import {
  consumeStock,
  reserveStock,
} from "../inventory/stock-reservation.service.js";
import { readSellableStock } from "../inventory/stock-read.service.js";
import {
  PAYMENT_ATTEMPT_STATUS,
  PAYMENT_STATUS,
} from "../payment/payment.constants.js";
import { ConcessionOrder } from "./order.model.js";
import { getCombo, getConcession } from "./concession.service.js";

const invalid = (
  message,
  code = "INVALID_COUNTER_CONCESSION_ORDER",
  status = 400,
) => new AppError(status, message, [], code);
const attemptId = (now) =>
  `ATT-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
const serializeOrder = (order) => ({
  orderId: String(order._id),
  orderCode: order.orderCode,
  branchId: String(order.branchId),
  status: order.status,
  paymentStatus: order.paymentStatus,
  pickupStatus: order.pickupStatus,
  totalAmount: order.totalAmount,
  paidAt: order.paidAt ?? null,
  items: order.items.map((line) => ({
    itemType: line.itemType,
    itemId: String(line.itemId),
    name: line.name,
    size: line.size ?? null,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    subtotal: line.subtotal,
  })),
});
const serializePayment = (payment) => ({
  paymentId: String(payment._id),
  orderId: String(payment.orderId),
  amount: payment.amount,
  currency: payment.currency,
  method: payment.method,
  status: payment.status,
  paidAt: payment.paidAt ?? null,
  activeAttempt: payment.attempts.at(-1),
});

const priceSelection = async ({ branchId, items }) => {
  const requirements = new Map();
  const lines = [];
  for (const selected of items) {
    const item =
      selected.itemType === "COMBO"
        ? await getCombo(selected.itemId, { branchId })
        : await getConcession(selected.itemId, { branchId });
    if (!item?.available)
      throw invalid(
        "Some selected food is no longer available",
        "INSUFFICIENT_CONCESSION_STOCK",
        409,
      );
    const components =
      selected.itemType === "COMBO"
        ? item.items.map((part) => ({
            concessionId: part.concessionId,
            quantity: part.quantity,
          }))
        : [{ concessionId: selected.itemId, quantity: 1 }];
    for (const component of components) {
      requirements.set(
        component.concessionId,
        (requirements.get(component.concessionId) ?? 0) +
          component.quantity * selected.quantity,
      );
    }
    const subtotal = item.price * selected.quantity;
    if (!Number.isSafeInteger(subtotal))
      throw invalid("Invalid concession total");
    lines.push({
      itemType: selected.itemType,
      itemId: selected.itemId,
      name: item.name,
      size: item.size ?? null,
      unitPrice: item.price,
      quantity: selected.quantity,
      subtotal,
      components,
    });
  }
  const stock = await readSellableStock({
    branchId,
    concessionIds: [...requirements.keys()],
  });
  if (
    [...requirements].some(
      ([id, quantity]) => (stock.get(id)?.quantity ?? 0) < quantity,
    )
  )
    throw invalid(
      "Some selected food is no longer available",
      "INSUFFICIENT_CONCESSION_STOCK",
      409,
    );
  return {
    lines,
    requirements: [...requirements].map(([concessionId, quantity]) => ({
      concessionId,
      quantity,
    })),
    totalAmount: lines.reduce((sum, line) => sum + line.subtotal, 0),
  };
};

export const createCounterConcessionCheckoutService = ({
  paymentRepository,
  gateway,
  clientUrl = () => "http://localhost:5173",
  now = () => new Date(),
}) => ({
  async createOrder({
    staffId,
    branchId,
    items,
    method,
    idempotencyKey,
    tenderedAmount,
  }) {
    const existing =
      await paymentRepository.findByAttemptIdempotencyKey(idempotencyKey);
    if (existing) {
      if (
        !existing.orderId ||
        String(existing.customerAccountId) !== String(staffId)
      )
        throw invalid(
          "Idempotency key was used for another sale",
          "PAYMENT_IDEMPOTENCY_KEY_REUSED",
          409,
        );
      const order = await ConcessionOrder.findById(existing.orderId).lean();
      return {
        idempotent: true,
        order: serializeOrder(order),
        payment: serializePayment(existing),
      };
    }

    const quote = await priceSelection({ branchId, items });
    if (
      method === "CASH" &&
      (!Number.isSafeInteger(tenderedAmount) ||
        tenderedAmount < quote.totalAmount)
    )
      throw invalid(
        "Cash received is less than the amount due",
        "PAYMENT_AMOUNT_MISMATCH",
      );

    const current = now();
    const expiresAt = new Date(current.getTime() + 15 * 60 * 1000);
    return paymentRepository.withTransaction(async (session) => {
      const orderId = new mongoose.Types.ObjectId();
      await reserveStock({
        orderId,
        ownerId: staffId,
        branchId,
        items: quote.requirements,
        expiresAt,
        now: current,
        session,
      });
      const payableReference = `FD-${randomUUID().replaceAll("-", "").toUpperCase()}`;
      const paymentAttemptId = attemptId(current);
      const baseUrl = String(clientUrl()).replace(/\/+$/, "");
      const instruction = await gateway.createAttemptInstruction({
        attemptId: paymentAttemptId,
        attemptNumber: 1,
        payableReference,
        method,
        amount: quote.totalAmount,
        currency: "VND",
        expiresAt,
        returnUrl: `${baseUrl}/staff/concessions`,
        cancelUrl: `${baseUrl}/staff/concessions`,
      });
      const cash = method === "CASH";
      const [createdOrder] = await ConcessionOrder.create(
        [
          {
            _id: orderId,
            orderCode: payableReference,
            createdByStaffId: staffId,
            branchId,
            type: "COUNTER",
            items: quote.lines,
            totalAmount: quote.totalAmount,
            expiresAt,
            status: cash ? "CONFIRMED" : "PENDING_PAYMENT",
            paymentStatus: cash ? "PAID" : "PENDING",
            pickupStatus: cash ? "AWAITING_PICKUP" : "NOT_READY",
            paidAt: cash ? current : null,
          },
        ],
        { session },
      );
      const payment = await paymentRepository.create(
        {
          orderId,
          payableReference,
          customerAccountId: staffId,
          gatewayTransactionId: instruction.gatewayTransactionRef,
          method,
          amount: quote.totalAmount,
          currency: "VND",
          status: cash ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING,
          paidAt: cash ? current : null,
          settlementAttemptId: cash ? paymentAttemptId : null,
          settlementReference: cash ? instruction.gatewayTransactionRef : null,
          expiresAt,
          attempts: [
            {
              attemptId: paymentAttemptId,
              attemptNumber: 1,
              idempotencyKey,
              provider: instruction.provider,
              method,
              amount: quote.totalAmount,
              currency: "VND",
              status: cash
                ? PAYMENT_ATTEMPT_STATUS.SUCCEEDED
                : PAYMENT_ATTEMPT_STATUS.PENDING,
              gatewayTransactionRef: instruction.gatewayTransactionRef,
              qrPayload: instruction.qrPayload,
              instruction,
              expiresAt,
              createdAt: current,
              completedAt: cash ? current : null,
            },
          ],
          processedNotificationKeys: cash
            ? [`counter-cash:${paymentAttemptId}`]
            : [],
        },
        session,
      );
      if (cash)
        await consumeStock({
          orderId,
          now: current,
          session,
          source: "COUNTER_POS",
        });
      const order = await ConcessionOrder.findByIdAndUpdate(
        orderId,
        { $set: { paymentId: payment._id } },
        { new: true, session },
      ).lean();
      return {
        idempotent: false,
        order: serializeOrder(order ?? createdOrder.toObject()),
        payment: serializePayment(payment),
      };
    });
  },

  async confirmQr({ staffId, orderId, simulated = false }) {
    const pendingOrder = await ConcessionOrder.findOne({
      _id: orderId,
      type: "COUNTER",
      createdByStaffId: staffId,
    }).lean();
    if (!pendingOrder)
      throw invalid(
        "Counter concession order not found",
        "CONCESSION_ORDER_NOT_FOUND",
        404,
      );
    const pendingPayment = await paymentRepository.findByPayableReference(
      pendingOrder.orderCode,
    );
    const pendingAttempt = pendingPayment?.attempts?.at(-1);
    if (simulated && pendingAttempt?.provider === "PAYOS") {
      try {
        await gateway.cancelAttempt(pendingAttempt, "SETTLED_BY_SIMULATION");
      } catch (error) {
        console.warn(
          "Could not close payOS link after counter demo settlement:",
          error.message,
        );
      }
    } else if (
      pendingPayment?.status !== PAYMENT_STATUS.PAID &&
      pendingAttempt?.provider === "PAYOS"
    ) {
      const providerResult = await gateway.getAttemptStatus(pendingAttempt);
      if (
        providerResult.status !== "PAID" ||
        providerResult.amountPaid < pendingPayment.amount
      ) {
        throw invalid(
          "The bank transfer is still pending",
          "PAYMENT_ATTEMPT_NOT_PENDING",
          409,
        );
      }
    }
    return paymentRepository.withTransaction(async (session) => {
      const order = await ConcessionOrder.findOne({
        _id: orderId,
        type: "COUNTER",
        createdByStaffId: staffId,
      })
        .session(session)
        .lean();
      if (!order)
        throw invalid(
          "Counter concession order not found",
          "CONCESSION_ORDER_NOT_FOUND",
          404,
        );
      const payment = await paymentRepository.findByPayableReference(
        order.orderCode,
        session,
      );
      if (payment?.status === PAYMENT_STATUS.PAID)
        return {
          idempotent: true,
          order: serializeOrder(order),
          payment: serializePayment(payment),
        };
      const current = now();
      if (
        !payment ||
        order.status !== "PENDING_PAYMENT" ||
        order.expiresAt <= current
      )
        throw invalid(
          "This concession sale expired",
          "CONCESSION_ORDER_EXPIRED",
          409,
        );
      if (
        !(await consumeStock({
          orderId: order._id,
          now: current,
          session,
          source: "COUNTER_POS",
        }))
      )
        throw invalid(
          "Some selected food is no longer available",
          "INSUFFICIENT_CONCESSION_STOCK",
          409,
        );
      const active = payment.attempts.at(-1);
      const attempts = payment.attempts.map((attempt) =>
        attempt.attemptId === active.attemptId
          ? {
              ...attempt,
              status: PAYMENT_ATTEMPT_STATUS.SUCCEEDED,
              completedAt: current,
              notificationKey: `${simulated ? "counter-demo" : "counter-qr"}:${active.attemptId}`,
            }
          : attempt,
      );
      const paidPayment = await paymentRepository.saveState(
        payment._id,
        {
          status: PAYMENT_STATUS.PAID,
          paidAt: current,
          settlementAttemptId: active.attemptId,
          settlementReference: active.gatewayTransactionRef,
          attempts,
          processedNotificationKeys: [
            `${simulated ? "counter-demo" : "counter-qr"}:${active.attemptId}`,
          ],
          ...(simulated
            ? { gatewayResponse: { simulatedSettlement: true } }
            : {}),
        },
        { status: PAYMENT_STATUS.PENDING },
        session,
      );
      const paidOrder = await ConcessionOrder.findByIdAndUpdate(
        order._id,
        {
          $set: {
            status: "CONFIRMED",
            paymentStatus: "PAID",
            pickupStatus: "AWAITING_PICKUP",
            paidAt: current,
          },
        },
        { new: true, session },
      ).lean();
      return {
        idempotent: false,
        order: serializeOrder(paidOrder),
        payment: serializePayment(paidPayment),
      };
    });
  },
});
