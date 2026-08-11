import { createPrivateKey, createPublicKey, createSign, createVerify } from 'node:crypto';

const PAYMENT_PROVIDER_CODES = ['wechat_pay', 'alipay', 'offline_bank_transfer'];
const DEFAULT_ALIPAY_GATEWAY = 'https://openapi.alipay.com/gateway.do';
const DEFAULT_ALIPAY_NOTIFY_URL = 'https://sales-improve.netlify.app/api/payments/alipay/notify';
const DEFAULT_ALIPAY_RETURN_URL = 'https://sales-improve.fpmatrix.cn/plans?payment=alipay';

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

const unquote = (value = '') => {
  const text = String(value || '').trim().replaceAll('\\n', '\n');
  if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
    return text.slice(1, -1).trim();
  }
  return text;
};

const privateKeyObject = (value = '') => {
  const source = unquote(value);
  if (!source) throw new Error('missing_alipay_app_private_key');
  if (source.includes('-----BEGIN')) return createPrivateKey(source);
  const der = Buffer.from(source.replace(/\s+/g, ''), 'base64');
  try {
    return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  } catch {
    return createPrivateKey({ key: der, format: 'der', type: 'pkcs1' });
  }
};

const publicKeyObject = (value = '') => {
  const source = unquote(value);
  if (!source) throw new Error('missing_alipay_public_key');
  if (source.includes('-----BEGIN')) return createPublicKey(source);
  const der = Buffer.from(source.replace(/\s+/g, ''), 'base64');
  try {
    return createPublicKey({ key: der, format: 'der', type: 'spki' });
  } catch {
    return createPublicKey({ key: der, format: 'der', type: 'pkcs1' });
  }
};

const alipayTimestamp = (date = new Date()) => {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
};

export const alipayCanonicalString = (params = {}, { excludeSignType = true } = {}) => Object.entries(params)
  .filter(([key, value]) => key !== 'sign' && (!excludeSignType || key !== 'sign_type') && value !== undefined && value !== null && String(value) !== '')
  .sort(([left], [right]) => (left < right ? -1 : (left > right ? 1 : 0)))
  .map(([key, value]) => `${key}=${String(value)}`)
  .join('&');

export const signAlipayParams = (params = {}, privateKey = '') => {
  const signer = createSign('RSA-SHA256');
  signer.update(alipayCanonicalString(params, { excludeSignType: false }), 'utf8');
  signer.end();
  return signer.sign(privateKeyObject(privateKey), 'base64');
};

export const verifyAlipayParams = (params = {}, publicKey = '') => {
  const signature = String(params.sign || '').trim();
  if (!signature) return false;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(alipayCanonicalString(params), 'utf8');
  verifier.end();
  try {
    return verifier.verify(publicKeyObject(publicKey), signature, 'base64');
  } catch {
    return false;
  }
};

const amountFenFromYuan = (value = '') => {
  const match = String(value || '').trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return 0;
  const yuan = Number(match[1]);
  const cents = Number(String(match[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(yuan) || yuan < 0) return 0;
  const fen = yuan * 100 + cents;
  return Number.isSafeInteger(fen) ? fen : 0;
};

const httpsUrl = (value = '', fallback = '') => {
  try {
    const url = new URL(String(value || fallback));
    if (url.protocol !== 'https:') throw new Error('https_required');
    return url.toString();
  } catch {
    return fallback;
  }
};

const alipayAdapter = ({ envValue = () => '', configured = false } = {}) => {
  const appId = envValue('ALIPAY_APP_ID');
  const appPrivateKey = envValue('ALIPAY_APP_PRIVATE_KEY');
  const alipayPublicKey = envValue('ALIPAY_PUBLIC_KEY');
  const sellerId = envValue('ALIPAY_SELLER_ID');
  const gateway = httpsUrl(envValue('ALIPAY_GATEWAY_URL'), DEFAULT_ALIPAY_GATEWAY);
  const notifyUrl = httpsUrl(envValue('ALIPAY_NOTIFY_URL'), DEFAULT_ALIPAY_NOTIFY_URL);
  const returnUrl = httpsUrl(envValue('ALIPAY_RETURN_URL'), DEFAULT_ALIPAY_RETURN_URL);
  let keysReady = false;
  if (configured) {
    try {
      privateKeyObject(appPrivateKey);
      publicKeyObject(alipayPublicKey);
      keysReady = true;
    } catch {
      keysReady = false;
    }
  }

  return {
    is_live: keysReady,
    createIntent({ paymentId = '', order = {} } = {}) {
      if (!configured) return { ok: false, error: 'provider_not_configured' };
      if (!keysReady) return { ok: false, error: 'invalid_alipay_key_configuration' };
      const amountFen = Number(order.amount_fen || 0);
      if (!paymentId || !Number.isInteger(amountFen) || amountFen < 1) return { ok: false, error: 'invalid_payment_order' };
      try {
        const common = {
          app_id: appId,
          method: 'alipay.trade.page.pay',
          format: 'JSON',
          charset: 'utf-8',
          sign_type: 'RSA2',
          timestamp: alipayTimestamp(),
          version: '1.0',
          notify_url: notifyUrl,
          return_url: returnUrl,
          biz_content: JSON.stringify({
            out_trade_no: paymentId,
            product_code: 'FAST_INSTANT_TRADE_PAY',
            total_amount: (amountFen / 100).toFixed(2),
            subject: `获客罗盘 ${String(order.plan_name || '套餐').slice(0, 80)}`,
            body: `订单号 ${String(order.order_no || '').slice(0, 64)}`,
            timeout_express: '30m',
          }),
        };
        const sign = signAlipayParams(common, appPrivateKey);
        const url = new URL(gateway);
        Object.entries({ ...common, sign }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
        return {
          ok: true,
          provider_payment_id: paymentId,
          status: 'awaiting_payment',
          client_action: { type: 'redirect', url: url.toString(), expires_in_seconds: 1800 },
        };
      } catch {
        return { ok: false, error: 'alipay_signing_failed' };
      }
    },
    verifyNotification({ payload = {} } = {}) {
      if (!configured) return { ok: false, error: 'provider_not_configured' };
      if (!verifyAlipayParams(payload, alipayPublicKey)) return { ok: false, error: 'invalid_alipay_signature' };
      if (String(payload.app_id || '') !== String(appId)) return { ok: false, error: 'alipay_app_id_mismatch' };
      if (sellerId && String(payload.seller_id || '') !== String(sellerId)) return { ok: false, error: 'alipay_seller_id_mismatch' };
      const tradeStatus = String(payload.trade_status || '').toUpperCase();
      if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(tradeStatus)) return { ok: false, error: 'unsupported_trade_state' };
      const paymentId = String(payload.out_trade_no || '').trim();
      const eventId = String(payload.notify_id || `${payload.trade_no || paymentId}:${tradeStatus}`).trim();
      const amountFen = amountFenFromYuan(payload.total_amount);
      const providerTransactionId = String(payload.trade_no || '').trim();
      if (!/^pay_[a-z0-9]+$/i.test(paymentId) || !eventId || !providerTransactionId || amountFen < 1) {
        return { ok: false, error: 'invalid_alipay_notification' };
      }
      return {
        ok: true,
        event_id: eventId.slice(0, 128),
        payment_id: paymentId.slice(0, 128),
        amount_fen: amountFen,
        provider_transaction_id: providerTransactionId.slice(0, 160),
        provider_app_id: String(payload.app_id || '').slice(0, 64),
        provider_seller_id: String(payload.seller_id || '').slice(0, 64),
        trade_status: tradeStatus,
      };
    },
  };
};

export const paymentAdapterFor = ({ provider = '', envValue = () => '', sandboxEnabled = false, sandboxToken = '' } = {}) => {
  const code = normalizePaymentProvider(provider);
  const configured = configuredFor(code, envValue);
  const sandbox = Boolean(sandboxEnabled && String(sandboxToken || '').length >= 16 && code !== 'offline_bank_transfer');
  const liveAlipay = code === 'alipay' && !sandbox ? alipayAdapter({ envValue, configured }) : null;

  return {
    provider: code,
    provider_name: providerName(code),
    configured,
    mode: sandbox ? 'sandbox_mock' : (liveAlipay?.is_live ? 'live' : (code === 'alipay' && configured ? 'invalid_configuration' : (configured ? 'provider_not_implemented' : 'not_configured'))),
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
      if (liveAlipay) return liveAlipay.createIntent({ paymentId, order });
      return {
        ok: false,
        error: configured ? 'provider_adapter_not_enabled' : 'provider_not_configured',
      };
    },
    verifyNotification({ headers = new Headers(), payload = {} } = {}) {
      if (liveAlipay) return liveAlipay.verifyNotification({ payload });
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
        mode: sandbox ? 'sandbox_mock' : (liveAlipay?.is_live ? 'live_callback_authoritative' : (configured ? 'provider_not_implemented' : 'not_configured')),
      };
    },
  };
};
