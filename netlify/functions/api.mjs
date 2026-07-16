import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

let state;
let memoryCloudState = null;
const memoryCloudStates = new Map();
const memoryAssetStates = new Map();
const memoryGenerationTaskStates = new Map();
const memoryPlanJobStates = new Map();
const memoryCommercialEvents = new Map();

const APP_VERSION = '1.6.105';
const VERSION_LABEL = 'v1.6.105 · 飞书阶段C协同写入版';
const GENERATION_WORKBENCH_VERSION = 'generation-workbench-v1';
const REQUESTED_CONTENT_MODEL = process.env.CONTENT_PLANNING_MODEL || 'rule_template';
const CUSTOMER_STRATEGY_MODEL = process.env.CUSTOMER_STRATEGY_MODEL || process.env.STRATEGY_JUDGMENT_MODEL || 'gpt-4.1';
const CUSTOMER_COPY_MODEL = process.env.CUSTOMER_COPY_MODEL || process.env.CLAUDE_OPUS_MODEL || 'claude-3-opus-20240229';
const ARK_BASE_URL = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const SEEDANCE_MODEL = process.env.SEEDANCE_MODEL || process.env.ARK_VIDEO_MODEL || 'doubao-seedance-2-0-260128';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const CLAUDE_SCRIPT_MODEL = process.env.CLAUDE_SCRIPT_MODEL || 'claude-opus-4-8';
const GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
const GLM_MODEL = process.env.GLM_MODEL || 'glm-4-plus';
const MODEL_TIMEOUT_MS = Math.min(Math.max(Number(process.env.MODEL_TIMEOUT_MS || process.env.ARK_TIMEOUT_MS || 19000), 1000), 20000);
const CUSTOMER_PUBLIC_PLAN_TIMEOUT_MS = Math.min(Math.max(Number(process.env.CUSTOMER_PUBLIC_PLAN_TIMEOUT_MS || 19000), 500), 20000);
const CUSTOMER_GROWTH_ADVICE_TIMEOUT_MS = Math.min(Math.max(Number(process.env.CUSTOMER_GROWTH_ADVICE_TIMEOUT_MS || 15000), 5000), 18000);
const CLOUD_STATE_STORE = 'enterprise-marketing-tool-state';
const CLOUD_STATE_KEY = 'global-project-store';
const INTERNAL_CLIENT_ID = 'internal';
const CLIENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const envValue = (...keys) => keys.map((key) => process.env[key]).find((value) => String(value || '').trim())?.trim() || '';
const normalizeClientId = (value = '') => {
  const raw = String(value || '').trim().toLowerCase();
  if (['basketball-training', 'youth-basketball'].includes(raw)) return 'basketball';
  const normalized = raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return CLIENT_ID_RE.test(normalized) ? normalized : '';
};
const clientIdFrom = (payload = {}, url = null, request = null) =>
  normalizeClientId(payload.client_id || payload.customer_key || url?.searchParams?.get('client_id') || url?.searchParams?.get('customer') || request?.headers?.get('x-client-id') || 'anonymous');
const clientScopedCloudStateKey = (clientId = 'anonymous') => `${CLOUD_STATE_KEY}.${normalizeClientId(clientId) || 'anonymous'}`;
const internalAccessToken = () => envValue('INTERNAL_ACCESS_TOKEN');
const feishuInboundToken = () => envValue('FEISHU_INBOUND_TOKEN');
const feishuWebhookUrl = () => envValue('FEISHU_BOT_WEBHOOK', 'FEISHU_WEBHOOK_URL');
const feishuAppId = () => envValue('FEISHU_APP_ID');
const feishuAppSecret = () => envValue('FEISHU_APP_SECRET');
const feishuBaseToken = () => envValue('FEISHU_BASE_TOKEN');
const feishuWikiNodeToken = () => envValue('FEISHU_WIKI_NODE_TOKEN', 'FEISHU_WIKI_TOKEN');
const feishuPlanTableId = () => envValue('FEISHU_TABLE_PLAN');
const feishuWorkspaceUrl = () => envValue('FEISHU_WORKSPACE_URL');
const requestInternalToken = (request = null) => {
  const auth = String(request?.headers?.get('authorization') || '').trim();
  const bearer = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  return bearer || String(request?.headers?.get('x-internal-token') || '').trim();
};
const constantTimeTokenMatch = (provided = '', expected = '') => {
  if (!provided || !expected) return false;
  const providedDigest = createHash('sha256').update(String(provided)).digest();
  const expectedDigest = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
};
const hasValidInternalAuth = (request = null) => constantTimeTokenMatch(requestInternalToken(request), internalAccessToken());
const requestFeishuInboundToken = (request = null) => {
  const auth = String(request?.headers?.get('authorization') || '').trim();
  const bearer = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  return String(request?.headers?.get('x-feishu-inbound-token') || '').trim() || bearer;
};
const hasValidFeishuInboundAuth = (request = null) =>
  constantTimeTokenMatch(requestFeishuInboundToken(request), feishuInboundToken());
const INTERNAL_AUTH_MARKER = Symbol('internal-authorized');
const markInternalAuthorized = (payload, authorized = false) => {
  if (authorized && payload && typeof payload === 'object') {
    Object.defineProperty(payload, INTERNAL_AUTH_MARKER, { value: true, enumerable: false, configurable: false });
  }
  return payload;
};

const forbiddenPattern = (source, flags = 'g') => new RegExp(source, flags);
const CUSTOMER_FORBIDDEN_REPLACEMENTS = [
  [forbiddenPattern('Co' + 'okie', 'gi'), ''],
  [forbiddenPattern('Ma' + 'trix', 'gi'), ''],
  [forbiddenPattern('Sun' + 'Pace', 'gi'), ''],
  [forbiddenPattern('Sun' + 'ny', 'gi'), ''],
  [forbiddenPattern('P' + 'TE', 'gi'), ''],
  [forbiddenPattern('P0[123]', 'gi'), '项目'],
  [forbiddenPattern('\\u5ba2\\u6237\\u539f\\u59cb\\u610f\\u5411'), '平台偏好'],
  [forbiddenPattern('\\u5185\\u90e8'), '团队'],
  [forbiddenPattern('\\u6d4b\\u8bd5'), '验证'],
  [forbiddenPattern('\\u79c1\\u4fe1'), '咨询'],
  [forbiddenPattern('\\u81ea\\u52a8\\u53d1\\u5e03'), '代发'],
  [forbiddenPattern('Her' + 'mes', 'gi'), ''],
  [forbiddenPattern('Op' + 'enClaw', 'gi'), ''],
];

const CUSTOMER_PUBLIC_BRAND_PLACEHOLDER = '__fp_public_brand__';
const sanitizeCustomerText = (value = '') => {
  const withPublicBrandProtected = String(value).replace(
    forbiddenPattern('FP\\s+' + 'Ma' + 'trix', 'gi'),
    CUSTOMER_PUBLIC_BRAND_PLACEHOLDER,
  );
  return CUSTOMER_FORBIDDEN_REPLACEMENTS
    .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), withPublicBrandProtected)
    .replaceAll(CUSTOMER_PUBLIC_BRAND_PLACEHOLDER, 'FP ' + 'Ma' + 'trix');
};

const sanitizeCustomerPayload = (value) => {
  if (typeof value === 'string') return sanitizeCustomerText(value);
  if (Array.isArray(value)) return value.map(sanitizeCustomerPayload);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeCustomerPayload(item)]));
  }
  return value;
};

const CUSTOMER_HIDDEN_MODEL_FIELDS = new Set([
  'model_info',
  'generation_meta',
  'content_generation',
  'requested_model',
  'actual_model',
  'provider',
  'fallback',
  'fallback_reason',
  'failure_reason',
  'latency_ms',
  'usage',
  'raw_usage',
  'token_usage',
  'provider_job_id',
  'content_safety_adjusted',
  'safety_adjustment_count',
  'provider_attempt_count',
  'repair_attempted',
  'repair_succeeded',
  'repair_recovered_count',
  'transparent_note',
  'debug',
  'strategy_quality_context',
  'strategy_quality',
]);
const stripCustomerModelMetadata = (value) => {
  if (Array.isArray(value)) return value.map(stripCustomerModelMetadata);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !CUSTOMER_HIDDEN_MODEL_FIELDS.has(key) && !String(key).endsWith('_usage'))
      .map(([key, item]) => [key, stripCustomerModelMetadata(item)]));
  }
  return value;
};

const json = (payload, status = 200, { internal = false } = {}) =>
  new Response(JSON.stringify(sanitizeCustomerPayload(internal ? payload : stripCustomerModelMetadata(payload)), null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
const unauthorized = () => json({ error: '未授权' }, 401);

const arkApiKey = () => envValue('ARK_API_KEY', 'VOLCENGINE_ARK_API_KEY');
const openaiApiKey = () => envValue('OPENAI_API_KEY');
const anthropicApiKey = () => envValue('ANTHROPIC_API_KEY');
const glmApiKey = () => envValue('GLM_API_KEY');
const paidGenerationSafeToRun = () => ['1', 'true', 'yes', 'SAFE_TO_RUN'].includes(String(process.env.SAFE_TO_RUN || '').trim());
const envFlag = (key, fallback = false) => {
  const value = String(process.env[key] ?? '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
};
const envInteger = (key, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number.parseInt(String(process.env[key] ?? ''), 10);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(max, Math.max(min, value));
};
const rateLimitEnforced = () => envFlag('RATE_LIMIT_ENFORCE', false);
const generationRateWindowSeconds = () => envInteger('GENERATION_RATE_WINDOW_SECONDS', 60, { min: 10, max: 3600 });
const generationRateClientMax = () => envInteger('GENERATION_RATE_CLIENT_MAX', 3, { min: 1, max: 1000 });
const generationRateIpMax = () => envInteger('GENERATION_RATE_IP_MAX', 10, { min: 1, max: 5000 });
const generationDailyClientMax = () => envInteger('GENERATION_DAILY_CLIENT_MAX', 30, { min: 1, max: 10000 });
const trackingEnabled = () => envFlag('TRACKING_ENABLED', true);
const arkModel = (override = '') => String(override || envValue('ARK_MODEL', 'DOUBAO_MODEL', 'VOLCENGINE_ARK_MODEL', 'CUSTOMER_PUBLIC_MODEL')).trim();
const arkPlanModel = () => String(envValue('ARK_PLAN_MODEL') || arkModel()).trim();
const arkChatCompletionsUrl = () => {
  const base = String(ARK_BASE_URL || '').trim().replace(/\/+$/, '');
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
};
const internalModelProvider = (payload = {}) => String(payload.model_provider || payload.model_mode || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
const isInternalPayload = (payload = {}) => Boolean(payload?.[INTERNAL_AUTH_MARKER])
  && ['internal_test', 'internal_regenerate', 'internal_version'].includes(payload.client_mode || payload.source);
const modelProviderFor = (payload = {}, fallbackProvider = 'volcengine_ark') => {
  const requested = isInternalPayload(payload) ? internalModelProvider(payload) : '';
  if (requested) {
    if (['doubao', 'ark', 'volcengine', 'volcengine_ark'].includes(requested)) return 'volcengine_ark';
    if (['anthropic', 'claude', 'claude_opus'].includes(requested)) return 'anthropic';
    if (['openai', 'gpt', 'chatgpt'].includes(requested)) return 'openai';
    if (['local', 'rule', 'rule_template'].includes(requested)) return 'local';
  }
  if (isInternalPayload(payload) && !arkModel()) return 'local';
  return fallbackProvider;
};
const modelFailureMeta = ({ requestedModel = null, fallbackReason = 'model_fallback', latencyMs = 0 } = {}) => ({
  provider: 'local',
  requested_model: requestedModel || null,
  actual_model: 'rule_template',
  fallback: true,
  fallback_reason: fallbackReason,
  failure_reason: fallbackReason,
  latency_ms: latencyMs,
  usage: null,
  raw_usage: null,
});
const modelSuccessMeta = ({ provider, requestedModel, actualModel, latencyMs, usage = null } = {}) => ({
  provider,
  requested_model: requestedModel || null,
  actual_model: actualModel || requestedModel || null,
  fallback: false,
  fallback_reason: null,
  failure_reason: '',
  latency_ms: latencyMs || 0,
  usage,
  raw_usage: usage,
});
const normalizeModelMeta = (meta = {}) => ({
  provider: meta.provider || 'local',
  requested_model: meta.requested_model ?? null,
  actual_model: meta.actual_model || 'rule_template',
  fallback: Boolean(meta.fallback),
  fallback_reason: meta.fallback_reason || meta.failure_reason || null,
  failure_reason: meta.failure_reason || meta.fallback_reason || '',
  latency_ms: Number(meta.latency_ms || 0),
  usage: meta.usage || meta.raw_usage || null,
  raw_usage: meta.raw_usage || meta.usage || null,
  content_safety_adjusted: Boolean(meta.content_safety_adjusted),
  safety_adjustment_count: Number(meta.safety_adjustment_count || 0),
  provider_attempt_count: Number(meta.provider_attempt_count ?? ((meta.requested_model && meta.requested_model !== 'rule_template') ? 1 : 0)),
  repair_attempted: Boolean(meta.repair_attempted),
  repair_succeeded: Boolean(meta.repair_succeeded),
  repair_recovered_count: Number(meta.repair_recovered_count || 0),
});
const logModelCall = ({ route, purpose, meta, status = null } = {}) => {
  const safeMeta = normalizeModelMeta(meta);
  console.log(JSON.stringify({
    event: 'model_call',
    route,
    purpose,
    provider: safeMeta.provider,
    requested_model: safeMeta.requested_model,
    fallback: safeMeta.fallback,
    fallback_reason: safeMeta.fallback_reason,
    latency_ms: safeMeta.latency_ms,
    status,
  }));
};
const fetchWithTimeout = async (url, options = {}, timeoutMs = MODEL_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};
const callArkChatCompletion = async ({ messages = [], temperature = 0.7, maxTokens = 2200, purpose = 'generation', route = '/api/assessments', model = '', timeoutMs = MODEL_TIMEOUT_MS, responseFormat = null, thinking = null } = {}) => {
  const requestedModel = arkModel(model);
  const started = Date.now();
  if (!paidGenerationSafeToRun()) {
    const meta = modelFailureMeta({ requestedModel, fallbackReason: 'safe_to_run_disabled' });
    logModelCall({ route, purpose, meta });
    return { ok: false, ...meta, content: '' };
  }
  if (!arkApiKey()) {
    const meta = modelFailureMeta({ requestedModel, fallbackReason: 'missing_ark_api_key' });
    logModelCall({ route, purpose, meta });
    return { ok: false, ...meta, content: '' };
  }
  if (!requestedModel) {
    const meta = modelFailureMeta({ requestedModel: null, fallbackReason: 'missing_ark_model' });
    logModelCall({ route, purpose, meta });
    return { ok: false, ...meta, content: '' };
  }
  try {
    const res = await fetchWithTimeout(arkChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${arkApiKey()}`,
      },
      body: JSON.stringify({
        model: requestedModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(responseFormat ? { response_format: responseFormat } : {}),
        ...(thinking ? { thinking } : {}),
      }),
    }, timeoutMs);
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const meta = modelFailureMeta({ requestedModel, fallbackReason: `ark_api_error_${res.status}`, latencyMs });
      logModelCall({ route, purpose, meta, status: res.status });
      return { ok: false, ...meta, content: '' };
    }
    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!content) {
      const meta = modelFailureMeta({ requestedModel, fallbackReason: 'ark_empty_response', latencyMs });
      logModelCall({ route, purpose, meta });
      return { ok: false, ...meta, content: '' };
    }
    const meta = modelSuccessMeta({
      provider: 'volcengine_ark',
      requestedModel,
      actualModel: data?.model || requestedModel,
      latencyMs,
      usage: data?.usage || null,
    });
    logModelCall({ route, purpose, meta, status: res.status });
    return { ok: true, ...meta, content };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const fallbackReason = error?.name === 'AbortError' ? 'ark_timeout' : 'ark_api_error';
    const meta = modelFailureMeta({ requestedModel, fallbackReason, latencyMs });
    logModelCall({ route, purpose, meta });
    return { ok: false, ...meta, content: '' };
  }
};

const clean = (data, key, fallback = '') => String(data?.[key] ?? fallback).trim();
const hasUrlProtocol = (value = '') => /^[a-z][a-z0-9+.-]*:/i.test(String(value || '').trim());
const looksLikeExternalUrl = (value = '') => {
  const text = String(value || '').trim();
  if (!text || hasUrlProtocol(text) || text.startsWith('/') || text.startsWith('#')) return false;
  if (/^www\./i.test(text)) return true;
  return /^[\w-]+(?:\.[\w-]+)+(?:[/?#:]|$)/i.test(text);
};
const normalizeExternalUrl = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return '';
  return looksLikeExternalUrl(text) ? `https://${text}` : text;
};
const pad2 = (n) => String(n).padStart(2, '0');
const utcDateIso = (date) => `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
const shanghaiClock = (base = new Date(), offset = 0) => {
  const date = new Date(base);
  date.setUTCHours(date.getUTCHours() + 8);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
};
export const shanghaiDateIso = (offset = 0, base = new Date()) => utcDateIso(shanghaiClock(base, offset));
const todayIso = shanghaiDateIso;
const nowIso = () => {
  const date = shanghaiClock();
  return `${utcDateIso(date)} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
};
const BUSINESS_TIMESTAMP_WITHOUT_ZONE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/;
const timestampToEpoch = (value) => {
  if (value instanceof Date) {
    const epoch = value.getTime();
    return Number.isFinite(epoch) ? epoch : Number.NaN;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value) < 1e12 ? value * 1000 : value;
  }
  const text = String(value || '').trim();
  if (!text) return Number.NaN;
  if (/^\d{10,13}$/.test(text)) {
    const epoch = Number(text);
    return text.length <= 10 ? epoch * 1000 : epoch;
  }
  const businessTime = text.match(BUSINESS_TIMESTAMP_WITHOUT_ZONE);
  const parsed = Date.parse(businessTime ? `${businessTime[1]}T${businessTime[2]}+08:00` : text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};
const preferIncomingTimestamp = (incoming, existing) => {
  const incomingEpoch = timestampToEpoch(incoming);
  const existingEpoch = timestampToEpoch(existing);
  if (!Number.isFinite(incomingEpoch) || !Number.isFinite(existingEpoch)) return true;
  return incomingEpoch >= existingEpoch;
};
const compareTimestampDesc = (left, right) => {
  const leftEpoch = timestampToEpoch(left);
  const rightEpoch = timestampToEpoch(right);
  if (Number.isFinite(leftEpoch) && Number.isFinite(rightEpoch)) return rightEpoch - leftEpoch;
  if (Number.isFinite(leftEpoch)) return -1;
  if (Number.isFinite(rightEpoch)) return 1;
  return 0;
};
const latestTimestampValue = (values = []) => [...values]
  .filter((value) => String(value || '').trim())
  .sort(compareTimestampDesc)[0] || '';
const shanghaiWeekRange = (base = new Date()) => {
  const day = shanghaiClock(base);
  const monday = new Date(day);
  monday.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { week_start: utcDateIso(monday), week_end: utcDateIso(sunday) };
};

const blankState = () => ({
  next: { assessment: 1, diagnosis: 1, plan: 1, feedback: 1, review: 1 },
  assessments: [],
  diagnoses: [],
  plans: [],
  feedback: [],
  reviews: [],
  current_diagnosis_id: null,
});

const stageFor = (frequency = '') => {
  if (['每天', '日更', '稳定'].some((word) => frequency.includes(word))) return '稳定优化期';
  if (['每周', '一周', '周'].some((word) => frequency.includes(word))) return '节奏建立期';
  return '起步诊断期';
};

const priorityFor = (problem = '') => {
  if (['不知道', '发什么', '选题'].some((word) => problem.includes(word))) return '选题不稳定';
  if (['咨询', '咨询', '转化'].some((word) => problem.includes(word))) return '内容不转化';
  if (['流量', '曝光', '播放'].some((word) => problem.includes(word))) return '曝光不足';
  return '营销动作缺少复盘';
};

const strategyScoreFor = (assessment) => {
  let score = 30;
  if (assessment.target_customer) score += 12;
  if (assessment.offer) score += 12;
  if (assessment.customer_pain) score += 12;
  if (assessment.content_assets) score += 8;
  if (assessment.best_recent_content) score += 8;
  if (['视频号', '小红书', '抖音', '公众号', '朋友圈'].some((channel) => assessment.current_channels.includes(channel))) score += 8;
  if (assessment.main_goal) score += 10;
  return Math.max(0, Math.min(100, score));
};

const loopScoreFor = (assessment) => {
  // 新诊断不能因为信息填得完整就给高“增长闭环分”。
  // 闭环成熟度必须由发布、反馈、复盘数据驱动；首次提交最多只给基础分。
  let score = 8;
  if (['每周', '每天', '稳定'].some((word) => assessment.posting_frequency.includes(word))) score += 4;
  if (assessment.best_recent_content) score += 3;
  if (assessment.content_assets) score += 3;
  return Math.max(0, Math.min(25, score));
};

const scoreFor = strategyScoreFor;

const platformsFor = (channels = '') => {
  const items = channels.split(/[,，、/\s]+/).map((item) => item.trim()).filter(Boolean);
  return [...new Set(items)];
};

const hasAny = (text, words) => words.some((word) => text.includes(word));
const FEEDBACK_STAGE_ORDER = {'T+24': 1, 'T+72': 2, 'T+7': 3};
const stageRank = (stage) => FEEDBACK_STAGE_ORDER[stage] || 0;
const currentPlans = () => state.current_diagnosis_id
  ? state.plans.filter((plan) => plan.diagnosis_id === state.current_diagnosis_id)
  : state.plans;
const latestFeedbackRows = (planIds = null) => {
  const allowed = planIds ? new Set(planIds.map(Number)) : null;
  const byPlan = new Map();
  state.feedback.forEach((item) => {
    const key = Number(item.content_plan_id);
    if (allowed && !allowed.has(key)) return;
    const existing = byPlan.get(key);
    if (!existing || stageRank(item.feedback_stage) > stageRank(existing.feedback_stage) || (stageRank(item.feedback_stage) === stageRank(existing.feedback_stage) && preferIncomingTimestamp(item.created_at, existing.created_at))) {
      byPlan.set(key, item);
    }
  });
  return [...byPlan.values()];
};
const shortAudience = (target = '') => {
  const text = target.replace(/[。；;]+$/g, '');
  if (hasAny(text, ['老板'])) return '老板/企业主';
  if (hasAny(text, ['中小企业', '企业负责人', '企业主'])) return '企业主';
  if (hasAny(text, ['宝妈'])) return '宝妈/家长';
  if (hasAny(text, ['家长'])) return '家长';
  if (hasAny(text, ['本地生活', '商家', '门店', '到店客户', '本地客户'])) return '服务型商家';
  return text.split(/[、,，/]/).map((x) => x.trim()).filter(Boolean)[0] || '目标客户';
};
const painLabel = (pain = '', problem = '') => {
  const text = `${pain} ${problem}`;
  if (hasAny(text, ['不知道该发什么', '不知道发什么', '选题'])) return '不知道该发什么';
  if (hasAny(text, ['没咨询', '没有咨询', '不转化', '转化'])) return '发了内容但没咨询';
  if (hasAny(text, ['复盘'])) return '发完内容不会复盘';
  if (hasAny(text, ['AI', '文案'])) return 'AI文案没有转化';
  if (hasAny(text, ['流量', '曝光', '播放'])) return '内容曝光不足';
  return pain || problem || '当前核心痛点';
};
const compactTopicWords = (text = '') => String(text || '')
  .replace(/https?:\/\/\S+/g, ' ')
  .replace(/[，。；;、｜|/]+/g, ' ')
  .split(/\s+/)
  .map((item) => item.trim())
  .filter(Boolean);
const isMartialArtsText = (text = '') => hasAny(text, ['武术', '搏击', '散打', '拳击', '泰拳', '跆拳道', '格斗', '防身术', '少儿武术', '少儿搏击', '武馆', '搏击俱乐部', '武术搏击']);
const isYouthBasketballText = (text = '') => hasAny(text, ['少儿篮球', '小学生篮球', '幼儿篮球', '青少年篮球', '篮球培训', '篮球训练', '篮球启蒙', '篮球课', '运球训练', '投篮训练']);
const serviceTopicFor = (industry = '', offer = '') => {
  const text = `${industry} ${offer}`;
  if (hasAny(text, ['盆底肌', '漏尿', '产后修复', '产康', '骨盆修复'])) return { service: '盆底肌修复', scene: '做产后修复前', owner: '产后修复案例/科普内容', type: 'postpartum' };
  if (hasAny(text, ['满月照', '周岁照', '亲子纪实', '儿童摄影', '亲子摄影'])) return { service: '儿童摄影', scene: '拍满月照', owner: '儿童摄影作品', type: 'photo' };
  if (hasAny(text, ['口腔', '牙齿', '矫正', '正畸', '种植牙'])) return { service: '口腔项目', scene: '做牙齿矫正/种植牙前', owner: '口腔科普内容', type: 'dental' };
  if (hasAny(text, ['美甲', '甲片', '穿戴甲', '手部护理', '美甲套餐'])) return { service: '美甲款式', scene: '做美甲前', owner: '真实客照/款式合集', type: 'nail' };
  if (hasAny(text, ['饰品', '首饰', '耳饰', '耳环', '项链', '手链', '戒指', '发夹', '配饰', '珠宝', '银饰', '穿搭配件'])) return { service: '饰品款式', scene: '挑选饰品时', owner: '饰品款式/穿搭场景内容', type: 'fashion_accessory' };
  if (hasAny(text, ['宠物店', '宠物洗护', '宠物美容', '宠物寄养', '宠物用品', '宠物护理', '洗护套餐', '寄养', '猫狗', '养猫', '养狗', '猫咪', '狗狗'])) return { service: '宠物洗护/寄养服务', scene: '给宠物洗护或寄养前', owner: '宠物门店环境/洗护案例内容', type: 'pet_service' };
  if (hasAny(text, ['女装', '服装', '穿搭', '包包', '鞋履', '香薰', '礼物', '买手店', '零售', '上新'])) return { service: '商品款式', scene: '挑选商品时', owner: '商品种草/场景搭配内容', type: 'aesthetic_retail' };
  if (hasAny(text, ['篮球销售', '卖篮球', '篮球售卖', '篮球零售', '篮球专卖', '篮球店', '篮球用品', '篮球器材', '篮球装备', '篮球商品', '训练篮球', '比赛篮球'])) return { service: '篮球商品', scene: '挑选篮球时', owner: '篮球商品/训练场景内容', type: 'basketball_goods' };
  if (hasAny(text, ['美睫'])) return { service: '美睫效果', scene: '做美睫前', owner: '美睫案例内容', type: 'lash' };
  if (isMartialArtsText(text)) return { service: '武术搏击课程', scene: '报名武术/搏击课前', owner: '武术搏击课堂/训练安全内容', type: 'martial_arts' };
  if (isYouthBasketballText(text)) return { service: '少儿篮球体验课', scene: '报名少儿篮球课前', owner: '少儿篮球课堂/体能训练内容', type: 'youth_basketball' };
  if (hasAny(text, ['美容', '皮肤管理', '医美'])) return { service: '皮肤管理项目', scene: '到店前', owner: '真实案例/过程内容', type: 'beauty' };
  if (hasAny(text, ['医疗器械', '医械', '器械检测', '医疗检测', '注册检验', '注册检测', '注册认证', '产品注册', '安规认证', '安规验证', 'ce认证', 'fda注册', 'iso13485', '质量体系'])) return { service: '医疗器械检测/注册/安规认证服务', scene: '做产品注册/检测认证前', owner: '医疗器械合规科普/企业案例内容', type: 'medical_device_compliance' };
  if (hasAny(text, ['安标', '安全生产标准化', '安全标准化', '安全生产', '验厂', '认证辅导', '合规辅导', '工厂合规'])) return { service: '安全生产标准化辅导', scene: '做安标/验厂/合规准备前', owner: '安标合规科普/企业案例内容', type: 'safety_compliance' };
  if (hasAny(text, ['教育', '培训', '课程', '教培', '体验课'])) return { service: '课程/体验课', scene: '报名前', owner: '课程内容', type: 'education' };
  if (hasAny(text, ['餐饮', '餐厅', '咖啡', '茶饮', '火锅', '烘焙'])) return { service: '到店消费', scene: '选店前', owner: '门店内容', type: 'localfood' };
  const words = compactTopicWords(`${offer} ${industry}`);
  const service = words.find((word) => word.length <= 10 && !hasAny(word, ['本地', '广州', '上海', '北京', '深圳', '高端', '主打', '获得更多', '咨询', '预约', '客户'])) || '具体服务';
  return { service, scene: `选择${service}前`, owner: `${service}内容`, type: 'default' };
};
const naturalPlanTitles = ({ audience, industry, offer, painShort, goal }) => {
  const service = serviceTopicFor(industry, offer);
  const reader = hasAny(audience, ['宝妈']) ? '宝妈' : audience;
  if (service.type === 'nail') {
    return [
      `${reader}想做显白美甲，先看这几种款式`,
      `短甲女生适合什么美甲？这几款不挑手型`,
      `上班通勤也能做的低调美甲合集`,
      `第一次来店做美甲，最该先确认这3件事`,
      `约会/拍照前做美甲，别只看图片好不好看`,
      `${reader}担心美甲翻车？先看真实客照和细节`,
      `本周客人问得最多的美甲款式问题`,
    ];
  }
  if (service.type === 'youth_basketball') {
    return [
      `孩子总玩手机，为什么建议先试一次篮球课`,
      `6-12岁孩子练篮球，家长最该看这4点`,
      `篮球课不只是投篮，更是在练体能和专注力`,
      `附近3公里怎么选靠谱少儿篮球训练机构`,
      `第一次体验课，家长要观察孩子哪几个变化`,
      `孩子胆小/零基础/不爱运动，适不适合篮球课`,
      `周末班和寒暑假班，篮球训练怎么安排更有效`,
    ];
  }
  if (service.type === 'martial_arts') {
    return [
      `孩子学武术/搏击，家长最该先看哪3点`,
      `零基础孩子第一次上搏击课，会不会跟不上`,
      `武术搏击课不是打架，真正训练的是什么`,
      `附近怎么选靠谱的武术搏击俱乐部`,
      `第一次体验课，家长要观察这几个课堂信号`,
      `孩子胆小、坐不住，适不适合学武术搏击`,
      `武术搏击课的安全保护，家长应该怎么判断`,
    ];
  }
  if (service.type === 'basketball_goods') {
    return [
      `学生买篮球，先看清楚室内球还是室外球`,
      `篮球运动爱好者怎么选一颗耐磨又好控的球`,
      `第一次买篮球，别只看颜色和价格`,
      `水泥地打球，篮球最该看这3个参数`,
      `学生党预算有限，篮球怎么选不容易踩坑`,
      `训练用球和比赛用球，到底差在哪里`,
      `本周适合学生和爱好者的篮球款式清单`,
    ];
  }
  if (service.type === 'fashion_accessory') {
    return [
      `这几款耳饰，普通穿搭戴上立刻变精致`,
      `${reader}上班通勤适合戴什么饰品`,
      `脸圆/脖子短怎么选耳环？这3类更显气质`,
      `百元内不廉价的饰品，送自己也适合送朋友`,
      `黑白灰穿搭太素？加一件饰品就有重点`,
      `第一次买饰品，别只看图片好不好看`,
      `本周新款里，最适合约会/拍照的3件饰品`,
    ];
  }
  if (service.type === 'pet_service') {
    return [
      `小区周边宠物洗护怎么选`,
      `宠物洗护应激怎么办`,
      `宠物短期寄养怎么选`,
      `宠物洗护套餐明码标价`,
      `宠物洗护前后效果实拍`,
      `上班族养宠省心攻略`,
      `老客力荐的洗护套餐`,
    ];
  }
  if (service.type === 'aesthetic_retail') {
    return [
      `${reader}最近最容易收藏的3种商品风格`,
      `通勤/约会/拍照都能用的搭配清单`,
      `第一次下单前，先看材质、尺寸和真实上身效果`,
      `百元内不显廉价的礼物/自用好物清单`,
      `同一件单品，怎么搭才更显质感`,
      `新品上架先别乱买，按这3个场景选`,
      `本周最适合收藏参考的款式合集`,
    ];
  }
  if (service.type === 'safety_compliance') {
    return [
      `企业做安标前，老板最容易忽略的3个准备`,
      `验厂前才补安全资料，为什么风险会变高`,
      `安全生产标准化辅导，先看现场还是先补台账`,
      `中小企业做合规整改，别只盯证书结果`,
      `安标评审前，负责人要先确认这5类材料`,
      `工厂安全管理反复扣分，通常卡在这几个细节`,
      `一次安标辅导到底帮企业解决什么问题`,
    ];
  }
  return [
    `${reader}${service.scene}，最容易踩的3个坑`,
    `${reader}担心${service.service}不合适？先看真实体验和细节`,
    `${reader}选${service.service}，最在意的不是价格`,
    `第一次了解${service.service}，这3个顾虑很正常`,
    `${service.service}值不值得选？先看过程、价格和案例`,
    `${reader}到店前，可以先问清楚这5件事`,
    `关于${service.service}，大家最常问的1个问题`,
  ].map((title) => title.replace(/目标客户|服务项目/g, (word) => word === '目标客户' ? '客户' : service.service));
};

const customerPlanRowsFor = ({ titles, service, offer }) => {
  if (service.type === 'nail') {
    return [
      [titles[0], '款式种草：用真实客照展示显白、显手细和上手效果', '图文/短视频', '喜欢哪一款可以截图咨询，先看手型和肤色再推荐。', '收藏/咨询', '可直接进入草稿', '适合放真实客照、色号和到店预约入口'],
      [titles[1], '手型适配：解决短甲、肉手、通勤不方便的实际顾虑', '图文', '保存这条，到店前选2-3个参考款。', '收藏数', '可直接进入草稿', '适合做款式合集，避免空泛讲服务'],
      [titles[2], '场景合集：围绕上班、约会、拍照、节日前换款展示选择', '图文/短视频', '想做低调款，可以咨询发手部照片和预算。', '咨询/咨询', '可直接进入草稿', '符合美甲店到店决策场景'],
      [titles[3], '到店决策：讲清价格区间、耗时、卸甲、消毒和预约流程', '图文', '第一次来店可以先咨询想做的风格和可预约时间。', '咨询数', '需要人工润色', '发布前补充门店真实流程和价位'],
      [titles[4], '效果避坑：说明图片款和实际上手效果为什么会不同', '短视频/图文', '拿不准适合哪种风格，可以发参考图先判断。', '收藏/咨询', '需要人工润色', '适合降低翻车顾虑'],
      [titles[5], '信任建立：展示真实客照、细节近拍、边缘处理和持久度', '短视频', '想看同款更多细节，可以咨询预约试色。', '咨询数', '可直接进入草稿', '建议加入真实手部细节，不要只放网图'],
      [titles[6], 'FAQ：把客人常问的价格、持久度、卸甲和款式选择做成内容', '图文/短视频', '还有想问的款式/价格，可以咨询具体情况。', '咨询数', '仅为策略方向', '需要结合真实咨询问题后再发布'],
    ];
  }
  if (service.type === 'youth_basketball') {
    return [
      [titles[0], '家长焦虑切入：先回应孩子运动不足、沉迷手机、体能下降和社交少，再引出低门槛体验课', '图文/短视频', '想知道孩子适不适合篮球课，可以先预约一次体验课，观察兴趣、体能和课堂参与度。', '收藏/咨询', '可直接进入草稿', '必须写给家长，不写机构运营问题；禁止夸大长高/升学效果'],
      [titles[1], '选择标准：讲清年龄分班、教练资质、安全保护、训练强度和课后反馈', '图文', '保存这条，带孩子试听前可以对照看机构、教练和课堂反馈。', '收藏数', '可直接进入草稿', '适合做家长决策清单，承接同城搜索'],
      [titles[2], '价值解释：把篮球训练从“学投篮”转成体能、协调性、专注力、规则感和团队协作', '短视频/图文', '如果孩子平时不爱运动，可以先从低强度体验课开始。', '咨询/咨询', '可直接进入草稿', '发布前补真实课堂片段、运球/投篮/热身训练画面'],
      [titles[3], '同城选择：围绕距离、接送、班型、试听体验、安全感和孩子适应度降低决策成本', '图文', '附近家长可以咨询孩子年龄、基础和可上课时间，先判断适合哪个班型。', '咨询数', '需要人工润色', '适合本地3公里获客；不要写成泛教育课程模板'],
      [titles[4], '体验课观察：告诉家长第一次课重点看孩子兴趣、出汗量、听指令、互动和教练反馈', '图文/短视频', '第一次体验后，我们会根据孩子状态给训练建议和班型建议。', '咨询数', '可直接进入草稿', '适合承接体验课预约，建议加入真实试听片段'],
      [titles[5], '适配人群：回应胆小、零基础、不爱运动、怕跟不上、怕受伤的家庭顾虑', '图文', '不确定孩子能不能适应，可以先从一次体验课看反应。', '咨询数', '需要人工润色', '重点降低报名阻力，避免承诺立刻长高/变强'],
      [titles[6], '节点营销：结合周末班、寒暑假班和新学期体能需求，给家长低压力训练安排', '图文/短视频', '想了解周末班或假期班，可以咨询孩子年龄、篮球基础和可训练时间。', '咨询数', '仅为策略方向', '需结合真实班型、名额、场馆位置和上课时间发布'],
    ];
  }
  if (service.type === 'martial_arts') {
    return [
      [titles[0], '家长决策切入：先讲清安全保护、教练带课方式、孩子纪律感和基础适配', '图文/短视频', '想判断孩子适不适合，可以先咨询年龄、性格和运动基础。', '收藏/咨询', '可直接进入草稿', '必须写武术/搏击课堂，不得出现篮球课、运球、投篮、篮筐等错行业词'],
      [titles[1], '体验课预期：解释第一次课的热身、基础动作、防护、强度和老师反馈', '图文', '保存这条，带孩子体验前可以对照观察课堂节奏。', '收藏数', '可直接进入草稿', '适合降低家长对受伤、跟不上、太激烈的顾虑'],
      [titles[2], '价值解释：把武术搏击从“会打架”转成体能、专注力、规则感、自信和自我保护', '短视频/图文', '如果孩子胆小或坐不住，可以先从低强度体验课了解。', '咨询数', '可直接进入草稿', '建议补真实课堂片段、护具、防护和教练纠正动作画面'],
      [titles[3], '同城选择：围绕距离、接送、班型、教练资质、课堂秩序和安全保护降低决策成本', '图文', '附近家长可以咨询孩子年龄、基础和可上课时间，先判断适合哪个班型。', '咨询数', '需要人工润色', '适合本地获客；不要写成泛教育或篮球模板'],
      [titles[4], '课堂观察：告诉家长第一次体验重点看孩子是否敢参与、能否听指令、动作是否安全', '图文/短视频', '体验后可根据孩子状态咨询后续训练建议。', '咨询数', '可直接进入草稿', '适合承接体验课预约，建议加入真实试听片段'],
      [titles[5], '适配人群：回应胆小、好动、零基础、怕疼、怕受伤、怕太累的家庭顾虑', '图文', '不确定孩子能不能适应，可以先从一次体验课看反应。', '咨询数', '需要人工润色', '重点降低报名阻力，避免承诺速成或攻击性效果'],
      [titles[6], '安全信任：展示护具、垫面、分级训练、热身拉伸和教练保护细节', '图文/短视频', '想了解体验课和班型安排，可以咨询孩子年龄和可训练时间。', '咨询数', '仅为策略方向', '需结合真实场馆、班型、教练和安全规则发布'],
    ];
  }
  if (service.type === 'basketball_goods') {
    return [
      [titles[0], '购买决策：先把篮球使用场地讲清楚，区分室内木地板、塑胶场和水泥地', '图文/短视频', '想买篮球可以咨询使用场地、预算和年龄，我们帮你缩小选择。', '曝光/咨询', '可直接进入草稿', '必须围绕篮球商品，不写篮球课/体验课/相关服务'],
      [titles[1], '产品种草：围绕耐磨、手感、控球、弹性和防滑做真实对比', '图文/短视频', '保存这条，买篮球前可以按手感和场地对照选。', '收藏数', '可直接进入草稿', '适合学生和篮球爱好者搜索收藏'],
      [titles[2], '避坑清单：讲清尺寸、材质、重量、气压、品牌溢价和售后问题', '图文', '不确定买几号球，可以咨询身高年龄和主要打球场地。', '收藏/咨询', '可直接进入草稿', '承接下单前咨询，不写服务流程'],
      [titles[3], '场景选择：水泥地训练重点讲耐磨和防滑，不要只讲颜值', '短视频/图文', '经常在室外打球，可以咨询预算和使用频率推荐款式。', '咨询/订单', '需要人工润色', '建议补真实球面、弹跳和户外使用素材'],
      [titles[4], '预算分层：学生党按价格段推荐入门、训练和进阶款', '图文', '想看同预算更多篮球，可以咨询预算区间和打球场景。', '咨询/订单', '可直接进入草稿', '适合带动曝光到询单'],
      [titles[5], '功能对比：解释训练球、比赛球、室内球、室外球的差异', '图文/短视频', '不知道选训练还是比赛用球，可以咨询具体用途。', '咨询数', '仅为策略方向', '需结合真实 SKU、价格和库存'],
      [titles[6], '上新/清单：用学生、爱好者、送礼、训练等场景组织商品推荐', '图文/短视频', '喜欢哪一款可以咨询编号/截图确认价格和库存。', '咨询/订单', '可直接进入草稿', '商品销售类要指向询价/下单/库存，不指向预约体验课'],
    ];
  }
  if (service.type === 'fashion_accessory') {
    return [
      [titles[0], '款式种草：用真实佩戴图展示显脸小、显气质和上身效果', '图文/短视频', '喜欢哪一款可以咨询编号/截图，先看风格和预算再推荐。', '曝光/收藏', '可直接进入草稿', '必须围绕饰品款式，不写服务流程'],
      [titles[1], '场景搭配：围绕通勤、约会、拍照、日常出门展示佩戴选择', '图文', '保存这条，搭配衣服前可以对照选款。', '收藏数', '可直接进入草稿', '适合小红书饰品种草'],
      [titles[2], '人群适配：解决脸型、脖子长度、肤色和风格选择困难', '图文/短视频', '拿不准适合哪类耳饰，可以咨询照片/风格偏好先判断。', '收藏/咨询', '需要人工润色', '发布前补真实佩戴对比图'],
      [titles[3], '价格与送礼：用百元内/不廉价/送自己送朋友降低下单门槛', '图文', '想看同价位更多款式，可以咨询预算和使用场景。', '咨询/订单', '可直接进入草稿', '承接曝光到询单，不写预约服务'],
      [titles[4], '穿搭教学：展示同一套衣服加饰品前后的精致度差异', '短视频/图文', '保存搭配思路，想要同款可以咨询款式编号。', '收藏/咨询', '需要人工润色', '适合用对比图提高收藏'],
      [titles[5], '购买避坑：讲清图片色差、材质、尺寸、过敏、保养和退换注意', '图文', '下单前不确定材质或尺寸，可以先咨询确认。', '收藏/咨询', '仅为策略方向', '需结合真实商品信息'],
      [titles[6], '上新转化：用本周新款、约会/拍照/节日场景推动询单', '图文/短视频', '喜欢新款可以咨询编号/截图确认库存和价格。', '咨询/订单', '可直接进入草稿', '适合带动新品曝光和订单'],
    ];
  }
  if (service.type === 'pet_service') {
    return [
      [titles[0], '门店信任：展示洗护区、接待流程、接送半径和预约方式', '图文/短视频', '评论区发宠物品种和体重，帮你估洗护时间。', '收藏/咨询', '可直接进入草稿', '必须围绕宠物洗护/寄养，不写泛商品款式或其他行业模板'],
      [titles[1], '顾虑处理：解释分步洗护、安抚方式和主人提前准备事项', '图文', '私信“洗护”发你第一次到店准备清单。', '收藏数', '可直接进入草稿', '重点降低宠物应激和新客不信任'],
      [titles[2], '寄养选择：展示笼舍、活动区、喂养记录、消毒频次和每日反馈', '短视频/图文', '想看寄养环境可以预约到店参观。', '咨询数', '需要人工润色', '发布前补真实门店环境和照看记录'],
      [titles[3], '价格透明：按体型、毛量、服务项目讲清套餐和可能加项', '图文', '发宠物体重，帮你确认适合套餐。', '咨询/订单', '可直接进入草稿', '避免客户担心到店临时加价'],
      [titles[4], '案例证明：用同一只宠物的洗护前后对比和护理细节证明稳定性', '短视频/图文', '想看同品种案例可私信品种名。', '咨询数', '可直接进入草稿', '建议加入客户授权的前后对比素材'],
      [titles[5], '省心方案：结合工作日接送、寄养、用品补给讲一站式安排', '图文/短视频', '评论你的通勤时间，帮你排预约建议。', '收藏/咨询', '需要人工润色', '适合上班族养宠人群'],
      [titles[6], '老客反馈：引用复购原因、宠物适应情况和门店服务细节增强社交证明', '图文', '私信“老客套餐”领取本周预约档期。', '咨询数', '仅为策略方向', '需结合真实老客评价和服务信息'],
    ];
  }
  if (service.type === 'aesthetic_retail') {
    return [
      [titles[0], '商品种草：突出风格、真实使用场景和上手/上身效果', '图文/短视频', '喜欢哪一款可以咨询编号/截图了解库存和价格。', '曝光/收藏', '可直接进入草稿', '商品类业务禁止套服务流程模板'],
      [titles[1], '场景清单：把商品放进通勤、约会、拍照、送礼等真实使用场景', '图文', '保存这条，购买前可以按场景选。', '收藏数', '可直接进入草稿', '适合做小红书种草'],
      [titles[2], '下单决策：讲清材质、尺寸、价格、适合人群和真实效果', '图文/短视频', '下单前不确定，可以咨询具体需求。', '咨询/咨询', '需要人工润色', '发布前补真实商品参数'],
      [titles[3], '礼物/自用：用预算和关系场景降低选择成本', '图文', '想送礼可以咨询用途和预算，帮你缩小选择。', '咨询/订单', '可直接进入草稿', '承接订单转化'],
      [titles[4], '搭配教学：展示一件商品在不同穿搭/空间/场景下的效果', '短视频/图文', '喜欢这个搭配可以咨询同款或相似款。', '收藏/咨询', '需要人工润色', '适合提高收藏'],
      [titles[5], '新品选择：把上新从“看看新品”变成“按场景选新品”', '图文/短视频', '想看新款库存和价格，可以咨询编号。', '咨询/订单', '可直接进入草稿', '适合上新节点'],
      [titles[6], 'FAQ：把客户常问的材质、尺寸、价格、发货、退换做成内容', '图文', '还有其他下单问题，可以咨询具体款式。', '咨询数', '仅为策略方向', '需结合真实售前问题'],
    ];
  }
  const serviceName = service.service || offer || '服务';
  const visitCta = `想了解${serviceName}，可以咨询具体情况或预约咨询。`;
  const saveCta = `保存这条，选择${serviceName}前可以对照看。`;
  return [
    [titles[0], '场景痛点：用终端顾客正在经历的问题开头，不写老板经营困扰', '图文/短视频', visitCta, '收藏/咨询', '需要人工润色', '只允许写目标客户的需求、顾虑和使用场景'],
    [titles[1], '信任建立：展示真实案例、过程细节、前后变化和客户反馈', '短视频/图文', `想看更多${serviceName}案例，可以从主页或咨询了解。`, '咨询数', '需要人工润色', '发布前替换成本客户真实案例'],
    [titles[2], '选择避坑：讲清价格、流程、效果边界和常见误区', '图文', saveCta, '收藏数', '可直接进入草稿', '面向购买/到店/报名决策，不面向老板复盘'],
    [titles[3], '首次体验：降低第一次咨询、到店、试听或购买前的心理门槛', '图文/短视频', `第一次了解${serviceName}，可以先咨询问流程和适配情况。`, '咨询数', '需要人工润色', '适合承接新客咨询'],
    [titles[4], '效果说明：用客户看得懂的话说明适合人群、交付结果和注意事项', '图文', visitCta, '咨询数', '可直接进入草稿', '主题清楚，适合承接转化'],
    [titles[5], '过程透明：展示环境、流程、服务人员、材料或方法，降低不信任', '短视频', `拿不准能不能做，可以先咨询具体情况。`, '互动/咨询', '需要人工润色', '建议加入真实过程素材'],
    [titles[6], 'FAQ：把目标客户常问的价格、周期、效果、流程做成内容', '短视频/图文', `还有关于${serviceName}的问题，可以咨询具体情况。`, '咨询数', '仅为策略方向', '必须结合真实咨询问题后再发布'],
  ];
};
const normalizeBenchmark = (payload = {}) => {
  const source = payload.benchmark && typeof payload.benchmark === 'object' ? payload.benchmark : payload;
  const accountText = clean(source, 'benchmark_accounts').split(/[\n\r,，、]+/);
  const accounts = [
    ...(Array.isArray(source.accounts) ? source.accounts : []),
    ...accountText,
    clean(source, 'benchmark_account_1'),
    clean(source, 'benchmark_account_2'),
    clean(source, 'benchmark_account_3'),
  ].map((item) => normalizeExternalUrl(item)).filter(Boolean);
  return {
    platform: clean(source, 'platform') || clean(source, 'benchmark_platform'),
    accounts: [...new Set(accounts)].slice(0, 3),
    notes: clean(source, 'notes') || clean(source, 'benchmark_notes'),
    sample_content: clean(source, 'sample_content') || clean(source, 'benchmark_sample_content'),
  };
};
const hasBenchmark = (benchmark = {}) => Boolean((benchmark.accounts || []).length || benchmark.notes || benchmark.sample_content);
const benchmarkTextFor = (benchmark = {}) => [benchmark.platform, ...(benchmark.accounts || []), benchmark.notes, benchmark.sample_content].filter(Boolean).join(' ');
const benchmarkThemeFor = (benchmark = {}, fallback = '客户真实痛点') => {
  const text = String(benchmark.sample_content || benchmark.notes || '').replace(/https?:\/\/\S+/g, ' ').replace(/[“”"']/g, '').trim();
  if (hasAny(text, ['矫正', '正畸', '牙齿'])) return '儿童矫正时机判断';
  if (hasAny(text, ['价格', '贵', '费用'])) return '价格和效果顾虑';
  if (hasAny(text, ['医生', '专业', '信任'])) return '医生专业信任';
  if (hasAny(text, ['复盘', '内容', '咨询'])) return '内容复盘和咨询转化';
  const parts = text.split(/[。！？!?；;\n\r]/).map((item) => item.trim()).filter((item) => item.length >= 4);
  return (parts[0] || fallback).slice(0, 34);
};
const benchmarkReferenceFor = (assessment) => {
  const benchmark = assessment.benchmark || {};
  if (!hasBenchmark(benchmark)) return null;
  const audience = shortAudience(assessment.target_customer || '');
  const theme = benchmarkThemeFor(benchmark, assessment.biggest_problem || assessment.customer_pain || '客户真实痛点');
  const platform = benchmark.platform || '对标平台';
  const source = [platform, ...(benchmark.accounts || [])].filter(Boolean).join('｜');
  return {
    title: '对标账号主题参考',
    source_summary: source || '客户手动填写的对标账号与代表内容',
    recent_topics: [
      `${audience}对「${theme}」类问题有明确兴趣`,
      `把对标内容中的高频疑问转译成${assessment.industry || '当前行业'}客户场景`,
      `围绕${assessment.offer || '服务入口'}补充案例、避坑和决策标准`,
    ],
    title_structures: [
      '痛点直问：为什么明明有需求，却迟迟不行动？',
      '避坑清单：选择前先看这3个判断标准',
      '场景复盘：一个真实问题如何被专业服务解决',
    ],
    transferable_directions: [
      `保留${platform}已验证的痛点表达，但换成${audience}语言`,
      `把标题结构迁移到${assessment.industry || '当前行业'}案例、流程和FAQ`,
      '用收藏、咨询、咨询数据判断哪些主题值得进入下一轮',
    ],
    avoid: [
      '不照抄对标账号标题、封面、脚本或案例原文',
      '不搬运未经授权的图片、视频和客户故事',
      '不把对标账号的人设直接套到本客户账号',
    ],
  };
};
const softCta = (offer = '', pain = '') => {
  if (hasAny(`${offer} ${pain}`, ['复盘', 'AI', '内容增长', '线上获客'])) return '如果你也发了内容但不知道有没有用，可以咨询具体情况，从一张内容反馈表开始。';
  return `如果你也遇到「${pain || '类似问题'}」，可以咨询具体情况，先判断问题卡在哪里。`;
};
const isMetaMarketingAccount = (assessment) => {
  const text = [assessment.industry, assessment.offer, assessment.company_name, assessment.account_preference].filter(Boolean).join(' ');
  return hasAny(text, ['内容决策局', '企业内容增长', '企业获客', 'AI营销复盘', '营销增长决策', '内容获客工具']);
};
const addPlatform = (bucket, platform, reason) => {
  if (!bucket.some((item) => item.platform === platform)) bucket.push({ platform, reason });
};


const platformStyleRulesFor = (platform) => {
  const rules = {
    '小红书': '标题要像目标客户真实会说的话，可用“原来、后悔没早知道、谁懂啊”等轻情绪钩子或数字清单感；保持真实、不夸大、不堆 emoji，不要写成工具说明书。',
    '视频号': '更适合负责人/老板口播、真实案例复盘和信任建立，表达要稳、实在可信，不追求过度网感、不标题党；受众偏成熟，吃干货和情感共鸣。视频号在微信生态内，好内容可被转发到群/朋友圈并经好友社交推荐，可适度做“值得收藏/转发”的实用或共鸣选题；转化承接可引导到公众号/社群/企业微信/私信等私域入口。',
    '朋友圈/私域': '适合承接信任和轻咨询，少用营销腔，多用真实案例、过程和客户问题。',
    '公众号': '适合深度方案、案例沉淀和长期搜索资料，少用 emoji，结构要清楚。',
    '抖音': '适合短视频曝光验证，需要更强开头钩子和持续素材能力，不宜第一天就重投入。',
    '知乎': '适合专业问题搜索和方案型信任，重逻辑与证据，不追求小红书式精致感。',
  };
  return rules[platform] || '按该平台用户语境调整表达，不把小红书规则生搬硬套到所有平台。';
};

const growthExperimentTypes = [
  '痛点型',
  '效果型',
  '信任型',
  '场景型',
  '转化型',
  '异议处理型',
  '复盘型',
];

const platformStrategyFor = (platform = '', ctx = {}) => {
  const service = ctx.category || ctx.primary_offer || '当前服务';
  const audience = shortAudience(ctx.target_customer || '目标客户');
  const conversion = ctx.conversion_action || '咨询具体情况';
  if (platform === '抖音') {
    return {
      content_type: '短视频',
      why: '适合用3秒开头、真实场景和过程画面快速验证' + audience + '是否对「' + service + '」有兴趣。',
      expression: '开头先抛具体顾虑，中段给课堂/服务/案例画面，结尾只承接一次咨询动作。',
      observe_metrics: ['播放完成率', '主页访问', '咨询', '预约/到店'],
      next_adjustment: '播放高但咨询低时，下一条补信任证据、价格/周期边界和「' + conversion + '」入口。',
    };
  }
  if (platform === '小红书') {
    return {
      content_type: '图文/短视频',
      why: '适合承接搜索和收藏决策，把' + audience + '关心的避坑、清单、效果边界讲清楚。',
      expression: '标题用目标客户会说的话，可带轻情绪钩子或数字清单感；正文用清单/对比/案例分段，封面突出一个可保存判断点，不夸大、不堆 emoji。',
      observe_metrics: ['曝光', '收藏', '评论提问', '咨询'],
      next_adjustment: '收藏高但咨询低时，下一条把案例、流程、价格区间或适合人群写得更具体。',
    };
  }
  if (platform === '视频号') {
    return {
      content_type: '口播短视频',
      why: '适合在微信生态建立专业信任，用负责人/老师/顾问口播承接熟人转发和咨询。',
      expression: '表达更稳，少用夸张网感，重点说清为什么可信、适合谁、下一步怎么问。',
      observe_metrics: ['播放', '转发', '评论提问/咨询', '微信咨询/预约'],
      next_adjustment: '播放低时先换开头问题；有咨询但少预约时补案例复盘和明确下一步。',
    };
  }
  if (platform.includes('朋友圈')) {
    return {
      content_type: '短文/案例记录',
      why: '适合做信任维护和老客转介绍，承接已认识客户的轻咨询。',
      expression: '少营销腔，多真实案例、过程记录、客户常见问题和可咨询入口。',
      observe_metrics: ['互动', '咨询', '转介绍', '预约/下单'],
      next_adjustment: '互动弱时减少硬广，多用真实案例和客户问答；咨询弱时明确可咨询事项。',
    };
  }
  return {
    content_type: '图文/短视频',
    why: '适合补充验证「' + service + '」在该平台的客户反馈。',
    expression: '按平台语境调整标题、开头、封面和咨询入口。',
    observe_metrics: ['曝光/播放', '互动', '咨询', '预约/到店'],
    next_adjustment: '数据不好时先换标题/开头，再判断是否暂停该平台。',
  };
};

const merchantProfileFor = (assessment = {}, ctx = inferBusinessContext(assessment)) => {
  const service = serviceTopicFor([
    assessment.industry,
    assessment.main_goal,
    assessment.offer,
    assessment.customer_pain,
    assessment.content_assets,
  ].filter(Boolean).join(' '), assessment.offer || '');
  const platforms = platformsFor(assessment.current_channels || '').filter((item) => item && !/不确定/.test(item));
  const assets = [assessment.content_assets, assessment.best_recent_content, assessment.coach_credentials, assessment.store_location, assessment.course_schedule]
    .filter(Boolean)
    .map((item) => String(item).trim())
    .filter(Boolean);
  return {
    service_type: service.type,
    service_name: assessment.offer || ctx.primary_offer || service.service,
    audience: assessment.target_customer || ctx.target_customer || shortAudience(assessment.target_customer || '目标客户'),
    goal: assessment.main_goal || '获得更多有效咨询',
    bottleneck: ctx.growth_bottleneck || priorityFor(assessment.biggest_problem || assessment.customer_pain || ''),
    conversion_action: ctx.conversion_action || '咨询具体情况',
    decision_scene: ctx.customer_decision_scene || `${shortAudience(assessment.target_customer || '目标客户')}选择${service.service}前的真实顾虑`,
    platform_focus: platforms.length ? platforms : planPlatforms(recommendPlatforms(assessment), assessment.current_channels).slice(0, 3),
    proof_assets: assets.slice(0, 3),
    differentiation_note: ctx.content_task || '围绕客户真实顾虑、素材证据和下一步咨询动作生成内容，不套统一行业模板。',
  };
};

const compactStrategyItems = (values = [], maxItems = 4, maxLength = 100) => {
  const seen = new Set();
  return values
    .flatMap((value) => Array.isArray(value) ? value : String(value || '').split(/[。！？!?；;\n\r]+/))
    .map((value) => Array.from(String(value || '').trim()).slice(0, maxLength).join(''))
    .filter((value) => {
      const key = value.replace(/\s+/g, '').toLowerCase();
      if (key.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
};

const strategyQualityContextFor = (assessment = {}, ctx = inferBusinessContext(assessment), merchantProfile = merchantProfileFor(assessment, ctx)) => {
  const benchmark = assessment.benchmark && typeof assessment.benchmark === 'object' ? assessment.benchmark : {};
  const coCreation = assessment.co_creation && typeof assessment.co_creation === 'object' ? assessment.co_creation : {};
  const customerLanguage = compactStrategyItems([
    assessment.customer_pain,
    assessment.biggest_problem,
    coCreation.customer_emphasis,
  ]);
  const buyerObjections = compactStrategyItems([
    assessment.customer_pain,
    assessment.biggest_problem,
    coCreation.customer_emphasis,
  ]);
  const proofAssets = compactStrategyItems([
    merchantProfile.proof_assets || [],
    assessment.content_assets,
    assessment.best_recent_content,
    assessment.coach_credentials,
  ]);
  const marketCalibration = compactStrategyItems([
    benchmark.notes,
    benchmark.sample_content,
  ], 2, 120);
  const platformJobs = (merchantProfile.platform_focus || [])
    .slice(0, 4)
    .map((platform) => ({
      platform,
      purpose: platformStrategyFor(platform, {
        category: merchantProfile.service_name,
        target_customer: merchantProfile.audience,
        conversion_action: merchantProfile.conversion_action,
      }).why,
    }));
  return {
    framework_version: 'customer-evidence-p0',
    service: merchantProfile.service_name,
    audience: merchantProfile.audience,
    business_goal: merchantProfile.goal,
    bottleneck: merchantProfile.bottleneck,
    conversion_action: merchantProfile.conversion_action,
    customer_language: customerLanguage,
    buyer_objections: buyerObjections,
    proof_assets: proofAssets,
    market_calibration: marketCalibration,
    platform_jobs: platformJobs,
    evidence_strength: proofAssets.length >= 2 ? 'strong' : proofAssets.length ? 'partial' : 'weak',
    quality_rules: [
      '选题必须对应客户原话、购买顾虑或真实业务目标，不能只替换行业名。',
      '没有真实证据时只讲过程、边界和判断标准，不编造案例、价格或效果。',
      '每个平台承担明确任务，标题语感、内容形式和观察指标必须随平台变化。',
      '每条内容都要有可验证假设，并说明数据一般时下一条如何调整。',
    ],
  };
};

const strategyQualityForPlan = ({ qualityContext = {}, index = 0, title = '', platform = '', experimentType = '', strategy = {} } = {}) => {
  const choose = (items = []) => items.length ? items[index % items.length] : '';
  const customerLanguage = choose(qualityContext.customer_language || []);
  const buyerObjection = choose(qualityContext.buyer_objections || []);
  const proofAsset = choose(qualityContext.proof_assets || []);
  const marketSignal = choose(qualityContext.market_calibration || []);
  return {
    framework_version: qualityContext.framework_version || 'customer-evidence-p0',
    evidence_strength: qualityContext.evidence_strength || 'weak',
    customer_language_used: customerLanguage,
    buyer_objection_used: buyerObjection,
    proof_asset_used: proofAsset,
    market_signal_used: marketSignal,
    platform_role: strategy.why || `${platform || '当前平台'}用于验证目标客户是否关注这个问题。`,
    conversion_action: qualityContext.conversion_action || '咨询具体情况',
    hypothesis: `${experimentType || '内容'}测试：${title || '本条内容'}能否触发目标客户的真实反馈。`,
    decision_rule: strategy.next_adjustment || '数据一般时先换标题或开头，再补真实证据。',
    checks: {
      customer_specific: Boolean(customerLanguage || buyerObjection),
      evidence_grounded: Boolean(proofAsset),
      platform_specific: Boolean(platform && strategy.why),
      measurable: Array.isArray(strategy.observe_metrics) && strategy.observe_metrics.length > 0,
    },
  };
};

const auditChecksForPublish = ({ platform = '', topic = '', angle = '', cta = '', qualityNote = '', assessment = {} } = {}) => {
  const text = [topic, angle, cta, qualityNote].filter(Boolean).join(' ');
  const service = serviceTopicFor([assessment.industry, assessment.main_goal, assessment.offer].filter(Boolean).join(' '), assessment.offer || '');
  const checks = [];
  const add = (level, label, message, suggestion) => checks.push({ level, label, message, suggestion });

  if (/微信|VX|v信|手机号|电话|二维码|扫码|加我|站外|私域|联系方式|主页电话|[1][3-9]\d{9}/i.test(text)) {
    add('high', '联系方式/站外导流风险', '内容里可能出现联系方式、二维码或站外承接表达。', '改成“主页咨询”或“咨询具体情况”，发布前去掉电话、二维码和联系方式。');
  }
  if (/最强|最好|第一|唯一|全网|顶级|100%|百分百|一定|保证|包过|包会|立刻|马上见效|永久/.test(text)) {
    add('medium', '绝对化用词风险', '内容里可能有绝对化或承诺式表达。', '改成“通常、适合、可以先观察、建议对照”这类更稳妥表达。');
  }
  if (/评论区|留言|关键词|领取|暗号|扣\d|回复/.test(text)) {
    add('medium', '互动诱导风险', '内容里可能出现平台容易误判的互动诱导。', '改成“保存这份清单”“主页咨询”“对照这几项判断”。');
  }
  if (['youth_basketball', 'martial_arts', 'education'].includes(service.type) && /保证|一定|速成|快速变强|明显提升|长高|升学|包会/.test(text)) {
    add('medium', '培训效果承诺风险', '课程类内容不宜承诺确定结果或速成效果。', '改成课堂过程、适合人群、体验观察和阶段目标。');
  }

  if (String(platform).includes('小红书')) {
    add('info', '小红书发布前自查', '封面和正文要避免电话、二维码、过大 logo、水印和夸张承诺。', '发布前人工看一遍封面、首图、正文第一段和结尾动作。');
  }
  if (!checks.length) {
    add('info', '发布前自查', '暂未命中明显高风险词，但仍建议发布前人工复核。', '重点检查标题是否具体、素材是否真实、结尾是否自然承接咨询。');
  }
  return checks;
};

const publishAuditFor = (input = {}) => {
  const platform = input.platform || '';
  const checks = auditChecksForPublish(input);
  const hasHigh = checks.some((item) => item.level === 'high');
  const hasMedium = checks.some((item) => item.level === 'medium');
  const riskLevel = hasHigh ? 'high' : hasMedium ? 'medium' : 'low';
  const riskLabel = riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '低风险';
  return {
    platform: platform || '当前平台',
    risk_level: riskLevel,
    risk_label: riskLabel,
    summary: riskLevel === 'low'
      ? '低风险：未命中明显高风险表达，发布前仍需人工复核素材。'
      : `${riskLabel}：建议先按提示改文案或封面，再发布。`,
    checks,
    disclaimer: '这是经验规则检查，不代表平台官方审核结果。',
  };
};

const customerReasoningFor = ({ assessment = {}, ctx = {}, merchantProfile = {}, strategyQuality = {}, title = '', angle = '', platform = '', experimentType = '', strategy = {}, cta = '' } = {}) => {
  const pain = assessment.customer_pain || assessment.biggest_problem || merchantProfile.bottleneck || '当前卡点';
  const service = merchantProfile.service_name || ctx.primary_offer || assessment.offer || '服务';
  const audience = shortAudience(assessment.target_customer || merchantProfile.audience || '目标客户');
  const proof = merchantProfile.proof_assets?.[0] || assessment.content_assets || assessment.best_recent_content || '真实案例、过程或客户问题';
  return {
    customer_voice_basis: strategyQuality.customer_language_used
      ? `优先回应客户真实表达「${strategyQuality.customer_language_used}」，不把行业标签当成客户洞察。`
      : `当前客户原话较少，先围绕「${pain}」做小样本验证，发布后再用真实提问校准。`,
    pain_basis: `围绕「${audience}」的「${pain}」展开，不再套通用行业模板。`,
    proof_basis: strategyQuality.proof_asset_used
      ? `本条可使用「${strategyQuality.proof_asset_used}」作为证据，不额外编造案例或效果。`
      : '当前可用证据不足，只讲真实过程、适合人群和判断边界，不虚构结果。',
    platform_basis: strategy.why || `${platform || '当前平台'}适合先验证客户是否愿意停下来看「${service}」相关问题。`,
    conversion_basis: `结尾动作指向「${cta || merchantProfile.conversion_action || '咨询具体情况'}」，目标是把浏览变成有效咨询。`,
    validation_goal: `本条重点验证「${title || service}」是否能带来${(strategy.observe_metrics || ['曝光','收藏','咨询']).slice(0, 3).join('、')}信号。`,
    decision_rule: strategyQuality.decision_rule || strategy.next_adjustment || '数据一般时先调整标题和开头，再补真实证据。',
    publish_note: `发布前补充${proof}，并检查平台规则、封面和承诺用语。`,
    merchant_profile: {
      service_type: merchantProfile.service_type,
      bottleneck: merchantProfile.bottleneck,
      conversion_action: merchantProfile.conversion_action,
      experiment_type: experimentType,
    },
  };
};

const growthGapPromptsFor = (assessment = {}, ctx = inferBusinessContext(assessment)) => {
  const gaps = [];
  if (!assessment.offer) gaps.push('转化入口缺失：未填写主推产品/服务，已按业务目标推断；发布前建议补一句“咨询什么/预约什么/怎么买”。');
  if (!assessment.content_assets && !assessment.best_recent_content) gaps.push('信任资产缺失：缺少真实案例、过程素材或客户反馈，第一轮内容只能先验证方向，不能冒充强背书。');
  if (!assessment.customer_pain) gaps.push('客户顾虑缺失：系统会按行业常见问题生成，但下一轮应补真实咨询问题。');
  if (!assessment.current_channels || assessment.current_channels.includes('还不确定')) gaps.push('平台选择缺失：先用抖音/小红书/视频号做小样本，不把单个平台结果当最终结论。');
  if (!assessment.best_recent_content) gaps.push('复盘数据缺失：没有历史胜出内容，7天计划会覆盖多种测试方向，发布后必须回填数据再判断。');
  if (ctx.confidence < 0.7) gaps.push('差异化缺口：业务信息较少，建议补充服务特色、价格边界或真实案例，避免内容像通用模板。');
  return gaps;
};

const enrichPlanRow = ({ row, index, platform, assessment, diagnosis }) => {
  const ctx = diagnosis?.smart_context || inferBusinessContext(assessment || {});
  const experimentType = growthExperimentTypes[index % growthExperimentTypes.length];
  const strategy = platformStrategyFor(platform, ctx);
  const title = row[0];
  const angle = row[1];
  const contentType = row[2] || strategy.content_type;
  const cta = row[3] || '主页咨询具体情况';
  const targetMetric = row[4] || strategy.observe_metrics.join(' / ');
  const merchantProfile = merchantProfileFor(assessment || {}, ctx);
  const qualityContext = strategyQualityContextFor(assessment || {}, ctx, merchantProfile);
  const strategyQuality = strategyQualityForPlan({
    qualityContext,
    index,
    title,
    platform,
    experimentType,
    strategy,
  });
  const customerReasoning = customerReasoningFor({
    assessment,
    ctx,
    merchantProfile,
    title,
    angle,
    platform,
    experimentType,
    strategy,
    strategyQuality,
    cta,
  });
  const publishAudit = publishAuditFor({
    platform,
    topic: title,
    angle,
    cta,
    qualityNote: row[6],
    assessment,
  });
  return {
    experiment_type: experimentType,
    target_customer: assessment?.target_customer || ctx.target_customer || '目标客户',
    growth_goal: assessment?.main_goal || '获得更多有效咨询',
    content_hypothesis: experimentType + '测试：如果「' + title + '」能击中' + (ctx.customer_decision_scene || '客户决策场景') + '，' + platform + '应出现' + strategy.observe_metrics.slice(0, 2).join('和') + '信号。',
    recommended_platform: platform,
    why_platform_fit: strategy.why,
    platform_expression: strategy.expression,
    observe_metrics: strategy.observe_metrics,
    next_adjustment: strategy.next_adjustment,
    content_brief: platform + '｜' + experimentType + '｜' + angle + '｜' + cta,
    content_type: contentType,
    target_metric: targetMetric,
    merchant_profile: merchantProfile,
    strategy_quality: strategyQuality,
    customer_reasoning: customerReasoning,
    publish_audit: publishAudit,
  };
};

const accountSetupFor = (assessment, recommendations) => {
  const isMeta = isMetaMarketingAccount(assessment);
  const primary = recommendations?.primary?.[0]?.platform || '小红书';
  const preference = assessment.account_preference || '';
  const accountName = preference || (isMeta ? '内容决策局' : `${assessment.company_name || '品牌'}内容增长号`);
  const positioning = isMeta
    ? '企业内容增长 / 企业获客 / AI营销复盘'
    : `${assessment.industry || '当前行业'}内容获客与客户信任建立`;
  const bioLines = isMeta ? [
    '📌 研究内容怎么真正带来客户',
    '🤖 用AI做选题、复盘和增长实验',
    '📈 不只追爆款，更看咨询和转化',
  ] : [
    `📌 专注${assessment.industry || '行业'}客户问题`,
    `📈 分享案例、避坑和${assessment.offer || '服务方案'}`,
    '💬 有需求先咨询具体情况',
  ];
  return {
    module_version: APP_VERSION,
    account_name: accountName,
    positioning,
    bio_lines: bioLines,
    homepage_keywords: isMeta ? ['内容获客', 'AI复盘', '企业增长', '咨询转化'] : ['客户问题', '真实案例', '服务入口', '咨询转化'],
    avatar_direction: isMeta
      ? '小红书精致感图标：内容卡片 + 决策指针 + AI节点 + 增长箭头；头像不放文字。'
      : '用品牌/服务核心符号做简洁头像，不堆文字，不做廉价营销海报。',
    starting_platform: {
      platform: primary,
      reason: recommendations?.primary?.[0]?.reason || '先选择一个主平台跑7天小样本，避免多平台分散。',
      rule: platformStyleRulesFor(primary),
    },
    naming_warning: '对外称呼优先用老板、企业主、商家、门店老板、企业负责人，保持专业和尊重。',
    scope_note: '账号基础设置是发布前门禁：定位、简介、主页关键词、头像方向和起步主平台先确认，再生成内容。',
  };
};

const loopScoreFromFeedback = () => {
  const plans = currentPlans();
  const planIds = plans.map((plan) => plan.id);
  const totalPlans = plans.length;
  const published = plans.filter((plan) => plan.status === '已发布' && plan.publish_link).length;
  const rows = latestFeedbackRows(planIds);
  const totalConsultations = rows.reduce((sum, item) => sum + Number(item.consultations || 0), 0);
  const totalInteractions = rows.reduce((sum, item) => sum + Number(item.likes || 0) + Number(item.comments || 0) + Number(item.favorites || 0) + Number(item.shares || 0), 0);
  let score = 8;
  if (totalPlans) score += Math.round((published / totalPlans) * 35);
  if (rows.length) score += 12;
  if (totalInteractions > 0) score += 10;
  if (totalConsultations > 0) score += 20;
  if (state.reviews.length) score += 15;
  return Math.max(0, Math.min(100, score));
};

const recommendPlatforms = (assessment) => {
  const accountText = [
    assessment.industry,
    assessment.main_goal,
    assessment.offer,
    assessment.customer_pain,
    assessment.content_assets,
    assessment.store_location,
    assessment.course_schedule,
    assessment.coach_credentials,
    assessment.extra_context,
  ].filter(Boolean).join(' ');
  const targetText = assessment.target_customer || '';
  const current = platformsFor(assessment.current_channels);
  const primary = [];
  const support = [];
  const avoid = [];
  const clientPlatforms = [];

  const addClient = (platform, reason) => addPlatform(clientPlatforms, platform, reason);

  if (isMetaMarketingAccount(assessment)) {
    addPlatform(primary, '小红书', '适合验证老板/企业主痛点、搜索型方法论、收藏型复盘内容。');
    addPlatform(primary, '视频号', '适合用老板口播和案例复盘建立专业信任。');
    addPlatform(primary, '朋友圈/私域', '适合承接熟人信任、案例展示和轻咨询转化。');
    addPlatform(support, '抖音', '可后置验证短视频曝光，不作为第一轮主阵地。');
    addPlatform(avoid, '美团/大众点评', '这是本地商家的承接平台，不是企业营销工具验证号自身的发布平台。');
    addPlatform(avoid, 'B站', '长内容生产成本高，不适合作为30天闭环验证主阵地。');
    if (hasAny(targetText, ['本地生活', '门店', '到店', '商家'])) addClient('美团/大众点评', '若客户本身是本地到店商家，可作为客户侧搜索承接平台。');
  } else if (hasAny(accountText, ['口腔', '牙', '门诊', '种植', '矫正', '正畸'])) {
    addPlatform(primary, '小红书', '适合做本地宝妈种草、儿童矫正避坑、医生专业信任内容。');
    addPlatform(primary, '美团/大众点评', '适合承接已有到店意图的用户，重点优化套餐、评价和门店转化。');
    addPlatform(primary, '朋友圈/私域', '适合做老客转介绍、客户案例、活动提醒和信任维护。');
    addPlatform(support, '抖音', '可用于医生出镜科普和案例讲解，但需要稳定短视频生产能力。');
    addPlatform(support, '视频号', '适合微信生态内的熟人关系转化和本地信任沉淀。');
    addPlatform(avoid, '公众号', '冷启动慢，不适合作为30天内快速获客主渠道。');
    addPlatform(avoid, 'B站', '内容生产成本高，短期本地咨询转化弱。');
  } else if (hasAny(accountText, ['美业', '美甲', '美睫', '美容', '皮肤管理', '医美', '产康', '纹眉', '半永久'])) {
    addPlatform(primary, '小红书', '适合承接同城搜索、效果案例、避坑清单和价格顾虑。');
    addPlatform(primary, '抖音', '适合用短视频放大同城曝光，展示服务过程、环境和前后变化。');
    addPlatform(primary, '朋友圈/私域', '适合老客复购、转介绍、活动提醒和信任维护。');
    addPlatform(support, '美团/大众点评', '适合承接到店意图，重点优化套餐、评价和门店页转化。');
    addPlatform(support, '视频号', '适合微信生态内做案例沉淀和熟人信任。');
    addPlatform(avoid, 'B站', '本地到店转化链路较长，不建议作为第一主阵地。');
  } else if (hasAny(accountText, ['篮球销售', '卖篮球', '篮球售卖', '篮球零售', '篮球专卖', '篮球店', '篮球用品', '篮球器材', '篮球装备', '篮球商品', '训练篮球', '比赛篮球'])) {
    addPlatform(primary, '小红书', '适合做篮球选购避坑、学生党预算、场地适配和搜索收藏。');
    addPlatform(primary, '抖音', '适合用短视频展示篮球手感、弹跳、防滑、耐磨和实拍测评。');
    addPlatform(primary, '朋友圈/私域', '适合库存、价格、团购、学生社群和老客复购承接。');
    addPlatform(support, '视频号', '适合微信生态内做产品测评、使用场景和私域转化。');
    addPlatform(support, '淘宝/微信小店', '适合作为下单承接入口，不替代内容种草。');
    addPlatform(avoid, '美团/大众点评', '篮球商品销售不以到店评价为主，除非有强线下门店和同城取货。');
    addPlatform(avoid, 'B站', '测评内容可长期沉淀，但不适合作为第一轮拿订单主渠道。');
  } else if (hasAny(accountText, ['宠物店', '宠物洗护', '宠物美容', '宠物寄养', '宠物用品', '宠物护理', '洗护套餐', '猫狗', '养猫', '养狗', '猫咪', '狗狗'])) {
    addPlatform(primary, '小红书', '适合同城养宠人搜索洗护避坑、寄养环境、价格透明和真实案例。');
    addPlatform(primary, '美团/大众点评', '适合承接附近搜索、评价、套餐和到店预约转化。');
    addPlatform(primary, '朋友圈/私域', '适合老客复购、寄养档期、洗护预约和客户反馈维护。');
    addPlatform(support, '视频号', '适合沉淀门店环境、服务过程和熟人信任。');
    addPlatform(support, '抖音', '可用洗护前后对比和门店日常做同城曝光，但要承接到咨询预约。');
    addPlatform(avoid, 'B站', '本地到店链路较长，不建议作为第一轮洗护/寄养咨询主阵地。');
  } else if (hasAny(accountText, ['饰品', '首饰', '耳饰', '耳环', '项链', '手链', '戒指', '发夹', '配饰', '珠宝', '银饰', '穿搭配件', '女装', '服装', '包包', '鞋履', '买手店', '香薰', '礼物', '零售', '上新'])) {
    addPlatform(primary, '小红书', '适合做款式种草、穿搭场景、礼物清单和搜索收藏。');
    addPlatform(primary, '抖音', '适合用短视频展示佩戴/上身效果、上新和场景搭配，放大曝光。');
    addPlatform(primary, '朋友圈/私域', '适合新品上架、老客复购、询价和订单承接。');
    addPlatform(support, '视频号', '适合沉淀品牌审美、上新讲解和私域转化。');
    addPlatform(support, '淘宝/微信小店', '适合作为下单承接入口，不替代内容种草。');
    addPlatform(avoid, '美团/大众点评', '商品零售不以到店评价为主，除非有强线下门店场景。');
    addPlatform(avoid, 'B站', '内容生产成本高，不适合作为第一轮曝光拿订单主渠道。');
  } else if (isMartialArtsText(accountText)) {
    addPlatform(primary, '抖音', '适合用课堂训练片段、教练防护动作、孩子专注变化和同城短视频放大曝光。');
    addPlatform(primary, '小红书', '适合做家长决策清单、安全保护、体验课避坑和本地搜索收藏。');
    addPlatform(primary, '视频号', '适合微信生态家长转化、教练讲解、课堂秩序展示和熟人推荐。');
    addPlatform(support, '朋友圈/私域', '适合跟进体验课、班型名额、家长反馈和转介绍报名。');
    addPlatform(support, '美团/大众点评', '如有线下场馆，可承接同城搜索、评价和体验课团购。');
    addPlatform(avoid, 'B站', '适合长期教学资产，不适合短期体验课预约主渠道。');
  } else if (isYouthBasketballText(accountText)) {
    addPlatform(primary, '抖音', '建议优先验证抖音，适合用课堂训练画面、孩子变化和同城短视频放大曝光。');
    addPlatform(primary, '小红书', '建议同步验证小红书；平台用户与6-12岁孩子家长决策场景匹配，适合家长信任、种草收藏和体验课转化。');
    addPlatform(primary, '视频号', '适合微信生态家长转化、教练出镜讲解、课堂片段、熟人推荐和本地社群传播。');
    addPlatform(support, '朋友圈/私域', '适合跟进体验课、班型名额、家长反馈和转介绍报名。');
    addPlatform(support, '美团/大众点评', '如有线下门店/场馆，可承接同城搜索、评价和体验课团购。');
    addPlatform(avoid, 'B站', '适合长期教学资产，不适合短期体验课预约主渠道。');
  } else if (hasAny(accountText, ['医疗器械', '医械', '器械检测', '医疗检测', '注册检验', '注册检测', '注册认证', '产品注册', '安规认证', '安规验证', 'ce认证', 'fda注册', 'iso13485', '质量体系'])) {
    addPlatform(primary, '视频号', '适合在微信生态内沉淀专业信任，承接企业负责人、注册负责人和质量负责人的熟人转介绍咨询。');
    addPlatform(primary, '公众号', '适合沉淀医疗器械注册/检测/认证的长周期信任内容和搜索型资料。');
    addPlatform(primary, '朋友圈/私域', '适合跟进企业线索、展示案例节点和承接一对一咨询转化。');
    addPlatform(support, '小红书', '可后置验证搜索型避坑内容，但不作为第一轮B2B线索主阵地。');
    addPlatform(support, '抖音', '可用于案例拆解和合规风险短视频，但需控制专业准确性。');
    addPlatform(avoid, '美团/大众点评', '医疗器械检测/注册/安规认证不是到店消费，不适合作为主发布平台。');
  } else if (hasAny(accountText, ['安标', '安全生产标准化', '安全标准化', '安全生产', '验厂', '认证辅导', '合规辅导', '工厂合规'])) {
    addPlatform(primary, '抖音', '适合用短视频讲清安标/验厂/合规风险、整改过程和企业负责人关心的真实案例。');
    addPlatform(primary, '视频号', '适合微信生态内沉淀专业信任，承接企业负责人和熟人转介绍咨询。');
    addPlatform(primary, '朋友圈/私域', '适合跟进企业线索、展示整改案例和承接咨询转化。');
    addPlatform(support, '小红书', '可作为搜索型知识沉淀后置验证，不作为P03安标第一轮主平台。');
    addPlatform(avoid, '美团/大众点评', '安标合规辅导不是到店消费，不适合作为主发布平台。');
  } else if (hasAny(accountText, ['餐饮', '饭店', '餐厅', '咖啡', '茶饮', '火锅', '烧烤', '烘焙', '甜品', '小吃'])) {
    addPlatform(primary, '抖音', '适合用同城短视频放大菜品、环境、活动和到店氛围。');
    addPlatform(primary, '小红书', '适合做同城探店、收藏清单、场景种草和菜单决策内容。');
    addPlatform(primary, '美团/大众点评', '适合承接搜索、评价、团购和到店转化。');
    addPlatform(support, '朋友圈/私域', '适合老客复购、会员活动和社群触达。');
    addPlatform(support, '视频号', '适合老板/门店日常和微信生态活动承接。');
    addPlatform(avoid, 'B站', '短期到店效率低，除非已有长视频内容能力。');
  } else if (hasAny(accountText, ['教育', '培训', '课程', '报名', '留学', '考试', '教培', '托管', '素质教育'])) {
    addPlatform(primary, '小红书', '适合用学习经验、避坑、家长疑问和案例内容承接主动搜索。');
    addPlatform(primary, '视频号', '适合家长/熟人圈层转化、直播讲解和信任沉淀。');
    addPlatform(primary, '朋友圈/私域', '适合跟进试听、答疑、转介绍和报名转化。');
    addPlatform(support, '抖音', '适合扩大曝光，但需要高频短视频和强钩子。');
    addPlatform(avoid, 'B站', '适合长期知识资产，不适合短期报名转化主渠道。');
  } else if (hasAny(accountText, ['本地', '到店', '门店', '附近', '同城', '本地生活', '家政', '维修', '摄影', '宠物', '体验课'])) {
    addPlatform(primary, '小红书', '适合做同城种草、案例体验和痛点搜索承接。');
    addPlatform(primary, '朋友圈/私域', '适合做熟人信任、老客复购和转介绍。');
    addPlatform(primary, '抖音', '适合用短视频放大同城曝光，但要控制内容节奏和转化入口。');
    addPlatform(support, '美团/大众点评', '适合有到店需求时承接搜索和评价转化。');
    addPlatform(avoid, 'B站', '本地短期获客效率较低，不建议作为第一主阵地。');
  } else {
    current.slice(0, 3).forEach((platform) => addPlatform(primary, platform, '这是当前已有平台，1.0先用它低成本验证内容反馈。'));
    if (!current.length && primary.length < 3) addPlatform(primary, '小红书', '适合验证用户痛点、案例和搜索型内容反馈。');
    addPlatform(support, '朋友圈/私域', '适合承接信任、复购和轻咨询转化。');
    addPlatform(support, '视频号', '适合沉淀微信生态信任和私域承接。');
    addPlatform(support, '美团/大众点评', '如果属于到店服务，可作为搜索评价和转化承接平台。');
    addPlatform(avoid, 'B站', '内容生产周期较长，除非已有稳定长内容能力，否则暂不作为第一优先。');
  }

  const covered = primary.filter((item) => current.includes(item.platform) || item.platform.split('/').some((part) => current.includes(part))).map((item) => item.platform);
  let strategy = '先区分“本账号发布平台”和“目标客户可能适用平台”；当前更适合先做信任建立 + 有效咨询转化，不只追求曝光。';
  if (current.length && covered.length) strategy += ` 已填写平台中「${covered.join('、')}」可以优先保留。`;
  else if (current.length) strategy += ' 已填写平台和系统优先平台不完全一致，建议先按推荐平台做一周小样本验证。';
  return { strategy, primary: primary.slice(0, 3), support: support.slice(0, 3), avoid: avoid.slice(0, 3), client_platforms: clientPlatforms.slice(0, 3) };
};

const platformCore = (s) => String(s || '').split(/[\/、,，]/)[0].trim();
const platformMatch = (a, b) => {
  const ca = platformCore(a), cb = platformCore(b);
  return Boolean(ca) && (ca === cb || String(a).includes(cb) || String(b).includes(ca));
};
const planPlatforms = (recommendations, fallbackChannels) => {
  // 用户明确选了平台 → 只用用户选中的；保留推荐里的规范名/优先序，所选中推荐没有的补在后面。
  const chosen = platformsFor(fallbackChannels).filter((p) => p && !/不确定/.test(p));
  let parsed = recommendations;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { parsed = null; }
  }
  const primary = (parsed?.primary || []).map((item) => item.platform).filter(Boolean);
  if (chosen.length) {
    const recFiltered = primary.filter((p) => chosen.some((c) => platformMatch(p, c)));
    const extras = chosen.filter((c) => !primary.some((p) => platformMatch(p, c)));
    const result = [...recFiltered, ...extras];
    return result.length ? result : chosen;
  }
  return primary.length ? primary : ['小红书'];
};

const inferBusinessContext = (assessment = {}) => {
  const text = [
    assessment.industry,
    assessment.main_goal,
    assessment.offer,
    assessment.target_customer,
    assessment.customer_pain,
    assessment.content_assets,
    assessment.store_location,
    assessment.course_schedule,
    assessment.coach_credentials,
    assessment.best_recent_content,
  ].filter(Boolean).join(' ');
  const service = serviceTopicFor(text, assessment.offer || '');
  const target = shortAudience(assessment.target_customer || '目标客户');
  const isGoods = ['basketball_goods', 'fashion_accessory', 'aesthetic_retail'].includes(service.type);
  const isLocalService = ['nail', 'lash', 'beauty', 'postpartum', 'photo', 'dental', 'localfood', 'pet_service'].includes(service.type);
  const isTraining = ['youth_basketball', 'martial_arts', 'education'].includes(service.type);
  const isComplianceService = ['medical_device_compliance', 'safety_compliance'].includes(service.type);
  const isMeta = isMetaMarketingAccount(assessment);
  const missingInfo = [];
  if (!assessment.offer) missingInfo.push('主推产品/服务或价格带');
  if (!assessment.target_customer) missingInfo.push('目标客户');
  if (!assessment.customer_pain) missingInfo.push('客户最常问的问题/顾虑');
  if (!assessment.content_assets && !assessment.best_recent_content) missingInfo.push('现有素材或近期表现最好内容');

  let businessType = '专业服务/本地服务';
  let offerType = '服务/咨询';
  let decisionScene = `${target}在选择${service.service}前需要降低风险感`;
  let conversionAction = '咨询具体情况 / 主页咨询 / 预约';
  let contentTask = '用痛点、案例、流程透明和FAQ建立信任';

  if (isGoods) {
    businessType = '商品零售/产品销售';
    offerType = '商品/SKU';
    decisionScene = `${target}下单前比较款式、价格、材质、使用场景和真实效果`;
    conversionAction = '咨询询价 / 确认库存 / 下单';
    contentTask = '用选购避坑、场景清单、参数对比和上新种草推动询单';
  } else if (isTraining) {
    businessType = '教育培训/体验课';
    offerType = '课程/体验课';
    decisionScene = `${target}报名前会比较安全、师资、班型、效果边界和孩子适应度`;
    conversionAction = '预约体验课 / 咨询年龄基础和上课时间';
    contentTask = service.type === 'martial_arts'
      ? '用家长安全顾虑、课堂秩序、防护细节、教练分层和体验课观察降低报名阻力'
      : '用家长顾虑、课堂片段、训练价值和体验课观察降低报名阻力';
  } else if (isLocalService) {
    businessType = '本地到店服务';
    offerType = '到店项目/预约服务';
    decisionScene = `${target}到店前关注价格、效果、过程、卫生/专业度和真实案例`;
    conversionAction = '预约到店 / 咨询预算和时间';
    contentTask = '用真实案例、过程透明、价格边界和本地场景承接预约';
  } else if (isComplianceService) {
    businessType = service.type === 'medical_device_compliance' ? 'B2B医疗器械合规服务' : 'B2B企业合规服务';
    offerType = '检测/认证/注册/合规咨询服务';
    decisionScene = `${target}选择${service.service}前会优先确认资质、流程节点、风险边界、案例可信度和交付周期`;
    conversionAction = '预约初步评估 / 提交产品或企业基础信息 / 进入方案沟通';
    contentTask = '用资质流程、风险避坑、节点清单和真实案例建立B2B专业信任';
  }
  if (isMeta) {
    businessType = '企业营销增长工具';
    offerType = '诊断/策略/复盘系统';
    decisionScene = '老板/企业主判断内容是否真的带来客户，而不是只看点赞曝光';
    conversionAction = '提交业务信息 / 记录内容效果 / 进入复盘';
    contentTask = '用方法论、案例拆解和数据复盘证明增长判断能力';
  }

  const bottleneck = priorityFor(assessment.biggest_problem || '');
  const riskGates = [];
  if (service.type === 'basketball_goods') riskGates.push('禁止写成篮球培训、体验课、教练、班型或到店服务流程');
  if (service.type === 'youth_basketball') riskGates.push('必须写给家长，禁止写成篮球商品下单或器材销售');
  if (service.type === 'martial_arts') riskGates.push('必须写武术/搏击课堂、安全保护、教练分层和体验课观察，禁止出现篮球课、运球、投篮、篮筐等错行业词');
  if (service.type === 'pet_service') riskGates.push('必须围绕宠物洗护/寄养/门店信任，禁止写成泛商品款式或其他行业样例');
  if (service.type === 'medical_device_compliance') riskGates.push('必须写给企业决策/注册/质量负责人，禁止写成C端种草、到店预约或泛营销焦虑');
  if (isGoods) riskGates.push('商品零售类内容必须指向款式/参数/场景/询价/订单，不能套服务预约模板');
  if (!isMeta) riskGates.push('内容必须写给客户的目标客户，不能写老板经营焦虑或工具复盘话术');

  const confidence = Math.max(0.42, Math.min(0.92, 0.48 + (assessment.offer ? 0.12 : 0) + (assessment.target_customer ? 0.12 : 0) + (assessment.customer_pain ? 0.10 : 0) + (assessment.content_assets ? 0.06 : 0) + (assessment.best_recent_content ? 0.04 : 0)));
  return {
    module: 'internal_smart_diagnosis_kernel',
    business_type: businessType,
    category: service.service,
    offer_type: offerType,
    primary_offer: assessment.offer || service.service,
    target_customer: assessment.target_customer || target,
    customer_decision_scene: decisionScene,
    conversion_action: conversionAction,
    content_task: contentTask,
    growth_bottleneck: bottleneck,
    missing_info: missingInfo,
    risk_gates: riskGates,
    confidence,
  };
};

const applyInternalSmartDiagnosis = (diagnosis, assessment) => {
  const ctx = inferBusinessContext(assessment);
  diagnosis.smart_context = ctx;
  diagnosis.score_note = `内测智能诊断：先识别业务类型/交易链路/客户决策场景，再生成策略；置信度 ${Math.round(ctx.confidence * 100)}%。`;
  diagnosis.insight = `系统判断这不是单纯的“${assessment.industry || '行业'}模板”，而是「${ctx.business_type}」场景：${ctx.customer_decision_scene}。当前核心瓶颈是「${ctx.growth_bottleneck}」，内容任务应转向：${ctx.content_task}。`;
  diagnosis.weekly_action = `本轮按「${ctx.category}」的真实成交链路设计一组小样本内容：先覆盖决策顾虑，再验证哪类内容能带来「${ctx.conversion_action}」。`;
  diagnosis.next_step = ctx.missing_info.length
    ? `先补齐「${ctx.missing_info.slice(0, 3).join('、')}」，再把内容计划细化到具体产品/服务和价格带。`
    : `直接进入本轮内容实验：每条内容都绑定一个顾虑、一个素材证据和一个转化动作「${ctx.conversion_action}」。`;
  diagnosis.risk_warning = ctx.risk_gates.join('；') || '不要按泛行业模板输出，必须基于客户目标客户的购买/预约决策生成内容。';
  return diagnosis;
};

const planTemplates = (priority, industry, goal, target, offer, pain, problem = '', benchmarkReference = null) => {
  const audience = shortAudience(target);
  const painShort = painLabel(pain, problem);
  const serviceSource = [industry, pain, problem].filter(Boolean).join(' ');
  const benchmarkTheme = benchmarkReference?.recent_topics?.[0]?.replace(`${audience}对「`, '').replace('」类问题有明确兴趣', '');
  const cta = softCta(offer, painShort);
  const isMeta = isMetaMarketingAccount({ industry: serviceSource, main_goal: goal, offer });
  if (!isMeta) {
    const titles = naturalPlanTitles({ audience, industry: serviceSource, offer, painShort, goal });
    const service = serviceTopicFor(serviceSource, offer);
    const items = customerPlanRowsFor({ titles, service, offer });
    if (priority === '曝光不足') {
      if (service.type === 'basketball_goods') items[0] = [titles[0], '打开率验证：用学生/爱好者买篮球时正在犹豫的场地、手感、耐磨和预算问题做标题', '图文/短视频', items[0][3], '曝光/收藏', '需要人工润色', '必须出现篮球商品、场地或选购参数'];
      else items[0] = [titles[0], '打开率验证：用目标客户正在搜索/犹豫的问题做标题，不写内容曝光问题', '图文/短视频', items[0][3], '曝光/收藏', '需要人工润色', '只优化给终端客户看的第一眼表达'];
    }
    if (benchmarkTheme) {
      items[0] = [`${audience}为什么会关注「${benchmarkTheme}」？`, '对标校准：提炼终端顾客已验证的真实疑问，转译为本客户服务场景', '图文/短视频', items[0][3], '收藏/咨询', '需要人工润色', '只借鉴结构，不复制标题和素材'];
      items[1] = [`选择${offer}前，先看清这3个真实问题`, '选择清单：把高互动问题改写成目标客户的购买/到店/报名决策清单', '图文', `保存这条，决策前对照检查；需要可咨询「${offer}」。`, '收藏/咨询', '需要人工润色', '不写老板复盘，不写内容运营问题'];
    }
    return items;
  }
  const items = [
    [`企业主发内容没咨询，通常不是内容太少`, `痛点诊断：围绕「${painShort}」拆出内容与获客断点`, '图文', cta, '收藏/评论', '需要人工润色', '策略方向可用，发布前需补充真实案例或老板经验'],
    [`老板用AI写文案前，先想清楚这3个获客问题`, '误区拆解：区分内容产出和获客转化', '图文', cta, '收藏数', '需要人工润色', '适合作为方法论选题，避免写成AI工具教程'],
    [`一条内容有没有获客价值，不是看点赞`, '复盘方法：用收藏、评论、咨询判断需求信号', '图文', '发布后记录浏览、收藏、咨询、咨询四个数据，再决定下一条怎么改。', '收藏/咨询', '可直接进入草稿', '主题清晰，可用于验证复盘能力'],
    [`企业账号别只发产品，先回答客户正在犹豫什么`, `选题转译：把「${painShort}」改写成客户看得懂的问题`, '图文/短视频', cta, '评论数', '需要人工润色', '需要补充具体行业例子'],
    [`老板没时间做运营，也能先复盘这4个数`, '低成本流程：发布-回填-复盘-下条调整', '图文', '需要复盘表时，可以咨询具体情况。', '咨询/咨询', '可直接进入草稿', '符合闭环验证目标'],
    [`为什么内容火了，客户还是不来问？`, '指标校准：曝光、互动、咨询分层看', '短视频/图文', '不要只问能不能火，先问能不能带来客户信号。', '评论/收藏', '需要人工润色', '适合做认知内容'],
    [`本周哪条内容最接近真实客户需求？`, '复盘公开：把7天反馈转成下周选题依据', '图文', '如果你也想知道内容怎么复盘，可以咨询你现在最卡的点。', '评论/关注', '仅为策略方向', '必须等真实数据回填后再发布'],
  ];
  if (priority === '曝光不足') {
    items[0] = [`${audience}内容没人看，先检查标题有没有说中痛点`, `强钩子：把「${painShort}」放到标题和封面第一眼`, '图文', cta, '曝光数', '需要人工润色', '适合先测标题/封面，不代表已形成闭环'];
  }
  if (benchmarkTheme) {
    items[0] = [`企业主为什么会关注「${benchmarkTheme}」？`, '对标校准：拆出已验证痛点，再转译成企业内容获客场景', '图文', cta, '收藏数', '需要人工润色', '只迁移主题和结构，不照抄原文'];
    items[1] = [`老板做内容前，先确认这3个获客问题`, '结构拆解：痛点直问、避坑清单、案例复盘三类标题', '图文', cta, '收藏/咨询', '可直接进入草稿', '适合做第一轮选题校准'];
  }
  return items;
};

const splitCoCreationList = (value) => (Array.isArray(value) ? value : String(value || '').split(/[,，、\n\r]+/))
  .map((item) => sanitizeCustomerText(item).trim())
  .filter(Boolean);

const normalizeCoCreation = (payload = {}) => {
  const raw = payload.co_creation && typeof payload.co_creation === 'object' ? payload.co_creation : {};
  const selected = sanitizeCustomerText(raw.selected_direction || payload.co_creation_selected_direction || '').trim();
  const avoided = splitCoCreationList(raw.avoided_content || payload.co_creation_avoided_content || '');
  return {
    selected_direction: selected,
    support_direction: sanitizeCustomerText(raw.support_direction || payload.co_creation_support_direction || '').trim(),
    avoided_content: avoided.includes('暂时没有限制') ? [] : avoided,
    customer_emphasis: sanitizeCustomerText(raw.customer_emphasis || payload.co_creation_customer_emphasis || '').trim(),
    confirmed_at: sanitizeCustomerText(raw.confirmed_at || payload.co_creation_confirmed_at || nowIso()).trim(),
  };
};

const hasCoCreation = (co = {}) => Boolean(co.selected_direction || co.support_direction || co.customer_emphasis || (co.avoided_content || []).length);

const coCreationTopicSeeds = (assessment = {}) => {
  const co = assessment.co_creation || {};
  const direction = co.selected_direction || '';
  const emphasis = co.customer_emphasis || '';
  const biz = [assessment.industry, assessment.main_goal, assessment.offer, assessment.target_customer].filter(Boolean).join(' ');
  const audience = shortAudience(assessment.target_customer || '目标客户');
  const service = serviceTopicFor([assessment.industry, assessment.main_goal, assessment.offer].filter(Boolean).join(' '), assessment.offer || '');
  const offer = assessment.offer || service.service || '服务';
  const basketball = service.type === 'youth_basketball';
  const martialArts = service.type === 'martial_arts' || isMartialArtsText(biz);
  const withEmphasis = (rows) => emphasis
    ? [{ topic: `${emphasis}，客户最想先确认什么`, angle: `围绕客户特别强调的「${emphasis}」展开`, cta: basketball ? '引导家长咨询孩子年龄和体验课时间' : martialArts ? '引导家长咨询孩子年龄、基础和体验课时间' : '引导客户咨询具体情况' }, ...rows]
    : rows;
  if (basketball) {
    if (direction.includes('教练') || direction.includes('信任')) {
      return withEmphasis([
        { topic: '少儿篮球课一节课到底怎么练', angle: '用课堂流程建立专业信任', cta: '引导家长咨询体验课安排' },
        { topic: '家长看篮球教练，不只看会不会打球', angle: '解释教练带孩子的安全和分层方法', cta: '引导咨询孩子年龄和基础' },
        { topic: '零基础孩子第一次上篮球课，教练会怎么带', angle: '展示孩子从热身到运球的第一节课过程', cta: '引导预约体验课' },
      ]);
    }
    if (direction.includes('体验') || direction.includes('转化')) {
      return withEmphasis([
        { topic: '少儿篮球体验课，家长预约前最该问什么', angle: '把咨询问题集中到年龄、时间和孩子基础', cta: '引导家长咨询体验课时间' },
        { topic: '周末想给孩子约篮球课，先确认这3件事', angle: '把周末班和体验课转成决策清单', cta: '引导咨询周末可约时间' },
        { topic: '6-12岁孩子适不适合篮球体验课', angle: '明确适合年龄、基础和体验课目标', cta: '引导家长说孩子年龄和运动基础' },
      ]);
    }
    return withEmphasis([
      { topic: '孩子零基础学篮球，家长最担心的3件事', angle: '先回答跟不上、安全和有没有效果', cta: '引导家长咨询孩子年龄和体验课时间' },
      { topic: '孩子不爱运动，篮球启蒙先从哪一步开始', angle: '把家长痛点转成可执行的第一节课', cta: '引导预约体验课' },
      { topic: '家长怕篮球课只是玩一玩，课堂里到底练什么', angle: '用训练内容回应效果顾虑', cta: '引导咨询课程安排' },
    ]);
  }
  if (martialArts) {
    if (direction.includes('教练') || direction.includes('信任')) {
      return withEmphasis([
        { topic: '武术搏击课一节课到底怎么练', angle: '用热身、防护、分层动作和老师反馈建立专业信任', cta: '引导家长咨询体验课安排' },
        { topic: '家长看搏击教练，不只看会不会打', angle: '解释教练带孩子的安全保护、规则感和分层方法', cta: '引导咨询孩子年龄和基础' },
        { topic: '零基础孩子第一次上搏击课，教练会怎么带', angle: '展示从热身到基础动作的第一节课过程', cta: '引导预约体验课' },
      ]);
    }
    if (direction.includes('体验') || direction.includes('转化')) {
      return withEmphasis([
        { topic: '武术搏击体验课，家长预约前最该问什么', angle: '把咨询问题集中到安全保护、适合年龄和课堂强度', cta: '引导家长咨询体验课时间' },
        { topic: '周末想给孩子约搏击课，先确认这3件事', angle: '把周末班和体验课转成决策清单', cta: '引导咨询周末可约时间' },
        { topic: '孩子胆小或好动，适不适合武术搏击体验课', angle: '明确适合人群、基础和体验课观察重点', cta: '引导家长说孩子年龄和性格' },
      ]);
    }
    return withEmphasis([
      { topic: '孩子零基础学武术搏击，家长最担心的3件事', angle: '先回答安全、强度和能不能坚持', cta: '引导家长咨询孩子年龄和体验课时间' },
      { topic: '孩子胆小或坐不住，武术搏击怎么开始', angle: '把家长痛点转成可观察的第一节课', cta: '引导预约体验课' },
      { topic: '家长怕搏击课太激烈，课堂里到底怎么保护', angle: '用防护、护具和教练动作纠正回应顾虑', cta: '引导咨询课程安排' },
    ]);
  }
  if (direction.includes('信任')) {
    return withEmphasis([
      { topic: `${audience}选择${offer}前，最该看哪3个证据`, angle: '用案例、流程和保障建立信任', cta: '引导客户咨询是否适合' },
      { topic: `为什么同样是${offer}，客户会更信任这一种`, angle: '展示服务过程和真实细节', cta: '引导主页咨询' },
      { topic: `${offer}不是越多越好，先看服务过程是否清楚`, angle: '把专业信任讲成客户能看懂的细节', cta: '引导咨询具体情况' },
    ]);
  }
  if (direction.includes('转化') || direction.includes('咨询')) {
    return withEmphasis([
      { topic: `${audience}想咨询${offer}前，通常会先卡在哪一步`, angle: '把下一步行动说清楚', cta: '引导客户咨询是否适合' },
      { topic: `适不适合${offer}，先用这3个问题判断`, angle: '用选择清单承接咨询', cta: '引导客户描述具体情况' },
      { topic: `${offer}怎么开始，客户最需要知道的不是价格`, angle: '先给行动理由和适合人群', cta: '引导主页咨询' },
    ]);
  }
  return withEmphasis([
    { topic: `${audience}最容易误解${offer}的3件事`, angle: '先回答真实顾虑，而不是介绍服务清单', cta: '引导客户咨询具体情况' },
    { topic: `${audience}为什么会迟迟不咨询${offer}`, angle: '拆解客户犹豫点', cta: '引导客户描述自己的情况' },
    { topic: `第一次了解${offer}，先看这几个问题`, angle: '用客户视角降低理解门槛', cta: '引导主页咨询' },
  ]);
};

const violatesCoCreationAvoidance = (row = [], avoided = []) => {
  const text = row.join(' ');
  return avoided.some((item) =>
    (item.includes('价格') && /价格|收费|费用|多少钱/.test(text))
    || (item.includes('露脸') && /露脸|出镜|真人出镜/.test(text))
    || (item.includes('正脸') && /正脸|孩子正脸|学员正脸/.test(text))
    || (item.includes('承诺效果') && /保证|承诺|一定|快速见效|包/.test(text))
  );
};

const applyCoCreationToPlanRows = (rows = [], assessment = {}) => {
  const co = assessment.co_creation || {};
  if (!hasCoCreation(co)) return rows;
  const next = rows.map((row) => [...row]);
  const seeds = coCreationTopicSeeds(assessment);
  seeds.slice(0, 3).forEach((seed, index) => {
    const existing = next[index] || [];
    next[index] = [
      seed.topic || existing[0] || '',
      seed.angle || existing[1] || '',
      existing[2] || '图文/短视频',
      seed.cta || existing[3] || '引导客户咨询具体情况',
      existing[4] || '咨询/预约',
      existing[5] || '可直接进入草稿',
      `客户共创方向：${co.selected_direction || '已确认方向'}${co.customer_emphasis ? `；强调：${co.customer_emphasis}` : ''}`,
    ];
  });
  const avoided = Array.isArray(co.avoided_content) ? co.avoided_content : [];
  return next.map((row, index) => {
    if (!violatesCoCreationAvoidance(row, avoided)) return row;
    const fallback = seeds[index] || seeds[0];
    return [
      fallback?.topic || row[0],
      fallback?.angle || row[1],
      row[2] || '图文/短视频',
      fallback?.cta || row[3] || '引导客户咨询具体情况',
      row[4] || '咨询/预约',
      row[5] || '需要人工润色',
      '已按客户限制调整，去掉绝对化效果表达',
    ];
  });
};

const createAssessment = (payload, clientId = clientIdFrom(payload)) => {
  const required = ['industry', 'main_goal', 'target_customer', 'current_channels', 'biggest_problem'];
  const missing = required.filter((key) => !clean(payload, key));
  if (missing.length) throw new Error(`缺少必填字段：${missing.join(', ')}`);
  const mode = clean(payload, 'client_mode') || clean(payload, '_mode') || clean(payload, 'source');
  const weakPain = !clean(payload, 'customer_pain') || /客户不知道为什么需要现在咨询|待补充|暂无|没有/.test(clean(payload, 'customer_pain'));
  const weakAssets = (!clean(payload, 'content_assets') || /待补充|暂无|没有/.test(clean(payload, 'content_assets'))) && !clean(payload, 'best_recent_content');
  if (mode === 'internal_test') {
    const gateMissing = [];
    if (!clean(payload, 'offer')) gateMissing.push('主推产品/服务和价格带');
    if (weakPain) gateMissing.push('客户最常问的问题或顾虑');
    if (weakAssets) gateMissing.push('现有素材或近期表现最好内容');
    if (gateMissing.length) throw new Error(`生成门禁：请先补齐${gateMissing.join('、')}`);
  }

  const assessment = {
    id: state.next.assessment++,
    client_id: clientId,
    customer_key: normalizeClientId(clean(payload, 'customer_key')) || clientId,
    company_name: clean(payload, 'company_name'),
    industry: clean(payload, 'industry'),
    main_goal: clean(payload, 'main_goal'),
    current_channels: clean(payload, 'current_channels'),
    content_mode: clean(payload, 'content_mode'),
    posting_frequency: clean(payload, 'posting_frequency'),
    biggest_problem: clean(payload, 'biggest_problem'),
    target_customer: clean(payload, 'target_customer'),
    offer: clean(payload, 'offer'),
    store_location: clean(payload, 'store_location'),
    course_schedule: clean(payload, 'course_schedule'),
    coach_credentials: clean(payload, 'coach_credentials'),
    customer_pain: clean(payload, 'customer_pain'),
    content_assets: clean(payload, 'content_assets'),
    extra_context: clean(payload, 'extra_context'),
    monthly_budget: clean(payload, 'monthly_budget'),
    decision_cycle: clean(payload, 'decision_cycle'),
    best_recent_content: clean(payload, 'best_recent_content'),
    account_preference: clean(payload, 'account_preference'),
    benchmark: normalizeBenchmark(payload),
    co_creation: normalizeCoCreation(payload),
    contact: clean(payload, 'contact'),
    client_mode: clean(payload, 'client_mode') || clean(payload, '_mode'),
    source: clean(payload, 'source') || clean(payload, 'client_mode') || clean(payload, '_mode') || 'api_assessment',
    app_version: APP_VERSION,
    created_at: nowIso(),
  };
  state.assessments.unshift(assessment);
  return assessment.id;
};

const generateDiagnosis = (assessmentId) => {
  const assessment = state.assessments.find((item) => item.id === assessmentId);
  if (!assessment) throw new Error('体检记录不存在');
  const priority = priorityFor(assessment.biggest_problem);
  const industry = assessment.industry || '当前行业';
  const goal = assessment.main_goal || '获得更多有效咨询';
  const target = assessment.target_customer || '目标客户';
  const offer = assessment.offer || '明确咨询入口';
  const pain = assessment.customer_pain || assessment.biggest_problem || '当前核心痛点';
  const platformRecommendations = recommendPlatforms(assessment);
  const recommendedChannels = (platformRecommendations.primary || [])
    .map((item) => String(item?.platform || item || '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('、');
  const channels = !assessment.current_channels || assessment.current_channels === '还不确定'
    ? (recommendedChannels || '系统推荐平台')
    : assessment.current_channels;
  const frequency = assessment.posting_frequency || '当前发布频率';
  const benchmarkReference = benchmarkReferenceFor(assessment);
  const businessContext = inferBusinessContext(assessment);
  const merchantProfile = merchantProfileFor(assessment, businessContext);
  const strategyQualityContext = strategyQualityContextFor(assessment, businessContext, merchantProfile);
  const growthGaps = growthGapPromptsFor(assessment, businessContext);
  const diagnosis = {
    id: state.next.diagnosis++,
    client_id: assessment.client_id || 'anonymous',
    app_version: APP_VERSION,
    version_label: VERSION_LABEL,
    assessment_id: assessmentId,
    score: strategyScoreFor(assessment),
    strategy_score: strategyScoreFor(assessment),
    loop_score: loopScoreFor(assessment),
    score_note: '策略清晰度来自输入完整度；闭环成熟度必须发布并回填数据后才会上升。',
    stage: stageFor(assessment.posting_frequency),
    priority_problem: priority,
    insight: '',
    weekly_action: '',
    next_step: '',
    platform_recommendations: platformRecommendations,
    merchant_profile: merchantProfile,
    strategy_quality_context: strategyQualityContext,
    strategy_mvp: {
      target_customer: assessment.target_customer || businessContext.target_customer,
      growth_goal: goal,
      content_hypothesis: `第一轮7天不是平均发内容，而是围绕「${merchantProfile.service_name}」「${merchantProfile.audience}」「${merchantProfile.bottleneck}」验证哪个角度能带来真实咨询。`,
      recommended_platforms: planPlatforms(platformRecommendations, assessment.current_channels),
      growth_gaps: growthGaps,
      seven_day_flywheel: growthExperimentTypes.map((type, index) => ({
        day: 'Day ' + (index + 1),
        experiment_type: type,
        purpose: type === '痛点型'
          ? '验证客户最在意的问题是否成立'
          : type === '效果型'
            ? '验证效果/变化/结果是否能提升兴趣'
            : type === '信任型'
              ? '补资质、案例、流程和风险边界'
              : type === '场景型'
                ? '把服务放进真实使用/决策场景'
                : type === '转化型'
                  ? '明确咨询、预约、到店或下单入口'
                  : type === '异议处理型'
                    ? '处理价格、周期、适不适合等顾虑'
                    : '用回填数据决定下轮加码或暂停',
      })),
      post_publish_review: '发布后回填曝光/播放、点赞、收藏、评论、私信/咨询、预约/到店，系统再判断加码、暂停、改角度或下一轮7天计划。',
    },
    benchmark_reference: benchmarkReference,
    account_setup: accountSetupFor(assessment, platformRecommendations),
    created_at: nowIso(),
  };

  if (priority === '选题不稳定') {
    diagnosis.insight = `当前「${industry}」的核心目标是「${goal}」，但内容还没有稳定围绕「${target}」和「${pain}」做选题验证。`;
    diagnosis.weekly_action = `本周在「${channels}」连续验证 7 条围绕「${target}」痛点、案例和避坑的内容，先验证哪个角度能带来「${goal}」。`;
    diagnosis.next_step = `先建立一周选题池，每条内容都指向「${offer}」，用反馈数据决定下周加码方向。`;
    diagnosis.risk_warning = '不要一开始追求精致大制作；先用低成本内容换真实反馈。';
  } else if (priority === '内容不转化') {
    diagnosis.insight = `当前「${industry}」内容可能有曝光，但没有把「${target}」从「${pain}」自然带到「${offer}」这个行动。`;
    diagnosis.weekly_action = `本周把「${channels}」内容结尾统一改成围绕「${goal}」的明确咨询入口，并记录咨询/咨询数量。`;
    diagnosis.next_step = `把内容结尾改成「${offer}」相关合规咨询/主页咨询入口，并追踪是否真的带来「${goal}」。`;
    diagnosis.risk_warning = '只看播放量会误判，第一版必须把咨询数作为核心反馈字段。';
  } else if (priority === '曝光不足') {
    diagnosis.insight = `当前「${industry}」需要先提升内容第一眼吸引力，让「${target}」一眼看见和自己有关的「${pain}」。`;
    diagnosis.weekly_action = `本周围绕「${pain}」做 7 个不同标题角度，在「${channels}」验证曝光差异。`;
    diagnosis.next_step = `先测标题/封面/开头三要素，再判断是否能承接到「${offer}」。`;
    diagnosis.risk_warning = '曝光不足时不要直接加预算，先确认内容钩子是否成立。';
  } else {
    diagnosis.insight = `当前「${industry}」营销动作还没有把「${channels}」发布、用户反馈和「${goal}」连成复盘闭环。`;
    diagnosis.weekly_action = `本周按「${frequency}」固定发布计划和反馈字段，围绕「${target}」完成一次发布-回填-复盘闭环。`;
    diagnosis.next_step = `每条内容按 T+24 / T+72 / T+7 分阶段回填曝光、互动和咨询，判断是否推动「${goal}」。`;
    diagnosis.risk_warning = '无回填就无法优化，系统会把“未回填”视为未闭环。';
  }

  if (['internal_test', 'internal_regenerate', 'internal_version'].includes(assessment.client_mode || assessment.source)) {
    applyInternalSmartDiagnosis(diagnosis, assessment);
  }

  state.diagnoses.unshift(diagnosis);
  state.current_diagnosis_id = diagnosis.id;
  return diagnosis;
};

const compactPlatformRecommendations = (recommendations = {}) => ({
  strategy: String(recommendations?.strategy || '').slice(0, 80),
  primary: (recommendations?.primary || []).slice(0, 3).map((item) => String(item?.platform || item || '').slice(0, 20)).filter(Boolean),
  support: (recommendations?.support || []).slice(0, 2).map((item) => String(item?.platform || item || '').slice(0, 20)).filter(Boolean),
});

const PLAN_VARIATION_DIRECTIONS = [
  '优先从客户最常问的具体问题切入',
  '优先从常见误区和反常识切入',
  '优先从服务过程与幕后细节切入',
  '优先从选择标准和对比清单切入',
  '优先从本地场景与真实时刻切入',
  '优先从客户犹豫到行动路径切入',
];
const planGenerationVariant = (value = '') => {
  const text = String(value || nowIso());
  const hash = Array.from(text).reduce((total, char) => ((total * 31) + char.codePointAt(0)) >>> 0, 0);
  return PLAN_VARIATION_DIRECTIONS[hash % PLAN_VARIATION_DIRECTIONS.length];
};

const planPromptContext = (assessment = {}, diagnosis = {}) => {
  const businessContext = diagnosis?.smart_context || inferBusinessContext(assessment);
  const merchantProfile = diagnosis?.merchant_profile || merchantProfileFor(assessment, businessContext);
  const strategyQuality = diagnosis?.strategy_quality_context || strategyQualityContextFor(assessment, businessContext, merchantProfile);
  return {
    industry: String(assessment.industry || '').slice(0, 120),
    main_goal: String(assessment.main_goal || '').slice(0, 100),
    target_customer: String(assessment.target_customer || '').slice(0, 120),
    platforms: planPlatforms(diagnosis?.platform_recommendations, assessment?.current_channels).slice(0, 4),
    pain: String(assessment.customer_pain || assessment.biggest_problem || '').slice(0, 120),
    biggest_problem: String(assessment.biggest_problem || '').slice(0, 60),
    priority_problem: String(diagnosis.priority_problem || '').slice(0, 60),
    platform_recommendations: compactPlatformRecommendations(diagnosis.platform_recommendations),
    variation_direction: String(assessment.plan_generation_variant || '').slice(0, 40),
    strategy_quality: {
      service: strategyQuality.service,
      business_goal: strategyQuality.business_goal,
      conversion_action: strategyQuality.conversion_action,
      customer_language: strategyQuality.customer_language,
      buyer_objections: strategyQuality.buyer_objections,
      proof_assets: strategyQuality.proof_assets,
      market_calibration: strategyQuality.market_calibration,
      evidence_strength: strategyQuality.evidence_strength,
    },
  };
};

const contentPlanPrompt = (assessment, diagnosis) => [
  '请生成正好7条可直接进入内容草稿的选题，只返回JSON对象，不要Markdown。',
  '格式固定为{"plans":[{"topic":"","angle":"","content_type":"","cta":""}]}，每条仅含这4个核心字段。topic<=20字，angle<=24字，content_type<=8字，cta<=14字。',
  '内容写给目标客户，必须贴合行业、目标、痛点和平台；7条角度不得重复；禁止评论区或留言关键词引导；禁止照抄输入长句；禁止编造未提供的优惠、接送、价格或效果承诺。',
  '每条cta必须是完整、自然、口语化的一句话，不得出现“咨询咨询”“预约预约”等叠词，不得以“引导客户/引导家长”开头，也不要与topic重复。7条cta动作要多样，按场景轮换保存清单、主页咨询、预约体验、到店确认、截图问款、了解详情等安全动作，不能全部以“咨询”开头。',
  '按上下文platforms的顺序轮换平台语感：小红书标题更口语，可用“原来、后悔没早知道、谁懂啊”等轻情绪钩子或数字清单感，但必须真实、不夸大、不堆emoji；抖音保持短视频开头钩子；视频号保持稳健口播/科普，不要把小红书语气套到其他平台。',
  '除非上下文明确提供，topic、angle、content_type和cta中严禁出现：免费、接送、无隐形消费、包会、保证效果、立减、折扣、优惠、赠送、返现。',
  '根据 variation_direction 改变本批次的选题切口；不要机械复用同一行业的固定标题顺序。',
  '先读 strategy_quality：至少3条直接回应 customer_language/buyer_objections，至少2条使用 proof_assets 里的真实素材做案例、过程或信任内容；如果 proof_assets 为空，只能讲流程、边界和判断标准。',
  'market_calibration 只用于识别已验证的主题和表达结构，禁止照抄标题、案例、素材或对标账号人设。每条都应是可验证内容实验，并能用曝光、互动、咨询或预约决定下一步。',
  `上下文:${JSON.stringify(planPromptContext(assessment, diagnosis))}`,
].join('\n');

const arkContentPlanPrompt = (assessment = {}, diagnosis = {}) => contentPlanPrompt(assessment, diagnosis);

const extractModelJson = (text = '') => {
  const fence = String.fromCharCode(96, 96, 96);
  let jsonText = String(text || '').trim();
  if (jsonText.startsWith(fence + 'json')) jsonText = jsonText.slice((fence + 'json').length).trim();
  else if (jsonText.startsWith(fence)) jsonText = jsonText.slice(fence.length).trim();
  if (jsonText.endsWith(fence)) jsonText = jsonText.slice(0, -fence.length).trim();
  try {
    return JSON.parse(jsonText);
  } catch {}
  const arrayStart = jsonText.indexOf('[');
  const arrayEnd = jsonText.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) return JSON.parse(jsonText.slice(arrayStart, arrayEnd + 1));
  const objectStart = jsonText.indexOf('{');
  const objectEnd = jsonText.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) return JSON.parse(jsonText.slice(objectStart, objectEnd + 1));
  throw new Error('invalid_json');
};

const limitPlanText = (value = '', maxLength = 36) => Array.from(String(value || '').trim()).slice(0, maxLength).join('');
const planRuleFields = ({ contentType = '', cta = '' } = {}) => {
  const compact = `${contentType} ${cta}`;
  const targetMetric = /预约|咨询|到店|体验/.test(compact)
    ? '咨询/预约'
    : (/视频|口播/.test(compact) ? '播放/咨询' : '收藏/咨询');
  return [targetMetric, '需要人工润色', '发布前补充真实案例、画面或服务细节。'];
};
const normalizeLlmPlanRows = (rows) => Array.isArray(rows) ? rows.slice(0, 7).map((item) => {
  const topic = limitPlanText(Array.isArray(item) ? item[0] : item?.topic, 24);
  const angle = limitPlanText(Array.isArray(item) ? item[1] : item?.angle, 36);
  const contentType = limitPlanText(Array.isArray(item) ? item[2] : item?.content_type, 10) || '图文/短视频';
  const cta = limitPlanText(Array.isArray(item) ? item[3] : item?.cta, 28) || '引导客户咨询具体情况或预约。';
  const [targetMetric, publishQuality, qualityNote] = planRuleFields({ contentType, cta });
  return [topic, angle, contentType, cta, targetMetric, publishQuality, qualityNote];
}).filter((row) => row[0] && row[1]) : [];

const PLAN_CTA_MAX_LENGTH = 14;
const PLAN_CTA_ACTIONS = [
  ['保存', /保存|收藏|存下|存起来/],
  ['主页', /主页/],
  ['预约', /预约/],
  ['到店', /到店/],
  ['截图', /截图/],
  ['了解', /了解|查看/],
  ['对照', /对照|核对/],
  ['咨询', /咨询|问问|问款/],
];
const planTextLength = (value = '') => Array.from(String(value || '')).length;
const trimPlanNoise = (value = '') => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/([，。！？、；：,.!?;:])\1+/g, '$1')
  .replace(/^[，。！？、；：,.!?;:\s]+|[，。！？、；：,.!?;:\s]+$/g, '')
  .trim();
const planCtaActionKey = (value = '') => {
  const text = String(value || '');
  const found = PLAN_CTA_ACTIONS.find(([, pattern]) => pattern.test(text));
  return found?.[0] || Array.from(text).slice(0, 2).join('') || '其他';
};
const cleanPlanCtaText = (value = '') => {
  const original = String(value || '').trim();
  if (!original) return '';
  try {
    let cleaned = trimPlanNoise(original)
      .replace(/^(?:请|现在|立即)?(?:点击|点开)(?=咨询|预约|查看|了解|保存|到店)/, '')
      .replace(/^(?:请|建议|可以)?引导(?:客户|家长|用户|学员|消费者)?(?:去|来|进行)?/, '')
      .replace(/^(?:客户|家长|用户|学员|消费者)(?:可|可以|去|来)?/, '')
      .replace(/(咨询|预约|到店|了解|保存|收藏|截图)\1+/g, '$1')
      .replace(/^咨询问(?:你的|一下)?/, '带上情况咨询')
      .replace(/^咨询获取/, '了解')
      .replace(/(?:或者|或是|以及|并且)$/g, '');
    cleaned = trimPlanNoise(cleaned);
    if (!cleaned) return '';
    if (planTextLength(cleaned) > PLAN_CTA_MAX_LENGTH) {
      const firstClause = cleaned.split(/[，。；、]/).map((item) => trimPlanNoise(item)).find((item) => item && planTextLength(item) <= PLAN_CTA_MAX_LENGTH);
      return firstClause || '';
    }
    return cleaned;
  } catch {
    return planTextLength(original) <= PLAN_CTA_MAX_LENGTH ? original : '';
  }
};
const planCtaCandidatesFor = (platform = '', assessment = {}) => {
  const business = [assessment.industry, assessment.offer, assessment.main_goal, assessment.target_customer].filter(Boolean).join(' ');
  const service = serviceTopicFor(business, assessment.offer || '');
  if (/财税|代账|税务|工商|审计|企业服务/.test(business)) {
    return ['保存这份自查清单', '主页咨询财税情况', '预约一次需求沟通', '对照清单核对资料', '了解服务适用范围', '带上情况咨询方案', '查看主页服务说明'];
  }
  if (service.type === 'youth_basketball' || service.type === 'martial_arts' || service.type === 'education') {
    return ['保存体验观察清单', '主页咨询课程安排', '预约一次体验课', '到店前确认课表', '了解孩子适合班型', '带上年龄咨询班型', '对照清单观察课堂'];
  }
  if (['nail', 'lash', 'beauty', 'photo', 'dental', 'postpartum'].includes(service.type) || /推拿|按摩|养生|理疗/.test(business)) {
    const screenshotCta = service.type === 'nail' || service.type === 'lash' ? '截图咨询适合款式' : '截图咨询适合方案';
    return ['保存这份到店清单', '主页咨询具体情况', '预约一次到店体验', '到店前确认时间', screenshotCta, '了解服务适合范围', '带上情况咨询方案'];
  }
  if (['fashion_accessory', 'aesthetic_retail', 'basketball_goods'].includes(service.type)) {
    return ['保存这份选购清单', '主页查看产品详情', '截图咨询适合款式', '对照清单选规格', '了解产品适用场景', '带上需求咨询选择', '收藏后慢慢对照'];
  }
  const platformSpecific = String(platform).includes('朋友圈')
    ? '看完案例再咨询'
    : String(platform).includes('视频号')
      ? '转发给需要的人'
      : '保存这份清单';
  return [platformSpecific, '主页咨询具体情况', '预约进一步沟通', '对照清单先自查', '了解服务适用范围', '带上情况咨询方案', '查看主页服务说明'];
};
const selectDiversePlanCta = ({ value = '', platform = '', assessment = {}, usedActions = new Set() } = {}) => {
  const original = String(value || '');
  const cleaned = cleanPlanCtaText(original);
  const business = [assessment.industry, assessment.offer, assessment.main_goal, assessment.target_customer].filter(Boolean).join(' ');
  const hasSourceNoise = /(?:点击咨询|私信|咨询咨询|咨询问|咨询获取|引导(?:客户|家长|用户)?|评论区|留言|关键词|暗号|扣\d|回复|(?:或者|或是|以及|并且)[，。！？、；：,.!?;:]*$)/.test(original);
  const hasExplicitAction = /保存|收藏|存下|存起来|主页|咨询|预约|到店|截图|了解|查看|对照|核对|转发|问我|问问|体验|确认/.test(cleaned);
  const looksIncomplete = /^(?:如果|假如|要是|不确定|拿不准|想知道|想了解|想看|还有)|第一次.+后$/.test(cleaned);
  const mismatchedServiceWord = /推拿|按摩|理疗|肩颈/.test(business) && /款式|同款|问款/.test(cleaned);
  const sourceAcceptable = Boolean(cleaned && !hasSourceNoise && hasExplicitAction && !looksIncomplete && !mismatchedServiceWord);
  const cleanedKey = planCtaActionKey(cleaned);
  if (sourceAcceptable && !usedActions.has(cleanedKey)) {
    usedActions.add(cleanedKey);
    return cleaned;
  }
  const candidates = planCtaCandidatesFor(platform, assessment)
    .map(cleanPlanCtaText)
    .filter((item) => item && planTextLength(item) <= PLAN_CTA_MAX_LENGTH);
  const replacement = candidates.find((item) => !usedActions.has(planCtaActionKey(item)))
    || (sourceAcceptable ? cleaned : candidates[usedActions.size % Math.max(candidates.length, 1)])
    || candidates[0]
    || '主页咨询具体情况';
  usedActions.add(planCtaActionKey(replacement));
  return replacement;
};
const cleanPlanTopicForPlatform = (value = '', platform = '', assessment = {}, index = 0) => {
  const original = trimPlanNoise(value);
  if (!original || !String(platform).includes('小红书')) return original;
  try {
    const textbookPattern = /^(?:一文讲清(?:楚)?(?:真相)?|干货整理|全面解析|深度解析|知识科普)[：:]?/;
    if (!textbookPattern.test(original)) return original;
    const core = trimPlanNoise(original.replace(textbookPattern, '')) || original;
    const business = [assessment.industry, assessment.offer, assessment.target_customer].filter(Boolean).join(' ');
    const consumer = /美甲|美睫|美容|推拿|按摩|养生|篮球|武术|搏击|家长|孩子|摄影|口腔|餐饮|门店|附近/.test(business);
    const hooks = consumer ? ['原来', '后悔没早知道：', '谁懂啊：'] : ['原来', '先收藏：', '别急着决定：'];
    return limitPlanText(`${hooks[index % hooks.length]}${core}`, 24);
  } catch {
    return original;
  }
};
const postProcessPlanRows = (rows = [], platforms = [], assessment = {}) => {
  const usedActions = new Set();
  return rows.map((row, index) => {
    const source = Array.isArray(row) ? [...row] : [];
    const platform = platforms[index % Math.max(platforms.length, 1)] || '当前平台';
    source[0] = cleanPlanTopicForPlatform(source[0], platform, assessment, index) || source[0];
    source[3] = selectDiversePlanCta({ value: source[3], platform, assessment, usedActions });
    return source;
  });
};

const rowsFromModelJson = (parsed) => normalizeLlmPlanRows(
  Array.isArray(parsed)
    ? parsed
    : (parsed?.plans || parsed?.content_plans || parsed?.next_7_day_plan || parsed?.next_plan_days || [])
);

const UNSUPPORTED_PLAN_CLAIMS = ['免费', '接送', '无隐形消费', '包会', '保证效果', '立减', '折扣', '优惠', '赠送', '返现'];
const UNSUPPORTED_PLAN_CLAIM_REPLACEMENTS = new Map([
  ['无隐形消费', '收费说明'],
  ['保证效果', '关注实际体验'],
  ['包会', '学习过程'],
  ['免费', ''],
  ['接送', ''],
  ['立减', ''],
  ['折扣', ''],
  ['优惠', ''],
  ['赠送', ''],
  ['返现', ''],
]);
const planClaimSource = (assessment = {}) => [
  assessment.industry,
  assessment.main_goal,
  assessment.target_customer,
  assessment.offer,
  assessment.customer_pain,
  assessment.biggest_problem,
].filter(Boolean).join(' ');
const hasUnsupportedPlanClaim = (rows = [], assessment = {}) => {
  const source = planClaimSource(assessment);
  const output = rows.flat().join(' ');
  return UNSUPPORTED_PLAN_CLAIMS.some((claim) => output.includes(claim) && !source.includes(claim));
};
const sanitizeUnsupportedPlanClaims = (rows = [], assessment = {}) => {
  const source = planClaimSource(assessment);
  let adjustmentCount = 0;
  const sanitizedRows = rows.map((row) => row.map((value) => {
    let text = String(value || '');
    for (const [claim, replacement] of UNSUPPORTED_PLAN_CLAIM_REPLACEMENTS) {
      if (source.includes(claim) || !text.includes(claim)) continue;
      adjustmentCount += text.split(claim).length - 1;
      text = text.split(claim).join(replacement);
    }
    return text.replace(/\s{2,}/g, ' ').trim();
  }));
  return { rows: sanitizedRows, adjustmentCount };
};

const recoverCompletePlanRows = (text = '') => {
  const source = String(text || '');
  const starts = [];
  const objects = [];
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') starts.push(index);
    if (char !== '}' || !starts.length) continue;
    const start = starts.pop();
    try {
      const candidate = JSON.parse(source.slice(start, index + 1));
      if (candidate?.topic && candidate?.angle) objects.push(candidate);
    } catch {}
  }
  return normalizeLlmPlanRows(objects);
};

const parseArkPlanCall = (call = {}, assessment = {}, expectedCount = 7) => {
  let rows = [];
  let parseError = null;
  try {
    rows = rowsFromModelJson(extractModelJson(call.content));
  } catch (error) {
    parseError = error;
    rows = recoverCompletePlanRows(call.content);
  }
  const sanitized = sanitizeUnsupportedPlanClaims(rows, assessment);
  if (hasUnsupportedPlanClaim(sanitized.rows, assessment)) throw new Error('unsupported_claim');
  if (sanitized.rows.length < expectedCount) {
    const error = new Error(parseError?.message === 'invalid_json' && !sanitized.rows.length
      ? 'invalid_json'
      : `ark_returned_${sanitized.rows.length}_plans`);
    error.recoveredRows = sanitized.rows;
    error.safetyAdjustmentCount = sanitized.adjustmentCount;
    throw error;
  }
  return { rows: sanitized.rows.slice(0, expectedCount), adjustmentCount: sanitized.adjustmentCount };
};

const mergeModelUsage = (...values) => {
  const usages = values.filter((value) => value && typeof value === 'object');
  if (!usages.length) return null;
  return {
    prompt_tokens: usages.reduce((sum, value) => sum + Number(value.prompt_tokens || 0), 0),
    completion_tokens: usages.reduce((sum, value) => sum + Number(value.completion_tokens || 0), 0),
    total_tokens: usages.reduce((sum, value) => sum + Number(value.total_tokens || 0), 0),
  };
};

const isRetryableArkFailure = (call = {}) => {
  const reason = String(call.fallback_reason || call.failure_reason || '');
  return ['ark_timeout', 'ark_api_error'].includes(reason) || /^ark_api_error_(?:429|5\d\d)$/.test(reason);
};

const callArkPlanRows = async (assessment, diagnosis) => {
  const messages = [
    {
      role: 'system',
      content: [
        '你是企业增长内容策略顾问，服务对象是门店老板、企业主和商家。',
        '你必须根据客户真实行业、目标客户、平台、痛点和产品服务生成内容选题。',
        '禁止评论区/留言关键词引导，禁止输出无关行业，禁止照抄客户字段长句。',
        '只返回 JSON，不要解释。',
      ].join('\n'),
    },
    { role: 'user', content: arkContentPlanPrompt(assessment, diagnosis) },
  ];
  const call = await callArkChatCompletion({
    route: '/api/assessments',
    purpose: 'initial_7_day_plan',
    temperature: 0.55,
    maxTokens: 1400,
    timeoutMs: CUSTOMER_PUBLIC_PLAN_TIMEOUT_MS,
    model: arkPlanModel(),
    thinking: { type: 'disabled' },
    responseFormat: { type: 'json_object' },
    messages,
  });
  if (!call.ok) {
    if (!isRetryableArkFailure(call)) return { rows: null, meta: normalizeModelMeta(call) };
    const retry = await callArkChatCompletion({
      route: '/api/assessments',
      purpose: 'initial_7_day_plan_retry',
      temperature: 0.4,
      maxTokens: 1400,
      timeoutMs: Math.min(15000, CUSTOMER_PUBLIC_PLAN_TIMEOUT_MS),
      model: arkPlanModel(),
      thinking: { type: 'disabled' },
      responseFormat: { type: 'json_object' },
      messages,
    });
    if (!retry.ok) {
      return {
        rows: null,
        meta: normalizeModelMeta({
          ...retry,
          latency_ms: Number(call.latency_ms || 0) + Number(retry.latency_ms || 0),
          usage: mergeModelUsage(call.usage || call.raw_usage, retry.usage || retry.raw_usage),
          provider_attempt_count: 2,
          repair_attempted: true,
          repair_succeeded: false,
        }),
      };
    }
    try {
      const recovered = parseArkPlanCall(retry, assessment);
      return {
        rows: recovered.rows,
        meta: normalizeModelMeta({
          ...retry,
          latency_ms: Number(call.latency_ms || 0) + Number(retry.latency_ms || 0),
          usage: mergeModelUsage(call.usage || call.raw_usage, retry.usage || retry.raw_usage),
          content_safety_adjusted: recovered.adjustmentCount > 0,
          safety_adjustment_count: recovered.adjustmentCount,
          provider_attempt_count: 2,
          repair_attempted: true,
          repair_succeeded: true,
        }),
      };
    } catch (error) {
      const fallbackReason = error.message === 'unsupported_claim' ? 'unsupported_claim' : 'partial_parse';
      return {
        rows: null,
        meta: normalizeModelMeta({
          ...modelFailureMeta({
            requestedModel: retry.requested_model || call.requested_model,
            fallbackReason,
            latencyMs: Number(call.latency_ms || 0) + Number(retry.latency_ms || 0),
          }),
          usage: mergeModelUsage(call.usage || call.raw_usage, retry.usage || retry.raw_usage),
          provider_attempt_count: 2,
          repair_attempted: true,
          repair_succeeded: false,
        }),
      };
    }
  }
  try {
    const sanitized = parseArkPlanCall(call, assessment);
    return {
      rows: sanitized.rows,
      meta: normalizeModelMeta({
        ...call,
        content_safety_adjusted: sanitized.adjustmentCount > 0,
        safety_adjustment_count: sanitized.adjustmentCount,
      }),
    };
  } catch (firstError) {
    const recoveredRows = Array.isArray(firstError.recoveredRows) ? firstError.recoveredRows.slice(0, 6) : [];
    const missingCount = Math.max(1, 7 - recoveredRows.length);
    const repairPrompt = recoveredRows.length
      ? [
          `已完整保留 ${recoveredRows.length} 条选题：${JSON.stringify(recoveredRows.map((row) => row[0]))}`,
          `只补充正好 ${missingCount} 条不重复的选题。`,
          '返回格式必须为 {"plans":[{"topic":"","angle":"","content_type":"","cta":""}]}，不要额外文字。',
          `上下文:${JSON.stringify(planPromptContext(assessment, diagnosis))}`,
        ].join('\n')
      : arkContentPlanPrompt(assessment, diagnosis);
    const retry = await callArkChatCompletion({
      route: '/api/assessments',
      purpose: 'initial_7_day_plan_repair',
      temperature: 0.2,
      maxTokens: recoveredRows.length ? Math.max(450, missingCount * 220) : 1400,
      timeoutMs: Math.min(recoveredRows.length ? 9000 : 15000, CUSTOMER_PUBLIC_PLAN_TIMEOUT_MS),
      model: arkPlanModel(),
      thinking: { type: 'disabled' },
      responseFormat: { type: 'json_object' },
      messages: [
        { role: 'system', content: '上一次输出未形成完整 JSON。这次只做结构修复：plans 数量必须与要求完全一致，不要额外文字。' },
        { role: 'user', content: repairPrompt },
      ],
    });
    if (!retry.ok) {
      return {
        rows: null,
        meta: normalizeModelMeta({
          ...retry,
          latency_ms: Number(call.latency_ms || 0) + Number(retry.latency_ms || 0),
          usage: mergeModelUsage(call.usage || call.raw_usage, retry.usage || retry.raw_usage),
          provider_attempt_count: 2,
          repair_attempted: true,
          repair_succeeded: false,
          repair_recovered_count: recoveredRows.length,
        }),
      };
    }
    try {
      const repaired = parseArkPlanCall(retry, assessment, missingCount);
      const combinedRows = [...recoveredRows, ...repaired.rows].slice(0, 7);
      if (combinedRows.length < 7) throw new Error(`ark_returned_${combinedRows.length}_plans`);
      return {
        rows: combinedRows,
        meta: normalizeModelMeta({
          ...retry,
          latency_ms: Number(call.latency_ms || 0) + Number(retry.latency_ms || 0),
          usage: mergeModelUsage(call.usage || call.raw_usage, retry.usage || retry.raw_usage),
          content_safety_adjusted: Number(firstError.safetyAdjustmentCount || 0) + repaired.adjustmentCount > 0,
          safety_adjustment_count: Number(firstError.safetyAdjustmentCount || 0) + repaired.adjustmentCount,
          provider_attempt_count: 2,
          repair_attempted: true,
          repair_succeeded: true,
          repair_recovered_count: recoveredRows.length,
        }),
      };
    } catch (retryError) {
      const fallbackReason = [firstError.message, retryError.message].includes('unsupported_claim') ? 'unsupported_claim' : 'partial_parse';
      return {
        rows: null,
        meta: normalizeModelMeta({
          ...modelFailureMeta({
            requestedModel: retry.requested_model || call.requested_model,
            fallbackReason,
            latencyMs: Number(call.latency_ms || 0) + Number(retry.latency_ms || 0),
          }),
          usage: mergeModelUsage(call.usage || call.raw_usage, retry.usage || retry.raw_usage),
          provider_attempt_count: 2,
          repair_attempted: true,
          repair_succeeded: false,
          repair_recovered_count: recoveredRows.length,
        }),
      };
    }
  }
};

const generateOpusPlanRows = async (assessment, diagnosis) => {
  const provider = modelProviderFor(assessment, 'volcengine_ark');
  if (provider === 'local') {
    return { rows: null, meta: { requested_model: 'rule_template', actual_model: 'rule_template', provider: 'local', fallback: false, fallback_reason: null, failure_reason: '', latency_ms: 0 } };
  }
  if (!paidGenerationSafeToRun()) {
    return { rows: null, meta: modelFailureMeta({ requestedModel: provider === 'volcengine_ark' ? arkPlanModel() : REQUESTED_CONTENT_MODEL, fallbackReason: 'safe_to_run_disabled' }) };
  }
  if (provider === 'volcengine_ark') return callArkPlanRows(assessment, diagnosis);
  if (!REQUESTED_CONTENT_MODEL.includes('claude') && !REQUESTED_CONTENT_MODEL.includes('opus')) {
    return { rows: null, meta: { requested_model: REQUESTED_CONTENT_MODEL, actual_model: 'rule_template', provider: 'local', fallback: false, failure_reason: '' } };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { rows: null, meta: { requested_model: REQUESTED_CONTENT_MODEL, actual_model: 'rule_template', provider: 'local', fallback: true, fallback_reason: 'missing_anthropic_api_key', failure_reason: 'missing_anthropic_api_key' } };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: REQUESTED_CONTENT_MODEL,
        max_tokens: 2400,
        temperature: 0.4,
        messages: [{ role: 'user', content: contentPlanPrompt(assessment, diagnosis) }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic_http_${res.status}`);
    const data = await res.json();
    const text = data?.content?.map((part) => part.text || '').join('\n').trim() || '';
    const rows = rowsFromModelJson(extractModelJson(text));
    if (rows.length < 7) throw new Error(`opus_returned_${rows.length}_plans`);
    return { rows, meta: { requested_model: REQUESTED_CONTENT_MODEL, actual_model: REQUESTED_CONTENT_MODEL, provider: 'anthropic', fallback: false, fallback_reason: null, failure_reason: '', latency_ms: 0 } };
  } catch (error) {
    return { rows: null, meta: { requested_model: REQUESTED_CONTENT_MODEL, actual_model: 'rule_template', provider: 'local', fallback: true, fallback_reason: error.message || 'opus_generation_failed', failure_reason: error.message || 'opus_generation_failed' } };
  }
};

const createContentPlan = (diagnosisId, modelRows = null, modelMeta = null) => {
  const diagnosis = state.diagnoses.find((item) => item.id === diagnosisId);
  if (!diagnosis) throw new Error('诊断记录不存在');
  const assessment = state.assessments.find((item) => item.id === diagnosis.assessment_id);
  const industry = assessment?.industry || '当前行业';
  const goal = assessment?.main_goal || '获得更多有效咨询';
  const target = assessment?.target_customer || '目标客户';
  const offer = assessment?.offer || '一次免费诊断';
  const pain = [assessment?.customer_pain, assessment?.content_assets, assessment?.store_location, assessment?.course_schedule, assessment?.coach_credentials].filter(Boolean).join('；') || assessment?.biggest_problem || '当前核心痛点';
  const problem = assessment?.biggest_problem || '';
  const platforms = planPlatforms(diagnosis.platform_recommendations, assessment?.current_channels);
  // 不再在生成新诊断时清空反馈/复盘。serverless 内存不是可信数据库，
  // 但至少避免新诊断把同一实例中的历史反馈直接抹掉。
  const fallbackRows = planTemplates(diagnosis.priority_problem, industry, goal, target, offer, pain, problem, diagnosis.benchmark_reference);
  const fallbackShift = PLAN_VARIATION_DIRECTIONS.indexOf(assessment?.plan_generation_variant);
  const variedFallbackRows = fallbackShift > 0
    ? [...fallbackRows.slice(fallbackShift % fallbackRows.length), ...fallbackRows.slice(0, fallbackShift % fallbackRows.length)]
    : fallbackRows;
  const sourceRows = postProcessPlanRows(applyCoCreationToPlanRows(
    modelRows?.length ? modelRows : variedFallbackRows,
    assessment || {}
  ), platforms, assessment || {});
  const generation = normalizeModelMeta(modelMeta || { requested_model: REQUESTED_CONTENT_MODEL, actual_model: 'rule_template', provider: 'local', fallback: true, fallback_reason: 'model_not_requested', failure_reason: 'model_not_requested' });
  diagnosis.content_generation = generation;
  diagnosis.generation_meta = generation;
  diagnosis.model_info = generation;
  const plans = sourceRows.map(([topic, angle, content_type, cta, target_metric, publish_quality, quality_note], index) => {
    const platform = platforms[index % platforms.length];
    const enriched = enrichPlanRow({
      row: [topic, angle, content_type, cta, target_metric, publish_quality, quality_note],
      index,
      platform,
      assessment,
      diagnosis,
    });
    return {
      id: state.next.plan++,
      client_id: assessment?.client_id || diagnosis.client_id || 'anonymous',
      diagnosis_id: diagnosisId,
      planned_date: todayIso(index),
      platform,
      topic,
      angle,
      content_type: enriched.content_type,
      cta,
      target_metric: enriched.target_metric,
      publish_quality,
      quality_note,
      experiment_type: enriched.experiment_type,
      target_customer: enriched.target_customer,
      growth_goal: enriched.growth_goal,
      content_hypothesis: enriched.content_hypothesis,
      recommended_platform: enriched.recommended_platform,
      why_platform_fit: enriched.why_platform_fit,
      platform_expression: enriched.platform_expression,
      observe_metrics: enriched.observe_metrics,
      next_adjustment: enriched.next_adjustment,
      content_brief: enriched.content_brief,
      merchant_profile: enriched.merchant_profile,
      strategy_quality: enriched.strategy_quality,
      customer_reasoning: enriched.customer_reasoning,
      publish_audit: enriched.publish_audit,
      requested_model: generation.requested_model,
      actual_model: generation.actual_model,
      provider: generation.provider,
      fallback: generation.fallback,
      fallback_reason: generation.fallback_reason,
      model_info: generation,
      owner: '客户负责人',
      status: '待发布',
      publish_link: '',
      created_at: nowIso(),
    };
  });
  state.plans = [...plans, ...state.plans.filter((plan) => plan.diagnosis_id !== diagnosisId)];
  return plans;
};

const planIdString = (item = {}) => String(item.id ?? item.content_plan_id ?? '').trim();
const samePlanRef = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
const numValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const playbackValue = (item = {}) => numValue(
  item.backend_views ?? item.backend_play_count ?? item.play_count ?? item.playback_count ?? item.views
);
const feedbackEngagement = (item = {}) => {
  if (item.engagement !== undefined && item.engagement !== null && item.engagement !== '') return numValue(item.engagement);
  return numValue(item.likes) + numValue(item.favorites) + numValue(item.comments) + numValue(item.shares);
};
const topicKey = (value = '') => sanitizeCustomerText(value)
  .toLowerCase()
  .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, '');
const uniqueTopics = (candidates = [], forbidden = []) => {
  const used = new Set(forbidden.map(topicKey).filter(Boolean));
  const rows = [];
  candidates.forEach((candidate) => {
    const text = String(candidate || '').trim();
    const key = topicKey(text);
    if (!text || !key || used.has(key)) return;
    used.add(key);
    rows.push(text);
  });
  return rows;
};
const nextRoundTopicPool = ({ assessment = {}, selected_plan = {}, daily_data = {}, judgmentType = '标题问题' } = {}) => {
  const service = serviceTopicFor([assessment.industry, assessment.main_goal, assessment.offer].filter(Boolean).join(' '), assessment.offer || '');
  const audience = shortAudience(assessment.target_customer || '目标客户');
  const offer = assessment.offer || service.service || '具体服务';
  const selectedTopic = selected_plan.topic || '本次发布内容';
  if (service.type === 'martial_arts') {
    if (judgmentType === '加码') {
      return [
        '家长问体验课前，最想确认安全保护怎么做',
        '零基础孩子上武术搏击课，第一节会练什么',
        '为什么规则感和专注力，比动作帅更先被家长看见',
        '周末班怎么安排，孩子不怕累还能坚持',
        '孩子报名武术搏击课，家长最该看哪3点',
        '体验课后要不要继续报班，看这几个课堂信号',
        '家长担心受伤和强度，搏击课怎么处理',
        '孩子胆小或好动，武术搏击先从哪一步开始',
      ];
    }
    if (judgmentType === '换角度') {
      return [
        '家长收藏搏击课内容后，为什么还没有预约体验课',
        '孩子零基础能不能上武术搏击课，先看这3个课堂细节',
        '武术搏击体验课，家长最怕的安全问题怎么解决',
        '周末给孩子报搏击课，家长通常会卡在哪一步',
        '想提升专注和体能的孩子，第一阶段练什么',
        '孩子选武术搏击，别只看动作帅不帅',
        '体验课前，家长可以先问清楚这几个问题',
      ];
    }
    return [
      '孩子适不适合学武术搏击，家长先看这3个信号',
      '武术搏击启蒙第一节课，应该让孩子获得什么',
      '家长给孩子选体能课，为什么会考虑武术搏击',
      '附近孩子周末学武术搏击，先了解上课节奏',
      '孩子怕对抗不敢练，武术搏击启蒙怎么开始',
      '体验课预约前，家长最该确认哪几件事',
      '小学生武术搏击训练，不是先追求动作多帅',
    ];
  }
  if (service.type === 'youth_basketball') {
    if (judgmentType === '加码') {
      return [
        '家长问体验课前，最想确认孩子能不能跟上',
        '零基础孩子上少儿篮球课，第一节会练什么',
        '为什么体能提升，比投篮准更先被家长看见',
        '周末班怎么安排，孩子不累还能坚持',
        '6-12岁孩子报名篮球课，家长最该看哪3点',
        '体验课后要不要继续报班，看这几个课堂信号',
        '家长担心安全和强度，少儿篮球课怎么处理',
        '孩子不爱运动，篮球启蒙先从哪一步开始',
        '家长看少儿篮球课，不只看教练会不会打球',
      ];
    }
    if (judgmentType === '换角度') {
      return [
        '家长收藏篮球课内容后，为什么还没有预约体验课',
        '孩子零基础能不能上篮球课，先看这3个课堂细节',
        '少儿篮球体验课，家长最怕的安全问题怎么解决',
        '周末给孩子报篮球课，家长通常会卡在哪一步',
        '想提升体能的孩子，篮球课第一阶段练什么',
        '6-12岁孩子选篮球培训，别只看投篮准不准',
        '体验课前，家长可以先问清楚这几个问题',
      ];
    }
    return [
      '孩子适不适合学篮球，家长先看这3个信号',
      '少儿篮球启蒙第一节课，应该让孩子获得什么',
      '家长给孩子选体能课，为什么会考虑篮球',
      '附近孩子周末学篮球，先了解上课节奏',
      '孩子怕球不敢运球，篮球启蒙怎么开始',
      '体验课预约前，家长最该确认哪几件事',
      '小学生篮球训练，不是先追求投篮命中率',
    ];
  }
  if (judgmentType === '加码') {
    return [
      `${audience}咨询${offer}前，最想确认哪3件事`,
      `已经对${offer}感兴趣的人，下一步通常卡在哪里`,
      `${offer}适合什么样的人，先用真实场景讲清楚`,
      `${audience}问到价格前，其实更想知道什么`,
      `一次${offer}服务/体验，过程里最能建立信任的细节`,
      `从一次咨询看出，${audience}最在意的不是表面问题`,
      `为什么${selectedTopic}能带来咨询，下一条这样延展`,
    ];
  }
  if (judgmentType === '换角度') {
    return [
      `${audience}收藏了但不咨询，通常卡在${offer}的哪3个顾虑`,
      `${offer}看起来不错，为什么客户还是迟迟不问`,
      `把${offer}讲清楚之前，先回答客户最担心的事`,
      `${audience}做决定前，需要看到哪些真实证据`,
      `别只介绍${offer}，先讲一个客户会代入的场景`,
      `${offer}内容有互动没咨询，下一条补这类信任信息`,
      `${audience}从感兴趣到咨询，还差一个明确理由`,
    ];
  }
  return [
    `${audience}看到这个标题，会不会立刻想到自己`,
    `${offer}别先讲服务清单，先讲客户正在卡的问题`,
    `${audience}第一次了解${offer}，最容易误解哪件事`,
    `把${offer}讲得更具体：人群、场景、下一步`,
    `${audience}为什么需要先了解${offer}，用一个场景说清楚`,
    `${offer}内容曝光偏小，下一条先改第一句话`,
    `客户真正会停下来的${offer}标题，通常长这样`,
  ];
};

const customerAdviceContext = (payload = {}) => {
  const assessment = payload.assessment || {};
  const diagnosis = payload.diagnosis || {};
  const plans = Array.isArray(payload.plans) ? payload.plans : [];
  const records = Array.isArray(payload.records) ? payload.records : [];
  const record = payload.record || {};
  const previousRoundTopics = [
    ...(Array.isArray(payload.previous_plan_topics) ? payload.previous_plan_topics : []),
    ...(Array.isArray(payload.previous_rounds) ? payload.previous_rounds.flatMap((round) => Array.isArray(round?.plans) ? round.plans.map((plan) => plan.topic) : []) : []),
  ].filter(Boolean);
  const selectedId = String(payload.selected_plan_id || record.content_plan_id || '').trim();
  const selected_plan = plans.find((plan) => samePlanRef(planIdString(plan), selectedId)) || null;
  if (!selected_plan) throw new Error('每日回填必须绑定具体内容计划，不能默认第一条');
  const selectedIndex = plans.findIndex((plan) => samePlanRef(planIdString(plan), selectedId));
  const completedPlanIds = new Set(
    [selectedId, record.content_plan_id, ...records.map((item) => item.content_plan_id)]
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );
  const history_feedback = records
    .filter((item) => item !== record)
    .filter((item) => !samePlanRef(item.created_at, record.created_at))
    .slice(0, 8)
    .map((item) => ({
      content_plan_id: item.content_plan_id || '',
      plan_topic: item.plan_topic || '',
      published_at: item.published_at || item.created_at || '',
      views: playbackValue(item),
      backend_views: playbackValue(item),
      likes: numValue(item.likes),
      favorites: numValue(item.favorites),
      comments: numValue(item.comments),
      shares: numValue(item.shares),
      engagement: feedbackEngagement(item),
      consultations: numValue(item.consultations),
      appointments: numValue(item.appointments),
      notes: item.notes || '',
      observation_tags: item.observation_tags || '',
    }));
  const unpublished_plans = plans
    .filter((plan, index) => selectedIndex < 0 || index > selectedIndex)
    .filter((plan) => !completedPlanIds.has(planIdString(plan)))
    .filter((plan) => !String(plan.status || '').includes('已发布') && !plan.publish_link)
    .slice(0, 5)
    .map((plan) => ({
      id: planIdString(plan),
      planned_date: plan.planned_date || '',
      topic: plan.topic || '',
      angle: plan.angle || '',
      cta: plan.cta || '',
      platform: plan.platform || '',
    }));
  const daily_data = {
    published_at: record.published_at || record.created_at || '',
    views: playbackValue(record),
    backend_views: playbackValue(record),
    likes: numValue(record.likes),
    favorites: numValue(record.favorites),
    comments: numValue(record.comments),
    shares: numValue(record.shares),
    engagement: feedbackEngagement(record),
    consultations: numValue(record.consultations),
    appointments: numValue(record.appointments),
    notes: record.notes || '',
    observation_tags: record.observation_tags || '',
    publish_link: record.publish_link || '',
  };
  return {
    assessment,
    diagnosis,
    selected_plan,
    daily_data,
    history_feedback,
    unpublished_plans,
    all_plan_topics: uniqueTopics([...plans.map((plan) => plan.topic), ...previousRoundTopics].filter(Boolean), []),
  };
};

const localNextRoundPlan = (ctx = {}, advice = {}, source = 'rule_template') => {
  const { assessment = {}, selected_plan = {}, daily_data = {}, history_feedback = [], unpublished_plans = [] } = ctx;
  const views = numValue(daily_data.views);
  const engagement = numValue(daily_data.engagement);
  const consultations = numValue(daily_data.consultations);
  const appointments = numValue(daily_data.appointments);
  const audience = shortAudience(assessment.target_customer || '目标客户');
  const offer = assessment.offer || serviceTopicFor([assessment.industry, assessment.main_goal].filter(Boolean).join(' '), '').service || '服务';
  const todayTopic = selected_plan.topic || '当天发布内容';
  const observationText = [daily_data.observation_tags, daily_data.notes].filter(Boolean).join('；');
  let judgmentType = '标题问题';
  let more = '更具体的人群痛点、课堂/服务证据和决策问题';
  let less = '泛泛介绍服务、只说欢迎咨询';
  let why = '当前样本还需要先扩大曝光和互动样本。';
  if (consultations > 0 || appointments > 0) {
    judgmentType = '加码';
    more = '复制带来咨询/预约的主题结构，连续补案例、过程、价格和适合人群';
    less = '完全换平台或换成泛科普';
    why = '这条内容已经出现咨询或预约信号，说明角度有效。';
  } else if (views >= 800 && engagement >= 30) {
    judgmentType = '换角度';
    more = '把收藏/点赞兴趣转成信任承接，补真实过程、门店/课程细节和常见顾虑';
    less = '只追热点标题、不回答客户为什么现在要问';
    why = '有曝光和互动但没有咨询，缺口在信任和行动理由。';
  } else if (views >= 800) {
    judgmentType = '标题问题';
    more = '围绕客户第一眼能懂的痛点重写标题和开头';
    less = '抽象行业词和服务清单';
    why = '曝光不低但互动弱，说明打开后没有击中决策问题。';
  } else if (history_feedback.length >= 2 && history_feedback.every((item) => numValue(item.views) < 300)) {
    judgmentType = '平台不匹配';
    more = '先在更贴近客户搜索/同城触点的平台验证同一主题';
    less = '在低样本平台继续机械发布';
    why = '多条内容曝光样本都偏小，需要先校准平台和第一眼表达。';
  }
  if (/体验课时间|预约时间|周末|寒暑假|上课时间/.test(observationText)) {
    judgmentType = consultations > 0 || appointments > 0 ? judgmentType : '换角度';
    more = '把体验课时间、适合年龄、孩子基础和预约方式讲清楚';
    less = '只讲课程好处、不回答家长怎么预约';
    why = '客户观察显示，家长已经在问时间和预约细节，下一轮要把转化路径讲清楚。';
  } else if (/价格|多少钱|费用/.test(observationText)) {
    more = '补适合人群、课程价值、体验课流程和价格前的判断标准';
    less = '直接打价格战或只强调便宜';
    why = '客户观察显示，价格是顾虑，但需要先补信任和适合人群。';
  } else if (/收藏多但没咨询|收藏.*咨询少|有兴趣.*没咨询/.test(observationText)) {
    judgmentType = '换角度';
    more = '把收藏兴趣转成下一步咨询理由，补案例和行动入口';
    less = '继续只做知识点收藏';
    why = '客户观察显示，内容有兴趣信号，但转化承接不够。';
  }
  const decision = judgmentType === '加码'
    ? '加码'
    : judgmentType === '平台不匹配'
      ? '暂停低样本平台并换平台测试'
      : judgmentType === '换角度'
        ? '改角度'
        : views === 0 && engagement === 0 && consultations === 0
          ? '暂停原表达，先重写标题/开头'
          : '继续小样本验证';
  const forbiddenTopics = [
    ...(ctx.all_plan_topics || []),
    selected_plan.topic,
    ...history_feedback.map((item) => item.plan_topic),
    ...unpublished_plans.map((plan) => plan.topic),
  ].filter(Boolean);
  const generatedTopics = uniqueTopics([
    ...(advice.nextTopic ? [advice.nextTopic] : []),
    ...nextRoundTopicPool({ assessment, selected_plan, daily_data, judgmentType }),
  ], forbiddenTopics);
  const fallbackTopics = uniqueTopics(Array.from({ length: 10 }, (_, index) => `${audience}下周第${index + 1}个${offer}决策问题`), forbiddenTopics.concat(generatedTopics));
  const seedTopics = [...generatedTopics, ...fallbackTopics].slice(0, 7);
  const platformSeeds = unpublished_plans.map((plan) => plan.platform).filter(Boolean);
  const serviceType = serviceTopicFor([assessment.industry, assessment.main_goal, assessment.offer].filter(Boolean).join(' '), assessment.offer || '').type;
  const ctxForRows = inferBusinessContext(assessment);
  const merchantProfile = merchantProfileFor(assessment, ctxForRows);
  const qualityContext = strategyQualityContextFor(assessment, ctxForRows, merchantProfile);
  const basePlanCta = serviceType === 'youth_basketball'
    ? '引导家长咨询孩子年龄和体验课时间'
    : serviceType === 'martial_arts'
      ? '引导家长咨询孩子年龄、基础和体验课时间'
      : '引导客户咨询是否适合';
  const actions = judgmentType === '加码'
    ? ['复制有效结构', '补充案例证据', '回答价格/周期', '展示过程细节', '处理适合人群', '集中答疑', '复盘最高咨询主题']
    : judgmentType === '换角度'
      ? ['补信任证据', '拆客户顾虑', '讲真实场景', '补对比清单', '强调行动理由', '承接咨询问题', '复盘收藏原因']
      : judgmentType === '平台不匹配'
        ? ['同题换平台测试', '优化标题钩子', '缩短开头', '改同城/搜索表达', '复用有效素材', '记录平台差异', '保留高信号平台']
        : ['重写标题', '强化第一句话', '换客户视角', '减少服务堆叠', '加入具体问题', '增加证据', '复盘点击原因'];
  const usedCtaActions = new Set();
  const plan = Array.from({ length: 7 }, (_, index) => {
    const platform = platformSeeds[index % Math.max(platformSeeds.length, 1)] || selected_plan.platform || '小红书/视频号';
    const topic = cleanPlanTopicForPlatform(seedTopics[index] || (audience + '关心的' + offer + '问题'), platform, assessment, index);
    const planCta = selectDiversePlanCta({ value: basePlanCta, platform, assessment, usedActions: usedCtaActions });
    const platformStrategy = platformStrategyFor(platform, {
      category: offer,
      primary_offer: offer,
      target_customer: assessment.target_customer || audience,
      conversion_action: consultations > 0 || appointments > 0 ? '咨询/预约' : '咨询具体情况',
    });
    const experimentType = growthExperimentTypes[index % growthExperimentTypes.length];
    const strategyQuality = strategyQualityForPlan({
      qualityContext,
      index,
      title: topic,
      platform,
      experimentType,
      strategy: platformStrategy,
    });
    const reasoning = customerReasoningFor({
      assessment,
      ctx: ctxForRows,
      merchantProfile,
      title: topic,
      angle: actions[index],
      platform,
      experimentType,
      strategy: platformStrategy,
      strategyQuality,
      cta: planCta,
    });
    const audit = publishAuditFor({
      platform,
      topic,
      angle: actions[index],
      cta: planCta,
      qualityNote: '下一轮计划，发布前补真实素材和平台规则自查。',
      assessment,
    });
    return {
      day: 'Day ' + (index + 1),
      planned_date: todayIso(index + 1),
      topic,
      angle: actions[index],
      platform,
      experiment_type: experimentType,
      action: actions[index],
      reason: index === 0 ? '承接本次回填判断：' + judgmentType : '延续同一轮复盘结论，避免每天推倒重来。',
      target_metric: consultations > 0 || appointments > 0 ? '咨询/预约' : (views >= 800 ? '收藏/咨询' : '曝光/播放'),
      based_on: todayTopic,
      cta: planCta,
      why_platform_fit: platformStrategy.why,
      observe_metrics: platformStrategy.observe_metrics,
      next_adjustment: platformStrategy.next_adjustment,
      merchant_profile: merchantProfile,
      strategy_quality: strategyQuality,
      customer_reasoning: reasoning,
      publish_audit: audit,
    };
  });
  return {
    review_judgment: { type: judgmentType, decision, more, less, why },
    customer_summary: '判断：' + decision + '。下周多发：' + more + '；少发：' + less + '。原因：' + why,
    next_7_day_plan: plan,
    source,
  };
};

const localCustomerAdvice = (ctx = {}, source = 'rule_template') => {
  const { assessment = {}, selected_plan = {}, daily_data = {}, history_feedback = [], unpublished_plans = [] } = ctx;
  const views = numValue(daily_data.views);
  const engagement = numValue(daily_data.engagement);
  const consultations = numValue(daily_data.consultations);
  const audience = shortAudience(assessment.target_customer || '目标客户');
  const offer = assessment.offer || serviceTopicFor([assessment.industry, assessment.main_goal].filter(Boolean).join(' '), '').service || '服务';
  const todayTopic = selected_plan.topic || '当天发布内容';
  const nextPlan = unpublished_plans[0] || {};
  const nextTopic = nextPlan.topic || (audience + '选择' + offer + '前最担心的3件事');
  const historyText = history_feedback.length
    ? '已参考前' + history_feedback.length + '天反馈：' + history_feedback.map((item) => (item.plan_topic || item.content_plan_id) + ':曝光' + item.views + '/互动' + item.engagement + '/咨询' + item.consultations).join('；')
    : '暂无历史反馈，按当天内容和当天数据判断。';
  let judgment = '「' + todayTopic + '」样本已回流，先结合当天数据判断下一条内容。';
  let action = '下一条优先执行「' + nextTopic + '」，并沿用当前平台，继续记录曝光、互动和咨询。';
  if (consultations > 0) {
    judgment = '「' + todayTopic + '」带来' + consultations + '个咨询，说明这个选题能触发报名/咨询信号。';
    action = '复制今天的家长顾虑结构，下一条「' + nextTopic + '」补课堂证据、适合年龄和体验课预约理由。';
  } else if (views >= 800 && engagement >= 30) {
    judgment = '「' + todayTopic + '」有曝光和互动但没咨询，说明家长感兴趣但还缺信任承接。';
    action = '下一条「' + nextTopic + '」必须回答安全、师资、孩子基础或上课效果，用具体课堂观察承接到预约体验。';
  } else if (views >= 800) {
    judgment = '「' + todayTopic + '」曝光够但互动弱，标题/封面能打开，正文还没击中家长决策问题。';
    action = '下一条先换成家长视角的问题标题，不急着扩量，重点提高收藏和咨询意愿。';
  } else {
    judgment = '「' + todayTopic + '」曝光样本偏小，不能判断选题失败，先修正第一眼表达。';
    action = '下一条「' + nextTopic + '」把标题写成“年龄/基础/训练目标 + 明确收益”，先把曝光样本做大。';
  }
  return {
    title: nextTopic,
    nextTopic,
    judgment,
    action,
    copy_suggestion: '围绕「' + nextTopic + '」写一条：开头点出家长顾虑，中段给课堂/案例证据，结尾引导咨询年龄和上课时间。',
    selected_plan_topic: todayTopic,
    history_signal: historyText,
    unpublished_count: unpublished_plans.length,
    source,
  };
};

const parseModelJson = (text = '') => {
  return extractModelJson(text);
};

const callCustomerStrategyModel = async (ctx) => {
  const meta = { requested_model: CUSTOMER_STRATEGY_MODEL, actual_model: 'rule_template', provider: 'local', fallback: true, failure_reason: '' };
  if (!paidGenerationSafeToRun()) return { data: null, meta: { ...meta, fallback_reason: 'safe_to_run_disabled', failure_reason: 'safe_to_run_disabled' } };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { data: null, meta: { ...meta, failure_reason: 'OPENAI_API_KEY missing' } };
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: CUSTOMER_STRATEGY_MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: '你是企业营销增长策略判断模型。只返回JSON。' },
          { role: 'user', content: '基于客户业务、当天内容、当天数据、历史反馈、未发计划，判断下一条内容策略。返回 {"judgment":"","next_focus":"","risk":""}。上下文：' + JSON.stringify(ctx) },
        ],
      }),
    });
    if (!res.ok) throw new Error('openai_http_' + res.status);
    const data = await res.json();
    const parsed = parseModelJson(data?.choices?.[0]?.message?.content || '{}');
    return { data: parsed, meta: { requested_model: CUSTOMER_STRATEGY_MODEL, actual_model: CUSTOMER_STRATEGY_MODEL, provider: 'openai', fallback: false } };
  } catch (error) {
    return { data: null, meta: { ...meta, failure_reason: error.message || 'openai_strategy_failed' } };
  }
};

const callCustomerCopyModel = async (ctx, strategy = {}) => {
  const meta = { requested_model: CUSTOMER_COPY_MODEL, actual_model: 'rule_template', provider: 'local', fallback: true, failure_reason: '' };
  if (!paidGenerationSafeToRun()) return { data: null, meta: { ...meta, fallback_reason: 'safe_to_run_disabled', failure_reason: 'safe_to_run_disabled' } };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { data: null, meta: { ...meta, failure_reason: 'ANTHROPIC_API_KEY missing' } };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CUSTOMER_COPY_MODEL,
        max_tokens: 1200,
        temperature: 0.35,
        messages: [{ role: 'user', content: '你是Claude Opus客户建议/文案模型。基于策略判断和上下文生成下一条内容建议，只返回 {"nextTopic":"","action":"","copy_suggestion":""}。策略：' + JSON.stringify(strategy) + ' 上下文：' + JSON.stringify(ctx) }],
      }),
    });
    if (!res.ok) throw new Error('anthropic_http_' + res.status);
    const data = await res.json();
    const text = data?.content?.map((part) => part.text || '').join('\n').trim() || '{}';
    return { data: parseModelJson(text), meta: { requested_model: CUSTOMER_COPY_MODEL, actual_model: CUSTOMER_COPY_MODEL, provider: 'anthropic', fallback: false } };
  } catch (error) {
    return { data: null, meta: { ...meta, failure_reason: error.message || 'claude_opus_copy_failed' } };
  }
};

const compactCustomerAdviceContext = (ctx = {}) => {
  const assessment = ctx.assessment || {};
  const businessContext = ctx.diagnosis?.smart_context || inferBusinessContext(assessment);
  const merchantProfile = ctx.diagnosis?.merchant_profile || merchantProfileFor(assessment, businessContext);
  const quality = ctx.diagnosis?.strategy_quality_context || strategyQualityContextFor(assessment, businessContext, merchantProfile);
  return {
    biz: [assessment.industry, assessment.target_customer, assessment.offer || assessment.main_goal].filter(Boolean).join(' / '),
    selected: [ctx.selected_plan?.topic, ctx.selected_plan?.platform].filter(Boolean).join(' / '),
    metrics: {
      views: ctx.daily_data?.views || 0,
      engagement: ctx.daily_data?.engagement || 0,
      consultations: ctx.daily_data?.consultations || 0,
      appointments: ctx.daily_data?.appointments || 0,
    },
    notes: String([ctx.daily_data?.observation_tags, ctx.daily_data?.notes].filter(Boolean).join('；')).slice(0, 120),
    strategy_quality: {
      customer_language: quality.customer_language,
      buyer_objections: quality.buyer_objections,
      proof_assets: quality.proof_assets,
      market_calibration: quality.market_calibration,
      conversion_action: quality.conversion_action,
      evidence_strength: quality.evidence_strength,
    },
    co_creation: assessment.co_creation || {},
    history_count: ctx.history_feedback?.length || 0,
    next_topics: (ctx.unpublished_plans || []).slice(0, 3).map((plan) => plan.topic).filter(Boolean),
    used_topics: [
      ctx.selected_plan?.topic,
      ...(ctx.all_plan_topics || []),
      ...(ctx.history_feedback || []).map((item) => item.plan_topic),
    ].filter(Boolean).slice(0, 12),
  };
};

const customerAdvicePrompt = (ctx = {}) => `输出JSON对象。字段:title,nextTopic,judgment,action,copy_suggestion,review_judgment:{type,more,less,why},customer_summary,next_7_day_plan:[{day,topic,angle,platform,action,target_metric}]。next_7_day_plan必须7条,要基于本次反馈生成新选题,不得重复used_topics/selected/next_topics里的旧标题。优先沿用strategy_quality里的客户原话、购买异议和真实素材：至少3条回应customer_language/buyer_objections，至少2条能使用proof_assets；没有证据时只讲流程、边界和判断标准，不编造案例或效果。market_calibration只能迁移主题和表达结构，禁止照抄。所有字符串<=28字。规则:有咨询/预约=加码;有曝光互动无咨询=补信任;样本小=扩大样本;每条可用指标决定下一步;禁CRM/ERP/销售跟进/评论区关键词。上下文:${JSON.stringify(compactCustomerAdviceContext(ctx))}`;

const callArkCustomerAdviceModel = async (ctx = {}) => {
  const call = await callArkChatCompletion({
    route: '/api/customer-growth-advice',
    purpose: 'customer_growth_advice',
    temperature: 0.45,
    maxTokens: 1000,
    timeoutMs: CUSTOMER_GROWTH_ADVICE_TIMEOUT_MS,
    responseFormat: { type: 'json_object' },
    thinking: { type: 'disabled' },
    messages: [
      { role: 'system', content: '你是企业增长内容策略顾问，只返回 JSON，不要输出 Markdown。' },
      { role: 'user', content: customerAdvicePrompt(ctx) },
    ],
  });
  if (!call.ok) return { data: null, meta: normalizeModelMeta(call), next_7_day_plan: [] };
  try {
    const parsed = extractModelJson(call.content);
    return {
      data: parsed,
      meta: normalizeModelMeta(call),
      next_7_day_plan: Array.isArray(parsed?.next_7_day_plan) ? parsed.next_7_day_plan : (Array.isArray(parsed?.next_plan_days) ? parsed.next_plan_days : []),
    };
  } catch (error) {
    return {
      data: null,
      meta: modelFailureMeta({
        requestedModel: call.requested_model,
        fallbackReason: error.message === 'invalid_json' ? 'invalid_json' : 'partial_parse',
        latencyMs: call.latency_ms,
      }),
      next_7_day_plan: [],
    };
  }
};

const createCustomerGrowthAdvice = async (payload = {}) => {
  const ctx = customerAdviceContext(payload);
  const fallbackAdvice = localCustomerAdvice(ctx);
  const fallbackNextRound = localNextRoundPlan(ctx, fallbackAdvice);
  const provider = modelProviderFor(payload, 'volcengine_ark');
  if (provider === 'volcengine_ark') {
    const model = await callArkCustomerAdviceModel(ctx);
    const modelData = model.data || {};
    const advice = {
      ...fallbackAdvice,
      judgment: modelData.judgment || fallbackAdvice.judgment,
      nextTopic: modelData.nextTopic || modelData.next_topic || fallbackAdvice.nextTopic,
      title: modelData.title || modelData.nextTopic || modelData.next_topic || fallbackAdvice.title,
      action: modelData.action || fallbackAdvice.action,
      copy_suggestion: modelData.copy_suggestion || fallbackAdvice.copy_suggestion,
    };
    const meta = normalizeModelMeta(model.meta);
    const modelNextRound = localNextRoundPlan(ctx, advice, meta.fallback ? 'rule_template' : 'volcengine_guided_rule_plan');
    const modelRows = Array.isArray(modelData.next_7_day_plan) ? modelData.next_7_day_plan : (Array.isArray(modelData.next_plan_days) ? modelData.next_plan_days : []);
    const usedModelTopicKeys = new Set([
      ...(ctx.all_plan_topics || []),
      ctx.selected_plan?.topic,
      ...(ctx.history_feedback || []).map((item) => item.plan_topic),
    ].map(topicKey).filter(Boolean));
    const safeModelRows = modelRows.length === 7 ? modelRows.map((row, index) => {
      const fallbackRow = modelNextRound.next_7_day_plan[index] || {};
      const proposedTopic = row?.topic || row?.title || '';
      const proposedKey = topicKey(proposedTopic);
      const safeTopic = proposedTopic && proposedKey && !usedModelTopicKeys.has(proposedKey)
        ? proposedTopic
        : fallbackRow.topic;
      const safeKey = topicKey(safeTopic);
      if (safeKey) usedModelTopicKeys.add(safeKey);
      return {
        ...fallbackRow,
        ...row,
        topic: safeTopic || fallbackRow.topic,
        day: row.day || fallbackRow.day,
        planned_date: row.planned_date || row.date || fallbackRow.planned_date,
      };
    }) : [];
    const nextRound = {
      ...modelNextRound,
      review_judgment: {
        ...modelNextRound.review_judgment,
        ...(modelData.review_judgment && typeof modelData.review_judgment === 'object' ? modelData.review_judgment : {}),
      },
      customer_summary: modelData.customer_summary || modelNextRound.customer_summary,
      next_7_day_plan: safeModelRows.length === 7 ? safeModelRows : modelNextRound.next_7_day_plan,
      source: meta.fallback ? 'rule_template' : 'volcengine_ark',
    };
    return {
      advice,
      context_used: {
        selected_plan_id: planIdString(ctx.selected_plan),
        selected_plan_topic: ctx.selected_plan.topic || '',
        daily_data: ctx.daily_data,
        history_feedback_count: ctx.history_feedback.length,
        unpublished_plan_count: ctx.unpublished_plans.length,
        unpublished_plan_topics: ctx.unpublished_plans.map((plan) => plan.topic),
      },
      model_info: meta,
      generation_meta: meta,
      strategy_model: meta,
      copy_model: meta,
      next_round: nextRound,
      review_judgment: nextRound.review_judgment,
      customer_summary: nextRound.customer_summary,
      next_7_day_plan: nextRound.next_7_day_plan,
      next_plan_days: nextRound.next_7_day_plan,
      fallback: meta.fallback,
      transparent_note: meta.fallback ? (meta.fallback_reason || 'model fallback used') : 'volcengine_ark completed',
      generated_at: nowIso(),
    };
  }
  if (provider === 'local') {
    const meta = { requested_model: 'rule_template', actual_model: 'rule_template', provider: 'local', fallback: false, fallback_reason: null, failure_reason: '', latency_ms: 0 };
    return {
      advice: fallbackAdvice,
      context_used: {
        selected_plan_id: planIdString(ctx.selected_plan),
        selected_plan_topic: ctx.selected_plan.topic || '',
        daily_data: ctx.daily_data,
        history_feedback_count: ctx.history_feedback.length,
        unpublished_plan_count: ctx.unpublished_plans.length,
        unpublished_plan_topics: ctx.unpublished_plans.map((plan) => plan.topic),
      },
      model_info: meta,
      generation_meta: meta,
      strategy_model: meta,
      copy_model: meta,
      next_round: fallbackNextRound,
      review_judgment: fallbackNextRound.review_judgment,
      customer_summary: fallbackNextRound.customer_summary,
      next_7_day_plan: fallbackNextRound.next_7_day_plan,
      next_plan_days: fallbackNextRound.next_7_day_plan,
      fallback: false,
      transparent_note: 'rule_template local mode',
      generated_at: nowIso(),
    };
  }
  const strategy = await callCustomerStrategyModel(ctx);
  const copy = await callCustomerCopyModel(ctx, strategy.data || {});
  const advice = {
    ...fallbackAdvice,
    judgment: strategy.data?.judgment || fallbackAdvice.judgment,
    nextTopic: copy.data?.nextTopic || strategy.data?.next_focus || fallbackAdvice.nextTopic,
    title: copy.data?.nextTopic || strategy.data?.next_focus || fallbackAdvice.title,
    action: copy.data?.action || fallbackAdvice.action,
    copy_suggestion: copy.data?.copy_suggestion || fallbackAdvice.copy_suggestion,
  };
  const strategyMeta = normalizeModelMeta(strategy.meta);
  const copyMeta = normalizeModelMeta(copy.meta);
  const fallback = strategyMeta.fallback || copyMeta.fallback;
  const reasons = [strategyMeta.fallback_reason, copyMeta.fallback_reason].filter(Boolean).join('；');
  const nextRound = localNextRoundPlan(ctx, advice, fallback ? 'rule_template' : 'legacy_model_chain');
  return {
    advice,
    context_used: {
      selected_plan_id: planIdString(ctx.selected_plan),
      selected_plan_topic: ctx.selected_plan.topic || '',
      daily_data: ctx.daily_data,
      history_feedback_count: ctx.history_feedback.length,
      unpublished_plan_count: ctx.unpublished_plans.length,
      unpublished_plan_topics: ctx.unpublished_plans.map((plan) => plan.topic),
    },
    model_info: fallback ? copyMeta : strategyMeta,
    generation_meta: fallback ? copyMeta : strategyMeta,
    strategy_model: strategyMeta,
    copy_model: copyMeta,
    next_round: nextRound,
    review_judgment: nextRound.review_judgment,
    customer_summary: nextRound.customer_summary,
    next_7_day_plan: nextRound.next_7_day_plan,
    next_plan_days: nextRound.next_7_day_plan,
    fallback,
    transparent_note: fallback ? reasons || 'model fallback used' : 'ChatGPT strategy + Claude Opus copy completed',
    generated_at: nowIso(),
  };
};

const recordFeedback = (planId, payload, clientId = clientIdFrom(payload)) => {
  const plan = state.plans.find((item) => item.id === planId && (!item.client_id || item.client_id === clientId));
  if (!plan) throw new Error('发布计划不存在');
  const publishLink = normalizeExternalUrl(clean(payload, 'publish_link'));
  if (!publishLink) throw new Error('首次/本条发布链接必填：请粘贴已发布内容链接后再保存反馈');
  const feedback = {
    id: state.next.feedback++,
    client_id: clientId,
    content_plan_id: planId,
    views: playbackValue(payload),
    backend_views: playbackValue(payload),
    backend_play_count: playbackValue(payload),
    likes: Number(payload.likes || 0),
    comments: Number(payload.comments || 0),
    favorites: Number(payload.favorites || 0),
    shares: Number(payload.shares || 0),
    consultations: Number(payload.consultations || 0),
    feedback_stage: clean(payload, 'feedback_stage', 'T+24') || 'T+24',
    publish_link: publishLink,
    plan_topic: clean(payload, 'plan_topic') || plan.topic || '',
    plan_binding_source: clean(payload, 'plan_binding_source') || 'api_content_plan_id',
    notes: clean(payload, 'notes'),
    created_at: nowIso(),
  };
  plan.status = '已发布';
  if (feedback.publish_link) plan.publish_link = feedback.publish_link;
  state.feedback = [feedback, ...state.feedback.filter((item) => !(String(item.client_id || clientId) === String(clientId) && Number(item.content_plan_id) === Number(planId) && String(item.feedback_stage || 'T+24') === String(feedback.feedback_stage)))];
  return feedback;
};

const createWeeklyReview = () => {
  const plans = currentPlans();
  const planIds = plans.map((plan) => plan.id);
  const rows = latestFeedbackRows(planIds).map((feedback) => ({
    ...feedback,
    topic: plans.find((plan) => plan.id === feedback.content_plan_id)?.topic || '',
  }));
  const total_posts = rows.length;
  const total_views = rows.reduce((sum, item) => sum + playbackValue(item), 0);
  const total_interactions = rows.reduce((sum, item) => sum + item.likes + item.comments + item.favorites + item.shares, 0);
  const total_consultations = rows.reduce((sum, item) => sum + item.consultations, 0);
  const winner = rows.slice().sort((a, b) =>
    (b.consultations - a.consultations) ||
    ((b.favorites + b.comments) - (a.favorites + a.comments)) ||
    (playbackValue(b) - playbackValue(a))
  )[0];
  let bottleneck = '暂无反馈数据';
  let next_actions = '先完成至少1条内容发布和反馈回填，否则无法复盘。';
  const winnerTopic = (winner?.topic || '').trim() || '最高咨询内容';
  if (rows.length && total_consultations > 0) {
    bottleneck = '需要扩大有效内容样本';
    next_actions = `加码「${winnerTopic}」同类角度，下周至少复制3条，并保留合规咨询/主页咨询入口。`;
  } else if (rows.length && total_views < 1000) {
    bottleneck = '曝光不足';
    next_actions = '优先优化标题/封面/开头，先获得足够曝光样本。';
  } else if (rows.length) {
    bottleneck = '转化不足';
    next_actions = '已有曝光但咨询不足，下周强化痛点表达、案例信任和明确咨询入口。';
  }
  const { week_start, week_end } = shanghaiWeekRange();
  const review = {
    id: state.next.review++,
    week_start,
    week_end,
    total_posts,
    total_views,
    total_interactions,
    total_consultations,
    winner_topic: winnerTopic,
    bottleneck,
    next_actions,
    created_at: nowIso(),
  };
  state.reviews.unshift(review);
  return review;
};

const dashboard = () => {
  const plans = currentPlans();
  const planIds = plans.map((plan) => plan.id);
  const total_plans = plans.length;
  const published_plans = plans.filter((plan) => plan.status === '已发布' && plan.publish_link).length;
  const rows = latestFeedbackRows(planIds);
  const total_views = rows.reduce((sum, item) => sum + playbackValue(item), 0);
  const total_interactions = rows.reduce((sum, item) => sum + item.likes + item.comments + item.favorites + item.shares, 0);
  const total_consultations = rows.reduce((sum, item) => sum + item.consultations, 0);
  let next_suggestion = '先执行：发布第一条内容，并把首次发布链接回填到系统，否则不算闭环。';
  if (total_consultations > 0) next_suggestion = '加码：已有内容带来咨询，下周复制最高咨询主题，并保留合规咨询/主页咨询入口。';
  else if (published_plans > 0) next_suggestion = '优化：已有发布但暂无咨询，下周强化客户痛点表达，并用咨询/主页咨询承接。';
  if (state.reviews[0]) next_suggestion = state.reviews[0].next_actions;
  return {
    total_plans,
    published_plans,
    feedback_rate: total_plans ? published_plans / total_plans : 0,
    total_views,
    total_interactions,
    total_consultations,
    loop_score: loopScoreFromFeedback(),
    next_suggestion,
  };
};

const seed = () => {
  state = blankState();
  const assessment_id = createAssessment({
    company_name: '示例本地服务机构',
    industry: '本地服务',
    main_goal: '获得更多咨询',
    current_channels: '视频号, 小红书',
    posting_frequency: '偶尔发布',
    biggest_problem: '不知道发什么',
    target_customer: '有明确需求的本地客户',
    offer: '一次免费咨询',
    customer_pain: '不知道如何判断服务是否适合自己',
    content_assets: '客户案例、服务过程照片',
    best_recent_content: '客户案例内容',
    contact: '赵娜',
  });
  const diagnosis = generateDiagnosis(assessment_id);
  createContentPlan(diagnosis.id);
};

const ensureState = () => {
  if (!state) seed();
};

const canonicalCloudProjectName = (item = {}) => {
  const sourceText = [
    item.name,
    item.state?.project?.name,
    item.state?.assessment?.company_name,
    item.state?.assessment?.industry,
    item.state?.diagnosis?.summary,
  ].filter(Boolean).join(' ');
  if (/安标|安规|医疗器械|注册送检|EMC/i.test(sourceText)) return '安标检测';
  return String(item.name || item.state?.project?.name || item.state?.assessment?.company_name || '')
    .replace(/\s+/g, '')
    .replace(/作战台$/g, '')
    .trim();
};

const cloudProjectCompleteness = (item = {}) => {
  const state = item.state || {};
  return [
    Array.isArray(state.plans) ? state.plans.length : 0,
    Array.isArray(state.feedback) ? state.feedback.length * 3 : 0,
    state.review ? 20 : 0,
    state.project_stage === '复盘期' || item.stage === '复盘期' ? 10 : 0,
    item.source === 'internal_seed' || state.source === 'internal_seed' ? -30 : 0,
  ].reduce((sum, value) => sum + value, 0);
};

const normalizeCloudProjectStore = (payload = {}) => {
  const raw = payload?.project_store || payload;
  const projects = Array.isArray(raw?.projects) ? raw.projects : [];
  const byName = new Map();
  projects
    .filter((item) => item && item.id && item.state && item.state.diagnosis && Array.isArray(item.state.plans))
    .map((item) => ({
      ...item,
      updated_at: item.updated_at || item.state?.saved_at || nowIso(),
    }))
    .forEach((item) => {
      const key = canonicalCloudProjectName(item) || String(item.id);
      const existing = byName.get(key);
      const preferIncoming = !existing
        || cloudProjectCompleteness(item) > cloudProjectCompleteness(existing)
        || (cloudProjectCompleteness(item) === cloudProjectCompleteness(existing)
          && preferIncomingTimestamp(item.updated_at, existing.updated_at));
      if (preferIncoming) byName.set(key, item);
    });
  const normalizedProjects = [...byName.values()]
    .sort((a, b) => compareTimestampDesc(a.updated_at, b.updated_at))
    .slice(0, 80);
  const activeExists = normalizedProjects.some((item) => item.id === raw?.activeProjectId);
  const lastExists = normalizedProjects.some((item) => item.id === raw?.lastActiveProjectId);
  return {
    activeProjectId: activeExists ? raw.activeProjectId : (normalizedProjects[0]?.id || null),
    lastActiveProjectId: lastExists ? raw.lastActiveProjectId : null,
    projects: sanitizeCustomerPayload(normalizedProjects),
    cloud_saved_at: raw?.cloud_saved_at || null,
  };
};

const crossProjectCloudText = (item = {}) => [
  item.id,
  item.name,
  item.source,
  item.state?.source,
  item.state?.project?.id,
  item.state?.project?.name,
  item.state?.assessment?.company_name,
  item.state?.assessment?.industry,
  item.state?.assessment?.offer,
  item.state?.diagnosis?.insight,
].filter(Boolean).join(' ');
const isCrossProjectInternalSeed = (item = {}) => /P0[123]|安标|安规|医疗器械|注册送检|EMC|SunPace|Sunny|PTE|德尔医生|del-doctor|feishu_bitable_p03/i.test(crossProjectCloudText(item));
const stripGenericInternalCrossProjectSeeds = (projectStore = {}, clientId = 'anonymous') => {
  const raw = projectStore?.project_store || projectStore || {};
  if (clientId !== 'internal') return raw;
  const projects = Array.isArray(raw.projects) ? raw.projects.filter((item) => !isCrossProjectInternalSeed(item)) : [];
  return {
    ...raw,
    activeProjectId: projects.some((item) => item.id === raw.activeProjectId) ? raw.activeProjectId : null,
    lastActiveProjectId: projects.some((item) => item.id === raw.lastActiveProjectId) ? raw.lastActiveProjectId : null,
    projects,
  };
};

const cloudEnvelope = (projectStore = null, meta = {}) => ({
  app_version: APP_VERSION,
  version_label: VERSION_LABEL,
  saved_at: nowIso(),
  project_store: normalizeCloudProjectStore(projectStore || {projects: []}),
  ...meta,
});

const p03FeishuWritebackRows = [
  ['recvkADx9gJwan', 'P03-2026-05-V01', '医疗器械注册送检，为什么经常被要求补检？', 'https://www.douyin.com/video/7647461561715510562', 238, 1, 0, 0, 3, '点赞1｜分享3'],
  ['recvkADx9g703L', 'P03-2026-05-V06', '标准更新后，老产品为什么也要关注检测？', 'https://www.douyin.com/video/7647461073620110644', 180, 0, 0, 0, 0, '点赞0｜分享0'],
  ['recvkADx9gT8Nv', 'P03-2026-05-V02', '送检前，客户最好提前准备哪些资料？', 'https://www.douyin.com/video/7647365516159487267', 250, 1, 0, 0, 1, '点赞1｜分享1'],
  ['recvkADx9gUYGm', 'P03-2026-05-V08', '选择检测机构，不只看价格，还要看什么？', 'https://www.douyin.com/video/7647077528707829044', 299, 2, 0, 0, 3, '点赞2｜分享3'],
  ['recvkADx9g6RPU', 'P03-2026-05-V09', '医疗器械检测周期，为什么不能只问“几天出报告”？', 'https://www.douyin.com/video/7647076717646990607', 345, 1, 0, 1, 0, '点赞1｜收藏1｜分享0'],
];

const buildP03InternalProjectSeed = () => {
  const projectId = 'project-p03-anbiao-feishu-writeback';
  const clientId = 'internal';
  const assessment = {
    id: 'assessment-p03-anbiao',
    client_id: clientId,
    company_name: 'P03 安标检测',
    industry: 'P03安标检测｜医疗器械检测合规与注册送检内容验证',
    main_goal: '验证抖音内容是否带来检测合规/注册送检咨询',
    current_channels: '抖音',
    posting_frequency: '每周8条',
    biggest_problem: '发布数据已回填但内测页不可见',
    target_customer: '医疗器械企业负责人、注册送检负责人、需要确认检测资料/周期/机构选择的项目负责人',
    offer: '医疗器械检测合规咨询 / 注册送检资料准备 / 检测机构选择建议',
    customer_pain: '企业负责人不清楚送检资料、检测周期、标准更新后是否补检以及检测机构选择标准。',
    content_assets: 'Feishu排期选题、检测资料清单、标准更新问题、抖音发布链接与T+72数据',
    contact: 'P03项目',
    source: 'feishu_bitable_p03_writeback_seed',
    feishu_base_token: 'VGSxbfukVaytnPsag3WcD5rZn1e',
    feishu_table_id: 'tblDwfGwO84jM2mE',
    feishu_table_name: '发布数据回收｜2026W22｜8条视频',
    created_at: '2026-06-12 18:13:00',
  };
  const diagnosis = {
    id: 'diagnosis-p03-anbiao',
    client_id: clientId,
    assessment_id: assessment.id,
    app_version: APP_VERSION,
    version_label: VERSION_LABEL,
    score: 88,
    strategy_score: 88,
    loop_score: 72,
    stage: '运营周期',
    priority_problem: 'Feishu回填数据需要进入内测页云端项目态',
    insight: 'P03已有5条抖音发布数据回填，当前判断应基于T+72曝光和互动数据继续复制注册送检、检测资料准备、机构选择和检测周期类内容。',
    weekly_action: '继续围绕医疗器械注册送检、检测资料准备、标准更新、检测机构选择连续发布，并把每条链接绑定到计划后回填T+72数据。',
    next_step: '优先复盘曝光最高的“医疗器械检测周期”和“选择检测机构”方向，下一轮补充咨询入口和案例证据。',
    risk_warning: '收藏/评论字段部分原始数据未提供，不能臆造；本页只展示已回填的播放、点赞、收藏、分享字段。',
    score_note: '数据来自飞书多维表“发布数据回收｜2026W22｜8条视频”，按视频URL和原排期记录补写后注入内测云端state。',
    platform_recommendations: {
      strategy: 'P03第一轮主平台为抖音，视频号/私域可后续复用，不引入小红书代发或养号动作。',
      primary: [{platform: '抖音', reason: '适合用短视频讲清医疗器械注册送检、检测资料准备和检测周期问题。'}],
      support: [{platform: '视频号', reason: '可复用同一检测合规科普素材承接企业负责人。'}],
      client_platforms: [{platform: '朋友圈/私域', reason: '用于承接已有客户信任和咨询。'}],
      avoid: [{platform: '自动发布/养号', reason: '本任务只做数据可见和复盘，不做外部平台操作。'}],
    },
    benchmark_reference: {
      source_summary: 'Feishu Base P03回填数据快照',
      recent_topics: p03FeishuWritebackRows.map((row) => row[2]),
      title_structures: ['送检前先确认X', '检测周期为什么不能只问X', '选择检测机构要看X'],
      transferable_directions: ['检测资料清单', '机构选择标准', '检测周期解释'],
      avoid: ['跨项目模板', '未提供字段臆造', '自动发布承诺'],
    },
    created_at: '2026-06-12 18:13:00',
  };
  const plans = p03FeishuWritebackRows.map(([recordId, videoNo, topic, link], index) => ({
    id: index + 1,
    client_id: clientId,
    project_id: projectId,
    cycle_id: 'cycle-2026w22',
    diagnosis_id: diagnosis.id,
    planned_date: `2026-06-${String(8 + index).padStart(2, '0')}`,
    platform: '抖音',
    topic,
    angle: `${videoNo}｜围绕企业负责人做医疗器械注册送检/检测前的真实顾虑展开。`,
    content_type: '短视频',
    cta: '引导主页咨询检测合规/注册送检准备',
    target_metric: 'T+72播放量 / 点赞 / 收藏 / 分享 / 咨询',
    publish_quality: '已发布并完成Feishu回填',
    quality_note: `Feishu record_id: ${recordId}`,
    owner: 'P03安标检测项目',
    status: '已发布',
    publish_link: link,
    source: 'feishu_bitable_p03_writeback_seed',
    feishu_record_id: recordId,
    created_at: '2026-06-12 18:13:00',
  }));
  const feedback = p03FeishuWritebackRows.map(([recordId, videoNo, topic, link, views, likes, comments, favorites, shares, interactionText], index) => ({
    id: `feedback-p03-${index + 1}`,
    client_id: clientId,
    project_id: projectId,
    cycle_id: 'cycle-2026w22',
    content_plan_id: index + 1,
    plan_topic: topic,
    plan_binding_source: 'feishu_record_id_and_publish_link',
    publish_link: link,
    feedback_stage: 'T+72',
    views,
    backend_views: views,
    backend_play_count: views,
    play_count: views,
    likes,
    comments,
    favorites,
    shares,
    consultations: 0,
    appointments: 0,
    notes: `${videoNo}｜Feishu回填：T+72播放量${views}｜${interactionText}｜评论/咨询未提供则保持0`,
    source: 'feishu_bitable_p03_writeback_seed',
    feishu_base_token: 'VGSxbfukVaytnPsag3WcD5rZn1e',
    feishu_table_id: 'tblDwfGwO84jM2mE',
    feishu_table_name: '发布数据回收｜2026W22｜8条视频',
    feishu_record_id: recordId,
    created_at: '2026-06-12 18:13:00',
  }));
  const totalViews = feedback.reduce((sum, item) => sum + playbackValue(item), 0);
  const totalInteractions = feedback.reduce((sum, item) => sum + item.likes + item.comments + item.favorites + item.shares, 0);
  const winner = feedback.slice().sort((a, b) => playbackValue(b) - playbackValue(a))[0];
  const review = {
    week_start: '2026-06-08',
    week_end: '2026-06-14',
    total_posts: feedback.length,
    total_views: totalViews,
    total_interactions: totalInteractions,
    total_consultations: 0,
    winner_topic: winner?.plan_topic || '暂无',
    bottleneck: '有播放与互动回填，但咨询字段未提供',
    next_actions: '下一轮继续复制高播放检测合规问题科普，并在视频结尾补强主页咨询/案例承接，避免只看播放不看咨询。',
    source: 'feishu_bitable_p03_writeback_seed',
    created_at: '2026-06-12 18:13:00',
  };
  const state = {
    project: {id: projectId, client_id: clientId, name: 'P03 安标检测作战台', created_at: '2026-06-12 18:13:00'},
    client_id: clientId,
    project_stage: '运营中',
    current_cycle_id: 'cycle-2026w22',
    assessment,
    diagnosis,
    plans,
    feedback,
    review,
    intake_history: [assessment],
    diagnosis_history: [diagnosis],
    active_diagnosis_id: diagnosis.id,
    source: 'feishu_bitable_p03_writeback_seed',
    environment: 'internal_version',
    app_version: APP_VERSION,
    saved_at: '2026-06-12 18:13:00',
  };
  return {
    id: projectId,
    name: 'P03 安标检测作战台',
    stage: '运营中',
    updated_at: '2026-06-12 18:13:00',
    source: 'feishu_bitable_p03_writeback_seed',
    state,
  };
};

const withInternalProjectSeeds = (projectStore = {}, clientId = 'anonymous') => {
  return normalizeCloudProjectStore(stripGenericInternalCrossProjectSeeds(projectStore, clientId));
};

const cloudStore = async () => {
  try {
    const mod = await import('@netlify/blobs');
    const getStore = mod.getStore || mod.default?.getStore;
    if (!getStore) return null;
    // 优先用显式凭证（解决 CLI/部分运行时不自动注入 blobs 上下文、退回内存导致数据不持久的问题）。
    // 凭证缺失时回退到运行时自动注入模式。consistency:'strong' 保证多步流程 create 后立即可读。
    const siteID = envValue('NETLIFY_BLOBS_SITE_ID', 'NETLIFY_SITE_ID', 'SITE_ID');
    const token = envValue('NETLIFY_BLOBS_TOKEN', 'NETLIFY_API_TOKEN', 'NETLIFY_AUTH_TOKEN');
    if (siteID && token) {
      return getStore({ name: CLOUD_STATE_STORE, siteID, token, consistency: 'strong' });
    }
    return getStore({ name: CLOUD_STATE_STORE, consistency: 'strong' });
  } catch {
    return null;
  }
};

const readCloudState = async (clientId = 'anonymous', {internal = false} = {}) => {
  const key = clientScopedCloudStateKey(clientId);
  const store = await cloudStore();
  if (store) {
    const data = await store.get(key, { type: 'json' }).catch(() => null);
    if (data) {
      const projectStore = internal ? withInternalProjectSeeds(data.project_store || data, clientId) : (data.project_store || data);
      return {...cloudEnvelope(projectStore, {client_id: clientId, storage_key: key, storage: 'netlify-blobs', seed_source: null}), storage: 'netlify-blobs'};
    }
  }
  if (!memoryCloudStates.has(key)) {
    const projectStore = internal ? withInternalProjectSeeds({projects: []}, clientId) : {projects: []};
    memoryCloudStates.set(key, cloudEnvelope(projectStore, {client_id: clientId, storage_key: key, storage: 'memory-fallback', seed_source: null}));
  }
  return {...memoryCloudStates.get(key), storage: 'memory-fallback'};
};

const cloudStateClientIdFromKey = (key = '') => {
  if (key === CLOUD_STATE_KEY) return 'default';
  if (key.startsWith(`${CLOUD_STATE_KEY}.`)) return key.slice(CLOUD_STATE_KEY.length + 1);
  return '';
};

const isTestCustomerKey = (clientId = '') => {
  const id = String(clientId || '').trim().toLowerCase();
  return !id
    || /^qa[-_]/.test(id)
    || /^blob[-_]probe/.test(id)
    || /[-_]probe$/.test(id)
    || /^prod[-_]/.test(id)
    || /^draft[-_]/.test(id)
    || /^live[-_]/.test(id)
    || /^internal-ux-closure-/.test(id)
    || /-1781/.test(id)
    || /^\d{10,}$/.test(id)
    || /[-_]\d{10,}$/.test(id);
};

// 示例/测试性质的客户记录（非真实客户委托），在聚合列表里折叠展示，不删除数据。
const DEMO_CUSTOMER_KEYS = ['florist'];
const DEMO_CUSTOMER_NAME_RE = /清屿花艺/; // 清屿花艺
const isDemoCustomer = (clientId = '', names = []) =>
  DEMO_CUSTOMER_KEYS.includes(String(clientId || '').trim().toLowerCase())
  || (Array.isArray(names) && names.some((n) => DEMO_CUSTOMER_NAME_RE.test(String(n || ''))));

const listCloudStateKeys = async () => {
  const keys = new Map();
  const addKey = (key, meta = {}) => {
    if (!key || (key !== CLOUD_STATE_KEY && !key.startsWith(`${CLOUD_STATE_KEY}.`))) return;
    keys.set(key, { key, ...meta });
  };
  const store = await cloudStore();
  if (store?.list) {
    let cursor = undefined;
    for (let i = 0; i < 20; i += 1) {
      const result = await store.list({ prefix: CLOUD_STATE_KEY, ...(cursor ? { cursor } : {}) }).catch(() => null);
      const blobs = Array.isArray(result?.blobs) ? result.blobs : (Array.isArray(result) ? result : []);
      blobs.forEach((blob) => {
        const key = typeof blob === 'string' ? blob : blob?.key;
        addKey(key, {
          etag: blob?.etag || blob?.eTag || '',
          updated_at: blob?.lastModified || blob?.last_modified || blob?.modifiedAt || '',
        });
      });
      cursor = result?.cursor || result?.nextCursor || '';
      if (!cursor) break;
    }
  }
  [...memoryCloudStates.keys()].forEach((key) => addKey(key, { storage: 'memory-fallback' }));
  return [...keys.values()];
};

const readCloudProjectStoreByKey = async (key = '') => {
  const store = await cloudStore();
  if (store) {
    const data = await store.get(key, { type: 'json' }).catch(() => null);
    if (data) return { data, storage: 'netlify-blobs' };
  }
  if (memoryCloudStates.has(key)) return { data: memoryCloudStates.get(key), storage: 'memory-fallback' };
  return { data: null, storage: store ? 'netlify-blobs' : 'memory-fallback' };
};

const projectDisplayName = (item = {}) => String(
  item.name
  || item.state?.project?.name
  || item.state?.assessment?.company_name
  || item.state?.assessment?.industry
  || item.state?.project?.id
  || item.id
  || ''
).trim();

const projectUpdatedAt = (item = {}) => String(
  item.updated_at
  || item.state?.saved_at
  || item.state?.updated_at
  || item.state?.project?.updated_at
  || item.state?.project?.created_at
  || item.state?.assessment?.created_at
  || ''
).trim();

const normalizeCustomerGroupName = (value = '') => String(value || '')
  .replace(/作战台/g, '')
  .replace(/项目/g, '')
  .replace(/客户$/g, '')
  .replace(/[\s　]+/g, '')
  .replace(/[｜|·・\-_/]+/g, '')
  .trim()
  .toLowerCase();

const customerDisplayNameFromNames = (names = [], clientId = '') => {
  const cleanNames = (Array.isArray(names) ? names : [])
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  const preferred = cleanNames.find((name) => !/未命名|anonymous|default/i.test(name)) || cleanNames[0] || clientId || '未命名客户';
  let label = String(preferred || '').replace(/作战台\s*$/g, '').trim();
  // 名字常被填成整段行业描述：只取第一段（逗号/句号前），并截断过长，列表才干净
  label = label.split(/[，,。.；;、\n]/)[0].trim();
  if (label.length > 16) label = `${label.slice(0, 16)}…`;
  return label || clientId || '未命名客户';
};

const sortCustomerRecords = (records = []) => [...records].sort((a, b) =>
  compareTimestampDesc(a.updated_at, b.updated_at)
  || String(a.client_id || '').localeCompare(String(b.client_id || ''))
);

const groupCustomerRecords = (records = []) => {
  const groups = new Map();
  records.forEach((record) => {
    const displayName = customerDisplayNameFromNames(record.names, record.client_id);
    const key = normalizeCustomerGroupName(displayName) || normalizeCustomerGroupName(record.client_id) || String(record.client_id || '');
    if (!groups.has(key)) {
      groups.set(key, {
        display_name: displayName,
        normalized_name: key,
        is_test: Boolean(record.is_test),
        records: [],
      });
    }
    const group = groups.get(key);
    group.records.push(record);
    group.is_test = group.is_test || Boolean(record.is_test);
    if (preferIncomingTimestamp(record.updated_at, group.updated_at)) {
      group.display_name = displayName;
      group.updated_at = record.updated_at || '';
    }
  });
  return [...groups.values()].map((group) => {
    const recordsSorted = sortCustomerRecords(group.records);
    const primary = recordsSorted[0] || {};
    const names = [...new Set(recordsSorted.flatMap((record) => Array.isArray(record.names) ? record.names : []).filter(Boolean))];
    const projectCount = recordsSorted.reduce((sum, record) => sum + Number(record.project_count || 0), 0);
    return {
      display_name: group.display_name,
      normalized_name: group.normalized_name,
      is_test: Boolean(group.is_test),
      records: recordsSorted.map((record) => ({
        client_id: record.client_id,
        names: record.names || [],
        project_count: Number(record.project_count || 0),
        updated_at: record.updated_at || '',
        storage: record.storage || '',
        storage_key: record.storage_key || '',
        etag: record.etag || '',
        is_test: Boolean(record.is_test),
      })),
      primary_client_id: primary.client_id || '',
      client_id: primary.client_id || '',
      names,
      project_count: projectCount,
      updated_at: primary.updated_at || group.updated_at || '',
      record_count: recordsSorted.length,
    };
  }).sort((a, b) =>
    Number(a.is_test) - Number(b.is_test)
    || compareTimestampDesc(a.updated_at, b.updated_at)
    || String(a.display_name || '').localeCompare(String(b.display_name || ''), 'zh-Hans-CN')
  );
};

const listCustomersFromCloudState = async () => {
  const keyMetas = await listCloudStateKeys();
  const customerRecords = [];
  const errors = [];
  for (const keyMeta of keyMetas) {
    const key = keyMeta.key;
    const clientId = cloudStateClientIdFromKey(key);
    if (!clientId || isTestCustomerKey(clientId)) continue;
    try {
      const { data, storage } = await readCloudProjectStoreByKey(key);
      if (!data) {
        errors.push({ client_id: clientId, key, reason: 'not_found_or_unreadable' });
        continue;
      }
      const rawStore = data.project_store || data;
      const normalized = normalizeCloudProjectStore(stripGenericInternalCrossProjectSeeds(rawStore, clientId));
      const projects = normalized.projects || [];
      if (!projects.length) continue;
      const names = [...new Set(projects.map(projectDisplayName).filter(Boolean))];
      const updatedAt = latestTimestampValue(projects.map(projectUpdatedAt))
        || normalized.cloud_saved_at
        || data.saved_at
        || keyMeta.updated_at
        || '';
      customerRecords.push({
        client_id: clientId,
        names,
        project_count: projects.length,
        updated_at: updatedAt,
        is_test: isDemoCustomer(clientId, names),
        storage,
        storage_key: key,
        etag: keyMeta.etag || '',
      });
    } catch (error) {
      errors.push({ client_id: clientId, key, reason: error?.message || 'read_failed' });
    }
  }
  const customers = groupCustomerRecords(customerRecords);
  return {
    customers,
    errors,
    storage_key_prefix: CLOUD_STATE_KEY,
    readonly: true,
    grouped: true,
    raw_record_count: customerRecords.length,
  };
};

const customerKeyForRecord = (clientId = '') => clientId === 'default' ? CLOUD_STATE_KEY : clientScopedCloudStateKey(clientId);

const previewCustomerMerge = async ({ clientIds = [], displayName = '', canonicalClientId = '' } = {}) => {
  const listing = await listCustomersFromCloudState();
  const normalizedDisplayName = normalizeCustomerGroupName(displayName);
  const explicitIds = [...new Set((Array.isArray(clientIds) ? clientIds : String(clientIds || '').split(','))
    .map((id) => String(id || '').trim())
    .filter(Boolean))];
  const group = normalizedDisplayName
    ? listing.customers.find((item) => item.normalized_name === normalizedDisplayName || normalizeCustomerGroupName(item.display_name) === normalizedDisplayName)
    : listing.customers.find((item) => explicitIds.some((id) => item.records.some((record) => record.client_id === id)));
  const records = explicitIds.length
    ? listing.customers.flatMap((item) => item.records).filter((record) => explicitIds.includes(record.client_id))
    : (group?.records || []);
  if (!records.length) {
    return {
      dry_run: true,
      readonly: true,
      would_write: false,
      error: '没有找到可预演的客户记录',
      requested: { client_ids: explicitIds, display_name: displayName },
    };
  }
  const sortedRecords = sortCustomerRecords(records);
  const canonical = canonicalClientId
    ? sortedRecords.find((record) => record.client_id === canonicalClientId) || sortedRecords[0]
    : sortedRecords[0];
  const projectById = new Map();
  const conflicts = [];
  const sourceSnapshots = [];
  for (const record of sortedRecords) {
    const key = customerKeyForRecord(record.client_id);
    const { data, storage } = await readCloudProjectStoreByKey(key);
    const normalized = normalizeCloudProjectStore(stripGenericInternalCrossProjectSeeds(data?.project_store || data || {}, record.client_id));
    const projects = normalized.projects || [];
    sourceSnapshots.push({
      client_id: record.client_id,
      storage_key: key,
      storage,
      project_count: projects.length,
      updated_at: record.updated_at || '',
      etag: record.etag || '',
      project_ids: projects.map((project) => project.id).filter(Boolean),
    });
    projects.forEach((project) => {
      const id = String(project.id || '').trim();
      if (!id) return;
      const existing = projectById.get(id);
      if (existing && existing.client_id !== record.client_id) {
        conflicts.push({
          project_id: id,
          clients: [...new Set([existing.client_id, record.client_id])],
          resolution: 'dry_run_only_keep_newer_updated_at',
        });
      }
      if (!existing || preferIncomingTimestamp(projectUpdatedAt(project), projectUpdatedAt(existing.project))) {
        projectById.set(id, { client_id: record.client_id, project });
      }
    });
  }
  return {
    dry_run: true,
    readonly: true,
    would_write: false,
    confirm_supported: false,
    note: 'V1 只做预演，不写入、不归档、不删除任何 blobs 键；真正合并需单独人工确认和备份。',
    display_name: group?.display_name || customerDisplayNameFromNames(sortedRecords[0]?.names, sortedRecords[0]?.client_id),
    canonical_client_id: canonical.client_id,
    source_client_ids: sortedRecords.map((record) => record.client_id),
    source_keys: sortedRecords.map((record) => customerKeyForRecord(record.client_id)),
    backup_plan: {
      required: true,
      suggested_prefix: `backup/customer-merge/${Date.now()}/`,
      keys_to_export: sortedRecords.map((record) => customerKeyForRecord(record.client_id)),
    },
    result_preview: {
      project_count_before: sourceSnapshots.reduce((sum, item) => sum + item.project_count, 0),
      merged_project_count: projectById.size,
      canonical_storage_key: customerKeyForRecord(canonical.client_id),
      source_keys_preserved: true,
    },
    conflicts,
    records: sortedRecords,
    source_snapshots: sourceSnapshots,
  };
};

const writeCloudState = async (payload = {}, clientId = clientIdFrom(payload)) => {
  const key = clientScopedCloudStateKey(clientId);
  const current = await readCloudState(clientId);
  const incoming = normalizeCloudProjectStore(payload.project_store || payload);
  const byId = new Map();
  (current.project_store?.projects || []).forEach((item) => byId.set(String(item.id), item));
  incoming.projects.forEach((item) => {
    const existing = byId.get(String(item.id));
    if (!existing || preferIncomingTimestamp(item.updated_at, existing.updated_at)) byId.set(String(item.id), item);
  });
  const merged = sanitizeCustomerPayload(cloudEnvelope({
    activeProjectId: incoming.activeProjectId || current.project_store?.activeProjectId || incoming.projects[0]?.id || null,
    lastActiveProjectId: incoming.lastActiveProjectId || current.project_store?.lastActiveProjectId || null,
    projects: [...byId.values()].sort((a, b) => compareTimestampDesc(a.updated_at, b.updated_at)),
  }, {client_id: clientId, storage_key: key}));
  const store = await cloudStore();
  if (store) {
    await store.setJSON(key, merged);
    return {...merged, storage: 'netlify-blobs'};
  }
  memoryCloudStates.set(key, {...merged, storage: 'memory-fallback'});
  memoryCloudState = memoryCloudStates.get(key);
  return memoryCloudState;
};

const collectionKey = (kind, clientId = 'anonymous') => `${kind}/${normalizeClientId(clientId) || 'anonymous'}`;
const collectionField = (kind) => (kind === 'assets' ? 'assets' : kind === 'plan-jobs' ? 'jobs' : 'tasks');
const memoryCollectionMap = (kind) => (kind === 'assets' ? memoryAssetStates : kind === 'plan-jobs' ? memoryPlanJobStates : memoryGenerationTaskStates);
const sha256Hex = (value) => createHash('sha256').update(value).digest('hex');
const ensureArray = (value) => Array.isArray(value) ? value : [];
const makeId = (prefix) => `${prefix}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;

const readCloudCollection = async (kind, clientId = 'anonymous') => {
  const safeClientId = normalizeClientId(clientId) || 'anonymous';
  const key = collectionKey(kind, safeClientId);
  const field = collectionField(kind);
  const store = await cloudStore();
  if (store) {
    const data = await store.get(key, { type: 'json' }).catch(() => null);
    if (data) return { client_id: safeClientId, storage_key: key, storage: 'netlify-blobs', [field]: ensureArray(data[field]) };
  }
  const memory = memoryCollectionMap(kind);
  if (!memory.has(key)) memory.set(key, { client_id: safeClientId, storage_key: key, storage: 'memory-fallback', [field]: [] });
  return memory.get(key);
};

const writeCloudCollection = async (kind, clientId = 'anonymous', items = []) => {
  const safeClientId = normalizeClientId(clientId) || 'anonymous';
  const key = collectionKey(kind, safeClientId);
  const field = collectionField(kind);
  const payload = { client_id: safeClientId, storage_key: key, updated_at: nowIso(), [field]: ensureArray(items) };
  const store = await cloudStore();
  if (store) {
    await store.setJSON(key, payload);
    return { ...payload, storage: 'netlify-blobs' };
  }
  const fallback = { ...payload, storage: 'memory-fallback' };
  memoryCollectionMap(kind).set(key, fallback);
  return fallback;
};

const upsertCollectionItem = async (kind, clientId, item, idField, currentState = null) => {
  const current = currentState || await readCloudCollection(kind, clientId);
  const field = collectionField(kind);
  const id = String(item[idField] || '');
  const items = ensureArray(current[field]).filter((entry) => String(entry[idField] || '') !== id);
  items.unshift(item);
  return writeCloudCollection(kind, clientId, items);
};

const COMMERCIAL_METERING_PREFIX = 'metering/v1';
const COMMERCIAL_ANALYTICS_PREFIX = 'analytics/v1';
const FUNNEL_EVENTS = new Set([
  'home_view',
  'intake_started',
  'generation_submitted',
  'generation_result',
  'effect_recorded',
  'next_round_entered',
]);
const FUNNEL_PROPERTY_KEYS = new Set([
  'source',
  'route',
  'outcome',
  'fallback',
  'reason_code',
  'round_number',
  'would_rate_limit',
  'rate_scope',
]);
const meteringHashSecret = () => envValue('METERING_HASH_SECRET', 'INTERNAL_ACCESS_TOKEN') || 'local-development-metering-secret';
const meteringHash = (scope = '', value = '') => createHmac('sha256', meteringHashSecret())
  .update(`${scope}:${String(value || '')}`)
  .digest('hex')
  .slice(0, 32);
const normalizeEventId = (value = '') => {
  const normalized = String(value || '').trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 96);
  return normalized.length >= 8 ? normalized : `evt-${randomUUID()}`;
};
const requestIpValue = (request = null) => {
  const direct = String(request?.headers?.get('x-nf-client-connection-ip') || '').trim();
  const forwarded = String(request?.headers?.get('x-forwarded-for') || '').split(',')[0].trim();
  return (direct || forwarded || 'unknown').slice(0, 128);
};
const commercialBlobGet = async (key = '') => {
  const store = await cloudStore();
  if (store) {
    const data = await store.get(key, { type: 'json' }).catch(() => null);
    if (data) return data;
  }
  return memoryCommercialEvents.get(key) || null;
};
const commercialBlobSet = async (key = '', value = {}) => {
  const store = await cloudStore();
  if (store) {
    await store.setJSON(key, value);
    return { ...value, storage: 'netlify-blobs' };
  }
  memoryCommercialEvents.set(key, value);
  return { ...value, storage: 'memory-fallback' };
};
const commercialBlobKeys = async (prefix = '') => {
  const keys = new Set();
  const store = await cloudStore();
  if (store?.list) {
    let cursor = undefined;
    for (let page = 0; page < 20; page += 1) {
      const result = await store.list({ prefix, ...(cursor ? { cursor } : {}) }).catch(() => null);
      const blobs = Array.isArray(result?.blobs) ? result.blobs : (Array.isArray(result) ? result : []);
      blobs.forEach((blob) => {
        const key = typeof blob === 'string' ? blob : blob?.key;
        if (key?.startsWith(prefix)) keys.add(key);
      });
      cursor = result?.cursor || result?.nextCursor || '';
      if (!cursor) break;
    }
  }
  for (const key of memoryCommercialEvents.keys()) if (key.startsWith(prefix)) keys.add(key);
  return [...keys];
};
const safeTrackingString = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._,-]+/g, '')
  .slice(0, 80);
const safeFunnelProperties = (properties = {}) => Object.fromEntries(
  Object.entries(properties || {})
    .filter(([key]) => FUNNEL_PROPERTY_KEYS.has(key))
    .map(([key, value]) => {
      if (typeof value === 'boolean') return [key, value];
      if (typeof value === 'number' && Number.isFinite(value)) return [key, value];
      return [key, safeTrackingString(value)];
    })
);
const writeFunnelEvent = async ({ event = '', clientId = '', eventId = '', properties = {} } = {}) => {
  if (!trackingEnabled()) return { accepted: false, reason: 'tracking_disabled' };
  if (!FUNNEL_EVENTS.has(event)) throw new Error('unsupported_tracking_event');
  const safeClientId = normalizeClientId(clientId);
  if (!safeClientId) throw new Error('tracking_requires_client_id');
  const occurredAt = nowIso();
  const date = shanghaiDateIso();
  const normalizedId = normalizeEventId(eventId);
  const clientHash = meteringHash('client', safeClientId);
  const eventHash = meteringHash('event', `${safeClientId}:${event}:${normalizedId}`);
  const key = `${COMMERCIAL_ANALYTICS_PREFIX}/${date}/${event}/${clientHash}/${eventHash}`;
  const record = {
    event,
    occurred_at: occurredAt,
    client_hash: clientHash,
    event_id_hash: eventHash,
    properties: safeFunnelProperties(properties),
  };
  await commercialBlobSet(key, record);
  return { accepted: true, event, event_id: normalizedId };
};
const rateEventTimestamp = (key = '') => Number(String(key).split('/').pop()?.split('-')[0] || 0);
const countRateEvents = async (prefix = '', sinceMs = 0) => {
  const keys = await commercialBlobKeys(prefix);
  return keys.filter((key) => rateEventTimestamp(key) >= sinceMs).length;
};
const generationRequestId = (payload = {}) => normalizeEventId(payload.request_id || payload.idempotency_key || '');
const reservationKeyFor = (clientHash = '', requestId = '') => `${COMMERCIAL_METERING_PREFIX}/reservations/${clientHash}/${meteringHash('request', requestId)}`;
const reserveGenerationRequest = async ({ request = null, clientId = '', requestId = '', route = 'plan-jobs' } = {}) => {
  const safeClientId = normalizeClientId(clientId);
  if (!safeClientId) throw new Error('generation_requires_client_id');
  const normalizedRequestId = normalizeEventId(requestId);
  const clientHash = meteringHash('client', safeClientId);
  const ipHash = meteringHash('ip', requestIpValue(request));
  const reservationKey = reservationKeyFor(clientHash, normalizedRequestId);
  const existing = await commercialBlobGet(reservationKey);
  if (existing) return { ...existing, duplicate: true, reservation_key: reservationKey };

  const nowMs = Date.now();
  const date = shanghaiDateIso();
  const requestHash = meteringHash('request', normalizedRequestId);
  const base = {
    reservation_id: requestHash,
    request_id: normalizedRequestId,
    client_hash: clientHash,
    ip_hash: ipHash,
    route,
    status: 'reserved',
    created_at: nowIso(),
    created_at_ms: nowMs,
  };
  await commercialBlobSet(reservationKey, base);
  const clientPrefix = `${COMMERCIAL_METERING_PREFIX}/rate/client/${clientHash}/${date}/`;
  const ipPrefix = `${COMMERCIAL_METERING_PREFIX}/rate/ip/${ipHash}/${date}/`;
  const rateSuffix = `${nowMs}-${requestHash}`;
  await Promise.all([
    commercialBlobSet(`${clientPrefix}${rateSuffix}`, { reservation_id: requestHash, created_at_ms: nowMs }),
    commercialBlobSet(`${ipPrefix}${rateSuffix}`, { reservation_id: requestHash, created_at_ms: nowMs }),
  ]);
  const windowStart = nowMs - generationRateWindowSeconds() * 1000;
  const [clientWindowCount, ipWindowCount, clientDailyCount] = await Promise.all([
    countRateEvents(clientPrefix, windowStart),
    countRateEvents(ipPrefix, windowStart),
    countRateEvents(clientPrefix, 0),
  ]);
  const scopes = [];
  if (clientWindowCount > generationRateClientMax()) scopes.push('client_window');
  if (ipWindowCount > generationRateIpMax()) scopes.push('ip_window');
  if (clientDailyCount > generationDailyClientMax()) scopes.push('client_daily');
  const wouldRateLimit = scopes.length > 0;
  const decision = {
    ...base,
    status: wouldRateLimit && rateLimitEnforced() ? 'rate_limited' : 'accepted',
    duplicate: false,
    would_rate_limit: wouldRateLimit,
    rate_limit_enforced: rateLimitEnforced(),
    rate_scope: scopes.join(','),
    retry_after_seconds: scopes.includes('client_daily') ? 86400 : generationRateWindowSeconds(),
    counts: { client_window: clientWindowCount, ip_window: ipWindowCount, client_daily: clientDailyCount },
    limits: { client_window: generationRateClientMax(), ip_window: generationRateIpMax(), client_daily: generationDailyClientMax() },
    reservation_key: reservationKey,
  };
  await commercialBlobSet(reservationKey, decision);
  await writeFunnelEvent({
    event: 'generation_submitted',
    clientId: safeClientId,
    eventId: normalizedRequestId,
    properties: { route, would_rate_limit: wouldRateLimit, rate_scope: decision.rate_scope },
  });
  if (wouldRateLimit) {
    console.log(JSON.stringify({
      event: rateLimitEnforced() ? 'rate_limit_enforced' : 'rate_limit_shadow',
      route,
      client_hash: clientHash.slice(0, 12),
      ip_hash: ipHash.slice(0, 12),
      rate_scope: decision.rate_scope,
    }));
  }
  return decision;
};
const linkGenerationReservation = async (reservation = {}, jobId = '') => {
  if (!reservation.reservation_key) return reservation;
  const linked = { ...reservation, job_id: jobId || reservation.job_id || '', updated_at: nowIso() };
  await commercialBlobSet(reservation.reservation_key, linked);
  return linked;
};
const providerAttemptWasPaid = (meta = {}) => {
  const normalized = normalizeModelMeta(meta);
  const reason = String(normalized.fallback_reason || '');
  if (!normalized.requested_model || normalized.requested_model === 'rule_template') return false;
  return !['missing_ark_api_key', 'missing_ark_model', 'safe_to_run_disabled', 'client_poll_timeout'].includes(reason);
};
const completeGenerationMetering = async ({ reservation = {}, clientId = '', jobId = '', result = null, outcome = 'completed', error = '' } = {}) => {
  const safeClientId = normalizeClientId(clientId);
  if (!safeClientId) return;
  const clientHash = reservation.client_hash || meteringHash('client', safeClientId);
  const date = shanghaiDateIso();
  const stableId = String(jobId || reservation.request_id || randomUUID());
  const meta = normalizeModelMeta(result?.generation_meta || result?.model_info || {});
  if (outcome === 'completed') {
    await commercialBlobSet(`${COMMERCIAL_METERING_PREFIX}/product/${clientHash}/${date}/${meteringHash('product', stableId)}`, {
      job_id_hash: meteringHash('job', stableId),
      delivered: true,
      fallback: Boolean(meta.fallback),
      content_safety_adjusted: Boolean(meta.content_safety_adjusted),
      provider_attempt_count: Number(meta.provider_attempt_count || 0),
      created_at: nowIso(),
    });
  }
  await commercialBlobSet(`${COMMERCIAL_METERING_PREFIX}/provider/${clientHash}/${date}/${meteringHash('provider', `${stableId}:${reservation.attempt || 1}`)}`, {
    job_id_hash: meteringHash('job', stableId),
    provider: meta.provider,
    requested_model: meta.requested_model,
    paid_attempt: providerAttemptWasPaid(meta),
    fallback: Boolean(meta.fallback),
    content_safety_adjusted: Boolean(meta.content_safety_adjusted),
    safety_adjustment_count: Number(meta.safety_adjustment_count || 0),
    provider_attempt_count: Number(meta.provider_attempt_count || 0),
    repair_attempted: Boolean(meta.repair_attempted),
    repair_succeeded: Boolean(meta.repair_succeeded),
    repair_recovered_count: Number(meta.repair_recovered_count || 0),
    reason_code: meta.fallback_reason || error || '',
    created_at: nowIso(),
  });
  if (reservation.reservation_key) {
    await commercialBlobSet(reservation.reservation_key, {
      ...reservation,
      status: outcome,
      job_id: jobId || reservation.job_id || '',
      fallback: Boolean(meta.fallback),
      reason_code: meta.fallback_reason || error || '',
      completed_at: nowIso(),
    });
  }
  await writeFunnelEvent({
    event: 'generation_result',
    clientId: safeClientId,
    eventId: reservation.request_id || stableId,
    properties: {
      route: reservation.route || 'plan-jobs',
      outcome,
      fallback: Boolean(meta.fallback),
      reason_code: meta.fallback_reason || error || '',
      would_rate_limit: Boolean(reservation.would_rate_limit),
      rate_scope: reservation.rate_scope || '',
    },
  });
};
const recordInternalProviderUsage = async ({ task = {}, submitted = {} } = {}) => {
  const clientId = normalizeClientId(task.client_id) || INTERNAL_CLIENT_ID;
  const clientHash = meteringHash('client', clientId);
  const date = shanghaiDateIso();
  const meta = normalizeModelMeta({
    provider: submitted.provider || task.provider,
    requested_model: task.requested_model,
    actual_model: submitted.actual_model || task.actual_model || 'rule_template',
    fallback: Boolean(submitted.fallback || !submitted.ok),
    fallback_reason: submitted.fallback_reason || submitted.error || null,
  });
  await commercialBlobSet(`${COMMERCIAL_METERING_PREFIX}/provider/${clientHash}/${date}/${meteringHash('internal-task', task.task_id || randomUUID())}`, {
    task_id_hash: meteringHash('task', task.task_id || ''),
    provider: meta.provider,
    requested_model: meta.requested_model,
    paid_attempt: providerAttemptWasPaid(meta),
    fallback: Boolean(meta.fallback),
    reason_code: meta.fallback_reason || '',
    source: 'internal_generation_task',
    created_at: nowIso(),
  });
};
const funnelSummary = async ({ from = '', to = '' } = {}) => {
  const keys = await commercialBlobKeys(`${COMMERCIAL_ANALYTICS_PREFIX}/`);
  const selected = keys.filter((key) => {
    const date = key.split('/')[2] || '';
    return (!from || date >= from) && (!to || date <= to);
  }).slice(0, 5000);
  const records = (await Promise.all(selected.map((key) => commercialBlobGet(key)))).filter(Boolean);
  const counts = Object.fromEntries([...FUNNEL_EVENTS].map((event) => [event, 0]));
  const generationOutcomes = {};
  let rateLimitShadowHits = 0;
  records.forEach((record) => {
    if (FUNNEL_EVENTS.has(record.event)) counts[record.event] += 1;
    if (record.event === 'generation_result') {
      const outcome = record.properties?.outcome || 'unknown';
      generationOutcomes[outcome] = Number(generationOutcomes[outcome] || 0) + 1;
    }
    if (record.event === 'generation_submitted' && record.properties?.would_rate_limit) rateLimitShadowHits += 1;
  });
  const inRange = (key) => {
    const date = key.split('/')[4] || '';
    return (!from || date >= from) && (!to || date <= to);
  };
  const [productKeys, providerKeys] = await Promise.all([
    commercialBlobKeys(`${COMMERCIAL_METERING_PREFIX}/product/`),
    commercialBlobKeys(`${COMMERCIAL_METERING_PREFIX}/provider/`),
  ]);
  const selectedProviderKeys = providerKeys.filter(inRange).slice(0, 5000);
  const providerRecords = (await Promise.all(selectedProviderKeys.map((key) => commercialBlobGet(key)))).filter(Boolean);
  return {
    readonly: true,
    from: from || null,
    to: to || null,
    counts,
    generation_outcomes: generationOutcomes,
    rate_limit_shadow_hits: rateLimitShadowHits,
    metering: {
      product_usage: productKeys.filter(inRange).length,
      provider_attempts: providerRecords.reduce((sum, record) => sum + Number(record.provider_attempt_count || 1), 0),
      paid_provider_attempts: providerRecords.reduce((sum, record) => sum + (record.paid_attempt ? Number(record.provider_attempt_count || 1) : 0), 0),
    },
  };
};
const rateLimitedResponse = (decision = {}) => new Response(JSON.stringify({
  error: '生成太频繁，稍等片刻再试',
  code: 'rate_limited',
  retry_after_seconds: Number(decision.retry_after_seconds || generationRateWindowSeconds()),
}, null, 2), {
  status: 429,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'retry-after': String(Number(decision.retry_after_seconds || generationRateWindowSeconds())),
  },
});

const assetHashBuffer = (payload = {}) => {
  if (payload.file_content_base64 || payload.content_base64) {
    return Buffer.from(String(payload.file_content_base64 || payload.content_base64), 'base64');
  }
  if (payload.text_content) return Buffer.from(String(payload.text_content), 'utf8');
  if (payload.storage_url) return Buffer.from(String(payload.storage_url), 'utf8');
  return null;
};

const normalizeUsageScope = (value = '') =>
  value === 'cross_project_authorized' ? 'cross_project_authorized' : 'current_project_only';

const createAsset = async (payload = {}) => {
  const client_id = normalizeClientId(payload.client_id);
  if (!client_id) throw new Error('素材必须包含有效 client_id');
  if (!payload.project_id) throw new Error('素材必须包含 project_id');
  const buffer = assetHashBuffer(payload);
  const computedHash = buffer ? sha256Hex(buffer) : '';
  const providedHash = String(payload.sha256 || '').trim().toLowerCase();
  if (providedHash && computedHash && providedHash !== computedHash) throw new Error('素材 sha256 校验失败');
  const usage_scope = normalizeUsageScope(payload.usage_scope);
  const asset = {
    asset_id: payload.asset_id || makeId('asset'),
    project_id: String(payload.project_id || ''),
    project_name: payload.project_name || '',
    client_id,
    client_name: payload.client_name || '',
    original_filename: payload.original_filename || payload.filename || '未命名素材',
    file_path: payload.file_path || '',
    storage_url: payload.storage_url || (buffer ? `blob://asset/${computedHash}` : ''),
    mime_type: payload.mime_type || payload.type || 'application/octet-stream',
    file_size: Number(payload.file_size || buffer?.length || 0),
    sha256: computedHash || providedHash,
    duration: payload.duration || '',
    resolution: payload.resolution || '',
    uploaded_by: payload.uploaded_by || 'internal',
    uploaded_at: payload.uploaded_at || nowIso(),
    source: payload.source || 'internal',
    usage_scope,
    cross_project_authorization: usage_scope === 'cross_project_authorized'
      ? (payload.cross_project_authorization || { authorized_by: payload.uploaded_by || 'internal', authorized_at: nowIso(), reason: payload.authorization_reason || 'V1授权复用' })
      : null,
    status: payload.status || (buffer || payload.storage_url ? 'ok' : 'unreadable'),
    notes: payload.notes || '',
  };
  await upsertCollectionItem('assets', client_id, asset, 'asset_id');
  return asset;
};

const listAssets = async ({ clientId = 'anonymous', projectId = '' } = {}) => {
  const current = await readCloudCollection('assets', clientId);
  return ensureArray(current.assets)
    .filter((asset) => !projectId || asset.project_id === projectId || (asset.usage_scope === 'cross_project_authorized' && asset.cross_project_authorization))
    .filter((asset) => asset.usage_scope === 'current_project_only' ? (!projectId || asset.project_id === projectId) : Boolean(asset.cross_project_authorization));
};

const requestedModelForGeneration = (generationType = '') => {
  if (['image', 'cover'].includes(generationType)) return 'GPT-Image-2';
  if (generationType === 'video') return 'Seedance 2.0';
  if (['script', 'copy'].includes(generationType)) return 'Claude Opus';
  return 'Claude Opus';
};

const providerForGeneration = (generationType = '') => {
  if (['image', 'cover'].includes(generationType)) return 'openai-image';
  if (generationType === 'video') return 'seedance-video';
  if (['script', 'copy'].includes(generationType)) return 'claude-text';
  return 'claude-text';
};

const statusEvent = (status, note = '') => ({ status, note, at: nowIso() });
const withStatus = (task, status, note = '') => ({
  ...task,
  status,
  status_events: [...ensureArray(task.status_events), statusEvent(status, note)],
  updated_at: nowIso(),
});

const createGenerationTask = async (payload = {}) => {
  const client_id = normalizeClientId(payload.client_id);
  const missing = ['project_id', 'client_id', 'content_plan_record_id'].filter((key) => !String(payload[key] || '').trim());
  if (missing.length || !client_id) throw new Error(`创建生成任务缺少必填归属字段：${missing.join(', ') || 'client_id'}`);
  const generation_type = payload.generation_type || (payload.content_type === '视频' ? 'video' : payload.content_type === '封面' ? 'cover' : 'copy');
  const requested_model = payload.requested_model || requestedModelForGeneration(generation_type);
  const task = {
    task_id: payload.task_id || makeId('task'),
    project_id: String(payload.project_id),
    client_id,
    client_name: payload.client_name || '',
    content_plan_record_id: String(payload.content_plan_record_id),
    platform: payload.platform || '小红书',
    content_type: payload.content_type || (generation_type === 'video' ? '视频' : generation_type === 'cover' ? '封面' : '脚本'),
    generation_type,
    requested_model,
    actual_model: payload.actual_model || '',
    provider: payload.provider || providerForGeneration(generation_type),
    fallback: false,
    fallback_reason: null,
    error: '',
    provider_job_id: '',
    prompt: payload.prompt || '',
    output_spec: {
      size: payload.output_spec?.size || payload.size || 'auto',
      duration: payload.output_spec?.duration || payload.duration || '',
      style: payload.output_spec?.style || payload.style || '',
      client_visible: Boolean(payload.output_spec?.client_visible ?? payload.client_visible ?? true),
    },
    input_asset_ids: ensureArray(payload.input_asset_ids),
    output_asset_ids: [],
    status: payload.status || 'draft',
    qa: {
      qa_status: 'pending',
      qa_reviewer: '',
      qa_time: '',
      qa_notes: '',
      visual_check: false,
      content_check: false,
      brand_check: false,
      platform_fit_check: false,
      client_visibility_check: false,
      rejection_reason: '',
      qa_evidence_urls: [],
    },
    created_at: payload.created_at || nowIso(),
    updated_at: payload.updated_at || nowIso(),
    submitted_by: payload.submitted_by || 'internal',
    status_events: [statusEvent(payload.status || 'draft', '任务创建')],
  };
  await upsertCollectionItem('tasks', client_id, task, 'task_id');
  return task;
};

const listTasks = async ({ clientId = 'anonymous', projectId = '', view = 'internal' } = {}) => {
  const current = await readCloudCollection('tasks', clientId);
  let tasks = ensureArray(current.tasks).filter((task) => !projectId || task.project_id === projectId);
  if (view === 'client') tasks = tasks.filter((task) => task.qa?.qa_status === 'passed' && task.output_spec?.client_visible);
  return view === 'client' ? tasks.map(clientVisibleTask) : tasks;
};

const getTask = async (clientId, taskId) => {
  const current = await readCloudCollection('tasks', clientId);
  return ensureArray(current.tasks).find((task) => task.task_id === taskId) || null;
};

const saveTask = async (task) => {
  await upsertCollectionItem('tasks', task.client_id, task, 'task_id');
  return task;
};

const outputAssetForTask = async (task, output = {}) => {
  const body = JSON.stringify({ task_id: task.task_id, output, at: nowIso() });
  const sha256 = sha256Hex(body);
  return createAsset({
    project_id: task.project_id,
    project_name: task.project_name || '',
    client_id: task.client_id,
    client_name: task.client_name || '',
    original_filename: `${task.generation_type}-${task.task_id}.${task.generation_type === 'video' ? 'mp4' : task.generation_type === 'script' || task.generation_type === 'copy' ? 'txt' : 'png'}`,
    storage_url: output.storage_url || `mock://generation/${task.task_id}/${sha256.slice(0, 10)}`,
    mime_type: output.mime_type || (task.generation_type === 'video' ? 'video/mp4' : task.generation_type === 'script' || task.generation_type === 'copy' ? 'text/plain' : 'image/png'),
    file_size: body.length,
    sha256,
    duration: output.duration || task.output_spec?.duration || '',
    resolution: output.resolution || task.output_spec?.size || '',
    uploaded_by: 'model-adapter',
    source: 'internal',
    usage_scope: 'current_project_only',
    status: 'ok',
    notes: output.text || output.summary || 'mock adapter output',
    text_content: body,
  });
};

const adapterManifest = ({ provider, mode = 'mock', reason = '', requestedModel = '', actualModel = '', providerJobId = '', output = null, extra = {} } = {}) => ({
  provider,
  mode,
  reason,
  requested_model: requestedModel || null,
  actual_model: actualModel || requestedModel || null,
  provider_job_id: providerJobId || '',
  output,
  created_at: nowIso(),
  ...extra,
});

const mockAdapterResult = ({ task, provider, reason = 'MOCK_KEY_MISSING', output = null, isAsync = false } = {}) => ({
  ok: true,
  provider,
  provider_job_id: isAsync ? `${provider}_mock_${task.task_id}` : '',
  actual_model: task.requested_model,
  fallback: true,
  fallback_reason: reason,
  output,
  manifest: adapterManifest({
    provider,
    mode: 'mock',
    reason,
    requestedModel: task.requested_model,
    actualModel: task.requested_model,
    providerJobId: isAsync ? `${provider}_mock_${task.task_id}` : '',
    output,
  }),
});

const jsonFetch = async (url, options = {}, timeoutMs = MODEL_TIMEOUT_MS) => {
  const res = await fetchWithTimeout(url, options, timeoutMs);
  const textBody = await res.text();
  let data = null;
  try {
    data = textBody ? JSON.parse(textBody) : null;
  } catch {
    data = { raw: textBody };
  }
  if (!res.ok) {
    const message = data?.error?.message || data?.message || `HTTP_${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
};

const parseDurationSeconds = (value = '') => {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 8;
};

const seedanceContentFor = (task = {}, inputAssets = []) => {
  const imageAsset = inputAssets.find((asset) => String(asset.mime_type || '').startsWith('image/') || String(asset.storage_url || '').startsWith('http') || String(asset.storage_url || '').startsWith('data:image/'));
  const content = [];
  if (imageAsset?.storage_url) content.push({ type: 'image_url', image_url: { url: imageAsset.storage_url } });
  content.push({ type: 'text', text: task.prompt || '生成一条营销短视频素材' });
  return content;
};

const submitSeedanceVideo = async ({ task, inputAssets }) => {
  if (!arkApiKey()) {
    return mockAdapterResult({ task, provider: 'seedance-video', reason: 'MOCK_KEY_MISSING', isAsync: true });
  }
  if (!paidGenerationSafeToRun()) {
    return mockAdapterResult({ task, provider: 'seedance-video', reason: 'MOCK_SAFE_TO_RUN_REQUIRED', isAsync: true });
  }
  const base = String(ARK_BASE_URL || '').replace(/\/+$/, '');
  const model = task.requested_model && !/^Seedance\s/i.test(task.requested_model) ? task.requested_model : SEEDANCE_MODEL;
  const data = await jsonFetch(`${base}/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${arkApiKey()}`,
    },
    body: JSON.stringify({
      model,
      content: seedanceContentFor(task, inputAssets),
      duration: parseDurationSeconds(task.output_spec?.duration),
      ratio: task.output_spec?.ratio || '9:16',
      generate_audio: task.output_spec?.generate_audio ?? true,
    }),
  });
  const providerJobId = data?.id || data?.task_id || data?.data?.id || data?.data?.task_id || '';
  if (!providerJobId) throw new Error('seedance_submit_missing_task_id');
  return {
    ok: true,
    provider: 'seedance-video',
    provider_job_id: providerJobId,
    actual_model: data?.model || model,
    fallback: false,
    fallback_reason: null,
    manifest: adapterManifest({ provider: 'seedance-video', mode: 'real', requestedModel: model, actualModel: data?.model || model, providerJobId }),
  };
};

const pollSeedanceVideo = async ({ task, provider_job_id }) => {
  const count = Number(task.adapter_state?.poll_count || 0) + 1;
  if (String(provider_job_id || '').startsWith('seedance-video_mock_')) {
    if (count < 2) return { status: 'generating', poll_count: count, backoff_ms: Math.min(30000, 2000 * (2 ** Math.max(0, count - 1))) };
    return {
      status: 'succeeded',
      poll_count: count,
      output: { storage_url: `mock://seedance-video/${task.task_id}.mp4`, mime_type: 'video/mp4', duration: task.output_spec?.duration || '6s', resolution: task.output_spec?.size || '1080x1920', summary: `Seedance mock video output: ${task.fallback_reason || 'mock'}` },
      manifest: adapterManifest({ provider: 'seedance-video', mode: 'mock', reason: task.fallback_reason || 'MOCK_KEY_MISSING', requestedModel: task.requested_model, actualModel: task.actual_model || task.requested_model, providerJobId: provider_job_id }),
    };
  }
  if (!arkApiKey()) return { status: 'failed', poll_count: count, error: 'MOCK_KEY_MISSING' };
  const base = String(ARK_BASE_URL || '').replace(/\/+$/, '');
  const data = await jsonFetch(`${base}/contents/generations/tasks/${encodeURIComponent(provider_job_id)}`, {
    headers: { authorization: `Bearer ${arkApiKey()}` },
  });
  const status = data?.status || data?.data?.status || 'running';
  if (status === 'succeeded') {
    const videoUrl = data?.result?.content?.video_url || data?.content?.video_url || data?.data?.result?.content?.video_url || '';
    return {
      status: 'succeeded',
      poll_count: count,
      output: { storage_url: videoUrl, mime_type: 'video/mp4', duration: task.output_spec?.duration || '', resolution: task.output_spec?.size || '', summary: 'Seedance video generated' },
      manifest: adapterManifest({ provider: 'seedance-video', mode: 'real', requestedModel: task.requested_model, actualModel: task.actual_model || task.requested_model, providerJobId: provider_job_id, output: { video_url: videoUrl } }),
    };
  }
  if (['failed', 'cancelled'].includes(status)) return { status: 'failed', poll_count: count, error: data?.error?.message || status };
  return { status: 'generating', poll_count: count, backoff_ms: Math.min(60000, 3000 * (2 ** Math.min(count - 1, 5))) };
};

const submitOpenAIImage = async ({ task }) => {
  const output = { storage_url: `mock://openai-image/${task.task_id}.png`, mime_type: 'image/png', resolution: task.output_spec?.size || '1024x1024', summary: `OpenAI image mock: ${task.prompt || task.content_type}` };
  if (!openaiApiKey()) return mockAdapterResult({ task, provider: 'openai-image', reason: 'MOCK_KEY_MISSING', output });
  if (!paidGenerationSafeToRun()) return mockAdapterResult({ task, provider: 'openai-image', reason: 'MOCK_SAFE_TO_RUN_REQUIRED', output });
  const base = String(OPENAI_BASE_URL || '').replace(/\/+$/, '');
  const model = task.requested_model && !/^GPT-Image/i.test(task.requested_model) ? task.requested_model : OPENAI_IMAGE_MODEL;
  const data = await jsonFetch(`${base}/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${openaiApiKey()}` },
    body: JSON.stringify({ model, prompt: task.prompt || 'marketing asset image', size: task.output_spec?.size || '1024x1024', n: 1 }),
  });
  const image = data?.data?.[0] || {};
  const storageUrl = image.url || (image.b64_json ? `data:image/png;base64,${image.b64_json}` : '');
  return {
    ok: true,
    provider: 'openai-image',
    actual_model: data?.model || model,
    fallback: false,
    fallback_reason: null,
    output: { ...output, storage_url: storageUrl || output.storage_url, summary: 'OpenAI image generated' },
    manifest: adapterManifest({ provider: 'openai-image', mode: 'real', requestedModel: model, actualModel: data?.model || model, output: { has_url: Boolean(storageUrl) } }),
  };
};

const submitClaudeTextSingle = async ({ task }) => {
  const output = { storage_url: `mock://claude-text/${task.task_id}.txt`, mime_type: 'text/plain', text: `Claude mock：${task.prompt || '按内容计划生成素材'}` };
  if (!anthropicApiKey()) return mockAdapterResult({ task, provider: 'claude-text', reason: 'MOCK_KEY_MISSING', output });
  if (!paidGenerationSafeToRun()) return mockAdapterResult({ task, provider: 'claude-text', reason: 'MOCK_SAFE_TO_RUN_REQUIRED', output });
  const data = await jsonFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicApiKey(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: CLAUDE_SCRIPT_MODEL, max_tokens: 1800, messages: [{ role: 'user', content: task.prompt || '生成一份营销短内容脚本' }] }),
  });
  const text = ensureArray(data?.content).map((item) => item?.text || '').join('\n').trim();
  return {
    ok: true,
    provider: 'claude-text',
    actual_model: data?.model || CLAUDE_SCRIPT_MODEL,
    fallback: false,
    fallback_reason: null,
    output: { ...output, storage_url: `real://claude-text/${task.task_id}.txt`, text },
    manifest: adapterManifest({ provider: 'claude-text', mode: 'real', requestedModel: CLAUDE_SCRIPT_MODEL, actualModel: data?.model || CLAUDE_SCRIPT_MODEL, output: { chars: text.length } }),
  };
};

const submitGlmTextSingle = async ({ task }) => {
  const output = { storage_url: `mock://glm-text/${task.task_id}.txt`, mime_type: 'text/plain', text: `GLM mock：${task.prompt || '按内容计划生成素材'}` };
  if (!glmApiKey()) return mockAdapterResult({ task, provider: 'glm-text', reason: 'MOCK_KEY_MISSING', output });
  if (!paidGenerationSafeToRun()) return mockAdapterResult({ task, provider: 'glm-text', reason: 'MOCK_SAFE_TO_RUN_REQUIRED', output });
  const base = String(GLM_BASE_URL || '').replace(/\/+$/, '');
  const data = await jsonFetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${glmApiKey()}` },
    body: JSON.stringify({ model: GLM_MODEL, messages: [{ role: 'user', content: task.prompt || '生成一份营销短内容脚本' }], temperature: 0.7 }),
  });
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  return {
    ok: true,
    provider: 'glm-text',
    actual_model: data?.model || GLM_MODEL,
    fallback: false,
    fallback_reason: null,
    output: { ...output, storage_url: `real://glm-text/${task.task_id}.txt`, text },
    manifest: adapterManifest({ provider: 'glm-text', mode: 'real', requestedModel: GLM_MODEL, actualModel: data?.model || GLM_MODEL, output: { chars: text.length } }),
  };
};

const submitTextAb = async ({ task }) => {
  const [claude, glm] = await Promise.all([
    submitClaudeTextSingle({ task }),
    submitGlmTextSingle({ task }),
  ]);
  const text = [
    'A / claude-text',
    claude.output?.text || '',
    '',
    'B / glm-text',
    glm.output?.text || '',
  ].join('\n');
  return {
    ok: true,
    provider: 'claude-text+glm-text',
    actual_model: `${claude.actual_model || CLAUDE_SCRIPT_MODEL} / ${glm.actual_model || GLM_MODEL}`,
    fallback: Boolean(claude.fallback || glm.fallback),
    fallback_reason: [claude.fallback_reason, glm.fallback_reason].filter(Boolean).join('; ') || null,
    output: { storage_url: `mock://text-ab/${task.task_id}.txt`, mime_type: 'text/plain', text },
    manifest: adapterManifest({
      provider: 'claude-text+glm-text',
      mode: claude.fallback && glm.fallback ? 'mock' : 'mixed',
      reason: [claude.fallback_reason, glm.fallback_reason].filter(Boolean).join('; ') || '',
      requestedModel: task.requested_model,
      actualModel: `${claude.actual_model || CLAUDE_SCRIPT_MODEL} / ${glm.actual_model || GLM_MODEL}`,
      output: { variants: { claude: claude.manifest, glm: glm.manifest } },
    }),
  };
};

const generationAdapters = {
  'openai-image': {
    name: 'openai-image',
    isAsync: false,
    submit: submitOpenAIImage,
  },
  'claude-text': {
    name: 'claude-text',
    isAsync: false,
    submit: submitTextAb,
  },
  'glm-text': {
    name: 'glm-text',
    isAsync: false,
    submit: submitGlmTextSingle,
  },
  'seedance-video': {
    name: 'seedance-video',
    isAsync: true,
    submit: submitSeedanceVideo,
    poll: pollSeedanceVideo,
  },
};

const adapterForTask = (task = {}) => generationAdapters[task.provider] || generationAdapters[providerForGeneration(task.generation_type)] || generationAdapters['claude-text'];

const validateTaskAssets = async (task) => {
  const ids = ensureArray(task.input_asset_ids).map(String).filter(Boolean);
  if (!ids.length) return { ok: true, assets: [] };
  const assets = await listAssets({ clientId: task.client_id, projectId: task.project_id });
  const byId = new Map(assets.map((asset) => [String(asset.asset_id), asset]));
  const missing = ids.filter((id) => !byId.has(id) || byId.get(id).status !== 'ok');
  return { ok: missing.length === 0, assets: ids.map((id) => byId.get(id)).filter(Boolean), missing };
};

const submitGenerationTask = async (clientId, taskId) => {
  let task = await getTask(clientId, taskId);
  if (!task) throw new Error('生成任务不存在');
  task = withStatus(task, 'submitted', '提交生成');
  task = withStatus(task, 'asset_checking', '检查参考素材');
  const assetCheck = await validateTaskAssets(task);
  if (!assetCheck.ok) {
    task = withStatus({ ...task, error: `素材缺失或不可读：${assetCheck.missing.join(', ')}` }, 'blocked_asset_missing', '素材校验失败');
    return saveTask(task);
  }
  const adapter = adapterForTask(task);
  task = withStatus(task, 'queued', '进入模型队列');
  if (String(task.prompt || '').includes('[mock_fail_auth]')) {
    task = withStatus({ ...task, actual_model: 'rule_template', fallback: true, fallback_reason: 'missing_provider_key', error: '模型鉴权失败' }, 'blocked_model_auth', 'mock 鉴权失败');
    return saveTask(task);
  }
  let submitted;
  try {
    submitted = await adapter.submit({ task, inputAssets: assetCheck.assets, outputSpec: task.output_spec });
  } catch (error) {
    submitted = { ok: false, provider: adapter.name, actual_model: 'rule_template', fallback_reason: error.message || 'adapter_failed', error: error.message || 'adapter_failed' };
  }
  await recordInternalProviderUsage({ task, submitted });
  if (!submitted.ok) {
    const status = /auth|key|credential/i.test(submitted.fallback_reason || submitted.error || '') ? 'blocked_model_auth' : 'failed';
    task = withStatus({
      ...task,
      actual_model: submitted.actual_model || 'rule_template',
      provider: submitted.provider || adapter.name,
      fallback: true,
      fallback_reason: submitted.fallback_reason || submitted.error || 'adapter_failed',
      error: submitted.error || submitted.fallback_reason || '模型调用失败',
    }, status, 'adapter 返回失败');
    return saveTask(task);
  }
  task = {
    ...task,
    actual_model: submitted.actual_model || task.requested_model,
    provider: submitted.provider || adapter.name,
    fallback: Boolean(submitted.fallback),
    fallback_reason: submitted.fallback_reason || null,
    provider_job_id: submitted.provider_job_id || '',
    error: '',
    adapter_manifest: submitted.manifest || null,
  };
  if (adapter.isAsync) {
    task = withStatus({ ...task, adapter_state: { poll_count: 0, retry_count: 0, next_poll_at: nowIso() } }, 'generating', task.fallback ? '异步视频 mock 任务已登记' : '异步视频任务已提交');
    return saveTask(task);
  }
  const asset = await outputAssetForTask(task, submitted.output || {});
  task = withStatus({ ...task, output_asset_ids: [asset.asset_id] }, 'generated', '同步素材已生成');
  task = withStatus(task, 'qa_pending', '等待内部 QA');
  return saveTask(task);
};

const pollGenerationTask = async (clientId, taskId) => {
  let task = await getTask(clientId, taskId);
  if (!task) throw new Error('生成任务不存在');
  if (task.generation_type !== 'video') return task;
  if (!task.provider_job_id) throw new Error('视频任务缺少 provider_job_id');
  if (task.status !== 'generating') return task;
  const adapter = generationAdapters['seedance-video'];
  let result;
  try {
    result = await adapter.poll({ task, provider_job_id: task.provider_job_id });
  } catch (error) {
    const retryCount = Number(task.adapter_state?.retry_count || 0) + 1;
    const backoffMs = Math.min(60000, 3000 * (2 ** Math.min(retryCount - 1, 5)));
    task = {
      ...task,
      adapter_state: {
        ...(task.adapter_state || {}),
        poll_count: Number(task.adapter_state?.poll_count || 0) + 1,
        retry_count: retryCount,
        last_poll_error: error.message || 'seedance_poll_error',
        backoff_ms: backoffMs,
        next_poll_at: new Date(Date.now() + backoffMs).toISOString(),
      },
      updated_at: nowIso(),
    };
    return saveTask(task);
  }
  const backoffMs = Number(result.backoff_ms || 0);
  task = {
    ...task,
    adapter_state: {
      ...(task.adapter_state || {}),
      poll_count: result.poll_count || Number(task.adapter_state?.poll_count || 0) + 1,
      retry_count: 0,
      backoff_ms: backoffMs,
      next_poll_at: backoffMs ? new Date(Date.now() + backoffMs).toISOString() : '',
    },
    adapter_manifest: result.manifest || task.adapter_manifest || null,
    updated_at: nowIso(),
  };
  if (result.status === 'generating') return saveTask(task);
  if (result.status === 'failed') {
    task = withStatus({ ...task, error: result.error || '视频生成失败', fallback: true, fallback_reason: result.error || 'seedance_poll_failed' }, 'failed', '异步视频失败');
    return saveTask(task);
  }
  const asset = await outputAssetForTask(task, result.output || {});
  task = withStatus({ ...task, output_asset_ids: [asset.asset_id] }, 'generated', '异步视频已生成');
  task = withStatus(task, 'qa_pending', '等待内部 QA');
  return saveTask(task);
};

const qaGenerationTask = async (clientId, taskId, payload = {}) => {
  let task = await getTask(clientId, taskId);
  if (!task) throw new Error('生成任务不存在');
  const qaStatus = payload.qa_status || (payload.passed ? 'passed' : 'failed');
  const qa = {
    ...task.qa,
    qa_status: qaStatus,
    qa_reviewer: payload.qa_reviewer || payload.reviewer || 'internal',
    qa_time: nowIso(),
    qa_notes: payload.qa_notes || '',
    visual_check: Boolean(payload.visual_check),
    content_check: Boolean(payload.content_check),
    brand_check: Boolean(payload.brand_check),
    platform_fit_check: Boolean(payload.platform_fit_check),
    client_visibility_check: Boolean(payload.client_visibility_check),
    rejection_reason: qaStatus === 'failed' ? (payload.rejection_reason || '未通过内部 QA') : '',
    qa_evidence_urls: ensureArray(payload.qa_evidence_urls),
  };
  task = withStatus({ ...task, qa }, qaStatus === 'passed' ? 'client_ready' : 'qa_failed', qaStatus === 'passed' ? 'QA passed' : 'QA failed');
  return saveTask(task);
};

const deliverGenerationTask = async (clientId, taskId) => {
  let task = await getTask(clientId, taskId);
  if (!task) throw new Error('生成任务不存在');
  if (task.status !== 'client_ready') throw new Error('只有 client_ready 的任务可以交付');
  task = withStatus(task, 'delivered', '客户交付完成');
  return saveTask(task);
};

const clientVisibleTask = (task = {}) => sanitizeCustomerPayload({
  task_id: task.task_id,
  project_id: task.project_id,
  client_id: task.client_id,
  content_plan_record_id: task.content_plan_record_id,
  platform: task.platform,
  content_type: task.content_type,
  generation_type: task.generation_type,
  prompt: task.prompt,
  output_spec: task.output_spec,
  output_asset_ids: task.output_asset_ids,
  status: task.status,
  qa: { qa_status: task.qa?.qa_status || 'pending', qa_notes: task.qa?.qa_notes || '' },
  updated_at: task.updated_at,
});

const formatBitableDateValue = (value) => {
  const date = shanghaiClock(new Date(value));
  if (!Number.isFinite(date.getTime())) return '';
  return `${utcDateIso(date)} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
};

export const extractBitableFieldValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Math.abs(value) >= 1e11 && Math.abs(value) <= 4e12 ? formatBitableDateValue(value) : value;
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const values = value
      .map(extractBitableFieldValue)
      .filter((item) => String(item ?? '').trim() !== '');
    return values.length <= 1 ? (values[0] ?? '') : values.join('，');
  }
  if (typeof value === 'object') {
    if (String(value.link || '').trim()) return String(value.link).trim();
    if (String(value.url || '').trim()) return String(value.url).trim();
    for (const key of ['text', 'value', 'name', 'id', 'record_id']) {
      if (value[key] !== undefined && value[key] !== null) return extractBitableFieldValue(value[key]);
    }
  }
  return '';
};

const bitableDateTimestamp = (value) => {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  const text = String(value || '').trim();
  if (!text) return null;
  const shanghaiDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00+08:00` : text;
  const parsed = Date.parse(shanghaiDateOnly);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toBitableFieldValue = (field = {}, value = '') => {
  const descriptor = typeof field === 'string' ? { type: field } : (field || {});
  const type = String(descriptor.type || 'text').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['date', 'datetime', 'date_time', 'timestamp'].includes(type)) return bitableDateTimestamp(value);
  if (['single_select', 'select', 'singlechoice', 'single_choice'].includes(type)) {
    if (value && typeof value === 'object') return String(value.id || value.name || value.value || '').trim();
    return String(value || '').trim();
  }
  if (['url', 'link', 'hyperlink'].includes(type)) {
    const source = value && typeof value === 'object' ? value : { link: value };
    const link = normalizeExternalUrl(source.link || source.url || source.value || '');
    if (!link) return null;
    return { link, text: String(source.text || descriptor.text || descriptor.name || link).trim() };
  }
  if (['number', 'numeric'].includes(type)) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean).join('，');
  if (value && typeof value === 'object') return String(value.text || value.name || value.value || '').trim();
  return String(value ?? '').trim();
};

const normalizeBitableFields = (fields = {}) => Object.fromEntries(
  Object.entries(fields && typeof fields === 'object' && !Array.isArray(fields) ? fields : {})
    .map(([key, value]) => [String(key).trim(), extractBitableFieldValue(value)]),
);

const feishuInboundSources = (payload = {}) => {
  const record = payload.record || payload.data?.record || payload.event?.record || {};
  return [
    payload,
    payload.fields,
    payload.data,
    payload.data?.fields,
    record,
    record.fields,
  ].filter((item) => item && typeof item === 'object' && !Array.isArray(item));
};

const feishuScalarValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const values = value.map(feishuScalarValue).filter((item) => String(item ?? '').trim() !== '');
    return values.length <= 1 ? (values[0] ?? '') : values.join('，');
  }
  if (typeof value === 'object') {
    for (const key of ['value', 'text', 'link', 'url', 'name', 'id', 'record_id']) {
      if (value[key] !== undefined && value[key] !== null) return feishuScalarValue(value[key]);
    }
  }
  return '';
};

const pickFeishuInboundValue = (payload = {}, aliases = []) => {
  for (const source of feishuInboundSources(payload)) {
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(source, alias)) {
        const value = feishuScalarValue(source[alias]);
        if (String(value ?? '').trim() !== '') return value;
      }
      const actualKey = Object.keys(source).find((key) => String(key).trim().toLowerCase() === String(alias).trim().toLowerCase());
      if (actualKey) {
        const value = feishuScalarValue(source[actualKey]);
        if (String(value ?? '').trim() !== '') return value;
      }
    }
  }
  return '';
};

const feishuInboundText = (payload, aliases, fallback = '') => {
  const picked = String(pickFeishuInboundValue(payload, aliases) ?? '').trim();
  return String(picked || fallback || '').trim().slice(0, 2000);
};
const feishuInboundNumber = (payload, aliases) => {
  const raw = String(pickFeishuInboundValue(payload, aliases) ?? '').replace(/,/g, '').trim();
  const parsed = Number(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};
const feishuInboundBoolean = (payload, aliases) => {
  const value = String(pickFeishuInboundValue(payload, aliases) ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'done', 'completed', '完成', '已完成', '是'].includes(value);
};
const normalizeFeishuInboundType = (value = '', payload = {}) => {
  const text = String(value || '').trim().toLowerCase();
  if (/daily|check.?in|打卡|执行/.test(text)) return 'daily_checkin';
  if (/reputation|review|口碑|评价|晒单/.test(text)) return 'reputation_task';
  if (/feedback|effect|metric|发布|效果|数据|反馈|回收/.test(text)) return 'feedback';
  const hasMetrics = feishuInboundNumber(payload, ['views', 'exposure', '浏览/曝光', '曝光', '播放量', '浏览量']) > 0
    || feishuInboundText(payload, ['publish_link', '发布链接']);
  return hasMetrics ? 'feedback' : 'daily_checkin';
};
const replaceFeishuRecord = (items = [], record = {}, matcher = () => false) =>
  [record, ...ensureArray(items).filter((item) => !matcher(item))].slice(0, 500);

export const ingestFeishuRecord = async (payload = {}, {
  request = null,
  eventTypeHint = '',
  feishuRecordId: suppliedRecordId = '',
  source = 'feishu_inbound',
} = {}) => {
  const rawClientId = feishuInboundText(payload, ['client_id', 'customer_key', '客户ID', '客户标识', '门店ID']);
  const clientId = normalizeClientId(rawClientId);
  const projectId = feishuInboundText(payload, ['project_id', '项目ID', '项目标识']);
  const boundClientId = normalizeClientId(request?.headers?.get('x-feishu-client-id') || '');
  if (!clientId || !projectId) {
    return { status: 400, body: { ok: false, error: '飞书回流需要有效的 client_id 和 project_id' } };
  }
  if (boundClientId && boundClientId !== clientId) {
    return { status: 403, body: { ok: false, error: '飞书回流客户标识不匹配' } };
  }

  const cloud = await readCloudState(clientId);
  const projectStore = normalizeCloudProjectStore(cloud.project_store || {});
  const project = ensureArray(projectStore.projects).find((item) => String(item.id || '') === projectId);
  if (!project) {
    return { status: 404, body: { ok: false, error: '指定客户下未找到对应项目，未写入任何数据' } };
  }

  const eventType = normalizeFeishuInboundType(
    eventTypeHint || feishuInboundText(payload, ['event_type', 'record_type', 'type', '数据类型', '回流类型']),
    payload,
  );
  const planReference = feishuInboundText(payload, ['content_plan_id', 'content_plan_record_id', '发布计划ID', '内容计划ID', '计划ID']);
  const plans = ensureArray(project.state?.plans);
  const matchedPlan = planReference
    ? plans.find((item) => [item.id, item.content_plan_id, item.content_plan_record_id].some((value) => String(value ?? '') === planReference))
    : null;
  if (eventType === 'feedback' && !matchedPlan) {
    return { status: 422, body: { ok: false, error: planReference ? '发布计划不属于该客户项目，未写入' : '效果回流需要 content_plan_id' } };
  }

  const receivedAt = nowIso();
  const occurredAt = feishuInboundText(payload, ['occurred_at', 'created_at', 'updated_at', '发布时间', '打卡时间', '日期'], receivedAt) || receivedAt;
  const explicitRecordId = String(suppliedRecordId || feishuInboundText(payload, ['record_id', 'feishu_record_id', '记录ID', 'recordId'])).trim();
  const recordFingerprint = JSON.stringify({ clientId, projectId, eventType, planReference, occurredAt, payload: feishuInboundSources(payload).slice(0, 2) });
  const feishuRecordId = explicitRecordId || `derived_${sha256Hex(recordFingerprint).slice(0, 20)}`;
  const publishLink = normalizeExternalUrl(feishuInboundText(payload, ['publish_link', '发布链接', '内容链接', '作品链接']));
  const metrics = {
    views: feishuInboundNumber(payload, ['views', 'exposure', '浏览/曝光', '曝光', '曝光量', '播放量', '浏览量']),
    likes: feishuInboundNumber(payload, ['likes', '点赞', '点赞数', '点赞量']),
    comments: feishuInboundNumber(payload, ['comments', '评论', '评论数', '评论量']),
    favorites: feishuInboundNumber(payload, ['favorites', '收藏', '收藏数', '收藏量']),
    shares: feishuInboundNumber(payload, ['shares', '转发', '分享', '转发数', '转发量', '分享数']),
    consultations: feishuInboundNumber(payload, ['consultations', 'inquiries', '咨询人数', '咨询数', '咨询量', '私信/咨询', '私信数', '咨询']),
    appointments: feishuInboundNumber(payload, ['appointments', '预约人数', '预约数', '预约量', '到店预约', '到店数', '预约']),
  };
  const suppliedEngagement = feishuInboundNumber(payload, ['engagement', 'interactions', '互动', '互动数']);
  const engagement = suppliedEngagement || metrics.likes + metrics.comments + metrics.favorites + metrics.shares;
  const notes = feishuInboundText(payload, ['notes', 'observation', '备注', '观察', '运营观察', '效果观察', '执行说明', '打卡内容']);
  const observationTags = feishuInboundText(payload, ['observation_tags', '观察标签', '效果标签']);
  const taskName = feishuInboundText(payload, ['task_name', '任务名称', '打卡项', '口碑任务']);
  const eventStatus = feishuInboundText(payload, ['status', '完成状态', '执行状态'], feishuInboundBoolean(payload, ['completed', '是否完成']) ? '已完成' : '已记录');
  const auditRecord = sanitizeCustomerPayload({
    inbound_id: `feishu-inbound-${sha256Hex(`${clientId}:${projectId}:${feishuRecordId}`).slice(0, 20)}`,
    feishu_record_id: feishuRecordId,
    client_id: clientId,
    project_id: projectId,
    content_plan_id: matchedPlan?.id ?? '',
    content_plan_record_id: matchedPlan?.content_plan_record_id || planReference || '',
    event_type: eventType,
    task_name: taskName,
    status: eventStatus,
    completed: feishuInboundBoolean(payload, ['completed', '是否完成']) || /完成/.test(eventStatus),
    publish_link: publishLink,
    metrics: { ...metrics, engagement },
    observation_tags: observationTags,
    notes,
    occurred_at: occurredAt,
    received_at: receivedAt,
    source,
  });

  const previousAudit = ensureArray(project.state?.feishu_inbound_records).find((item) => item.feishu_record_id === feishuRecordId);
  const nextState = {
    ...project.state,
    project_stage: '运营中',
    saved_at: receivedAt,
    feishu_inbound_records: replaceFeishuRecord(project.state?.feishu_inbound_records, auditRecord, (item) => item.feishu_record_id === feishuRecordId),
    feishu_sync: {
      ...(project.state?.feishu_sync || {}),
      last_inbound_at: receivedAt,
      last_record_id: feishuRecordId,
      inbound_record_count: new Set([
        ...ensureArray(project.state?.feishu_inbound_records).map((item) => item.feishu_record_id),
        feishuRecordId,
      ].filter(Boolean)).size,
    },
  };

  if (eventType === 'feedback') {
    const existingFeedback = ensureArray(project.state?.feedback).find((item) => item.feishu_record_id === feishuRecordId);
    const existingRecord = ensureArray(project.state?.records).find((item) => item.feishu_record_id === feishuRecordId);
    const feedback = sanitizeCustomerPayload({
      ...(existingFeedback || {}),
      id: existingFeedback?.id || `feishu-feedback-${sha256Hex(`${clientId}:${projectId}:${feishuRecordId}`).slice(0, 16)}`,
      client_id: clientId,
      project_id: projectId,
      cycle_id: matchedPlan?.cycle_id || project.state?.current_cycle_id || 'cycle-1',
      content_plan_id: matchedPlan.id,
      content_plan_record_id: matchedPlan.content_plan_record_id || planReference || '',
      plan_topic: matchedPlan.topic || feishuInboundText(payload, ['plan_topic', '内容主题', '选题']),
      publish_link: publishLink || existingFeedback?.publish_link || matchedPlan.publish_link || '',
      feedback_stage: feishuInboundText(payload, ['feedback_stage', '反馈时间点', '记录阶段'], existingFeedback?.feedback_stage || 'T+24'),
      views: metrics.views,
      backend_views: metrics.views,
      backend_play_count: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      favorites: metrics.favorites,
      shares: metrics.shares,
      engagement,
      consultations: metrics.consultations,
      appointments: metrics.appointments,
      observation_tags: observationTags,
      notes,
      source,
      plan_binding_source: 'feishu_record_and_client_project',
      feishu_record_id: feishuRecordId,
      created_at: existingFeedback?.created_at || occurredAt,
      updated_at: receivedAt,
    });
    const customerRecord = sanitizeCustomerPayload({
      ...(existingRecord || {}),
      feedback_id: feedback.id,
      feishu_record_id: feishuRecordId,
      client_id: clientId,
      project_id: projectId,
      content_plan_id: matchedPlan.id,
      plan_topic: feedback.plan_topic,
      publish_link: feedback.publish_link,
      feedback_stage: feedback.feedback_stage,
      ...metrics,
      engagement,
      observation_tags: observationTags,
      notes,
      source,
      created_at: existingRecord?.created_at || occurredAt,
      updated_at: receivedAt,
    });
    nextState.feedback = replaceFeishuRecord(project.state?.feedback, feedback, (item) => item.feishu_record_id === feishuRecordId);
    nextState.records = replaceFeishuRecord(project.state?.records, customerRecord, (item) => item.feishu_record_id === feishuRecordId);
    nextState.plans = plans.map((item) => String(item.id ?? '') === String(matchedPlan.id ?? '')
      ? { ...item, status: '已发布', ...(feedback.publish_link ? { publish_link: feedback.publish_link } : {}) }
      : item);
  } else if (eventType === 'reputation_task') {
    nextState.reputation_tasks = replaceFeishuRecord(project.state?.reputation_tasks, auditRecord, (item) => item.feishu_record_id === feishuRecordId);
  } else {
    nextState.daily_checkins = replaceFeishuRecord(project.state?.daily_checkins, auditRecord, (item) => item.feishu_record_id === feishuRecordId);
  }

  const updatedProject = {
    ...project,
    stage: '运营中',
    updated_at: receivedAt,
    state: nextState,
  };
  const written = await writeCloudState({
    project_store: {
      activeProjectId: projectStore.activeProjectId || projectId,
      lastActiveProjectId: projectStore.lastActiveProjectId || null,
      projects: [updatedProject],
    },
  }, clientId);
  console.log(JSON.stringify({
    event: source === 'feishu_inbound' ? 'feishu_inbound' : 'feishu_bitable_ingest',
    client_id: clientId,
    project_id: projectId,
    event_type: eventType,
    feishu_record_id: feishuRecordId,
    idempotent_update: Boolean(previousAudit),
    source,
    storage: written.storage,
  }));
  return {
    status: previousAudit ? 200 : 201,
    body: {
      ok: true,
      accepted: true,
      idempotent_update: Boolean(previousAudit),
      client_id: clientId,
      project_id: projectId,
      event_type: eventType,
      feishu_record_id: feishuRecordId,
      content_plan_id: matchedPlan?.id ?? null,
      source,
      storage: written.storage,
      updated_at: receivedAt,
    },
  };
};

const receiveFeishuInbound = async (payload = {}, request = null) => ingestFeishuRecord(payload, { request });

const FEISHU_OPEN_API_BASE = 'https://open.feishu.cn/open-apis';
let feishuTenantTokenCache = { appId: '', token: '', expiresAt: 0 };
const feishuWikiAppTokenCache = new Map();
const feishuPullTimeoutMs = () => envInteger('FEISHU_PULL_TIMEOUT_MS', 8000, { min: 1000, max: 20000 });
const boundedFeishuPullNumber = (value, fallback, max) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, Math.max(1, Math.floor(parsed))) : fallback;
};
const feishuPullPageSize = (value = 0) => boundedFeishuPullNumber(value, envInteger('FEISHU_PULL_PAGE_SIZE', 100, { min: 1, max: 500 }), 500);
const feishuPullMaxRecords = (value = 0) => boundedFeishuPullNumber(value, envInteger('FEISHU_PULL_MAX_RECORDS', 500, { min: 1, max: 5000 }), 5000);
const feishuPullDeadlineMs = () => envInteger('FEISHU_PULL_DEADLINE_MS', 23000, { min: 5000, max: 26000 });

const feishuSafeError = (error, fallback = 'feishu_request_failed') => {
  if (error?.name === 'AbortError') return 'feishu_request_timeout';
  const code = String(error?.code || '').trim();
  if (code) return code.slice(0, 80);
  const status = Number(error?.status || 0);
  return status ? `${fallback}_${status}` : fallback;
};

const fetchFeishuJson = async (url, options = {}, timeoutMs = feishuPullTimeoutMs()) => {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || Number(data.code || 0) !== 0) {
    const error = new Error('feishu_api_error');
    error.status = response.status;
    error.code = Number(data.code || 0) ? `feishu_api_code_${Number(data.code)}` : `feishu_api_error_${response.status}`;
    throw error;
  }
  return data;
};

const getFeishuTenantAccessToken = async () => {
  const appId = feishuAppId();
  const appSecret = feishuAppSecret();
  if (!appId || !appSecret) {
    const error = new Error('missing_feishu_app_credentials');
    error.code = 'missing_feishu_app_credentials';
    throw error;
  }
  if (feishuTenantTokenCache.appId === appId
    && feishuTenantTokenCache.token
    && feishuTenantTokenCache.expiresAt > Date.now() + 60000) {
    return feishuTenantTokenCache.token;
  }
  const data = await fetchFeishuJson(`${FEISHU_OPEN_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const token = String(data.tenant_access_token || '').trim();
  if (!token) {
    const error = new Error('missing_feishu_tenant_token');
    error.code = 'missing_feishu_tenant_token';
    throw error;
  }
  const expiresIn = Math.max(120, Number(data.expire || data.expires_in || 7200));
  feishuTenantTokenCache = {
    appId,
    token,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };
  return token;
};

const feishuBitableTokenConfig = (payload = {}) => {
  const payloadAppToken = String(payload.app_token || payload.base_token || '').trim();
  const payloadWikiNodeToken = String(payload.wiki_node_token || payload.wiki_token || payload.node_token || '').trim();
  if (payloadAppToken) return { appToken: payloadAppToken, wikiNodeToken: '', source: 'base' };
  if (payloadWikiNodeToken) return { appToken: '', wikiNodeToken: payloadWikiNodeToken, source: 'wiki' };
  const configuredAppToken = feishuBaseToken();
  if (configuredAppToken) return { appToken: configuredAppToken, wikiNodeToken: '', source: 'base' };
  const configuredWikiNodeToken = feishuWikiNodeToken();
  if (configuredWikiNodeToken) return { appToken: '', wikiNodeToken: configuredWikiNodeToken, source: 'wiki' };
  return { appToken: '', wikiNodeToken: '', source: 'none' };
};

const resolveFeishuWikiAppToken = async ({ wikiNodeToken, tenantToken }) => {
  const nodeToken = String(wikiNodeToken || '').trim();
  if (!nodeToken) {
    const error = new Error('missing_feishu_wiki_node_token');
    error.code = 'missing_feishu_wiki_node_token';
    throw error;
  }
  const cacheKey = `${feishuAppId()}:${nodeToken}`;
  const cached = feishuWikiAppTokenCache.get(cacheKey);
  if (cached?.appToken && cached.expiresAt > Date.now()) return cached.appToken;

  const startedAt = Date.now();
  const url = new URL(`${FEISHU_OPEN_API_BASE}/wiki/v2/spaces/get_node`);
  url.searchParams.set('token', nodeToken);
  const data = await fetchFeishuJson(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${tenantToken}` },
  });
  const node = data.data?.node || {};
  if (String(node.obj_type || '').trim().toLowerCase() !== 'bitable') {
    const error = new Error('feishu_wiki_node_not_bitable');
    error.code = 'feishu_wiki_node_not_bitable';
    throw error;
  }
  const appToken = String(node.obj_token || '').trim();
  if (!appToken) {
    const error = new Error('missing_feishu_wiki_obj_token');
    error.code = 'missing_feishu_wiki_obj_token';
    throw error;
  }
  feishuWikiAppTokenCache.set(cacheKey, {
    appToken,
    expiresAt: Date.now() + 30 * 60 * 1000,
  });
  console.log(JSON.stringify({
    event: 'feishu_wiki_node_resolved',
    obj_type: 'bitable',
    latency_ms: Date.now() - startedAt,
  }));
  return appToken;
};

const normalizeFeishuTableEventType = (value = '') => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (['feedback', 'effect', '效果', '效果表'].includes(text)) return 'feedback';
  if (['daily_checkin', 'checkin', 'check-in', '打卡', '打卡表'].includes(text)) return 'daily_checkin';
  if (['reputation', 'reputation_task', '口碑', '口碑表'].includes(text)) return 'reputation_task';
  return normalizeFeishuInboundType(text);
};

const feishuConfiguredTables = (payload = {}) => {
  let rawTables = [];
  if (Array.isArray(payload.tables)) {
    rawTables = payload.tables;
  } else if (payload.tables && typeof payload.tables === 'object') {
    rawTables = Object.entries(payload.tables).map(([eventType, tableId]) => ({ event_type: eventType, table_id: tableId }));
  } else if (payload.table_id) {
    rawTables = [{ table_id: payload.table_id, event_type: payload.event_type || payload.record_type || '' }];
  } else {
    rawTables = [
      { table_id: envValue('FEISHU_TABLE_EFFECT'), event_type: 'feedback' },
      { table_id: envValue('FEISHU_TABLE_CHECKIN'), event_type: 'daily_checkin' },
      { table_id: envValue('FEISHU_TABLE_REPUTATION'), event_type: 'reputation_task' },
    ];
  }
  const seen = new Set();
  return rawTables.map((item) => ({
    table_id: String(item?.table_id || item?.id || '').trim(),
    event_type: normalizeFeishuTableEventType(item?.event_type || item?.type || item?.name || ''),
  })).filter((item) => {
    if (!item.table_id || seen.has(item.table_id)) return false;
    seen.add(item.table_id);
    return true;
  });
};

const fetchBitableTableRecords = async ({ appToken, table, tenantToken, pageSize, maxRecords, deadlineAt }) => {
  const records = [];
  let pageToken = '';
  let hasMore = false;
  let pages = 0;
  do {
    if (Date.now() >= deadlineAt || records.length >= maxRecords) break;
    const url = new URL(`${FEISHU_OPEN_API_BASE}/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(table.table_id)}/records`);
    url.searchParams.set('page_size', String(Math.min(pageSize, maxRecords - records.length)));
    if (pageToken) url.searchParams.set('page_token', pageToken);
    const remainingMs = Math.max(500, Math.min(feishuPullTimeoutMs(), deadlineAt - Date.now()));
    const data = await fetchFeishuJson(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${tenantToken}` },
    }, remainingMs);
    const page = data.data || {};
    records.push(...ensureArray(page.items).slice(0, maxRecords - records.length));
    pageToken = String(page.page_token || '').trim();
    hasMore = Boolean(page.has_more && pageToken);
    pages += 1;
  } while (hasMore);
  return {
    records,
    pages,
    truncated: hasMore || records.length >= maxRecords || Date.now() >= deadlineAt,
  };
};

export const pullFeishuBitableRecords = async (payload = {}, { trigger = 'manual' } = {}) => {
  const startedAt = Date.now();
  const tokenConfig = feishuBitableTokenConfig(payload);
  const tables = feishuConfiguredTables(payload);
  const missingReason = !feishuAppId() || !feishuAppSecret()
    ? 'missing_feishu_app_credentials'
    : ((!tokenConfig.appToken && !tokenConfig.wikiNodeToken)
      ? 'missing_feishu_base_or_wiki_token'
      : (!tables.length ? 'missing_feishu_table_config' : ''));
  if (missingReason) {
    console.warn(JSON.stringify({ event: 'feishu_bitable_pull_skipped', trigger, reason: missingReason }));
    return {
      ok: false,
      skipped: true,
      mode: 'bitable_pull',
      trigger,
      token_source: tokenConfig.source,
      reason: missingReason,
      tables: [],
      summary: { fetched: 0, created: 0, updated: 0, skipped: 0, failed_tables: 0 },
      latency_ms: Date.now() - startedAt,
    };
  }

  let tenantToken = '';
  try {
    tenantToken = await getFeishuTenantAccessToken();
  } catch (error) {
    const reason = feishuSafeError(error, 'feishu_auth_failed');
    console.error(JSON.stringify({ event: 'feishu_bitable_auth_failed', trigger, reason }));
    return {
      ok: false,
      skipped: false,
      mode: 'bitable_pull',
      trigger,
      token_source: tokenConfig.source,
      reason,
      tables: [],
      summary: { fetched: 0, created: 0, updated: 0, skipped: 0, failed_tables: 0 },
      latency_ms: Date.now() - startedAt,
    };
  }

  let appToken = tokenConfig.appToken;
  if (!appToken) {
    try {
      appToken = await resolveFeishuWikiAppToken({
        wikiNodeToken: tokenConfig.wikiNodeToken,
        tenantToken,
      });
    } catch (error) {
      const reason = feishuSafeError(error, 'feishu_wiki_resolve_failed');
      console.error(JSON.stringify({ event: 'feishu_wiki_resolve_failed', trigger, reason }));
      return {
        ok: false,
        skipped: false,
        mode: 'bitable_pull',
        trigger,
        token_source: tokenConfig.source,
        reason,
        tables: [],
        summary: { fetched: 0, created: 0, updated: 0, skipped: 0, failed_tables: 0 },
        latency_ms: Date.now() - startedAt,
      };
    }
  }

  const pageSize = feishuPullPageSize(payload.page_size);
  const maxRecords = feishuPullMaxRecords(payload.max_records);
  const deadlineAt = startedAt + feishuPullDeadlineMs();
  const tableResults = [];
  for (const table of tables) {
    const tableResult = {
      table_id: table.table_id,
      event_type: table.event_type,
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      pages: 0,
      truncated: false,
      errors: [],
    };
    try {
      const fetched = await fetchBitableTableRecords({ appToken, table, tenantToken, pageSize, maxRecords, deadlineAt });
      tableResult.fetched = fetched.records.length;
      tableResult.pages = fetched.pages;
      tableResult.truncated = fetched.truncated;
      for (const record of fetched.records) {
        if (Date.now() >= deadlineAt) {
          tableResult.truncated = true;
          break;
        }
        const recordId = String(record?.record_id || record?.id || '').trim();
        if (!recordId) {
          tableResult.skipped += 1;
          tableResult.errors.push({ record_id: '', status: 400, reason: 'missing_feishu_record_id' });
          continue;
        }
        const fields = normalizeBitableFields(record.fields || {});
        const result = await ingestFeishuRecord({ fields, record_id: recordId }, {
          eventTypeHint: table.event_type,
          feishuRecordId: recordId,
          source: 'feishu_bitable_pull',
        });
        if (result.status === 201) tableResult.created += 1;
        else if (result.status === 200) tableResult.updated += 1;
        else {
          tableResult.skipped += 1;
          tableResult.errors.push({
            record_id: recordId,
            status: result.status,
            reason: String(result.body?.error || 'record_not_ingested').slice(0, 160),
          });
        }
      }
    } catch (error) {
      tableResult.error = feishuSafeError(error, 'feishu_table_pull_failed');
      console.error(JSON.stringify({ event: 'feishu_bitable_table_failed', trigger, event_type: table.event_type, reason: tableResult.error }));
    }
    tableResults.push(tableResult);
  }

  const summary = tableResults.reduce((total, item) => ({
    fetched: total.fetched + item.fetched,
    created: total.created + item.created,
    updated: total.updated + item.updated,
    skipped: total.skipped + item.skipped,
    failed_tables: total.failed_tables + (item.error ? 1 : 0),
  }), { fetched: 0, created: 0, updated: 0, skipped: 0, failed_tables: 0 });
  const result = {
    ok: summary.failed_tables === 0,
    skipped: false,
    mode: 'bitable_pull',
    trigger,
    token_source: tokenConfig.source,
    tables: tableResults,
    summary,
    latency_ms: Date.now() - startedAt,
  };
  console.log(JSON.stringify({ event: 'feishu_bitable_pull', trigger, ...summary, latency_ms: result.latency_ms }));
  return result;
};

const FEISHU_PLAN_FIELDS = [
  { name: '客户ID', type: 'text', value: ({ clientId }) => clientId },
  { name: '项目ID', type: 'text', value: ({ projectId }) => projectId },
  { name: '内容计划ID', type: 'text', value: ({ plan }) => plan.id ?? plan.content_plan_id ?? plan.content_plan_record_id ?? '' },
  { name: '平台', type: 'single_select', value: ({ plan }) => plan.platform || '其他' },
  { name: '选题', type: 'text', value: ({ plan }) => plan.topic || plan.title || '' },
  { name: '角度', type: 'text', value: ({ plan }) => plan.angle || plan.action || '' },
  { name: '形式', type: 'single_select', value: ({ plan }) => plan.content_type || plan.format || '其他' },
  { name: 'CTA', type: 'text', value: ({ plan }) => plan.cta || '' },
  { name: '计划发布日期', type: 'date', value: ({ plan, index }) => plan.planned_date || plan.plan_date || plan.publish_date || shanghaiDateIso(index) },
  { name: '状态', type: 'single_select', value: ({ plan }) => plan.status || '待发布' },
];

export const buildFeishuPlanFields = ({ clientId = '', projectId = '', plan = {}, index = 0 } = {}) => Object.fromEntries(
  FEISHU_PLAN_FIELDS.map((field) => [field.name, toBitableFieldValue(field, field.value({ clientId, projectId, plan, index }))])
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== ''),
);

const feishuPlanIdFromRecord = (record = {}) => String(
  normalizeBitableFields(record.fields || {})['内容计划ID']
  || normalizeBitableFields(record.fields || {})['计划ID']
  || '',
).trim();

const feishuBatchChunks = (rows = [], size = 100) => {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
};

const writeFeishuPlanRows = async ({ appToken, tableId, tenantToken, action, rows }) => {
  const records = [];
  const path = action === 'update' ? 'batch_update' : 'batch_create';
  for (const chunk of feishuBatchChunks(rows)) {
    const url = `${FEISHU_OPEN_API_BASE}/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${path}`;
    const data = await fetchFeishuJson(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${tenantToken}` },
      body: JSON.stringify({ records: chunk.map((row) => action === 'update'
        ? { record_id: row.record_id, fields: row.fields }
        : { fields: row.fields }) }),
    });
    const responseRows = ensureArray(data.data?.records || data.data?.items);
    chunk.forEach((row, index) => {
      records.push({
        plan_id: row.plan_id,
        record_id: String(responseRows[index]?.record_id || responseRows[index]?.id || row.record_id || '').trim(),
      });
    });
  }
  return records;
};

const feishuProjectContext = async (clientId = '', projectId = '') => {
  const cloud = await readCloudState(clientId, { internal: true });
  const projectStore = normalizeCloudProjectStore(cloud.project_store || {});
  const project = ensureArray(projectStore.projects).find((item) => String(item.id || '') === String(projectId || ''));
  return { cloud, projectStore, project };
};

const persistFeishuPlanSync = async ({ clientId, projectStore, project, sync }) => {
  const pushedAt = sync.last_push_at || nowIso();
  const updatedProject = {
    ...project,
    updated_at: pushedAt,
    state: {
      ...(project.state || {}),
      saved_at: pushedAt,
      feishu_sync: { ...(project.state?.feishu_sync || {}), ...sync },
    },
  };
  await writeCloudState({
    client_id: clientId,
    project_store: {
      ...projectStore,
      activeProjectId: projectStore.activeProjectId || project.id,
      projects: ensureArray(projectStore.projects).map((item) => String(item.id || '') === String(project.id || '') ? updatedProject : item),
    },
  }, clientId);
};

const feishuWorkspaceLink = () => {
  const url = normalizeExternalUrl(feishuWorkspaceUrl());
  return /^https?:\/\//i.test(url) ? url : '';
};

export const feishuCollaborationStatus = async ({ clientId = '', projectId = '' } = {}) => {
  const normalizedClientId = normalizeClientId(clientId);
  if (!normalizedClientId || !String(projectId || '').trim()) {
    return { status: 400, body: { ok: false, error: '飞书协同状态需要 client_id 和 project_id' } };
  }
  const { project } = await feishuProjectContext(normalizedClientId, projectId);
  if (!project) return { status: 404, body: { ok: false, error: '指定客户下未找到对应项目' } };
  const sync = project.state?.feishu_sync || {};
  return {
    status: 200,
    body: {
      ok: true,
      client_id: normalizedClientId,
      project_id: project.id,
      plan_count: ensureArray(project.state?.plans).length,
      configured: Boolean(feishuAppId() && feishuAppSecret() && (feishuBaseToken() || feishuWikiNodeToken()) && feishuPlanTableId()),
      workspace_url: feishuWorkspaceLink(),
      last_push_at: sync.last_push_at || '',
      last_pull_at: sync.last_inbound_at || '',
      last_push_summary: sync.last_push_summary || null,
      plan_record_count: Object.keys(sync.plan_record_map || {}).length,
    },
  };
};

export const pushFeishuContentPlans = async (payload = {}, { trigger = 'manual' } = {}) => {
  const startedAt = Date.now();
  const clientId = normalizeClientId(payload.client_id || '');
  const projectId = String(payload.project_id || '').trim();
  if (!clientId || !projectId) {
    return { status: 400, body: { ok: false, error: '推送内容计划需要有效的 client_id 和 project_id' } };
  }
  const { projectStore, project } = await feishuProjectContext(clientId, projectId);
  if (!project) {
    return { status: 404, body: { ok: false, error: '指定客户下未找到对应项目，未向飞书写入任何数据' } };
  }
  const plans = ensureArray(project.state?.plans);
  if (!plans.length) {
    return {
      status: 200,
      body: { ok: false, skipped: true, mode: 'bitable_push', trigger, reason: 'no_content_plans', summary: { created: 0, updated: 0, skipped: 0, failed: 0 } },
    };
  }

  const tokenConfig = feishuBitableTokenConfig(payload);
  const tableId = String(payload.table_id || feishuPlanTableId()).trim();
  const missingReason = !feishuAppId() || !feishuAppSecret()
    ? 'missing_feishu_app_credentials'
    : ((!tokenConfig.appToken && !tokenConfig.wikiNodeToken)
      ? 'missing_feishu_base_or_wiki_token'
      : (!tableId ? 'missing_feishu_plan_table' : ''));
  if (missingReason) {
    console.warn(JSON.stringify({ event: 'feishu_bitable_push_skipped', trigger, client_id: clientId, project_id: projectId, reason: missingReason }));
    return {
      status: 200,
      body: { ok: false, skipped: true, mode: 'bitable_push', trigger, reason: missingReason, summary: { created: 0, updated: 0, skipped: 0, failed: 0 }, latency_ms: Date.now() - startedAt },
    };
  }

  let tenantToken = '';
  let appToken = tokenConfig.appToken;
  try {
    tenantToken = await getFeishuTenantAccessToken();
    if (!appToken) appToken = await resolveFeishuWikiAppToken({ wikiNodeToken: tokenConfig.wikiNodeToken, tenantToken });
  } catch (error) {
    const reason = feishuSafeError(error, 'feishu_auth_failed');
    return { status: 502, body: { ok: false, error: '飞书授权失败，请检查应用凭据和权限。', skipped: false, mode: 'bitable_push', trigger, reason, summary: { created: 0, updated: 0, skipped: 0, failed: plans.length }, latency_ms: Date.now() - startedAt } };
  }

  const validRows = [];
  let skipped = 0;
  plans.forEach((plan, index) => {
    const planId = String(plan?.id ?? plan?.content_plan_id ?? plan?.content_plan_record_id ?? '').trim();
    const topic = String(plan?.topic || plan?.title || '').trim();
    if (!planId || !topic) {
      skipped += 1;
      return;
    }
    validRows.push({ plan_id: planId, fields: buildFeishuPlanFields({ clientId, projectId, plan, index }) });
  });

  let existingRecords = [];
  try {
    const fetched = await fetchBitableTableRecords({
      appToken,
      table: { table_id: tableId },
      tenantToken,
      pageSize: feishuPullPageSize(payload.page_size),
      maxRecords: feishuPullMaxRecords(payload.max_records),
      deadlineAt: startedAt + feishuPullDeadlineMs(),
    });
    existingRecords = fetched.records;
  } catch (error) {
    const reason = feishuSafeError(error, 'feishu_plan_list_failed');
    return { status: 502, body: { ok: false, error: '读取飞书内容计划表失败，请检查表格权限和 table_id。', skipped: false, mode: 'bitable_push', trigger, reason, summary: { created: 0, updated: 0, skipped, failed: validRows.length }, latency_ms: Date.now() - startedAt } };
  }

  const existingByPlanId = new Map();
  const duplicatePlanIds = new Set();
  existingRecords.forEach((record) => {
    const planId = feishuPlanIdFromRecord(record);
    const recordId = String(record?.record_id || record?.id || '').trim();
    if (!planId || !recordId) return;
    if (existingByPlanId.has(planId)) duplicatePlanIds.add(planId);
    else existingByPlanId.set(planId, recordId);
  });
  const createRows = validRows.filter((row) => !existingByPlanId.has(row.plan_id));
  const updateRows = validRows.filter((row) => existingByPlanId.has(row.plan_id)).map((row) => ({ ...row, record_id: existingByPlanId.get(row.plan_id) }));
  const recordMap = { ...(project.state?.feishu_sync?.plan_record_map || {}) };
  const errors = [];
  let created = 0;
  let updated = 0;

  if (createRows.length) {
    try {
      const rows = await writeFeishuPlanRows({ appToken, tableId, tenantToken, action: 'create', rows: createRows });
      created = createRows.length;
      rows.forEach((row) => { if (row.record_id) recordMap[row.plan_id] = row.record_id; });
    } catch (error) {
      errors.push({ action: 'create', count: createRows.length, reason: feishuSafeError(error, 'feishu_plan_create_failed') });
    }
  }
  if (updateRows.length) {
    try {
      const rows = await writeFeishuPlanRows({ appToken, tableId, tenantToken, action: 'update', rows: updateRows });
      updated = updateRows.length;
      rows.forEach((row) => { if (row.record_id) recordMap[row.plan_id] = row.record_id; });
    } catch (error) {
      errors.push({ action: 'update', count: updateRows.length, reason: feishuSafeError(error, 'feishu_plan_update_failed') });
    }
  }

  const failed = errors.reduce((sum, item) => sum + item.count, 0);
  const summary = { created, updated, skipped, failed };
  const pushedAt = nowIso();
  if (created || updated) {
    await persistFeishuPlanSync({
      clientId,
      projectStore,
      project,
      sync: {
        last_push_at: pushedAt,
        last_plan_table_id: tableId,
        last_push_summary: summary,
        plan_record_map: recordMap,
      },
    });
  }
  const ok = failed === 0;
  const result = {
    ok,
    ...(ok ? {} : { error: '部分内容计划写入失败，请检查飞书写权限和字段类型。' }),
    skipped: false,
    mode: 'bitable_push',
    trigger,
    client_id: clientId,
    project_id: projectId,
    token_source: tokenConfig.source,
    workspace_url: feishuWorkspaceLink(),
    summary,
    duplicate_plan_ids: [...duplicatePlanIds],
    errors,
    sync: {
      last_push_at: created || updated ? pushedAt : (project.state?.feishu_sync?.last_push_at || ''),
      last_inbound_at: project.state?.feishu_sync?.last_inbound_at || '',
      last_push_summary: summary,
      plan_record_map: recordMap,
    },
    latency_ms: Date.now() - startedAt,
  };
  console.log(JSON.stringify({ event: 'feishu_bitable_push', trigger, client_id: clientId, project_id: projectId, ...summary, latency_ms: result.latency_ms }));
  return { status: ok ? 200 : 502, body: result };
};

const buildFeishuPayload = (item = {}) => ({
  synced: false,
  mode: 'manual_payload',
  payload: {
    A_customer_profile: {
      client_id: item.client_id || '',
      client_name: item.client_name || '',
      project_id: item.project_id || '',
    },
    B_content_plan: {
      content_plan_record_id: item.content_plan_record_id || '',
      platform: item.platform || '',
      content_type: item.content_type || '',
    },
    C_outsourced_production: {
      input_asset_ids: ensureArray(item.input_asset_ids),
      output_spec: item.output_spec || {},
      provider_job_id: item.provider_job_id || '',
    },
    D_internal_qa: {
      status: item.status || '',
      qa: item.qa || {},
      provider: item.provider || '',
      fallback: Boolean(item.fallback),
      error: item.error || '',
    },
    E_client_delivery: clientVisibleTask(item),
    F_data_return: {
      delivered_at: item.status === 'delivered' ? item.updated_at : '',
      output_asset_ids: ensureArray(item.output_asset_ids),
    },
  },
});

const sendFeishuWebhook = async (item = {}) => {
  const envelope = buildFeishuPayload(item);
  const webhookUrl = feishuWebhookUrl();
  if (!webhookUrl) return { ...envelope, fallback_reason: 'missing_feishu_webhook_url' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const summary = [
      `客户：${item.client_name || item.client_id || '未标注'}`,
      `项目：${item.project_id || '未标注'}`,
      `内容计划：${item.content_plan_record_id || '未标注'}`,
      `平台/类型：${item.platform || '未标注'} / ${item.content_type || item.generation_type || '未标注'}`,
      `任务状态：${item.status || '未标注'}`,
    ].join('\n');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ msg_type: 'text', content: { text: `获客罗盘｜内容任务同步\n${summary}` } }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    const code = Number(result.code ?? result.StatusCode ?? 0);
    const ok = response.ok && code === 0;
    console.log(JSON.stringify({ event: 'feishu_webhook', synced: ok, status: response.status, code }));
    return {
      ...envelope,
      synced: ok,
      mode: 'webhook',
      fallback_reason: ok ? null : `feishu_webhook_error_${response.status || code || 'unknown'}`,
      webhook_result: {
        status: response.status,
        code,
        message: String(result.msg || result.StatusMessage || '').slice(0, 160),
      },
    };
  } catch (error) {
    return {
      ...envelope,
      synced: false,
      mode: 'webhook',
      fallback_reason: error?.name === 'AbortError' ? 'feishu_webhook_timeout' : 'feishu_webhook_request_failed',
    };
  } finally {
    clearTimeout(timer);
  }
};

const modelPayloadForRequest = (payload = {}, internalAuthorized = false) => {
  if (internalAuthorized) return markInternalAuthorized(payload, true);
  const customerPayload = { ...payload };
  delete customerPayload.model_provider;
  delete customerPayload.model_mode;
  delete customerPayload._mode;
  if (['internal_test', 'internal_regenerate', 'internal_version'].includes(customerPayload.client_mode)) {
    delete customerPayload.client_mode;
  }
  if (['internal_test', 'internal_regenerate', 'internal_version'].includes(customerPayload.source)) {
    customerPayload.source = 'api_assessment';
  }
  return customerPayload;
};

const generateAssessmentResult = async ({ payload = {}, clientId = '', internalAuthorized = false, forceRules = false, fallbackReason = 'async_fallback', generationVariant = '' } = {}) => {
  const trustedPayload = modelPayloadForRequest(payload, internalAuthorized);
  const assessment_id = createAssessment(trustedPayload, clientId);
  const assessment = state.assessments.find((item) => item.id === assessment_id);
  Object.defineProperty(assessment, 'plan_generation_variant', {
    value: PLAN_VARIATION_DIRECTIONS.includes(generationVariant)
      ? generationVariant
      : planGenerationVariant(generationVariant || `${clientId}:${assessment_id}:${nowIso()}`),
    enumerable: false,
  });
  if (internalAuthorized) {
    markInternalAuthorized(assessment, true);
    if (payload.model_provider || payload.model_mode) {
      Object.defineProperty(assessment, 'model_provider', { value: payload.model_provider || payload.model_mode, enumerable: false });
    }
  }
  const diagnosis = generateDiagnosis(assessment_id);
  const generated = forceRules
    ? { rows: null, meta: modelFailureMeta({ requestedModel: arkPlanModel() || null, fallbackReason }) }
    : await generateOpusPlanRows(assessment, diagnosis);
  const plans = createContentPlan(diagnosis.id, generated.rows, generated.meta);
  const generation_meta = normalizeModelMeta(generated.meta);
  return { assessment_id, assessment, diagnosis, plans, model_info: generation_meta, generation_meta };
};

const planJobClientIdFrom = (payload = {}, url = null, request = null) => normalizeClientId(
  payload.client_id
  || payload.customer_key
  || url?.searchParams?.get('client_id')
  || url?.searchParams?.get('customer')
  || request?.headers?.get('x-client-id')
  || ''
);

const createPlanJob = async (payload = {}, reservation = {}) => {
  const client_id = planJobClientIdFrom(payload);
  if (!client_id) throw new Error('创建计划任务需要有效 client_id');
  const createdAt = nowIso();
  const existing = await readCloudCollection('plan-jobs', client_id);
  const requestId = generationRequestId(payload);
  const existingJob = ensureArray(existing.jobs).find((item) => String(item.request_id || '') === requestId);
  if (existingJob) return existingJob;
  const generationVariant = PLAN_VARIATION_DIRECTIONS[ensureArray(existing.jobs).length % PLAN_VARIATION_DIRECTIONS.length];
  const assessmentPayload = { ...modelPayloadForRequest(payload, false), client_id };
  delete assessmentPayload.request_id;
  delete assessmentPayload.idempotency_key;
  const job = {
    job_id: `planjob_${sha256Hex(`${client_id}:${requestId}`).slice(0, 24)}`,
    request_id: requestId,
    client_id,
    status: 'pending',
    assessment_payload: sanitizeCustomerPayload(assessmentPayload),
    generation_variant: generationVariant,
    rate_limit_shadow: Boolean(reservation.would_rate_limit && !reservation.rate_limit_enforced),
    metering_reservation: {
      reservation_key: reservation.reservation_key || '',
      request_id: reservation.request_id || requestId,
      client_hash: reservation.client_hash || '',
      route: reservation.route || 'plan-jobs',
      would_rate_limit: Boolean(reservation.would_rate_limit),
      rate_scope: reservation.rate_scope || '',
    },
    attempts: 0,
    result: null,
    error: '',
    created_at: createdAt,
    updated_at: createdAt,
    started_at: '',
    completed_at: '',
  };
  await upsertCollectionItem('plan-jobs', client_id, job, 'job_id', existing);
  return job;
};

const getPlanJob = async (clientId = '', jobId = '') => {
  if (!clientId || !jobId) return null;
  const current = await readCloudCollection('plan-jobs', clientId);
  return ensureArray(current.jobs).find((job) => String(job.job_id) === String(jobId)) || null;
};

const savePlanJob = async (job = {}) => {
  if (!job.client_id || !job.job_id) throw new Error('计划任务缺少归属信息');
  await upsertCollectionItem('plan-jobs', job.client_id, job, 'job_id');
  return job;
};

const isPlanJobStale = (job = {}) => {
  const started = Date.parse(job.started_at || '');
  return !started || Date.now() - started > 25000;
};

const processPlanJob = async (clientId = '', jobId = '') => {
  let job = await getPlanJob(clientId, jobId);
  if (!job || ['completed', 'failed'].includes(job.status)) return job;
  if (job.status === 'generating' && !isPlanJobStale(job)) return job;
  job = {
    ...job,
    status: 'generating',
    attempts: Number(job.attempts || 0) + 1,
    started_at: nowIso(),
    updated_at: nowIso(),
    error: '',
  };
  await savePlanJob(job);
  try {
    const result = await generateAssessmentResult({ payload: job.assessment_payload, clientId: job.client_id, generationVariant: job.generation_variant || job.job_id });
    const latest = await getPlanJob(clientId, jobId);
    if (latest?.status === 'completed') return latest;
    const completed = await savePlanJob({
      ...job,
      status: 'completed',
      result,
      completed_at: nowIso(),
      updated_at: nowIso(),
    });
    await completeGenerationMetering({
      reservation: { ...(job.metering_reservation || {}), attempt: job.attempts },
      clientId: job.client_id,
      jobId: job.job_id,
      result,
      outcome: 'completed',
    });
    return completed;
  } catch (error) {
    const failed = await savePlanJob({
      ...job,
      status: 'failed',
      error: error?.message || 'plan_job_failed',
      completed_at: nowIso(),
      updated_at: nowIso(),
    });
    await completeGenerationMetering({
      reservation: { ...(job.metering_reservation || {}), attempt: job.attempts },
      clientId: job.client_id,
      jobId: job.job_id,
      outcome: 'failed',
      error: error?.message || 'plan_job_failed',
    });
    return failed;
  }
};

const forcePlanJobFallback = async (clientId = '', jobId = '') => {
  const job = await getPlanJob(clientId, jobId);
  if (!job || job.status === 'completed') return job;
  try {
    const result = await generateAssessmentResult({
      payload: job.assessment_payload,
      clientId: job.client_id,
      forceRules: true,
      fallbackReason: 'client_poll_timeout',
      generationVariant: job.generation_variant || job.job_id,
    });
    const completed = await savePlanJob({
      ...job,
      status: 'completed',
      result,
      completed_at: nowIso(),
      updated_at: nowIso(),
      forced_fallback: true,
      error: '',
    });
    await completeGenerationMetering({
      reservation: { ...(job.metering_reservation || {}), attempt: Number(job.attempts || 0) + 1 },
      clientId: job.client_id,
      jobId: job.job_id,
      result,
      outcome: 'completed',
    });
    return completed;
  } catch (error) {
    const failed = await savePlanJob({ ...job, status: 'failed', error: error?.message || 'plan_job_fallback_failed', updated_at: nowIso() });
    await completeGenerationMetering({
      reservation: { ...(job.metering_reservation || {}), attempt: Number(job.attempts || 0) + 1 },
      clientId: job.client_id,
      jobId: job.job_id,
      outcome: 'failed',
      error: error?.message || 'plan_job_fallback_failed',
    });
    return failed;
  }
};

const clientVisiblePlanJob = (job = {}) => ({
  job_id: job.job_id || '',
  status: job.status || 'pending',
  poll_after_ms: job.status === 'pending' ? 700 : 1200,
  created_at: job.created_at || '',
  updated_at: job.updated_at || '',
  ...(job.status === 'completed' ? { result: job.result } : {}),
  ...(job.status === 'failed' ? { error: '刚刚生成失败了，请稍后再试一次。' } : {}),
});

const queuePlanJob = (context, clientId, jobId) => {
  const promise = processPlanJob(clientId, jobId).catch((error) => {
    console.error(JSON.stringify({ event: 'plan_job_failed', job_id: jobId, reason: error?.message || 'unknown' }));
  });
  if (typeof context?.waitUntil === 'function') context.waitUntil(promise);
  return promise;
};

export default async (request, context = {}) => {
  ensureState();
  const url = new URL(request.url);
  const route = (
    url.searchParams.get('path') ||
    url.pathname.replace(/^\/api\/?/, '').replace(/^\/\.netlify\/functions\/api\/?/, '')
  );
  const path = `/${route.replace(/^\/+/, '')}`;
  const internalAuthorized = hasValidInternalAuth(request);
  try {
    const requestClientId = clientIdFrom({}, url, request);
    if (request.method === 'GET') {
      if (path === '/health') return json({
        ok: true,
        runtime: 'netlify-function',
        version: APP_VERSION,
        version_label: VERSION_LABEL,
        module: 'generation-workbench',
        module_version: GENERATION_WORKBENCH_VERSION,
        features: ['assets', 'generation_tasks', 'qa', 'client_delivery', 'feishu_inbound_v1', 'feishu_bitable_pull_v1', 'feishu_bitable_push_v1', 'feishu_webhook', 'async_video_polling', 'customer_plan_jobs', 'shadow_rate_limit', 'funnel_tracking'],
      });
      if (path === '/customers') {
        if (!internalAuthorized) return unauthorized();
        return json(await listCustomersFromCloudState(), 200, { internal: true });
      }
      if (path === '/customers/merge-preview') {
        if (!internalAuthorized) return unauthorized();
        return json(await previewCustomerMerge({
          clientIds: url.searchParams.get('client_ids') || '',
          displayName: url.searchParams.get('display_name') || url.searchParams.get('customer_name') || '',
          canonicalClientId: url.searchParams.get('canonical_client_id') || '',
        }), 200, { internal: true });
      }
      if (path === '/analytics/funnel') {
        if (!internalAuthorized) return unauthorized();
        return json(await funnelSummary({
          from: String(url.searchParams.get('from') || '').slice(0, 10),
          to: String(url.searchParams.get('to') || '').slice(0, 10),
        }), 200, { internal: true });
      }
      if (path === '/feishu/status') {
        if (!internalAuthorized) return unauthorized();
        const result = await feishuCollaborationStatus({
          clientId: url.searchParams.get('client_id') || '',
          projectId: url.searchParams.get('project_id') || '',
        });
        return json(result.body, result.status, { internal: true });
      }
      if (path === '/state') {
        if (requestClientId === INTERNAL_CLIENT_ID && !internalAuthorized) return unauthorized();
        return json(await readCloudState(requestClientId, { internal: internalAuthorized }), 200, { internal: internalAuthorized });
      }
      if (path === '/assets') {
        if (!internalAuthorized) return unauthorized();
        return json({ assets: await listAssets({ clientId: requestClientId, projectId: url.searchParams.get('project_id') || '' }) }, 200, { internal: true });
      }
      if (path === '/generation-tasks') {
        if (!internalAuthorized) return unauthorized();
        return json({ tasks: await listTasks({ clientId: requestClientId, projectId: url.searchParams.get('project_id') || '', view: url.searchParams.get('view') || 'internal' }) }, 200, { internal: true });
      }
      const taskDetailMatch = path.match(/^\/generation-tasks\/([^/]+)$/);
      if (taskDetailMatch) {
        if (!internalAuthorized) return unauthorized();
        const task = await getTask(requestClientId, decodeURIComponent(taskDetailMatch[1]));
        return task ? json({ task }, 200, { internal: true }) : json({ error: '生成任务不存在' }, 404, { internal: true });
      }
      const planJobDetailMatch = path.match(/^\/plan-jobs\/([^/]+)$/);
      if (planJobDetailMatch) {
        const clientId = planJobClientIdFrom({}, url, request);
        if (!clientId) return json({ error: '读取计划任务需要 client_id' }, 400);
        const jobId = decodeURIComponent(planJobDetailMatch[1]);
        let job = await getPlanJob(clientId, jobId);
        if (!job) return json({ error: '计划任务不存在' }, 404);
        if (url.searchParams.get('fallback') === '1' && !['completed', 'failed'].includes(job.status)) {
          job = await forcePlanJobFallback(clientId, jobId);
        } else if (job.status === 'pending' || (job.status === 'generating' && isPlanJobStale(job))) {
          queuePlanJob(context, clientId, jobId);
        }
        return json(clientVisiblePlanJob(job));
      }
      if (path === '/dashboard') {
        if (!internalAuthorized) return unauthorized();
        return json(dashboard(), 200, { internal: true });
      }
      if (path === '/assessments') {
        if (!internalAuthorized) return unauthorized();
        return json(state.assessments.filter((item) => !item.client_id || item.client_id === requestClientId), 200, { internal: true });
      }
      if (path === '/diagnoses') {
        if (!internalAuthorized) return unauthorized();
        return json(state.diagnoses.filter((item) => !item.client_id || item.client_id === requestClientId), 200, { internal: true });
      }
      if (path === '/plans') {
        if (!internalAuthorized) return unauthorized();
        return json(state.plans.filter((item) => !item.client_id || item.client_id === requestClientId), 200, { internal: true });
      }
      if (path === '/feedback') return json(state.feedback.filter((item) => !item.client_id || item.client_id === requestClientId));
      if (path === '/reviews') {
        if (!internalAuthorized) return unauthorized();
        return json(state.reviews, 200, { internal: true });
      }
    }

    const payload = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const payloadClientId = clientIdFrom(payload, url, request);
    const taskActionMatch = path.match(/^\/generation-tasks\/([^/]+)\/(submit|poll|qa|deliver)$/);
    if (request.method === 'POST' && path === '/feishu/inbound') {
      if (!hasValidFeishuInboundAuth(request)) return json({ ok: false, error: '飞书回流鉴权失败' }, 401, { internal: true });
      const result = await receiveFeishuInbound(payload, request);
      return json(result.body, result.status, { internal: true });
    }
    if (request.method === 'POST' && path === '/feishu/pull') {
      if (!internalAuthorized) return unauthorized();
      const result = await pullFeishuBitableRecords(payload, { trigger: 'manual' });
      return json(result, result.ok || result.skipped ? 200 : 502, { internal: true });
    }
    if (request.method === 'POST' && path === '/feishu/push') {
      if (!internalAuthorized) return unauthorized();
      const result = await pushFeishuContentPlans(payload, { trigger: 'manual' });
      return json(result.body, result.status, { internal: true });
    }
    if (request.method === 'POST' && path === '/plan-jobs') {
      const clientId = planJobClientIdFrom(payload, url, request);
      if (!clientId) return json({ error: '创建计划任务需要 client_id' }, 400);
      if (clientId === INTERNAL_CLIENT_ID && !internalAuthorized) return unauthorized();
      const requestId = generationRequestId(payload);
      const reservation = await reserveGenerationRequest({ request, clientId, requestId, route: 'plan-jobs' });
      if (reservation.would_rate_limit && reservation.rate_limit_enforced) {
        await completeGenerationMetering({ reservation, clientId, outcome: 'rate_limited', error: 'rate_limited' });
        return rateLimitedResponse(reservation);
      }
      const job = await createPlanJob({ ...payload, client_id: clientId, request_id: requestId }, reservation);
      await linkGenerationReservation(reservation, job.job_id);
      if (!reservation.duplicate) queuePlanJob(context, clientId, job.job_id);
      return json(clientVisiblePlanJob(job), 202);
    }
    if (request.method === 'POST' && path === '/assessments') {
      if (!internalAuthorized) return unauthorized();
      return json(await generateAssessmentResult({ payload, clientId: payloadClientId, internalAuthorized }), 201, { internal: internalAuthorized });
    }
    if (request.method === 'POST' && path === '/track') {
      if (payloadClientId === INTERNAL_CLIENT_ID && !internalAuthorized) return unauthorized();
      const result = await writeFunnelEvent({
        event: String(payload.event || ''),
        clientId: payloadClientId,
        eventId: payload.event_id || payload.request_id || '',
        properties: payload.properties || {},
      });
      return json({ ok: true, ...result }, 202);
    }
    if (request.method === 'POST' && path === '/state') {
      if (payloadClientId === INTERNAL_CLIENT_ID && !internalAuthorized) return unauthorized();
      return json(await writeCloudState(payload, payloadClientId), 201, { internal: internalAuthorized });
    }
    if (request.method === 'POST' && path === '/assets') {
      if (!internalAuthorized) return unauthorized();
      return json({ asset: await createAsset(payload) }, 201, { internal: true });
    }
    if (request.method === 'POST' && path === '/generation-tasks') {
      if (!internalAuthorized) return unauthorized();
      return json({ task: await createGenerationTask(payload) }, 201, { internal: true });
    }
    if (request.method === 'POST' && taskActionMatch) {
      if (!internalAuthorized) return unauthorized();
      const [, rawTaskId, action] = taskActionMatch;
      const taskId = decodeURIComponent(rawTaskId);
      const clientId = payloadClientId;
      if (action === 'submit') return json({ task: await submitGenerationTask(clientId, taskId) }, 200, { internal: true });
      if (action === 'poll') return json({ task: await pollGenerationTask(clientId, taskId) }, 200, { internal: true });
      if (action === 'qa') return json({ task: await qaGenerationTask(clientId, taskId, payload) }, 200, { internal: true });
      if (action === 'deliver') return json({ task: await deliverGenerationTask(clientId, taskId) }, 200, { internal: true });
    }
    if (request.method === 'POST' && path === '/feishu/sync') {
      if (!internalAuthorized) return unauthorized();
      const task = payload.task_id ? await getTask(payloadClientId, payload.task_id) : payload.task;
      if (!task) throw new Error('飞书同步缺少 task 或 task_id');
      return json(await sendFeishuWebhook(task), 200, { internal: true });
    }
    if (request.method === 'POST' && path === '/customer-growth-advice') {
      const clientId = planJobClientIdFrom(payload, url, request);
      if (!clientId) return json({ error: '生成下一轮建议需要 client_id' }, 400);
      if (clientId === INTERNAL_CLIENT_ID && !internalAuthorized) return unauthorized();
      const requestId = generationRequestId(payload);
      const reservation = await reserveGenerationRequest({ request, clientId, requestId, route: 'customer-growth-advice' });
      if (reservation.would_rate_limit && reservation.rate_limit_enforced) {
        await completeGenerationMetering({ reservation, clientId, outcome: 'rate_limited', error: 'rate_limited' });
        return rateLimitedResponse(reservation);
      }
      try {
        const trustedPayload = modelPayloadForRequest(payload, internalAuthorized);
        const result = await createCustomerGrowthAdvice(trustedPayload);
        await completeGenerationMetering({ reservation, clientId, jobId: requestId, result, outcome: 'completed' });
        return json(result, 200, { internal: internalAuthorized });
      } catch (error) {
        await completeGenerationMetering({ reservation, clientId, jobId: requestId, outcome: 'failed', error: error?.message || 'customer_growth_advice_failed' });
        throw error;
      }
    }
    if (request.method === 'POST' && path === '/feedback') {
      const plan_id = Number(payload.content_plan_id);
      const feedback = recordFeedback(plan_id, payload, payloadClientId);
      return json({ feedback, dashboard: dashboard() }, 201);
    }
    if (request.method === 'POST' && path === '/reviews') {
      if (!internalAuthorized) return unauthorized();
      const review = createWeeklyReview();
      return json({ review, dashboard: dashboard() }, 201, { internal: true });
    }
    return json({ error: 'Not found' }, 404);
  } catch (error) {
    return json({ error: error.message || '请求失败' }, 400, { internal: internalAuthorized });
  }
};
