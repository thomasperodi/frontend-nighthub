import { API_ENDPOINTS } from '../constants/endpoints';
import { api } from './api';

export type CreateCheckoutSessionResponse = {
  session_id: string;
  checkout_url?: string;
  amount_total: number;
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
