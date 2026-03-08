import { API_ENDPOINTS } from '../constants/endpoints';
import { api } from './api';

export type CreateCheckoutSessionResponse = {
  session_id: string;
  checkout_url?: string;
  amount_total: number;
  ticket_price_total?: number;
  service_fee_total?: number;
  currency: string;
  quantity: number;
};

export type ConfirmCheckoutSessionResponse = {
  paid: boolean;
  order_status: 'created' | 'paid' | 'cancelled' | 'failed';
  reservation?: any;
};

export type CreatePaymentSheetIntentResponse = {
  payment_intent_id: string;
  payment_intent_client_secret: string;
  stripe_account_id: string;
  amount_total: number;
  ticket_price_total?: number;
  service_fee_total?: number;
  currency: string;
  quantity: number;
};

export async function createCheckoutSession(params: {
  event_id: string;
  quantity?: number;
}): Promise<CreateCheckoutSessionResponse> {
  const { data } = await api.post<CreateCheckoutSessionResponse>(
    API_ENDPOINTS.PAYMENTS.CREATE_CHECKOUT_SESSION,
    params,
  );
  return data;
}

export async function confirmCheckoutSession(
  sessionId: string,
): Promise<ConfirmCheckoutSessionResponse> {
  const { data } = await api.get<ConfirmCheckoutSessionResponse>(
    API_ENDPOINTS.PAYMENTS.CONFIRM_CHECKOUT_SESSION(sessionId),
  );
  return data;
}

export async function createPaymentSheetIntent(params: {
  event_id: string;
  quantity?: number;
}): Promise<CreatePaymentSheetIntentResponse> {
  const { data } = await api.post<CreatePaymentSheetIntentResponse>(
    API_ENDPOINTS.PAYMENTS.CREATE_PAYMENT_SHEET_INTENT,
    params,
  );
  return data;
}

export async function confirmPaymentIntent(
  paymentIntentId: string,
): Promise<ConfirmCheckoutSessionResponse> {
  const { data } = await api.post<ConfirmCheckoutSessionResponse>(
    API_ENDPOINTS.PAYMENTS.CONFIRM_PAYMENT_INTENT(paymentIntentId),
  );
  return data;
}

export type VenueTransaction = {
  id: string;
  user_id: string;
  event_id: string;
  reservation_id?: string | null;
  status: 'created' | 'paid' | 'cancelled' | 'failed';
  quantity: number;
  amount_total: number;
  currency: string;
  stripe_payment_intent?: string | null;
  stripe_session_id?: string | null;
  paid_at?: string | null;
  created_at: string;
  ticket_amount?: number;
  refundable_remaining?: number;
  refunded_amount?: number;
  refunded_currency?: string;
  refunded_status?: 'none' | 'partial' | 'full';
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  event?: {
    id: string;
    venue_id: string;
    name: string;
    date: string;
  };
};

export type RefundVenueOrderResponse = {
  order_id: string;
  refund_id: string | null;
  refund_status: string;
  refunded_amount: number;
  currency: string;
  full_refund: boolean;
  ticket_amount?: number;
  refundable_remaining?: number;
  policy?: 'ticket_only';
};

export type RefundVenueOrdersBulkResponse = {
  total: number;
  success: number;
  failed: number;
  policy: 'ticket_only';
  results: Array<
    | {
        ok: true;
        order_id: string;
        data: RefundVenueOrderResponse;
      }
    | {
        ok: false;
        order_id: string;
        error: string;
      }
  >;
};

export async function fetchVenueTransactions(limit = 50): Promise<VenueTransaction[]> {
  const { data } = await api.get<VenueTransaction[]>(API_ENDPOINTS.PAYMENTS.VENUE_TRANSACTIONS, {
    params: { limit },
  });
  return Array.isArray(data) ? data : [];
}

export async function refundVenueOrder(params: {
  orderId: string;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}): Promise<RefundVenueOrderResponse> {
  const { data } = await api.post<RefundVenueOrderResponse>(
    API_ENDPOINTS.PAYMENTS.VENUE_ORDER_REFUND(params.orderId),
    {
      reason: params.reason,
    },
  );
  return data;
}

export async function refundVenueOrdersBulk(params: {
  orderIds: string[];
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}): Promise<RefundVenueOrdersBulkResponse> {
  const { data } = await api.post<RefundVenueOrdersBulkResponse>(
    API_ENDPOINTS.PAYMENTS.VENUE_ORDERS_REFUND_BULK,
    {
      order_ids: params.orderIds,
      reason: params.reason,
    },
  );
  return data;
}
