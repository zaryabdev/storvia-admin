// Order payment (separate from order status): labels, the paid badge and the
// rules of PATCH /api/:storeId/orders/:orderId/payment. Pure functions, no
// Prisma or React, shared by the route and the Orders UI. Payment never
// changes status, stock, confirmedAt, sales, metrics or billing.
// Rules: DECISIONS.md → Bank transfer and mobile wallet payments.

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: "Cash on Delivery",
  BANK_TRANSFER: "Bank transfer",
};

// What a checkout or a merchant may choose. STRIPE is a legacy value only.
export const CHECKOUT_PAYMENT_METHODS = ["COD", "BANK_TRANSFER"] as const;
export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number];

export const isCheckoutPaymentMethod = (value: unknown): value is CheckoutPaymentMethod =>
  typeof value === "string" && (CHECKOUT_PAYMENT_METHODS as readonly string[]).includes(value);

// POST /checkout body shape, checked before the /cod validation: the payment
// method, or the plain-text 400 message. `body` is the parsed JSON (undefined
// when it didn't parse).
export function readCheckoutPaymentMethod(
  body: unknown,
): { paymentMethod: CheckoutPaymentMethod } | { error: "Invalid request body" | "Choose a payment method" } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request body" };

  const paymentMethod = (body as Record<string, unknown>).paymentMethod;
  return isCheckoutPaymentMethod(paymentMethod) ? { paymentMethod } : { error: "Choose a payment method" };
}

// "How did you receive the money?", in dialog order.
export const PAYMENT_RECEIVED_VIA = [
  { value: "BANK_TRANSFER", label: "Bank transfer / Raast" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "EASYPAISA", label: "Easypaisa" },
  { value: "CASH", label: "Cash to delivery rider" },
  { value: "OTHER", label: "Other" },
] as const;
export type PaymentReceivedViaValue = (typeof PAYMENT_RECEIVED_VIA)[number]["value"];

export const isPaymentReceivedVia = (value: unknown): value is PaymentReceivedViaValue =>
  PAYMENT_RECEIVED_VIA.some((option) => option.value === value);

export const receivedViaLabel = (value: string | null | undefined) =>
  PAYMENT_RECEIVED_VIA.find((option) => option.value === value)?.label ?? null;

export type PaymentBadge = { kind: "awaiting"; text: string } | { kind: "paid"; text: string } | null;

// Bank transfer orders only: "Awaiting payment" or "Paid · via JazzCash". COD
// (and legacy) orders have no badge.
export function paymentBadge(order: {
  paymentMethod: string;
  isPaid: boolean;
  paymentReceivedVia: string | null;
}): PaymentBadge {
  if (order.paymentMethod !== "BANK_TRANSFER") return null;
  if (!order.isPaid) return { kind: "awaiting", text: "Awaiting payment" };

  const via = receivedViaLabel(order.paymentReceivedVia);
  return { kind: "paid", text: via ? `Paid · via ${via}` : "Paid" };
}

// Statuses in which the payment method may still change (and only while unpaid).
const METHOD_CHANGE_STATUSES = ["DRAFT", "CONFIRMED"] as const;

// Whether "Change payment method" may switch this order to `target` (UI).
export function canChangePaymentMethod(
  order: { status: string; paymentMethod: string; isPaid: boolean },
  target: CheckoutPaymentMethod,
  bankTransferAvailable: boolean,
): boolean {
  return (
    order.paymentMethod !== target &&
    !order.isPaid &&
    (METHOD_CHANGE_STATUSES as readonly string[]).includes(order.status) &&
    (target !== "BANK_TRANSFER" || bankTransferAvailable)
  );
}

// ---------------------------------------------------------------------------
// PATCH planner

export const PAYMENT_ACTIONS = ["MARK_PAID", "MARK_UNPAID", "CHANGE_METHOD"] as const;
export type PaymentAction = (typeof PAYMENT_ACTIONS)[number];

type OrderStatusValue = "DRAFT" | "CONFIRMED" | "DELIVERED" | "CANCELED";
type PaymentMethodValue = "STRIPE" | "COD" | "BANK_TRANSFER";

export interface OrderPaymentState {
  status: OrderStatusValue;
  paymentMethod: PaymentMethodValue;
  isPaid: boolean;
  paidAt: Date | null;
  paymentReceivedVia: PaymentReceivedViaValue | null;
}

export type PaymentPlan =
  | { kind: "error"; status: 400 | 409; error: string; message: string }
  | { kind: "noop" }
  | {
      kind: "update";
      /** Compare-and-set: the current values this update depends on. */
      where: {
        paymentMethod?: PaymentMethodValue;
        isPaid?: boolean;
        paymentReceivedVia?: PaymentReceivedViaValue | null;
        status?: { in: OrderStatusValue[] };
      };
      data: {
        isPaid?: boolean;
        paidAt?: Date | null;
        paymentReceivedVia?: PaymentReceivedViaValue | null;
        paymentMethod?: CheckoutPaymentMethod;
      };
    };

const fail = (status: 400 | 409, error: string, message: string): PaymentPlan => ({
  kind: "error",
  status,
  error,
  message,
});

// What a payment PATCH body does to an order in its current state. The route
// runs an "update" as a conditional updateMany; a miss is a lost race (409).
export function planPaymentUpdate(
  current: OrderPaymentState,
  body: unknown,
  { bankTransferAvailable, now }: { bankTransferAvailable: boolean; now: Date },
): PaymentPlan {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail(400, "INVALID_REQUEST", "Invalid request body.");
  }

  const input = body as Record<string, unknown>;

  switch (input.action) {
    case "MARK_PAID": {
      if (!isPaymentReceivedVia(input.receivedVia)) {
        return fail(400, "INVALID_RECEIVED_VIA", "Choose how you received the money.");
      }
      if (current.paymentMethod !== "BANK_TRANSFER") {
        return fail(409, "NOT_BANK_TRANSFER", "Only bank transfer orders can be marked paid.");
      }
      if (current.isPaid && current.paymentReceivedVia === input.receivedVia) return { kind: "noop" };

      // Already paid, another channel: correct the channel, keep the original paidAt.
      if (current.isPaid) {
        return {
          kind: "update",
          where: { paymentMethod: "BANK_TRANSFER", isPaid: true, paymentReceivedVia: current.paymentReceivedVia },
          data: { paymentReceivedVia: input.receivedVia },
        };
      }

      return {
        kind: "update",
        where: { paymentMethod: "BANK_TRANSFER", isPaid: false, paymentReceivedVia: current.paymentReceivedVia },
        data: { isPaid: true, paidAt: now, paymentReceivedVia: input.receivedVia },
      };
    }

    case "MARK_UNPAID": {
      if (!current.isPaid && current.paidAt === null && current.paymentReceivedVia === null) {
        return { kind: "noop" };
      }

      return {
        kind: "update",
        where: { isPaid: current.isPaid, paymentReceivedVia: current.paymentReceivedVia },
        data: { isPaid: false, paidAt: null, paymentReceivedVia: null },
      };
    }

    case "CHANGE_METHOD": {
      const target = input.paymentMethod;

      if (!isCheckoutPaymentMethod(target)) {
        return fail(400, "INVALID_PAYMENT_METHOD", "Choose a payment method.");
      }
      if (current.paymentMethod === target) return { kind: "noop" };
      if (current.isPaid || !(METHOD_CHANGE_STATUSES as readonly string[]).includes(current.status)) {
        return fail(
          409,
          "PAYMENT_METHOD_LOCKED",
          "The payment method can only be changed on unpaid pending or confirmed orders.",
        );
      }
      if (target === "BANK_TRANSFER" && !bankTransferAvailable) {
        return fail(
          409,
          "BANK_TRANSFER_UNAVAILABLE",
          "Turn on bank transfer and add an account in Settings → Payments first.",
        );
      }

      return {
        kind: "update",
        where: {
          paymentMethod: current.paymentMethod,
          isPaid: false,
          status: { in: [...METHOD_CHANGE_STATUSES] },
        },
        data: { paymentMethod: target },
      };
    }

    default:
      return fail(400, "INVALID_ACTION", "Unknown payment action.");
  }
}
