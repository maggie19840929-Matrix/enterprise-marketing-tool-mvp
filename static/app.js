const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const APP_VERSION = '1.6.141';
const VERSION_LABEL = 'v1.6.141 · Pro 标准套餐直购版';
window.APP_VERSION = APP_VERSION;
window.VERSION_LABEL = VERSION_LABEL;
const STORAGE_KEY = 'enterpriseMarketingMvpState.v5';
const STORAGE_PREFIX = 'enterpriseMarketingMvpState.';
const PROJECTS_KEY = 'enterpriseMarketingMvpProjects.v1';
const DEMO_DISABLED_KEY = 'enterpriseMarketingMvpDemoDisabled.v1';
const CUSTOMER_STORAGE_KEY = 'enterpriseMarketingCustomerTrial.v1';
const CUSTOMER_SESSION_KEY = 'enterpriseMarketingCustomerSessionId.v1';
const ACCOUNT_RESTORE_PROJECT_KEY = 'enterpriseMarketingAccountRestoreProject.v1';
const REFERRAL_CODE_STORAGE_KEY = 'fpReferralCode.v1';
const CUSTOMER_ACCESS_TOKEN_STORAGE_PREFIX = 'enterpriseMarketingCustomerAccessToken.v1';
const USER_SETTINGS_STORAGE_PREFIX = 'enterpriseMarketingUserSettings.v1';
const CUSTOMER_ANALYTICS_SESSION_KEY = 'enterpriseMarketingAnalyticsSession.v1';
const INTERNAL_ACCESS_TOKEN_STORAGE_KEY = 'internalAccessToken';
const INTERNAL_CLIENT_ID = 'internal';
const CLIENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const normalizeClientId = (value = '') => {
  const raw = String(value || '').trim().toLowerCase();
  if (['basketball-training', 'youth-basketball'].includes(raw)) return 'basketball';
  const normalized = raw.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return CLIENT_ID_RE.test(normalized) ? normalized : '';
};
const newAnonymousClientId = () => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `anonymous-${cryptoApi.randomUUID()}`;
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return `anonymous-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  throw new Error('secure_random_unavailable');
};
const newCustomerAccessToken = () => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `cat_${cryptoApi.randomUUID()}_${cryptoApi.randomUUID()}`;
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(32));
    return `cat_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  throw new Error('secure_random_unavailable');
};
const customerAccessTokenStorageKey = (clientId = '') =>
  `${CUSTOMER_ACCESS_TOKEN_STORAGE_PREFIX}.${normalizeClientId(clientId) || 'anonymous-fallback'}`;
const readCustomerAccessToken = (clientId = '') => {
  const safeClientId = normalizeClientId(clientId);
  if (!safeClientId || safeClientId === INTERNAL_CLIENT_ID) return '';
  try { return String(window.localStorage?.getItem(customerAccessTokenStorageKey(safeClientId)) || '').trim(); }
  catch { return ''; }
};
const ensureCustomerAccessToken = (clientId = '') => {
  const safeClientId = normalizeClientId(clientId);
  if (!safeClientId || safeClientId === INTERNAL_CLIENT_ID) return '';
  const existing = readCustomerAccessToken(safeClientId);
  if (existing) return existing;
  try {
    const next = newCustomerAccessToken();
    window.localStorage?.setItem(customerAccessTokenStorageKey(safeClientId), next);
    return next;
  } catch {
    return '';
  }
};
const customerShareTokenFromUrl = () => {
  try { return String(new URLSearchParams(window.location.search || '').get('share') || '').trim(); }
  catch { return ''; }
};
let sharedCustomerClientId = '';
const setSharedCustomerClientId = (clientId = '') => {
  sharedCustomerClientId = normalizeClientId(clientId);
  return sharedCustomerClientId;
};
const customerProjectAccessProofInput = (store = {}) => {
  const projects = Array.isArray(store?.projects) ? store.projects : [];
  const activeProjectId = String(store?.activeProjectId || '').trim();
  const project = projects.find((item) => String(item?.id || '') === activeProjectId) || projects[0] || {};
  const state = project?.state || {};
  const assessment = state?.assessment || {};
  return JSON.stringify({
    id: String(project?.id || ''),
    name: String(project?.name || ''),
    industry: String(assessment?.industry || ''),
    main_goal: String(assessment?.main_goal || ''),
    target_customer: String(assessment?.target_customer || ''),
    plan_topics: (Array.isArray(state?.plans) ? state.plans : []).slice(0, 7).map((plan) => [
      String(plan?.id || plan?.content_plan_id || ''),
      String(plan?.topic || plan?.title || ''),
    ]),
  });
};
const customerProjectAccessProof = async (store = {}) => {
  try {
    const bytes = new TextEncoder().encode(customerProjectAccessProofInput(store));
    const digest = await globalThis.crypto?.subtle?.digest('SHA-256', bytes);
    return digest ? Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('') : '';
  } catch {
    return '';
  }
};
const readInternalAccessToken = () => {
  try { return String(window.localStorage?.getItem(INTERNAL_ACCESS_TOKEN_STORAGE_KEY) || '').trim(); }
  catch { return ''; }
};
const readInternalAccessTokenFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const token = (
      params.get('internal_token')
      || params.get('internalToken')
      || params.get('token')
      || params.get('access_token')
    );
    return String(token || '').trim();
  } catch {
    return '';
  }
};
const saveInternalAccessToken = (token = '') => {
  try {
    if (token) window.localStorage?.setItem(INTERNAL_ACCESS_TOKEN_STORAGE_KEY, String(token).trim());
    else window.localStorage?.removeItem(INTERNAL_ACCESS_TOKEN_STORAGE_KEY);
  } catch {}
};
const readSessionClientId = () => {
  try {
    const ls = window.localStorage;
    let stored = ls?.getItem(CUSTOMER_SESSION_KEY);
    if (!stored) {
      const legacy = window.sessionStorage?.getItem(CUSTOMER_SESSION_KEY);
      if (legacy) { stored = legacy; try { ls?.setItem(CUSTOMER_SESSION_KEY, legacy); } catch {} }
    }
    if (stored) return normalizeClientId(stored);
    const next = newAnonymousClientId();
    ls?.setItem(CUSTOMER_SESSION_KEY, next);
    return next;
  } catch {
    try { return normalizeClientId(newAnonymousClientId()); }
    catch { return ''; }
  }
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
const CUSTOMER_PUBLIC_DOMAIN_PLACEHOLDER = '__fp_public_domain__';
const sanitizeCustomerText = (value = '') => {
  const raw = String(value);
  if (/^data:(?:image|video)\//i.test(raw)) return raw;
  const withPublicBrandProtected = raw
    .replace(forbiddenPattern('FP\\s+' + 'Ma' + 'trix', 'gi'), CUSTOMER_PUBLIC_BRAND_PLACEHOLDER)
    .replace(forbiddenPattern('fp' + 'matrix\\.cn', 'gi'), CUSTOMER_PUBLIC_DOMAIN_PLACEHOLDER);
  return CUSTOMER_FORBIDDEN_REPLACEMENTS
    .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), withPublicBrandProtected)
    .replaceAll(CUSTOMER_PUBLIC_BRAND_PLACEHOLDER, 'FP ' + 'Ma' + 'trix')
    .replaceAll(CUSTOMER_PUBLIC_DOMAIN_PLACEHOLDER, 'fp' + 'matrix.cn');
};
const sanitizeCustomerPayload = (value) => {
  if (typeof value === 'string') return sanitizeCustomerText(value);
  if (Array.isArray(value)) return value.map(sanitizeCustomerPayload);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeCustomerPayload(item)]));
  }
  return value;
};
const currentPath = () => String(location.pathname || '').replace(/\/+$/, '');
const normalizeInternalEntry = () => {
  const rawPath = String(location.pathname || '');
  const path = rawPath.replace(/\/+$/, '');
  if (path === '/internal' && rawPath !== '/internal/') {
    const normalizedUrl = new URL(location.href);
    normalizedUrl.pathname = '/internal/';
    location.replace(`${normalizedUrl.pathname}${normalizedUrl.search}${normalizedUrl.hash}`);
  }
};
normalizeInternalEntry();
const isInternalMode = () => {
  const path = currentPath();
  return path === '/internal' || path.startsWith('/internal/');
};
const isGenerationWorkbenchRoute = () => currentPath() === '/internal/generation-workbench';
const isBenchmarkInsightsRoute = () => currentPath() === '/internal/benchmark-insights';
const isInternalStandaloneRoute = () => isGenerationWorkbenchRoute() || isBenchmarkInsightsRoute();
const VIEW_PROFILES = {
  internal_admin: {
    role: 'internal_admin',
    tabs: ['overview', 'strategy', 'plan', 'generate', 'qa_deliver', 'data'],
    sanitize: false,
    delivery: 'all',
    intake: 'full',
  },
  client_viewer: {
    role: 'client_viewer',
    tabs: ['strategy', 'plan', 'deliver', 'data'],
    sanitize: true,
    delivery: 'qa_passed_only',
    intake: 'minimal',
  },
  selfserve_client: {
    role: 'selfserve_client',
    tabs: ['strategy', 'plan', 'generate', 'deliver'],
    sanitize: true,
    delivery: 'qa_passed_only',
    quota: 'beans',
    intake: 'minimal',
  },
  outsourced_worker: {
    role: 'outsourced_worker',
    tabs: ['generate'],
    sanitize: true,
    assignedOnly: true,
    intake: 'assigned',
  },
};
const roleFromRoute = () => (isInternalMode() ? 'internal_admin' : 'client_viewer');
const getProfile = (role = roleFromRoute()) => VIEW_PROFILES[role] || VIEW_PROFILES.client_viewer;
const currentProfile = () => getProfile(roleFromRoute());
const isInternalDataScope = () => isInternalMode();
const isInternalProfile = (profile = currentProfile()) => isInternalDataScope() || profile.role === 'internal_admin';
const profileHasTab = (tab, profile = currentProfile()) => Array.isArray(profile.tabs) && profile.tabs.includes(tab);
const profileDeliveryView = (profile = currentProfile()) => profile.delivery === 'qa_passed_only' ? 'client' : 'internal';
const profileSanitizePayload = (value, profile = currentProfile()) => profile.sanitize ? sanitizeCustomerPayload(value) : value;
const SHARED_HERO_TITLE = '获客罗盘';
window.VIEW_PROFILES = VIEW_PROFILES;
window.getProfile = getProfile;
const CONTENT_DECISION_SAMPLE = {
  company_name: '内容决策局',
  industry: '企业内容增长 / 线上获客 / AI营销复盘',
  main_goal: '30天验证内容能否带来老板/企业主咨询',
  current_channels: '小红书, 视频号, 朋友圈/私域',
  posting_frequency: '每周3条',
  biggest_problem: '发完没人复盘',
  target_customer: '老板、企业主、商家、门店负责人',
  offer: '一次免费内容复盘表 / 企业内容增长诊断',
  customer_pain: '发了很多内容，但不知道哪条真的带来客户，也不知道下一条该怎么优化',
  content_assets: '老板真实问题、客户案例、历史笔记截图、复盘表模板、AI选题流程',
  monthly_budget: '先低成本验证，暂不投放',
  decision_cycle: '7天小样本复盘，30天判断是否加码',
  best_recent_content: '一条内容有没有获客价值，不是看点赞，而是看收藏、咨询和咨询',
  account_preference: '内容决策局',
  benchmark: {
    platform: '小红书',
    accounts: ['https://example.com/benchmark-account'],
    notes: '参考企业增长类账号：标题多用真实问题、避坑、复盘方法，收藏和咨询反馈较高。',
    sample_content: '代表内容：企业主发内容没咨询，通常不是内容太少。数据摘要：收藏高于点赞，咨询集中问复盘表。',
  },
  contact: '企业营销工具验证样例',
};

const blankClientState = () => ({
  project: null,
  project_stage: '未诊断',
  current_cycle_id: 'cycle-1',
  assessment: null,
  diagnosis: null,
  plans: [],
  feedback: [],
  records: [],
  content_rounds: [],
  active_round: 1,
  current_round: 1,
  selected_plan_id: '',
  latest_next_round: null,
  review: null,
  intake_history: [],
  diagnosis_history: [],
  active_diagnosis_id: null,
  source: '',
  environment: '',
  app_version: APP_VERSION,
});

let clientState = blankClientState();
let projectStore = {activeProjectId: null, lastActiveProjectId: null, projects: []};
let customerAccountState = {
  loading: false,
  enabled: false,
  signed_in: false,
  account: null,
  entitlement: null,
  clients: [],
  challenge_id: '',
  email: '',
};
let allCustomersState = { customers: [], errors: [], loading: false, error: '' };
let internalBillingState = { orders: [], loading: false, error: '' };
let customerDetailEditMode = false;
let internalOpsTab = 'plans';
let allCustomersLoadInFlight = null;
let allCustomersLoadAt = 0;
const ALL_CUSTOMERS_RELOAD_TTL_MS = 10000;
let feishuCollaborationState = { scope: '', loading: false, error: '', status: null, result: null };
let customerPendingCoCreationPayload = null;
let lastCustomerGenerationPayload = null;
let pendingCustomerPlanJob = null;

const api = async (url, opts={}) => {
  const {
    timeoutMs = 35000,
    internalToken = '',
    suppressInternalUnauthorized = false,
    headers: requestedHeaders = {},
    ...fetchOptions
  } = opts;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {'Content-Type':'application/json', ...requestedHeaders};
    const token = String(internalToken || (isInternalProfile() ? readInternalAccessToken() : '')).trim();
    if (token) headers['x-internal-token'] = token;
    if (!token && !isInternalDataScope()) {
      const shareToken = customerShareTokenFromUrl();
      const clientId = customerClientId();
      const accessToken = ensureCustomerAccessToken(clientId);
      if (shareToken) headers['x-customer-share-token'] = shareToken;
      if (accessToken) headers['x-customer-access-token'] = accessToken;
    }
    const res = await fetch(url, {...fetchOptions, headers, signal: controller.signal});
    const data = await res.json().catch(() => ({}));
    if(!res.ok) {
      const error = new Error(data.error || '请求失败');
      error.status = res.status;
      error.code = data.code || '';
      error.retry_after_seconds = Number(data.retry_after_seconds || 0);
      if (res.status === 401 && isInternalProfile() && !suppressInternalUnauthorized) {
        handleInternalUnauthorized();
      }
      throw error;
    }
    return sanitizeCustomerPayload(data);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('生成时间过长，请稍后重试');
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
};
const newCustomerEventId = (prefix = 'event') => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid || Date.now().toString(36)}`;
};
const customerAnalyticsSessionId = () => {
  try {
    let value = String(window.sessionStorage?.getItem(CUSTOMER_ANALYTICS_SESSION_KEY) || '').trim();
    if (!value) {
      value = newCustomerEventId('session');
      window.sessionStorage?.setItem(CUSTOMER_ANALYTICS_SESSION_KEY, value);
    }
    return value;
  } catch {
    return newCustomerEventId('session');
  }
};
const customerTrackingEventId = (event = '', suffix = '') => `${customerAnalyticsSessionId()}-${event}${suffix ? `-${String(suffix).replace(/[^a-z0-9._-]+/gi, '-').slice(0, 48)}` : ''}`;
const trackCustomerEvent = (event, properties = {}, eventId = '') => {
  if (isInternalDataScope()) return;
  const clientId = customerClientId();
  api('/api/track', {
    method: 'POST',
    timeoutMs: 5000,
    body: JSON.stringify({
      event,
      event_id: eventId || customerTrackingEventId(event),
      client_id: clientId,
      properties,
    }),
  }).catch(() => {});
};
const trackCustomerEventOnce = (event, properties = {}) => {
  const key = `${CUSTOMER_ANALYTICS_SESSION_KEY}.${event}`;
  try {
    if (window.sessionStorage?.getItem(key)) return;
    window.sessionStorage?.setItem(key, '1');
  } catch {}
  trackCustomerEvent(event, properties, customerTrackingEventId(event));
};
const toast = (msg) => { const el=$('#toast'); el.textContent=sanitizeCustomerText(msg); el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2400); };
const formData = (form) => Object.fromEntries(new FormData(form).entries());
const stateWeight = (state = {}) =>
  (Array.isArray(state.feedback) ? state.feedback.length * 100 : 0) +
  (Array.isArray(state.plans) ? state.plans.length * 10 : 0) +
  (state.diagnosis ? 5 : 0) +
  (state.assessment ? 3 : 0) +
  (state.review ? 2 : 0);
const hiddenNames = new Set(['未命名客户', '未命名项目', '新客户项目']);
const cleanDisplayName = (value) => {
  const text = String(value || '').trim();
  return text && !hiddenNames.has(text) ? text : '';
};
const withWorkbenchSuffix = (name) => name.endsWith('作战台') ? name : `${name}作战台`;
const customerDisplayName = (assessment = {}, project = null) => {
  const data = assessment || {};
  const name = cleanDisplayName(project?.name) || cleanDisplayName(data.company_name) || cleanDisplayName(data.industry);
  return name ? withWorkbenchSuffix(name) : '我的内容增长作战台';
};
const explicitInternalClientName = () => {
  if (!isInternalProfile()) return '';
  const id = explicitCustomerClientId();
  if (id === 'del-doctor-share') return '德尔医生';
  return '';
};
const visibleClientName = () => {
  const assessment = clientState.assessment || {};
  const project = clientState.project || {};
  const explicitName = explicitInternalClientName();
  const raw = explicitName
    || cleanDisplayName(assessment.company_name)
    || cleanDisplayName(project.name).replace(/作战台$/g, '')
    || cleanDisplayName(assessment.industry);
  return raw || '';
};
const visibleClientSource = () => cleanDisplayName(clientState.source)
  || cleanDisplayName(clientState.assessment?.source)
  || cleanDisplayName(clientState.project?.source)
  || cleanDisplayName(projectStore.projects.find((item) => String(item.id) === String(clientState.project?.id))?.source);
const makeProject = (assessment = {}, existing = null) => existing || {
  id: assessment.project_id || `project-${assessment.client_id || 'customer'}-${Date.now()}`,
  client_id: assessment.client_id || customerClientId(),
  name: customerDisplayName(assessment),
  created_at: localTimestamp(),
};
function hasRestorableState(state = {}){
  state = state || {};
  const plans = Array.isArray(state.plans) ? state.plans : [];
  const hasProject = Boolean(state.project?.id || cleanDisplayName(state.project?.name));
  const hasCycle = Boolean(state.current_cycle_id);
  return Boolean(state.diagnosis && (plans.length || hasProject || hasCycle));
}
const normalizeState = (state = {}) => {
  const assessment = state.assessment || null;
  const project = state.project || (assessment ? makeProject(assessment) : null);
  const current_cycle_id = state.current_cycle_id || 'cycle-1';
  const withMeta = (items) => (Array.isArray(items) ? items : []).map((item) => ({
    project_id: item.project_id || project?.id || 'default-project',
    cycle_id: item.cycle_id || current_cycle_id,
    ...item,
  }));
  return {
    project,
    client_id: state.client_id || assessment?.client_id || project?.client_id || customerClientId(),
    project_stage: state.project_stage || inferProjectStage({plans: state.plans, feedback: state.feedback, review: state.review, diagnosis: state.diagnosis}),
    current_cycle_id,
    assessment,
    diagnosis: state.diagnosis || null,
    plans: withMeta(state.plans),
    feedback: withMeta(state.feedback),
    records: Array.isArray(state.records) ? state.records : [],
    content_rounds: Array.isArray(state.content_rounds) ? state.content_rounds : [],
    active_round: Number(state.active_round || state.current_round || 1) || 1,
    current_round: Number(state.current_round || state.active_round || 1) || 1,
    selected_plan_id: state.selected_plan_id || '',
    latest_next_round: state.latest_next_round || null,
    activated_next_round_from: state.activated_next_round_from || '',
    customer_key: state.customer_key || assessment?.customer_key || '',
    dedicated_customer: state.dedicated_customer || assessment?.dedicated_customer || '',
    cloud_sync_version: state.cloud_sync_version || '',
    review: state.review || null,
    intake_history: Array.isArray(state.intake_history) ? state.intake_history : (assessment ? [assessment] : []),
    diagnosis_history: Array.isArray(state.diagnosis_history) ? state.diagnosis_history : (state.diagnosis ? [state.diagnosis] : []),
    active_diagnosis_id: state.active_diagnosis_id || state.diagnosis?.id || null,
    source: state.source || assessment?.source || '',
    environment: state.environment || '',
    app_version: state.app_version || APP_VERSION,
    saved_at: state.saved_at || localTimestamp(),
  };
};
const WINDOW_STORAGE_PREFIX = '__enterpriseMarketingMvpStorage__';
const HASH_STORAGE_PREFIX = 'mvpstate=';
const storageArea = () => {
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const area = window?.[name];
      if (area) return area;
    } catch {}
  }
  return null;
};
const readWindowStore = () => {
  try {
    const raw = String(window?.name || '');
    return raw.startsWith(WINDOW_STORAGE_PREFIX) ? sanitizeCustomerPayload(JSON.parse(raw.slice(WINDOW_STORAGE_PREFIX.length))) : {};
  } catch {
    return {};
  }
};
const readHashStore = () => {
  try {
    const raw = String(location?.hash || '').replace(/^#/, '');
    return raw.startsWith(HASH_STORAGE_PREFIX) ? sanitizeCustomerPayload(JSON.parse(decodeURIComponent(raw.slice(HASH_STORAGE_PREFIX.length)))) : {};
  } catch {
    return {};
  }
};
const writeWindowStore = (store) => {
  try {
    window.name = `${WINDOW_STORAGE_PREFIX}${JSON.stringify(store)}`;
    return true;
  } catch {
    return false;
  }
};
const writeHashStore = (store) => {
  try {
    const hash = `${HASH_STORAGE_PREFIX}${encodeURIComponent(JSON.stringify(store))}`;
    if (typeof history !== 'undefined' && history?.replaceState) {
      history.replaceState(null, '', `${location.pathname}${location.search}#${hash}`);
    } else {
      location.hash = hash;
    }
    return true;
  } catch {
    return false;
  }
};
const readFallbackStore = () => {
  const windowStore = readWindowStore();
  return Object.keys(windowStore).length ? windowStore : readHashStore();
};
const writeFallbackStore = (store) => {
  const wroteWindow = writeWindowStore(store);
  const wroteHash = writeHashStore(store);
  return wroteWindow || wroteHash;
};
const safeStorage = {
  get length(){
    const area = storageArea();
    if (area) { try { return area.length; } catch {} }
    return Object.keys(readFallbackStore()).length;
  },
  key(index){
    const area = storageArea();
    if (area) { try { return area.key(index); } catch {} }
    return Object.keys(readFallbackStore())[index] || null;
  },
  getItem(key){
    const area = storageArea();
    if (area) { try { return area.getItem(key); } catch {} }
    return readFallbackStore()[key] || null;
  },
  setItem(key, value){
    const area = storageArea();
    if (area) {
      try {
        area.setItem(key, value);
        return true;
      } catch {}
    }
    const store = readFallbackStore();
    store[key] = String(value);
    return writeFallbackStore(store);
  },
  removeItem(key){
    const area = storageArea();
    if (area) {
      try {
        area.removeItem(key);
        return true;
      } catch {}
    }
    const store = readFallbackStore();
    delete store[key];
    return writeFallbackStore(store);
  },
};
function projectSummaryFromState(state = clientState){
  const normalized = normalizeState(state);
  const project = normalized.project || makeProject(normalized.assessment || {});
  return {
    id: project.id,
    name: customerDisplayName(normalized.assessment, project),
    stage: normalized.project_stage || inferProjectStage(normalized),
    updated_at: normalized.saved_at || localTimestamp(),
    state: normalized,
  };
}
const canonicalProjectName = (item = {}) => {
  const sourceText = [
    item.name,
    item.state?.project?.name,
    item.state?.assessment?.company_name,
    item.state?.assessment?.industry,
    item.state?.assessment?.offer,
    item.state?.assessment?.target_customer,
  ].filter(Boolean).join(' ');
  // 同一客户项目可能经历过“内置样例名→真实客户名”的迁移；检测合规类项目合并成一个项目，避免下拉出现重复数据。
  if (/检测|医疗器械|注册检验|注册送检|EMC|环境试验/.test(sourceText)) return '检测合规服务';
  return String(item.name || item.state?.project?.name || item.state?.assessment?.company_name || '')
    .replace(/\s+/g, '')
    .replace(/作战台$/g, '')
    .trim();
};
const projectLeakText = (item = {}) => [
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
const isKnownCrossProjectState = (item = {}) => /P0[123]|安标|安规|医疗器械|注册送检|EMC|SunPace|Sunny|PTE|德尔医生|del-doctor|feishu_bitable_p03/i.test(projectLeakText(item));
const explicitProjectClientText = (item = {}) => [
  item.client_id,
  item.state?.client_id,
  item.state?.customer_key,
  item.state?.project?.client_id,
  item.state?.assessment?.client_id,
  item.state?.assessment?.customer_key,
].filter(Boolean).map((value) => normalizeClientId(value)).filter(Boolean);
const keepProjectForCurrentEntry = (item = {}) => {
  if (!isInternalDataScope()) return true;
  const explicitId = explicitCustomerClientId();
  if (explicitId) return explicitProjectClientText(item).includes(explicitId);
  return !isKnownCrossProjectState(item);
};
function normalizeProjectItem(item = {}){
  const state = normalizeState(item.state || {});
  const name = customerDisplayName(state.assessment, state.project) || item.name || '我的内容增长作战台';
  return {
    ...item,
    id: item.id || state.project?.id,
    name,
    stage: state.project_stage || inferProjectStage(state),
    state,
    updated_at: item.updated_at || state.saved_at || localTimestamp(),
  };
}
const BUSINESS_TIMESTAMP_WITHOUT_ZONE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/;
function timestampToEpoch(value){
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
}
function preferIncomingTimestamp(incoming, existing){
  const incomingEpoch = timestampToEpoch(incoming);
  const existingEpoch = timestampToEpoch(existing);
  if (!Number.isFinite(incomingEpoch) || !Number.isFinite(existingEpoch)) return true;
  return incomingEpoch >= existingEpoch;
}
function compareTimestampDesc(left, right){
  const leftEpoch = timestampToEpoch(left);
  const rightEpoch = timestampToEpoch(right);
  if (Number.isFinite(leftEpoch) && Number.isFinite(rightEpoch)) return rightEpoch - leftEpoch;
  if (Number.isFinite(leftEpoch)) return -1;
  if (Number.isFinite(rightEpoch)) return 1;
  return 0;
}
function preferProjectItem(candidate, existing){
  if (!existing) return candidate;
  const candidateWeight = stateWeight(candidate.state);
  const existingWeight = stateWeight(existing.state);
  if (candidateWeight !== existingWeight) return candidateWeight > existingWeight ? candidate : existing;
  const candidateStage = candidate.state?.project_stage || candidate.stage || '';
  const existingStage = existing.state?.project_stage || existing.stage || '';
  if (candidateStage !== existingStage) {
    if (candidateStage === '运营中') return candidate;
    if (existingStage === '运营中') return existing;
  }
  return preferIncomingTimestamp(candidate.updated_at, existing.updated_at) ? candidate : existing;
}
function loadProjectStore(){
  try {
    const parsed = JSON.parse(safeStorage.getItem(projectsStorageKey()) || 'null');
    if (parsed && Array.isArray(parsed.projects)) {
      projectStore = {
        activeProjectId: parsed.activeProjectId || parsed.projects[0]?.id || null,
        lastActiveProjectId: parsed.lastActiveProjectId || null,
        projects: parsed.projects.filter(keepProjectForCurrentEntry).map(normalizeProjectItem).filter((item)=>item.id && hasRestorableState(item.state) && keepProjectForCurrentEntry(item)),
      };
    }
  } catch {
    projectStore = {activeProjectId: null, lastActiveProjectId: null, projects: []};
  }
  return projectStore;
}
function saveProjectStore(){
  return safeStorage.setItem(projectsStorageKey(), JSON.stringify(projectStore));
}
function normalizeProjectStoreShape(store = {}){
  const projects = Array.isArray(store.projects) ? store.projects : [];
  return {
    activeProjectId: store.activeProjectId || projects[0]?.id || null,
    lastActiveProjectId: store.lastActiveProjectId || null,
    projects: projects.filter(keepProjectForCurrentEntry).map(normalizeProjectItem).filter((item)=>item.id && hasRestorableState(item.state) && keepProjectForCurrentEntry(item)),
  };
}
function mergeProjectStores(localStore = projectStore, cloudStore = {}){
  const local = normalizeProjectStoreShape(localStore);
  const cloud = normalizeProjectStoreShape(cloudStore);
  const preferExplicitInternalCloud = isInternalDataScope() && Boolean(explicitCustomerClientId());
  const byId = new Map();
  [...local.projects, ...cloud.projects].forEach((item)=>{
    const key = String(item.id);
    byId.set(key, preferProjectItem(item, byId.get(key)));
  });
  const byName = new Map();
  [...byId.values()].forEach((item)=>{
    const key = canonicalProjectName(item) || String(item.id);
    byName.set(key, preferProjectItem(item, byName.get(key)));
  });
  const projects = [...byName.values()].sort((a, b) => compareTimestampDesc(a.updated_at, b.updated_at));
  const resolveProjectId = (wantedId) => {
    if (!wantedId) return null;
    const direct = projects.find((item)=>String(item.id) === String(wantedId));
    if (direct) return direct.id;
    const source = [...local.projects, ...cloud.projects].find((item)=>String(item.id) === String(wantedId));
    const nameKey = canonicalProjectName(source);
    return nameKey ? projects.find((item)=>canonicalProjectName(item) === nameKey)?.id || null : null;
  };
  projectStore = {
    activeProjectId: (preferExplicitInternalCloud ? resolveProjectId(cloud.activeProjectId) : null) || resolveProjectId(local.activeProjectId) || resolveProjectId(cloud.activeProjectId) || projects[0]?.id || null,
    lastActiveProjectId: resolveProjectId(local.lastActiveProjectId) || resolveProjectId(cloud.lastActiveProjectId) || null,
    projects,
  };
  saveProjectStore();
  return projectStore;
}
let cloudSyncTimer = null;
async function pullCloudProjectStore({silent = true} = {}){
  try {
    const internalMode = isInternalDataScope();
    const modeQuery = internalMode ? '&mode=internal' : '';
    const result = await api(`/api/state?client_id=${encodeURIComponent(customerClientId())}${modeQuery}`);
    if (result?.project_store?.projects) {
      mergeProjectStores(projectStore, result.project_store);
      if (!silent) toast(`已同步云端项目：${projectStore.projects.length} 个`);
      return true;
    }
  } catch (error) {
    if (!silent) toast('云端项目同步失败，本机数据仍可用');
  }
  return false;
}
async function pushCloudProjectStore({silent = true} = {}){
  try {
    loadProjectStore();
    const legacy_state_proof = await customerProjectAccessProof(projectStore);
    await api('/api/state', {method:'POST', body: JSON.stringify({client_id: customerClientId(), project_store: projectStore, legacy_state_proof})});
    if (!silent) toast('已同步到云端，手机和电脑刷新后可见');
    return true;
  } catch (error) {
    if (!silent) toast('本地已保存；云端同步失败，跨设备暂不可见');
  }
  return false;
}
function scheduleCloudSync(){
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(()=>pushCloudProjectStore({silent:true}), 250);
}
function upsertCurrentProjectState(){
  if (!hasRestorableState(clientState)) return false;
  const summary = projectSummaryFromState(clientState);
  clientState = summary.state;
  projectStore.activeProjectId = summary.id;
  const index = projectStore.projects.findIndex((item)=>String(item.id) === String(summary.id));
  if (index >= 0) projectStore.projects[index] = summary;
  else projectStore.projects.unshift(summary);
  projectStore.projects.sort((a, b) => compareTimestampDesc(a.updated_at, b.updated_at));
  saveProjectStore();
  return true;
}
const saveLocal = () => {
  clientState.saved_at = localTimestamp();
  clientState = sanitizeCustomerPayload(clientState);
  upsertCurrentProjectState();
  const saved = safeStorage.setItem(appStateStorageKey(), JSON.stringify(clientState));
  scheduleCloudSync();
  return saved;
};

const customerCloudNumber = (value) => Math.max(0, Number(value || 0) || 0);

function customerRecordToCloudFeedback(record = {}, saved = {}, index = 0){
  const clientId = customerClientId();
  const assessment = saved.assessment || clientState.assessment || {};
  const projectId = saved.project_id || clientState.project?.id || assessment.project_id || `project-${clientId}`;
  const activeRound = customerActiveRound(saved);
  const contentPlanId = planIdValue(record.content_plan_id || saved.selected_plan_id || '');
  return {
    id: record.feedback_id || `customer-record-${contentPlanId || index + 1}-${String(record.created_at || Date.now()).replace(/[^a-z0-9]+/gi, '')}`,
    client_id: clientId,
    project_id: projectId,
    cycle_id: saved.current_cycle_id || clientState.current_cycle_id || `customer-round-${activeRound}`,
    content_plan_id: contentPlanId,
    plan_topic: customerText(record.plan_topic || customerPlanById(saved, contentPlanId)?.topic || ''),
    publish_link: normalizeExternalUrl(record.publish_link || ''),
    feedback_stage: record.feedback_stage || `第 ${activeRound} 轮效果记录`,
    views: customerCloudNumber(record.views || record.backend_views || record.backend_play_count || record.play_count || record.exposure),
    backend_views: customerCloudNumber(record.views || record.backend_views || record.backend_play_count || record.play_count || record.exposure),
    backend_play_count: customerCloudNumber(record.views || record.backend_views || record.backend_play_count || record.play_count || record.exposure),
    likes: customerCloudNumber(record.likes),
    comments: customerCloudNumber(record.comments),
    favorites: customerCloudNumber(record.favorites),
    shares: customerCloudNumber(record.shares),
    engagement: customerCloudNumber(record.engagement) || customerCloudNumber(record.likes) + customerCloudNumber(record.comments) + customerCloudNumber(record.favorites) + customerCloudNumber(record.shares),
    consultations: customerCloudNumber(record.consultations),
    appointments: customerCloudNumber(record.appointments),
    observation_tags: customerText(record.observation_tags || ''),
    notes: customerText(record.notes || record.observation || ''),
    source: 'customer_public_record',
    round_number: activeRound,
    created_at: record.created_at || localTimestamp(),
  };
}

function customerCloudReview(saved = {}){
  const records = Array.isArray(saved.records) ? saved.records : [];
  const latest = records[0] || null;
  if (!latest) return clientState.review || null;
  const nextRound = latest.daily_advice?.next_round || saved.latest_next_round || {};
  const review = nextRound.review_judgment || {};
  return {
    id: `customer-review-${customerRecordKey(latest) || Date.now()}`,
    client_id: customerClientId(),
    summary: nextRound.customer_summary || latest.daily_advice?.advice?.judgment || '客户已记录发布效果，等待下一轮内容验证。',
    next_suggestion: review.decision || latest.daily_advice?.advice?.nextStep || '继续根据真实数据调整下一条内容。',
    winning_theme: latest.plan_topic || customerPlanById(saved, latest.content_plan_id)?.topic || '',
    bottleneck: review.less || latest.notes || '',
    observation_tags: latest.observation_tags || '',
    action_items: Array.isArray(nextRound.next_7_day_plan) ? nextRound.next_7_day_plan.slice(0, 3).map((row)=>row.topic || row.action).filter(Boolean) : [],
    source: 'customer_public_record',
    round_number: customerActiveRound(saved),
    created_at: latest.created_at || localTimestamp(),
  };
}

function customerCloudProjectStore(saved = {}){
  const assessment = saved.assessment || clientState.assessment || null;
  const diagnosis = saved.diagnosis || clientState.diagnosis || null;
  const plans = customerPlans(saved);
  if (!assessment || !diagnosis || !plans.length) return null;
  const clientId = customerClientId();
  const activeRound = customerActiveRound(saved);
  const projectId = saved.project_id || clientState.project?.id || assessment.project_id || `project-${clientId}`;
  const currentCycleId = saved.current_cycle_id || clientState.current_cycle_id || `customer-round-${activeRound}`;
  const project = {
    id: projectId,
    client_id: clientId,
    name: customerDisplayName(assessment, clientState.project || null),
    created_at: clientState.project?.created_at || assessment.created_at || localTimestamp(),
    updated_at: saved.updated_at || localTimestamp(),
  };
  const normalizedPlans = plans.map((plan, index)=>({
    ...plan,
    id: planIdValue(plan) || `plan-${index + 1}`,
    client_id: clientId,
    project_id: projectId,
    cycle_id: currentCycleId,
    round_number: plan.round_number || activeRound,
  }));
  const records = Array.isArray(saved.records) ? saved.records : [];
  const feedbackFromRecords = records.map((record, index)=>customerRecordToCloudFeedback(record, saved, index));
  const feedback = feedbackFromRecords.length ? feedbackFromRecords : (Array.isArray(clientState.feedback) ? clientState.feedback : []);
  const cloudState = normalizeState({
    project,
    client_id: clientId,
    project_stage: records.length ? '运营中' : '待启动',
    current_cycle_id: currentCycleId,
    assessment: {
      ...assessment,
      client_id: clientId,
      customer_key: assessment.customer_key || saved.customer_key || explicitCustomerClientId() || clientId,
      cloud_sync_version: APP_VERSION,
    },
    diagnosis,
    plans: normalizedPlans,
    feedback,
    review: customerCloudReview(saved),
    records,
    content_rounds: Array.isArray(saved.content_rounds) ? saved.content_rounds : [],
    active_round: activeRound,
    current_round: activeRound,
    selected_plan_id: saved.selected_plan_id || '',
    latest_next_round: saved.latest_next_round || records[0]?.daily_advice?.next_round || null,
    activated_next_round_from: saved.activated_next_round_from || '',
    customer_key: saved.customer_key || assessment.customer_key || explicitCustomerClientId() || clientId,
    dedicated_customer: saved.dedicated_customer || assessment.dedicated_customer || '',
    intake_history: Array.isArray(clientState.intake_history) ? clientState.intake_history : [assessment],
    diagnosis_history: Array.isArray(saved.diagnosis_history) ? saved.diagnosis_history : clientState.diagnosis_history,
    source: 'customer_public_cloud_sync',
    environment: 'customer_version',
    app_version: APP_VERSION,
    cloud_sync_version: APP_VERSION,
    saved_at: saved.updated_at || localTimestamp(),
  });
  const summary = projectSummaryFromState(cloudState);
  return {
    activeProjectId: summary.id,
    lastActiveProjectId: null,
    projects: [summary],
  };
}

async function syncCustomerTrialCloudState(saved = {}, {silent = true} = {}){
  if (isInternalDataScope()) return false;
  const projectStorePayload = customerCloudProjectStore(saved);
  if (!projectStorePayload) return false;
  try {
    const legacy_state_proof = await customerProjectAccessProof(projectStorePayload);
    await api('/api/state', {
      method: 'POST',
      body: JSON.stringify({
        client_id: customerClientId(),
        source: 'customer_public_cloud_sync',
        sync_version: APP_VERSION,
        project_store: projectStorePayload,
        legacy_state_proof,
      }),
    });
    if (!silent) toast('已同步到云端，团队可在内部端查看。');
    return true;
  } catch (error) {
    if (!silent) toast('本地已保存，云端同步稍后自动重试。');
    return false;
  }
}

function scheduleCustomerTrialCloudSync(saved = {}){
  const snapshot = sanitizeCustomerPayload(saved || {});
  window.setTimeout(() => {
    syncCustomerTrialCloudState(snapshot, {silent: true}).catch(() => {});
  }, 50);
}

function buildVersionedProjectState(result = {}, payload = {}, source = 'customer_public', existingState = null, reason = '首次诊断'){
  const existing = existingState || blankClientState();
  const assessment = {
    ...(result.assessment || payload),
    client_id: (result.assessment || payload).client_id || payload.client_id || customerClientId(),
    customer_key: (result.assessment || payload).customer_key || payload.customer_key || explicitCustomerClientId() || customerClientId(),
    source,
    submitted_by: source === 'customer_public' ? '客户' : '团队人员',
    app_version: APP_VERSION,
    created_at: (result.assessment || payload).created_at || localTimestamp(),
  };
  const project = existing.project || makeProject({...assessment, project_id: assessment.project_id || `project-${Date.now()}`});
  project.name = customerDisplayName(assessment, project);
  const previousDiagnoses = Array.isArray(existing.diagnosis_history) ? existing.diagnosis_history : (existing.diagnosis ? [existing.diagnosis] : []);
  const diagnosisVersion = previousDiagnoses.length + 1;
  const diagnosis = {
    ...(result.diagnosis || {}),
    client_id: (result.diagnosis || {}).client_id || assessment.client_id,
    diagnosis_version: diagnosisVersion,
    reason_for_regeneration: reason,
    is_active: true,
    app_version: APP_VERSION,
    version_label: VERSION_LABEL,
  };
  const archived = previousDiagnoses.map((item)=>({...item, is_active: false}));
  const intakeHistory = [
    {...assessment, intake_version: (Array.isArray(existing.intake_history) ? existing.intake_history.length : 0) + 1},
    ...(Array.isArray(existing.intake_history) ? existing.intake_history : []),
  ].slice(0, 30);
  return normalizeState({
    project,
    project_stage: '待启动',
    current_cycle_id: existing.current_cycle_id || 'cycle-1',
    assessment,
    diagnosis,
    plans: result.plans || [],
    feedback: Array.isArray(existing.feedback) ? existing.feedback : [],
    review: null,
    intake_history: intakeHistory,
    diagnosis_history: [diagnosis, ...archived].slice(0, 30),
    active_diagnosis_id: diagnosis.id || existing.active_diagnosis_id || null,
    source,
    environment: source === 'customer_public' ? 'customer_version' : 'internal_version',
    app_version: APP_VERSION,
    saved_at: localTimestamp(),
  });
}

function fillCustomerFormFromAssessment(assessment = {}){
  const form = $('#customerAssessmentForm');
  if (!form) return;
  ['company_name','industry','main_goal','target_customer','offer','store_location','course_schedule','coach_credentials','extra_context','customer_pain','content_assets','best_recent_content','current_channels','content_mode','biggest_problem'].forEach((key)=>{
    const input = form.querySelector(`[name="${key}"]`);
    if (input) {
      const value = assessment[key] || '';
      input.value = value;
      input.defaultValue = value;
      if (input.tagName === 'TEXTAREA') input.textContent = value;
      else input.setAttribute('value', value);
    }
  });
  form.querySelectorAll('.customer-choice-chip').forEach((btn)=>{
    const values = [assessment.current_channels, assessment.content_mode, assessment.biggest_problem].filter(Boolean).join('、').split(/[,，、/\s]+/).map((item)=>item.trim()).filter(Boolean);
    const selected = values.includes(btn.dataset.value);
    btn.classList.toggle('is-selected', selected);
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

const CUSTOMER_ASSESSMENT_FIELDS = ['company_name','industry','main_goal','target_customer','offer','store_location','course_schedule','coach_credentials','extra_context','customer_pain','content_assets','best_recent_content','current_channels','content_mode','posting_frequency','biggest_problem'];
function customerAssessmentSignature(assessment = {}){
  const normalized = {};
  CUSTOMER_ASSESSMENT_FIELDS.forEach((key)=>{
    normalized[key] = String(assessment?.[key] || '')
      .trim()
      .replace(/[，、]/g, ',')
      .replace(/\s+/g, ' ');
  });
  return JSON.stringify(normalized);
}

function hasDifferentCustomerDraft(saved = {}){
  if (!saved?.draft_assessment) return false;
  if (!saved.assessment) return true;
  return customerAssessmentSignature(saved.draft_assessment) !== customerAssessmentSignature(saved.assessment);
}

function clearCustomerGeneratedView(){
  const resultSection = $('#customerResultSection');
  const effectSection = $('#customerEffectSection');
  const planBlock = $('#customerPlanBlock');
  const roundHistory = $('#customerRoundHistory');
  const coCreationSection = $('#customerCoCreationSection');
  if (resultSection) resultSection.hidden = true;
  if (effectSection) effectSection.hidden = true;
  if (planBlock) planBlock.hidden = true;
  if (roundHistory) roundHistory.hidden = true;
  if (coCreationSection) coCreationSection.hidden = true;
  const result = $('#customerResult');
  const planList = $('#customerPlanList');
  const roundList = $('#customerRoundHistoryList');
  const coCreationList = $('#customerCoCreationDirections');
  if (result) result.innerHTML = '';
  if (planList) planList.innerHTML = '';
  if (roundList) roundList.innerHTML = '';
  if (coCreationList) coCreationList.innerHTML = '';
  customerSuggestionText = '';
  setCustomerStep('intake');
}

function customerStateProjectName(saved = {}){
  const assessment = saved.assessment || saved.draft_assessment || {};
  return cleanDisplayName(assessment.company_name || assessment.industry || saved.project_name || '上次项目');
}

function renderCustomerResumeBanner(saved = loadCustomerTrialState()){
  const banner = $('#customerResumeBanner');
  if (!banner) return;
  const hasSaved = Boolean(saved?.assessment || saved?.draft_assessment || saved?.diagnosis || (Array.isArray(saved?.plans) && saved.plans.length));
  const shouldShow = hasSaved && !dedicatedCustomerKey();
  banner.hidden = !shouldShow;
  if (!shouldShow) return;
  const name = customerStateProjectName(saved);
  const title = $('#customerResumeTitle');
  const desc = $('#customerResumeDesc');
  if (title) title.textContent = `继续：${name}`;
  if (desc) {
    const hasGenerated = customerHasGeneratedState(saved);
    desc.textContent = hasGenerated
      ? '这个项目已经生成过内容建议。客户第一次打开不会看到你的本地记录；如果要演示新客户，请新建空白项目。'
      : '这个项目保存过草稿信息。客户第一次打开不会看到你的本地记录；如果要演示新客户，请新建空白项目。';
  }
}

function resetCustomerTrialForm(){
  const form = $('#customerAssessmentForm');
  form?.reset();
  form?.querySelectorAll('.customer-choice-chip').forEach((button) => {
    const selected = [
      '推荐模式：平台差异化适配',
      '还不确定',
      '不知道发什么',
    ].includes(button.dataset.value);
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const contentMode = form?.querySelector('[name="content_mode"]');
  if (contentMode) contentMode.value = '推荐模式：平台差异化适配';
  const platform = form?.querySelector('[name="current_channels"]');
  const problem = form?.querySelector('[name="biggest_problem"]');
  if (platform) platform.value = '还不确定';
  if (problem) problem.value = '不知道发什么';
  lastCustomerGenerationPayload = null;
  setCustomerGenerationRetryVisible(false);
  setCustomerMessage('#customerFormError', '');
}

function startBlankCustomerProject(){
  const currentId = customerClientId();
  safeStorage.removeItem(customerTrialStorageKey(currentId));
  if (!explicitCustomerClientId()) {
    safeStorage.setItem(CUSTOMER_SESSION_KEY, newAnonymousClientId());
  }
  customerSuggestionText = '';
  clientState = blankClientState();
  resetCustomerTrialForm();
  clearCustomerGeneratedView();
  renderCustomerEffects([]);
  renderCustomerRecordSummary({});
  renderCustomerNextAdvice({});
  renderCustomerResumeBanner({});
  setCustomerFormCollapsed(false);
  setCustomerStep('intake', {state: {}, focus: true});
  toast('已切换到空白项目，可以给新客户重新填写。');
}

function setCustomerFormCollapsed(collapsed){
  const formCard = $('#customerFormCard');
  if (!formCard) return;
  formCard.hidden = Boolean(collapsed);
  formCard.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
}

function renderCustomerGeneratedState(saved = {}, options = {}){
  const assessment = saved.assessment || clientState.assessment;
  const diagnosis = saved.diagnosis || clientState.diagnosis;
  const plans = Array.isArray(saved.plans) ? saved.plans : clientState.plans;
  if (!assessment || !diagnosis) return false;
  if (saved.project_id && clientState.project) clientState.project.id = saved.project_id;
  if (Array.isArray(saved.diagnosis_history)) clientState.diagnosis_history = saved.diagnosis_history;
  $('#customerResult').innerHTML = buildCustomerSuggestion(assessment, diagnosis, plans || []);
  const planList = $('#customerPlanList');
  const planBlock = $('#customerPlanBlock');
  if (planList) planList.innerHTML = buildCustomerPlanList(assessment, plans || []);
  if (planBlock) {
    planBlock.hidden = !(plans && plans.length);
    const planTitle = planBlock.querySelector('.customer-plan-head h3');
    const roundNumber = customerActiveRound(saved);
    if (planTitle) planTitle.textContent = roundNumber > 1 ? `第 ${roundNumber} 轮内容计划` : '本轮内容计划';
  }
  renderCustomerRoundHistory(saved);
  updateCustomerSelectedPlanDisplay(saved);
  const whyBox = $('#customerWhyBox');
  if (whyBox) whyBox.innerHTML = `<p>这份建议主要根据你的业务「${esc(customerText(assessment.industry))}」、目标客户「${esc(customerText(assessment.target_customer || '未填写'))}」、平台「${esc(customerText(assessment.current_channels))}」和当前问题「${esc(customerText(assessment.biggest_problem))}」生成。${clientState.diagnosis_history?.length > 1 ? `已保留 ${clientState.diagnosis_history.length} 版诊断记录，当前生效 v${clientState.diagnosis?.diagnosis_version || 1}。` : ''}</p>`;
  $('#customerResultSection').hidden = false;
  $('#customerEffectSection').hidden = false;
  setCustomerFormCollapsed(true);
  setCustomerStep(options.step || ((Array.isArray(saved.records) && saved.records.length) ? 'next' : 'plan'), {state: saved, focus: options.focus});
  return true;
}

function explicitCustomerClientId(){
  const params = new URLSearchParams(window.location.search || '');
  return normalizeClientId(params.get('client_id') || params.get('customer') || params.get('client') || params.get('prefill') || '');
}

function customerClientId(){
  return sharedCustomerClientId || explicitCustomerClientId() || (isInternalDataScope() ? INTERNAL_CLIENT_ID : readSessionClientId());
}

function userSettingsClientId(){
  return isInternalDataScope() ? INTERNAL_CLIENT_ID : customerClientId();
}

function userSettingsStorageKey(clientId = userSettingsClientId()){
  return `${USER_SETTINGS_STORAGE_PREFIX}.${normalizeClientId(clientId) || 'anonymous-fallback'}`;
}

function readLocalUserSettings(){
  const fallback = {
    personalized_recommendation_enabled: true,
    personalization_mode: 'personalized',
  };
  try {
    const parsed = JSON.parse(window.localStorage?.getItem(userSettingsStorageKey()) || 'null');
    if (!parsed || typeof parsed !== 'object') return fallback;
    const enabled = parsed.personalized_recommendation_enabled !== false;
    return {
      personalized_recommendation_enabled: enabled,
      personalization_mode: enabled ? 'personalized' : 'non_personalized',
    };
  } catch {
    return fallback;
  }
}

function writeLocalUserSettings(enabled = true){
  const normalized = enabled !== false;
  const settings = {
    personalized_recommendation_enabled: normalized,
    personalization_mode: normalized ? 'personalized' : 'non_personalized',
    updated_at: localTimestamp(),
  };
  try {
    window.localStorage?.setItem(userSettingsStorageKey(), JSON.stringify(settings));
  } catch {}
  return settings;
}

function personalizedRecommendationEnabled(){
  return readLocalUserSettings().personalized_recommendation_enabled !== false;
}

function customerTrialStorageKey(clientId = customerClientId()){
  return `enterpriseMarketingCustomerTrial.${normalizeClientId(clientId) || 'anonymous-fallback'}.v1`;
}

function projectsStorageKey(clientId = customerClientId()){
  if (isInternalDataScope()) return PROJECTS_KEY;
  return `enterpriseMarketingMvpProjects.${normalizeClientId(clientId) || 'anonymous-fallback'}.v1`;
}

function appStateStorageKey(clientId = customerClientId()){
  if (isInternalDataScope()) return STORAGE_KEY;
  return `enterpriseMarketingMvpState.${normalizeClientId(clientId) || 'anonymous-fallback'}.v5`;
}

function customerScopedPayload(payload = {}){
  const client_id = customerClientId();
  const customer_key = dedicatedCustomerKey() || explicitCustomerClientId() || client_id;
  return sanitizeCustomerPayload({
    ...payload,
    client_id,
    customer_key,
    settings_client_id: userSettingsClientId(),
    personalized_recommendation_enabled: personalizedRecommendationEnabled(),
  });
}

function isBasketballDedicatedAssessment(assessment = {}){
  const text = [
    assessment.company_name,
    assessment.industry,
    assessment.main_goal,
    assessment.target_customer,
    assessment.offer,
    assessment.extra_context,
  ].filter(Boolean).join(' ');
  return /星跃少儿篮球训练营|少儿篮球培训机构|篮球培训客户专属预填链路/.test(text);
}

function isDedicatedCustomerState(state = {}){
  const marker = state.dedicated_customer || state.assessment?.dedicated_customer || state.draft_assessment?.dedicated_customer;
  if (marker) return true;
  // customer_key 默认就等于 client_id（普通客户），不算专属；只有与 client_id 不同的预设键才算
  if (state.customer_key && state.client_id && String(state.customer_key) !== String(state.client_id)) return true;
  return isBasketballDedicatedAssessment(state.assessment || {}) || isBasketballDedicatedAssessment(state.draft_assessment || {});
}

function editCustomerAssessment(){
  const current = loadCustomerTrialState();
  fillCustomerFormFromAssessment(current.assessment || current.draft_assessment || clientState.assessment || {});
  setCustomerFormCollapsed(false);
  updateCustomerProgress(1);
  $('#customerFormCard')?.scrollIntoView({behavior:'smooth', block:'start'});
  toast('已带回上次填写内容，修改后可重新生成。');
}
window.editCustomerAssessment = editCustomerAssessment;
const loadLocal = () => {
  loadProjectStore();
  const active = projectStore.projects.find((item)=>String(item.id) === String(projectStore.activeProjectId)) || projectStore.projects[0];
  if (active?.state && hasRestorableState(active.state)) {
    projectStore.activeProjectId = active.id;
    saveProjectStore();
    safeStorage.setItem(appStateStorageKey(), JSON.stringify(active.state));
    return active.state;
  }
  const candidates = [];
  for (let i = 0; i < safeStorage.length; i += 1) {
    const key = safeStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    try {
      const parsed = JSON.parse(safeStorage.getItem(key) || 'null');
      if (parsed && typeof parsed === 'object') {
        const normalized = normalizeState(parsed);
        if (hasRestorableState(normalized) && keepProjectForCurrentEntry({id: normalized.project?.id, name: normalized.project?.name, state: normalized})) candidates.push({key, state: normalized});
      }
    } catch {}
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => stateWeight(b.state) - stateWeight(a.state));
  const best = candidates[0];
  clientState = best.state;
  upsertCurrentProjectState();
  if (best.key !== appStateStorageKey()) safeStorage.setItem(appStateStorageKey(), JSON.stringify(best.state));
  return best.state;
};
function switchProject(projectId){
  loadProjectStore();
  const project = projectStore.projects.find((item)=>String(item.id) === String(projectId));
  if (!project) { toast('未找到该项目'); return; }
  projectStore.lastActiveProjectId = projectStore.activeProjectId || project.id;
  projectStore.activeProjectId = project.id;
  clientState = normalizeState(project.state);
  saveProjectStore();
  safeStorage.setItem(appStateStorageKey(), JSON.stringify(clientState));
  renderAllFromClient();
  loadFeishuCollaborationStatus().catch((error)=>toast(error.message || '飞书协同状态读取失败'));
  toast(`已切换到：${project.name}`);
}
window.switchProject = switchProject;
function startNewProject(){
  loadProjectStore();
  if (projectStore.activeProjectId) projectStore.lastActiveProjectId = projectStore.activeProjectId;
  clientState = blankClientState();
  projectStore.activeProjectId = null;
  saveProjectStore();
  safeStorage.setItem(DEMO_DISABLED_KEY, '1');
  safeStorage.removeItem(appStateStorageKey());
  renderAllFromClient();
  closeMoreActions();
  showDiagnosisWorkflow();
  toast('已进入新项目填写，不影响已保存项目。');
}
window.startNewProject = startNewProject;
function returnToActiveProject(){
  loadProjectStore();
  const targetId = projectStore.lastActiveProjectId || projectStore.projects[0]?.id;
  if (!targetId) { toast('暂无可返回的运营项目'); return; }
  switchProject(targetId);
  toast('已返回当前运营中的项目。');
}
window.returnToActiveProject = returnToActiveProject;
function activeReturnTarget(){
  loadProjectStore();
  if (clientState.diagnosis || !projectStore.projects.length) return null;
  return projectStore.projects.find((item)=>String(item.id) === String(projectStore.lastActiveProjectId)) || projectStore.projects[0] || null;
}
function renderTopReturnProjectAction(){
  const btn = $('#topReturnProjectBtn');
  if (!btn) return;
  const target = activeReturnTarget();
  btn.hidden = !target;
  if (target) btn.textContent = `返回：${cleanDisplayName(target.name || '当前运营项目')}`;
}
function renderReturnToProjectAction(){
  return '';
}
const toNonNegative = (value) => Math.max(0, Number(value || 0));
const withBusy = async (button, busyText, task) => {
  const originalText = button?.textContent;
  const stages = (Array.isArray(busyText) ? busyText : [busyText]).filter(Boolean);
  let stageIndex = 0;
  let stageTimer = null;
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = stages[0] || '处理中...';
    if (stages.length > 1) {
      stageTimer = window.setInterval(() => {
        stageIndex = Math.min(stageIndex + 1, stages.length - 1);
        button.textContent = stages[stageIndex];
        if (stageIndex === stages.length - 1) window.clearInterval(stageTimer);
      }, 2800);
    }
  }
  try {
    await task();
  } catch (error) {
    toast(error.message || '操作失败，请稍后再试');
  } finally {
    if (stageTimer) window.clearInterval(stageTimer);
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.textContent = originalText;
    }
  }
};

function localSampleDiagnosis(){
  return {
    id: 1,
    app_version: APP_VERSION,
    version_label: VERSION_LABEL,
    assessment_id: 1,
    score: 96,
    strategy_score: 96,
    loop_score: 55,
    score_note: '策略清晰度来自业务输入；运营周期优先看发布、回填和复盘数据。',
    stage: '运营周期',
    priority_problem: '发完没人复盘',
    insight: '当前不是缺内容想法，而是缺少把发布结果回填成下一轮选题判断的机制。',
    weekly_action: '本周围绕“内容有没有带来客户”连续验证 7 条内容，并按 T+24 / T+72 / T+7 回填。',
    next_step: '先复制收藏和咨询信号更强的复盘表主题，再降权纯工具介绍内容。',
    risk_warning: '如果只看点赞，不看收藏、评论和咨询，会误判内容是否真的带来客户。',
    platform_recommendations: {
      strategy: '主平台先做小红书，视频号做复用，朋友圈承接信任。',
      primary: [{platform:'小红书', reason:'适合沉淀搜索和收藏型内容'}],
      support: [{platform:'视频号', reason:'复用老板视角短视频'}],
      client_platforms: [{platform:'朋友圈/私域', reason:'承接已有客户信任'}],
      avoid: [{platform:'自动矩阵发布', reason:'当前阶段不做代发，避免封号和失控'}],
    },
    benchmark_reference: {
      source_summary: '基于企业增长类账号的标题结构和用户反馈信号。',
      recent_topics: ['发了内容为什么没咨询', '老板每周怎么复盘内容', '内容获客看哪些数据'],
      title_structures: ['不是看A，而是看B', '老板没时间做X，先做Y', '一张表判断X有没有用'],
      transferable_directions: ['内容复盘表', '客户咨询路径', '低成本验证'],
      avoid: ['空泛AI工具介绍', '承诺涨粉涨咨询'],
    },
    account_setup: {
      account_name: '内容决策局',
      positioning: '给老板看的内容增长复盘号',
      bio_lines: ['不教玄学涨粉，只看内容有没有带来客户', '每周一张表复盘发布、回填和咨询'],
      homepage_keywords: ['内容复盘', '企业获客', '老板增长'],
      avatar_direction: '深色专业文字标识，避免花哨IP感',
      starting_platform: {platform:'小红书', reason:'先验证收藏和咨询信号', rule:'短正文、强分段、不要评论区关键词引导'},
      naming_warning: '对外称老板/企业主/商家，避免小老板。',
    },
    created_at: localTimestamp(),
  };
}
function localSamplePlans(){
  const topics = [
    ['企业主发内容没咨询，通常不是内容太少', '先帮老板判断内容有没有说中客户正在犹豫的问题', '图文/短视频', '引导主页查看内容复盘表', '收藏+咨询'],
    ['老板用AI写文案前，先想清楚这3个获客问题', '把AI工具使用拉回客户是谁、顾虑是什么、为什么现在要问', '图文', '引导领取内容复盘表', '收藏'],
    ['一条内容有没有获客价值，不是看点赞', '用收藏、评论、咨询三类信号判断内容是否值得复制', '短视频', '引导主页咨询诊断', '咨询'],
    ['企业账号别只发产品，先回答客户正在犹豫什么', '把服务介绍转成客户下单前会问的真实问题', '图文', '引导做一次诊断', '评论+收藏'],
    ['老板没时间做运营，也能先复盘这4个数', '用曝光、互动、收藏、咨询判断下一条怎么改', '图文', '引导保存检查清单', '收藏'],
    ['为什么内容火了，客户还是不来问？', '拆解流量到咨询之间缺少的信任和承接', '图文', '引导主页查看模板', '收藏+咨询'],
    ['本周哪条内容最接近真实客户需求？', '用本周数据决定复制、降权和重测方向', '短视频', '引导预约复盘', '咨询'],
  ];
  return topics.map(([topic, angle, content_type, cta, target_metric], index) => ({
    id: index + 1,
    diagnosis_id: 1,
    planned_date: localDateIso(new Date(Date.now() + index * 86400000)),
    platform: index % 2 ? '视频号' : '小红书',
    topic, angle, content_type, cta, target_metric,
    publish_quality: index === 0 ? '已验证' : '待验证',
    quality_note: index === 0 ? '已有收藏和咨询信号，适合复制同主题' : '发布后必须回填数据',
    owner: '客户负责人',
    status: index === 0 ? '已发布' : '待发布',
    publish_link: index === 0 ? 'https://example.com/published/content-review-table' : '',
    created_at: localTimestamp(),
  }));
}
function makeOperatingSampleFeedback(){
  return [{
    id: Date.now(),
    project_id: 'project-content-decision-demo',
    cycle_id: 'cycle-1',
    content_plan_id: 1,
    publish_link: 'https://example.com/published/content-review-table',
    feedback_stage: 'T+72',
    views: 1800,
    likes: 41,
    comments: 6,
    favorites: 39,
    shares: 8,
    consultations: 3,
    notes: '收藏高于点赞，咨询集中问复盘表，说明“内容是否带来客户”主题值得复制。',
    created_at: localTimestamp(),
  }];
}
async function loadContentDecisionSample({silent = false} = {}){
  let result = null;
  try {
    result = await api('/api/assessments', {method:'POST', body: JSON.stringify(CONTENT_DECISION_SAMPLE)});
  } catch {
    result = {assessment: {...CONTENT_DECISION_SAMPLE, id: 1, created_at: localTimestamp()}, diagnosis: localSampleDiagnosis(), plans: localSamplePlans()};
  }
  const assessment = result.assessment || {...CONTENT_DECISION_SAMPLE, id: 1, created_at: localTimestamp()};
  const project = makeProject(assessment, {id:'project-content-decision-demo', name: assessment.company_name || '内容决策局', created_at: localTimestamp()});
  const plans = (result.plans?.length ? result.plans : localSamplePlans()).map((plan, index)=> index === 0 ? {...plan, status:'已发布', publish_link: plan.publish_link || 'https://example.com/published/content-review-table'} : plan);
  clientState = normalizeState({
    project,
    project_stage: '运营中',
    current_cycle_id: 'cycle-1',
    assessment,
    diagnosis: result.diagnosis || localSampleDiagnosis(),
    plans,
    feedback: makeOperatingSampleFeedback(),
    review: null,
  });
  clientState.review = createLocalReview();
  safeStorage.removeItem(DEMO_DISABLED_KEY);
  saveLocal();
  renderAllFromClient();
  if (!silent) toast('已载入运营周期样例数据');
}

async function loadAll(){
  const params = new URLSearchParams(location.search);
  if (params.get('empty') === '1' || params.get('reset') === '1') {
    safeStorage.removeItem(appStateStorageKey()); safeStorage.removeItem(DEMO_DISABLED_KEY);
    clientState = blankClientState();
    renderAllFromClient();
    return;
  }
  loadProjectStore();
  await pullCloudProjectStore({silent:true});
  const local = loadLocal();
  if (hasRestorableState(local)) {
    clientState = {...clientState, ...local};
    renderAllFromClient();
    return;
  }
  clientState = blankClientState();
  renderAllFromClient();
}

function pct(n){ return `${Math.round((Number(n)||0)*100)}%`; }
function esc(v){ return String(v ?? '').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function hasUrlProtocol(value = ''){
  return /^[a-z][a-z0-9+.-]*:/i.test(String(value || '').trim());
}
function looksLikeExternalUrl(value = ''){
  const text = String(value || '').trim();
  if (!text || hasUrlProtocol(text) || text.startsWith('/') || text.startsWith('#')) return false;
  if (/^www\./i.test(text)) return true;
  return /^[\w-]+(?:\.[\w-]+)+(?:[/?#:]|$)/i.test(text);
}
function normalizeExternalUrl(value = ''){
  const text = String(value || '').trim();
  if (!text) return '';
  return looksLikeExternalUrl(text) ? `https://${text}` : text;
}
function num(v){ return Number(v || 0); }
function playbackValue(item = {}){
  return num(item.backend_views ?? item.backend_play_count ?? item.play_count ?? item.playback_count ?? item.views);
}
function cycleLabel(value = 'cycle-1'){
  const n = Number(String(value || '').match(/cycle-(\d+)/)?.[1] || 1);
  return `第${n}轮增长周期`;
}
function compactNumber(value){
  const n = Number(value || 0);
  return n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万` : String(n);
}
function interactions(f){ return num(f.likes) + num(f.comments) + num(f.favorites) + num(f.shares); }
const FEEDBACK_STAGE_ORDER = {'T+24': 1, 'T+72': 2, 'T+7': 3};
function stageRank(stage){ return FEEDBACK_STAGE_ORDER[stage] || 0; }
function latestFeedbackRows(){
  const byPlan = new Map();
  clientState.feedback.forEach((item) => {
    const key = Number(item.content_plan_id);
    const existing = byPlan.get(key);
    if (!existing || stageRank(item.feedback_stage) > stageRank(existing.feedback_stage) || (stageRank(item.feedback_stage) === stageRank(existing.feedback_stage) && preferIncomingTimestamp(item.created_at, existing.created_at))) {
      byPlan.set(key, item);
    }
  });
  return [...byPlan.values()];
}
function localTimestamp(){
  const d = new Date();
  const parts = new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false}).formatToParts(d).reduce((acc, p)=>{acc[p.type]=p.value; return acc;}, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
function localDateIso(date = new Date()){
  const parts = new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date).reduce((acc, p)=>{acc[p.type]=p.value; return acc;}, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

let customerSuggestionText = '';
let internalAuthVerified = false;
let internalAuthGateInitialized = false;
let internalAuthCheckInFlight = false;

function setInternalAccessMessage(message = '', tone = ''){
  const messageEl = $('#internalAccessMessage');
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.classList.toggle('error', tone === 'error');
  messageEl.classList.toggle('success', tone === 'success');
}

function setInternalAccessLocked(locked, message = ''){
  if (!isInternalProfile()) return;
  internalAuthVerified = !locked;
  const gate = $('#internalAccessGate');
  if (gate) gate.hidden = !locked;
  document.body.classList.toggle('internal-auth-locked', locked);
  if (message) setInternalAccessMessage(message, locked ? 'error' : 'success');
  setAppShell();
}

function handleInternalUnauthorized(){
  if (!isInternalProfile()) return;
  saveInternalAccessToken('');
  setInternalAccessLocked(true, '请输入有效的内部访问口令。');
}

async function verifyInternalAccessToken(token = ''){
  const candidate = String(token || '').trim();
  if (!candidate) {
    setInternalAccessLocked(true, '请输入内部访问口令。');
    return false;
  }
  if (internalAuthCheckInFlight) return false;
  internalAuthCheckInFlight = true;
  const submit = $('#internalAccessSubmit');
  if (submit) {
    submit.disabled = true;
    submit.textContent = '正在验证...';
  }
  setInternalAccessMessage('正在验证访问权限...', '');
  try {
    await api('/api/dashboard', { internalToken: candidate, timeoutMs: 12000 });
    saveInternalAccessToken(candidate);
    internalAuthVerified = true;
    const gate = $('#internalAccessGate');
    if (gate) gate.hidden = true;
    document.body.classList.remove('internal-auth-locked');
    allCustomersState = { ...allCustomersState, customers: [], errors: [], loading: true, error: '' };
    renderAllCustomersPanel();
    refreshAllCustomers({ force: true }).catch(() => {});
    loadInternalBillingOrders().catch(() => {});
    setAppShell();
    syncRouteState();
    return true;
  } catch (error) {
    internalAuthVerified = false;
    saveInternalAccessToken('');
    setInternalAccessLocked(true, error?.status === 401 ? '访问口令不正确，请重新输入。' : '暂时无法验证访问权限，请稍后重试。');
    $('#internalAccessToken')?.focus();
    return false;
  } finally {
    internalAuthCheckInFlight = false;
    if (submit) {
      submit.disabled = false;
      submit.textContent = '进入内部工作区';
    }
  }
}

function initInternalAccessGate(){
  if (!isInternalProfile()) return;
  setInternalAccessLocked(true);
  const form = $('#internalAccessForm');
  if (!internalAuthGateInitialized && form) {
    internalAuthGateInitialized = true;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      verifyInternalAccessToken($('#internalAccessToken')?.value || '');
    });
  }
  const urlToken = readInternalAccessTokenFromUrl();
  const stored = readInternalAccessToken();
  if (urlToken) {
    if ($('#internalAccessToken')) $('#internalAccessToken').value = urlToken;
    saveInternalAccessToken(urlToken);
  }
  const initialToken = urlToken || stored;
  if (initialToken) {
    verifyInternalAccessToken(initialToken);
  } else {
    setInternalAccessMessage('请输入内部访问口令。');
    window.setTimeout(() => $('#internalAccessToken')?.focus(), 0);
  }
}

function setAppShell(){
  const profile = currentProfile();
  const internal = profile.role === 'internal_admin';
  const internalLocked = internal && !internalAuthVerified;
  const customerApp = $('#customerApp');
  const internalApp = $('#internalApp');
  if (customerApp) {
    customerApp.hidden = internal;
    customerApp.toggleAttribute('inert', internal);
    customerApp.setAttribute('aria-hidden', String(internal));
  }
  if (internalApp) {
    internalApp.hidden = !internal || internalLocked;
    internalApp.toggleAttribute('inert', !internal || internalLocked);
    internalApp.setAttribute('aria-hidden', String(!internal || internalLocked));
  }
  const accessGate = $('#internalAccessGate');
  if (accessGate) accessGate.hidden = !internalLocked;
  document.body.classList.toggle('customer-mode', !internal);
  document.body.classList.toggle('internal-mode', internal);
  document.body.classList.toggle('internal-auth-locked', internalLocked);
  document.body.classList.toggle('generation-workbench-mode', isGenerationWorkbenchRoute());
  document.body.classList.toggle('benchmark-insights-mode', isBenchmarkInsightsRoute());
  document.body.dataset.activeMode = internal ? 'internal' : 'customer';
  document.body.dataset.viewRole = profile.role;
  document.body.dataset.viewTabs = (profile.tabs || []).join(',');
  if (!internalLocked) renderSharedJourneyShell(profile);
}

function sharedJourneySteps(profile = currentProfile()){
  if (profile.role === 'client_viewer') {
    return [
      {step: 1, key: 'strategy', label: '填入基本信息'},
      {step: 2, key: 'strategy', label: '确认方向'},
      {step: 3, key: 'plan', label: '内容计划'},
      {step: 4, key: 'data', label: '记录效果'},
      {step: 5, key: 'data', label: '下一轮优化'},
    ];
  }
  const isMinimal = profile.intake === 'minimal';
  return [
    {step: 1, key: 'strategy', label: isMinimal ? '填写 3 项信息' : '填写信息'},
    {step: 2, key: 'plan', label: '内容建议'},
    {step: 3, key: 'data', label: profile.role === 'internal_admin' ? '记录/复盘' : '记录效果'},
  ].filter((item) => profileHasTab(item.key, profile) || item.step < 3);
}

function renderSharedJourneyShell(profile = currentProfile()){
  const steps = sharedJourneySteps(profile);
  document.querySelectorAll('.customer-progress-strip').forEach((strip) => {
    strip.dataset.profileRole = profile.role;
    strip.querySelectorAll('.cps-item').forEach((item) => {
      const step = steps.find((entry) => String(entry.step) === String(item.dataset.step));
      const label = item.querySelector('.cps-label');
      if (step && label) label.textContent = step.label;
    });
  });
}

function customerText(value){
  return String(value || '')
    .replace(/周复盘/g, '下次优化建议')
    .replace(/发完没人复盘/g, '发完后没人总结效果')
    .replace(/复盘/g, '优化')
    .replace(/回填/g, '记录效果')
    .replace(/闭环率/g, '效果记录')
    .replace(/闭环/g, '持续优化')
    .replace(/作战台/g, '工作页')
    .replace(/判断依据/g, '为什么这样建议')
    .replace(/Matrix/g, '')
    .replace(/数据飞轮/g, '数据积累')
    .replace(/小老板/g, '老板/企业主/商家')
    .replace(/v1\.\d+(?:\.\d+)*/g, '')
    .replace(/记录效果效果/g, '记录效果')
    .replace(/效果记录效果/g, '效果记录')
    .trim();
}

const CUSTOMER_FLOW_STEPS = ['intake', 'confirm', 'plan', 'record', 'next'];
const CUSTOMER_FLOW_STEP_NUMBERS = {intake: 1, confirm: 2, plan: 3, record: 4, next: 5};

function customerHasGeneratedState(saved = loadCustomerTrialState()){
  return Boolean(saved?.assessment && saved?.diagnosis && Array.isArray(saved.plans) && saved.plans.length);
}

function customerHasRecords(saved = loadCustomerTrialState()){
  return Array.isArray(saved?.records) && saved.records.length > 0;
}

function customerStateWithLiveGenerated(saved = {}){
  if (customerHasGeneratedState(saved) || !customerHasGeneratedState(clientState)) return saved || {};
  return {
    ...(saved || {}),
    project: saved.project || clientState.project,
    project_stage: saved.project_stage || clientState.project_stage,
    current_cycle_id: saved.current_cycle_id || clientState.current_cycle_id || 'cycle-1',
    assessment: saved.assessment || clientState.assessment,
    diagnosis: saved.diagnosis || clientState.diagnosis,
    plans: Array.isArray(saved.plans) && saved.plans.length ? saved.plans : clientState.plans,
    records: Array.isArray(saved.records) ? saved.records : [],
    content_rounds: Array.isArray(saved.content_rounds) ? saved.content_rounds : [],
    active_round: saved.active_round || saved.current_round || 1,
    current_round: saved.current_round || saved.active_round || 1,
    project_id: saved.project_id || clientState.project?.id,
    diagnosis_history: Array.isArray(saved.diagnosis_history) ? saved.diagnosis_history : clientState.diagnosis_history,
    suggestion: saved.suggestion || customerSuggestionText,
  };
}

function customerCanOpenStep(step, saved = loadCustomerTrialState()){
  if (step === 'intake') return true;
  if (step === 'confirm') return !$('#customerCoCreationSection')?.hidden;
  if (step === 'plan') return customerHasGeneratedState(saved);
  if (step === 'record') return customerHasGeneratedState(saved);
  if (step === 'next') return customerHasRecords(saved);
  return false;
}

function customerDefaultStep(saved = loadCustomerTrialState()){
  if (!$('#customerCoCreationSection')?.hidden) return 'confirm';
  if (customerHasRecords(saved)) return 'next';
  if (customerHasGeneratedState(saved)) return 'plan';
  return 'intake';
}

function updateCustomerProgress(step){
  const strip = $('#customerProgressStrip');
  if (!strip) return;
  const stepKey = typeof step === 'string' ? step : (CUSTOMER_FLOW_STEPS[Number(step || 1) - 1] || 'intake');
  const activeNumber = CUSTOMER_FLOW_STEP_NUMBERS[stepKey] || 1;
  const saved = loadCustomerTrialState();
  strip.querySelectorAll('.cps-item').forEach((item) => {
    const n = Number(item.dataset.step);
    const key = item.dataset.customerStepTarget || CUSTOMER_FLOW_STEPS[n - 1] || 'intake';
    const available = customerCanOpenStep(key, saved) || n <= activeNumber;
    item.classList.toggle('cps-done', n < activeNumber);
    item.classList.toggle('cps-active', n === activeNumber);
    item.classList.toggle('cps-locked', !available);
    item.toggleAttribute('disabled', !available);
    item.setAttribute('aria-current', n === activeNumber ? 'step' : 'false');
  });
}

function setCustomerStep(step = 'intake', options = {}){
  const saved = options.state || loadCustomerTrialState();
  let nextStep = CUSTOMER_FLOW_STEPS.includes(step) ? step : customerDefaultStep(saved);
  if (!customerCanOpenStep(nextStep, saved)) nextStep = customerDefaultStep(saved);
  const hasGenerated = customerHasGeneratedState(saved);
  const hasRecord = customerHasRecords(saved);
  const formCard = $('#customerFormCard');
  const coCreation = $('#customerCoCreationSection');
  const resultSection = $('#customerResultSection');
  const effectSection = $('#customerEffectSection');
  if (formCard) formCard.hidden = nextStep !== 'intake';
  if (coCreation) coCreation.hidden = nextStep !== 'confirm';
  if (resultSection) resultSection.hidden = !((nextStep === 'plan' || nextStep === 'record') && hasGenerated);
  if (effectSection) effectSection.hidden = !((nextStep === 'record' && hasGenerated) || (nextStep === 'next' && hasRecord));
  document.body.classList.remove(...CUSTOMER_FLOW_STEPS.map((item)=>`customer-step-${item}`));
  document.body.classList.add(`customer-step-${nextStep}`);
  document.body.dataset.customerStep = nextStep;
  updateCustomerStepCopy(nextStep);
  updateCustomerProgress(nextStep);
  if (options.focus) {
    const target = nextStep === 'intake'
      ? formCard
      : nextStep === 'confirm'
        ? coCreation
        : nextStep === 'plan'
          ? resultSection
          : effectSection;
    window.setTimeout(()=>target?.scrollIntoView({behavior:'smooth', block:'start'}), 60);
  }
  return nextStep;
}

function updateCustomerStepCopy(step = 'intake'){
  const head = $('#customerEffectSection .customer-section-head');
  if (!head) return;
  const kicker = head.querySelector('p');
  const title = head.querySelector('h2');
  const desc = head.querySelector('span');
  if (step === 'next') {
    if (kicker) kicker.textContent = '第 5 步 · 效果判断';
    if (title) title.textContent = '看这条内容怎么调整';
    if (desc) desc.textContent = '系统会先根据刚记录的数据给出本条优化建议；记录更多真实效果后，就能得到更准的下一轮建议。';
    return;
  }
  if (kicker) kicker.textContent = '第 4 步 · 效果记录';
  if (title) title.textContent = '发完后，记录一下效果';
  if (desc) desc.textContent = '只填几个关键数字。下次系统会根据真实效果，帮你优化下一条内容。';
}

function showCustomerStepMessage(step){
  const msg = step === 'confirm'
    ? '请先填写业务信息，进入方向确认。'
    : step === 'plan'
      ? '请先生成内容建议。'
      : step === 'record'
        ? '请先生成本轮内容计划，再记录发布效果。'
        : '请先保存一条发布效果，系统会先生成本条优化建议。';
  toast(msg);
  setCustomerMessage('#customerFormError', msg, 'error');
  setCustomerStep(customerDefaultStep(), {focus: true});
}

function customerPickShort(text, fallback){
  const items = String(text || '').split(/[、,，/]/).map((item)=>item.trim()).filter(Boolean);
  return items[0] || fallback;
}

function customerFriendlyError(error){
  const raw = String(error?.message || '');
  if (error?.code === 'quota_exceeded') return '本月生成额度已用完。已填写的信息还在，可先查看套餐或继续记录内容效果。';
  if (error?.status === 429 || error?.code === 'rate_limited') return '生成太频繁，稍等片刻再试。';
  if (raw.includes('缺少必填字段')) return '刚刚生成失败了，请检查必填信息是否填写完整。';
  if (raw.includes('生成时间过长') || raw.includes('timeout')) return '生成时间过长，请稍后重试；如果仍失败，请先检查网络后再提交。';
  return '刚刚生成失败了，请稍后再试一次，或检查信息是否填写完整。';
}

function setCustomerMessage(id, message, tone = 'success'){
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', tone === 'error');
  el.classList.toggle('success', tone !== 'error');
  el.hidden = !message;
}

function setCustomerGenerationRetryVisible(visible, label = ''){
  const button = $('#customerGenerationRetry');
  if (!button) return;
  button.hidden = !visible || !lastCustomerGenerationPayload;
  button.textContent = label || (pendingCustomerPlanJob ? '继续获取结果' : '重新尝试生成');
}

function setCustomerQuotaPlanLinkVisible(visible){
  const link = $('#customerQuotaPlanLink');
  if (link) link.hidden = !visible;
}

function customerNeedsOfferDetail(payload = {}){
  const industry = customerText(payload.industry || '');
  const offer = customerText(payload.offer || '');
  if (offer) return false;
  const text = `${industry} ${customerText(payload.main_goal || '')}`;
  const broadBusiness = /^(篮球|运动|体育|零售|服装|美业|教育|培训|本地生活|餐饮|摄影|装修|家居|母婴|健康|企业服务)$/.test(industry);
  const broadKeyword = /篮球|运动|体育|零售|服装|美业|教育|培训|本地生活|母婴|健康|企业服务/.test(industry);
  const alreadySpecific = /销售|售卖|卖|用品|器材|装备|商品|课程|培训|体验课|门店|餐厅|美甲|美睫|口腔|产康|摄影|装修|咨询|软件|工具/.test(text);
  return broadBusiness || (broadKeyword && !alreadySpecific);
}


function customerRequired(payload, profile = currentProfile()){
  const minimalIntake = profile.intake === 'minimal';
  if (!payload.industry) return '请先填写你的行业/业务。';
  if (!payload.main_goal) return '请先填写你现在最想达成的目标。';
  if (!payload.target_customer) return '请先填写你的目标客户。';
  if (!minimalIntake && dedicatedCustomerKey() === 'basketball' && !payload.store_location) return '请补充上课地址/服务范围。';
  if (!minimalIntake && dedicatedCustomerKey() === 'basketball' && !payload.course_schedule) return '请补充可预约时间。';
  if (!minimalIntake && !payload.current_channels) return '请选择你主要想做的平台。';
  if (!minimalIntake && !payload.biggest_problem) return '请选择当前最大的内容问题。';
  return '';
}

function isYouthBasketballPayload(payload = {}){
  const text = [payload.company_name, payload.industry, payload.main_goal, payload.target_customer, payload.offer, payload.extra_context]
    .filter(Boolean)
    .join(' ');
  return /少儿篮球|篮球培训|篮球启蒙|小学生篮球|幼儿篮球|青少年篮球|篮球课|篮球训练|运球|投篮/.test(text);
}

function isMartialArtsPayload(payload = {}){
  const text = [payload.company_name, payload.industry, payload.main_goal, payload.target_customer, payload.offer, payload.extra_context]
    .filter(Boolean)
    .join(' ');
  return /武术|搏击|散打|拳击|泰拳|跆拳道|格斗|防身术|少儿武术|少儿搏击|武馆|搏击俱乐部|武术搏击/.test(text);
}

function customerCoCreationDirections(payload = {}){
  if (isYouthBasketballPayload(payload)) {
    return [
      {
        value: '家长痛点型',
        title: '家长痛点型',
        desc: '先回答孩子零基础、怕跟不上、怕没效果这些真实顾虑。',
        examples: ['孩子零基础能不能上', '体验课第一节练什么'],
      },
      {
        value: '教练专业信任型',
        title: '教练专业信任型',
        desc: '展示课堂怎么练、教练怎么带、孩子如何逐步进步。',
        examples: ['一节课怎么安排', '教练如何保护安全'],
      },
      {
        value: '体验课转化型',
        title: '体验课转化型',
        desc: '重点让家长知道适合年龄、时间安排和怎么预约体验课。',
        examples: ['体验课适合几岁', '周末班怎么约'],
      },
    ];
  }
  if (isMartialArtsPayload(payload)) {
    return [
      {
        value: '家长安全顾虑型',
        title: '家长安全顾虑型',
        desc: '先回答怕受伤、怕太激烈、零基础能不能跟上的真实顾虑。',
        examples: ['第一次课安全吗', '零基础能不能上'],
      },
      {
        value: '教练专业信任型',
        title: '教练专业信任型',
        desc: '展示教练怎么保护、怎么分层带孩子、课堂规则怎么建立。',
        examples: ['教练如何保护安全', '一节课怎么安排'],
      },
      {
        value: '体验课转化型',
        title: '体验课转化型',
        desc: '重点让家长知道适合年龄、课堂强度和怎么预约体验课。',
        examples: ['体验课适合几岁', '周末班怎么约'],
      },
    ];
  }
  const target = customerPickShort(payload.target_customer || '', '目标客户');
  const offer = customerPickShort(payload.offer || payload.main_goal || payload.industry || '', '服务');
  return [
    {
      value: '客户痛点型',
      title: '客户痛点型',
      desc: `先回答${target}正在犹豫、担心或反复比较的问题。`,
      examples: [`为什么需要了解${offer}`, '最常见的决策顾虑'],
    },
    {
      value: '信任证据型',
      title: '信任证据型',
      desc: '用案例、流程、资质、服务细节，让客户相信你能解决问题。',
      examples: ['真实案例怎么判断', '服务过程有哪些细节'],
    },
    {
      value: '咨询转化型',
      title: '咨询转化型',
      desc: '围绕预约、到店、咨询、下单，把内容承接到下一步行动。',
      examples: ['适合谁来咨询', '下一步怎么预约'],
    },
  ];
}

function hideCustomerCoCreation(){
  const section = $('#customerCoCreationSection');
  if (section) section.hidden = true;
  const list = $('#customerCoCreationDirections');
  if (list) list.innerHTML = '';
  setCustomerMessage('#customerCoCreationMessage', '');
  setCustomerGenerationRetryVisible(false);
}

function renderCustomerCoCreation(payload = {}){
  customerPendingCoCreationPayload = sanitizeCustomerPayload({...payload});
  lastCustomerGenerationPayload = null;
  setCustomerGenerationRetryVisible(false);
  const section = $('#customerCoCreationSection');
  const list = $('#customerCoCreationDirections');
  const form = $('#customerCoCreationForm');
  if (!section || !list || !form) return;
  const directions = customerCoCreationDirections(payload);
  list.innerHTML = directions.map((item, index)=>`<button class="customer-direction-card ${index === 0 ? 'is-selected' : ''}" type="button" data-cocreation-direction="${esc(item.value)}" aria-pressed="${index === 0 ? 'true' : 'false'}">
    <span class="customer-direction-radio" aria-hidden="true">✓</span>
    <span class="customer-direction-copy">
      <span class="customer-direction-meta">${esc(index === 0 ? '推荐优先' : '可选方向')}</span>
      <strong>${esc(item.title)}</strong>
      <p>${esc(item.desc)}</p>
      <em>${esc(item.examples.join(' / '))}</em>
    </span>
  </button>`).join('');
  form.reset();
  form.querySelector('[name="selected_direction"]').value = directions[0]?.value || '';
  form.querySelectorAll('[data-customer-avoid-content] .customer-choice-chip').forEach((button)=>{
    button.classList.remove('is-selected');
    button.setAttribute('aria-pressed', 'false');
  });
  section.hidden = false;
  setCustomerStep('confirm', {state: loadCustomerTrialState(), focus: true});
}

function selectCustomerCoCreationDirection(value = ''){
  const form = $('#customerCoCreationForm');
  const input = form?.querySelector('[name="selected_direction"]');
  if (!input) return;
  input.value = value;
  $$('#customerCoCreationDirections [data-cocreation-direction]').forEach((card)=>{
    const selected = card.dataset.cocreationDirection === value;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function collectCustomerCoCreation(){
  const form = $('#customerCoCreationForm');
  if (!form) return null;
  const selected_direction = String(form.querySelector('[name="selected_direction"]')?.value || '').trim();
  const avoided = [...form.querySelectorAll('[data-customer-avoid-content] .customer-choice-chip.is-selected')]
    .map((button)=>button.dataset.value)
    .filter(Boolean);
  const customer_emphasis = String(form.querySelector('[name="customer_emphasis"]')?.value || '').trim();
  if (!selected_direction) return null;
  return sanitizeCustomerPayload({
    selected_direction,
    support_direction: '',
    avoided_content: avoided.includes('暂时没有限制') ? [] : avoided,
    customer_emphasis,
    confirmed_at: localTimestamp(),
  });
}

function isP03AnbiaoSubmission(payload = {}){
  const explicit = explicitCustomerClientId();
  if (/^(p03|anbiao|project-anbiao|licheng)|(?:p03|anbiao|project-anbiao|licheng)/i.test(explicit)) return true;
  const text = [
    payload.company_name,
    payload.industry,
    payload.main_goal,
    payload.target_customer,
    payload.offer,
    payload.customer_pain,
    payload.extra_context,
  ].filter(Boolean).join(' ');
  return /安标|安规|医疗器械|注册送检|注册检验/.test(text) && /检测|合规|整改|送检|资料|机构/.test(text);
}

function defaultCustomerCoCreation(payload = {}){
  const directions = customerCoCreationDirections(payload);
  return sanitizeCustomerPayload({
    selected_direction: directions[0]?.value || '客户痛点型',
    support_direction: '',
    avoided_content: [],
    customer_emphasis: '',
    confirmed_at: localTimestamp(),
    auto_confirmed: true,
  });
}

const CUSTOMER_PLAN_JOB_POLL_DELAYS = [700, 900, 1200, 1600, 2200, 3000, 4000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000];
const CUSTOMER_PLAN_JOB_MAX_NOT_FOUND = 5;
const waitForCustomerPlanJob = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function pollCustomerPlanJob(job = {}, clientId = ''){
  const jobId = String(job.job_id || '').trim();
  const scopedClientId = normalizeClientId(clientId);
  if (!jobId || !scopedClientId) throw new Error('计划任务创建失败，请稍后重试');
  let lastError = null;
  let notFoundCount = 0;
  for (const delay of CUSTOMER_PLAN_JOB_POLL_DELAYS) {
    await waitForCustomerPlanJob(delay);
    try {
      const current = await api(`/api/plan-jobs/${encodeURIComponent(jobId)}?client_id=${encodeURIComponent(scopedClientId)}`, { timeoutMs: 10000 });
      notFoundCount = 0;
      if (current.status === 'completed' && current.result) return current.result;
      if (current.status === 'failed') throw new Error(current.error || '刚刚生成失败了，请稍后再试一次');
    } catch (error) {
      lastError = error;
      // 任务刚创建时 Netlify Blobs 写读传播有短暂延迟，可能先返回 404；
      // 前几轮把 404 当可重试错误，避免客户第一次提交就直接失败。
      if (error?.status === 404) {
        notFoundCount += 1;
        if (notFoundCount >= CUSTOMER_PLAN_JOB_MAX_NOT_FOUND) throw error;
        continue;
      }
    }
  }
  const pendingError = new Error(lastError?.message || '内容建议仍在生成中，请稍后继续获取结果。');
  pendingError.code = 'plan_job_pending';
  pendingError.job = job;
  pendingError.clientId = scopedClientId;
  throw pendingError;
}

function applyCustomerPlanJobResult(result = {}, scopedPayload = {}){
  const reason = clientState.diagnosis ? '客户修改信息后重新生成' : '客户首次提交';
  clientState = buildVersionedProjectState(result, scopedPayload, 'customer_public', clientState.diagnosis ? clientState : null, reason);
  saveLocal();
  const diagnosis = clientState.diagnosis || {};
  const plans = clientState.plans || [];
  const dedicated = dedicatedCustomerKey();
  const stateAssessment = customerScopedPayload(clientState.assessment || scopedPayload);
  const generatedState = {
    project: clientState.project,
    project_stage: clientState.project_stage,
    current_cycle_id: clientState.current_cycle_id,
    assessment: dedicated ? {...stateAssessment, dedicated_customer: dedicated} : stateAssessment,
    draft_assessment: dedicated ? {...stateAssessment, dedicated_customer: dedicated} : stateAssessment,
    diagnosis,
    plans,
    records: [],
    content_rounds: [],
    active_round: 1,
    current_round: 1,
    suggestion: customerSuggestionText,
    project_id: clientState.project?.id,
    diagnosis_history: clientState.diagnosis_history,
    client_id: stateAssessment.client_id,
    customer_key: stateAssessment.customer_key,
    ...(dedicated ? {dedicated_customer: dedicated} : {}),
  };
  saveCustomerTrialState({ ...generatedState, draft_assessment: null });
  scheduleCustomerTrialCloudSync(generatedState);
  lastCustomerGenerationPayload = null;
  pendingCustomerPlanJob = null;
  setCustomerGenerationRetryVisible(false);
  setCustomerQuotaPlanLinkVisible(false);
  hideCustomerCoCreation();
  renderCustomerGeneratedState(generatedState, {focus: true, step: 'plan'});
}

async function submitCustomerAssessmentPayload(scopedPayload = {}, triggerButton = $('#customerGenerateBtn')){
  const errorBox = $('#customerCoCreationSection')?.hidden ? '#customerFormError' : '#customerCoCreationMessage';
  lastCustomerGenerationPayload = sanitizeCustomerPayload({...scopedPayload});
  setCustomerGenerationRetryVisible(false);
  setCustomerQuotaPlanLinkVisible(false);
  setCustomerMessage(errorBox, '');
  await withBusy(triggerButton, ['正在分析业务...', '正在生成选题...', '正在适配平台...'], async () => {
    try {
      const clientId = normalizeClientId(scopedPayload.client_id || scopedPayload.customer_key || customerClientId());
      const requestId = newCustomerEventId('plan');
      trackCustomerEvent('generation_submitted', {source:'customer_public', route:'plan-jobs'}, requestId);
      const submitted = await api('/api/plan-jobs', {
        method:'POST',
        timeoutMs: 10000,
        body: JSON.stringify({ ...scopedPayload, client_id: clientId, customer_key: scopedPayload.customer_key || clientId, request_id: requestId }),
      });
      pendingCustomerPlanJob = {job: submitted, clientId, payload: scopedPayload};
      const result = await pollCustomerPlanJob(submitted, clientId);
      applyCustomerPlanJobResult(result, scopedPayload);
    } catch (error) {
      const quotaExceeded = error?.code === 'quota_exceeded';
      if (error?.code === 'plan_job_pending' && pendingCustomerPlanJob) {
        setCustomerMessage(errorBox, '内容建议仍在生成中。稍后点击“继续获取结果”，不会重复提交。', 'error');
      } else {
        pendingCustomerPlanJob = null;
        setCustomerMessage(errorBox, customerFriendlyError(error), 'error');
      }
      setCustomerQuotaPlanLinkVisible(quotaExceeded);
      setCustomerGenerationRetryVisible(!quotaExceeded, error?.code === 'plan_job_pending' ? '继续获取结果' : '重新尝试生成');
    }
  });
}

async function resumeCustomerPlanJob(triggerButton = $('#customerGenerationRetry')){
  const pending = pendingCustomerPlanJob;
  if (!pending?.job || !pending?.clientId || !pending?.payload) return false;
  const errorBox = $('#customerCoCreationSection')?.hidden ? '#customerFormError' : '#customerCoCreationMessage';
  setCustomerMessage(errorBox, '');
  await withBusy(triggerButton, ['仍在生成内容建议...', '正在获取生成结果...'], async () => {
    try {
      const result = await pollCustomerPlanJob(pending.job, pending.clientId);
      applyCustomerPlanJobResult(result, pending.payload);
    } catch (error) {
      if (error?.code === 'plan_job_pending') {
        setCustomerMessage(errorBox, '内容建议仍在生成中。稍后可以再次点击“继续获取结果”。', 'error');
      } else {
        pendingCustomerPlanJob = null;
        setCustomerMessage(errorBox, customerFriendlyError(error), 'error');
      }
      setCustomerGenerationRetryVisible(true, error?.code === 'plan_job_pending' ? '继续获取结果' : '重新尝试生成');
    }
  });
  return true;
}

function internalIntakeSnapshot(payload = {}){
  const normalized = {...payload};
  Object.keys(normalized).forEach((key) => { normalized[key] = String(normalized[key] || '').trim(); });
  const missing = [];
  const weakPain = !normalized.customer_pain || /客户不知道为什么需要现在咨询|待补充|暂无|没有/.test(normalized.customer_pain);
  const weakAssets = (!normalized.content_assets || /待补充|暂无|没有/.test(normalized.content_assets)) && !normalized.best_recent_content;
  if (!normalized.offer) missing.push({field:'主推产品/服务和价格带', input:'offer', why:'避免系统把商品、课程、到店服务混成泛服务模板。'});
  if (weakPain) missing.push({field:'客户最常问的问题或顾虑', input:'customer_pain', why:'没有真实顾虑，内容只能写概念，打不到客户决策点。'});
  if (weakAssets) missing.push({field:'现有素材或近期表现最好内容', input:'content_assets', why:'没有素材/反馈依据，系统无法判断第一轮内容能用什么证据承接。'});
  const compact = [normalized.ai_project_brief, normalized.industry, normalized.target_customer, normalized.main_goal, normalized.offer, normalized.customer_pain, normalized.content_assets].filter(Boolean).join(' ');
  const projectType = /检测|送检|医疗器械/.test(compact) ? '检测合规服务' : /课程|培训|教育|留学|PTE|雅思/.test(compact) ? '教育/咨询服务' : /门店|到店|附近|美甲|产康|摄影|餐饮/.test(compact) ? '本地服务门店' : /商品|销售|电商|下单|配饰|篮球/.test(compact) ? '产品销售/电商' : (normalized.industry ? '服务/项目型业务' : '待识别');
  const risks = [];
  if (/检测|送检|医疗器械/.test(compact) && /安检/.test(compact)) risks.push({title:'行业误判风险', desc:'这里更像“检测/合规服务”，不要误写成普通安检服务。'});
  if (/企业|器械|老板|商家|B2B|注册送检/.test(compact) && /用户|消费者|宝妈|学生/.test(compact)) risks.push({title:'客群混淆风险', desc:'描述里同时出现企业客户和个人用户，需要确认真正决策人是谁。'});
  if (!normalized.target_customer || /潜在目标客户|所有人|用户|客户$/.test(normalized.target_customer)) risks.push({title:'目标客户过宽', desc:'目标客户还不够具体，后续内容容易变成泛科普。'});
  if (!normalized.main_goal || /品牌|曝光|影响力|增长$/.test(normalized.main_goal)) risks.push({title:'转化目标过泛', desc:'建议落到咨询、留资、到店、下单、复购中的一个。'});
  if (weakAssets) risks.push({title:'证据不足风险', desc:'缺少真实案例/FAQ/流程/截图时，第一轮内容只能作为策略方向，不能冒充可直接发布稿。'});
  if (!risks.length) risks.push({title:'当前理解风险较低', desc:'业务、客群、目标和素材基本能支撑下一步，但生成前仍建议人工扫一遍。'});
  return {
    projectType,
    understood: [
      ['项目类型', projectType],
      ['业务/行业', normalized.industry],
      ['目标客户', normalized.target_customer],
      ['核心转化目标', normalized.main_goal],
      ['内容主战场', normalized.current_channels],
      ['当前主要问题', normalized.biggest_problem],
      ['主推产品/服务', normalized.offer],
      ['可用素材', normalized.content_assets || normalized.best_recent_content],
    ],
    missing,
    risks,
    ready: missing.length === 0,
  };
}

function internalGenerationGate(payload = {}){
  const snapshot = internalIntakeSnapshot(payload);
  if (snapshot.ready) return '';
  return `生成门禁：请先补齐「${snapshot.missing.map((item)=>item.field).join('、')}」。这些不是多余字段，是防止系统误判业务和生成泛模板的最小信息。`;
}

function setInternalSubmitGate(form, snapshot){
  const submit = form?.querySelector('button[type="submit"]');
  if (!submit) return;
  const confirmed = form.dataset.aiConfirmed === 'yes';
  submit.disabled = !snapshot.ready;
  submit.textContent = snapshot.ready ? '生成我的内容增长建议' : '补齐业务信息后生成';
}

function renderInternalIntakeSnapshot(form = $('#assessmentForm')){
  const el = $('#aiIntakeUnderstanding');
  if (!el || !form) return;
  const payload = formData(form);
  Object.keys(payload).forEach((key) => { payload[key] = String(payload[key] || '').trim(); });
  payload.ai_understanding_confirmed = form.dataset.aiConfirmed === 'yes' ? 'yes' : '';
  const snapshot = internalIntakeSnapshot(payload);
  const analyzed = form.dataset.aiAnalyzed === 'yes';
  const filled = snapshot.understood
    .filter(([, value]) => value)
    .map(([label, value]) => `<li><strong>${esc(label)}</strong><span>${esc(value)}</span></li>`)
    .join('') || '<li><strong>系统理解</strong><span>还没有足够信息，请先输入业务描述并点击“分析项目”。</span></li>';
  const missing = snapshot.missing.length
    ? snapshot.missing.map((item)=>`<li><strong>${esc(item.field)}</strong><span>${esc(item.why)}</span><button type="button" class="mini-action" data-focus-field="${esc(item.input)}">去补充</button></li>`).join('')
    : '<li><strong>信息足够</strong><span>已具备进入下一步的最小信息，但仍需你确认系统理解是否正确。</span></li>';
  const risks = snapshot.risks.map((item)=>`<li><strong>${esc(item.title)}</strong><span>${esc(item.desc)}</span></li>`).join('');
  const confirmed = form.dataset.aiConfirmed === 'yes';
  const actionHint = snapshot.ready ? (confirmed ? '已确认理解正确，可以生成。' : '业务字段已齐，可以生成；也可以展开这里复核系统理解。 ') : '请先补齐缺项，再确认继续。';
  el.innerHTML = `<div class="ai-intake-components ${analyzed ? 'is-analyzed' : 'is-empty'}">
    <section class="ai-understanding-card ${snapshot.ready ? 'is-ready' : 'is-blocked'}">
      <div class="ai-understanding-head"><span>组件 2 · 系统理解卡</span><strong>${snapshot.ready ? '理解基本完整' : '理解未完成'}</strong></div>
      <ul>${filled}</ul>
    </section>
    <section class="ai-supplement-card ${snapshot.ready ? 'is-ready' : 'is-blocked'}">
      <div class="ai-card-title"><span>组件 3 · 缺项补充卡</span><strong>${snapshot.missing.length ? `还需补充 ${snapshot.missing.length} 项` : '无硬缺项'}</strong></div>
      <ul class="ai-missing-list">${missing}</ul>
    </section>
    <section class="ai-risk-card">
      <div class="ai-card-title"><span>组件 4 · 项目误判风险卡</span><strong>${snapshot.risks.length} 条判断</strong></div>
      <ul>${risks}</ul>
    </section>
    <section class="ai-confirm-card">
      <div><span>组件 5 · 确认继续</span><strong>${esc(actionHint)}</strong></div>
      <div class="ai-confirm-actions">
        <button class="war-btn" type="button" data-ai-confirm ${snapshot.ready ? '' : 'disabled'}>${confirmed ? '已确认理解正确' : '理解正确，继续'}</button>
        <button class="war-btn secondary" type="button" data-ai-supplement>我要补充信息</button>
        <button class="war-btn secondary" type="button" data-ai-reanalyze>AI 理解错了，重新分析</button>
      </div>
    </section>
  </div>`;
  const status = $('#aiExtractStatus');
  if (status) status.textContent = snapshot.ready ? actionHint : `还需补充：${snapshot.missing.map((item)=>item.field).join('、')}`;
  setInternalSubmitGate(form, snapshot);
}

function initChoiceGroup(groupSelector, formSelector, inputName){
  const group = document.querySelector(groupSelector);
  const input = $(`${formSelector} [name="${inputName}"]`);
  if (!group || !input || group.dataset.choiceReady === '1') return;
  group.dataset.choiceReady = '1';
  const applyChoice = (button) => {
    if (!button) return;
    const multi = group.dataset.multiSelect === 'true';
    if (multi) {
      const nextSelected = !button.classList.contains('is-selected');
      if (button.dataset.value === '还不确定' && nextSelected) {
        group.querySelectorAll('button[data-value]').forEach((item) => {
          const selected = item === button;
          item.classList.toggle('is-selected', selected);
          item.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
      } else {
        group.querySelectorAll('button[data-value="还不确定"]').forEach((item) => {
          item.classList.remove('is-selected');
          item.setAttribute('aria-pressed', 'false');
        });
        button.classList.toggle('is-selected', nextSelected);
        button.setAttribute('aria-pressed', nextSelected ? 'true' : 'false');
      }
      input.value = [...group.querySelectorAll('button.is-selected[data-value]')].map((item)=>item.dataset.value).filter(Boolean).join('、');
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
      return;
    }
    group.querySelectorAll('button[data-value]').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    input.value = button.dataset.value || '';
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
  };
  group.__applyChoice = applyChoice;
  group.querySelectorAll('button[data-value]').forEach((button) => {
    button.setAttribute('aria-pressed', button.classList.contains('is-selected') ? 'true' : 'false');
  });
  const handleChoiceEvent = (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button || !group.contains(button)) return;
    event.preventDefault();
    applyChoice(button);
  };
  group.addEventListener('click', handleChoiceEvent);
  group.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    handleChoiceEvent(event);
  });
}

function initChoiceWriteFallback(){
  if (document.body.dataset.choiceWriteFallbackReady === '1') return;
  document.body.dataset.choiceWriteFallbackReady = '1';
  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('button[data-value]');
    if (!button) return;
    const group = button.closest('[data-customer-platforms],[data-customer-problems],[data-internal-platforms],[data-internal-problems]');
    if (!group) return;
    const form = button.closest('form');
    const inputName = group.matches('[data-customer-platforms],[data-internal-platforms]') ? 'current_channels' : 'biggest_problem';
    const input = form?.querySelector(`[name="${inputName}"]`);
    if (!input) return;
    if (typeof group.__applyChoice === 'function') {
      return;
    }
    const multi = group.dataset.multiSelect === 'true';
    if (multi) {
      const nextSelected = !button.classList.contains('is-selected');
      if (button.dataset.value === '还不确定' && nextSelected) {
        group.querySelectorAll('button[data-value]').forEach((item) => {
          const selected = item === button;
          item.classList.toggle('is-selected', selected);
          item.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
      } else {
        group.querySelectorAll('button[data-value="还不确定"]').forEach((item) => {
          item.classList.remove('is-selected');
          item.setAttribute('aria-pressed', 'false');
        });
        button.classList.toggle('is-selected', nextSelected);
        button.setAttribute('aria-pressed', nextSelected ? 'true' : 'false');
      }
      input.value = [...group.querySelectorAll('button.is-selected[data-value]')].map((item)=>item.dataset.value).filter(Boolean).join('、');
    } else {
      group.querySelectorAll('button[data-value]').forEach((item) => {
        const selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      input.value = button.dataset.value || '';
    }
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new Event('change', {bubbles:true}));
  }, true);
}

function syncChoiceGroupsBeforeSubmit(pairs, formSelector){
  pairs.forEach(([groupSelector, inputName]) => {
    const group = document.querySelector(groupSelector);
    const input = $(`${formSelector} [name="${inputName}"]`);
    const selected = [...(group?.querySelectorAll('button.is-selected[data-value]') || [])].map((item)=>item.dataset.value).filter(Boolean);
    if (input && selected.length) input.value = selected.join('、');
  });
}

function initCustomerChoices(groupSelector, inputName){
  initChoiceWriteFallback();
  initChoiceGroup(groupSelector, '#customerAssessmentForm', inputName);
}

function syncCustomerChoicesBeforeSubmit(){
  syncChoiceGroupsBeforeSubmit([
    ['[data-customer-platforms]', 'current_channels'],
    ['[data-customer-content-mode]', 'content_mode'],
    ['[data-customer-problems]', 'biggest_problem'],
  ], '#customerAssessmentForm');
}

function initInternalChoices(){
  initChoiceWriteFallback();
  initChoiceGroup('[data-internal-platforms]', '#assessmentForm', 'current_channels');
  initChoiceGroup('[data-internal-problems]', '#assessmentForm', 'biggest_problem');
}

function syncInternalChoicesBeforeSubmit(){
  syncChoiceGroupsBeforeSubmit([
    ['[data-internal-platforms]', 'current_channels'],
    ['[data-internal-problems]', 'biggest_problem'],
  ], '#assessmentForm');
}

function customerFallbackPlans(payload){
  const audience = customerPickShort(payload.target_customer, '目标客户');
  const platform = payload.current_channels || '小红书';
  const offer = customerText(payload.offer || customerOfferFromGoal(payload.main_goal, payload.industry));
  const text = `${payload.industry || ''} ${payload.offer || ''} ${payload.store_location || ''} ${payload.course_schedule || ''} ${payload.coach_credentials || ''} ${payload.main_goal || ''} ${payload.customer_pain || ''} ${payload.content_assets || ''}`;
  if (/美甲|甲片|穿戴甲|手部护理/.test(text)) {
    return [
      {platform, topic: `${audience}想做显白美甲，先看这几种款式`, angle:'用真实客照、手型和肤色适配吸引到店预约', content_type:'图文/短视频', cta:'引导客户咨询预约或发手部照片咨询适合款式'},
      {platform, topic:'短甲女生适合什么美甲？这几款不挑手型', angle:'解决怕显手短、怕夸张、怕上班不方便的顾虑', content_type:'图文', cta:'引导客户保存款式，到店前选2-3个参考'},
      {platform, topic:'上班通勤也能做的低调美甲合集', angle:'围绕通勤、约会、拍照、节日前换款场景展示款式', content_type:'短视频/图文', cta:'引导客户预约到店试色或咨询价格套餐'},
    ];
  }
  if (/篮球销售|卖篮球|篮球售卖|篮球零售|篮球专卖|篮球店|篮球用品|篮球器材|篮球装备|篮球商品|训练篮球|比赛篮球/.test(text)) {
    return [
      {platform, topic:'学生买篮球，先看清楚室内球还是室外球', angle:'购买决策：按使用场地、耐磨、手感和预算讲清怎么选篮球', content_type:'图文/短视频', cta:'想买篮球可以咨询使用场地、预算和年龄，先帮你缩小选择'},
      {platform, topic:'篮球运动爱好者怎么选一颗耐磨又好控的球', angle:'产品种草：展示篮球实拍、弹跳、防滑、控球和户外耐磨表现', content_type:'短视频/图文', cta:'保存这条，买篮球前按场地和手感对照选'},
      {platform, topic:'第一次买篮球，别只看颜色和价格', angle:'选择避坑：讲清几号球、材质、气压、重量和适合人群', content_type:'图文', cta:'不确定买几号球，可以咨询身高年龄和主要打球场地'},
    ];
  }
  if (/武术|搏击|散打|拳击|泰拳|跆拳道|格斗|防身术|少儿武术|少儿搏击|武馆|搏击俱乐部|武术搏击/.test(text)) {
    return [
      {platform, topic:'孩子学武术/搏击，家长最该先看哪3点', angle:'讲清安全保护、教练分层和孩子是否适合体验', content_type:'图文/短视频', cta:'引导家长咨询孩子年龄、基础和体验课时间'},
      {platform, topic:'零基础孩子第一次上搏击课，会不会跟不上', angle:'用热身、防护、基础动作和老师反馈降低顾虑', content_type:'图文', cta:'引导家长保存体验课观察清单'},
      {platform, topic:'武术搏击课不是打架，真正训练的是什么', angle:'把课堂价值转成专注力、规则感、体能和自信', content_type:'短视频/图文', cta:'引导家长咨询是否适合孩子性格和基础'},
    ];
  }
  return [
    {platform, topic: `${audience}选择${offer}前，最容易忽略什么？`, angle:'讲清目标客户真实顾虑、服务流程和选择前要注意的细节', content_type:'图文', cta:'引导客户查看主页或咨询具体情况'},
    {platform, topic: `${audience}第一次了解${offer}，先问清这3件事`, angle:'用真实问答降低购买、到店、试听或预约前的决策成本', content_type:'图文', cta:'引导客户保存清单'},
    {platform, topic: `${offer}值不值得选？先看过程、价格和案例`, angle:'把服务过程、案例和价格顾虑讲清楚', content_type:'短视频/图文', cta:'引导客户咨询具体需求'},
  ];
}

function buildCustomerSuggestion(payload, diagnosis, plans){
  const safePlans = (plans && plans.length ? plans : customerFallbackPlans(payload)).slice(0, 3);
  const problem = customerText(payload.biggest_problem);
  const audience = customerText(payload.target_customer || '你的目标客户');
  const business = customerText(payload.industry || '你的业务');
  const goal = customerText(payload.main_goal || '获得更多咨询');
  const selectedPlatform = customerText(payload.current_channels || '');
  const generatedPlatforms = [...new Set(safePlans.map((plan)=>customerText(plan.platform || '')).filter(Boolean))].join('、');
  const platform = selectedPlatform && selectedPlatform !== '还不确定'
    ? selectedPlatform
    : (generatedPlatforms || '系统推荐平台');
  const location = customerText(payload.store_location || '');
  const schedule = customerText(payload.course_schedule || '');
  const coach = customerText(payload.coach_credentials || '');
  const firstPlan = safePlans[0] || customerFallbackPlans(payload)[0];
  const matrixHtml = customerPlatformMatrixHtml(payload, plans);
  const modeHtml = customerContentModeHtml(payload);
  const contextTag = (value = '') => {
    const text = customerText(value);
    return text.length > 28 ? `${text.slice(0, 28)}…` : text;
  };
  const aiContext = [
    ['业务', business],
    ['客户', audience],
    ['平台', platform],
    ['问题', problem],
  ].filter(([, value]) => Boolean(customerText(value)));
  const aiContextHtml = aiContext
    .map(([label, value]) => `<li><span>${esc(label)}</span><strong>${esc(contextTag(value))}</strong></li>`)
    .join('');
  const topics = safePlans.map((plan, index) => `<li><strong>${index + 1}. ${esc(customerText(plan.topic))}</strong><span>${esc(customerText(plan.angle || '用客户听得懂的话讲清服务价值'))}</span></li>`).join('');
  const contentDirection = customerText(diagnosis?.weekly_action || `先围绕「${audience}」最关心的问题，按抖音/小红书/视频号分工连续验证 3 条内容，看看哪一类最容易带来咨询。`);
  const firstSteps = [
    `平台矩阵：${platform}`,
    location ? `门店/上课地址：${location}` : '',
    schedule ? `可预约课程时间：${schedule}` : '',
    coach ? `教练资质/安全保障：${coach}` : '',
    `选题：${customerText(firstPlan.topic)}`,
    `表达角度：${customerText(firstPlan.angle || '先讲客户顾虑，再给判断方法')}`,
    `形式：${customerText(firstPlan.content_type || '图文/短视频')}`,
    `结尾：${customerText(firstPlan.cta || '引导客户咨询具体情况或查看主页咨询')}`,
  ].filter(Boolean);
  customerSuggestionText = [
    `业务：${business}`,
    `目标：${goal}`,
    `当前问题：${problem}`,
    `建议方向：${contentDirection}`,
    '可以马上用的3个选题：',
    ...safePlans.map((plan, index)=>`${index + 1}. ${customerText(plan.topic)} - ${customerText(plan.angle || '')}`),
    '第一条内容怎么发：',
    ...firstSteps,
    '发布后记录：曝光、互动、咨询人数和一句自己的观察。',
  ].join('\n');
  return `
    <section class="customer-ai-context" aria-label="本次内容建议参考信息">
      <div><span>AI 内容策略助手</span><strong>不是套用固定模板，本次建议已结合</strong></div>
      <ul>${aiContextHtml}</ul>
    </section>
    <article class="customer-advice-block">
      <span>1</span>
      <div><h3>你现在最需要解决的问题</h3><p>${esc(problem)}。先不要急着多发，先把内容和「${esc(goal)}」连起来。</p></div>
    </article>
    <article class="customer-advice-block">
      <span>2</span>
      <div><h3>建议优先发的内容方向</h3><p>${esc(contentDirection)}</p></div>
    </article>
    <article class="customer-advice-block">
      <span>3</span>
      <div><h3>平台内容矩阵怎么分工</h3>${modeHtml}${matrixHtml}</div>
    </article>
    <article class="customer-advice-block">
      <span>4</span>
      <div><h3>可以马上用的 3 个选题</h3><ol class="customer-topic-list">${topics}</ol></div>
    </article>
    <article class="customer-advice-block">
      <span>5</span>
      <div><h3>第一条内容怎么发</h3><ul>${firstSteps.map((item)=>`<li>${esc(item)}</li>`).join('')}</ul></div>
    </article>
    <article class="customer-advice-block">
      <span>6</span>
      <div><h3>发布后如何记录效果，方便下次优化</h3><p>发布后只记录曝光、互动、咨询人数和一句观察。下次就能判断：是标题要改，还是内容角度要换。</p></div>
    </article>`;
}

function customerPublishAuditFor(plan = {}, payload = {}){
  if (plan.publish_audit && typeof plan.publish_audit === 'object') return plan.publish_audit;
  const platform = customerText(plan.platform || payload.current_channels || '当前平台');
  const text = [plan.topic, plan.angle, plan.cta, plan.quality_note].map(customerText).join(' ');
  const serviceText = customerText(`${payload.industry || ''} ${payload.main_goal || ''} ${payload.offer || ''}`);
  const checks = [];
  const add = (level, label, message, suggestion) => checks.push({level, label, message, suggestion});
  if (/微信|VX|v信|手机号|电话|二维码|扫码|加我|站外|联系方式|[1][3-9]\d{9}/i.test(text)) {
    add('high', '联系方式/站外导流风险', '可能出现电话、二维码或站外承接表达。', '改成“主页咨询”或“咨询具体情况”，发布前去掉联系方式。');
  }
  if (/最强|最好|第一|唯一|全网|顶级|100%|百分百|一定|保证|包过|包会|立刻|马上见效|永久/.test(text)) {
    add('medium', '绝对化用词风险', '可能出现绝对化或承诺式表达。', '改成“通常、适合、可以先观察、建议对照”。');
  }
  if (/评论区|留言|关键词|领取|暗号|扣\d|回复/.test(text)) {
    add('medium', '互动诱导风险', '可能出现平台容易误判的互动诱导。', '改成“保存这份清单”“主页咨询”“对照这几项判断”。');
  }
  if (/少儿篮球|武术|搏击|散打|教育|培训|体验课/.test(serviceText) && /保证|一定|速成|快速变强|明显提升|长高|升学|包会/.test(text)) {
    add('medium', '培训效果承诺风险', '课程类内容不宜承诺确定结果或速成效果。', '改成课堂过程、适合人群、体验观察和阶段目标。');
  }
  if (platform.includes('小红书')) {
    add('info', '小红书发布前自查', '封面和正文要避免电话、二维码、过大 logo、水印和夸张承诺。', '发布前人工看一遍封面、首图、正文第一段和结尾动作。');
  }
  if (!checks.length) add('info', '发布前自查', '暂未命中明显高风险词。', '仍建议检查标题是否具体、素材是否真实、结尾是否自然。');
  const hasHigh = checks.some((item)=>item.level === 'high');
  const hasMedium = checks.some((item)=>item.level === 'medium');
  const risk_level = hasHigh ? 'high' : hasMedium ? 'medium' : 'low';
  const risk_label = risk_level === 'high' ? '高风险' : risk_level === 'medium' ? '中风险' : '低风险';
  return {
    platform,
    risk_level,
    risk_label,
    summary: risk_level === 'low' ? '低风险：未命中明显高风险表达，发布前仍需人工复核素材。' : `${risk_label}：建议先按提示改文案或封面，再发布。`,
    checks,
    disclaimer: '这是经验规则检查，不代表平台官方审核结果。',
  };
}

function customerReasoningForPlan(plan = {}, payload = {}, index = 0){
  const r = plan.customer_reasoning && typeof plan.customer_reasoning === 'object' ? plan.customer_reasoning : {};
  const merchant = plan.merchant_profile || r.merchant_profile || {};
  const platform = customerText(plan.platform || payload.current_channels || '当前平台');
  const service = customerText(merchant.service_name || payload.offer || customerOfferFromGoal(payload.main_goal, payload.industry));
  const audience = customerText(payload.target_customer || merchant.audience || '目标客户');
  const pain = customerText(payload.customer_pain || payload.biggest_problem || merchant.bottleneck || '当前卡点');
  const observe = Array.isArray(plan.observe_metrics) ? plan.observe_metrics.join('、') : customerText(plan.target_metric || '曝光、收藏、咨询');
  const experiment = customerText(plan.experiment_type || ['痛点型','效果型','信任型','场景型','转化型','异议处理型','复盘型'][index % 7]);
  return [
    ['客户原话依据', r.customer_voice_basis],
    ['客户痛点依据', r.pain_basis || `围绕「${audience}」的「${pain}」展开，不套统一模板。`],
    ['可用证据', r.proof_basis],
    ['平台表达依据', r.platform_basis || plan.why_platform_fit || customerPlatformAngle(platform, plan)],
    ['转化动作依据', r.conversion_basis || `这条内容要把浏览带到「${plan.cta || merchant.conversion_action || '咨询具体情况'}」。`],
    ['本条验证目标', r.validation_goal || `验证「${plan.topic || service}」这个${experiment}是否能带来${observe}信号。`],
    ['数据一般时', r.decision_rule || plan.next_adjustment],
    ['发布前注意', r.publish_note || `发布前补充真实素材，并检查${platform}的敏感词、封面和联系方式规则。`],
  ].filter(([, value]) => customerText(value));
}

function customerPublishAuditHtml(audit = {}){
  const checks = Array.isArray(audit.checks) ? audit.checks : [];
  const badgeClass = audit.risk_level === 'high' ? 'is-risk-high' : audit.risk_level === 'medium' ? 'is-risk-medium' : 'is-risk-low';
  return `<div class="customer-publish-audit ${esc(badgeClass)}">
    <p><strong>发布前检查：</strong><span class="plan-platform-pill">${esc(audit.risk_label || '低风险')}</span> ${esc(audit.summary || '发布前人工复核。')}</p>
    ${checks.length ? `<ul>${checks.slice(0, 4).map((item)=>`<li><b>${esc(item.label || '检查项')}</b>：${esc(item.message || '')}${item.suggestion ? ` <span>${esc(item.suggestion)}</span>` : ''}</li>`).join('')}</ul>` : ''}
    <em>${esc(audit.disclaimer || '经验规则检查，不代表平台官方审核结果。')}</em>
  </div>`;
}

function buildCustomerPlanList(payload, plans){
  const safePlans = (plans && plans.length ? plans : customerFallbackPlans(payload)).slice(0, 7);
  const saved = loadCustomerTrialState();
  const recordedPlanIds = new Set((Array.isArray(saved.records) ? saved.records : [])
    .map((record)=>String(record.content_plan_id || '').trim())
    .filter(Boolean));
  const cards = safePlans.map((plan, index) => {
    const planId = planIdValue(plan) || String(index + 1);
    const day = `第${index + 1}天`;
    const platform = customerText(plan.platform || payload.current_channels || '抖音、小红书、视频号');
    const contentType = customerText(plan.content_type || '图文/短视频');
    const topic = customerText(plan.topic || plan.title || '下一条内容选题');
    const angle = customerText(plan.angle || customerPlatformAngle(platform, plan) || '用客户听得懂的话说清服务价值');
    const cta = customerText(plan.cta || '引导客户咨询具体情况或主页咨询');
    const experiment = customerText(plan.experiment_type || ['痛点型','效果型','信任型','场景型','转化型','异议处理型','复盘型'][index % 7]);
    const whyPlatform = customerText(plan.why_platform_fit || customerPlatformAngle(platform, plan));
    const observe = Array.isArray(plan.observe_metrics) ? plan.observe_metrics.join(' / ') : customerText(plan.target_metric || '曝光/播放 / 收藏 / 咨询');
    const nextAdjustment = customerText(plan.next_adjustment || '数据不好时，下一条先换标题/开头，再补真实证据和咨询入口。');
    const recorded = recordedPlanIds.has(String(planId).trim());
    const reasoning = customerReasoningForPlan(plan, payload, index);
    const audit = customerPublishAuditFor(plan, payload);
    return `<article class="customer-plan-item customer-plan-lite${recorded ? ' is-recorded' : ''}" data-customer-plan-id="${esc(planId)}">
      <div class="plan-lite-main">
        <span class="plan-day-pill" aria-label="${esc(day)}">${esc(index + 1)}</span>
        <div class="plan-lite-copy">
          <p class="plan-topic">${esc(topic)}</p>
          <p class="plan-angle">${esc(angle)}</p>
        </div>
        <span class="plan-platform-pill">${esc(platform)}</span>
      </div>
      <details class="plan-lite-reason">
        <summary>为什么这样发</summary>
        <div class="plan-lite-reason-body">
          <p><strong>角度：</strong>${esc(angle)}</p>
          ${reasoning.map(([label, value])=>`<p><strong>${esc(label)}：</strong>${esc(value)}</p>`).join('')}
          <p><strong>形式：</strong>${esc(contentType)} · ${esc(experiment)}</p>
          <p><strong>看什么：</strong>${esc(observe)}</p>
          <p><strong>如果数据一般：</strong>${esc(nextAdjustment)}</p>
          <p><strong>结尾：</strong>${esc(cta)}</p>
          ${customerPublishAuditHtml(audit)}
        </div>
      </details>
      <button class="customer-plan-select" type="button" data-customer-record-plan="${esc(planId)}">${recorded ? '已记录，继续补充' : '这条发完了，去记录效果'}</button>
    </article>`;
  });
  const visibleCards = cards.slice(0, 3).join('');
  const remainingCards = cards.slice(3).join('');
  return remainingCards
    ? `${visibleCards}<details class="customer-plan-more"><summary>查看全部 ${safePlans.length} 天 →</summary><div class="customer-plan-more-list">${remainingCards}</div></details>`
    : visibleCards;
}

function customerPlans(saved = {}){
  return Array.isArray(saved.plans) ? saved.plans : (Array.isArray(clientState.plans) ? clientState.plans : []);
}

function customerPlanById(saved = {}, planId = ''){
  const id = String(planId || '').trim();
  return customerPlans(saved).find((plan)=>samePlanId(planIdValue(plan), id) || samePlanId(plan.id, id)) || null;
}

function customerPlanLabel(plan = {}, fallback = ''){
  const topic = customerText(plan.topic || fallback || '已选择内容计划');
  const day = plan.planned_date ? ` · ${plan.planned_date}` : '';
  return `${topic}${day}`;
}

function customerPlanDisplayNumber(saved = {}, planOrId = ''){
  const id = planIdValue(planOrId);
  const index = customerPlans(saved).findIndex((plan)=>samePlanId(planIdValue(plan), id) || samePlanId(plan.id, id));
  return index >= 0 ? index + 1 : '';
}

function customerActiveRound(saved = {}){
  const raw = Number(saved.active_round || saved.current_round || 1);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 1;
}

const CUSTOMER_NEXT_ROUND_MIN_RECORDS = 3;
const CUSTOMER_NEXT_ROUND_TARGET_RECORDS = 7;

function customerRoundRecordCount(saved = {}){
  const records = Array.isArray(saved.records) ? saved.records : [];
  const uniquePlanIds = new Set();
  records.forEach((record)=>{
    const id = String(record.content_plan_id || '').trim();
    if (id) uniquePlanIds.add(id);
  });
  return uniquePlanIds.size || records.length;
}

function customerNextRoundReadiness(saved = {}){
  const count = customerRoundRecordCount(saved);
  const planCount = customerPlans(saved).length || CUSTOMER_NEXT_ROUND_TARGET_RECORDS;
  const target = Math.max(1, Math.min(CUSTOMER_NEXT_ROUND_TARGET_RECORDS, planCount));
  const minRequired = Math.max(1, Math.min(CUSTOMER_NEXT_ROUND_MIN_RECORDS, target));
  return {
    count,
    target,
    minRequired,
    canActivate: count >= minRequired,
    isComplete: count >= target,
    remainingToStage: Math.max(0, minRequired - count),
  };
}

function customerRecordKey(record = {}){
  return String(record.record_id || record.created_at || `${record.content_plan_id || ''}:${record.plan_topic || ''}`).trim();
}

function customerArchivedPlanTopics(saved = {}){
  const rounds = Array.isArray(saved.content_rounds) ? saved.content_rounds : [];
  return rounds.flatMap((round)=>Array.isArray(round.plans) ? round.plans.map((plan)=>plan.topic).filter(Boolean) : []);
}

function nextRoundRowsFromRecord(saved = {}, record = {}){
  const ai = record.daily_advice || record.ai_advice || null;
  const advice = ai?.advice || buildCustomerNextAdvice(saved, record);
  const nextRound = ai?.next_round || (ai?.next_7_day_plan?.length ? {next_7_day_plan: ai.next_7_day_plan, review_judgment: ai.review_judgment, customer_summary: ai.customer_summary} : buildCustomerNextRoundPlan(saved, record, advice));
  return {advice, nextRound, rows: Array.isArray(nextRound.next_7_day_plan) ? nextRound.next_7_day_plan.slice(0, 7) : []};
}

function buildCustomerPlansForNextRound(saved = {}, latest = {}, nextRound = {}){
  const nextRoundNumber = customerActiveRound(saved) + 1;
  const rows = Array.isArray(nextRound.next_7_day_plan) ? nextRound.next_7_day_plan.slice(0, 7) : [];
  const token = customerRecordKey(latest).replace(/[^a-z0-9]+/gi, '').slice(-8) || Date.now().toString(36);
  return rows.map((row, index)=>({
    ...row,
    id: `round-${nextRoundNumber}-day-${index + 1}-${token}`,
    round_number: nextRoundNumber,
    source_round_number: customerActiveRound(saved),
    source_content_plan_id: latest.content_plan_id || '',
    day_index: index + 1,
    planned_date: row.planned_date || row.date || nextSevenDate(index + 1),
    topic: customerText(row.topic || row.title || `第${index + 1}天内容选题`),
    angle: customerText(row.angle || row.action || '围绕反馈数据调整表达角度'),
    platform: customerText(row.platform || saved.assessment?.current_channels || '小红书'),
    content_type: customerText(row.content_type || '图文/短视频'),
    cta: customerText(row.cta || '引导客户咨询具体情况'),
    status: '待发布',
    publish_link: '',
  }));
}

function customerRoundTopicItems(plans = []){
  const topics = (Array.isArray(plans) ? plans : [])
    .map((plan)=>customerText(plan.topic || plan.title || ''))
    .filter(Boolean)
    .slice(0, 3);
  if (!topics.length) return '<li>暂无选题摘要</li>';
  return topics.map((topic)=>`<li>${esc(topic)}</li>`).join('');
}

function customerRoundStatus(saved = {}, round = {}, isCurrent = false){
  if (isCurrent) {
    const records = Array.isArray(saved.records) ? saved.records : [];
    return records.length ? `已记录 ${records.length} 条效果` : '进行中';
  }
  const archived = round.archived_at ? `归档于 ${String(round.archived_at).slice(0, 16)}` : '已归档';
  const plans = Array.isArray(round.plans) ? round.plans : [];
  return `${archived} · ${plans.length || 0} 条计划`;
}

function renderCustomerRoundHistory(saved = {}){
  const box = $('#customerRoundHistory');
  const list = $('#customerRoundHistoryList');
  if (!box || !list) return;
  const rounds = Array.isArray(saved.content_rounds) ? saved.content_rounds : [];
  const activeRound = customerActiveRound(saved);
  const currentPlans = customerPlans(saved);
  if (activeRound <= 1 && !rounds.length) {
    box.hidden = true;
    list.innerHTML = '';
    return;
  }
  box.hidden = false;
  const summary = box.querySelector('summary');
  if (summary) summary.textContent = `查看历史内容周期（当前第 ${activeRound} 轮）`;
  const currentCard = `<article class="customer-round-card is-current">
    <div><span>当前周期</span><strong>第 ${esc(activeRound)} 轮</strong></div>
    <p>${esc(customerRoundStatus(saved, {}, true))}</p>
    <ol>${customerRoundTopicItems(currentPlans)}</ol>
  </article>`;
  const archivedCards = [...rounds].reverse().slice(0, 6).map((round)=>`<article class="customer-round-card">
    <div><span>历史周期</span><strong>第 ${esc(round.round_number || '')} 轮</strong></div>
    <p>${esc(customerRoundStatus(saved, round, false))}</p>
    <ol>${customerRoundTopicItems(round.plans)}</ol>
  </article>`).join('');
  list.innerHTML = `<div class="customer-round-grid">${currentCard}${archivedCards}</div>`;
}

function updateCustomerSelectedPlanDisplay(saved = {}){
  const input = $('#customerEffectForm [name=content_plan_id]');
  const box = $('#customerSelectedPlan');
  if (!input || !box) return;
  const plan = customerPlanById(saved, input.value || saved.selected_plan_id);
  if (!plan) {
    input.value = '';
    box.dataset.empty = 'true';
    box.textContent = '先从上方内容计划中选择你实际发布的那一条，再保存数据。';
    $$('#customerPlanList [data-customer-plan-id]').forEach((item)=>item.classList.remove('is-selected'));
    return;
  }
  const planId = planIdValue(plan);
  const displayNumber = customerPlanDisplayNumber(saved, plan);
  input.value = planId;
  box.dataset.empty = 'false';
  box.textContent = `已选择：${displayNumber ? `第${displayNumber}天 · ` : ''}${customerPlanLabel(plan)}`;
  $$('#customerPlanList [data-customer-plan-id]').forEach((item)=>{
    item.classList.toggle('is-selected', samePlanId(item.dataset.customerPlanId, planId));
  });
}

function selectCustomerEffectPlan(planId){
  const current = customerStateWithLiveGenerated(loadCustomerTrialState());
  const plan = customerPlanById(current, planId);
  if (!plan) {
    setCustomerMessage('#customerEffectMessage', '没有找到这条内容计划，请先重新生成内容建议。', 'error');
    return;
  }
  const selectedState = { ...current, selected_plan_id: planIdValue(plan), updated_at: localTimestamp() };
  saveCustomerTrialState(selectedState);
  updateCustomerSelectedPlanDisplay(selectedState);
  setCustomerStep('record', {state: selectedState, focus: true});
  window.setTimeout(()=>$('#customerEffectForm [name=views]')?.focus(), 140);
  const displayNumber = customerPlanDisplayNumber(current, plan);
  setCustomerMessage('#customerEffectMessage', `已选择${displayNumber ? `第${displayNumber}天` : '这条内容'}。填曝光、互动、咨询这几个数就可以。`);
}

function renderCustomerEffects(savedState = null){
  const box = $('#customerEffectList');
  if (!box) return;
  const saved = savedState || loadCustomerTrialState();
  const records = Array.isArray(saved.records) ? saved.records : [];
  if (!records.length) {
    box.innerHTML = '<div class="customer-record empty">还没有记录。发完第一条内容后，填一次曝光、互动、咨询和一句观察即可。</div>';
    return;
  }
  box.innerHTML = records.slice(0, 5).map((item)=>{
    const nums = customerRecordNumbers(item);
    const tags = String(item.observation_tags || '').trim();
    return `<div class="customer-record">
    <strong>${esc(item.plan_topic || item.published_at || item.created_at || '已记录')}</strong>
    <span>曝光 ${esc(nums.views)} · 互动 ${esc(nums.engagement)} · 咨询 ${esc(nums.consultations)}</span>
    ${tags ? `<em>${esc(tags)}</em>` : ''}
    <p>${esc(item.notes || '未填写观察')}</p>
  </div>`;}).join('');
}

function customerRecordNumbers(record = {}){
  const likes = Number(record.likes || 0);
  const favorites = Number(record.favorites || 0);
  const comments = Number(record.comments || 0);
  const shares = Number(record.shares || 0);
  return {
    views: playbackValue(record),
    backend_views: playbackValue(record),
    likes,
    favorites,
    comments,
    shares,
    engagement: Number(record.engagement || (likes + favorites + comments + shares) || 0),
    consultations: Number(record.consultations || 0),
    appointments: Number(record.appointments || 0),
  };
}

function rateLabel(part, total){
  const t = Number(total || 0);
  if (!t) return '样本不足';
  return `${((Number(part || 0) / t) * 100).toFixed(Number(part || 0) ? 1 : 0)}%`;
}

function customerRecordLevel({views, engagement, consultations, appointments}){
  if (consultations > 0 || appointments > 0) return {label:'已有咨询/预约信号', desc:'优先复制同类主题，再补充案例、过程、价格或周期问题。'};
  if (views >= 800 && engagement >= 30) return {label:'有兴趣但承接弱', desc:'下一条重点补信任证据和明确咨询理由，不要只换标题。'};
  if (views >= 800) return {label:'有曝光但互动弱', desc:'标题能带来浏览，但内容没有让客户觉得“和我有关”。'};
  return {label:'样本偏小', desc:'先优化标题、封面和开头钩子，把曝光样本做大。'};
}

function renderCustomerRecordSummary(saved = {}){
  const box = $('#customerRecordSummary');
  if (!box) return;
  const records = Array.isArray(saved.records) ? saved.records : [];
  const latest = records[0];
  if (!latest) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const nums = customerRecordNumbers(latest);
  const level = customerRecordLevel(nums);
  box.hidden = false;
  box.innerHTML = `<p class="customer-loop-kicker">本条内容结果</p>
    <h3>${esc(level.label)}</h3>
    <div class="customer-result-metrics">
      <span>播放量 <strong>${esc(nums.views)}</strong></span>
      <span>点赞 <strong>${esc(nums.likes)}</strong></span>
      <span>咨询 <strong>${esc(nums.consultations)}</strong></span>
      <span>咨询率 <strong>${esc(rateLabel(nums.consultations, nums.views))}</strong></span>
    </div>
    <p>${esc(level.desc)}</p>`;
}

function buildCustomerNextAdvice(saved = {}, record = {}){
  const assessment = saved.assessment || {};
  const diagnosis = saved.diagnosis || {};
  const plans = Array.isArray(saved.plans) ? saved.plans : [];
  const selectedPlan = customerPlanById(saved, record.content_plan_id || saved.selected_plan_id);
  const history = (Array.isArray(saved.records) ? saved.records : []).filter((item)=>item !== record);
  const selectedPlanId = planIdValue(selectedPlan || {id: record.content_plan_id || saved.selected_plan_id});
  const selectedIndex = plans.findIndex((plan)=>samePlanId(planIdValue(plan), selectedPlanId));
  const completedPlanIds = new Set([record.content_plan_id, saved.selected_plan_id, ...history.map((item)=>item.content_plan_id)].map((id)=>String(id || '').trim()).filter(Boolean));
  const unpublished = plans
    .filter((plan, index)=>selectedIndex < 0 || index > selectedIndex)
    .filter((plan)=>!String(plan.status || '').includes('已发布') && !plan.publish_link && !completedPlanIds.has(String(planIdValue(plan) || '').trim()));
  const {views, engagement, consultations} = customerRecordNumbers(record);
  const offer = customerText(assessment.offer || customerOfferFromGoal(assessment.main_goal, assessment.industry));
  const rawAudience = customerText(assessment.target_customer || '目标客户');
  const audience = /宝妈|产后/.test(rawAudience) ? '宝妈' : rawAudience.replace(/[，,、].*$/, '').slice(0, 18) || '目标客户';
  const goal = customerText(assessment.main_goal || '获得更多咨询');
  const problem = customerText(assessment.biggest_problem || diagnosis.priority_problem || '当前问题');
  const todayTopic = customerText(selectedPlan?.topic || record.plan_topic || `${audience}最关心的${offer}问题`);
  const nextPlanTopic = customerText(unpublished[0]?.topic || '');
  const nextTopicBase = offer && offer !== '相关服务' ? offer : todayTopic;
  const historySignal = history.length ? `已参考前 ${history.length} 条回填记录，避免只看单日波动。` : '这是第一条回填记录，先用当天数据做小样本判断。';
  let judgment = '样本已开始回流，下一条先不要换平台，优先根据这条内容的数据改表达角度。';
  let nextTopic = nextPlanTopic || `${audience}为什么迟迟不咨询${nextTopicBase}？先看这3个顾虑`;
  let action = `今天回填绑定的是「${todayTopic}」。下一条继续围绕「${nextTopicBase}」发，但把开头改成客户真实顾虑，结尾承接到「${goal}」。`;
  if (consultations > 0) {
    judgment = `「${todayTopic}」已经带来 ${consultations} 个咨询，说明这个内容角度有效，下一步不是推倒重来，而是复制同类角度。`;
    nextTopic = nextPlanTopic || `咨询过的人最常问：${nextTopicBase}到底适不适合我？`;
    action = `复制「${todayTopic}」的痛点结构，下一条补充案例/过程/价格或周期疑问，并保留主页咨询或咨询入口。`;
  } else if (views >= 800 && engagement >= 30) {
    judgment = `「${todayTopic}」有曝光和收藏/点赞，但还没有咨询，说明“感兴趣”到“愿意问”之间缺少信任或承接。`;
    nextTopic = `${audience}收藏了但不咨询，通常卡在${nextTopicBase}的哪3个顾虑？`;
    action = '下一条重点回答价格、效果、周期、适合人群这类决策问题，结尾不要只说欢迎咨询，要给一个具体咨询理由。';
  } else if (views >= 800) {
    judgment = `「${todayTopic}」曝光不低但互动和咨询弱，说明标题/封面可能吸引到了人，但正文没有把「${problem}」讲到客户心里。`;
    nextTopic = `${audience}遇到「${problem}」时，最容易误解哪件事？`;
    action = '下一条减少服务介绍，改成“客户误区/真实问题/避坑清单”，先提高收藏和咨询意愿。';
  } else {
    judgment = '当前曝光样本还偏小，暂时不能判断内容方向失败，先优化标题、封面和开头钩子。';
    nextTopic = `${audience}看到这个标题，会不会立刻想到自己？`;
    action = `下一条把标题第一句话改得更具体：人群 + 痛点 + ${nextTopicBase}，先把曝光样本做大。`;
  }
  return {judgment, nextTopic, action, selected_plan_topic: todayTopic, history_signal: historySignal, unpublished_count: unpublished.length};
}

function customerTopicKey(value = ''){
  return customerText(value).toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]+/g, '');
}

function uniqueCustomerTopics(candidates = [], forbidden = []){
  const used = new Set(forbidden.map(customerTopicKey).filter(Boolean));
  const rows = [];
  candidates.forEach((candidate)=>{
    const text = customerText(candidate);
    const key = customerTopicKey(text);
    if (!text || !key || used.has(key)) return;
    used.add(key);
    rows.push(text);
  });
  return rows;
}

function customerNextRoundTopicPool({assessment = {}, selectedPlan = {}, type = '标题问题'} = {}){
  const source = customerText(`${assessment.industry || ''} ${assessment.main_goal || ''} ${assessment.offer || ''}`);
  const audience = customerText(assessment.target_customer || '目标客户').replace(/[，,、].*$/, '').slice(0, 18) || '目标客户';
  const offer = customerText(assessment.offer || customerOfferFromGoal(assessment.main_goal, assessment.industry));
  const selectedTopic = customerText(selectedPlan.topic || '本次发布内容');
  if (/武术|搏击|散打|拳击|泰拳|跆拳道|格斗|防身术|少儿武术|少儿搏击|武馆|搏击俱乐部|武术搏击/.test(source)) {
    if (type === '加码') {
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
    if (type === '换角度') {
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
  if (/少儿篮球|小学生篮球|幼儿篮球|青少年篮球|篮球培训|篮球训练|篮球启蒙|篮球课|运球|投篮/.test(source)) {
    if (type === '加码') {
      return [
        '家长问体验课前，最想确认孩子能不能跟上',
        '零基础孩子上少儿篮球课，第一节会练什么',
        '为什么体能提升，比投篮准更先被家长看见',
        '周末班怎么安排，孩子不累还能坚持',
        '6-12岁孩子报名篮球课，家长最该看哪3点',
        '体验课后要不要继续报班，看这几个课堂信号',
        '家长担心安全和强度，少儿篮球课怎么处理',
        '孩子不爱运动，篮球启蒙先从哪一步开始',
      ];
    }
    if (type === '换角度') {
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
  if (type === '加码') {
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
  if (type === '换角度') {
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
}

function buildCustomerNextRoundPlan(saved = {}, record = {}, advice = {}){
  const assessment = saved.assessment || {};
  const plans = Array.isArray(saved.plans) ? saved.plans : [];
  const selectedPlan = customerPlanById(saved, record.content_plan_id || saved.selected_plan_id);
  const selectedPlanId = planIdValue(selectedPlan || {id: record.content_plan_id || saved.selected_plan_id});
  const selectedIndex = plans.findIndex((plan)=>samePlanId(planIdValue(plan), selectedPlanId));
  const completed = new Set([record.content_plan_id, saved.selected_plan_id, ...(saved.records || []).map((item)=>item.content_plan_id)].map((id)=>String(id || '').trim()).filter(Boolean));
  const platformSeeds = plans
    .filter((plan, index)=>selectedIndex < 0 || index > selectedIndex)
    .filter((plan)=>!completed.has(String(planIdValue(plan) || '').trim()))
    .map((plan)=>plan.platform)
    .filter(Boolean);
  const nums = customerRecordNumbers(record);
  const audience = customerText(assessment.target_customer || '目标客户').replace(/[，,、].*$/, '').slice(0, 18) || '目标客户';
  const offer = customerText(assessment.offer || customerOfferFromGoal(assessment.main_goal, assessment.industry));
  let type = '标题问题';
  let more = '更具体的人群痛点、真实证据和决策问题';
  let less = '泛泛介绍服务、只说欢迎咨询';
  let why = '当前样本还需要先扩大曝光和互动样本。';
  if (nums.consultations > 0 || nums.appointments > 0) {
    type = '加码';
    more = '复制带来咨询/预约的主题结构，连续补案例、过程、价格和适合人群';
    less = '完全换平台或换成泛科普';
    why = '这条内容已经出现咨询或预约信号，说明角度有效。';
  } else if (nums.views >= 800 && nums.engagement >= 30) {
    type = '换角度';
    more = '把点赞收藏兴趣转成信任承接，补真实过程和常见顾虑';
    less = '只追热点标题、不回答客户为什么现在要问';
    why = '有曝光和互动但没有咨询，缺口在信任和行动理由。';
  } else if (nums.views >= 800) {
    type = '标题问题';
    more = '围绕客户第一眼能懂的痛点重写标题和开头';
    less = '抽象行业词和服务清单';
    why = '曝光不低但互动弱，说明打开后没有击中决策问题。';
  }
  const decision = type === '加码'
    ? '加码'
    : type === '换角度'
      ? '改角度'
      : nums.views === 0 && nums.engagement === 0 && nums.consultations === 0
        ? '暂停原表达，重写标题/开头'
        : '继续小样本验证';
  const actions = type === '加码'
    ? ['复制有效结构', '补充案例证据', '回答价格/周期', '展示过程细节', '处理适合人群', '集中答疑', '复盘最高咨询主题']
    : type === '换角度'
      ? ['补信任证据', '拆客户顾虑', '讲真实场景', '补对比清单', '强调行动理由', '承接咨询问题', '复盘收藏原因']
      : ['重写标题', '强化第一句话', '换客户视角', '减少服务堆叠', '加入具体问题', '增加证据', '复盘点击原因'];
  const forbiddenTopics = [
    ...plans.map((plan)=>plan.topic),
    selectedPlan?.topic,
    record.plan_topic,
    ...(saved.records || []).map((item)=>item.plan_topic),
  ].filter(Boolean);
  const generatedTopics = uniqueCustomerTopics([
    advice.nextTopic,
    ...customerNextRoundTopicPool({assessment, selectedPlan, type}),
  ], forbiddenTopics);
  const fallbackTopics = uniqueCustomerTopics(Array.from({length: 10}, (_, index)=>`${audience}下周第${index + 1}个${offer}决策问题`), forbiddenTopics.concat(generatedTopics));
  const seedTopics = [...generatedTopics, ...fallbackTopics].slice(0, 7);
  const ctaSource = customerText(`${assessment.industry || ''} ${assessment.main_goal || ''} ${assessment.offer || ''}`);
  const ctaText = /少儿篮球|小学生篮球|幼儿篮球|青少年篮球|篮球培训|篮球训练|篮球启蒙|篮球课|运球|投篮/.test(ctaSource)
    ? '引导家长咨询孩子年龄和体验课时间'
    : /武术|搏击|散打|拳击|泰拳|跆拳道|格斗|防身术|少儿武术|少儿搏击|武馆|搏击俱乐部|武术搏击/.test(ctaSource)
      ? '引导家长咨询孩子年龄、基础和体验课时间'
      : '引导客户咨询是否适合';
  const rows = Array.from({length: 7}, (_, index)=>{
    const topic = seedTopics[index] || (audience + '关心的' + offer + '问题');
    const platform = platformSeeds[index % Math.max(platformSeeds.length, 1)] || selectedPlan?.platform || '小红书/视频号';
    const experimentType = ['痛点型','效果型','信任型','场景型','转化型','异议处理型','复盘型'][index % 7];
    const rowBase = {
      topic,
      angle: actions[index],
      platform,
      cta: ctaText,
      experiment_type: experimentType,
      observe_metrics: platform === '抖音' ? ['播放完成率','主页访问','咨询','预约'] : platform === '小红书' ? ['曝光','收藏','评论提问','咨询'] : ['播放','转发','咨询','预约'],
      target_metric: nums.consultations > 0 || nums.appointments > 0 ? '咨询/预约' : (nums.views >= 800 ? '收藏/咨询' : '曝光/播放'),
    };
    return {
      day: 'Day ' + (index + 1),
      planned_date: nextSevenDate(index + 1),
      topic,
      angle: actions[index],
      platform,
      experiment_type: experimentType,
      action: actions[index],
      reason: index === 0 ? ('承接本次回填判断：' + type) : '延续同一轮复盘结论，避免每天推倒重来。',
      target_metric: rowBase.target_metric,
      based_on: selectedPlan?.topic || record.plan_topic || '',
      cta: ctaText,
      why_platform_fit: customerPlatformAngle(platform, {topic, angle: actions[index]}),
      observe_metrics: rowBase.observe_metrics,
      next_adjustment: nums.consultations > 0 || nums.appointments > 0 ? '继续补案例、价格/周期和适合人群。' : '先换标题/开头，再补真实证据和咨询入口。',
      merchant_profile: {
        service_name: offer,
        audience: assessment.target_customer || audience,
        bottleneck: assessment.biggest_problem || type,
        conversion_action: ctaText,
      },
      customer_reasoning: Object.fromEntries(customerReasoningForPlan(rowBase, assessment, index).map(([label, value]) => {
        const key = label === '客户痛点依据' ? 'pain_basis' : label === '平台表达依据' ? 'platform_basis' : label === '转化动作依据' ? 'conversion_basis' : label === '本条验证目标' ? 'validation_goal' : 'publish_note';
        return [key, value];
      })),
      publish_audit: customerPublishAuditFor(rowBase, assessment),
    };
  });
  return {
    review_judgment: {type, decision, more, less, why},
    customer_summary: '判断：' + decision + '。下周多发：' + more + '；少发：' + less + '。原因：' + why,
    next_7_day_plan: rows,
    source: 'local_rule',
  };
}

function customerAdviceModelLine(meta = {}){
  const requested = meta.requested_model || '未配置';
  const actual = meta.actual_model || 'rule_template';
  const suffix = meta.fallback ? `，fallback：${meta.failure_reason || '模型调用失败'}` : '';
  return `${meta.provider || 'local'} / requested=${requested} / actual=${actual}${suffix}`;
}

function renderCustomerNextAdvice(saved = {}){
  const box = $('#customerNextAdvice');
  if (!box) return;
  const records = Array.isArray(saved.records) ? saved.records : [];
  const latest = records[0];
  if (!latest) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const ai = latest.daily_advice || latest.ai_advice || null;
  const {advice, nextRound, rows} = nextRoundRowsFromRecord(saved, latest);
  const review = nextRound.review_judgment || {};
  box.hidden = false;
  const nums = customerRecordNumbers(latest);
  const selectedPlan = customerPlanById(saved, latest.content_plan_id || saved.selected_plan_id);
  const firstRows = rows.slice(0, 3);
  const actions = [
    review.more ? `多发：${review.more}` : (advice.action || '下一条先延续当前有效角度'),
    advice.nextTopic ? `下一条先发：${advice.nextTopic}` : (firstRows[0]?.topic ? `下一条先发：${firstRows[0].topic}` : '下一条先换一个更具体的标题'),
    review.less ? `少发：${review.less}` : '少发泛泛服务介绍，改成客户真实问题',
  ].filter(Boolean).slice(0, 3);
  const fallbackActions = firstRows.map((row)=>row.action || row.angle || row.topic).filter(Boolean).slice(0, 3);
  const actionList = (actions.length >= 3 ? actions : [...actions, ...fallbackActions]).slice(0, 3);
  const latestKey = customerRecordKey(latest);
  const alreadyActivated = saved.activated_next_round_from === latestKey;
  const nextRoundNumber = customerActiveRound(saved) + 1;
  const readiness = customerNextRoundReadiness(saved);
  const activateHtml = rows.length && readiness.canActivate
    ? `<button class="customer-secondary customer-next-round-btn" type="button" data-customer-activate-round="${esc(latestKey)}" ${alreadyActivated ? 'disabled' : ''}>${alreadyActivated ? `已进入第 ${customerActiveRound(saved)} 轮` : `结束本轮，使用第 ${nextRoundNumber} 轮内容计划`}</button>`
    : '';
  const phaseTitle = readiness.canActivate ? '阶段性下一轮建议' : '本条内容优化建议';
  const phaseSummary = readiness.canActivate
    ? (nextRound.customer_summary || advice.judgment || '已结合多条内容数据，可以判断下一轮方向。')
    : (advice.judgment || '先根据这条内容的数据，调整下一条内容角度。');
  const gateHint = readiness.canActivate
    ? `已记录 ${readiness.count}/${readiness.target} 条内容效果，可以选择结束本轮并使用第 ${nextRoundNumber} 轮计划；也可以继续补齐本轮剩余数据。`
    : `已记录 ${readiness.count}/${readiness.target} 条内容效果。现在先看本条怎么改；再记录 ${readiness.remainingToStage} 条不同内容，就能解锁更准的下一轮建议。`;
  box.innerHTML = `<p class="customer-loop-kicker">${esc(phaseTitle)}</p>
    <h3>${esc(phaseSummary)}</h3>
    <ul class="customer-next-actions">
      ${actionList.map((item)=>`<li><span aria-hidden="true">✓</span>${esc(item)}</li>`).join('')}
    </ul>
    <p class="customer-next-gate">${esc(gateHint)}</p>
    ${activateHtml}
    <button class="customer-primary customer-next-continue" type="button" data-customer-continue>回到内容计划，发下一条 →</button>
    <details class="customer-next-evidence">
      <summary>查看判断依据</summary>
      <p>发布数据：播放量 ${esc(nums.views)}，点赞 ${esc(nums.likes)}，咨询 ${esc(nums.consultations)}。</p>
      <p>本次内容：${esc(selectedPlan?.topic || latest.plan_topic || '已发布内容')}。</p>
      <p>${esc(advice.history_signal || '已结合当天内容和当天数据判断。')}</p>
    </details>`;
}

async function requestCustomerDailyAdvice(saved = {}, record = {}){
  const requestId = customerTrackingEventId('advice', customerRecordKey(record) || record.created_at || record.content_plan_id || 'record');
  return api('/api/customer-growth-advice', {
    method:'POST',
    body: JSON.stringify({
      request_id: requestId,
      client_id: customerClientId(),
      settings_client_id: userSettingsClientId(),
      personalized_recommendation_enabled: personalizedRecommendationEnabled(),
      assessment: saved.assessment || clientState.assessment || {},
      diagnosis: saved.diagnosis || clientState.diagnosis || {},
      plans: customerPlans(saved),
      previous_rounds: Array.isArray(saved.content_rounds) ? saved.content_rounds : [],
      previous_plan_topics: customerArchivedPlanTopics(saved),
      records: Array.isArray(saved.records) ? saved.records : [],
      record,
      selected_plan_id: record.content_plan_id || saved.selected_plan_id || '',
    }),
  });
}

function activateCustomerNextRound(){
  const current = loadCustomerTrialState();
  const latest = Array.isArray(current.records) ? current.records[0] : null;
  if (!latest) {
    setCustomerMessage('#customerEffectMessage', '请先记录一条发布效果，再进入下一轮计划。', 'error');
    return;
  }
  const readiness = customerNextRoundReadiness(current);
  if (!readiness.canActivate) {
    setCustomerMessage('#customerEffectMessage', `当前已记录 ${readiness.count}/${readiness.target} 条内容效果。再记录 ${readiness.remainingToStage} 条不同内容，就能解锁更准的下一轮建议。`, 'error');
    return;
  }
  const {nextRound, rows} = nextRoundRowsFromRecord(current, latest);
  if (!rows.length) {
    setCustomerMessage('#customerEffectMessage', '还没有可用的下一轮计划，请先保存一次发布效果。', 'error');
    return;
  }
  const nextPlans = buildCustomerPlansForNextRound(current, latest, nextRound);
  const roundNumber = customerActiveRound(current);
  const archivedRound = {
    round_number: roundNumber,
    plans: customerPlans(current),
    archived_at: localTimestamp(),
    trigger_record: customerRecordKey(latest),
  };
  const contentRounds = [...(Array.isArray(current.content_rounds) ? current.content_rounds : []), archivedRound].slice(-8);
  const nextState = {
    ...current,
    plans: nextPlans,
    active_round: roundNumber + 1,
    current_round: roundNumber + 1,
    content_rounds: contentRounds,
    selected_plan_id: '',
    activated_next_round_from: customerRecordKey(latest),
    latest_next_round: nextRound,
    updated_at: localTimestamp(),
  };
  saveCustomerTrialState(nextState);
  trackCustomerEvent('next_round_entered', {source:'customer_public', round_number:roundNumber + 1}, `next-round-${roundNumber + 1}-${customerRecordKey(latest)}`);
  scheduleCustomerTrialCloudSync(nextState);
  if (clientState?.plans) {
    clientState.plans = nextPlans;
    clientState.feedback = [];
    clientState.current_cycle_id = `customer-round-${roundNumber + 1}`;
    saveLocal();
  }
  renderCustomerGeneratedState(nextState, {focus: true, step: 'plan'});
  renderCustomerEffects(nextState);
  renderCustomerRecordSummary(nextState);
  renderCustomerNextAdvice(nextState);
  renderCustomerRoundHistory(nextState);
  $('#customerEffectForm')?.reset();
  updateCustomerSelectedPlanDisplay(nextState);
  setCustomerMessage('#customerEffectMessage', `已进入第 ${roundNumber + 1} 轮。继续选择一条内容发布，记录后会生成下一轮建议。`);
}

function saveCustomerTrialState(update){
  const client_id = customerClientId();
  const current = loadCustomerTrialState({allowDedicatedFallback: true});
  const dedicated = dedicatedCustomerKey();
  const next = {
    ...current,
    ...update,
    client_id,
    customer_key: dedicated || explicitCustomerClientId() || client_id,
    ...(dedicated ? {dedicated_customer: dedicated} : {}),
    updated_at: localTimestamp(),
  };
  safeStorage.setItem(customerTrialStorageKey(client_id), JSON.stringify(next));
}

function loadCustomerTrialState(options = {}){
  try {
    const client_id = customerClientId();
    const state = JSON.parse(safeStorage.getItem(customerTrialStorageKey(client_id)) || '{}');
    if (state.client_id && String(state.client_id) !== String(client_id)) return {};
    if (!dedicatedCustomerKey() && !options.allowDedicatedFallback && isDedicatedCustomerState(state)) return {};
    return state;
  } catch {
    return {};
  }
}

function customerStateFromCloudProjectStore(store = {}){
  const normalized = normalizeProjectStoreShape(store);
  const active = normalized.projects.find((item)=>String(item.id) === String(normalized.activeProjectId)) || normalized.projects[0];
  if (!active?.state || !hasRestorableState(active.state)) return null;
  return {projectStore: normalized, state: normalizeState(active.state)};
}

async function restoreCustomerTrialFromCloud({force = false} = {}){
  if (isInternalDataScope()) return null;
  const shareToken = customerShareTokenFromUrl();
  let requestedProjectId = '';
  try { requestedProjectId = String(window.sessionStorage?.getItem(ACCOUNT_RESTORE_PROJECT_KEY) || ''); } catch {}
  const localState = shareToken ? {} : loadCustomerTrialState({allowDedicatedFallback: true});
  if (!force && !requestedProjectId && customerHasGeneratedState(localState)) return localState;
  try {
    const result = shareToken
      ? await api(`/api/customer-shares/${encodeURIComponent(shareToken)}`)
      : await api(`/api/state?client_id=${encodeURIComponent(customerClientId())}`);
    if (shareToken) setSharedCustomerClientId(result?.client_id || '');
    const cloudProjectStore = result?.project_store || {};
    if (requestedProjectId && Array.isArray(cloudProjectStore.projects)
      && cloudProjectStore.projects.some((project) => String(project?.id || '') === requestedProjectId)) {
      cloudProjectStore.activeProjectId = requestedProjectId;
    }
    const restored = customerStateFromCloudProjectStore(cloudProjectStore);
    if (!restored) return null;
    try { window.sessionStorage?.removeItem(ACCOUNT_RESTORE_PROJECT_KEY); } catch {}
    projectStore = restored.projectStore;
    saveProjectStore();
    clientState = restored.state;
    const trialState = {
      ...restored.state,
      project_id: restored.state.project?.id || restored.projectStore.activeProjectId || '',
      draft_assessment: null,
      restored_from_cloud: true,
    };
    saveCustomerTrialState(trialState);
    return trialState;
  } catch {
    return null;
  }
}

function shouldGateCustomerCloudRestore(saved = {}){
  return Boolean((explicitCustomerClientId() || customerShareTokenFromUrl()) && !customerHasGeneratedState(saved) && !hasDifferentCustomerDraft(saved) && !dedicatedCustomerKey());
}

function showCustomerCloudRestoreGate(){
  document.body.classList.add('customer-cloud-restore-pending');
  const resultSection = $('#customerResultSection');
  const result = $('#customerResult');
  if (result) result.innerHTML = '<div class="empty">正在恢复项目...</div>';
  if (resultSection) resultSection.hidden = false;
  $('#customerCoCreationSection')?.setAttribute('hidden', '');
  $('#customerEffectSection')?.setAttribute('hidden', '');
  $('#customerPlanBlock')?.setAttribute('hidden', '');
  setCustomerFormCollapsed(true);
  setCustomerStep('plan', {state: {}, focus: false});
}

function hideCustomerCloudRestoreGate(){
  document.body.classList.remove('customer-cloud-restore-pending');
  const resultSection = $('#customerResultSection');
  const result = $('#customerResult');
  if (result) result.innerHTML = '';
  if (resultSection) resultSection.hidden = true;
  setCustomerFormCollapsed(false);
  setCustomerStep('intake', {state: {}, focus: false});
}

function saveCustomerDraft(payload = {}){
  if (!payload || typeof payload !== 'object') return;
  const draft = sanitizeCustomerPayload({...payload});
  draft.client_id = customerClientId();
  draft.customer_key = dedicatedCustomerKey() || explicitCustomerClientId() || draft.client_id;
  const dedicated = dedicatedCustomerKey();
  if (dedicated) {
    draft.dedicated_customer = dedicated;
  }
  if (!Object.values(draft).some((value)=>String(value || '').trim())) return;
  saveCustomerTrialState({draft_assessment: draft});
}

function currentCustomerFormPayload(){
  const form = $('#customerAssessmentForm');
  if (!form) return {};
  syncCustomerChoicesBeforeSubmit();
  const payload = formData(form);
  Object.keys(payload).forEach((key) => { payload[key] = String(payload[key] || '').trim(); });
  return payload;
}

function hideStaleCustomerResultIfNeeded(){
  const current = loadCustomerTrialState();
  const draft = currentCustomerFormPayload();
  renderCustomerBriefPreview(draft);
  if (!Object.values(draft).some((value)=>String(value || '').trim())) return;
  saveCustomerDraft(draft);
  if (customerAssessmentSignature(draft) !== customerAssessmentSignature(current.assessment || {})) {
    clearCustomerGeneratedView();
  }
}

function renderCustomerBriefPreview(payload = currentCustomerFormPayload()){
  const box = $('#customerBriefPreview');
  if (!box) return;
  const brief = {
    industry: payload.industry || '等待填写业务',
    main_goal: payload.main_goal || '等待填写目标',
    target_customer: payload.target_customer || '等待填写客户',
  };
  Object.entries(brief).forEach(([key, value]) => {
    const target = box.querySelector(`[data-brief-preview="${key}"]`);
    if (target) target.textContent = customerText(value);
  });
  const platformBox = box.querySelector('[data-brief-platforms]');
  if (!platformBox) return;
  const platforms = customerPlatformItems(payload.current_channels || '').filter(Boolean);
  if (!platforms.length || (platforms.length === 1 && platforms[0] === '还不确定')) {
    platformBox.innerHTML = '<span class="platform-text-tag">待选择平台</span>';
    return;
  }
  platformBox.innerHTML = platforms.slice(0, 4).map((platform) =>
    `<span class="platform-text-tag">${esc(platform)}</span>`
  ).join('');
}

function initCustomerGuide(){
  const guide = $('#customerGuide');
  if (!guide) return;
  if (window.matchMedia?.('(max-width: 900px)').matches) guide.open = false;
  $('#customerGenericSampleBtn')?.addEventListener('click', fillGenericCustomerSample);
  $('#customerGuideDone')?.addEventListener('click', () => {
    guide.open = false;
    const firstInput = $('#customerAssessmentForm [name="industry"]');
    firstInput?.scrollIntoView({behavior:'smooth', block:'center'});
    window.setTimeout(() => firstInput?.focus(), 180);
  });
}

function fillGenericCustomerSample(){
  const form = $('#customerAssessmentForm');
  if (!form) return;
  const values = {
    company_name: '本地服务机构',
    industry: '本地服务，主要做专业服务和咨询转化',
    main_goal: '让目标客户看懂服务价值，并获得更多有效咨询',
    target_customer: '有明确需求、正在比较方案的目标客户',
    offer: '一次专业咨询或体验服务',
    store_location: '',
    course_schedule: '',
    coach_credentials: '',
    extra_context: '建议先验证抖音、小红书或视频号中最适合当前客户的一到两个平台，再按咨询数据调整内容方向。',
    customer_pain: '客户担心价格、效果、流程和适不适合自己',
    content_assets: '服务案例、客户反馈、服务过程照片或视频、常见问题',
    best_recent_content: '',
    current_channels: '抖音,小红书',
    content_mode: '推荐模式：平台差异化适配',
    biggest_problem: '有浏览没咨询',
    posting_frequency: '偶尔发布',
  };
  Object.entries(values).forEach(([name, value]) => {
    const field = form.querySelector(`[name="${name}"]`);
    if (!field) return;
    field.value = value;
    field.dispatchEvent(new Event('input', {bubbles:true}));
    field.dispatchEvent(new Event('change', {bubbles:true}));
  });
  syncCustomerChoiceButtons(form, '[data-customer-platforms]', 'current_channels');
  syncCustomerChoiceButtons(form, '[data-customer-content-mode]', 'content_mode');
  syncCustomerChoiceButtons(form, '[data-customer-problems]', 'biggest_problem');
  renderCustomerBriefPreview(values);
  $('#customerGuide')?.removeAttribute('open');
  $('#customerGenerateBtn')?.scrollIntoView({behavior:'smooth', block:'center'});
  setCustomerMessage('#customerFormError', '');
}

const BASKETBALL_CUSTOMER_PROFILE = {
  company_name: '星跃少儿篮球训练营',
  industry: '少儿篮球培训机构，主要做小学生篮球启蒙、体能提升、基础运球投篮训练，服务附近三公里社区家庭',
  main_goal: '希望获得附近家长咨询和到店体验课预约，提升周末班、寒暑假班报名转化',
  target_customer: '附近三公里内有6-12岁小学生的家长，尤其是想让孩子提升体能、减少玩手机、培养团队协作的家庭',
  offer: '少儿篮球体验课，适合零基础和基础薄弱孩子',
  store_location: '',
  course_schedule: '',
  coach_credentials: '持证教练带课，小班教学，课前热身拉伸，训练过程有安全保护，家长可旁听。',
  extra_context: '已带入前期填写的信息。请只补充上课地址和可预约时间；系统会据此生成适合抖音、小红书和视频号的内容建议。',
  customer_pain: '家长担心孩子跟不上、训练不安全、体验课只是推销、上课时间不合适',
  content_assets: '课堂训练视频、教练资质、场馆环境、家长反馈截图、孩子运球和投篮进步案例',
  best_recent_content: '一个孩子从怕球到完成连续运球的视频，家长留言问体验课时间',
  current_channels: '抖音,小红书,视频号',
  content_mode: '推荐模式：平台差异化适配',
  biggest_problem: '有浏览没咨询',
  posting_frequency: '偶尔发布',
};

function dedicatedCustomerKey(){
  if (explicitCustomerClientId() === 'basketball') return 'basketball';
  return '';
}

function setDedicatedRequiredField(form, name){
  const field = form?.querySelector?.(`[name="${name}"]`);
  if (!field) return;
  field.required = true;
  field.dataset.dedicatedRequired = 'true';
  const label = field.closest('label');
  if (label && !label.textContent.includes('*')) {
    label.firstChild.textContent = String(label.firstChild.textContent || '').trimEnd() + '*\n              ';
  }
}

function prefillDedicatedCustomer(){
  if (dedicatedCustomerKey() !== 'basketball') return;
  const form = $('#customerAssessmentForm');
  if (!form) return;
  fillCustomerFormFromAssessment(BASKETBALL_CUSTOMER_PROFILE);
  setDedicatedRequiredField(form, 'store_location');
  setDedicatedRequiredField(form, 'course_schedule');
  syncCustomerChoiceButtons(form, '[data-customer-platforms]', 'current_channels');
  syncCustomerChoiceButtons(form, '[data-customer-content-mode]', 'content_mode');
  syncCustomerChoiceButtons(form, '[data-customer-problems]', 'biggest_problem');
  const hint = $('#customerPrefillHint');
  if (hint) hint.textContent = '已为你带入前期填写的信息；只需要补充上课地址和可预约时间。';
  setCustomerMessage('#customerFormError', '已为你带入前期填写的信息；请补充 2 项：上课地址、可预约时间。');
}

function syncCustomerChoiceButtons(form, groupSelector, inputName){
  const value = form?.querySelector(`[name="${inputName}"]`)?.value || '';
  const values = value.split(/[,，、/\s]+/).map((item)=>item.trim()).filter(Boolean);
  document.querySelectorAll(`${groupSelector} button`).forEach((button) => {
    const selected = Boolean(value && values.includes(button.dataset.value));
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function customerPlatformItems(value = '', plans = []){
  const selected = value.split(/[,，、/\s]+/).map((item)=>item.trim()).filter(Boolean).filter((item)=>item !== '还不确定');
  const recommended = (plans || []).map((plan)=>customerText(plan?.platform || '')).filter(Boolean);
  return [...new Set(selected.length ? selected : (recommended.length ? recommended : ['抖音', '小红书', '视频号']))];
}

function customerPlatformRole(platform = ''){
  if (platform === '抖音') return '短视频曝光 / 案例讲解 / 咨询承接';
  if (platform === '小红书') return '搜索沉淀 / 决策清单 / 案例信任';
  if (platform === '视频号') return '微信信任 / 专业说明 / 私域承接';
  if (platform.includes('朋友圈')) return '客户跟进 / 案例沉淀 / 私域维护';
  return '补充验证 / 承接转化';
}

function customerPlatformAngle(platform = '', plan = {}){
  const topic = customerText(plan.topic || '检测合规咨询');
  const context = customerText([
    plan.topic,
    plan.angle,
    plan.content_brief,
    plan.target_customer,
    plan.growth_goal,
    plan.why_platform_fit,
  ].filter(Boolean).join(' '));
  if (platform === '抖音') {
    if (/检测|送检|医疗器械|注册检验|安标|安规|合规|整改|验厂/.test(context)) {
      return `用真实问题、送检误区或整改案例做短视频钩子，标题围绕「${topic}」。`;
    }
    if (/产后|产康|盆底肌|腹直肌|骨盆|宝妈|腰疼|漏尿|气血/.test(context)) {
      return `用产后真实问题、恢复误区、评估流程或客户体验做短视频钩子，标题围绕「${topic}」。`;
    }
    return `用真实问题、服务过程、客户体验或常见顾虑做短视频钩子，标题围绕「${topic}」。`;
  }
  if (platform === '小红书') return `用清单、流程和避坑说明承接搜索需求，帮助客户理解「${topic}」。`;
  if (platform === '视频号') return `用专业说明、案例复盘和微信生态信任承接咨询，主题围绕「${topic}」。`;
  return `围绕「${topic}」补充真实素材和明确咨询入口。`;
}

function customerContentMode(value = ''){
  return String(value || '').includes('一稿多发') ? 'batch' : 'adapt';
}

function customerContentModeHtml(payload = {}){
  const mode = customerContentMode(payload.content_mode);
  return `<div class="customer-mode-note"><strong>${mode === 'batch' ? '当前选择：省事模式：一稿多发' : '当前选择：推荐模式：平台差异化适配'}</strong><p>一稿多发省时间，可以先用一套核心内容同步到多平台，但转化可能弱；平台适配更费事，不过更符合不同平台的打开方式、信任建立和咨询承接。系统只建议适配，不强迫每个平台都写不同稿。</p></div>`;
}

function customerPlatformMatrixHtml(payload = {}, plans = []){
  const platforms = customerPlatformItems(payload.current_channels || '', plans);
  const firstPlans = (plans && plans.length ? plans : customerFallbackPlans(payload)).slice(0, Math.max(3, platforms.length));
  const mode = customerContentMode(payload.content_mode);
  return `<div class="customer-platform-matrix">${platforms.map((platform, index) => {
    const plan = firstPlans[index % firstPlans.length] || {};
    const angle = mode === 'batch'
      ? `一稿多发：先用同一条核心内容发布到${platform}，只微调标题/开头/封面和发布说明。`
      : customerPlatformAngle(platform, plan);
    return `<div class="customer-platform-card"><strong>${esc(platform)}</strong><span>${esc(customerPlatformRole(platform))}</span><p>${esc(angle)}</p></div>`;
  }).join('')}</div>`;
}

function customerOfferFromGoal(goal, industry){
  const text = customerText(`${goal || ''} ${industry || ''}`);
  const explicitMatch = text.match(/(?:咨询|预约|了解|报名|购买)([^，。；;、\s]{2,18})/);
  if (explicitMatch?.[1]) return explicitMatch[1];
  if (/盆底肌|漏尿|产后修复|产康/.test(text)) return '盆底肌修复';
  const consultMatch = text.match(/咨询([^，。/、\s]{2,16})/);
  if (consultMatch?.[1]) return consultMatch[1];
  if (/美甲/.test(text)) return '美甲套餐';
  if (/篮球销售|卖篮球|篮球售卖|篮球零售|篮球专卖|篮球店|篮球用品|篮球器材|篮球装备|篮球商品|训练篮球|比赛篮球/.test(text)) return '篮球商品';
  if (/饰品|首饰|耳饰|耳环|项链|手链|戒指|发夹|配饰|珠宝|银饰/.test(text)) return '饰品款式';
  if (/女装|服装|穿搭|包包|鞋履|香薰|礼物|买手店|零售|上新/.test(text)) return '商品款式';
  if (/武术|搏击|散打|拳击|泰拳|跆拳道|格斗|防身术|少儿武术|少儿搏击|武馆|搏击俱乐部|武术搏击/.test(text)) return '武术搏击体验课';
  if (/少儿篮球|小学生篮球|幼儿篮球|青少年篮球|篮球培训|篮球训练|篮球启蒙|篮球课|运球|投篮/.test(text)) return '少儿篮球体验课';
  if (/美容|医美|产康/.test(text)) return '到店服务';
  if (/装修/.test(text)) return '装修方案';
  if (/留学|教育|培训/.test(text)) return '咨询方案';
  return '相关服务';
}

async function copyCustomerSuggestion(){
  if (!customerSuggestionText) return toast('请先生成内容建议');
  try {
    await navigator.clipboard.writeText(customerSuggestionText);
  } catch {
    const area = document.createElement('textarea');
    area.value = customerSuggestionText;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast('已复制，可以粘贴使用');
}

async function saveCustomerLink(){
  const clientId = customerClientId();
  if (!clientId) return toast('暂无法生成保存链接，请刷新页面后重试');
  try {
    const saved = loadCustomerTrialState();
    const projectId = saved?.project_id || saved?.project?.id || clientState.project?.id || '';
    if (!projectId) return toast('请先生成内容建议，再保存链接');
    const created = await api('/api/customer-shares', {
      method: 'POST',
      body: JSON.stringify({client_id: clientId, project_id: projectId}),
    });
    const shareToken = String(created.share_token || '').trim();
    if (!shareToken) throw new Error('保存链接生成失败');
    const url = new URL(window.location.origin + window.location.pathname);
    url.search = '';
    url.searchParams.set('share', shareToken);
    const link = url.toString();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const area = document.createElement('textarea');
      area.value = link;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
  } catch (error) {
    return toast(error?.message || '暂无法生成保存链接，请稍后重试');
  }
  toast('项目链接已复制：换设备或发给同事打开，即可继续这个项目');
}

function setCustomerAccountMessage(message = '', kind = 'success'){
  const box = $('#customerAccountMessage');
  if (!box) return;
  box.textContent = message;
  box.classList.toggle('error', kind === 'error');
  box.hidden = !message;
}

function customerAccountPlanLabel(planCode = 'free'){
  const labels = {free: 'Free', plus: 'Plus', pro: 'Pro'};
  return labels[String(planCode || '').toLowerCase()] || 'Free';
}

function pendingReferralCode(){
  try {
    const saved = JSON.parse(window.localStorage?.getItem(REFERRAL_CODE_STORAGE_KEY) || '{}');
    const code = String(saved?.code || '').trim();
    const savedAt = Date.parse(saved?.saved_at || '');
    if (!/^[a-z0-9_-]{12,64}$/i.test(code) || !Number.isFinite(savedAt) || Date.now() - savedAt > 30 * 24 * 60 * 60 * 1000) {
      window.localStorage?.removeItem(REFERRAL_CODE_STORAGE_KEY);
      return '';
    }
    return code;
  } catch {
    return '';
  }
}

function customerEntitlementUsageText(entitlement = {}){
  entitlement = entitlement || {};
  const used = Number(entitlement.usage?.strategy_cycles_used || 0);
  const reserved = Number(entitlement.usage?.strategy_cycles_reserved || used);
  const limit = Number(entitlement.limits?.strategy_cycles || 0);
  return `${Math.max(used, reserved)} / ${limit} 轮策略周期`;
}

function customerEntitlementRefreshText(entitlement = {}){
  entitlement = entitlement || {};
  const accessEndsAt = String(entitlement.access_ends_at || '').trim();
  if (accessEndsAt) {
    const accessTime = new Date(accessEndsAt);
    if (!Number.isNaN(accessTime.getTime())) return `权益有效至 ${accessTime.toLocaleDateString('zh-CN', {timeZone:'Asia/Shanghai', month:'numeric', day:'numeric'})}`;
  }
  const value = String(entitlement.refresh_at || '').trim();
  if (!value) return '登录后查看本期额度';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '按当前套餐周期刷新';
  return `${time.toLocaleDateString('zh-CN', {timeZone:'Asia/Shanghai', month:'numeric', day:'numeric'})} 刷新`;
}

function customerAccountProjectRows(){
  return (Array.isArray(customerAccountState.clients) ? customerAccountState.clients : [])
    .flatMap((client) => (Array.isArray(client?.projects) ? client.projects : []).map((project) => ({
      client_id: String(client.client_id || ''),
      id: String(project?.id || ''),
      name: customerText(project?.name || '我的内容项目'),
      stage: customerText(project?.stage || ''),
      updated_at: customerText(project?.updated_at || ''),
    })))
    .filter((project) => project.client_id && project.id);
}

function renderCustomerAccountDialog(){
  const loading = $('#customerAccountLoading');
  const unavailable = $('#customerAccountUnavailable');
  const signedOut = $('#customerAccountSignedOut');
  const signedIn = $('#customerAccountSignedIn');
  const accountBtn = $('#customerAccountBtn');
  const title = $('#customerAccountTitle');
  const eyebrow = $('#customerAccountEyebrow');
  const intro = $('#customerAccountIntro');
  if (loading) loading.hidden = !customerAccountState.loading;
  if (unavailable) unavailable.hidden = customerAccountState.loading || customerAccountState.enabled;
  if (signedOut) signedOut.hidden = customerAccountState.loading || !customerAccountState.enabled || customerAccountState.signed_in;
  if (signedIn) signedIn.hidden = customerAccountState.loading || !customerAccountState.signed_in;
  if (accountBtn) {
    const accountLabel = accountBtn.querySelector('[data-public-account-label]');
    if (accountLabel) accountLabel.textContent = customerAccountState.signed_in ? '我的账号' : '登录';
    else accountBtn.textContent = customerAccountState.signed_in ? '我的账号' : '登录';
  }
  if (title) title.textContent = customerAccountState.signed_in ? '我的账号' : '登录';
  if (eyebrow) eyebrow.textContent = customerAccountState.signed_in ? 'MY ACCOUNT' : 'ACCOUNT';
  if (intro) intro.textContent = customerAccountState.signed_in
    ? '管理已保存项目和隐私设置。'
    : '登录后可跨设备找回项目。未登录也能继续使用。';

  const plan = $('#customerAccountPlan');
  if (plan) plan.textContent = customerAccountPlanLabel(customerAccountState.entitlement?.plan_code || customerAccountState.account?.plan_code);
  const usage = $('#customerAccountUsage');
  const refresh = $('#customerAccountUsageRefresh');
  if (usage) usage.textContent = customerAccountState.entitlement
    ? customerEntitlementUsageText(customerAccountState.entitlement)
    : '正在读取本期额度...';
  if (refresh) refresh.textContent = customerEntitlementRefreshText(customerAccountState.entitlement);
  const saved = loadCustomerTrialState({allowDedicatedFallback: true});
  const canBind = customerHasGeneratedState(saved);
  const bindButton = $('#customerAccountBindCurrent');
  const bindHint = $('#customerAccountBindHint');
  if (bindButton) bindButton.disabled = !canBind;
  if (bindHint) bindHint.textContent = canBind
    ? '绑定后，可在其他设备登录并继续查看。'
    : '当前还没有可绑定的内容项目，生成建议后即可绑定。';

  const projects = customerAccountProjectRows();
  const list = $('#customerAccountProjects');
  if (list) {
    list.innerHTML = projects.length
      ? projects.map((project) => `<button class="customer-account-project" type="button" data-account-client="${esc(project.client_id)}" data-account-project="${esc(project.id)}"><span><strong>${esc(project.name)}</strong>${project.stage ? `<em>${esc(project.stage)}</em>` : ''}</span><small>${esc(project.updated_at || '已保存到账号')}</small><b>打开</b></button>`).join('')
      : '<p class="customer-account-empty">还没有绑定项目。先生成一份内容建议，再绑定当前项目。</p>';
  }
}

async function loadCustomerAccountSession({loadProjects = true, showLoading = true} = {}){
  customerAccountState.loading = showLoading;
  if (showLoading) renderCustomerAccountDialog();
  try {
    const session = await api('/api/auth/session', {timeoutMs:10000});
    customerAccountState.enabled = session.enabled === true;
    customerAccountState.signed_in = session.signed_in === true;
    customerAccountState.account = session.account || null;
    customerAccountState.entitlement = null;
    customerAccountState.clients = [];
    if (customerAccountState.signed_in && loadProjects) {
      const [projects, entitlement] = await Promise.all([
        api('/api/account/projects', {timeoutMs:10000}),
        api('/api/account/entitlements', {timeoutMs:10000}).catch(() => ({entitlement:null})),
      ]);
      customerAccountState.account = projects.account || customerAccountState.account;
      customerAccountState.clients = Array.isArray(projects.clients) ? projects.clients : [];
      customerAccountState.entitlement = entitlement.entitlement || null;
    }
  } catch {
    customerAccountState.enabled = false;
    customerAccountState.signed_in = false;
    customerAccountState.account = null;
    customerAccountState.entitlement = null;
    customerAccountState.clients = [];
  } finally {
    customerAccountState.loading = false;
    renderCustomerAccountDialog();
  }
  return customerAccountState;
}

function openCustomerAccountDialog(){
  const dialog = $('#customerAccountDialog');
  if (!dialog) return;
  setCustomerAccountMessage('');
  dialog.hidden = false;
  document.body.classList.add('customer-privacy-open');
  const hasKnownAccountState = customerAccountState.loading === false && customerAccountState.enabled === true;
  if (hasKnownAccountState) renderCustomerAccountDialog();
  loadCustomerAccountSession({showLoading: !hasKnownAccountState}).then(() => {
    const focusTarget = customerAccountState.signed_in ? $('#customerAccountBindCurrent') : $('#customerAccountEmail');
    window.setTimeout(() => focusTarget?.focus(), 50);
  });
}

function closeCustomerAccountDialog({returnFocus = true} = {}){
  const dialog = $('#customerAccountDialog');
  if (!dialog) return;
  dialog.hidden = true;
  document.body.classList.remove('customer-privacy-open');
  if (returnFocus) $('#customerAccountBtn')?.focus();
}

async function startCustomerEmailVerification(email = ''){
  const normalizedEmail = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    setCustomerAccountMessage('请输入有效的邮箱地址。', 'error');
    return;
  }
  const button = $('#customerAccountSendCode');
  if (button) { button.disabled = true; button.textContent = '正在发送...'; }
  setCustomerAccountMessage('');
  try {
    const result = await api('/api/auth/email/start', {
      method: 'POST',
      timeoutMs: 12000,
      body: JSON.stringify({email: normalizedEmail}),
    });
    customerAccountState.challenge_id = String(result.challenge_id || '');
    customerAccountState.email = normalizedEmail;
    $('#customerAccountEmailForm')?.setAttribute('hidden', '');
    $('#customerAccountCodeForm')?.removeAttribute('hidden');
    setCustomerAccountMessage('验证码已发送，请在 10 分钟内完成验证。');
    window.setTimeout(() => $('#customerAccountCode')?.focus(), 50);
  } catch (error) {
    setCustomerAccountMessage(error?.message || '验证码暂时无法发送，请稍后再试。', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = '获取验证码'; }
  }
}

async function verifyCustomerEmailCode(code = ''){
  const normalizedCode = String(code || '').trim();
  if (!/^\d{6}$/.test(normalizedCode) || !customerAccountState.challenge_id || !customerAccountState.email) {
    setCustomerAccountMessage('请输入邮件中的 6 位验证码。', 'error');
    return;
  }
  const button = $('#customerAccountVerifyCode');
  if (button) { button.disabled = true; button.textContent = '正在验证...'; }
  setCustomerAccountMessage('');
  try {
    await api('/api/auth/email/verify', {
      method: 'POST',
      timeoutMs: 12000,
      body: JSON.stringify({
        email: customerAccountState.email,
        code: normalizedCode,
        challenge_id: customerAccountState.challenge_id,
        referral_code: pendingReferralCode(),
      }),
    });
    try { window.localStorage?.removeItem(REFERRAL_CODE_STORAGE_KEY); } catch {}
    customerAccountState.challenge_id = '';
    customerAccountState.email = '';
    $('#customerAccountCodeForm')?.setAttribute('hidden', '');
    $('#customerAccountEmailForm')?.removeAttribute('hidden');
    $('#customerAccountCode') && ($('#customerAccountCode').value = '');
    await loadCustomerAccountSession();
    window.dispatchEvent(new CustomEvent('customer-account:changed'));
    setCustomerAccountMessage('登录成功。你现在可以绑定或找回项目。');
    const nextPath = new URLSearchParams(window.location.search).get('next') || '';
    if (/^\/invite\/?$/.test(nextPath)) window.setTimeout(() => window.location.assign('/invite'), 450);
  } catch (error) {
    setCustomerAccountMessage(error?.message || '验证码验证失败，请重新获取。', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = '验证并登录'; }
  }
}

async function bindCurrentCustomerProject(){
  const saved = loadCustomerTrialState({allowDedicatedFallback: true});
  if (!customerHasGeneratedState(saved)) {
    setCustomerAccountMessage('请先生成一份内容建议，再绑定当前项目。', 'error');
    return;
  }
  const button = $('#customerAccountBindCurrent');
  if (button) { button.disabled = true; button.textContent = '正在绑定...'; }
  setCustomerAccountMessage('');
  try {
    const synced = await syncCustomerTrialCloudState(saved, {silent: true});
    if (!synced) throw new Error('当前项目尚未同步成功，请稍后再试。');
    await api('/api/account/link-client', {
      method: 'POST',
      timeoutMs: 12000,
      body: JSON.stringify({client_id: customerClientId()}),
    });
    await loadCustomerAccountSession();
    setCustomerAccountMessage('当前项目已绑定，可在其他设备登录后找回。');
  } catch (error) {
    setCustomerAccountMessage(error?.message || '项目绑定失败，请稍后再试。', 'error');
  } finally {
    if (button) { button.disabled = false; button.textContent = '保存当前项目到账号'; }
  }
}

function openCustomerAccountProject(clientId = '', projectId = ''){
  const safeClientId = normalizeClientId(clientId);
  if (!safeClientId || !projectId) return setCustomerAccountMessage('这个项目暂时无法打开。', 'error');
  try {
    window.localStorage?.setItem(CUSTOMER_SESSION_KEY, safeClientId);
    window.sessionStorage?.setItem(ACCOUNT_RESTORE_PROJECT_KEY, String(projectId));
    window.location.assign('/?account_restore=1');
  } catch {
    setCustomerAccountMessage('浏览器未允许保存项目，请检查隐私设置后重试。', 'error');
  }
}

async function logoutCustomerAccount(){
  const button = $('#customerAccountLogout');
  if (button) button.disabled = true;
  try {
    await api('/api/auth/logout', {method: 'POST', timeoutMs: 10000});
    customerAccountState = {...customerAccountState, signed_in: false, account: null, entitlement: null, clients: [], challenge_id: '', email: ''};
    renderCustomerAccountDialog();
    window.dispatchEvent(new CustomEvent('customer-account:changed'));
    setCustomerAccountMessage('已退出登录。当前浏览器里的项目仍然保留。');
  } catch {
    setCustomerAccountMessage('暂时无法退出，请稍后再试。', 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

function initCustomerAccount(){
  renderCustomerAccountDialog();
  loadCustomerAccountSession();
  $('#customerAccountBtn')?.addEventListener('click', () => {
    if (!window.publicAccountMenu) openCustomerAccountDialog();
  });
  window.addEventListener('public-account:login-requested', (event) => {
    event.preventDefault();
    openCustomerAccountDialog();
  });
  window.addEventListener('public-account:profile-requested', (event) => {
    event.preventDefault();
    openCustomerAccountDialog();
  });
  window.addEventListener('public-account:settings-requested', (event) => {
    event.preventDefault();
    openCustomerPrivacySettings($('#customerAccountBtn'));
  });
  window.addEventListener('public-account:logged-out', () => {
    customerAccountState = {...customerAccountState, signed_in: false, account: null, entitlement: null, clients: [], challenge_id: '', email: ''};
    renderCustomerAccountDialog();
  });
  $('#customerAccountClose')?.addEventListener('click', closeCustomerAccountDialog);
  $('#customerAccountDialog')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeCustomerAccountDialog();
  });
  $('#customerAccountEmailForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await startCustomerEmailVerification(formData(event.currentTarget).email);
  });
  $('#customerAccountCodeForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await verifyCustomerEmailCode(formData(event.currentTarget).code);
  });
  $('#customerAccountChangeEmail')?.addEventListener('click', () => {
    customerAccountState.challenge_id = '';
    customerAccountState.email = '';
    $('#customerAccountCodeForm')?.setAttribute('hidden', '');
    $('#customerAccountEmailForm')?.removeAttribute('hidden');
    setCustomerAccountMessage('');
    $('#customerAccountEmail')?.focus();
  });
  $('#customerAccountBindCurrent')?.addEventListener('click', bindCurrentCustomerProject);
  $('#customerAccountRefreshProjects')?.addEventListener('click', async () => {
    await loadCustomerAccountSession();
    setCustomerAccountMessage('项目列表已更新。');
  });
  $('#customerAccountProjects')?.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-account-client][data-account-project]');
    if (button) openCustomerAccountProject(button.dataset.accountClient, button.dataset.accountProject);
  });
  $('#customerAccountPrivacySettings')?.addEventListener('click', () => {
    closeCustomerAccountDialog({returnFocus: false});
    openCustomerPrivacySettings($('#customerAccountBtn'));
  });
  $('#customerAccountLogout')?.addEventListener('click', logoutCustomerAccount);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#customerAccountDialog')?.hidden) closeCustomerAccountDialog();
  });
  const accountEntryUrl = new URL(window.location.href);
  const accountEntry = accountEntryUrl.searchParams.get('account');
  if (['login', 'profile', 'settings'].includes(accountEntry)) {
    accountEntryUrl.searchParams.delete('account');
    window.history.replaceState({}, '', `${accountEntryUrl.pathname}${accountEntryUrl.search}${accountEntryUrl.hash}`);
    window.setTimeout(() => {
      if (accountEntry === 'settings') openCustomerPrivacySettings($('#customerAccountBtn'));
      else openCustomerAccountDialog();
    }, 0);
  }
}

function hasLocalUserSettings(){
  try {
    return Boolean(window.localStorage?.getItem(userSettingsStorageKey()));
  } catch {
    return false;
  }
}

function renderCustomerPrivacySettings(settings = readLocalUserSettings()){
  const toggle = $('#personalizedRecommendationToggle');
  if (toggle) toggle.checked = settings.personalized_recommendation_enabled !== false;
}

function setCustomerPrivacySettingsMessage(message = '', kind = 'success'){
  const box = $('#customerPrivacySettingsMessage');
  if (!box) return;
  box.textContent = message;
  box.classList.toggle('error', kind === 'error');
  box.hidden = !message;
}

async function loadCustomerPrivacySettings(){
  const localWasExplicit = hasLocalUserSettings();
  const local = readLocalUserSettings();
  renderCustomerPrivacySettings(local);
  try {
    const clientId = userSettingsClientId();
    const remote = await api(`/api/user/settings?client_id=${encodeURIComponent(clientId)}`, {timeoutMs:10000});
    const enabled = localWasExplicit
      ? local.personalized_recommendation_enabled !== false
      : remote.personalized_recommendation_enabled !== false;
    const settings = writeLocalUserSettings(enabled);
    renderCustomerPrivacySettings(settings);
    if (localWasExplicit && remote.personalized_recommendation_enabled !== enabled) {
      await api('/api/user/settings', {
        method:'PATCH',
        timeoutMs:10000,
        body:JSON.stringify({
          client_id: clientId,
          personalized_recommendation_enabled: enabled,
        }),
      });
    }
    return settings;
  } catch {
    return local;
  }
}

async function saveCustomerPrivacySettings(enabled = true){
  const settings = writeLocalUserSettings(enabled);
  renderCustomerPrivacySettings(settings);
  setCustomerPrivacySettingsMessage('正在保存...');
  try {
    const saved = await api('/api/user/settings', {
      method:'PATCH',
      timeoutMs:10000,
      body:JSON.stringify({
        client_id: userSettingsClientId(),
        personalized_recommendation_enabled: settings.personalized_recommendation_enabled,
      }),
    });
    writeLocalUserSettings(saved.personalized_recommendation_enabled !== false);
    renderCustomerPrivacySettings(saved);
    setCustomerPrivacySettingsMessage(saved.personalized_recommendation_enabled === false
      ? '已关闭。后续建议将只使用通用规则和你主动选择的当前项目信息。'
      : '已开启个性化推荐/推送。');
  } catch {
    setCustomerPrivacySettingsMessage('云端暂时未同步，但当前浏览器已保存此设置。', 'error');
  }
}

let customerPrivacyReturnFocus = null;

function openCustomerPrivacySettings(trigger = null){
  const dialog = $('#customerPrivacySettings');
  if (!dialog) return;
  customerPrivacyReturnFocus = trigger instanceof Element ? trigger : document.activeElement;
  renderCustomerPrivacySettings();
  setCustomerPrivacySettingsMessage('');
  dialog.hidden = false;
  document.body.classList.add('customer-privacy-open');
  window.setTimeout(() => $('#personalizedRecommendationToggle')?.focus(), 80);
}

function closeCustomerPrivacySettings(){
  const dialog = $('#customerPrivacySettings');
  if (!dialog) return;
  dialog.hidden = true;
  document.body.classList.remove('customer-privacy-open');
  const fallback = $('#customerFooterPrivacySettingsBtn') || $('#customerAccountBtn');
  const focusTarget = customerPrivacyReturnFocus?.isConnected ? customerPrivacyReturnFocus : fallback;
  customerPrivacyReturnFocus = null;
  focusTarget?.focus();
}

function initCustomerPrivacySettings(){
  renderCustomerPrivacySettings();
  loadCustomerPrivacySettings();
  $('#customerFooterPrivacySettingsBtn')?.addEventListener('click', (event) => openCustomerPrivacySettings(event.currentTarget));
  $('#customerPrivacySettingsClose')?.addEventListener('click', closeCustomerPrivacySettings);
  $('#customerPrivacySettings')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeCustomerPrivacySettings();
  });
  $('#personalizedRecommendationToggle')?.addEventListener('change', async (event) => {
    const toggle = event.currentTarget;
    toggle.disabled = true;
    await saveCustomerPrivacySettings(toggle.checked);
    toggle.disabled = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#customerPrivacySettings')?.hidden) closeCustomerPrivacySettings();
  });
}

function initCustomerTrial(){
  initCustomerAccount();
  initCustomerPrivacySettings();
  trackCustomerEventOnce('home_view', {source:'customer_public'});
  initCustomerChoices('[data-customer-platforms]', 'current_channels');
  initCustomerChoices('[data-customer-content-mode]', 'content_mode');
  initCustomerChoices('[data-customer-problems]', 'biggest_problem');
  initChoiceGroup('[data-customer-avoid-content]', '#customerCoCreationForm', 'avoided_content');
  initChoiceGroup('[data-customer-observation-tags]', '#customerEffectForm', 'observation_tags');
  initCustomerGuide();
  renderCustomerBriefPreview();
  renderCustomerEffects();
  const sharedProjectLink = Boolean(customerShareTokenFromUrl());
  const savedCustomerState = sharedProjectLink ? {} : loadCustomerTrialState();
  renderCustomerResumeBanner(savedCustomerState);
  if (savedCustomerState.assessment && savedCustomerState.diagnosis) {
    clientState = buildVersionedProjectState(
      {assessment: savedCustomerState.assessment, diagnosis: savedCustomerState.diagnosis, plans: savedCustomerState.plans || []},
      savedCustomerState.assessment,
      'customer_public',
      clientState,
      '浏览器恢复'
    );
    renderCustomerGeneratedState(savedCustomerState);
    scheduleCustomerTrialCloudSync(savedCustomerState);
  } else if (hasDifferentCustomerDraft(savedCustomerState)) {
    fillCustomerFormFromAssessment(savedCustomerState.draft_assessment);
    clearCustomerGeneratedView();
    setCustomerFormCollapsed(false);
  } else if (savedCustomerState.draft_assessment || savedCustomerState.assessment) {
    fillCustomerFormFromAssessment(savedCustomerState.draft_assessment || savedCustomerState.assessment);
  }
  prefillDedicatedCustomer();
  renderCustomerBriefPreview(currentCustomerFormPayload());
  renderCustomerRecordSummary(savedCustomerState);
  renderCustomerNextAdvice(savedCustomerState);
  const gateCloudRestore = shouldGateCustomerCloudRestore(savedCustomerState);
  if (gateCloudRestore) showCustomerCloudRestoreGate();
  else setCustomerStep(customerDefaultStep(savedCustomerState), {state: savedCustomerState});
  restoreCustomerTrialFromCloud().then((cloudState) => {
    if (!cloudState || !customerHasGeneratedState(cloudState)) {
      if (gateCloudRestore) hideCustomerCloudRestoreGate();
      return;
    }
    document.body.classList.remove('customer-cloud-restore-pending');
    renderCustomerResumeBanner(cloudState);
    renderCustomerGeneratedState(cloudState, {step: customerDefaultStep(cloudState)});
    renderCustomerRecordSummary(cloudState);
    renderCustomerNextAdvice(cloudState);
    renderCustomerEffects(cloudState);
  });
  $('#customerResumeContinue')?.addEventListener('click', () => {
    setCustomerStep(customerDefaultStep(loadCustomerTrialState()), {focus: true});
  });
  $('#customerStartBlank')?.addEventListener('click', startBlankCustomerProject);
  $('#copyCustomerSuggestion')?.addEventListener('click', copyCustomerSuggestion);
  $('#saveCustomerLinkBtn')?.addEventListener('click', saveCustomerLink);
  $('#customerRegenerateBtn')?.addEventListener('click', editCustomerAssessment);
  $('#customerAssessmentForm')?.addEventListener('input', hideStaleCustomerResultIfNeeded);
  $('#customerAssessmentForm')?.addEventListener('change', hideStaleCustomerResultIfNeeded);
  $('#customerAssessmentForm')?.addEventListener('focusin', () => {
    trackCustomerEventOnce('intake_started', {source:'customer_public'});
  }, {once:true});
  document.querySelectorAll('a[href="#customerFormCard"]').forEach((link)=>{
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const current = loadCustomerTrialState();
      if (current.assessment || current.draft_assessment) {
        fillCustomerFormFromAssessment(current.assessment || current.draft_assessment);
      }
      setCustomerFormCollapsed(false);
      setCustomerStep('intake', {state: current, focus: true});
    });
  });
  document.querySelectorAll('[data-customer-step-link]').forEach((link)=>{
    link.addEventListener('click', (event) => {
      const targetStep = link.dataset.customerStepLink;
      if (!targetStep) return;
      event.preventDefault();
      const current = loadCustomerTrialState();
      if (!customerCanOpenStep(targetStep, current)) {
        showCustomerStepMessage(targetStep);
        return;
      }
      setCustomerStep(targetStep, {state: current, focus: true});
    });
  });
  $('#customerProgressStrip')?.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-customer-step-target]');
    if (!button) return;
    const targetStep = button.dataset.customerStepTarget || 'intake';
    const current = loadCustomerTrialState();
    if (!customerCanOpenStep(targetStep, current)) {
      showCustomerStepMessage(targetStep);
      return;
    }
    setCustomerStep(targetStep, {state: current, focus: true});
  });
  $('#customerAssessmentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = '#customerFormError';
    setCustomerMessage(errorBox, '');
    syncCustomerChoicesBeforeSubmit();
    const rawForm = formData(e.target);
    const payload = {
      ...rawForm,
      current_channels: rawForm.current_channels || '还不确定',
      content_mode: rawForm.content_mode || '推荐模式：平台差异化适配',
      biggest_problem: rawForm.biggest_problem || '不知道发什么',
      posting_frequency: '偶尔发布',
      offer: rawForm.offer || customerOfferFromGoal(rawForm.main_goal, rawForm.industry),
      customer_pain: rawForm.customer_pain || rawForm.biggest_problem || '不知道发什么',
    };
    Object.keys(payload).forEach((key) => { payload[key] = String(payload[key] || '').trim(); });
    const validation = customerRequired(payload);
    if (validation) {
      setCustomerMessage(errorBox, validation);
      return;
    }
    const scopedPayload = customerScopedPayload(payload);
    saveCustomerDraft(scopedPayload);
    clearCustomerGeneratedView();
    if (isP03AnbiaoSubmission(scopedPayload)) {
      await submitCustomerAssessmentPayload({
        ...scopedPayload,
        co_creation: defaultCustomerCoCreation(scopedPayload),
      }, e.submitter || $('#customerGenerateBtn'));
      return;
    }
    renderCustomerCoCreation(scopedPayload);
  });
  $('#customerCoCreationDirections')?.addEventListener('click', (event) => {
    const card = event.target?.closest?.('[data-cocreation-direction]');
    if (!card) return;
    selectCustomerCoCreationDirection(card.dataset.cocreationDirection || '');
  });
  $('#customerCoCreationBack')?.addEventListener('click', () => {
    hideCustomerCoCreation();
    setCustomerFormCollapsed(false);
    setCustomerStep('intake', {focus: true});
  });
  $('#customerGenerationRetry')?.addEventListener('click', async () => {
    if (pendingCustomerPlanJob) {
      await resumeCustomerPlanJob($('#customerGenerationRetry'));
      return;
    }
    if (!lastCustomerGenerationPayload) {
      setCustomerMessage('#customerCoCreationMessage', '请先确认本轮内容方向，再重新生成。', 'error');
      return;
    }
    await submitCustomerAssessmentPayload(lastCustomerGenerationPayload, $('#customerGenerationRetry'));
  });
  $('#customerCoCreationForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const basePayload = customerPendingCoCreationPayload || customerScopedPayload(currentCustomerFormPayload());
    const coCreation = collectCustomerCoCreation();
    if (!coCreation) {
      setCustomerMessage('#customerCoCreationMessage', '请先选择本轮最想测试的内容方向。', 'error');
      return;
    }
    const scopedPayload = sanitizeCustomerPayload({...basePayload, co_creation: coCreation});
    saveCustomerDraft(scopedPayload);
    await submitCustomerAssessmentPayload(scopedPayload, $('#customerCoCreationSubmit'));
  });
  $('#customerPlanList')?.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-customer-record-plan]');
    if (!button) return;
    selectCustomerEffectPlan(button.dataset.customerRecordPlan);
  });
  $('#customerNextAdvice')?.addEventListener('click', (event) => {
    const continueBtn = event.target?.closest?.('[data-customer-continue]');
    if (continueBtn) {
      setCustomerStep('record', {state: loadCustomerTrialState()});
      const planBlock = $('#customerPlanBlock');
      (planBlock && !planBlock.hidden ? planBlock : $('#customerEffectSection'))?.scrollIntoView({behavior:'smooth', block:'start'});
      return;
    }
    const button = event.target?.closest?.('[data-customer-activate-round]');
    if (!button || button.disabled) return;
    activateCustomerNextRound();
  });
  $('#customerEffectForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = loadCustomerTrialState();
    const records = Array.isArray(current.records) ? current.records : [];
    const data = formData(e.target);
    const selectedPlan = customerPlanById(current, data.content_plan_id);
    if (!selectedPlan) {
      setCustomerMessage('#customerEffectMessage', '请先在上方内容计划里选择实际发布的那一条；系统不会默认绑定第一条。', 'error');
      $('#customerPlanBlock')?.scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }
    const splitEngagement = toNonNegative(data.likes) + toNonNegative(data.favorites) + toNonNegative(data.comments) + toNonNegative(data.shares);
    const engagement = toNonNegative(data.engagement) || splitEngagement;
    if (engagement && !splitEngagement) data.likes = String(engagement);
    data.publish_link = normalizeExternalUrl(data.publish_link || '');
    const selectedPlanId = planIdValue(selectedPlan);
    const markedPlans = customerPlans(current).map((plan)=>samePlanId(planIdValue(plan), selectedPlanId) ? {...plan, status: '已记录效果'} : plan);
    let record = {...data, client_id: customerClientId(), engagement, content_plan_id: selectedPlanId, plan_topic: selectedPlan.topic || '', created_at: localTimestamp()};
    let nextState = {...current, plans: markedPlans.length ? markedPlans : current.plans, records: [record, ...records], selected_plan_id: selectedPlanId, updated_at: localTimestamp()};
    try {
      const dailyAdvice = await requestCustomerDailyAdvice(nextState, record);
      record = {...record, daily_advice: dailyAdvice};
      nextState = {...nextState, records: [record, ...records], updated_at: localTimestamp()};
    } catch (error) {
      const fallbackAdvice = buildCustomerNextAdvice(nextState, record);
      const fallbackNextRound = buildCustomerNextRoundPlan(nextState, record, fallbackAdvice);
      record = {
        ...record,
        daily_advice: {
          advice: fallbackAdvice,
          next_round: fallbackNextRound,
          next_7_day_plan: fallbackNextRound.next_7_day_plan,
          fallback: true,
          transparent_note: error.message || 'customer-growth-advice request failed',
          strategy_model: { requested_model: 'ChatGPT', actual_model: 'rule_template', provider: 'local', fallback: true, failure_reason: error.message || 'request_failed' },
          copy_model: { requested_model: 'Claude Opus', actual_model: 'rule_template', provider: 'local', fallback: true, failure_reason: error.message || 'request_failed' },
        },
      };
      nextState = {...nextState, records: [record, ...records], updated_at: localTimestamp()};
    }
    saveCustomerTrialState(nextState);
    trackCustomerEvent('effect_recorded', {source:'customer_public', round_number:customerActiveRound(nextState)}, `effect-${customerRecordKey(record)}`);
    if (clientState.plans?.length) {
      const livePlan = clientState.plans.find((plan)=>samePlanId(planIdValue(plan), selectedPlanId)) || selectedPlan;
      const feedback = {
        id: Date.now(),
        client_id: customerClientId(),
        project_id: clientState.project?.id || current.project_id || 'customer-project',
        cycle_id: clientState.current_cycle_id || 'cycle-1',
        content_plan_id: selectedPlanId,
        publish_link: record.publish_link || '',
        feedback_stage: 'T+24',
        views: playbackValue(record),
        backend_views: playbackValue(record),
        backend_play_count: playbackValue(record),
        likes: toNonNegative(record.likes),
        comments: toNonNegative(record.comments),
        favorites: toNonNegative(record.favorites),
        shares: toNonNegative(record.shares),
        consultations: toNonNegative(record.consultations),
        appointments: toNonNegative(record.appointments),
        notes: record.notes || '',
        created_at: record.created_at,
      };
      livePlan.status = record.publish_link ? '已发布' : '已记录效果';
      if (record.publish_link) livePlan.publish_link = record.publish_link;
      clientState.feedback = [feedback, ...clientState.feedback.filter((item)=>!(samePlanId(item.content_plan_id, selectedPlanId) && String(item.feedback_stage || 'T+24') === 'T+24'))];
      clientState.review = createLocalReview();
      saveLocal();
    }
    scheduleCustomerTrialCloudSync(nextState);
    e.target.reset();
    $$('[data-customer-observation-tags] .customer-choice-chip').forEach((button)=>{
      button.classList.remove('is-selected');
      button.setAttribute('aria-pressed', 'false');
    });
    const advice = record.daily_advice?.advice || buildCustomerNextAdvice(nextState, record);
    const nextRound = record.daily_advice?.next_round || buildCustomerNextRoundPlan(nextState, record, advice);
    const readiness = customerNextRoundReadiness(nextState);
    const resultType = nextRound.review_judgment?.type || '继续观察';
    const saveMessage = readiness.canActivate
      ? `已记录这条内容。已形成阶段性复盘判断：${resultType}。现在可以选择结束本轮并使用下一轮计划，也可以继续补齐本轮数据。`
      : `已记录这条内容。系统先给出本条优化建议：${resultType}。再记录 ${readiness.remainingToStage} 条不同内容，就能解锁更准的下一轮建议。`;
    setCustomerMessage('#customerEffectMessage', saveMessage);
    renderCustomerEffects(nextState);
    renderCustomerRecordSummary(nextState);
    renderCustomerNextAdvice(nextState);
    renderCustomerRoundHistory(nextState);
    const planList = $('#customerPlanList');
    const planBlock = $('#customerPlanBlock');
    if (planList) planList.innerHTML = buildCustomerPlanList(nextState.assessment || current.assessment || {}, nextState.plans || customerPlans(nextState));
    if (planBlock) planBlock.hidden = !customerPlans(nextState).length;
    updateCustomerSelectedPlanDisplay(nextState);
    setCustomerStep('next', {state: nextState, focus: true});
  });
}

function dynamicLoopScore(){
  const total = clientState.plans.length;
  const published = clientState.plans.filter((p)=>p.status === '已发布' && p.publish_link).length;
  const rows = latestFeedbackRows();
  const consultations = rows.reduce((sum, f)=>sum + num(f.consultations), 0);
  const totalInteractions = rows.reduce((sum, f)=>sum + interactions(f), 0);
  let score = clientState.diagnosis?.loop_score ?? 8;
  if (total) score = Math.max(score, 8 + Math.round((published / total) * 35));
  if (rows.length) score += 12;
  if (totalInteractions > 0) score += 10;
  if (consultations > 0) score += 20;
  if (clientState.review) score += 15;
  return Math.max(0, Math.min(100, score));
}
function parsePlatformRecommendations(value){
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}
function renderPlatformGroup(title, items){
  if (!items?.length) return '';
  return `<div><div class="small">${esc(title)}</div>${items.map((item)=>`<p><strong>${esc(item.platform)}</strong>：${esc(item.reason)}</p>`).join('')}</div>`;
}
function normalizeBenchmark(payload){
  if (payload.benchmark && typeof payload.benchmark === 'object') return payload.benchmark;
  const accountText = String(payload.benchmark_accounts || '').split(/[\n\r,，、]+/);
  const accounts = [...accountText, payload.benchmark_account_1, payload.benchmark_account_2, payload.benchmark_account_3]
    .map((item)=>String(item || '').trim())
    .filter(Boolean);
  return {
    platform: String(payload.benchmark_platform || '').trim(),
    accounts: accounts.map((item)=>normalizeExternalUrl(item)),
    notes: String(payload.benchmark_notes || '').trim(),
    sample_content: String(payload.benchmark_sample_content || '').trim(),
  };
}
function hasBenchmark(benchmark){
  return Boolean(benchmark && ((benchmark.accounts || []).length || benchmark.notes || benchmark.sample_content));
}
function renderBenchmarkReference(ref){
  if (!ref) return '';
  const list = (title, items) => items?.length ? `<div><div class="small">${esc(title)}</div><p>${items.map(esc).join('；')}</p></div>` : '';
  return `<div class="warning benchmark-reference">
    <div class="small">对标账号主题参考</div>
    <p>对标账号不是用来抄袭，而是用来判断市场已经验证过的痛点、标题结构和用户需求。</p>
    ${ref.source_summary ? `<p><strong>参考来源：</strong>${esc(ref.source_summary)}</p>` : ''}
    ${list('对标账号市场信号', ref.recent_topics)}
    ${list('高互动标题结构', ref.title_structures)}
    ${list('可迁移选题方向', ref.transferable_directions)}
    ${list('不建议直接模仿点', ref.avoid)}
  </div>`;
}

function clientDashboard(){
  const total_plans = clientState.plans.length;
  const published_plans = clientState.plans.filter((plan) => plan.status === '已发布' && plan.publish_link).length;
  const rows = latestFeedbackRows();
  const total_views = rows.reduce((sum, item) => sum + playbackValue(item), 0);
  const total_interactions = rows.reduce((sum, item) => sum + interactions(item), 0);
  const total_consultations = rows.reduce((sum, item) => sum + num(item.consultations), 0);
  let next_suggestion = '先执行：发布第一条内容，并把首次发布链接回填到系统，否则不算闭环。';
  if (total_consultations > 0) next_suggestion = '加码：已有内容带来咨询，下周复制最高咨询主题，并保留合规咨询/主页咨询入口。';
  else if (published_plans > 0) next_suggestion = '优化：已有发布但暂无咨询，下周强化客户痛点表达，并用咨询/主页咨询承接。';
  const review = latestReviewEvidence();
  if (review?.next_actions) next_suggestion = review.next_actions.replace('加码「」同类角度', '加码「最高咨询内容」同类角度');
  return {total_plans, published_plans, feedback_rate: total_plans ? published_plans / total_plans : 0, total_views, total_interactions, total_consultations, next_suggestion};
}


function inferProjectStage(state = clientState){
  if (!state.diagnosis) return '未诊断';
  const plans = Array.isArray(state.plans) ? state.plans : [];
  const feedback = Array.isArray(state.feedback) ? state.feedback : [];
  if (state.review) return '复盘期';
  if (feedback.length || plans.some((p)=>p.status === '已发布' || p.publish_link)) return '运营中';
  if (plans.length) return '待启动';
  return '已诊断';
}
function syncProjectStage(){
  clientState.project_stage = inferProjectStage(clientState);
  if (!clientState.current_cycle_id) clientState.current_cycle_id = 'cycle-1';
  if (!clientState.project && clientState.assessment) clientState.project = makeProject(clientState.assessment);
}
function stageMeta(stage){
  return {
    '未诊断': {label:'未诊断', focus:'增长诊断', desc:'新项目先收集业务、目标客户和对标账号，生成第一轮内容增长判断。'},
    '已诊断': {label:'已诊断', focus:'生成计划', desc:'已经形成诊断判断，下一步要把策略变成可执行的7天内容计划。'},
    '待启动': {label:'待启动', focus:'启动运营', desc:'已有内容计划，但还缺发布链接和首批反馈；重点是把第一条内容发出去并回填。'},
    '运营中': {label:'运营中', focus:'看成果/补回填', desc:'项目已进入正式营销周期，老板优先看成果、风险和今天动作。'},
    '复盘期': {label:'复盘期', focus:'周期复盘', desc:'一个周期已有反馈，应判断复制什么、砍掉什么、下一轮怎么调整。'},
  }[stage] || {label:stage, focus:'继续推进', desc:'按项目生命周期继续推进。'};
}
function bestContent(){
  const rows = latestFeedbackRows();
  if (!rows.length) return null;
  const winner = rows.slice().sort((a,b)=>(num(b.consultations)-num(a.consultations)) || (interactions(b)-interactions(a)) || (playbackValue(b)-playbackValue(a)))[0];
  const plan = clientState.plans.find((p)=>Number(p.id)===Number(winner.content_plan_id));
  return {feedback:winner, plan};
}
function latestReviewEvidence(){
  return clientState.review || autoReviewFromFeedback();
}
function evidenceLink(anchor, label){
  return `<a class="evidence-anchor-link" href="#${esc(anchor)}" onclick="openClientEvidence('${esc(anchor)}')">${esc(label)}</a>`;
}
function evidenceBadge(anchor, label = '查看判断依据'){
  return `<button class="war-btn evidence-action" type="button" onclick="openClientEvidence('${esc(anchor)}')">${esc(label)}</button>`;
}
function missingFeedbackCount(){
  return clientState.plans.filter((p)=>p.status === '已发布' || p.publish_link).filter((p)=>!clientState.feedback.some((f)=>Number(f.content_plan_id)===Number(p.id))).length;
}
function getPrimaryFlow(){
  syncProjectStage();
  const hasPlans = clientState.plans.length > 0;
  const hasUnfilled = missingFeedbackCount() > 0;
  if (!clientState.diagnosis || clientState.project_stage === '未诊断') {
    return { label:'开始增长诊断', target:'#diagnosisWorkflow', toast:'先填写 5 个问题，生成第一轮内容增长建议。' };
  }
  if (clientState.project_stage === '复盘期' || clientState.review) {
    return { label:'查看周复盘', target:'#feedbackWorkflow', toast:'查看本轮复盘，决定下一轮复制/停止/重测。' };
  }
  if (hasPlans && (clientState.project_stage === '待启动' || hasUnfilled)) {
    return { label:'查看内容计划', target:'#planSection', toast:'回填入口已放到每条内容计划卡片里。' };
  }
  return { label:'查看当前项目作战台', target:'#lifecycleWorkbench', toast:'已回到当前项目作战台。' };
}

function runPrimaryFlow(){
  const action = getPrimaryFlow();
  if (Number.isFinite(action.feedbackId)) {
    prefillFeedback(action.feedbackId);
    return;
  }
  const el = document.querySelector(action.target || '#diagnosisWorkflow');
  if (el) el.hidden = false;
  el?.scrollIntoView({behavior:'smooth', block:'start'});
  if (action.toast) toast(action.toast);
}
window.runPrimaryFlow = runPrimaryFlow;

function updateHeroPrimaryButton(){
  const btn = $('#heroPrimaryBtn');
  if (!btn) return;
  const action = getPrimaryFlow();
  btn.textContent = action.label;
  btn.onclick = runPrimaryFlow;
}

function closeMoreActions(){
  const details = $('#moreActions');
  if (details) details.open = false;
}
window.closeMoreActions = closeMoreActions;

function resetForNewCustomer(){
  startNewProject();
}
window.resetForNewCustomer = resetForNewCustomer;
function clearAllLocalData(){
  safeStorage.removeItem(appStateStorageKey());
  safeStorage.removeItem(projectsStorageKey());
  safeStorage.setItem(DEMO_DISABLED_KEY, '1');
  projectStore = {activeProjectId: null, lastActiveProjectId: null, projects: []};
  clientState = blankClientState();
  renderAllFromClient();
  closeMoreActions();
  showDiagnosisWorkflow();
  toast('已清空本浏览器全部项目数据。');
}
window.clearAllLocalData = clearAllLocalData;

function scrollToSection(selector){
  const el = document.querySelector(selector);
  if (!el) return;
  el.hidden = false;
  el.scrollIntoView({behavior:'smooth', block:'start'});
}
window.scrollToSection = scrollToSection;
function settleInternalHashTarget(){
  if (!isInternalProfile()) return;
  const hash = String(location.hash || '');
  if (hash !== '#planSection' && hash !== '#internalResultSection') return;
  const target = document.querySelector(hash);
  if (!target || target.hidden) return;
  window.setTimeout(() => target.scrollIntoView({behavior:'auto', block:'start'}), 40);
}

function renderProjectSwitcher(){
  loadProjectStore();
  const projects = projectStore.projects || [];
  if (!projects.length) return '';
  const activeId = clientState.project?.id || projectStore.activeProjectId || projects[0]?.id;
  const options = projects.map((item)=>`<option value="${esc(item.id)}" ${String(item.id) === String(activeId) ? 'selected' : ''}>${esc(item.name)}｜${esc(item.stage || '未诊断')}</option>`).join('');
  return `<label class="project-switcher"><span>当前项目</span><select onchange="switchProject(this.value)">${options}</select></label>`;
}

function renderWarCoreAnchors({ todayAction, decisionText, winningText, d }){
  const assessment = clientState.assessment || {};
  const diagnosis = clientState.diagnosis || {};
  const clientName = visibleClientName();
  const customer = clientName
    ? `${clientName}｜${assessment.target_customer || assessment.main_goal || assessment.industry || '业务目标'}`
    : (assessment.target_customer || assessment.main_goal || assessment.industry || '业务目标');
  const judgment = diagnosis.priority_problem || diagnosis.next_step || '内容增长判断';
  const feedback = d.total_consultations > 0
    ? `${d.total_consultations} 个有效咨询`
    : (clientState.feedback.length ? `${clientState.feedback.length} 条回填记录` : '等待真实反馈');
  const anchors = [
    { key:'01', label:'客户输入', value:customer, desc:'业务、目标客户和当前卡点', anchor:'evidence-k', tone:'blue' },
    { key:'02', label:'系统判断', value:judgment, desc:'先判断问题，再给内容方向', anchor:'evidence-v', tone:'green' },
    { key:'03', label:'今日动作', value:todayAction, desc:'首屏直接告诉下一步做什么', anchor:'planSection', tone:'orange' },
    { key:'04', label:'真实反馈', value:feedback, desc:winningText, anchor:'evidence-r', tone:'purple' },
  ];
  return anchors.map((item) => {
    const click = item.anchor.startsWith('evidence-')
      ? `openClientEvidence('${esc(item.anchor)}')`
      : `scrollToSection('#${esc(item.anchor)}')`;
    return `<button class="war-core-anchor ${esc(item.tone)}" type="button" onclick="${click}">
      <span class="war-core-index">${esc(item.key)}</span>
      <span class="war-core-label">${esc(item.label)}</span>
      <strong>${esc(item.value)}</strong>
      <em>${esc(item.desc)}</em>
    </button>`;
  }).join('');
}

function renderLifecycleWorkbench(){
  syncProjectStage();
  const el = $('#lifecycleWorkbench');
  if (!el) return;
  const d = clientDashboard();
  const meta = stageMeta(clientState.project_stage);
  const projectName = customerDisplayName(clientState.assessment, clientState.project);
  const winner = bestContent();
  const unfilled = missingFeedbackCount();
  const hasRealFeedback = clientState.feedback.length > 0;
  if (!clientState.diagnosis) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  const cycleText = cycleLabel(clientState.current_cycle_id);
  const firstNeedFeedback = clientState.plans.find((p)=>p.status === '已发布' || p.publish_link ? !clientState.feedback.some((f)=>Number(f.content_plan_id)===Number(p.id)) : false);
  const firstOpen = firstNeedFeedback || clientState.plans.find((p)=>!(p.status === '已发布' || p.publish_link || hasFeedbackForPlan(p.id)));
  const todayAction = clientState.project_stage === '未诊断'
    ? '先完成一次增长诊断，生成第一轮内容实验计划'
    : clientState.project_stage === '待启动'
      ? `发布 #${firstOpen ? planDisplayNumber(firstOpen) : 1} 内容，并回填发布链接`
      : clientState.project_stage === '复盘期'
        ? '确认下一轮复制什么、停止什么、重测什么'
        : (unfilled ? `回填 #${firstNeedFeedback ? planDisplayNumber(firstNeedFeedback) : ''} 内容的 T+72 数据` : d.next_suggestion);
  const todayReason = unfilled
    ? '已发布内容缺少反馈，当前无法判断是否继续复制该方向。'
    : (hasRealFeedback ? '已有真实反馈，优先把判断转成下一轮动作。' : '还没有真实反馈，先完成发布和回填，避免只看计划不看结果。');
  const todayEvidenceAnchor = unfilled || hasRealFeedback ? 'evidence-r' : 'evidence-k';
  const todayEvidence = evidenceBadge(todayEvidenceAnchor);
  const decisionEvidenceAnchor = winner ? 'evidence-r' : 'evidence-v';
  const decisionEvidence = evidenceBadge(decisionEvidenceAnchor);
  const flow = getPrimaryFlow();
  const primaryAction = `<button class="war-btn primary" type="button" onclick="runPrimaryFlow()">${esc(flow.label)}</button>`;
  const projectSwitcher = renderProjectSwitcher();
  const winningText = winner ? `#${esc(planDisplayNumber(winner.plan?.id || winner.feedback.content_plan_id))} ${esc(winner.plan?.topic || '已回填内容')}` : '暂无胜出内容，先发布并回填';
  const decisionText = winner
    ? `“${esc(winner.plan?.topic || '最高咨询内容')}”方向值得继续观察`
    : '还不能判断胜出方向，缺少真实反馈样本';
  const confidence = hasRealFeedback ? Math.min(92, 42 + clientState.feedback.length * 18 + d.total_consultations * 8) : 24;
  const stageTag = unfilled ? '<span class="war-tag orange">待回填</span>' : (hasRealFeedback ? '<span class="war-tag green">状态正常</span>' : '<span class="war-tag orange">待启动</span>');
  const reviewTag = `<span class="war-tag purple">${esc(cycleText)}</span>`;
  const hypothesis = `<span class="war-tag">假设：${esc(clientState.diagnosis?.priority_problem || clientState.assessment?.biggest_problem || '内容能否带来咨询')}</span>`;
  const coreAnchors = renderWarCoreAnchors({ todayAction, decisionText, winningText, d });
  const identityBar = renderInternalClientIdentityHtml({compact: true});
  el.innerHTML = `<div class="war-room-shell">
    <div class="war-nav"><div class="war-brand"><span class="war-mark"></span><strong>${esc(projectName)}</strong></div>${projectSwitcher}<div class="war-tabs"><button class="active" type="button" onclick="scrollToSection('#lifecycleWorkbench')">作战台</button><button type="button" onclick="scrollToSection('#planSection')">计划/回填</button><button type="button" onclick="regenerateCurrentDiagnosis()">重新诊断</button><button type="button" onclick="startNewProject()">新增项目</button></div></div>
    ${identityBar}
    <section class="war-status-hero">
      <div><h2>${esc(cycleText)} · ${esc(meta.label)}</h2><div class="war-meta">${stageTag}${reviewTag}${hypothesis}</div></div>
      <div class="war-actions">${primaryAction}<button class="war-btn" type="button" onclick="document.querySelector('#planSection')?.scrollIntoView({behavior:'smooth', block:'start'})">查看计划</button><button class="war-btn" type="button" onclick="document.querySelector('#feedbackWorkflow')?.scrollIntoView({behavior:'smooth', block:'start'})">周复盘</button></div>
    </section>
    <section class="war-core-anchors" aria-label="四个核心要素">${coreAnchors}</section>
    <section class="war-main-row">
      <article class="war-card war-todo"><div class="war-card-head"><span>今日动作 · P1</span><span class="war-tag orange">${unfilled ? '待处理' : '下一步'}</span></div><h3>${esc(todayAction)}</h3><p>${esc(todayReason)}</p><div class="war-inline-actions">${todayEvidence}</div></article>
      <article class="war-card war-decision"><div class="war-card-head"><span>下一步判断</span></div><div class="war-decision-main">${decisionText}</div><div class="war-confidence"><i style="width:${confidence}%"></i></div><div class="war-meta"><span class="war-tag green">咨询 ${d.total_consultations}</span><span class="war-tag">${winningText}</span></div><div class="war-inline-actions">${decisionEvidence}</div></article>
    </section>
    <section class="war-metrics">${renderOutcomeCards(d)}</section>
  </div>`;
}
function showDiagnosisWorkflow(){
  const el = $('#diagnosisWorkflow');
  if (el) el.hidden = false;
  el?.scrollIntoView({behavior:'smooth'});
}
function startNextCycle(){
  const current = String(clientState.current_cycle_id || 'cycle-1');
  const n = Number(current.match(/cycle-(\d+)/)?.[1] || 1) + 1;
  clientState.current_cycle_id = `cycle-${n}`;
  clientState.project_stage = clientState.diagnosis ? '待启动' : '未诊断';
  clientState.review = null;
  saveLocal();
  renderAllFromClient();
  toast('已进入下一轮增长周期，请基于复盘调整内容计划');
}
window.showDiagnosisWorkflow = showDiagnosisWorkflow;
window.startNextCycle = startNextCycle;

function renderAllFromClient(){
  if (isInternalProfile() && !internalAuthVerified) return;
  syncProjectStage();
  hydrateInternalFormValuesFromState();
  renderInternalClientIdentity();
  renderAllCustomersPanel();
  renderCustomerDetailDashboard();
  renderFeishuCollaborationPanel();
  renderLifecycleWorkbench();
  renderWorkflowVisibility();
  renderDashboard(clientDashboard());
  renderCustomerSnapshot(clientState.assessment);
  renderFirstLinkGate();
  renderDiagnosis(clientState.diagnosis);
  renderPlans(clientState.plans);
  renderFeedback(clientState.feedback);
  renderPublishedLinkPicker();
  renderRefillCockpit();
  renderReview(clientState.review || autoReviewFromFeedback());
  renderNextSevenDataPage();
  renderReviewEvidencePanel();
  renderTopReturnProjectAction();
  settleInternalHashTarget();
  renderGenerationWorkbenchRoute();
  renderInternalOpsTabs();
  document.body.classList.toggle('customer-edit-mode', isInternalProfile() && customerDetailEditMode);
}

function customerListDisplayName(customer = {}){
  if (customer.display_name) return customerText(customer.display_name);
  const names = Array.isArray(customer.names) ? customer.names.filter(Boolean) : [];
  return customerText(names[0] || customer.client_id || '未命名客户');
}

function customerPrimaryClientId(customer = {}){
  return String(customer.primary_client_id || customer.client_id || customer.records?.[0]?.client_id || '').trim();
}

function customerRecordLabel(record = {}, index = 0){
  const updated = String(record.updated_at || '').slice(0, 16);
  const count = Number(record.project_count || 0);
  const id = String(record.client_id || '');
  return [`记录 ${index + 1}`, updated || '无更新日期', count ? `${count} 个项目` : '', id].filter(Boolean).join(' · ');
}

const hasCustomerDetailState = () => {
  const assessment = clientState.assessment || {};
  return Boolean(
    clientState.project
    || assessment.company_name
    || assessment.industry
    || assessment.main_goal
    || clientState.diagnosis
    || (Array.isArray(clientState.plans) && clientState.plans.length)
    || (Array.isArray(clientState.feedback) && clientState.feedback.length)
  );
};

const detailField = (label, value) => `<div class="kv"><span>${esc(label)}</span><strong>${esc(String(value || '').trim() || '未填写')}</strong></div>`;

function customerDetailPlanRows(){
  const plans = Array.isArray(clientState.plans) ? clientState.plans : [];
  if (!plans.length) return '<div class="empty">暂无内容计划。生成第一轮内容建议后，这里会显示 7 天发布安排。</div>';
  const published = plans.filter((plan) => plan.status === '已发布' || plan.publish_link || clientState.feedback.some((f) => samePlanId(f.content_plan_id, plan.id))).length;
  const firstOpen = plans.find((plan) => !(plan.status === '已发布' || plan.publish_link || clientState.feedback.some((f) => samePlanId(f.content_plan_id, plan.id))));
  const rows = plans.map((plan) => {
    const meta = planUiMeta(plan, firstOpen?.id);
    const link = normalizeExternalUrl(plan.publish_link);
    return `<div class="detail-plan-row ${esc(meta.className)}">
      <span class="detail-plan-index">#${esc(planDisplayNumber(plan))}</span>
      <strong>${esc(plan.topic || '未命名内容')}</strong>
      <span class="war-tag">${esc(plan.platform || '未标注平台')}</span>
      <span class="war-tag ${meta.tone === 'orange' ? 'orange' : meta.tone === 'green' ? 'green' : ''}">${esc(meta.label)}</span>
      <span class="detail-plan-date">${esc(plan.planned_date || '日期待定')}</span>
      ${link ? `<a class="detail-plan-link" href="${esc(link)}" target="_blank" rel="noreferrer">查看链接</a>` : ''}
    </div>`;
  }).join('');
  return `<div class="detail-summary-chips"><span>总计划 ${plans.length} 条</span><span>已发布 ${published} 条</span><span>待发布 ${plans.length - published} 条</span></div><div class="detail-plan-list">${rows}</div>`;
}

function customerDetailFeedbackRows(){
  const items = (clientState.feedback || []).slice().sort((a, b) => compareTimestampDesc(a.created_at, b.created_at));
  const review = clientState.review || autoReviewFromFeedback();
  const reviewHtml = review
    ? `<div class="detail-review"><strong>最新复盘判断</strong><p><span>胜出主题：</span>${esc(review.winner_topic || '暂无')}</p><p><span>瓶颈：</span>${esc(review.bottleneck || '未生成')}</p><p><span>下一步：</span>${esc((review.next_actions || '').replace('加码「」同类角度', '加码「最高咨询内容」同类角度'))}</p></div>`
    : '';
  if (!items.length) {
    return `${reviewHtml}<div class="empty">暂无回填数据。内容发布后，在下方"内容数据回填"里记录曝光、互动和咨询，看板会自动更新。</div>`;
  }
  const rows = items.map((f) => {
    const plan = internalPlanById(f.content_plan_id) || {};
    const link = normalizeExternalUrl(f.publish_link || plan.publish_link || '');
    return `<div class="detail-feedback-row">
      <div class="detail-feedback-head"><strong>#${esc(planDisplayNumber(f.content_plan_id))} ${esc(f.plan_topic || plan.topic || '已回填内容')}</strong><span>${esc(f.feedback_stage || 'T+24')} · ${esc(f.created_at || '')}</span></div>
      <div class="detail-feedback-metrics">${feedbackMetricSet(f)}</div>
      <div class="detail-feedback-bottom"><p>${esc(feedbackConclusion(f))}</p>${link ? `<a href="${esc(link)}" target="_blank" rel="noreferrer">发布链接</a>` : ''}</div>
    </div>`;
  }).join('');
  return `${reviewHtml}<div class="detail-feedback-list">${rows}</div>`;
}

function renderCustomerDetailDashboard(){
  const panel = $('#customerDetailDashboard');
  if (!panel) return;
  const visible = isInternalProfile() && !isGenerationWorkbenchRoute() && hasCustomerDetailState();
  panel.hidden = !visible;
  if (!visible) return;
  const body = $('#customerDetailBody');
  if (!body) return;
  const assessment = clientState.assessment || {};
  const diagnosis = clientState.diagnosis || {};
  const name = visibleClientName() || customerDisplayName(assessment, clientState.project) || '未命名客户';
  const updated = cleanDisplayName(assessment.saved_at || clientState.saved_at || clientState.project?.updated_at) || '未知';
  const stage = clientState.project_stage || '未诊断';
  const strategyRows = diagnosis
    ? [
        ['策略清晰度', diagnosis.strategy_score ?? diagnosis.score ? `${diagnosis.strategy_score ?? diagnosis.score}/100` : '未生成'],
        ['核心判断', diagnosis.insight],
        ['下一步动作', diagnosis.next_step || diagnosis.weekly_action],
      ].map(([label, value]) => detailField(label, value)).join('')
    : '';
  body.innerHTML = `
    <div class="customer-detail-meta">
      <div><span>客户</span><strong>${esc(name)}</strong><em>${esc(customerClientId())}</em></div>
      <div><span>当前阶段</span><strong>${esc(stage)}</strong><em>更新于 ${esc(updated)}</em></div>
      <div class="customer-detail-actions">
        <button type="button" class="war-btn secondary" data-detail-action="edit">${clientState.diagnosis ? '编辑业务信息 / 重新生成' : '填写业务信息并生成'}</button>
        <button type="button" class="war-btn secondary" data-detail-action="plans">查看内容计划</button>
        <button type="button" class="war-btn secondary" data-detail-action="feedback">回填效果数据</button>
      </div>
    </div>
    <div class="customer-detail-grid">
      <section class="customer-detail-card">
        <div class="customer-detail-card-head"><strong>客户信息</strong><span>来源：客户填写资料</span></div>
        <div class="kv-grid">${[
          ['行业 / 业务', assessment.industry],
          ['主要目标', assessment.main_goal],
          ['目标客户', assessment.target_customer],
          ['发布平台', assessment.current_channels],
          ['客户 / 门店名', assessment.company_name],
          ['产品 / 服务', assessment.offer],
          ['服务区域', assessment.store_location],
          ['联系人', assessment.contact],
        ].map(([label, value]) => detailField(label, value)).join('')}</div>
      </section>
      <section class="customer-detail-card">
        <div class="customer-detail-card-head"><strong>内容策略</strong><span>来源：系统诊断</span></div>
        ${diagnosis
          ? `<div class="kv-grid">${strategyRows}</div>${diagnosis.risk_warning ? `<div class="detail-note"><span>风险提醒</span><p>${esc(diagnosis.risk_warning)}</p></div>` : ''}`
          : '<div class="empty">尚未生成内容诊断。点击"填写业务信息并生成"后，这里会显示策略判断与下一步动作。</div>'}
      </section>
      <section class="customer-detail-card">
        <div class="customer-detail-card-head"><strong>内容发布情况</strong><span>来源：内容计划</span></div>
        ${customerDetailPlanRows()}
      </section>
      <section class="customer-detail-card">
        <div class="customer-detail-card-head"><strong>内容反馈</strong><span>来源：发布回填</span></div>
        ${customerDetailFeedbackRows()}
      </section>
    </div>`;
}

function renderAllCustomersPanel(){
  const panel = $('#allCustomersPanel');
  if (!panel) return;
  const visible = isInternalProfile() && !isGenerationWorkbenchRoute();
  panel.hidden = !visible;
  if (!visible) return;
  const status = $('#allCustomersStatus');
  const list = $('#allCustomersList');
  const customers = allCustomersState.customers || [];
  const errors = allCustomersState.errors || [];
  const realCustomers = customers.filter((c) => !c.is_test);
  const testCustomers = customers.filter((c) => c.is_test);
  const multiGroups = customers.filter((customer) => Array.isArray(customer.records) && customer.records.length > 1);
  const multiCount = multiGroups.length;
  if (status) {
    status.hidden = false;
    status.classList.toggle('error', Boolean(allCustomersState.error));
    status.classList.toggle('success', !allCustomersState.error);
    if (allCustomersState.loading) status.textContent = '正在读取全部客户...';
    else if (allCustomersState.error) status.textContent = `客户列表读取失败：${allCustomersState.error}`;
    else if (!customers.length) status.textContent = '暂无可显示客户。';
    else {
      const parts = [`已读取 ${realCustomers.length} 个正式客户`];
      if (multiCount) parts.push(`其中 ${multiCount} 组由多条同名记录合并（明细见下方）`);
      if (testCustomers.length) parts.push(`另有 ${testCustomers.length} 个测试/示例`);
      if (errors.length) parts.push(`${errors.length} 个键读取失败已跳过`);
      status.textContent = `${parts.join('；')}。`;
    }
  }
  if (!list) return;
  list.classList.toggle('empty', !customers.length);
  if (!customers.length) { list.innerHTML = '暂无客户。'; return; }
  const optFor = (customer) => {
    const clientId = customerPrimaryClientId(customer);
    const name = customerListDisplayName(customer);
    const updated = String(customer.updated_at || '').slice(0, 10);
    const count = Number(customer.project_count || 0);
    const recordCount = Number(customer.record_count || customer.records?.length || 1);
    const hint = [
      recordCount > 1 ? `已合并 ${recordCount} 条记录` : '',
      updated,
      count ? `${count} 个项目` : '',
    ].filter(Boolean).join(' · ');
    return `<option value="${esc(clientId)}">${esc(name)}${hint ? `（${esc(hint)}）` : ''}</option>`;
  };
  const realOpts = realCustomers.length ? `<optgroup label="客户（${realCustomers.length}）">${realCustomers.map(optFor).join('')}</optgroup>` : '';
  const testOpts = testCustomers.length ? `<optgroup label="测试 / 示例（${testCustomers.length}）">${testCustomers.map(optFor).join('')}</optgroup>` : '';
  const pickerHtml = `
    <div class="all-customers-picker">
      <select id="allCustomersSelect" aria-label="选择客户" style="width:100%;padding:10px 12px;border-radius:12px;font-size:15px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#f7f8f8">
        <option value="" disabled selected>选择客户…（${realCustomers.length} 个正式${testCustomers.length ? ` / ${testCustomers.length} 测试` : ''}${multiCount ? `，${multiCount} 组已合并同名记录` : ''}）</option>
        ${realOpts}${testOpts}
      </select>
    </div>`;
  const multiHtml = multiCount
    ? `<div class="all-customer-record-groups">
        <details class="all-customer-merged-details">
          <summary>同名客户合并明细（${multiCount} 组）：下拉中已合并为一个选项，展开可查看并切换各条原始记录</summary>
          ${multiGroups.map((customer) => `
            <details>
              <summary>${esc(customerListDisplayName(customer))}（已合并 ${customer.records.length} 条记录）</summary>
              <div class="all-customer-record-list">
                ${customer.records.map((record, index) => `<button type="button" data-all-customer-client="${esc(record.client_id)}">${esc(customerRecordLabel(record, index))}</button>`).join('')}
              </div>
            </details>`).join('')}
        </details>
      </div>`
    : '';
  list.innerHTML = pickerHtml + multiHtml;
}

const internalBillingStatusLabel = (status = '') => ({
  pending_payment: '待确认',
  processing: '开通中',
  paid: '已开通',
  canceled: '已取消',
  expired: '已过期',
  failed: '处理失败',
}[String(status || '')] || '未知状态');

function renderInternalBillingPanel(){
  const panel = $('#internalBillingPanel');
  if (!panel) return;
  const visible = isInternalProfile() && !isGenerationWorkbenchRoute();
  panel.hidden = !visible;
  if (!visible) return;
  const pending = internalBillingState.orders.filter((order) => order.status === 'pending_payment');
  const count = $('#internalBillingPendingCount');
  const status = $('#internalBillingStatus');
  const list = $('#internalBillingList');
  if (count) count.textContent = `${pending.length} 笔待确认`;
  if (status) {
    status.hidden = false;
    status.classList.toggle('error', Boolean(internalBillingState.error));
    status.classList.toggle('success', !internalBillingState.error);
    status.textContent = internalBillingState.loading
      ? '正在读取商业订单...'
      : (internalBillingState.error || `共 ${internalBillingState.orders.length} 笔订单，其中 ${pending.length} 笔等待到账确认。`);
  }
  if (!list) return;
  list.classList.toggle('empty', !internalBillingState.orders.length);
  if (!internalBillingState.orders.length) {
    list.textContent = internalBillingState.loading ? '正在读取...' : '暂无订单。';
    return;
  }
  list.innerHTML = internalBillingState.orders.map((order) => `<article class="internal-billing-order" data-billing-order-id="${esc(order.order_id)}">
    <div class="internal-billing-order-head">
      <div><strong>${esc(order.plan_name)} · ${order.billing_interval === 'year' ? '年付' : '月付'}</strong><span>${esc(order.order_no)} · 账号 ${esc(order.account_reference || '未知')}</span></div>
      <em class="is-${esc(order.status)}">${esc(internalBillingStatusLabel(order.status))}</em>
    </div>
    <div class="internal-billing-order-meta"><span>¥${Number(order.amount_cny || 0).toLocaleString('zh-CN')}</span><span>${esc(order.created_at || '')}</span>${order.subscription_ends_at ? `<span>权益至 ${esc(order.subscription_ends_at)}</span>` : ''}</div>
    ${order.status === 'pending_payment' ? `<div class="internal-billing-confirm"><input name="payment_reference" placeholder="到账流水号 / 凭证编号" aria-label="到账流水号" /><input name="operator_note" placeholder="备注（可选）" aria-label="订单备注" /><button type="button" data-billing-confirm="${esc(order.order_id)}">确认到账并开通</button></div>` : ''}
  </article>`).join('');
}

async function loadInternalBillingOrders(){
  if (!isInternalProfile() || isGenerationWorkbenchRoute()) return;
  internalBillingState = { ...internalBillingState, loading: true, error: '' };
  renderInternalBillingPanel();
  try {
    const result = await api('/api/internal/billing/orders?limit=100', { suppressInternalUnauthorized: true });
    internalBillingState = { orders: Array.isArray(result.orders) ? result.orders : [], loading: false, error: '' };
  } catch (error) {
    internalBillingState = { orders: [], loading: false, error: error.message || '商业订单读取失败' };
  }
  renderInternalBillingPanel();
}

async function confirmInternalBillingOrder(orderId = '', card = null){
  const paymentReference = String(card?.querySelector('[name="payment_reference"]')?.value || '').trim();
  const operatorNote = String(card?.querySelector('[name="operator_note"]')?.value || '').trim();
  if (!paymentReference) throw new Error('请先填写到账流水号或凭证编号');
  const button = card?.querySelector('[data-billing-confirm]');
  if (button) { button.disabled = true; button.textContent = '正在开通...'; }
  try {
    const result = await api(`/api/internal/billing/orders/${encodeURIComponent(orderId)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ payment_reference: paymentReference, operator_note: operatorNote }),
    });
    toast(result.duplicate ? '该订单已经开通过，没有重复增加权益。' : '到账已确认，客户套餐权益已开通。');
    await loadInternalBillingOrders();
  } finally {
    if (button?.isConnected) { button.disabled = false; button.textContent = '确认到账并开通'; }
  }
}

function shouldReloadAllCustomers(){
  if (allCustomersLoadInFlight) return false;
  if (!allCustomersState.error && Array.isArray(allCustomersState.customers) && allCustomersState.customers.length) {
    return Date.now() - allCustomersLoadAt > ALL_CUSTOMERS_RELOAD_TTL_MS;
  }
  return true;
}

function refreshAllCustomers({ force = false } = {}){
  if (!isInternalProfile()) return Promise.resolve();
  if (allCustomersLoadInFlight) return allCustomersLoadInFlight;
  if (!force && !shouldReloadAllCustomers()) return Promise.resolve();
  allCustomersLoadInFlight = loadAllCustomers().finally(() => {
    allCustomersLoadAt = Date.now();
    allCustomersLoadInFlight = null;
  });
  return allCustomersLoadInFlight;
}

async function loadAllCustomers(){
  if (!isInternalProfile()) return;
  allCustomersState = { ...allCustomersState, loading: true, error: '' };
  renderAllCustomersPanel();
  try {
    const result = await api('/api/customers?mode=internal&client_id=internal', { suppressInternalUnauthorized: true });
    allCustomersState = {
      customers: Array.isArray(result.customers) ? result.customers : [],
      errors: Array.isArray(result.errors) ? result.errors : [],
      loading: false,
      error: '',
    };
  } catch (error) {
    if (error?.status === 401) {
      allCustomersState = { customers: [], errors: [], loading: false, error: '未通过内部访问验证，请先在上方输入口令。' };
      renderAllCustomersPanel();
      return;
    }
    allCustomersState = { customers: [], errors: [], loading: false, error: error.message || '请求失败' };
  }
  renderAllCustomersPanel();
}

function feishuCollaborationScope(){
  const projectId = String(clientState.project?.id || '').trim();
  return projectId ? `${customerClientId()}:${projectId}` : '';
}

function feishuReasonMessage(reason = ''){
  return ({
    missing_feishu_app_credentials: '飞书应用凭据尚未配置。',
    missing_feishu_base_or_wiki_token: '飞书多维表格 Token 尚未配置。',
    missing_feishu_plan_table: '尚未配置内容计划表 FEISHU_TABLE_PLAN。',
    no_content_plans: '当前项目还没有可推送的内容计划。',
  })[String(reason || '')] || '飞书同步失败，请检查写权限和表字段配置。';
}

function renderFeishuCollaborationPanel(){
  const panel = $('#feishuCollaborationPanel');
  if (!panel) return;
  const projectId = String(clientState.project?.id || '').trim();
  const visible = isInternalProfile() && !isGenerationWorkbenchRoute() && Boolean(projectId) && internalOpsTab === 'feishu';
  panel.hidden = !visible;
  if (!visible) return;

  const scope = feishuCollaborationScope();
  const remote = feishuCollaborationState.scope === scope ? (feishuCollaborationState.status || {}) : {};
  const localSync = clientState.feishu_sync || {};
  const plans = Array.isArray(clientState.plans) ? clientState.plans : [];
  const lastPushAt = remote.last_push_at || localSync.last_push_at || '';
  const lastPullAt = remote.last_pull_at || localSync.last_inbound_at || '';
  const status = $('#feishuCollaborationStatus');
  if (status) status.innerHTML = `
    <div><span>当前项目</span><strong>${esc(cleanDisplayName(clientState.project?.name) || projectId)}</strong></div>
    <div><span>内容计划</span><strong>${plans.length} 条</strong></div>
    <div><span>最近推送</span><strong>${esc(lastPushAt || '暂无')}</strong></div>
    <div><span>最近拉取</span><strong>${esc(lastPullAt || '暂无')}</strong></div>`;

  const button = $('#feishuPushPlansBtn');
  if (button) {
    button.disabled = feishuCollaborationState.loading || !plans.length;
    button.textContent = feishuCollaborationState.loading ? '同步中...' : '推送到飞书';
  }
  const workspaceUrl = normalizeExternalUrl(remote.workspace_url || feishuCollaborationState.result?.workspace_url || '');
  const link = $('#feishuWorkspaceLink');
  if (link) {
    link.hidden = !/^https?:\/\//i.test(workspaceUrl);
    if (!link.hidden) link.href = workspaceUrl;
  }
  const message = $('#feishuCollaborationMessage');
  if (!message) return;
  const result = feishuCollaborationState.result;
  const summary = result?.summary || remote.last_push_summary;
  if (feishuCollaborationState.error) {
    setCustomerMessage('#feishuCollaborationMessage', feishuCollaborationState.error, 'error');
  } else if (feishuCollaborationState.loading) {
    setCustomerMessage('#feishuCollaborationMessage', '正在读取飞书协同状态...');
  } else if (summary) {
    setCustomerMessage('#feishuCollaborationMessage', `最近同步：新增 ${Number(summary.created || 0)} 条，更新 ${Number(summary.updated || 0)} 条，跳过 ${Number(summary.skipped || 0)} 条，失败 ${Number(summary.failed || 0)} 条。`);
  } else if (remote.configured === false) {
    setCustomerMessage('#feishuCollaborationMessage', '飞书写入配置尚未完整，系统会保持关闭，不会产生脏数据。', 'error');
  } else {
    setCustomerMessage('#feishuCollaborationMessage', '尚未推送当前项目的内容计划。');
  }
}

async function loadFeishuCollaborationStatus(){
  if (!isInternalProfile() || !internalAuthVerified) return;
  const projectId = String(clientState.project?.id || '').trim();
  if (!projectId) {
    feishuCollaborationState = { scope: '', loading: false, error: '', status: null, result: null };
    renderFeishuCollaborationPanel();
    return;
  }
  const scope = feishuCollaborationScope();
  feishuCollaborationState = { scope, loading: true, error: '', status: null, result: null };
  renderFeishuCollaborationPanel();
  try {
    const result = await api(`/api/feishu/status?client_id=${encodeURIComponent(customerClientId())}&project_id=${encodeURIComponent(projectId)}`);
    if (feishuCollaborationScope() !== scope) return;
    feishuCollaborationState = { scope, loading: false, error: '', status: result, result: null };
  } catch (error) {
    if (feishuCollaborationScope() !== scope) return;
    feishuCollaborationState = { scope, loading: false, error: error.message || '飞书协同状态读取失败。', status: null, result: null };
  }
  renderFeishuCollaborationPanel();
}

async function pushCurrentProjectToFeishu(){
  const projectId = String(clientState.project?.id || '').trim();
  if (!projectId) throw new Error('请先选择一个已有项目。');
  if (!Array.isArray(clientState.plans) || !clientState.plans.length) throw new Error('当前项目还没有可推送的内容计划。');
  const scope = feishuCollaborationScope();
  feishuCollaborationState = { ...feishuCollaborationState, scope, loading: true, error: '', result: null };
  renderFeishuCollaborationPanel();
  try {
    const result = await api('/api/feishu/push', {
      method: 'POST',
      body: JSON.stringify({ client_id: customerClientId(), project_id: projectId }),
      timeoutMs: 30000,
    });
    if (!result.ok) throw new Error(feishuReasonMessage(result.reason));
    clientState.feishu_sync = { ...(clientState.feishu_sync || {}), ...(result.sync || {}) };
    saveLocal();
    feishuCollaborationState = { scope, loading: false, error: '', status: { ...(feishuCollaborationState.status || {}), ...(result.sync || {}), workspace_url: result.workspace_url || '' }, result };
    const summary = result.summary || {};
    toast(`飞书同步完成：新增 ${Number(summary.created || 0)} 条，更新 ${Number(summary.updated || 0)} 条。`);
  } catch (error) {
    feishuCollaborationState = { ...feishuCollaborationState, scope, loading: false, error: error.message || '飞书同步失败。', result: null };
    throw error;
  } finally {
    renderFeishuCollaborationPanel();
  }
}

function hydrateInternalFormValuesFromState(){
  if (!isInternalProfile()) return;
  const form = $('#assessmentForm');
  const assessment = clientState.assessment || {};
  if (!form || !assessment) return;
  CUSTOMER_ASSESSMENT_FIELDS.forEach((key) => {
    const input = form.querySelector(`[name="${key}"]`);
    if (!input) return;
    const value = String(assessment[key] || '');
    input.value = value;
    input.defaultValue = value;
    if (input.tagName === 'TEXTAREA') input.textContent = value;
    else input.setAttribute('value', value);
  });
  const name = visibleClientName();
  const companyInput = form.querySelector('[name="company_name"]');
  if (companyInput && name && (explicitInternalClientName() || !String(companyInput.value || '').trim())) {
    companyInput.value = name;
    companyInput.defaultValue = name;
    companyInput.setAttribute('value', name);
  }
}

function renderInternalClientIdentityHtml({compact = false} = {}){
  if (!isInternalProfile()) return '';
  const name = visibleClientName();
  if (!name) return '';
  const assessment = clientState.assessment || {};
  const source = visibleClientSource();
  const project = cleanDisplayName(clientState.project?.name);
  const planCount = Array.isArray(clientState.plans) ? clientState.plans.length : 0;
  const feedbackSummary = cleanDisplayName(assessment.best_recent_content)
    || cleanDisplayName(assessment.content_assets);
  const meta = [
    customerClientId(),
    source ? `source=${source}` : '',
    project ? `project=${project}` : '',
    planCount ? `${planCount}条计划` : '',
  ].filter(Boolean).join('｜');
  return `<div class="internal-client-identity ${compact ? 'compact' : ''}" data-client-id="${esc(customerClientId())}" data-client-source="${esc(source)}">
    <span>当前客户</span><strong>${esc(name)}</strong><em>${esc(meta)}</em>
    ${feedbackSummary ? `<small>反馈摘要：${esc(feedbackSummary)}</small>` : ''}
  </div>`;
}

function renderInternalClientIdentity(){
  if (!isInternalProfile()) return;
  const html = renderInternalClientIdentityHtml();
  if (!html) return;
  const targets = ['#diagnosisWorkflow', '#internalResultSection', '#planSection', '#feedbackWorkflow'];
  targets.forEach((selector) => {
    const section = document.querySelector(selector);
    if (!section) return;
    let badge = section.querySelector('.internal-client-identity');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'internal-client-identity';
      const head = section.querySelector('.customer-section-head');
      section.insertBefore(badge, head || section.firstChild);
    }
    badge.outerHTML = html;
  });
}


function renderOutcomeCards(d){
  const cards = [
    ['本周计划', d.total_plans, ''],
    ['已发布', `${d.published_plans}/${d.total_plans || 0}`, ''],
    ['待回填', missingFeedbackCount(), missingFeedbackCount() ? 'warn' : ''],
    ['有效咨询', d.total_consultations, ''],
    ['闭环率', pct(d.feedback_rate), ''],
  ];
  return cards.map(([k,v,cls])=>`<div class="war-metric ${cls}"><div class="num">${v}</div><div class="name">${k}</div></div>`).join('');
}

function renderDashboard(d){
  const el = $('#metricCards');
  if (!clientState.diagnosis) {
    el.innerHTML = '';
    return;
  }
  const cards = [
    ['本轮成果', `${d.published_plans}/${d.total_plans}`],
    ['计划数', d.total_plans],
    ['已发布', d.published_plans],
    ['回填率', pct(d.feedback_rate)],
    ['总曝光', d.total_views],
    ['总互动', d.total_interactions],
    ['咨询/咨询', d.total_consultations],
    ['动态闭环分', dynamicLoopScore()],
  ].map(([k,v], index)=>`<div class="card metric-card ${index === 0 ? 'metric-primary' : ''}"><span>${k}</span><b>${v}</b></div>`).join('');
  el.innerHTML = '';
}

function renderWorkflowVisibility(){
  if (isInternalStandaloneRoute()) {
    renderGenerationWorkbenchRoute();
    return;
  }
  const hasPlans = clientState.plans.length > 0;
  const hint = $('#feedbackHint');
  const workflow = $('#feedbackWorkflow');
  const planSection = $('#planSection');
  const internalResult = $('#internalResultSection');
  const dashboardVisible = isInternalProfile() && hasCustomerDetailState();
  const detailPanel = $('#customerDetailDashboard');
  if (detailPanel) detailPanel.hidden = !(isInternalProfile() && !isGenerationWorkbenchRoute() && hasCustomerDetailState());
  if (planSection) {
    planSection.hidden = isInternalProfile() ? true : (!hasPlans || clientState.project_stage === '未诊断');
  }
  if (internalResult) internalResult.hidden = !clientState.diagnosis || clientState.project_stage === '未诊断' || (isInternalProfile() && dashboardVisible);
  if (hint) hint.hidden = true;
  if (workflow) {
    workflow.hidden = isInternalProfile() ? true : (!hasPlans || clientState.project_stage === '未诊断');
  }
  const diagnosisWorkflow = $('#diagnosisWorkflow');
  if (diagnosisWorkflow) {
    if (isInternalProfile()) {
      const detailVisible = hasCustomerDetailState();
      const editRequested = customerDetailEditMode || String(location.hash || '') === '#diagnosisWorkflow';
      diagnosisWorkflow.hidden = detailVisible && !editRequested;
    } else {
      diagnosisWorkflow.hidden = clientState.project_stage !== '未诊断';
    }
  }
  if (isInternalProfile()) {
    const step = clientState.project_stage === '未诊断' ? 1 : (clientState.feedback.length ? 3 : 2);
    document.querySelectorAll('#internalApp .customer-progress-strip .cps-item').forEach((item) => {
      const n = Number(item.dataset.step);
      item.classList.toggle('cps-done', n < step);
      item.classList.toggle('cps-active', n === step);
    });
  }
}

function internalOpsAvailable(){
  const hasPlans = Array.isArray(clientState.plans) && clientState.plans.length > 0 && clientState.project_stage !== '未诊断';
  return [
    { key: 'plans', label: '内容计划', ok: hasPlans },
    { key: 'feedback', label: '回填与复盘', ok: hasPlans },
    { key: 'feishu', label: '飞书协同', ok: Boolean(clientState.project?.id) },
  ];
}

function renderInternalOpsTabs(){
  const tabbar = $('#internalOpsTabbar');
  if (!tabbar) return;
  const panels = [
    ['plans', '#planSection'],
    ['feedback', '#feedbackWorkflow'],
    ['feishu', '#feishuCollaborationPanel'],
  ];
  if (!isInternalProfile() || isGenerationWorkbenchRoute()) {
    tabbar.hidden = true;
    panels.forEach(([, sel]) => {
      const el = $(sel);
      if (el) el.hidden = true;
    });
    return;
  }
  const tabs = internalOpsAvailable();
  const available = tabs.filter((tab) => tab.ok);
  if (!available.length) {
    tabbar.hidden = true;
    panels.forEach(([, sel]) => {
      const el = $(sel);
      if (el) el.hidden = true;
    });
    return;
  }
  const current = tabs.find((tab) => tab.key === internalOpsTab && tab.ok) || available[0];
  internalOpsTab = current.key;
  tabbar.hidden = false;
  tabbar.innerHTML = tabs.map((tab) => `<button type="button" class="internal-ops-tab ${tab.key === internalOpsTab ? 'is-active' : ''}" data-ops-tab="${tab.key}" ${tab.ok ? '' : 'disabled'}>${esc(tab.label)}</button>`).join('');
  panels.forEach(([key, sel]) => {
    const el = $(sel);
    if (el) el.hidden = key !== internalOpsTab;
  });
}

function openInternalOpsTab(key, scrollSelector = ''){
  if (!internalOpsAvailable().some((tab) => tab.key === key && tab.ok)) return;
  internalOpsTab = key;
  renderInternalOpsTabs();
  if (scrollSelector) {
    const el = document.querySelector(scrollSelector);
    if (el) {
      el.hidden = false;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}



function fieldRow(label, value){
  return `<div class="kv"><span>${esc(label)}</span><strong>${esc(value || '未填写')}</strong></div>`;
}

function hasMetricValue(value){
  return value !== null && value !== undefined && String(value).trim() !== '';
}
function metricDisplay(value){
  return hasMetricValue(value) ? compactNumber(value) : '未提供';
}
function feedbackMetricPill(label, value, type = ''){
  const missing = !hasMetricValue(value);
  return `<span class="refill-metric ${esc(type)} ${missing ? 'is-missing' : ''}"><em>${esc(label)}</em><strong>${esc(metricDisplay(value))}</strong></span>`;
}
function feedbackMetricSet(item = {}){
  return [
    feedbackMetricPill('曝光', playbackValue(item), 'exposure'),
    feedbackMetricPill('点赞', item.likes, 'like'),
    feedbackMetricPill('收藏', item.favorites, 'favorite'),
    feedbackMetricPill('评论', item.comments, 'comment'),
    feedbackMetricPill('分享', item.shares, 'share'),
    feedbackMetricPill('咨询', item.consultations, 'consult'),
  ].join('');
}
function feedbackConclusion(item = {}){
  if (!hasMetricValue(item.publish_link)) return '缺少发布链接，暂不进入闭环判断';
  if (num(item.consultations) > 0) return '有咨询信号：优先复制同类角度并补信任证据';
  if (interactions(item) > 0) return '有互动无咨询：下一轮强化痛点表达和咨询入口';
  if (playbackValue(item) > 0) return '有曝光但互动弱：优先调整标题、封面或开头';
  return '样本不足：等待补齐曝光和互动数据';
}
function selectedRefillPlan(){
  const planId = $('#feedbackForm [name=content_plan_id]')?.value || latestFeedbackRows()[0]?.content_plan_id || clientState.plans.find((plan)=>plan.publish_link)?.id || clientState.plans[0]?.id;
  return internalPlanById(planId) || clientState.plans[0] || null;
}
function selectedRefillFeedback(plan = selectedRefillPlan()){
  if (!plan) return latestFeedbackRows()[0] || null;
  return latestFeedbackRows().find((item)=>samePlanId(item.content_plan_id, plan.id)) || null;
}
function renderRefillCockpit(){
  const box = $('#refillCockpit');
  if (!box || !isInternalProfile()) return;
  const plan = selectedRefillPlan();
  const feedback = selectedRefillFeedback(plan);
  const review = clientState.review || autoReviewFromFeedback();
  const stage = $('#feedbackForm [name=feedback_stage]')?.value || feedback?.feedback_stage || 'T+24';
  const action = (review?.next_actions || clientDashboard().next_suggestion || '先选择已发布内容并补齐回填指标').replace('加码「」同类角度', '加码「最高咨询内容」同类角度');
  const judgment = review?.winner_topic || feedbackConclusion(feedback || {});
  box.innerHTML = `<div class="refill-cockpit-main">
    <div><span>当前选中内容</span><strong>${esc(plan ? `#${planDisplayNumber(plan)} ${plan.topic || '未命名内容'}` : '尚未选择内容')}</strong><em>${esc(plan?.platform || '数据来源：内容计划')}</em></div>
    <div><span>回填时间点</span><strong>${esc(stage)}</strong><em>来源：本次回填表单 / 最新记录</em></div>
    <div><span>系统判断</span><strong>${esc(judgment || '等待回填数据')}</strong><em>来源：周复盘 / 回填指标</em></div>
    <div><span>下一步动作</span><strong>${esc(action)}</strong><em>来源：复盘结论</em></div>
  </div><div class="refill-cockpit-metrics">${feedback ? feedbackMetricSet(feedback) : feedbackMetricSet({})}</div>`;
}

function renderFeedbackEvidenceRows(){
  const rows = latestFeedbackRows().slice().sort((a, b) => (stageRank(b.feedback_stage) - stageRank(a.feedback_stage)) || compareTimestampDesc(a.created_at, b.created_at));
  const visibleRows = rows.slice(0, 5);
  const review = latestReviewEvidence();
  if (!rows.length && !review) return '<div class="empty">暂无内容复盘依据。发布后从计划卡片进入回填，系统会把最新反馈用于今日动作和下一步判断。</div>';
  const reviewHtml = review ? `<div class="pain-box review-evidence"><span>最新复盘判断</span><p><strong>胜出主题：</strong>${esc(review.winner_topic || '暂无')}｜<strong>瓶颈：</strong>${esc(review.bottleneck || '未生成')}</p><p>${esc((review.next_actions || '').replace('加码「」同类角度', '加码「最高咨询内容」同类角度'))}</p></div>` : '';
  const rowsHtml = visibleRows.map((f)=>{
    const plan = clientState.plans.find((p)=>Number(p.id) === Number(f.content_plan_id));
    return `<div class="feedback-evidence-row">
      <div><strong>#${esc(planDisplayNumber(f.content_plan_id))} ${esc(plan?.topic || '已回填内容')}</strong><span>${esc(f.feedback_stage || 'T+24')} · ${esc(f.created_at || '')}</span></div>
      <div class="feedback-evidence-metrics"><span>后台播放 ${compactNumber(playbackValue(f))}</span><span>互动 ${compactNumber(interactions(f))}</span><span>咨询 ${num(f.consultations)}</span></div>
      <p>${esc(f.notes || '无备注')}</p>
    </div>`;
  }).join('');
  const moreHint = rows.length > visibleRows.length ? `<div class="small">已折叠 ${rows.length - visibleRows.length} 条历史反馈，避免页面无限拉长；完整记录见上方“回填记录”。</div>` : '';
  return `${reviewHtml}<div class="feedback-evidence-list">${rowsHtml}</div>${moreHint}`;
}

function snapshotItem(label, value){
  return `<li><span>${esc(label)}</span><strong>${esc(value || '未填写')}</strong></li>`;
}
function renderCustomerSnapshot(a){
  const el = $('#clientSnapshot');
  if (!el) return;
  if (!a) {
    el.innerHTML = '<div class="empty">暂无客户数据，提交体检后这里会显示本次诊断依据。</div>';
    return;
  }
  const d = clientState.diagnosis || {};
  const clientRows = [
    ['行业', a.industry],
    ['目标', a.main_goal],
    ['目标客户', a.target_customer],
    ['当前平台', a.current_channels],
    ['最大问题', a.biggest_problem],
    ['内容资产', a.content_assets],
  ];
  const diagnosisRows = [
    ['阶段', d.stage || clientState.project_stage],
    ['策略清晰度', d.strategy_score ?? d.score ? `${d.strategy_score ?? d.score}/100` : '未生成'],
    ['核心判断', d.insight],
    ['下一步动作', d.next_step || d.weekly_action],
  ];
  const fullClientRows = [
    ['产品/服务入口', a.offer],
    ['发布频率', a.posting_frequency],
    ['月预算', a.monthly_budget],
    ['决策周期', a.decision_cycle],
    ['联系人', a.contact],
    ['对标账号参考', hasBenchmark(a.benchmark) ? `${a.benchmark.platform || '未标注平台'}｜${(a.benchmark.accounts || []).length} 个账号` : '未填写'],
  ];
  el.innerHTML = `<div class="snapshot-card evidence-split-card client-snapshot-readable">
    <div class="snapshot-title">
      <strong>${esc(customerDisplayName(a, clientState.project))}</strong>
      <span>${esc(a.created_at || '本地暂存')}</span>
    </div>
    <div class="evidence-index"><span>诊断依据</span>${evidenceLink('evidence-k','客户输入')}${evidenceLink('evidence-v','系统判断')}</div>
    <div class="client-snapshot-summary">
      <section class="readable-evidence-card evidence-k" id="evidence-k">
        <div class="evidence-label"><b>客</b><span>客户输入摘要</span></div>
        <ul>${clientRows.map(([label, value]) => snapshotItem(label, value)).join('')}</ul>
        <div class="readable-note"><span>客户核心痛点</span><p>${esc(a.customer_pain || '未填写')}</p></div>
      </section>
      <section class="readable-evidence-card evidence-v" id="evidence-v">
        <div class="evidence-label"><b>系</b><span>系统诊断摘要</span></div>
        <ul>${diagnosisRows.map(([label, value]) => snapshotItem(label, value)).join('')}</ul>
        <div class="readable-note"><span>风险提醒</span><p>${esc(d.risk_warning || '未生成风险提醒')}</p></div>
      </section>
    </div>
    <details class="snapshot-more-details">
      <summary>查看完整客户输入</summary>
      <div class="readable-detail-grid">
        ${fullClientRows.map(([label, value]) => fieldRow(label, value)).join('')}
        <div class="pain-box"><span>评分说明</span><p>${esc(d.score_note || '诊断分与闭环分需要由客户输入、发布计划、反馈回填和复盘数据共同支撑。')}</p></div>
        ${hasBenchmark(a.benchmark) ? `<div class="pain-box"><span>对标账号备注</span><p>${esc([a.benchmark.notes, a.benchmark.sample_content].filter(Boolean).join('｜'))}</p></div>` : ''}
      </div>
    </details>
  </div>`;
}

function renderFirstLinkGate(){
  const el = $('#firstLinkGate');
  if (!el) return;
  el.innerHTML = '';
}

function renderAccountSetup(setup){
  if (!setup) return '';
  return `<div class="warning account-setup">
    <div class="small">账号冷启动配置 · 发布前门禁</div>
    <p><strong>账号名：</strong>${esc(setup.account_name || '')}</p>
    <p><strong>定位：</strong>${esc(setup.positioning || '')}</p>
    <p><strong>简介：</strong><br>${(setup.bio_lines || []).map(esc).join('<br>')}</p>
    <p><strong>主页关键词：</strong>${esc((setup.homepage_keywords || []).join(' / '))}</p>
    <p><strong>头像方向：</strong>${esc(setup.avatar_direction || '')}</p>
    <p><strong>起步主平台：</strong>${esc(setup.starting_platform?.platform || '')}｜${esc(setup.starting_platform?.reason || '')}</p>
    <p><strong>平台表达规则：</strong>${esc(setup.starting_platform?.rule || '')}</p>
    <p><strong>称呼门禁：</strong>${esc(setup.naming_warning || '')}</p>
  </div>`;
}

function renderSmartDiagnosisModule(context){
  if (!context) return '';
  const missing = Array.isArray(context.missing_info) && context.missing_info.length
    ? `<div class="smart-missing"><span>信息缺口</span><strong>${context.missing_info.map(esc).join(' / ')}</strong></div>`
    : '<div class="smart-missing ok"><span>信息缺口</span><strong>当前信息足够生成第一轮内容实验</strong></div>';
  const gates = Array.isArray(context.risk_gates) ? context.risk_gates : [];
  return `<div class="warning smart-diagnosis-module">
    <div class="small">内测智能诊断内核</div>
    <div class="smart-grid">
      <div><span>业务类型</span><strong>${esc(context.business_type || '未识别')}</strong></div>
      <div><span>产品/服务判断</span><strong>${esc(context.category || context.primary_offer || '未识别')}</strong></div>
      <div><span>交易动作</span><strong>${esc(context.conversion_action || '待判断')}</strong></div>
      <div><span>置信度</span><strong>${Math.round(Number(context.confidence || 0) * 100)}%</strong></div>
    </div>
    <p><strong>客户决策场景：</strong>${esc(context.customer_decision_scene || '')}</p>
    <p><strong>内容任务：</strong>${esc(context.content_task || '')}</p>
    ${missing}
    ${gates.length ? `<ul class="smart-risk-gates">${gates.map((item)=>`<li>${esc(item)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function renderInternalPublicResult(d, benchmarkModule = '', extraModules = ''){
  const assessment = clientState.assessment || {};
  const publicSuggestion = buildCustomerSuggestion(assessment, d, clientState.plans || []);
  return '<div class="internal-public-result">'
    + '<div class="customer-result">' + publicSuggestion + '</div>'
    + '<details class="diagnosis-more internal-diagnosis-evidence">'
    + '<summary>查看内部诊断依据、AI采集和误判风险</summary>'
    + '<div class="diagnosis-card compact-diagnosis">'
    + '<div class="small">' + esc(d.version_label || VERSION_LABEL) + '</div>'
    + '<div class="score-row">'
    + '<div class="score"><span>策略清晰度</span><strong>' + esc(d.strategy_score ?? d.score) + '</strong><em>/100</em></div>'
    + '<div class="score"><span>动态闭环分</span><strong>' + esc(dynamicLoopScore()) + '</strong><em>/100</em></div>'
    + '<span class="badge">' + esc(d.stage) + '</span>'
    + '</div>'
    + '<div><div class="small">当前最大问题</div><div class="big-action">' + esc(d.priority_problem) + '</div></div>'
    + '<div><div class="small">核心诊断</div><p>' + esc(d.insight) + '</p></div>'
    + '<div><div class="small">下一步</div><p><strong>' + esc(d.next_step || d.weekly_action) + '</strong></p></div>'
    + '<div class="warning"><div class="small">评分说明</div><p>' + esc(d.score_note || '闭环分必须由发布反馈和复盘数据驱动。 ') + '</p></div>'
    + benchmarkModule + extraModules
    + '<div><div class="small">本周动作</div><p><strong>' + esc(d.weekly_action) + '</strong></p></div>'
    + '<div class="warning"><div class="small">风险提醒</div><p>' + esc(d.risk_warning) + '</p></div>'
    + '</div></details></div>';
}

function renderDiagnosis(d){
  if(!d){ $('#latestDiagnosis').innerHTML='<div class="empty">填写左侧 5 个问题后，这里会生成内容方向、7天发布计划和发布后要看的关键数据。</div>'; return; }
  const platformRecommendations = parsePlatformRecommendations(d.platform_recommendations);
  const platformModule = platformRecommendations ? `<div class="warning">
    <div class="small">平台发布建议</div>
    <p>${esc(platformRecommendations.strategy || '')}</p>
    ${renderPlatformGroup('本账号优先平台', platformRecommendations.primary)}
    ${renderPlatformGroup('辅助平台', platformRecommendations.support)}
    ${renderPlatformGroup('目标客户可能适用平台（不是本账号发布平台）', platformRecommendations.client_platforms)}
    ${renderPlatformGroup('暂不建议', platformRecommendations.avoid)}
  </div>` : '';
  const benchmarkModule = renderBenchmarkReference(d.benchmark_reference);
  const smartModule = renderSmartDiagnosisModule(d.smart_context);
  const extraModules = `${smartModule}${renderAccountSetup(d.account_setup)}${platformModule}`;
  if (isInternalProfile()) {
    $('#latestDiagnosis').innerHTML = renderInternalPublicResult(d, benchmarkModule, extraModules);
    return;
  }
  $('#latestDiagnosis').innerHTML = `<div class="diagnosis-card compact-diagnosis">
    <div class="small">${esc(d.version_label || VERSION_LABEL)}</div>
    <div class="score-row">
      <div class="score"><span>策略清晰度</span><strong>${d.strategy_score ?? d.score}</strong><em>/100</em></div>
      <div class="score"><span>动态闭环分</span><strong>${dynamicLoopScore()}</strong><em>/100</em></div>
      <span class="badge">${esc(d.stage)}</span>
    </div>
    <div><div class="small">当前最大问题</div><div class="big-action">${esc(d.priority_problem)}</div></div>
    <div><div class="small">核心诊断</div><p>${esc(d.insight)}</p></div>
    <div><div class="small">下一步</div><p><strong>${esc(d.next_step || d.weekly_action)}</strong></p></div>
    ${benchmarkModule}
    <details class="diagnosis-more">
      <summary>查看补充依据</summary>
      <div class="warning"><div class="small">评分说明</div><p>${esc(d.score_note || '闭环分必须由发布反馈和复盘数据驱动。')}</p></div>
      ${extraModules}
      <div><div class="small">本周动作</div><p><strong>${esc(d.weekly_action)}</strong></p></div>
      <div class="warning"><div class="small">风险提醒</div><p>${esc(d.risk_warning)}</p></div>
    </details>
  </div>`;
}

function hasFeedbackForPlan(planId){
  return clientState.feedback.some((f)=>samePlanId(f.content_plan_id, planId) && f.publish_link);
}
function planUiMeta(plan, firstOpenId){
  const feedback = clientState.feedback.find((f)=>samePlanId(f.content_plan_id, plan.id));
  if (feedback) return {label:`已回填 ${feedback.feedback_stage || 'T+24'}`, className:'plan-done', action:'查看/补充', tone:'green'};
  if (plan.publish_link || plan.status === '已发布') return {label:'待回填 T+72', className:'plan-next', action:'回填数据', tone:'orange'};
  if (samePlanId(plan.id, firstOpenId)) return {label:'今日优先', className:'plan-next', action:'复制/回填', tone:'orange'};
  return {label:'待发布', className:'plan-pending', action:'发布后回填', tone:'default'};
}

function samePlanId(left, right){
  const a = String(left ?? '').trim();
  const b = String(right ?? '').trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

function planIdValue(planOrId){
  const id = typeof planOrId === 'object' ? planOrId?.id : planOrId;
  return String(id ?? '').trim();
}

function planDisplayNumber(planOrId){
  const id = planIdValue(planOrId);
  const index = clientState.plans.findIndex((item)=>samePlanId(item.id, id));
  return index >= 0 ? index + 1 : (id || '');
}

function renderPlans(plans){
  const summaryEl = $('#plansSummary');
  const firstOpen = plans.find((p)=>!(p.status === '已发布' || p.publish_link || hasFeedbackForPlan(p.id)));
  const feedbackByPlan = (id) => clientState.feedback.find((f)=>samePlanId(f.content_plan_id, id));
  if (summaryEl) {
    summaryEl.innerHTML = plans.slice(0, 3).map((p)=>{
      const meta = planUiMeta(p, firstOpen?.id);
      const f = feedbackByPlan(p.id);
      const stats = f ? `<div class="experiment-stats"><span>后台播放 <b>${compactNumber(playbackValue(f))}</b></span><span>收藏 <b>${num(f.favorites)}</b></span><span>咨询 <b>${num(f.consultations)}</b></span></div>` : `<div class="experiment-stats"><span>日期 <b>${esc(p.planned_date || '待定')}</b></span></div>`;
      return `<article class="experiment-card ${meta.className}">
        <div><div class="experiment-title">#${planDisplayNumber(p)} ${esc(p.topic)}</div><div class="experiment-meta"><span class="war-tag">${esc(p.platform)}</span><span class="war-tag">${esc(p.experiment_type || '策略测试')}</span><span class="war-tag ${meta.tone === 'orange' ? 'orange' : meta.tone === 'green' ? 'green' : ''}">${esc(meta.label)}</span></div><details class="experiment-detail"><summary>查看发布角度</summary><p>${esc(p.angle || '')}</p><p class="small">平台理由：${esc(p.why_platform_fit || '')}</p><p class="small">目标：${esc(Array.isArray(p.observe_metrics) ? p.observe_metrics.join(' / ') : (p.target_metric || '待观察'))}</p></details></div>
        <div class="experiment-side">${stats}<button class="small-btn js-prefill-feedback" type="button" data-plan-id="${esc(planIdValue(p))}">${esc(meta.action)}</button></div>
      </article>`;
    }).join('') || '<div class="empty">暂无计划，先提交一次快速体检。</div>';
  }
  $('#plansBody').innerHTML = plans.map(p=>{
    const meta = planUiMeta(p, firstOpen?.id);
    const quality = [p.publish_quality, p.quality_note].filter(Boolean).join('：');
    const publishLink = normalizeExternalUrl(p.publish_link);
    const linkHtml = publishLink ? `<a href="${esc(publishLink)}" target="_blank">发布链接已回填</a>` : '发布后需回填链接';
    const strategyQuality = p.strategy_quality && typeof p.strategy_quality === 'object' ? p.strategy_quality : {};
    const qualityEvidence = [strategyQuality.customer_language_used, strategyQuality.buyer_objection_used, strategyQuality.proof_asset_used]
      .filter(Boolean)
      .join('｜');
    const qualityDecision = strategyQuality.decision_rule || p.next_adjustment || '';
    return `<article class="full-plan-card ${meta.className}">
      <div class="full-plan-head">
        <div><span class="plan-index">#${planDisplayNumber(p)}</span><strong>${esc(p.topic)}</strong></div>
        <span class="war-tag ${meta.tone === 'orange' ? 'orange' : meta.tone === 'green' ? 'green' : ''}">${esc(meta.label)}</span>
      </div>
      <div class="full-plan-meta"><span>${esc(p.planned_date)}</span><span>${esc(p.platform)}</span><span>${esc(p.content_type || '')}</span></div>
      <div class="full-plan-body">
        <section><span>发布角度</span><p>${esc(p.angle)}</p></section>
        <section><span>平台策略</span><p>${esc(p.experiment_type || '策略测试')}｜${esc(p.why_platform_fit || '')}</p><em>${esc(p.platform_expression || '')}</em></section>
        <section><span>观察与调整</span><p>${esc(Array.isArray(p.observe_metrics) ? p.observe_metrics.join(' / ') : (p.target_metric || ''))}</p><em>${esc(p.next_adjustment || '')}</em></section>
        <section><span>合规承接</span><p>${esc(p.cta || '')}</p>${quality ? `<em>${esc(quality)}</em>` : ''}</section>
        <section><span>观察目标</span><p>${esc(p.content_hypothesis || p.target_metric || '')}</p><em>${linkHtml}</em></section>
        ${qualityEvidence || qualityDecision ? `<section><span>策略证据</span><p>${esc(qualityEvidence || '当前证据较少，先做小样本验证')}</p><em>${esc(qualityDecision)}</em></section>` : ''}
      </div>
      <div class="full-plan-actions"><button class="secondary js-prefill-feedback" type="button" data-plan-id="${esc(planIdValue(p))}">${esc(meta.action)}</button></div>
    </article>`;
  }).join('') || '<div class="empty">暂无计划</div>';
}

function renderFeedback(items){
  const sorted = (items || []).slice().sort((a, b) => compareTimestampDesc(a.created_at, b.created_at));
  $('#feedbackList').innerHTML = sorted.map(f=>{
    const plan = internalPlanById(f.content_plan_id) || {};
    const link = normalizeExternalUrl(f.publish_link || plan.publish_link || '');
    return `<article class="feedback-compare-card">
      <div class="feedback-compare-head">
        <div><span>内容标题</span><strong>#${esc(planDisplayNumber(f.content_plan_id))} ${esc(f.plan_topic || plan.topic || '已回填内容')}</strong></div>
        <em>${esc(plan.platform || f.platform || '未标注平台')}</em>
      </div>
      <div class="feedback-compare-meta"><span>${esc(f.feedback_stage || '未标注时间点')}</span><span>${esc(f.created_at || '保存时间未标注')}</span><span>数据源：回填记录</span></div>
      <div class="feedback-compare-metrics">${feedbackMetricSet(f)}</div>
      <div class="feedback-compare-bottom"><p>${esc(feedbackConclusion(f))}</p>${link ? `<a href="${esc(link)}" target="_blank" rel="noreferrer">查看发布链接</a>` : '<span class="warning">缺少发布链接</span>'}</div>
      <details class="feedback-record-detail"><summary>备注与来源</summary><p>${esc(f.notes || '无备注')}</p><span>content_plan_id=${esc(f.content_plan_id || '未绑定')}｜plan_binding_source=${esc(f.plan_binding_source || '未标注')}</span></details>
    </article>`;
  }).join('') || '<div class="empty">暂无记录。保存至少1条发布反馈后，系统会自动更新看板和周复盘。</div>';
}

function internalPublishedLinkOptions(){
  const options = [];
  const seen = new Set();
  const add = (item = {}, plan = {}, source = 'feedback') => {
    const link = normalizeExternalUrl(item.publish_link || plan.publish_link || '');
    const planId = planIdValue(plan?.id || item.content_plan_id);
    if (!link || !planId) return;
    const key = `${planId}|${link}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push({
      key,
      planId,
      link,
      title: item.plan_topic || plan.topic || `计划 #${planDisplayNumber(planId)}`,
      platform: plan.platform || item.platform || '未标注平台',
      publishedAt: item.published_at || item.created_at || plan.published_at || plan.planned_date || '',
      feedbackStage: item.feedback_stage || '',
      source,
    });
  };
  (clientState.plans || []).forEach((plan) => add(plan, plan, 'plan'));
  (clientState.feedback || []).forEach((feedback) => {
    const plan = internalPlanById(feedback.content_plan_id) || {};
    add(feedback, plan, 'feedback');
  });
  return options.sort((a, b) => compareTimestampDesc(a.publishedAt, b.publishedAt));
}

function renderPublishedLinkPicker(){
  const box = $('#publishedLinkPicker');
  if (!box || !isInternalProfile()) return;
  const options = internalPublishedLinkOptions();
  if (!options.length) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  const select = options.length > 1
    ? `<label class="published-link-select-label">选择已发布链接<select id="publishedLinkSelect"><option value="">选择已绑定链接后只补数据</option>${options.map((option)=>`<option value="${esc(option.key)}">${esc(option.title)}｜${esc(option.platform)}｜${esc(option.publishedAt || '发布时间未标注')}</option>`).join('')}</select></label>`
    : '';
  const cards = options.map((option)=>`<button class="published-link-card" type="button" data-published-link-key="${esc(option.key)}">
    <span class="published-link-card-top"><strong>${esc(option.title)}</strong><em>${esc(option.platform)}</em></span>
    <span class="published-link-url">${esc(normalizeExternalUrl(option.link))}</span>
    <span class="published-link-meta"><b>${esc(option.feedbackStage || '待补数据')}</b><i>发布时间：${esc(option.publishedAt || '未标注')}</i><i>来源：${esc(option.source === 'feedback' ? '历史回填' : '已发布计划')}</i></span>
  </button>`).join('');
  box.innerHTML = `<div class="published-link-picker-head"><strong>已发布样本池</strong><span>选择后自动绑定计划和链接，只补本次数据。</span></div>${select}<div class="published-link-card-list">${cards}</div>`;
}

function selectPublishedLink(key){
  const option = internalPublishedLinkOptions().find((item) => item.key === key);
  if (!option) return null;
  const form = $('#feedbackForm');
  const linkInput = form?.querySelector('[name=publish_link]');
  if (!form || !linkInput) return null;
  const plan = setInternalFeedbackPlan(option.planId, 'published_link_picker');
  linkInput.value = normalizeExternalUrl(option.link);
  linkInput.dispatchEvent(new Event('input', {bubbles:true}));
  linkInput.dispatchEvent(new Event('change', {bubbles:true}));
  form.dataset.selectedPublishedLinkKey = option.key;
  $$('#publishedLinkPicker [data-published-link-key]').forEach((card) => card.classList.toggle('is-selected', card.dataset.publishedLinkKey === option.key));
  const select = $('#publishedLinkSelect');
  if (select) select.value = option.key;
  const display = $('#selectedPlanDisplay');
  if (display) display.textContent = `已绑定：${option.title}｜${option.platform}｜${option.publishedAt || '发布时间未标注'}`;
  renderRefillCockpit();
  toast('已选择已发布链接，本次只需补充反馈数据。');
  return { option, plan };
}
window.selectPublishedLink = selectPublishedLink;

function renderReviewEvidencePanel(){
  const box = $('#reviewEvidenceBox');
  if (!box) return;
  box.innerHTML = renderFeedbackEvidenceRows();
}

function downloadDataBackup(){
  saveLocal();
  const blob = new Blob([JSON.stringify(clientState, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `enterprise-marketing-feedback-${localDateIso()}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('已导出本浏览器数据备份');
}

function importDataBackup(file){
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeState(JSON.parse(reader.result));
      if (!imported.diagnosis && !imported.plans.length && !imported.feedback.length) throw new Error('备份文件里没有可用诊断/计划/反馈数据');
      clientState = imported;
      saveLocal();
      renderAllFromClient();
      toast(`已导入：${clientState.feedback.length} 条反馈`);
    } catch (error) {
      toast(error.message || '导入失败，请检查备份文件');
    }
  };
  reader.readAsText(file);
}

window.downloadDataBackup = downloadDataBackup;
window.importDataBackup = importDataBackup;

function openClientEvidence(anchor){
  const isReviewEvidence = anchor === 'evidence-r';
  const details = isReviewEvidence ? $('#reviewEvidencePanel') : document.querySelector('.client-snapshot-panel');
  if (details) details.open = true;
  const target = isReviewEvidence ? details : (anchor ? document.getElementById(anchor) : details);
  window.setTimeout(() => (target || details)?.scrollIntoView({behavior:'smooth', block:'start'}), 40);
}
window.openClientEvidence = openClientEvidence;

function autoReviewFromFeedback(){
  if (!clientState.feedback.length) return null;
  return {...createLocalReview(), is_auto: true};
}

function renderReview(r){
  if(!r){ $('#reviewBox').innerHTML='<div class="review-empty"><span class="review-icon">⏳</span><div><strong>还没有可复盘的数据</strong><p>保存至少 1 条发布链接和反馈后，这里会自动生成周复盘。</p></div></div>'; return; }
  const action = (r.next_actions || '').replace('加码「」同类角度', '加码「最高咨询内容」同类角度');
  const interactionRate = num(r.total_views) ? Math.round((num(r.total_interactions) / num(r.total_views)) * 1000) / 10 : 0;
  const consultRate = num(r.total_views) ? Math.round((num(r.total_consultations) / num(r.total_views)) * 1000) / 10 : 0;
  $('#reviewBox').innerHTML = `<div class="review-card ${r.is_auto ? 'auto-review' : ''}">
    <div class="review-topline"><span class="review-icon">📊</span><div><strong>${r.is_auto ? '自动复盘' : '本周复盘'}</strong><span>${esc(r.week_start)} 至 ${esc(r.week_end)}</span></div></div>
    <div class="review-metric-grid">
      <div class="review-metric"><span>发布</span><strong>${compactNumber(r.total_posts)}</strong><em>条样本</em></div>
      <div class="review-metric"><span>曝光</span><strong>${compactNumber(r.total_views)}</strong><em>查看</em></div>
      <div class="review-metric"><span>互动</span><strong>${compactNumber(r.total_interactions)}</strong><em>${interactionRate}%</em></div>
      <div class="review-metric hot"><span>咨询</span><strong>${compactNumber(r.total_consultations)}</strong><em>${consultRate}%</em></div>
    </div>
    <div class="review-decision-grid">
      <div class="review-pill"><span>🏆 胜出主题</span><strong>${esc(r.winner_topic || '暂无')}</strong></div>
      <div class="review-pill"><span>🚧 当前瓶颈</span><strong>${esc(r.bottleneck || '未生成')}</strong></div>
    </div>
    <div class="review-next"><span>下一步</span><strong>${esc(action)}</strong></div>
  </div>`;
}

function nextSevenDate(offset = 1){
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localDateIso(date);
}

function planScoreFromFeedback(plan = {}, feedback = null){
  if (!feedback) return 0;
  return num(feedback.consultations) * 100 + interactions(feedback) * 4 + Math.round(playbackValue(feedback) / 80);
}

function topicVariant(topic = '', index = 0, review = null){
  const base = String(topic || '').trim() || '下一条内容';
  const winner = String(review?.winner_topic || '').trim();
  const suffixes = [
    '复盘：这条内容为什么值得继续发',
    '同类角度：换一个真实客户顾虑切入',
    '证据补强：增加案例、过程和咨询入口',
    '平台适配：同一主题分别改成短视频和图文',
    '转化承接：把咨询问题整理成下一条内容',
    '风险修正：把低互动内容换成更具体场景',
    '下周判断：保留数据对比再决定加码',
  ];
  if (winner && index < 3) return winner + '｜' + suffixes[index];
  return base + '｜' + suffixes[index % suffixes.length];
}

function buildNextSevenData(){
  const plans = Array.isArray(clientState.plans) ? clientState.plans : [];
  const feedback = latestFeedbackRows();
  const review = clientState.review || autoReviewFromFeedback() || createLocalReview();
  const byPlan = new Map(feedback.map((item) => [String(item.content_plan_id), item]));
  const scored = plans.map((plan) => ({
    plan,
    feedback: byPlan.get(String(plan.id)) || null,
    score: planScoreFromFeedback(plan, byPlan.get(String(plan.id)) || null),
  })).sort((a, b) => b.score - a.score);
  const winners = scored.filter((item) => item.score > 0).slice(0, 3);
  const pending = plans.filter((plan) => !byPlan.has(String(plan.id))).slice(0, 7);
  const sourcePlans = [...winners.map((item) => item.plan), ...pending, ...plans].filter(Boolean);
  const unique = [];
  sourcePlans.forEach((plan) => {
    const key = String(plan.id || plan.topic || unique.length);
    if (!unique.some((item) => String(item.id || item.topic) === key)) unique.push(plan);
  });
  const totalViews = feedback.reduce((sum, item) => sum + playbackValue(item), 0);
  const totalConsults = feedback.reduce((sum, item) => sum + num(item.consultations), 0);
  const best = winners[0];
  const strategy = totalConsults > 0
    ? '复制高咨询主题，连续 3 天做同类角度，再用 4 天验证平台适配。'
    : totalViews > 0
      ? '先修正标题、封面和开头，提高互动后再判断是否加码。'
      : '暂无有效回填，下一轮先补齐发布链接和 T+72/T+7 数据。';
  const rows = Array.from({length: 7}, (_, index) => {
    const basePlan = unique[index % Math.max(unique.length, 1)] || {};
    const sourceFeedback = byPlan.get(String(basePlan.id)) || best?.feedback || null;
    const expectedViews = sourceFeedback ? Math.max(300, Math.round(playbackValue(sourceFeedback) * (index < 3 ? 1.08 : 0.86))) : 300 + index * 80;
    const expectedConsultations = sourceFeedback ? Math.max(0, Math.round(num(sourceFeedback.consultations) * (index < 3 ? 1.15 : 0.75))) : 0;
    return {
      day: 'D+' + (index + 1),
      date: nextSevenDate(index + 1),
      topic: topicVariant(basePlan.topic, index, review),
      platform: basePlan.platform || (index % 3 === 0 ? '抖音' : index % 3 === 1 ? '小红书' : '视频号'),
      experiment: index < 3 ? '复制/加码' : index < 5 ? '平台适配' : '修正重测',
      evidence: sourceFeedback ? '参考回填：后台播放 ' + compactNumber(playbackValue(sourceFeedback)) + ' / 咨询 ' + compactNumber(sourceFeedback.consultations) : '缺少回填样本，按当前计划预测',
      expected_views: expectedViews,
      expected_consultations: expectedConsultations,
    };
  });
  return {
    status: feedback.length ? 'ready' : 'needs_feedback',
    strategy,
    review,
    rows,
    evidence_count: feedback.length,
    winner_topic: best?.plan?.topic || review?.winner_topic || '',
  };
}

function renderNextSevenDataPage(){
  const box = $('#nextSevenDataPage');
  if (!box) return;
  if (!clientState.diagnosis) {
    box.innerHTML = '';
    box.hidden = true;
    return;
  }
  const data = buildNextSevenData();
  box.hidden = false;
  const statusBadge = data.status === 'ready'
    ? '<span class="next-seven-badge green">已接入回填数据</span>'
    : '<span class="next-seven-badge orange">等待发布反馈</span>';
  const cards = data.rows.map((row) => '<article class="next-seven-card">'
    + '<div class="next-seven-card-top"><span>' + esc(row.day) + ' · ' + esc(row.date) + '</span><em>' + esc(row.experiment) + '</em></div>'
    + '<strong>' + esc(row.topic) + '</strong>'
    + '<p>' + esc(row.platform) + '｜' + esc(row.evidence) + '</p>'
    + '<div class="next-seven-metrics"><span>预计曝光 ' + compactNumber(row.expected_views) + '</span><span>预计咨询 ' + compactNumber(row.expected_consultations) + '</span></div>'
    + '</article>').join('');
  box.innerHTML = '<div class="next-seven-head">'
    + '<div><p class="eyebrow">NEXT 7 DAYS / 数据预测</p><h3>下一个七天数据</h3><span>基于当前计划、回填数据和周复盘，生成下一轮内容实验结构；只做决策建议，不代发。</span></div>'
    + '<button class="review-primary-btn" type="button" onclick="renderNextSevenDataPage()">刷新下一个七天</button>'
    + '</div><div class="next-seven-summary">'
    + '<div>' + statusBadge + '<strong>' + esc(data.strategy) + '</strong></div>'
    + '<div><span>依据样本</span><strong>' + compactNumber(data.evidence_count) + ' 条回填</strong></div>'
    + '<div><span>胜出主题</span><strong>' + esc(data.winner_topic || '暂无，先补回填') + '</strong></div>'
    + '</div><div class="next-seven-grid">' + cards + '</div>';
}
window.renderNextSevenDataPage = renderNextSevenDataPage;

function prefillFeedback(id){
  const planId = planIdValue(id);
  const form = $('#feedbackForm');
  const workflow = $('#feedbackWorkflow');
  const plan = clientState.plans.find((item) => samePlanId(item.id, planId));
  const existingFeedback = latestFeedbackRows().find((item) => samePlanId(item.content_plan_id, planId));
  const planInput = form?.querySelector('[name=content_plan_id]');
  const planDisplay = $('#selectedPlanDisplay');
  const linkInput = form?.querySelector('[name=publish_link]');
  const stageInput = form?.querySelector('[name=feedback_stage]');
  const notesInput = form?.querySelector('[name=notes]');
  if (!form || !planInput) return;
  if (workflow) workflow.hidden = false;
  setInternalFeedbackPlan(planId, 'manual_card');
  if (linkInput) linkInput.value = normalizeExternalUrl(existingFeedback?.publish_link || plan?.publish_link || '');
  if (stageInput && existingFeedback?.feedback_stage) stageInput.value = existingFeedback.feedback_stage;
  ['views','likes','comments','favorites','shares','consultations'].forEach((key) => {
    const input = form.querySelector(`[name=${key}]`);
    if (input && existingFeedback && existingFeedback[key] !== undefined) input.value = existingFeedback[key];
  });
  if (notesInput && existingFeedback?.notes) notesInput.value = existingFeedback.notes;
  planInput.dispatchEvent(new Event('input', {bubbles:true}));
  planInput.dispatchEvent(new Event('change', {bubbles:true}));
  const displayNumber = planDisplayNumber(planId);
  workflow?.classList.remove('is-highlighted');
  void workflow?.offsetWidth;
  workflow?.classList.add('is-highlighted');
  (workflow || form).scrollIntoView({behavior:'smooth', block:'start'});
  window.setTimeout(()=>{
    linkInput?.focus();
    toast(`已选择计划 #${displayNumber || planInput.value}，请填写发布链接和数据。`);
  }, 260);
  window.setTimeout(()=>workflow?.classList.remove('is-highlighted'), 1900);
}
window.prefillFeedback = prefillFeedback;

function internalPlanById(planId){
  const id = planIdValue(planId);
  return clientState.plans.find((item) => samePlanId(item.id, id)) || null;
}

function renderedInternalPlanIds(){
  const ids = [];
  $$('#plansSummary .js-prefill-feedback[data-plan-id], #plansBody .js-prefill-feedback[data-plan-id]').forEach((button) => {
    const id = planIdValue(button.dataset.planId);
    if (id && !ids.some((item) => samePlanId(item, id))) ids.push(id);
  });
  return ids;
}

function setInternalFeedbackPlan(planId, source = 'manual_card'){
  const plan = internalPlanById(planId);
  const form = $('#feedbackForm');
  const planInput = form?.querySelector('[name=content_plan_id]');
  const planDisplay = $('#selectedPlanDisplay');
  if (!form || !planInput || !plan) return null;
  const selectedPlanId = planIdValue(plan);
  planInput.value = selectedPlanId;
  form.dataset.planBindingSource = source;
  const displayNumber = planDisplayNumber(selectedPlanId);
  if (planDisplay) {
    const topic = plan.topic ? ` · ${plan.topic}` : '';
    planDisplay.textContent = displayNumber ? `计划 #${displayNumber}${topic}` : customerPlanLabel(plan);
  }
  $$('#plansSummary .experiment-card, #plansBody .full-plan-card').forEach((card) => {
    const button = card.querySelector('.js-prefill-feedback[data-plan-id]');
    card.classList.toggle('is-selected', Boolean(button && samePlanId(button.dataset.planId, selectedPlanId)));
  });
  planInput.dispatchEvent(new Event('input', {bubbles:true}));
  planInput.dispatchEvent(new Event('change', {bubbles:true}));
  renderRefillCockpit();
  return plan;
}

function resolveInternalFeedbackPlan(data = {}){
  const currentPlan = internalPlanById(data.content_plan_id);
  if (currentPlan) return {plan: currentPlan, source: $('#feedbackForm')?.dataset.planBindingSource || 'manual_card'};
  const link = normalizeExternalUrl(data.publish_link || '');
  if (link) {
    const byPlanLink = clientState.plans.find((plan) => normalizeExternalUrl(plan.publish_link || '') === link);
    if (byPlanLink) return {plan: byPlanLink, source: 'auto_publish_link_plan'};
    const byFeedbackLink = latestFeedbackRows().find((item) => normalizeExternalUrl(item.publish_link || '') === link);
    const linkedPlan = byFeedbackLink ? internalPlanById(byFeedbackLink.content_plan_id) : null;
    if (linkedPlan) return {plan: linkedPlan, source: 'auto_publish_link_feedback'};
  }
  const visibleIds = renderedInternalPlanIds();
  const visiblePlans = visibleIds.map(internalPlanById).filter(Boolean);
  const unfinishedPublished = visiblePlans.find((plan) =>
    (plan.publish_link || plan.status === '已发布') &&
    !latestFeedbackRows().some((item) => samePlanId(item.content_plan_id, plan.id))
  );
  if (unfinishedPublished) return {plan: unfinishedPublished, source: 'auto_visible_published_unfilled'};
  const firstOpen = visiblePlans.find((plan) => !latestFeedbackRows().some((item) => samePlanId(item.content_plan_id, plan.id)));
  if (firstOpen) return {plan: firstOpen, source: 'auto_visible_unfilled'};
  if (visiblePlans.length === 1) return {plan: visiblePlans[0], source: 'auto_single_visible_plan'};
  if (visiblePlans[0]) return {plan: visiblePlans[0], source: 'auto_visible_first_fallback'};
  return {plan: null, source: ''};
}

function initPlanFeedbackButtons(){
  document.addEventListener('click', (event) => {
    const linkCard = event.target?.closest?.('#publishedLinkPicker .published-link-card[data-published-link-key]');
    if (linkCard) {
      event.preventDefault();
      selectPublishedLink(linkCard.dataset.publishedLinkKey);
      return;
    }
    const button = event.target?.closest?.('.js-prefill-feedback[data-plan-id]');
    if (!button) return;
    event.preventDefault();
    prefillFeedback(button.dataset.planId);
  });
  document.addEventListener('change', (event) => {
    if (event.target?.id !== 'publishedLinkSelect') return;
    if (event.target.value) selectPublishedLink(event.target.value);
  });
}

function createLocalReview(){
  const rows = latestFeedbackRows().map((feedback) => ({
    ...feedback,
    topic: clientState.plans.find((plan) => plan.id === Number(feedback.content_plan_id))?.topic || '',
  }));
  const total_posts = rows.length;
  const total_views = rows.reduce((sum, item) => sum + playbackValue(item), 0);
  const total_interactions = rows.reduce((sum, item) => sum + interactions(item), 0);
  const total_consultations = rows.reduce((sum, item) => sum + num(item.consultations), 0);
  const winner = rows.slice().sort((a, b) =>
    (num(b.consultations) - num(a.consultations)) ||
    ((num(b.favorites) + num(b.comments)) - (num(a.favorites) + num(a.comments))) ||
    (playbackValue(b) - playbackValue(a))
  )[0];
  const day = new Date();
  const shDay = new Date(day.toLocaleString('en-US', {timeZone:'Asia/Shanghai'}));
  const monday = new Date(shDay);
  monday.setDate(shDay.getDate() - ((shDay.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
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
  return {
    week_start: localDateIso(monday),
    week_end: localDateIso(sunday),
    total_posts, total_views, total_interactions, total_consultations,
    winner_topic: winnerTopic, bottleneck, next_actions,
    created_at: localTimestamp(),
  };
}

async function regenerateCurrentDiagnosis(){
  if (!clientState.assessment) { toast('当前没有客户信息，先提交一次诊断。'); return; }
  const reason = window.prompt('重新诊断原因', '客户补充信息/项目修正') || '项目重新诊断';
  await withBusy(null, '重新诊断中...', async () => {
    const result = await api('/api/assessments', {method:'POST', body: JSON.stringify({...clientState.assessment, client_mode: 'internal_regenerate', source: 'internal_regenerate'})});
    clientState = buildVersionedProjectState(result, clientState.assessment, clientState.source || 'internal_regenerate', clientState, reason);
    saveLocal();
    renderAllFromClient();
    toast(`已生成诊断 v${clientState.diagnosis?.diagnosis_version || 1}，旧诊断已归档。`);
  });
}
window.regenerateCurrentDiagnosis = regenerateCurrentDiagnosis;

function inferInternalPayloadFromBrief(form){
  const brief = String(form.querySelector('[name="ai_project_brief"]')?.value || '').trim();
  if (!brief) return;
  const setIfEmpty = (name, value) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (input && !String(input.value || '').trim() && value) input.value = value;
  };
  const compact = brief.replace(/\s+/g, ' ');
  let industry = '';
  const industryMatch = compact.match(/(?:我们是|我是|客户是|业务是|做的是|主营|主要做)([^，。；;、]{2,28})/);
  if (industryMatch?.[1]) industry = industryMatch[1].replace(/的$/, '');
  if (!industry) {
    if (/检测|送检|医疗器械/.test(compact)) industry = '检测合规服务｜医疗器械检测合规';
    else if (/美甲|美睫|美容/.test(compact)) industry = '本地美容美甲门店';
    else if (/产康|盆底肌|产后/.test(compact)) industry = '产后康复门店';
    else if (/篮球|体育培训|球馆/.test(compact)) industry = /培训|课程|体验课/.test(compact) ? '少儿篮球培训' : '体育用品销售';
  }
  const targetMatch = compact.match(/(?:客户是|目标客户是|主要客户是|面向|服务)([^，。；;]{3,36})/);
  const target = targetMatch?.[1]?.replace(/^(的|给)/, '') || (/企业|老板|商家|客户/.test(compact) ? '有增长需求的企业主/商家' : '潜在目标客户');
  let goal = '';
  const goalMatch = compact.match(/(?:想|希望|目标是|现在想|最想)([^。；;]{4,42})/);
  if (goalMatch?.[1]) goal = goalMatch[1];
  if (!goal) goal = /咨询|咨询|线索/.test(compact) ? '提升内容带来的有效咨询' : '找到能带来客户的内容方向';
  setIfEmpty('industry', industry || compact.slice(0, 24));
  setIfEmpty('target_customer', target);
  setIfEmpty('main_goal', goal);
  setIfEmpty('offer', customerOfferFromGoal(goal + ' ' + compact, industry));
  setIfEmpty('customer_pain', (compact.match(/(?:顾虑|问题|痛点|担心)([^。；;]{4,40})/)?.[1] || '客户不知道为什么需要现在咨询/下单'));
  setIfEmpty('content_assets', (compact.match(/(?:素材|手里有|已有)([^。；;]{4,60})/)?.[1] || '待补充现有素材'));
  const channels = form.querySelector('[name="current_channels"]');
  if (channels && !channels.value) {
    channels.value = /抖音/.test(compact) ? '抖音' : /视频号/.test(compact) ? '视频号' : /朋友圈|私域/.test(compact) ? '朋友圈/私域' : '小红书';
  }
  const problem = form.querySelector('[name="biggest_problem"]');
  if (problem && !problem.value) {
    problem.value = /没流量|曝光/.test(compact) ? '发了没流量' : /咨询|咨询|转化/.test(compact) ? '有浏览没咨询' : /复盘|总结/.test(compact) ? '发完没人复盘' : '不知道发什么';
  }
  document.querySelectorAll('[data-internal-platforms] button,[data-internal-problems] button').forEach((button)=>{
    const group = button.closest('[data-internal-platforms],[data-internal-problems]');
    const inputName = group?.matches('[data-internal-platforms]') ? 'current_channels' : 'biggest_problem';
    const input = form.querySelector(`[name="${inputName}"]`);
    button.classList.toggle('is-selected', Boolean(input?.value && input.value === button.dataset.value));
  });
  renderInternalIntakeSnapshot(form);
}

function initInternalAiIntake(){
  const form = $('#assessmentForm');
  if (!form) return;
  renderInternalIntakeSnapshot(form);
  $('#aiExtractBtn')?.addEventListener('click', () => {
    form.dataset.aiAnalyzed = 'yes';
    form.dataset.aiConfirmed = '';
    inferInternalPayloadFromBrief(form);
    document.querySelector('.internal-structured-fields')?.setAttribute('open', '');
    renderInternalIntakeSnapshot(form);
  });
  $('#aiClearBtn')?.addEventListener('click', () => {
    form.reset();
    form.dataset.aiAnalyzed = '';
    form.dataset.aiConfirmed = '';
    document.querySelectorAll('[data-internal-platforms] button,[data-internal-problems] button').forEach((button)=>{
      button.classList.remove('is-selected');
      button.setAttribute('aria-pressed', 'false');
    });
    renderInternalIntakeSnapshot(form);
    $('#aiProjectBrief')?.focus();
  });
  $('#aiIntakeUnderstanding')?.addEventListener('click', (e) => {
    const focusButton = e.target.closest('[data-focus-field]');
    if (focusButton) {
      document.querySelector('.internal-structured-fields')?.setAttribute('open', '');
      const field = form.querySelector(`[name="${focusButton.dataset.focusField}"]`);
      field?.focus();
      return;
    }
    if (e.target.closest('[data-ai-confirm]')) {
      const snapshot = internalIntakeSnapshot(formData(form));
      if (!snapshot.ready) return;
      form.dataset.aiConfirmed = 'yes';
      renderInternalIntakeSnapshot(form);
      return;
    }
    if (e.target.closest('[data-ai-supplement]')) {
      document.querySelector('.internal-structured-fields')?.setAttribute('open', '');
      const firstMissing = internalIntakeSnapshot(formData(form)).missing[0]?.input;
      if (firstMissing) form.querySelector(`[name="${firstMissing}"]`)?.focus();
      return;
    }
    if (e.target.closest('[data-ai-reanalyze]')) {
      form.dataset.aiConfirmed = '';
      form.dataset.aiAnalyzed = 'yes';
      inferInternalPayloadFromBrief(form);
      renderInternalIntakeSnapshot(form);
    }
  });
  form.addEventListener('input', () => {
    form.dataset.aiConfirmed = '';
    renderInternalIntakeSnapshot(form);
  });
  form.addEventListener('change', () => {
    form.dataset.aiConfirmed = '';
    renderInternalIntakeSnapshot(form);
  });
}

let benchmarkWorkbenchState = {
  clientId: '',
  projectId: '',
  projects: [],
  profiles: [],
  contents: [],
  jobs: [],
  insights: [],
  loading: false,
  error: '',
  testPlan: null,
};
let benchmarkWorkbenchInitialized = false;
let benchmarkWorkbenchPollTimer = 0;
let benchmarkWorkbenchLoadBusy = false;

const benchmarkCustomerOptions = () => (allCustomersState.customers || []).flatMap((customer) => {
  const display = customerListDisplayName(customer);
  const records = Array.isArray(customer.records) && customer.records.length
    ? customer.records
    : [{client_id: customerPrimaryClientId(customer), updated_at: customer.updated_at || ''}];
  return records.map((record, index) => ({
    client_id: String(record.client_id || ''),
    label: records.length > 1 ? `${display} · 记录 ${index + 1}` : display,
    updated_at: record.updated_at || '',
  })).filter((item) => item.client_id);
});

const benchmarkProjectAssessment = (project = {}) => project.state?.assessment || {};
const benchmarkProjectLabel = (project = {}) => cleanDisplayName(
  project.name || project.state?.project?.name || benchmarkProjectAssessment(project).company_name || benchmarkProjectAssessment(project).industry || project.id
);
const benchmarkProject = () => (benchmarkWorkbenchState.projects || [])
  .find((item) => String(item.id || '') === String(benchmarkWorkbenchState.projectId || '')) || null;

function setBenchmarkStatus(message = '', type = 'success'){
  const status = $('#benchmarkWorkbenchStatus');
  if (!status) return;
  status.hidden = false;
  status.textContent = message || '请选择客户和项目。';
  status.classList.toggle('error', type === 'error');
  status.classList.toggle('success', type !== 'error');
}

function clearBenchmarkWorkbenchPoll(){
  if (benchmarkWorkbenchPollTimer) {
    window.clearTimeout(benchmarkWorkbenchPollTimer);
    benchmarkWorkbenchPollTimer = 0;
  }
}

function scheduleBenchmarkWorkbenchPoll(){
  clearBenchmarkWorkbenchPoll();
  if (!isBenchmarkInsightsRoute()) return;
  const running = (benchmarkWorkbenchState.jobs || []).some((job) => ['pending', 'generating'].includes(job.status));
  const status = $('#benchmarkPollingStatus');
  if (status) status.textContent = running ? '洞察正在后台分析，页面会自动刷新。' : '暂无运行中的任务。';
  if (!running) return;
  benchmarkWorkbenchPollTimer = window.setTimeout(() => {
    loadBenchmarkProjectData({ quiet: true }).catch((error) => setBenchmarkStatus(error.message || '洞察刷新失败', 'error'));
  }, 4000);
}

function renderBenchmarkScope(){
  const customerSelect = $('#benchmarkClientSelect');
  const projectSelect = $('#benchmarkProjectSelect');
  const customers = benchmarkCustomerOptions();
  if (customerSelect) {
    customerSelect.innerHTML = customers.length
      ? `<option value="">选择客户</option>${customers.map((item) => `<option value="${esc(item.client_id)}" ${item.client_id === benchmarkWorkbenchState.clientId ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}`
      : '<option value="">暂无可用客户</option>';
  }
  if (projectSelect) {
    const projects = benchmarkWorkbenchState.projects || [];
    projectSelect.innerHTML = projects.length
      ? `<option value="">选择项目</option>${projects.map((item) => `<option value="${esc(item.id)}" ${String(item.id) === String(benchmarkWorkbenchState.projectId) ? 'selected' : ''}>${esc(benchmarkProjectLabel(item))}</option>`).join('')}`
      : '<option value="">该客户暂无项目</option>';
  }
  const summary = $('#benchmarkProjectSummary');
  if (!summary) return;
  const project = benchmarkProject();
  summary.classList.toggle('empty', !project);
  if (!project) {
    summary.textContent = '选择项目后显示行业、客群、服务和平台摘要。';
    return;
  }
  const assessment = benchmarkProjectAssessment(project);
  const rows = [
    ['行业', assessment.industry],
    ['目标客户', assessment.target_customer],
    ['产品/服务', assessment.offer],
    ['目标', assessment.main_goal],
    ['平台', assessment.current_channels],
  ];
  summary.innerHTML = rows.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(cleanDisplayName(value) || '未填写')}</strong></div>`).join('');
}

function renderBenchmarkProfiles(){
  const list = $('#benchmarkProfileList');
  const picker = $('#benchmarkContentForm [name="benchmark_profile_id"]');
  const profiles = benchmarkWorkbenchState.profiles || [];
  if (picker) picker.innerHTML = profiles.length
    ? `<option value="">选择对标账号</option>${profiles.filter((item) => item.status !== 'archived').map((item) => `<option value="${esc(item.benchmark_profile_id)}">${esc(item.platform)} · ${esc(item.account_name || item.account_url)}</option>`).join('')}`
    : '<option value="">请先添加对标账号</option>';
  if (!list) return;
  list.classList.toggle('empty', !profiles.length);
  if (!profiles.length) { list.textContent = '暂无对标账号。'; return; }
  list.innerHTML = profiles.map((item) => `<article class="benchmark-mini-card">
    <div><span>${esc(item.platform || '其他')}</span><strong>${esc(item.account_name || item.account_url || '未命名账号')}</strong></div>
    <p>${esc((item.reference_reason || []).join('、') || item.operator_notes || '尚未填写参考原因')}</p>
    <small>${esc(item.observed_at || item.updated_at || '')} · ${esc(item.source_mode === 'customer_supplied' ? '客户提供' : '运营整理')}</small>
  </article>`).join('');
}

function benchmarkMetricSummary(metrics = {}){
  return [['赞', metrics.likes], ['藏', metrics.favorites], ['评', metrics.comments], ['享', metrics.shares]]
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `${label} ${Number(value).toLocaleString('zh-CN')}`)
    .join(' · ');
}

function renderBenchmarkContents(){
  const list = $('#benchmarkContentList');
  const contents = benchmarkWorkbenchState.contents || [];
  if (!list) return;
  list.classList.toggle('empty', !contents.length);
  if (!contents.length) { list.textContent = '暂无代表内容。'; return; }
  list.innerHTML = contents.map((item, index) => `<article class="benchmark-mini-card">
    <div><span>#${index + 1} · ${esc(item.platform || '平台')}</span><strong>${esc(item.title || '未命名内容')}</strong></div>
    <p>${esc(item.content_summary || item.operator_observation || '已记录标题，待补充内容摘要')}</p>
    <small>${esc(item.confidence || 'E')} 级证据${benchmarkMetricSummary(item.visible_metrics) ? ` · ${esc(benchmarkMetricSummary(item.visible_metrics))}` : ' · 公开指标未知'}</small>
  </article>`).join('');
}

const benchmarkStatusLabel = (status = '') => ({
  pending: '等待分析', generating: '正在分析', review_required: '等待审核', approved: '审核通过', rejected: '审核拒绝', failed: '分析失败',
}[status] || status || '未知');

function renderBenchmarkJobs(){
  const list = $('#benchmarkJobList');
  const jobs = benchmarkWorkbenchState.jobs || [];
  if (!list) return;
  list.classList.toggle('empty', !jobs.length);
  if (!jobs.length) { list.textContent = '暂无洞察任务。'; return; }
  list.innerHTML = jobs.slice(0, 8).map((job) => `<article class="benchmark-job-card is-${esc(job.status)}">
    <div><strong>${esc(benchmarkStatusLabel(job.status))}</strong><span>${esc(job.updated_at || job.requested_at || '')}</span></div>
    <p>${job.status === 'failed' ? esc(job.error_message || job.fallback_reason || '分析失败') : `来源 ${Number(job.benchmark_content_ids?.length || 0)} 条 · ${esc(job.job_id)}`}</p>
    <details><summary>模型与调试信息</summary><pre>${esc(JSON.stringify({requested_model: job.requested_model, actual_model: job.actual_model, provider: job.provider, fallback: job.fallback, fallback_reason: job.fallback_reason, latency_ms: job.latency_ms}, null, 2))}</pre></details>
  </article>`).join('');
}

function benchmarkSignalList(title, items = []){
  if (!Array.isArray(items) || !items.length) return '';
  return `<section class="benchmark-signal-group"><h4>${esc(title)}</h4>${items.map((item) => `<article>
    <strong>${esc(item.statement || '')}</strong>
    <p>${esc(item.adaptation_reason || '')}</p>
    <small>证据：${esc((item.source_content_ids || []).join('、'))} · ${esc(item.confidence || 'E')}</small>
  </article>`).join('')}</section>`;
}

function renderBenchmarkInsights(){
  const list = $('#benchmarkInsightList');
  const insights = benchmarkWorkbenchState.insights || [];
  if (!list) return;
  list.classList.toggle('empty', !insights.length);
  if (!insights.length) { list.textContent = '暂无待审核洞察。'; return; }
  list.innerHTML = insights.map((insight) => `<article class="benchmark-insight-card is-${esc(insight.status)}" data-benchmark-insight-id="${esc(insight.benchmark_insight_id)}">
    <header>
      <div><span>${esc(benchmarkStatusLabel(insight.status))}</span><h3>${esc(insight.fit_summary || '对标内容洞察')}</h3></div>
      <em class="is-${esc(insight.fit_status)}">匹配度 ${esc(insight.fit_status || 'medium')}</em>
    </header>
    ${!insight.industry_guard?.passed ? `<p class="benchmark-warning">参考对象与当前项目不匹配：${esc((insight.industry_guard?.forbidden_terms_found || []).join('、') || '行业类型不一致')}</p>` : ''}
    <div class="benchmark-signal-grid">
      ${benchmarkSignalList('市场关注点', insight.market_signals)}
      ${benchmarkSignalList('客户痛点', insight.proven_pains)}
      ${benchmarkSignalList('标题结构', insight.title_patterns)}
      ${benchmarkSignalList('信任证据', insight.trust_evidence_patterns)}
      ${benchmarkSignalList('可迁移方向', insight.transferable_directions)}
      ${benchmarkSignalList('不建议模仿', insight.avoid_copying)}
      ${benchmarkSignalList('平台与合规风险', insight.platform_risks)}
    </div>
    <div class="benchmark-review-actions">
      ${insight.status === 'review_required' ? `<button type="button" data-benchmark-action="approve">审核通过</button><button class="secondary" type="button" data-benchmark-action="reject">拒绝</button>` : ''}
      ${insight.status === 'approved' ? '<button type="button" data-benchmark-action="test-plan">生成内测方案</button>' : ''}
    </div>
    <details><summary>模型、证据与校验信息</summary><pre>${esc(JSON.stringify({source_content_ids: insight.source_content_ids, industry_guard: insight.industry_guard, validation_warnings: insight.validation_warnings, requested_model: insight.requested_model, actual_model: insight.actual_model, provider: insight.provider, fallback: insight.fallback, latency_ms: insight.latency_ms, review: insight.review}, null, 2))}</pre></details>
  </article>`).join('');
}

function renderBenchmarkTestPlan(){
  const box = $('#benchmarkTestPlan');
  if (!box) return;
  const result = benchmarkWorkbenchState.testPlan;
  const plans = result?.plans || [];
  box.classList.toggle('empty', !plans.length);
  if (!plans.length) { box.textContent = '审核洞察后，可在这里生成一份内测 7 天方案。'; return; }
  box.innerHTML = `<div class="benchmark-test-plan-head"><strong>${esc(result.diagnosis?.priority_problem || '内测内容方案')}</strong><span>${esc(result.generated_at || '')}</span></div>
    <div class="benchmark-test-plan-grid">${plans.map((plan, index) => `<article><span>第 ${index + 1} 天 · ${esc(plan.platform || '')}</span><strong>${esc(plan.topic || '')}</strong><p>${esc(plan.angle || '')}</p></article>`).join('')}</div>
    <details><summary>内测方案模型证据</summary><pre>${esc(JSON.stringify(result.generation_meta || result.model_info || {}, null, 2))}</pre></details>`;
}

function renderBenchmarkWorkbench(){
  if (!isBenchmarkInsightsRoute()) return;
  renderBenchmarkScope();
  renderBenchmarkProfiles();
  renderBenchmarkContents();
  renderBenchmarkJobs();
  renderBenchmarkInsights();
  renderBenchmarkTestPlan();
  if (benchmarkWorkbenchState.error) setBenchmarkStatus(benchmarkWorkbenchState.error, 'error');
  else if (benchmarkWorkbenchState.loading) setBenchmarkStatus('正在读取对标账号、内容证据和洞察任务...');
  else if (!benchmarkWorkbenchState.projectId) setBenchmarkStatus('请选择客户和项目，再录入对标内容。');
  else setBenchmarkStatus(`当前项目已读取：${benchmarkProjectLabel(benchmarkProject() || {}) || benchmarkWorkbenchState.projectId}`);
  scheduleBenchmarkWorkbenchPoll();
}

async function loadBenchmarkClientProjects(clientId = ''){
  const safeClientId = String(clientId || '').trim();
  benchmarkWorkbenchState.clientId = safeClientId;
  benchmarkWorkbenchState.projectId = '';
  benchmarkWorkbenchState.projects = [];
  benchmarkWorkbenchState.profiles = [];
  benchmarkWorkbenchState.contents = [];
  benchmarkWorkbenchState.jobs = [];
  benchmarkWorkbenchState.insights = [];
  benchmarkWorkbenchState.testPlan = null;
  renderBenchmarkWorkbench();
  if (!safeClientId) return;
  const cloud = await api(`/api/state?client_id=${encodeURIComponent(safeClientId)}&mode=internal`);
  const projects = Array.isArray(cloud.project_store?.projects) ? cloud.project_store.projects : [];
  benchmarkWorkbenchState.projects = projects;
  benchmarkWorkbenchState.projectId = projects[0]?.id || '';
  renderBenchmarkWorkbench();
  if (benchmarkWorkbenchState.projectId) await loadBenchmarkProjectData();
}

async function loadBenchmarkProjectData({ quiet = false } = {}){
  if (!isBenchmarkInsightsRoute() || benchmarkWorkbenchLoadBusy) return;
  const clientId = benchmarkWorkbenchState.clientId;
  const projectId = benchmarkWorkbenchState.projectId;
  if (!clientId || !projectId) { renderBenchmarkWorkbench(); return; }
  benchmarkWorkbenchLoadBusy = true;
  if (!quiet) benchmarkWorkbenchState.loading = true;
  benchmarkWorkbenchState.error = '';
  renderBenchmarkWorkbench();
  try {
    const query = `client_id=${encodeURIComponent(clientId)}&project_id=${encodeURIComponent(projectId)}`;
    const [profiles, contents, jobs, insights] = await Promise.all([
      api(`/api/benchmark-profiles?${query}`),
      api(`/api/benchmark-contents?${query}`),
      api(`/api/benchmark-jobs?${query}`),
      api(`/api/benchmark-insights?${query}`),
    ]);
    benchmarkWorkbenchState.profiles = profiles.profiles || [];
    benchmarkWorkbenchState.contents = contents.contents || [];
    benchmarkWorkbenchState.jobs = jobs.jobs || [];
    benchmarkWorkbenchState.insights = insights.insights || [];
  } catch (error) {
    benchmarkWorkbenchState.error = error.message || '对标洞察数据读取失败';
  } finally {
    benchmarkWorkbenchState.loading = false;
    benchmarkWorkbenchLoadBusy = false;
    renderBenchmarkWorkbench();
  }
}

const benchmarkMetricValue = (value) => String(value ?? '').trim() === '' ? null : Number(value);

async function submitBenchmarkProfile(form){
  if (!benchmarkWorkbenchState.clientId || !benchmarkWorkbenchState.projectId) throw new Error('请先选择客户和项目');
  const data = formData(form);
  const result = await api('/api/benchmark-profiles', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      client_id: benchmarkWorkbenchState.clientId,
      project_id: benchmarkWorkbenchState.projectId,
      source_mode: 'operator_curated',
    }),
  });
  form.reset();
  toast(`已保存对标账号：${result.profile?.account_name || ''}`);
  await loadBenchmarkProjectData();
}

async function submitBenchmarkContent(form){
  if (!benchmarkWorkbenchState.clientId || !benchmarkWorkbenchState.projectId) throw new Error('请先选择客户和项目');
  const data = formData(form);
  const result = await api('/api/benchmark-contents', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      client_id: benchmarkWorkbenchState.clientId,
      project_id: benchmarkWorkbenchState.projectId,
      source_mode: 'operator_curated',
      visible_metrics: {
        likes: benchmarkMetricValue(data.likes),
        favorites: benchmarkMetricValue(data.favorites),
        comments: benchmarkMetricValue(data.comments),
        shares: benchmarkMetricValue(data.shares),
        views: null,
      },
    }),
  });
  form.reset();
  toast(`已保存代表内容：${result.content?.title || ''}`);
  await loadBenchmarkProjectData();
}

async function createBenchmarkAnalysisJob(){
  if (!benchmarkWorkbenchState.clientId || !benchmarkWorkbenchState.projectId) throw new Error('请先选择客户和项目');
  const requestId = `benchmark-${benchmarkWorkbenchState.clientId}-${benchmarkWorkbenchState.projectId}-${Date.now()}`;
  const result = await api('/api/benchmark-jobs', {
    method: 'POST',
    body: JSON.stringify({
      client_id: benchmarkWorkbenchState.clientId,
      project_id: benchmarkWorkbenchState.projectId,
      benchmark_profile_ids: benchmarkWorkbenchState.profiles.filter((item) => item.status !== 'archived').map((item) => item.benchmark_profile_id),
      benchmark_content_ids: benchmarkWorkbenchState.contents.filter((item) => item.status === 'ready').map((item) => item.benchmark_content_id),
      request_id: requestId,
    }),
  });
  toast(result.duplicate ? '已恢复同一洞察任务。' : '洞察任务已提交，正在后台分析。');
  await loadBenchmarkProjectData();
}

async function reviewBenchmarkInsight(insightId, status){
  const rejectionReason = status === 'rejected' ? String(window.prompt('请填写拒绝原因') || '').trim() : '';
  if (status === 'rejected' && !rejectionReason) return;
  await api(`/api/benchmark-insights/${encodeURIComponent(insightId)}/review`, {
    method: 'PATCH',
    body: JSON.stringify({
      client_id: benchmarkWorkbenchState.clientId,
      status,
      reviewer: 'internal',
      rejection_reason: rejectionReason,
      notes: status === 'approved' ? '证据引用、行业匹配和可迁移方向已人工确认。' : '',
    }),
  });
  toast(status === 'approved' ? '洞察已审核通过。' : '洞察已拒绝。');
  await loadBenchmarkProjectData();
}

async function createBenchmarkTestPlan(insightId){
  const result = await api(`/api/benchmark-insights/${encodeURIComponent(insightId)}/test-plan`, {
    method: 'POST',
    timeoutMs: 35000,
    body: JSON.stringify({ client_id: benchmarkWorkbenchState.clientId }),
  });
  benchmarkWorkbenchState.testPlan = result.test_plan || null;
  renderBenchmarkTestPlan();
  $('#benchmarkTestPlan')?.scrollIntoView({behavior: 'smooth', block: 'start'});
  toast('内测方案已生成，不会写入客户公开项目。');
}

async function loadBenchmarkWorkbench(){
  if (!isBenchmarkInsightsRoute()) return;
  benchmarkWorkbenchState.loading = true;
  renderBenchmarkWorkbench();
  await refreshAllCustomers({ force: true });
  const options = benchmarkCustomerOptions();
  const preferredClient = benchmarkWorkbenchState.clientId || explicitCustomerClientId() || options[0]?.client_id || '';
  benchmarkWorkbenchState.loading = false;
  if (!preferredClient) {
    benchmarkWorkbenchState.error = allCustomersState.error || '暂无可选择的客户项目。';
    renderBenchmarkWorkbench();
    return;
  }
  await loadBenchmarkClientProjects(preferredClient);
}

function initBenchmarkWorkbench(){
  renderGenerationWorkbenchRoute();
  if (!isBenchmarkInsightsRoute()) return;
  if (benchmarkWorkbenchInitialized) {
    loadBenchmarkWorkbench().catch((error) => setBenchmarkStatus(error.message || '工作台读取失败', 'error'));
    return;
  }
  benchmarkWorkbenchInitialized = true;
  $('#benchmarkClientSelect')?.addEventListener('change', (event) => {
    loadBenchmarkClientProjects(event.target.value).catch((error) => setBenchmarkStatus(error.message || '客户项目读取失败', 'error'));
  });
  $('#benchmarkProjectSelect')?.addEventListener('change', (event) => {
    benchmarkWorkbenchState.projectId = event.target.value;
    benchmarkWorkbenchState.testPlan = null;
    loadBenchmarkProjectData().catch((error) => setBenchmarkStatus(error.message || '项目洞察读取失败', 'error'));
  });
  $('#benchmarkProfileForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    withBusy(event.submitter, '保存中...', () => submitBenchmarkProfile(event.target));
  });
  $('#benchmarkContentForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    withBusy(event.submitter, '保存中...', () => submitBenchmarkContent(event.target));
  });
  $('#benchmarkAnalyzeBtn')?.addEventListener('click', (event) => {
    withBusy(event.currentTarget, '正在提交...', createBenchmarkAnalysisJob);
  });
  $('#benchmarkRefreshBtn')?.addEventListener('click', (event) => {
    withBusy(event.currentTarget, '刷新中...', () => loadBenchmarkProjectData());
  });
  $('#benchmarkInsightList')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-benchmark-action]');
    const card = button?.closest('[data-benchmark-insight-id]');
    if (!button || !card) return;
    const insightId = card.dataset.benchmarkInsightId;
    if (button.dataset.benchmarkAction === 'approve') reviewBenchmarkInsight(insightId, 'approved').catch((error) => toast(error.message));
    if (button.dataset.benchmarkAction === 'reject') reviewBenchmarkInsight(insightId, 'rejected').catch((error) => toast(error.message));
    if (button.dataset.benchmarkAction === 'test-plan') withBusy(button, '生成中...', () => createBenchmarkTestPlan(insightId));
  });
  loadBenchmarkWorkbench().catch((error) => setBenchmarkStatus(error.message || '工作台读取失败', 'error'));
}

const GENERATION_MODEL_BY_TYPE = {
  image: 'GPT-Image-2',
  cover: 'GPT-Image-2',
  video: 'Seedance 2.0',
  script: 'Kimi (kimi-k2.6)',
  copy: 'Kimi (kimi-k2.6)',
};
const GENERATION_TYPE_UI = {
  script: {
    contentType: '脚本',
    guidanceTitle: '脚本需要补充什么',
    guidanceText: '说明主题、受众和希望观众看完后采取的动作。',
    promptLabel: '脚本主题与具体要求 *',
    placeholder: '例如：为少儿篮球训练营写一条 60 秒口播脚本，面向附近 6-12 岁孩子家长，说明体验课能解决什么问题，结尾引导预约体验。',
    submitLabel: '生成脚本',
  },
  copy: {
    contentType: '文案',
    guidanceTitle: '文案需要补充什么',
    guidanceText: '说清发布场景、核心观点和希望读者采取的动作。',
    promptLabel: '文案主题与具体要求 *',
    placeholder: '例如：写一篇小红书笔记，面向附近想做通勤款美甲的女性，解释有浏览没咨询的原因，并自然引导预约。',
    submitLabel: '生成文案',
  },
  video: {
    contentType: '视频',
    guidanceTitle: '视频需要补充什么',
    guidanceText: '描述主体、场景、动作和镜头变化；参考图可在下方折叠区选择。',
    promptLabel: '视频画面与动作要求 *',
    placeholder: '例如：真实篮球馆内，一名教练带 8 岁孩子完成运球训练；镜头先展示全景，再跟拍动作细节，画面自然、有现场感。',
    submitLabel: '生成视频',
  },
  cover: {
    contentType: '封面',
    guidanceTitle: '封面需要补充什么',
    guidanceText: '写清主视觉、标题层级和想传达的第一印象。',
    promptLabel: '封面画面与排版要求 *',
    placeholder: '例如：小红书竖版封面，真实儿童摄影场景，标题醒目但不遮挡人物，整体高级、克制、可信。',
    submitLabel: '生成封面',
  },
  image: {
    contentType: '图文',
    guidanceTitle: '图片需要补充什么',
    guidanceText: '描述画面主体、使用场景、构图和必须避免的元素。',
    promptLabel: '图片画面与用途要求 *',
    placeholder: '例如：为口腔门诊小红书笔记生成一张真实诊室配图，突出儿童检查场景，干净专业，不出现夸张医疗承诺。',
    submitLabel: '生成图片',
  },
};
const GENERATION_OUTPUT_SPEC_FIELDS = [
  'script_format',
  'script_duration',
  'script_must_include',
  'copy_format',
  'copy_length',
  'copy_cta',
  'video_ratio',
  'video_duration',
  'video_style',
  'video_generate_audio',
  'cover_size',
  'cover_text',
  'cover_style',
  'image_size',
  'image_usage',
  'image_style',
];
let generationWorkbenchState = { assets: [], tasks: [], clientTasks: [] };
let generationWorkbenchRefreshTimer = 0;
let generationWorkbenchRefreshBusy = false;
const GENERATION_WORKBENCH_REFRESH_MS = 5000;

const generationClientId = () =>
  normalizeClientId($('#generationTaskForm [name="client_id"]')?.value || $('#generationAssetForm [name="client_id"]')?.value || INTERNAL_CLIENT_ID) || INTERNAL_CLIENT_ID;
const generationProjectId = () =>
  $('#generationTaskForm [name="project_id"]')?.value || $('#generationAssetForm [name="project_id"]')?.value || 'qa_project_generation';

function setGenerationMessage(selector, message, tone = 'success'){
  const el = $(selector);
  if (!el) return;
  el.textContent = sanitizeCustomerText(message);
  el.classList.toggle('error', tone === 'error');
  el.classList.toggle('success', tone !== 'error');
  el.hidden = !message;
}

function generationModelFor(type){
  return GENERATION_MODEL_BY_TYPE[type] || 'Kimi (kimi-k2.6)';
}

function updateGenerationRequestedModel(){
  const type = $('#generationTypeSelect')?.value || 'script';
  const ui = GENERATION_TYPE_UI[type] || GENERATION_TYPE_UI.script;
  const input = $('#generationRequestedModel');
  if (input) input.value = generationModelFor(type);
  const contentType = $('#generationTaskForm [name="content_type"]');
  if (contentType) contentType.value = ui.contentType;
  const guidanceTitle = $('#generationTypeGuidanceTitle');
  const guidanceText = $('#generationTypeGuidanceText');
  const promptLabel = $('#generationPromptLabel');
  const prompt = $('#generationTaskForm [name="prompt"]');
  const submitButton = $('#generationTaskForm button[type="submit"]');
  if (guidanceTitle) guidanceTitle.textContent = ui.guidanceTitle;
  if (guidanceText) guidanceText.textContent = ui.guidanceText;
  if (promptLabel) promptLabel.textContent = ui.promptLabel;
  if (prompt) prompt.placeholder = ui.placeholder;
  if (submitButton && !submitButton.disabled) submitButton.textContent = ui.submitLabel;
  $$('#generationTypeFields [data-generation-fields]').forEach((group) => {
    const active = group.dataset.generationFields === type;
    group.hidden = !active;
    Array.from(group.querySelectorAll('input, select, textarea')).forEach((control) => {
      control.disabled = !active;
    });
  });
}

function generationOutputSpecFor(data = {}, form){
  const type = data.generation_type || 'script';
  const outputSpec = {
    client_visible: Boolean(form.querySelector('[name="client_visible"]')?.checked),
  };
  if (type === 'script') {
    outputSpec.format = data.script_format || '口播脚本';
    outputSpec.target_duration = data.script_duration || '60秒';
    outputSpec.must_include = data.script_must_include || '';
  } else if (type === 'copy') {
    outputSpec.format = data.copy_format || '小红书笔记';
    outputSpec.target_length = data.copy_length || '标准（300-500字）';
    outputSpec.cta = data.copy_cta || '';
  } else if (type === 'video') {
    outputSpec.ratio = data.video_ratio || '9:16';
    outputSpec.duration = data.video_duration || '6s';
    outputSpec.size = outputSpec.ratio === '16:9' ? '1920x1080' : outputSpec.ratio === '1:1' ? '1080x1080' : '1080x1920';
    outputSpec.style = data.video_style || '';
    outputSpec.generate_audio = Boolean(form.querySelector('[name="video_generate_audio"]')?.checked);
  } else if (type === 'cover') {
    outputSpec.size = data.cover_size || '1024x1536';
    outputSpec.cover_text = data.cover_text || '';
    outputSpec.style = data.cover_style || '';
  } else if (type === 'image') {
    outputSpec.size = data.image_size || '1024x1536';
    outputSpec.usage = data.image_usage || '内容配图';
    outputSpec.style = data.image_style || '';
  }
  return outputSpec;
}

function readFileAsBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

async function sha256ForFile(file){
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}

function renderGenerationAssets(){
  const list = $('#generationAssetList');
  const picker = $('#generationAssetPicker');
  const assets = generationWorkbenchState.assets || [];
  if (list) {
    list.classList.toggle('empty', !assets.length);
    list.innerHTML = assets.length ? assets.map((asset) => `
      <article class="generation-mini-card">
        <strong>${esc(asset.original_filename || asset.asset_id)}</strong>
        <span>${esc(asset.status || 'ok')} · ${esc(asset.usage_scope || '')}</span>
        <code>${esc(asset.sha256 || '')}</code>
      </article>
    `).join('') : '暂无素材。';
  }
  if (picker) {
    picker.classList.toggle('empty', !assets.length);
    picker.innerHTML = assets.length ? assets.map((asset) => {
      const disabled = asset.status !== 'ok' || (asset.usage_scope === 'cross_project_authorized' && !asset.cross_project_authorization);
      return `<label class="generation-asset-choice ${disabled ? 'is-disabled' : ''}">
        <input type="checkbox" value="${esc(asset.asset_id)}" ${disabled ? 'disabled' : ''} />
        <span>${esc(asset.original_filename || asset.asset_id)}</span>
        <small>${esc(asset.status || 'ok')}</small>
      </label>`;
    }).join('') : '先保存素材后可选择。';
  }
}

const GENERATION_STATUS_LABELS = {
  draft: '待开始',
  submitted: '正在提交',
  asset_checking: '正在检查素材',
  blocked_asset_missing: '素材需要处理',
  blocked_model_auth: '模型配置待处理',
  queued: '正在排队',
  generating: '正在生成',
  generated: '生成完成',
  qa_pending: '成稿待验收',
  qa_failed: '验收未通过',
  client_ready: '可以交付',
  delivered: '已交付',
  failed: '生成失败',
};

function generationStatusLabel(status = ''){
  return GENERATION_STATUS_LABELS[status] || status || '待处理';
}

function generationTaskAgeMs(task = {}){
  const timestamp = Date.parse(task.updated_at || task.created_at || '');
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : 0;
}

function generationTaskProgressText(task = {}){
  if (task.status === 'generating') {
    return generationTaskAgeMs(task) > 180000
      ? '生成时间比平时长，系统仍在自动检查。可以离开本页，稍后回来查看。'
      : '后台正在生成，通常需要 30-90 秒，本页会自动更新。';
  }
  if (task.status === 'draft') return '任务已经建立，点击“开始生成”后才会调用模型。';
  if (task.status === 'qa_pending' || task.status === 'generated') return '成稿已生成，请先检查内容，再决定是否通过验收。';
  if (task.status === 'client_ready') return '内容已通过验收，可以交付给客户。';
  if (task.status === 'delivered') return '这条内容已完成交付。';
  if (task.status === 'qa_failed') return '内容未通过验收，可调整生成需求后重新生成。';
  if (task.status === 'failed' || String(task.status || '').startsWith('blocked_')) {
    return task.error || '任务没有完成，请检查原因后重新生成。';
  }
  return '任务状态已更新。';
}

function renderGenerationRunningState(task = {}){
  if (task.status !== 'generating') return '';
  const elapsedSeconds = Math.max(1, Math.round(generationTaskAgeMs(task) / 1000));
  return `
    <div class="generation-running-state" role="status" aria-live="polite">
      <span><i></i></span>
      <small>已等待约 ${esc(elapsedSeconds)} 秒 · 后台继续运行，离开页面也不会中断</small>
    </div>
  `;
}

function generationOutputAssetsForTask(task = {}){
  const outputIds = new Set((task.output_asset_ids || []).map((id) => String(id)));
  if (!outputIds.size) return [];
  return (generationWorkbenchState.assets || []).filter((asset) => outputIds.has(String(asset.asset_id || '')));
}

function generationOutputTextForTask(task = {}){
  return generationOutputAssetsForTask(task)
    .filter((asset) => String(asset.mime_type || '').startsWith('text/') || ['script', 'copy'].includes(task.generation_type))
    .map((asset) => String(asset.notes || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

function generationOutputMediaForTask(task = {}){
  return generationOutputAssetsForTask(task).find((asset) => {
    const mime = String(asset.mime_type || '');
    return mime.startsWith('image/') || mime.startsWith('video/');
  }) || null;
}

function generationRenderableMediaUrl(asset = {}){
  const url = String(asset?.storage_url || '').trim();
  return /^(?:https?:|blob:|data:(?:image|video)\/)/i.test(url) ? url : '';
}

const GENERATION_COMPLETENESS_REASON_LABELS = {
  provider_token_limit: '模型达到输出上限',
  token_budget_exhausted: '输出预算已用尽',
  unclosed_code_fence: '代码块未闭合',
  unclosed_bracket_or_quote: '括号或引号未闭合',
  trailing_heading: '结尾停在标题',
  dangling_list_item: '结尾列表项未写完',
  dangling_punctuation: '结尾语句未收完整',
  empty_output: '没有生成正文',
};

function generationCompletenessReasonText(reasons = []){
  return (Array.isArray(reasons) ? reasons : [])
    .map((reason) => GENERATION_COMPLETENESS_REASON_LABELS[reason] || String(reason || ''))
    .filter(Boolean)
    .join('、') || '无';
}

function renderGenerationCompleteness(task = {}){
  const evidence = task.adapter_manifest?.output;
  if (!evidence?.completeness_checked) return '';
  const passed = evidence.completeness_passed === true;
  const continuationRounds = Number(evidence.continuation_rounds || 0);
  const regenerated = evidence.regeneration_attempted === true;
  return `
    <details class="generation-completeness ${passed ? 'is-passed' : 'is-failed'}">
      <summary>成稿检查 · ${passed ? '完整性通过' : '未通过'}</summary>
      <div class="generation-completeness-grid">
        <span>首稿问题<strong>${esc(generationCompletenessReasonText(evidence.initial_incomplete_reasons))}</strong></span>
        <span>自动续写<strong>${esc(continuationRounds ? `${continuationRounds} 轮` : '未触发')}</strong></span>
        <span>完整重写<strong>${regenerated ? '已触发' : '未触发'}</strong></span>
        <span>模型调用<strong>${esc(String(evidence.provider_attempts || 1))} 次</strong></span>
        <span>最终检查<strong>${esc(generationCompletenessReasonText(evidence.final_incomplete_reasons))}</strong></span>
      </div>
    </details>
  `;
}

function renderGenerationOutput(task = {}){
  const text = generationOutputTextForTask(task);
  const media = generationOutputMediaForTask(task);
  const mediaUrl = generationRenderableMediaUrl(media);
  if (!text && !media) return '';
  if (media) {
    const isVideo = String(media.mime_type || '').startsWith('video/');
    const mediaMarkup = mediaUrl
      ? (isVideo
        ? `<video class="generation-output-media" src="${esc(mediaUrl)}" controls preload="metadata"></video>`
        : `<img class="generation-output-media" src="${esc(mediaUrl)}" alt="${esc(media.original_filename || '生成图片')}" />`)
      : `<div class="generation-output-placeholder">
          <strong>${isVideo ? '视频任务已生成' : '图片任务已生成'}</strong>
          <span>${String(media.storage_url || '').startsWith('mock://') ? '当前是模型适配器的模拟产物，接入真实模型后会在这里显示成品。' : '成品地址暂时不可直接预览，请查看技术信息。'}</span>
        </div>`;
    return `
      <section class="generation-output-preview generation-media-preview">
        <div class="generation-output-head">
          <div>
            <span>生成成品</span>
            <strong>${esc(media.resolution || task.output_spec?.size || '尺寸未标注')}${media.duration ? ` · ${esc(media.duration)}` : ''}</strong>
          </div>
          ${mediaUrl ? `<button type="button" data-gw-action="copy-asset-link" data-task-id="${esc(task.task_id)}">复制成品链接</button>` : ''}
        </div>
        ${mediaMarkup}
      </section>
    `;
  }
  return `
    <section class="generation-output-preview">
      <div class="generation-output-head">
        <div>
          <span>生成成稿</span>
          <strong>${esc(text.length)} 字符 · ${esc(task.actual_model || task.requested_model || '模型输出')}</strong>
        </div>
        <button type="button" data-gw-action="copy-output" data-task-id="${esc(task.task_id)}">复制成稿</button>
      </div>
      <pre>${esc(text)}</pre>
      ${renderGenerationCompleteness(task)}
    </section>
  `;
}

function renderGenerationTaskActions(task = {}){
  const taskId = esc(task.task_id);
  const status = String(task.status || 'draft');
  const buttons = [];
  if (['draft', 'failed', 'blocked_asset_missing', 'blocked_model_auth', 'qa_failed'].includes(status)) {
    buttons.push(`<button type="button" data-gw-action="submit" data-task-id="${taskId}">${status === 'draft' ? '开始生成' : '重新生成'}</button>`);
  }
  if (status === 'generating') {
    buttons.push('<button type="button" class="generation-running-button" disabled><span aria-hidden="true"></span>正在生成</button>');
    buttons.push(`<button type="button" class="secondary" data-gw-action="check-progress" data-task-id="${taskId}">检查进度</button>`);
  }
  if (['generated', 'qa_pending'].includes(status)) {
    buttons.push(`<button type="button" data-gw-action="qa-pass" data-task-id="${taskId}">验收通过</button>`);
    buttons.push(`<button type="button" class="secondary" data-gw-action="qa-fail" data-task-id="${taskId}">需要修改</button>`);
  }
  if (status === 'client_ready') {
    buttons.push(`<button type="button" data-gw-action="deliver" data-task-id="${taskId}">确认交付</button>`);
  }
  return buttons.length ? `<div class="generation-actions">${buttons.join('')}</div>` : '';
}

function renderGenerationTechnicalDetails(task = {}){
  return `
    <details class="generation-technical-details">
      <summary>技术信息</summary>
      <div class="generation-debug">
        <span>任务：${esc(task.task_id || '-')}</span>
        <span>计划：${esc(task.content_plan_record_id || '-')}</span>
        <span>Provider：${esc(task.provider || '-')}</span>
        <span>模型：${esc(task.actual_model || task.requested_model || '-')}</span>
        <span>Job：${esc(task.provider_job_id || '-')}</span>
        <span>QA：${esc(task.qa?.qa_status || 'pending')}</span>
        ${task.fallback ? `<span>Fallback：${esc(task.fallback_reason || 'unknown')}</span>` : ''}
      </div>
    </details>
  `;
}

function renderGenerationTaskCard(task = {}){
  return `
    <article class="generation-task-card ${task.status === 'generating' ? 'is-generating' : ''}" data-task-id="${esc(task.task_id)}">
      <div class="generation-task-head">
        <div>
          <strong>${esc(task.platform || '未选平台')} · ${esc(task.content_type || task.generation_type || '内容')}</strong>
          <span>${esc(generationTaskProgressText(task))}</span>
        </div>
        <span class="generation-status" data-status="${esc(task.status || 'draft')}">${esc(generationStatusLabel(task.status))}</span>
      </div>
      ${task.error ? `<p class="generation-error">${esc(task.error)}</p>` : ''}
      ${renderGenerationRunningState(task)}
      ${renderGenerationOutput(task)}
      ${renderGenerationTaskActions(task)}
      <details class="generation-prompt-details">
        <summary>查看本次生成需求</summary>
        <p>${esc(task.prompt || '暂无生成需求')}</p>
      </details>
      ${renderGenerationTechnicalDetails(task)}
    </article>
  `;
}

function renderGenerationTasks(){
  const list = $('#generationTaskList');
  const tasks = [...(generationWorkbenchState.tasks || [])].sort((a, b) =>
    Date.parse(b.updated_at || b.created_at || '') - Date.parse(a.updated_at || a.created_at || '')
  );
  if (!list) return;
  list.classList.toggle('empty', !tasks.length);
  if (!tasks.length) {
    list.innerHTML = '暂无生成任务。';
    return;
  }
  const primaryTasks = tasks.slice(0, 1);
  const historyTasks = tasks.slice(1);
  list.innerHTML = primaryTasks.map(renderGenerationTaskCard).join('')
    + (historyTasks.length ? `
      <details class="generation-task-history">
        <summary>查看历史任务（${esc(historyTasks.length)}）</summary>
        <div class="generation-task-history-list">${historyTasks.map(renderGenerationTaskCard).join('')}</div>
      </details>
    ` : '');
}

function renderGenerationClientDelivery(){
  const box = $('#generationClientDelivery');
  const tasks = generationWorkbenchState.clientTasks || [];
  if (!box) return;
  box.classList.toggle('empty', !tasks.length);
  box.innerHTML = tasks.length ? tasks.map((task) => `
    <article class="generation-delivery-card">
      <strong>${esc(task.platform)} · ${esc(task.content_type)}</strong>
      <p>${esc(task.prompt || '已通过 QA 的素材')}</p>
      <span>内容计划：${esc(task.content_plan_record_id)}</span>
      <span>成品素材：${esc((task.output_asset_ids || []).join('、') || '待下载')}</span>
    </article>
  `).join('') : '暂无可交付内容。';
}

function clearGenerationWorkbenchRefresh(){
  if (generationWorkbenchRefreshTimer) {
    window.clearTimeout(generationWorkbenchRefreshTimer);
    generationWorkbenchRefreshTimer = 0;
  }
}

function updateGenerationAutoStatus(message = ''){
  const status = $('#generationAutoStatus');
  if (status) status.textContent = message || '任务生成中会自动刷新，无需反复点击。';
}

function scheduleGenerationWorkbenchRefresh(){
  clearGenerationWorkbenchRefresh();
  if (!isGenerationWorkbenchRoute()) return;
  const generatingTasks = (generationWorkbenchState.tasks || []).filter((task) => task.status === 'generating');
  if (!generatingTasks.length) {
    const hasFreshOutput = (generationWorkbenchState.tasks || []).some((task) =>
      ['generated', 'qa_pending', 'client_ready', 'delivered'].includes(task.status)
    );
    updateGenerationAutoStatus(hasFreshOutput ? '成稿已更新，可以直接查看和复制。' : '任务状态已更新。');
    const taskMessage = $('#generationTaskMessage');
    if (taskMessage?.textContent.includes('后台生成')) {
      setGenerationMessage('#generationTaskMessage', '成稿已完成，请在下方查看、复制并验收。');
    }
    return;
  }
  updateGenerationAutoStatus(`正在跟踪 ${generatingTasks.length} 个生成任务，页面每 5 秒自动更新。`);
  generationWorkbenchRefreshTimer = window.setTimeout(refreshGeneratingWorkbenchTasks, GENERATION_WORKBENCH_REFRESH_MS);
}

async function refreshGeneratingWorkbenchTasks(){
  if (generationWorkbenchRefreshBusy || !isGenerationWorkbenchRoute()) return;
  generationWorkbenchRefreshBusy = true;
  clearGenerationWorkbenchRefresh();
  try {
    const client_id = generationClientId();
    const generatingTasks = (generationWorkbenchState.tasks || [])
      .filter((task) => task.status === 'generating')
      .slice(0, 8);
    if (generatingTasks.length) {
      await Promise.allSettled(generatingTasks.map((task) =>
        api(`/api/generation-tasks/${encodeURIComponent(task.task_id)}/poll`, {
          method: 'POST',
          body: JSON.stringify({client_id}),
        })
      ));
    }
    await loadGenerationWorkbench({scheduleRefresh: false});
  } catch (error) {
    updateGenerationAutoStatus('自动刷新暂时失败，可点击“立即刷新”重试。');
  } finally {
    generationWorkbenchRefreshBusy = false;
    scheduleGenerationWorkbenchRefresh();
  }
}

async function loadGenerationWorkbench({scheduleRefresh = true} = {}){
  if (!isGenerationWorkbenchRoute()) return;
  const profile = currentProfile();
  const clientId = generationClientId();
  const projectId = generationProjectId();
  const query = `client_id=${encodeURIComponent(clientId)}&project_id=${encodeURIComponent(projectId)}`;
  const [assets, tasks, clientTasks] = await Promise.all([
    api(`/api/assets?${query}`),
    api(`/api/generation-tasks?${query}&view=${profileDeliveryView(profile)}`),
    api(`/api/generation-tasks?${query}&view=client`),
  ]);
  generationWorkbenchState = {
    assets: profileSanitizePayload(assets.assets || [], profile),
    tasks: profileSanitizePayload(tasks.tasks || [], profile),
    clientTasks: sanitizeCustomerPayload(clientTasks.tasks || []),
  };
  renderGenerationAssets();
  renderGenerationTasks();
  renderGenerationClientDelivery();
  if (scheduleRefresh) scheduleGenerationWorkbenchRefresh();
}

function renderGenerationWorkbenchRoute(){
  const active = isGenerationWorkbenchRoute();
  const benchmarkActive = isBenchmarkInsightsRoute();
  const standaloneActive = active || benchmarkActive;
  if (!active) clearGenerationWorkbenchRefresh();
  if (!benchmarkActive) clearBenchmarkWorkbenchPoll();
  const wb = $('#generationWorkbench');
  if (wb) wb.hidden = !active;
  const benchmarkWorkbench = $('#benchmarkInsightsWorkbench');
  if (benchmarkWorkbench) benchmarkWorkbench.hidden = !benchmarkActive;
  renderInternalWorkspaceShell(benchmarkActive ? 'benchmark' : (active ? 'production' : 'operations'));
  const wbLink = document.querySelector('.customer-hero-actions a[href="/internal/generation-workbench"]');
  const benchmarkLink = document.querySelector('.customer-hero-actions a[href="/internal/benchmark-insights"]');
  const intakeLink = document.querySelector('.customer-hero-actions a[href="/internal/#diagnosisWorkflow"]');
  const planLink = document.querySelector('.customer-hero-actions a[href="/internal/#planSection"]');
  if (wbLink) {
    wbLink.classList.toggle('customer-hero-primary', active);
    wbLink.classList.toggle('customer-hero-secondary', !active);
    wbLink.setAttribute('aria-current', active ? 'page' : 'false');
  }
  if (benchmarkLink) {
    benchmarkLink.classList.toggle('customer-hero-primary', benchmarkActive);
    benchmarkLink.classList.toggle('customer-hero-secondary', !benchmarkActive);
    benchmarkLink.setAttribute('aria-current', benchmarkActive ? 'page' : 'false');
  }
  if (intakeLink) {
    intakeLink.classList.toggle('customer-hero-primary', !standaloneActive);
    intakeLink.classList.toggle('customer-hero-secondary', standaloneActive);
  }
  if (planLink) planLink.hidden = standaloneActive;
  if (!isInternalProfile()) return;
  const routeDependentElements = [
    '#allCustomersPanel',
    '#internalBillingPanel',
    '#customerDetailDashboard',
    '#internalOpsTabbar',
    '#feishuCollaborationPanel',
    '#diagnosisWorkflow',
    '#internalResultSection',
    '#planSection',
    '#feedbackHint',
    '#feedbackWorkflow',
    '.internal-debug-panel',
    '.internal-progress-strip'
  ];
  routeDependentElements.forEach((selector) => {
    const el = $(selector);
    if (!el) return;
    el.hidden = standaloneActive;
  });
  if (!standaloneActive) {
    renderWorkflowVisibility();
  }
}

function renderInternalWorkspaceShell(workspace = isGenerationWorkbenchRoute() ? 'production' : (isBenchmarkInsightsRoute() ? 'benchmark' : 'operations')){
  if (!isInternalProfile()) return;
  const productionActive = workspace === 'production';
  const benchmarkActive = workspace === 'benchmark';
  const standaloneActive = productionActive || benchmarkActive;
  document.body.classList.toggle('internal-production-mode', productionActive);
  document.body.classList.toggle('internal-benchmark-mode', benchmarkActive);
  document.body.classList.toggle('internal-operations-mode', !standaloneActive);
  document.body.dataset.internalWorkspace = workspace;
  const copy = benchmarkActive
    ? {
      kicker: '内部版 · 对标内容洞察',
      title: '市场证据工作台',
      desc: '把对标账号与代表内容变成有来源、可审核、可追踪的市场信号，再用于内部方案验证。',
    }
    : productionActive
    ? {
      kicker: '内部版 · 素材生产工作台',
      title: '内容生产工作台',
      desc: '写清楚生成需求，后台完成后直接查看、复制和验收成稿。',
    }
    : {
      kicker: '内测版 · 智能诊断内核',
      title: '获客罗盘',
      desc: '主流程与客户版保持一致：先填写/确认业务信息，生成本轮内容建议，再记录发布效果；内部诊断、数据导入导出和清空能力收在调试面板里。',
    };
  const kicker = $('#internalHeroKicker');
  const title = $('#internalHeroTitle');
  const desc = $('#internalHeroDesc');
  if (kicker) kicker.textContent = copy.kicker;
  if (title) title.textContent = copy.title;
  if (desc) desc.textContent = copy.desc;
  ['.internal-progress-strip', '.internal-debug-panel'].forEach((selector) => {
    const el = $(selector);
    if (el) el.hidden = standaloneActive;
  });
}

async function handleGenerationAssetSubmit(form){
  const data = formData(form);
  const file = form.querySelector('[name="asset_file"]')?.files?.[0];
  if (file) {
    data.original_filename = file.name;
    data.mime_type = file.type || 'application/octet-stream';
    data.file_size = file.size;
    data.sha256 = await sha256ForFile(file);
    data.file_content_base64 = await readFileAsBase64(file);
  }
  if (!file && !data.storage_url) {
    data.text_content = `${data.project_id || ''}:${data.client_id || ''}:${Date.now()}`;
    data.original_filename = data.original_filename || 'mock-reference.txt';
    data.mime_type = 'text/plain';
  }
  const result = await api('/api/assets', {method:'POST', body: JSON.stringify(data)});
  setGenerationMessage('#generationAssetMessage', `素材已保存：${result.asset?.asset_id || ''}`);
  await loadGenerationWorkbench();
}

async function handleGenerationTaskSubmit(form){
  const data = formData(form);
  const selectedAssets = $$('#generationAssetPicker input[type="checkbox"]:checked').map((input)=>input.value);
  data.input_asset_ids = selectedAssets;
  data.output_spec = generationOutputSpecFor(data, form);
  GENERATION_OUTPUT_SPEC_FIELDS.forEach((field) => delete data[field]);
  delete data.client_visible;
  const submitButton = form.querySelector('button[type="submit"]');
  const idleLabel = GENERATION_TYPE_UI[data.generation_type]?.submitLabel || '生成内容';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = '正在创建并提交...';
  }
  try {
    const created = await api('/api/generation-tasks', {method:'POST', body: JSON.stringify(data)});
    const taskId = created.task?.task_id || '';
    const submitted = await api(`/api/generation-tasks/${encodeURIComponent(taskId)}/submit`, {
      method: 'POST',
      body: JSON.stringify({client_id: data.client_id}),
    });
    setGenerationMessage(
      '#generationTaskMessage',
      submitted.task?.status === 'generating'
        ? '任务已进入后台生成。通常需要 30-90 秒，页面会自动更新，离开本页也不会中断。'
        : '成品已经生成，请在下方直接查看并验收。'
    );
    await loadGenerationWorkbench();
    const taskCard = document.querySelector(`.generation-task-card[data-task-id="${CSS.escape(String(taskId))}"]`);
    taskCard?.scrollIntoView({behavior:'smooth', block:'center'});
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = idleLabel;
    }
  }
}

async function runGenerationTaskAction(action, taskId){
  const client_id = generationClientId();
  let endpoint = `/api/generation-tasks/${encodeURIComponent(taskId)}/${action}`;
  let body = {client_id};
  if (action === 'qa-fail') {
    endpoint = `/api/generation-tasks/${encodeURIComponent(taskId)}/qa`;
    body = {client_id, qa_status: 'failed', qa_reviewer: 'QA', rejection_reason: '画面或内容仍需调整', qa_notes: '先失败一次，验证 QA 流转'};
  }
  if (action === 'qa-pass') {
    endpoint = `/api/generation-tasks/${encodeURIComponent(taskId)}/qa`;
    body = {client_id, qa_status: 'passed', qa_reviewer: 'QA', qa_notes: '验收通过，可进入客户区', visual_check: true, content_check: true, brand_check: true, platform_fit_check: true, client_visibility_check: true};
  }
  const result = await api(endpoint, {method:'POST', body: JSON.stringify(body)});
  if (action === 'submit') {
    setGenerationMessage(
      '#generationTaskMessage',
      result.task?.status === 'generating'
        ? '任务已进入后台生成，通常需要 30-90 秒。页面会自动更新，完成后直接显示成稿。'
        : '成稿已完成，请在下方查看、复制并验收。'
    );
  } else {
    toast(`任务状态：${generationStatusLabel(result.task?.status || '')}`);
  }
  await loadGenerationWorkbench();
}

async function copyGenerationTaskOutput(taskId){
  const task = (generationWorkbenchState.tasks || []).find((item) => String(item.task_id) === String(taskId));
  const text = generationOutputTextForTask(task);
  if (!text) throw new Error('这条任务还没有可复制的成稿');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  toast('成稿已复制，可以粘贴使用');
}

async function copyGenerationTaskAssetLink(taskId){
  const task = (generationWorkbenchState.tasks || []).find((item) => String(item.task_id) === String(taskId));
  const asset = generationOutputMediaForTask(task);
  const url = generationRenderableMediaUrl(asset);
  if (!url) throw new Error('这条任务还没有可复制的成品链接');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  toast('成品链接已复制');
}

async function showGenerationFeishuPayload(){
  const task = (generationWorkbenchState.tasks || [])[0];
  const box = $('#generationFeishuPayload');
  if (!task) {
    if (box) box.textContent = '暂无任务可同步。';
    return;
  }
  const result = await api('/api/feishu/sync', {method:'POST', body: JSON.stringify({client_id: task.client_id, task_id: task.task_id})});
  if (box) box.textContent = JSON.stringify(result, null, 2);
}

let generationWorkbenchInitialized = false;

function initGenerationWorkbench(){
  renderGenerationWorkbenchRoute();
  if (!isGenerationWorkbenchRoute()) return;
  updateGenerationRequestedModel();
  if (generationWorkbenchInitialized) {
    loadGenerationWorkbench().catch((error)=>toast(error.message));
    return;
  }
  generationWorkbenchInitialized = true;
  $('#generationTypeSelect')?.addEventListener('change', updateGenerationRequestedModel);
  $('#generationAssetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await handleGenerationAssetSubmit(e.target);
    } catch (error) {
      setGenerationMessage('#generationAssetMessage', error.message || '素材保存失败', 'error');
    }
  });
  $('#generationTaskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await handleGenerationTaskSubmit(e.target);
    } catch (error) {
      setGenerationMessage('#generationTaskMessage', error.message || '任务创建失败', 'error');
    }
  });
  $('#generationTaskList')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-gw-action][data-task-id]');
    if (!button) return;
    if (button.dataset.gwAction === 'copy-output') {
      copyGenerationTaskOutput(button.dataset.taskId).catch((error)=>toast(error.message || '复制成稿失败'));
      return;
    }
    if (button.dataset.gwAction === 'copy-asset-link') {
      copyGenerationTaskAssetLink(button.dataset.taskId).catch((error)=>toast(error.message || '复制成品链接失败'));
      return;
    }
    if (button.dataset.gwAction === 'check-progress') {
      refreshGeneratingWorkbenchTasks().catch((error)=>toast(error.message || '检查进度失败'));
      return;
    }
    runGenerationTaskAction(button.dataset.gwAction, button.dataset.taskId).catch((error)=>toast(error.message || '任务操作失败'));
  });
  $('#refreshGenerationWorkbench')?.addEventListener('click', () => loadGenerationWorkbench().catch((error)=>toast(error.message)));
  $('#generationFeishuSync')?.addEventListener('click', () => showGenerationFeishuPayload().catch((error)=>toast(error.message)));
  loadGenerationWorkbench().catch((error)=>toast(error.message));
}

function syncRouteState(){
  setAppShell();
  if (isInternalProfile() && !internalAuthVerified) {
    initInternalAccessGate();
    refreshAllCustomers({ force: true }).catch(() => {});
    return;
  }
  renderGenerationWorkbenchRoute();
  if (!isInternalProfile()) return;
  const nextClientId = customerClientId();
  const clientChanged = Boolean(activeInternalRouteClientId && nextClientId !== activeInternalRouteClientId);
  activeInternalRouteClientId = nextClientId;
  if (clientChanged) {
    customerDetailEditMode = false;
    internalOpsTab = 'plans';
  }
  if (!internalAppInitialized) {
    initInternalApp();
    return;
  }
  if (clientChanged && !isInternalStandaloneRoute()) {
    loadAll().catch((error)=>toast(error.message));
    refreshAllCustomers({ force: true }).catch(() => {});
    loadInternalBillingOrders().catch(() => {});
    return;
  }
  if (isGenerationWorkbenchRoute()) {
    initGenerationWorkbench();
  } else if (isBenchmarkInsightsRoute()) {
    initBenchmarkWorkbench();
  } else {
    renderAllFromClient();
    refreshAllCustomers().catch(() => {});
    renderInternalBillingPanel();
  }
}

function initInternalRouteNavigation(){
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || link.target) return;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/internal/')) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return;
    event.preventDefault();
    history.pushState({}, '', url.pathname + url.search + url.hash);
    syncRouteState();
    if (url.hash) {
      if (url.hash === '#planSection') openInternalOpsTab('plans');
      else if (url.hash === '#feedbackWorkflow') openInternalOpsTab('feedback');
      try { document.querySelector(url.hash)?.scrollIntoView({behavior:'smooth', block:'start'}); } catch (e) {}
    }
  });
  window.addEventListener('popstate', syncRouteState);
  window.addEventListener('hashchange', syncRouteState);
}

let internalAppInitialized = false;
let activeInternalRouteClientId = '';

function initInternalApp(){
  if (!internalAuthVerified) {
    initInternalAccessGate();
    return;
  }
  if (internalAppInitialized) {
    syncRouteState();
    return;
  }
  internalAppInitialized = true;
  initGenerationWorkbench();
  initBenchmarkWorkbench();
  initInternalChoices();
  initInternalAiIntake();
  $('#assessmentForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    syncInternalChoicesBeforeSubmit();
    await withBusy(e.submitter, '生成中...', async () => {
      const payload = formData(e.target);
      Object.keys(payload).forEach((key) => { payload[key] = String(payload[key] || '').trim(); });
      payload.ai_understanding_confirmed = e.target.dataset.aiConfirmed === 'yes' ? 'yes' : '';
      const validation = customerRequired(payload) || internalGenerationGate(payload);
      if (validation) {
        renderInternalIntakeSnapshot(e.target);
        throw new Error(validation);
      }
      payload.client_mode = 'internal_test';
      payload.source = 'internal_test';
      payload.client_id = customerClientId();
      payload.customer_key = explicitCustomerClientId() || customerClientId();
      delete payload.ai_understanding_confirmed;
      if (payload.posting_frequency_detail) payload.posting_frequency = payload.posting_frequency_detail;
      delete payload.posting_frequency_detail;
      payload.benchmark = normalizeBenchmark(payload);
      ['benchmark_platform','benchmark_accounts','benchmark_account_1','benchmark_account_2','benchmark_account_3','benchmark_notes','benchmark_sample_content'].forEach((key)=>delete payload[key]);
      const result = await api('/api/assessments', {method:'POST', body: JSON.stringify(payload)});
      const assessment = result.assessment || payload;
      clientState = buildVersionedProjectState(result, assessment, 'internal_test', null, '项目首次诊断');
      saveLocal();
      e.target.reset();
      toast('诊断已生成');
      renderAllFromClient();
    });
  });

  $('#feedbackForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const button = e.submitter || e.target.querySelector('button[type="submit"]');
    const originalText = button?.textContent;
    const setFeedbackSaveMessage = (message, tone = 'success') => setCustomerMessage('#feedbackSaveMessage', message, tone);
    setFeedbackSaveMessage('正在保存反馈...', 'success');
    if (button) {
      button.disabled = true;
      button.textContent = '保存中...';
    }
    try {
      const data = formData(e.target);
      ['views','backend_views','backend_play_count','play_count','likes','comments','favorites','shares','consultations'].forEach(k=>data[k]=toNonNegative(data[k]));
      data.views = playbackValue(data);
      data.backend_views = playbackValue(data);
      data.backend_play_count = playbackValue(data);
      data.publish_link = normalizeExternalUrl(data.publish_link || '');
      if (!data.publish_link) throw new Error('首次/本条发布链接必填：请粘贴已发布内容链接后再保存反馈');
      const binding = resolveInternalFeedbackPlan(data);
      if (!binding.plan) throw new Error('请先从内容计划卡片选择一条计划，再保存反馈。');
      const plan = setInternalFeedbackPlan(binding.plan.id, binding.source) || binding.plan;
      data.content_plan_id = planIdValue(plan);
      data.plan_topic = plan.topic || '';
      data.plan_binding_source = binding.source || 'manual_card';
      const feedback = {
        id: Date.now(),
        client_id: clientState.client_id || clientState.assessment?.client_id || 'internal',
        project_id: clientState.project?.id || 'default-project',
        cycle_id: clientState.current_cycle_id || 'cycle-1',
        ...data,
        feedback_stage: data.feedback_stage || 'T+24',
        created_at: localTimestamp(),
      };
      plan.status = '已发布';
      plan.project_id = plan.project_id || clientState.project?.id || 'default-project';
      plan.cycle_id = plan.cycle_id || clientState.current_cycle_id || 'cycle-1';
      if (feedback.publish_link) plan.publish_link = feedback.publish_link;
      clientState.feedback = [feedback, ...clientState.feedback.filter((item) => !(samePlanId(item.content_plan_id, data.content_plan_id) && String(item.feedback_stage || 'T+24') === String(feedback.feedback_stage)))];
      clientState.review = createLocalReview();
      syncProjectStage();
      saveLocal();
      renderAllFromClient();
      e.target.reset();
      const planDisplay = $('#selectedPlanDisplay');
      if (planDisplay) planDisplay.textContent = '从计划卡片选择';
      const cloudSynced = await pushCloudProjectStore({silent:true});
      const successMessage = cloudSynced
        ? '反馈已保存，后台项目态、回填记录和下一轮 7 天建议已更新。'
        : '反馈已保存，本地看板和下一轮 7 天建议已更新；云端项目态同步失败。';
      setFeedbackSaveMessage(successMessage);
      toast(successMessage);
      api('/api/feedback', {method:'POST', body: JSON.stringify({...data, client_id: feedback.client_id, project_id: feedback.project_id, cycle_id: feedback.cycle_id})})
        .then(() => setFeedbackSaveMessage('反馈已保存，并已同步云端临时接口。'))
        .catch(() => {
          const syncMessage = '本地已保存；云端临时接口同步失败，不影响本浏览器查看。';
          setFeedbackSaveMessage(syncMessage);
          toast(syncMessage);
        });
    } catch (error) {
      const message = error.message || '保存反馈失败，请检查表单后重试。';
      setFeedbackSaveMessage(message, 'error');
      toast(message);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText || '保存反馈';
      }
    }
  });

  $('#reviewBtn')?.addEventListener('click', async ()=>{
    await withBusy($('#reviewBtn'), '生成中...', async () => {
      clientState.review = createLocalReview();
      syncProjectStage();
      saveLocal();
      renderAllFromClient();
      toast('周复盘已更新');
      api('/api/reviews', {method:'POST', body: JSON.stringify({})})
        .catch(() => toast('本地复盘已保存；云端临时接口同步失败'));
    });
  });
  $('#refreshBtn')?.addEventListener('click', () => {
    resetForNewCustomer();
  });
  $('#feishuPushPlansBtn')?.addEventListener('click', () => {
    pushCurrentProjectToFeishu().catch((error)=>toast(error.message || '飞书同步失败'));
  });
  activeInternalRouteClientId = customerClientId();
  loadAll()
    .then(()=>loadFeishuCollaborationStatus())
    .catch(err=>toast(err.message));
  refreshAllCustomers({ force: true }).catch((error)=>toast(error.message || '客户列表读取失败'));
  loadInternalBillingOrders().catch((error)=>toast(error.message || '商业订单读取失败'));
}

setAppShell();
initPlanFeedbackButtons();
initInternalRouteNavigation();
$('#allCustomersPanel')?.addEventListener('change', (event) => {
  const sel = event.target;
  if (sel && sel.id === 'allCustomersSelect' && sel.value) {
    window.location.href = '/internal/?client_id=' + encodeURIComponent(sel.value);
  }
});
$('#allCustomersPanel')?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-all-customer-client]');
  if (!button?.dataset?.allCustomerClient) return;
  window.location.href = '/internal/?client_id=' + encodeURIComponent(button.dataset.allCustomerClient);
});
$('#internalBillingRefresh')?.addEventListener('click', () => {
  loadInternalBillingOrders().catch((error)=>toast(error.message || '商业订单读取失败'));
});
$('#internalBillingPanel')?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-billing-confirm]');
  if (!button?.dataset?.billingConfirm) return;
  confirmInternalBillingOrder(button.dataset.billingConfirm, button.closest('[data-billing-order-id]'))
    .catch((error)=>toast(error.message || '订单确认失败'));
});
$('#customerDetailDashboard')?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-detail-action]');
  const action = button?.dataset?.detailAction;
  if (!action) return;
  if (action === 'edit') {
    customerDetailEditMode = true;
    renderAllFromClient();
    scrollToSection('#diagnosisWorkflow');
  } else if (action === 'plans') {
    openInternalOpsTab('plans', '#planSection');
  } else if (action === 'feedback') {
    openInternalOpsTab('feedback', '#feedbackWorkflow');
  }
});
$('#internalOpsTabbar')?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-ops-tab]');
  if (!button?.dataset?.opsTab || button.disabled) return;
  internalOpsTab = button.dataset.opsTab;
  renderInternalOpsTabs();
});
if (isInternalProfile()) {
  initInternalAccessGate();
} else {
  initCustomerTrial();
}
