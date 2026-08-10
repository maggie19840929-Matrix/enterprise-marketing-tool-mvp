const PAYMENT_PROVIDER_CODES = ['wechat_pay', 'alipay', 'offline_bank_transfer'];

export const normalizePaymentProvider = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['wechat', 'wechatpay', 'wechat_pay'].includes(normalized)) return 'wechat_pay';
  if (['alipay', 'ali_pay'].includes(normalized)) return 'alipay';
  if (['offline', 'offline_bank_transfer', 'bank_transfer'].includes(normalized)) return 'offline_bank_transfer';
  return '';
};

export const paymentProviderCodes = () => [...PAYMENT_PROVIDER_CODES];

const configuredFor = (provider = '', envValue = () => '') => {
  if (provider === 'wechat_pay') {
    return Boolean(envValue('WECHATPAY_MCHID') && envValue('WECHATPAY_APPID') && envValue('WECHATPAY_API_V3_KEY'));
  }
  if (provider === 'alipay') {
    return Boolean(envValue('ALIPAY_APP_ID') && envValue('ALIPAY_APP_PRIVATE_KEY') && envValue('ALIPAY_PUBLIC_KEY'));
  }
  return false;
};

const providerName = (provider = '') => ({
  wechat_pay: '微信支付',
  alipay: '支付宝',
  offline_bank_transfer: '对公转账',
}[provider] || '未知渠道');

export const paymentAdapterFor = ({ provider = '', envValue = () => '', sandboxEnabled = false, sandboxToken = '' } = {}) => {
  const code = normalizePaymentProvider(provider);
  const configured = configuredFor(code, envValue);
  const sandbox = Boolean(sandboxEnabled && String(sandboxToken || '').length >= 16 && code !== 'offline_bank_transfer');

  return {
    provider: code,
    provider_name: providerName(code),
    configured,
    mode: sandbox ? 'sandbox_mock' : (configured ? 'provider_not_implemented' : 'not_configured'),
    createIntent({ paymentId = '', order = {} } = {}) {
      if (!code) return { ok: false, error: 'unsupported_payment_provider' };
      if (code === 'offline_bank_transfer') {
        return {
          ok: true,
          provider_payment_id: `offline_${paymentId}`,
          status: 'awaiting_transfer',
          client_action: { type: 'manual_contact' },
        };
      }
      if (sandbox) {
        return {
          ok: true,
          provider_payment_id: `sandbox_${code}_${paymentId}`,
          status: 'created',
          client_action: { type: 'internal_sandbox_only' },
          sandbox_reference: `sandbox:${order.order_no || paymentId}`,
        };
      }
      return {
        ok: false,
        error: configured ? 'provider_adapter_not_enabled' : 'provider_not_configured',
      };
    },
    verifyNotification({ headers = new Headers(), payload = {} } = {}) {
      if (!sandbox) return { ok: false, error: configured ? 'provider_notification_not_enabled' : 'provider_not_configured' };
      const receivedToken = String(headers.get('x-payment-sandbox-token') || '').trim();
      if (!receivedToken || receivedToken !== String(sandboxToken)) return { ok: false, error: 'invalid_sandbox_signature' };
      const eventId = String(payload.event_id || '').trim();
      const paymentId = String(payload.payment_id || '').trim();
      const amountFen = Number(payload.amount_fen);
      if (!eventId || !paymentId || !Number.isInteger(amountFen) || amountFen < 1) return { ok: false, error: 'invalid_notification_payload' };
      if (String(payload.trade_state || '').toUpperCase() !== 'SUCCESS') return { ok: false, error: 'unsupported_trade_state' };
      return {
        ok: true,
        event_id: eventId.slice(0, 128),
        payment_id: paymentId.slice(0, 128),
        amount_fen: amountFen,
        provider_transaction_id: String(payload.provider_transaction_id || `sandbox_txn_${eventId}`).slice(0, 160),
      };
    },
    query({ intent = {} } = {}) {
      return {
        ok: true,
        provider_status: String(intent.status || 'created'),
        provider_payment_id: String(intent.provider_payment_id || ''),
        mode: sandbox ? 'sandbox_mock' : (configured ? 'provider_not_implemented' : 'not_configured'),
      };
    },
  };
};
