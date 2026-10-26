import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { readCatalogConcessionsByIds } from "../inventory/concession-catalog.read-service.js";
import { readSellableStock } from "../inventory/stock-read.service.js";
import {
  reserveStock,
  consumeStock,
  releaseStock,
  releaseExpiredStock,
} from "../inventory/stock-reservation.service.js";
import { getBranchSummariesByIds } from "../branch/branch.service.js";
import { getCatalogCombo } from "./concession.repository.js";
import { parseComboRecipe } from "./concession.service.js";
import { ConcessionOrder } from "./order.model.js";
import {
  concessionQuoteSchema,
  concessionSelectionSchema,
} from "./checkout.validation.js";

const fail = (
  code = "CONCESSION_QUOTE_CHANGED",
  message = "The menu changed. Review your food selection again.",
) => new AppError(409, message, [], code);
export const selectionFingerprint = (selection) =>
  selection
    ? createHash("sha256")
        .update(
          JSON.stringify({
            quoteReference: selection.quoteReference,
            items: [...selection.items].sort((a, b) =>
              `${a.itemType}:${a.itemId}`.localeCompare(
                `${b.itemType}:${b.itemId}`,
              ),
            ),
          }),
        )
        .digest("hex")
    : undefined;
const eligible = (item) =>
  item?.status === "ACTIVE" &&
  typeof item.name === "string" &&
  Number.isSafeInteger(item.price) &&
  item.price >= 0;
const safeAmount = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) throw fail();
  return value;
};

export const serializeOrder = (order) =>
  order
    ? {
        orderId: String(order._id),
        orderCode: order.orderCode,
        branchId: String(order.branchId),
        status: order.status,
        paymentStatus: order.paymentStatus,
        pickupStatus: order.pickupStatus,
        totalAmount: order.totalAmount,
        items: order.items.map((line) => ({
          itemType: line.itemType,
          itemId: String(line.itemId),
          name: line.name,
          size: line.size ?? null,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          subtotal: line.subtotal,
        })),
      }
    : null;

// Runtime never creates indexes. The opt-in versioned migration must be applied first.
export const assertCheckoutStorage = async () => {
  const required = [
    ["orders", "uniq_concession_booking", { bookingId: 1 }, true],
    ["orders", "uniq_concession_order_code", { orderCode: 1 }, true],
    ["inventory_reservations", "uniq_reservation_order", { orderId: 1 }, true],
    [
      "inventory_reservations",
      "idx_reservation_expiry",
      { branchId: 1, status: 1, expiresAt: 1 },
      false,
    ],
    [
      "stock_transactions",
      "uniq_online_order_sale",
      { orderId: 1, concessionId: 1 },
      true,
    ],
    [
      "inventories",
      "uniq_inventory_branch_concession",
      { branchId: 1, concessionId: 1 },
      true,
    ],
  ];
  for (const [collection, name, key, unique] of required) {
    let indexes;
    try {
      indexes = await mongoose.connection.db
        .collection(collection)
        .listIndexes()
        .toArray();
    } catch (cause) {
      if (cause.code !== 26) throw cause;
      indexes = [];
    }
    if (
      !indexes.some(
        (index) =>
          index.name === name &&
          Boolean(index.unique) === unique &&
          JSON.stringify(index.key) === JSON.stringify(key),
      )
    )
      throw new AppError(
        503,
        "Food checkout is temporarily unavailable. You can still buy tickets without food.",
      );
  }
};

export const createConcessionCheckoutService = ({
  getLiveHold,
  getShowtime,
  clock = () => new Date(),
}) => {
  const quote = async ({
    ownerId,
    holdId,
    items,
    hold: suppliedHold,
    session,
    checkStock = true,
  }) => {
    const parsed = concessionQuoteSchema.safeParse({
      holdId: String(holdId),
      items,
    });
    if (!parsed.success)
      throw new AppError(
        400,
        "Invalid food selection",
        [],
        "INVALID_CONCESSION_SELECTION",
      );
    const now = clock();
    const hold =
      suppliedHold ?? (await getLiveHold({ ownerId, holdId, now, session }));
    if (
      !hold ||
      String(hold.ownerId) !== String(ownerId) ||
      hold.status !== "ACTIVE" ||
      new Date(hold.expiresAt) <= now
    )
      throw fail(
        "CONCESSION_CHECKOUT_EXPIRED",
        "Your seat reservation expired. Select seats again.",
      );
    const showtime = await getShowtime(hold.showtimeId, now);
    const branchId = showtime?.cinema?.id;
    if (
      !branchId ||
      (await getBranchSummariesByIds([String(branchId)])).get(String(branchId))
        ?.status !== "ACTIVE"
    )
      throw fail();
    const selection = [...parsed.data.items].sort((a, b) =>
      `${a.itemType}:${a.itemId}`.localeCompare(`${b.itemType}:${b.itemId}`),
    );
    const ids = new Set(
      selection.filter((i) => i.itemType === "CONCESSION").map((i) => i.itemId),
    );
    const combos = new Map();
    for (const item of selection.filter((i) => i.itemType === "COMBO")) {
      const combo = await getCatalogCombo(item.itemId);
      const recipe = parseComboRecipe(combo?.items);
      if (!combo || !recipe || recipe.length > 500) throw fail();
      combos.set(item.itemId, { ...combo, recipe });
      for (const line of recipe) ids.add(line.concessionId);
    }
    if (ids.size > 500)
      throw new AppError(
        400,
        "Too many combo components",
        [],
        "INVALID_CONCESSION_SELECTION",
      );
    const components = new Map(
      (await readCatalogConcessionsByIds([...ids])).map((item) => [
        String(item._id),
        item,
      ]),
    );
    const demand = new Map();
    const lines = selection.map((line) => {
      const item =
        line.itemType === "COMBO"
          ? combos.get(line.itemId)
          : components.get(line.itemId);
      if (!item || (line.itemType === "CONCESSION" && !eligible(item)))
        throw fail();
      const recipe =
        line.itemType === "COMBO"
          ? item.recipe
          : [{ concessionId: line.itemId, quantity: 1 }];
      for (const part of recipe) {
        if (!eligible(components.get(part.concessionId))) throw fail();
        demand.set(
          part.concessionId,
          safeAmount(
            (demand.get(part.concessionId) ?? 0) +
              part.quantity * line.quantity,
          ),
        );
      }
      return {
        itemType: line.itemType,
        itemId: line.itemId,
        name: item.name,
        size: item.size ?? null,
        unitPrice: item.price,
        quantity: line.quantity,
        subtotal: safeAmount(item.price * line.quantity),
        components: recipe,
      };
    });
    if (checkStock && ids.size) {
      const stock = await readSellableStock({
        branchId: String(branchId),
        concessionIds: [...ids],
        now,
      });
      if (
        [...demand].some(
          ([id, quantity]) => (stock.get(id)?.quantity ?? 0) < quantity,
        )
      )
        throw fail(
          "INSUFFICIENT_CONCESSION_STOCK",
          "Not enough food remains. Reduce quantities or continue without food.",
        );
    }
    const ticketAmount = safeAmount(hold.priceSnapshot?.totalAmount);
    const concessionAmount = safeAmount(
      lines.reduce((sum, line) => sum + line.subtotal, 0),
    );
    const data = {
      holdId: String(holdId),
      ownerId: String(ownerId),
      branchId: String(branchId),
      expiresAt: new Date(hold.expiresAt).toISOString(),
      ticketAmount,
      concessionAmount,
      amount: safeAmount(ticketAmount + concessionAmount),
      currency: "VND",
      items: lines,
    };
    if (!env.jwtAccessSecret)
      throw new Error("Quote signing key is not configured");
    const quoteReference = createHmac("sha256", env.jwtAccessSecret)
      .update(`concession-checkout:v1:${JSON.stringify(data)}`)
      .digest("hex");
    return {
      ...data,
      branchName: showtime.cinema.branchName ?? "Cinema",
      serverNow: now.toISOString(),
      quoteReference,
      requirements: [...demand].map(([concessionId, quantity]) => ({
        concessionId,
        quantity,
      })),
    };
  };
  const publicQuote = async (command) => {
    if (command.items?.length) await assertCheckoutStorage();
    const result = await quote(command);
    // Component quantities and stock counters are internal. Quote binds them without exposing them.
    const { requirements, ownerId, ...data } = result;
    void requirements;
    void ownerId;
    return {
      ...data,
      items: data.items.map(({ components, ...line }) => {
        void components;
        return line;
      }),
    };
  };
  const prepare = async ({ ownerId, holdId }) => {
    const hold = await getLiveHold({ ownerId, holdId, now: clock() });
    if (!hold || String(hold.ownerId) !== String(ownerId))
      throw fail("CONCESSION_CHECKOUT_EXPIRED");
    const showtime = await getShowtime(hold.showtimeId, clock());
    if (!showtime?.cinema?.id) throw fail();
    await releaseExpiredStock({ branchId: showtime.cinema.id, now: clock() });
  };
  const createPending = async ({
    bookingId,
    ownerId,
    hold,
    selection,
    session,
  }) => {
    const parsed = concessionSelectionSchema.safeParse(selection);
    if (!parsed.success)
      throw new AppError(
        400,
        "Invalid food selection",
        [],
        "INVALID_CONCESSION_SELECTION",
      );
    const current = await quote({
      ownerId,
      holdId: String(hold._id),
      items: selection.items,
      hold,
      session,
      checkStock: false,
    });
    if (
      !timingSafeEqual(
        Buffer.from(current.quoteReference),
        Buffer.from(selection.quoteReference),
      )
    )
      throw fail();
    const orderId = new mongoose.Types.ObjectId();
    await reserveStock({
      bookingId,
      orderId,
      ownerId,
      branchId: current.branchId,
      items: current.requirements,
      expiresAt: new Date(hold.expiresAt),
      now: clock(),
      session,
    });
    const [order] = await ConcessionOrder.create(
      [
        {
          _id: orderId,
          bookingId,
          customerAccountId: ownerId,
          branchId: current.branchId,
          orderCode: `FD-${randomUUID().replaceAll("-", "").toUpperCase()}`,
          type: "ONLINE",
          items: current.items,
          totalAmount: current.concessionAmount,
          expiresAt: hold.expiresAt,
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          pickupStatus: "NOT_READY",
        },
      ],
      { session },
    );
    return {
      amount: current.concessionAmount,
      order: serializeOrder(order.toObject()),
    };
  };
  const read = async (bookingId, session) =>
    serializeOrder(
      await ConcessionOrder.findOne({ bookingId })
        .session(session ?? null)
        .lean(),
    );
  const consume = async ({ bookingId, now, session }) => {
    const order = await ConcessionOrder.findOne({ bookingId })
      .session(session)
      .lean();
    if (!order) return false;
    if (order.status === "CONFIRMED") return true;
    if (
      order.status !== "PENDING_PAYMENT" ||
      order.expiresAt <= now ||
      !(await consumeStock({ orderId: order._id, now, session }))
    )
      return false;
    const update = await ConcessionOrder.updateOne(
      { _id: order._id, status: "PENDING_PAYMENT" },
      {
        $set: {
          status: "CONFIRMED",
          paymentStatus: "PAID",
          pickupStatus: "AWAITING_PICKUP",
        },
      },
      { session },
    );
    return update.modifiedCount === 1;
  };
  const release = async ({ bookingId, session }) => {
    const order = await ConcessionOrder.findOne({ bookingId })
      .session(session)
      .lean();
    if (!order) return;
    await releaseStock({ orderId: order._id, session });
    await ConcessionOrder.updateOne(
      { _id: order._id, status: "PENDING_PAYMENT" },
      { $set: { status: "EXPIRED" } },
      { session },
    );
  };
  return {
    quote: publicQuote,
    prepare,
    createPending,
    read,
    consume,
    release,
    assertReady: assertCheckoutStorage,
  };
};
