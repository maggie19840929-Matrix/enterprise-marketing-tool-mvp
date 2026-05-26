const $ = (s) => document.querySelector(s);
const APP_VERSION = '1.7.0';
const VERSION_LABEL = 'v1.7.0 · 首访填写体验修复版';
const STORAGE_KEY = 'enterpriseMarketingMvpState.v5';
const STORAGE_PREFIX = 'enterpriseMarketingMvpState.';
const PROJECTS_KEY = 'enterpriseMarketingMvpProjects.v1';
const DEMO_DISABLED_KEY = 'enterpriseMarketingMvpDemoDisabled.v1';
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
  best_recent_content: '一条内容有没有获客价值，不是看点赞，而是看收藏、私信和咨询',
  account_preference: '内容决策局',
  benchmark: {
    platform: '小红书',
    accounts: ['https://example.com/benchmark-account'],
    notes: '参考企业增长类账号：标题多用真实问题、避坑、复盘方法，收藏和私信反馈较高。',
    sample_content: '代表内容：发了很多内容为什么还是没人咨询？数据摘要：收藏高于点赞，私信集中问复盘表。',
  },
  contact: '企业营销工具测试样例',
};

const blankClientState = () => ({
  project: null,
  project_stage: '未诊断',
  current_cycle_id: 'cycle-1',
  assessment: null,
  diagnosis: null,
  plans: [],
  feedback: [],
  review: null,
});

let clientState = blankClientState();
let projectStore = {activeProjectId: null, projects: []};
let isCreatingNewProject = false;
let internalWorkbenchVisible = false;

const api = async (url, opts={}) => {
  const res = await fetch(url, {headers:{'Content-Type':'application/json'}, ...opts});
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || '请求失败');
  return data;
};
const toast = (msg) => { const el=$('#toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2400); };
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
const makeProject = (assessment = {}, existing = null) => existing || {
  id: assessment.project_id || `project-${Date.now()}`,
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

function stripWorkbenchSuffix(name){
  return String(name || '').replace(/作战台$/, '');
}
function displayProjectName(item = {}){
  return stripWorkbenchSuffix(item.name || item.state?.project?.name || item.state?.assessment?.company_name || '未命名项目');
}
function contentDecisionSampleState(){
  const assessment = {...CONTENT_DECISION_SAMPLE, id: 1, created_at: localTimestamp()};
  const project = makeProject(assessment, {id:'project-content-decision-demo', name:'内容决策局｜示例项目', created_at: localTimestamp()});
  const plans = localSamplePlans().map((plan, index)=> index === 0 ? {...plan, status:'已发布', publish_link: plan.publish_link || 'https://example.com/published/content-review-table'} : plan);
  const state = normalizeState({
    project,
    project_stage: '运营中',
    current_cycle_id: 'cycle-1',
    assessment,
    diagnosis: localSampleDiagnosis(),
    plans,
    feedback: makeOperatingSampleFeedback(),
    review: null,
  });
  state.review = createLocalReview();
  return state;
}
function ensureSampleProjectInStore(){
  const sampleId = 'project-content-decision-demo';
  if ((projectStore.projects || []).some((item)=>String(item.id) === sampleId)) return;
  const state = contentDecisionSampleState();
  const summary = projectSummaryFromState(state);
  summary.name = '内容决策局｜示例项目';
  projectStore.projects.push(summary);
  if (!projectStore.activeProjectId) projectStore.activeProjectId = sampleId;
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
    project_stage: state.project_stage || inferProjectStage({plans: state.plans, feedback: state.feedback, review: state.review, diagnosis: state.diagnosis}),
    current_cycle_id,
    assessment,
    diagnosis: state.diagnosis || null,
    plans: withMeta(state.plans),
    feedback: withMeta(state.feedback),
    review: state.review || null,
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
    return raw.startsWith(WINDOW_STORAGE_PREFIX) ? JSON.parse(raw.slice(WINDOW_STORAGE_PREFIX.length)) : {};
  } catch {
    return {};
  }
};
const readHashStore = () => {
  try {
    const raw = String(location?.hash || '').replace(/^#/, '');
    return raw.startsWith(HASH_STORAGE_PREFIX) ? JSON.parse(decodeURIComponent(raw.slice(HASH_STORAGE_PREFIX.length))) : {};
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
    const store = readFallbackStore();
    store[key] = String(value);
    const wroteFallback = writeFallbackStore(store);
    let wroteArea = false;
    if (area) { try { area.setItem(key, value); wroteArea = true; } catch {} }
    return wroteArea || wroteFallback;
  },
  removeItem(key){
    const area = storageArea();
    const store = readFallbackStore();
    delete store[key];
    const wroteFallback = writeFallbackStore(store);
    let wroteArea = false;
    if (area) { try { area.removeItem(key); wroteArea = true; } catch {} }
    return wroteArea || wroteFallback;
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
function loadProjectStore(){
  try {
    const parsed = JSON.parse(safeStorage.getItem(PROJECTS_KEY) || 'null');
    if (parsed && Array.isArray(parsed.projects)) {
      const projects = parsed.projects.map((item)=>({
        ...item,
        state: normalizeState(item.state || {}),
      })).filter((item)=>item.id && hasRestorableState(item.state));
      const activeProjectId = projects.some((item)=>String(item.id) === String(parsed.activeProjectId))
        ? parsed.activeProjectId
        : projects[0]?.id || null;
      projectStore = {activeProjectId, projects};
    }
  } catch {
    projectStore = {activeProjectId: null, projects: []};
  }
  return projectStore;
}
function saveProjectStore(){
  return safeStorage.setItem(PROJECTS_KEY, JSON.stringify(projectStore));
}
function upsertCurrentProjectState(){
  if (!hasRestorableState(clientState)) return false;
  const summary = projectSummaryFromState(clientState);
  clientState = summary.state;
  projectStore.activeProjectId = summary.id;
  const index = projectStore.projects.findIndex((item)=>String(item.id) === String(summary.id));
  if (index >= 0) projectStore.projects[index] = summary;
  else projectStore.projects.unshift(summary);
  projectStore.projects.sort((a,b)=>String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  saveProjectStore();
  return true;
}
const saveLocal = () => {
  clientState.saved_at = localTimestamp();
  upsertCurrentProjectState();
  return safeStorage.setItem(STORAGE_KEY, JSON.stringify(clientState));
};
const loadLocal = () => {
  loadProjectStore();
  const active = projectStore.projects.find((item)=>String(item.id) === String(projectStore.activeProjectId)) || projectStore.projects[0];
  if (active?.state && hasRestorableState(active.state)) {
    projectStore.activeProjectId = active.id;
    saveProjectStore();
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(active.state));
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
        if (hasRestorableState(normalized)) candidates.push({key, state: normalized});
      }
    } catch {}
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => stateWeight(b.state) - stateWeight(a.state));
  const best = candidates[0];
  clientState = best.state;
  upsertCurrentProjectState();
  if (best.key !== STORAGE_KEY) safeStorage.setItem(STORAGE_KEY, JSON.stringify(best.state));
  return best.state;
};
function switchProject(projectId){
  loadProjectStore();
  const project = projectStore.projects.find((item)=>String(item.id) === String(projectId));
  if (!project) { toast('未找到该项目'); return; }
  isCreatingNewProject = false;
  projectStore.activeProjectId = project.id;
  clientState = normalizeState(project.state);
  saveProjectStore();
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(clientState));
  renderAllFromClient();
  toast(`已切换到：${project.name}`);
}
window.switchProject = switchProject;
function startNewProject(){
  isCreatingNewProject = true;
  internalWorkbenchVisible = false;
  clientState = blankClientState();
  projectStore.activeProjectId = null;
  saveProjectStore();
  safeStorage.setItem(DEMO_DISABLED_KEY, '1');
  safeStorage.removeItem(STORAGE_KEY);
  renderAllFromClient();
  clearProblemSelection();
  closeMoreActions();
  showDiagnosisWorkflow();
  toast('已进入新项目填写，不影响已保存项目。');
}
window.startNewProject = startNewProject;
const toNonNegative = (value) => Math.max(0, Number(value || 0));
const withBusy = async (button, busyText, task) => {
  const originalText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = busyText;
  }
  try {
    await task();
  } catch (error) {
    toast(error.message || '操作失败，请稍后再试');
  } finally {
    if (button) {
      button.disabled = false;
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
    weekly_action: '本周围绕“内容有没有带来客户”连续测试 7 条内容，并按 T+24 / T+72 / T+7 回填。',
    next_step: '先复制收藏和咨询信号更强的复盘表主题，再降权纯工具介绍内容。',
    risk_warning: '如果只看点赞，不看收藏、评论和咨询，会误判内容是否真的带来客户。',
    platform_recommendations: {
      strategy: '主平台先做小红书，视频号做复用，朋友圈承接信任。',
      primary: [{platform:'小红书', reason:'适合沉淀搜索和收藏型内容'}],
      support: [{platform:'视频号', reason:'复用老板视角短视频'}],
      client_platforms: [{platform:'朋友圈/私域', reason:'承接已有客户信任'}],
      avoid: [{platform:'自动矩阵发布', reason:'当前阶段不做自动发布，避免封号和失控'}],
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
    ['一条内容有没有获客价值，不是看点赞', '用收藏、评论、咨询三类信号判断内容是否值得复制', '图文/短视频', '引导主页查看复盘表', '收藏+咨询'],
    ['老板没时间做运营，先做每周内容复盘', '把复杂运营动作压缩成每周一次看板判断', '图文', '引导领取内容复盘表', '收藏'],
    ['发了很多内容为什么还是没人咨询', '拆解内容没有承接到服务入口的常见断点', '短视频', '引导主页咨询诊断', '咨询'],
    ['别再只问AI写什么，先问客户为什么买', '把选题从工具输出拉回客户真实痛点', '图文', '引导做一次诊断', '评论+收藏'],
    ['企业账号第一周别追爆款', '先做低成本小样本验证，避免一开始重投入', '图文', '引导保存检查清单', '收藏'],
    ['内容复盘表怎么填才有用', '展示发布链接、T+24/T+72/T+7、咨询信号字段', '图文', '引导主页查看模板', '收藏+私信'],
    ['下周选题不是拍脑袋，是复制胜出主题', '用本周数据决定复制、降权和重测方向', '短视频', '引导预约复盘', '咨询'],
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
    notes: '收藏高于点赞，私信集中问复盘表，说明“内容是否带来客户”主题值得复制。',
    created_at: localTimestamp(),
  }];
}
async function loadContentDecisionSample({silent = false} = {}){
  isCreatingNewProject = false;
  internalWorkbenchVisible = false;
  let result = null;
  try {
    result = await api('/api/assessments', {method:'POST', body: JSON.stringify(CONTENT_DECISION_SAMPLE)});
  } catch {
    result = {assessment: {...CONTENT_DECISION_SAMPLE, id: 1, created_at: localTimestamp()}, diagnosis: localSampleDiagnosis(), plans: localSamplePlans()};
  }
  const assessment = result.assessment || {...CONTENT_DECISION_SAMPLE, id: 1, created_at: localTimestamp()};
  const project = makeProject(assessment, {id:'project-content-decision-demo', name:'内容决策局｜示例项目', created_at: localTimestamp()});
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
    safeStorage.removeItem(STORAGE_KEY);
    safeStorage.removeItem(PROJECTS_KEY);
    safeStorage.removeItem(DEMO_DISABLED_KEY);
    projectStore = {activeProjectId: null, projects: []};
    isCreatingNewProject = true;
    internalWorkbenchVisible = false;
    clientState = blankClientState();
    params.delete('empty');
    params.delete('reset');
    const query = params.toString();
    if (history?.replaceState) history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`);
    renderAllFromClient();
    return;
  }
  const local = loadLocal();
  if (hasRestorableState(local)) {
    isCreatingNewProject = false;
    internalWorkbenchVisible = false;
    clientState = {...clientState, ...local};
    renderAllFromClient();
    return;
  }
  clientState = blankClientState();
  renderAllFromClient();
}

function pct(n){ return `${Math.round((Number(n)||0)*100)}%`; }
function esc(v){ return String(v ?? '').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function num(v){ return Number(v || 0); }
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
    if (!existing || stageRank(item.feedback_stage) > stageRank(existing.feedback_stage) || (stageRank(item.feedback_stage) === stageRank(existing.feedback_stage) && String(item.created_at || '') > String(existing.created_at || ''))) {
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
    accounts,
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
  const total_views = rows.reduce((sum, item) => sum + num(item.views), 0);
  const total_interactions = rows.reduce((sum, item) => sum + interactions(item), 0);
  const total_consultations = rows.reduce((sum, item) => sum + num(item.consultations), 0);
  let next_suggestion = '先执行：发布第一条内容，并把首次发布链接回填到系统，否则不算闭环。';
  if (total_consultations > 0) next_suggestion = '加码：已有内容带来咨询，下周复制最高咨询主题，并保留合规私信/主页咨询入口。';
  else if (published_plans > 0) next_suggestion = '优化：已有发布但暂无咨询，下周强化客户痛点表达，并用私信/主页咨询承接。';
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
  const winner = rows.slice().sort((a,b)=>(num(b.consultations)-num(a.consultations)) || (interactions(b)-interactions(a)) || (num(b.views)-num(a.views)))[0];
  const plan = clientState.plans.find((p)=>Number(p.id)===Number(winner.content_plan_id));
  return {feedback:winner, plan};
}
function latestReviewEvidence(){
  return clientState.review || autoReviewFromFeedback();
}
function evidenceLink(anchor, label){
  return `<a class="evidence-anchor-link" href="#${esc(anchor)}" onclick="openClientEvidence('${esc(anchor)}')">${esc(label)}</a>`;
}
function sourceLabelForAnchor(anchor){
  if (anchor === 'evidence-r') return '最新内容复盘';
  if (anchor === 'evidence-v') return '系统诊断';
  return '客户档案';
}
function evidenceBadge(anchor){
  return `<a class="source-chip" href="#${esc(anchor)}" onclick="openClientEvidence('${esc(anchor)}')">基于：${esc(sourceLabelForAnchor(anchor))}</a>`;
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

function returnToWorkbench(){
  isCreatingNewProject = false;
  internalWorkbenchVisible = true;
  loadProjectStore();
  const target = projectStore.projects.find((item)=>String(item.id) === String(projectStore.activeProjectId)) || projectStore.projects[0];
  if (target) switchProject(target.id);
  else renderAllFromClient();
  scrollToSection('#lifecycleWorkbench');
}
window.returnToWorkbench = returnToWorkbench;

function renderHeroActions(){
  const actions = $('#heroActions');
  const switcher = $('#heroProjectSwitcher');
  if (!clientState.diagnosis || isCreatingNewProject) {
    if (actions) actions.innerHTML = `<button class="secondary" type="button" onclick="loadContentDecisionSample()">看示例</button>`;
    return;
  }
  if (actions && !switcher) {
    actions.innerHTML = `<span id="heroProjectSwitcher"></span><button class="secondary" type="button" onclick="startNewProject()">重新填写</button><button class="secondary" type="button" onclick="showInternalWorkbench()">查看复盘数据</button><details class="more-actions" id="moreActions"><summary aria-label="更多数据操作">更多</summary><div class="more-actions-menu" role="menu"><button class="secondary" type="button" onclick="downloadDataBackup(); closeMoreActions();">导出数据</button><label class="secondary import-btn">导入数据<input id="importFile" type="file" accept="application/json" hidden onchange="importDataBackup(this.files[0]); this.value=''; closeMoreActions();" /></label><button id="refreshBtn" class="secondary danger-action" type="button" onclick="clearAllLocalData()">清空数据</button></div></details>`;
  }
  const slot = $('#heroProjectSwitcher');
  if (slot) slot.innerHTML = renderProjectSwitcher();
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
function showInternalWorkbench(){
  if (!clientState.diagnosis) {
    showDiagnosisWorkflow();
    return;
  }
  internalWorkbenchVisible = true;
  renderLifecycleWorkbench();
  scrollToSection('#lifecycleWorkbench');
  toast('复盘数据已展开。');
}
window.showInternalWorkbench = showInternalWorkbench;
function clearAllLocalData(){
  safeStorage.removeItem(STORAGE_KEY);
  safeStorage.removeItem(PROJECTS_KEY);
  safeStorage.setItem(DEMO_DISABLED_KEY, '1');
  projectStore = {activeProjectId: null, projects: []};
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

function renderProjectSwitcher(){
  loadProjectStore();
  const projects = projectStore.projects || [];
  if (!projects.length) return '';
  const activeId = clientState.project?.id || projectStore.activeProjectId || projects[0]?.id;
  const options = projects.map((item)=>`<option value="${esc(item.id)}" ${String(item.id) === String(activeId) ? 'selected' : ''}>${esc(displayProjectName(item))}</option>`).join('');
  return `<label class="project-switcher"><span>当前项目：</span><select aria-label="当前项目" onchange="switchProject(this.value)">${options}</select></label>`;
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
  if (!clientState.diagnosis || !internalWorkbenchVisible) {
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
      ? `发布 #${firstOpen?.id || 1} 内容，并回填发布链接`
      : clientState.project_stage === '复盘期'
        ? '确认下一轮复制什么、停止什么、重测什么'
        : (unfilled ? `回填 #${firstNeedFeedback?.id || ''} 内容的 T+72 数据` : d.next_suggestion);
  const todayReason = unfilled
    ? '已发布内容缺少反馈，当前无法判断是否继续复制该方向。'
    : (hasRealFeedback ? '已有真实反馈，优先把判断转成下一轮动作。' : '还没有真实反馈，先完成发布和回填，避免只看计划不看结果。');
  const todayEvidenceAnchor = unfilled || hasRealFeedback ? 'evidence-r' : 'evidence-k';
  const todayEvidence = todayEvidenceAnchor === 'evidence-r' ? evidenceBadge('evidence-r', 'R') : evidenceBadge('evidence-k', 'K');
  const decisionEvidenceAnchor = winner ? 'evidence-r' : 'evidence-v';
  const decisionEvidence = winner ? evidenceBadge('evidence-r', 'R') : evidenceBadge('evidence-v', 'V');
  const projectSwitcher = renderProjectSwitcher();
  const dataTitle = hasRealFeedback ? (unfilled ? '真实反馈数据 / 待回填数据' : '真实反馈数据') : '待回填数据';
  const winningText = winner ? `#${esc(winner.plan?.id || winner.feedback.content_plan_id)} ${esc(winner.plan?.topic || '已回填内容')}` : '暂无胜出内容，先发布并回填';
  const decisionText = winner
    ? `“${esc(winner.plan?.topic || '最高咨询内容')}”方向值得继续观察`
    : '还不能判断胜出方向，缺少真实反馈样本';
  const confidence = hasRealFeedback ? Math.min(92, 42 + clientState.feedback.length * 18 + d.total_consultations * 8) : 24;
  const stageTag = unfilled ? '<span class="war-tag orange">待回填</span>' : (hasRealFeedback ? '<span class="war-tag green">状态正常</span>' : '<span class="war-tag orange">待启动</span>');
  const reviewTag = `<span class="war-tag purple">${esc(cycleText)}</span>`;
  const hypothesis = `<span class="war-tag">假设：${esc(clientState.diagnosis?.priority_problem || clientState.assessment?.biggest_problem || '内容能否带来咨询')}</span>`;
  el.innerHTML = `<div class="war-room-shell">
    <div class="war-nav"><div class="war-brand"><span class="war-mark"></span><strong>${esc(projectName)}</strong></div><div class="war-tabs"><button class="active" type="button" onclick="scrollToSection('#lifecycleWorkbench')">作战台</button><button type="button" onclick="scrollToSection('#planSection')">计划/回填</button><button type="button" onclick="startNewProject()">新增项目</button></div><div class="war-cycle">${esc(cycleText)}</div></div>
    <section class="war-status-hero">
      <div><h2>${esc(cycleText)} · ${esc(meta.label)}</h2><div class="war-meta">${stageTag}${reviewTag}${hypothesis}</div></div>
    </section>
    <section class="war-main-row three-things">
      <article class="war-card war-todo"><div class="war-card-head"><span>1｜今天做什么</span><span class="war-tag orange">${unfilled ? '待处理' : '下一步'}</span></div><h3>${esc(todayAction)}</h3><p>${esc(todayReason)}</p><div class="war-meta">${todayEvidence}</div></article>
      <article class="war-card war-decision"><div class="war-card-head"><span>2｜下一步判断</span></div><div class="war-decision-main">${decisionText}</div><div class="war-confidence"><i style="width:${confidence}%"></i></div><div class="war-meta"><span class="war-tag green">咨询 ${d.total_consultations}</span><span class="war-tag">${winningText}</span>${decisionEvidence}</div></article>
      <article class="war-card war-data-card"><div class="war-card-head"><span>3｜关键数据</span><span class="war-tag">实时更新</span></div><div class="war-metrics compact">${renderOutcomeCards(d)}</div><p>${esc(dataTitle)}：发布、回填、咨询会更新这里。</p></article>
    </section>
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
  syncProjectStage();
  renderHeroActions();
  renderLifecycleWorkbench();
  renderWorkflowVisibility();
  renderDashboard(clientDashboard());
  renderCustomerSnapshot(clientState.assessment);
  renderFirstLinkGate();
  renderDiagnosis(clientState.diagnosis);
  renderPlans(clientState.plans);
  renderFeedback(clientState.feedback);
  renderReview(clientState.review || autoReviewFromFeedback());
  renderHeroActions();
}


function renderOutcomeCards(d){
  const cards = [
    ['计划', d.total_plans, ''],
    ['已发布', `${d.published_plans}/${d.total_plans || 0}`, ''],
    ['待回填', missingFeedbackCount(), missingFeedbackCount() ? 'warn' : ''],
    ['咨询', d.total_consultations, ''],
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
    ['私信/咨询', d.total_consultations],
    ['动态闭环分', dynamicLoopScore()],
  ].map(([k,v], index)=>`<div class="card metric-card ${index === 0 ? 'metric-primary' : ''}"><span>${k}</span><b>${v}</b></div>`).join('');
  el.innerHTML = '';
}

function renderWorkflowVisibility(){
  const hasPlans = clientState.plans.length > 0;
  const hasFeedback = clientState.feedback.length > 0;
  const hint = $('#feedbackHint');
  const workflow = $('#feedbackWorkflow');
  const planSection = $('#planSection');
  if (planSection) planSection.hidden = !hasPlans || clientState.project_stage === '未诊断';
  if (hint) hint.hidden = !hasPlans || clientState.project_stage === '未诊断';
  if (workflow) workflow.hidden = !hasFeedback;
  const diagnosisWorkflow = $('#diagnosisWorkflow');
  if (diagnosisWorkflow) diagnosisWorkflow.hidden = false;
}



function fieldRow(label, value){
  return `<div class="kv"><span>${esc(label)}</span><strong>${esc(value || '未填写')}</strong></div>`;
}

function renderFeedbackEvidenceRows(){
  const rows = latestFeedbackRows().slice().sort((a,b)=>(stageRank(b.feedback_stage)-stageRank(a.feedback_stage)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const visibleRows = rows.slice(0, 5);
  const review = latestReviewEvidence();
  if (!rows.length && !review) return '<div class="empty">暂无内容复盘依据。发布后从计划卡片进入回填，系统会把最新反馈用于今日动作和下一步判断。</div>';
  const reviewHtml = review ? `<div class="pain-box review-evidence"><span>最新复盘判断</span><p><strong>胜出主题：</strong>${esc(review.winner_topic || '暂无')}｜<strong>瓶颈：</strong>${esc(review.bottleneck || '未生成')}</p><p>${esc((review.next_actions || '').replace('加码「」同类角度', '加码「最高咨询内容」同类角度'))}</p></div>` : '';
  const rowsHtml = visibleRows.map((f)=>{
    const plan = clientState.plans.find((p)=>Number(p.id) === Number(f.content_plan_id));
    return `<div class="feedback-evidence-row">
      <div><strong>#${esc(f.content_plan_id)} ${esc(plan?.topic || '已回填内容')}</strong><span>${esc(f.feedback_stage || 'T+24')} · ${esc(f.created_at || '')}</span></div>
      <div class="feedback-evidence-metrics"><span>曝光 ${compactNumber(f.views)}</span><span>互动 ${compactNumber(interactions(f))}</span><span>咨询 ${num(f.consultations)}</span></div>
      <p>${esc(f.notes || '无备注')}</p>
    </div>`;
  }).join('');
  const moreHint = rows.length > visibleRows.length ? `<div class="small">已折叠 ${rows.length - visibleRows.length} 条历史反馈，避免页面无限拉长；完整记录见下方“反馈复盘”模块。</div>` : '';
  return `${reviewHtml}<div class="feedback-evidence-list">${rowsHtml}</div>${moreHint}`;
}

function renderCustomerSnapshot(a){
  const el = $('#clientSnapshot');
  if (!el) return;
  if (!a) {
    el.innerHTML = '<div class="empty">暂无客户数据，提交体检后这里会显示复盘与判断依据。</div>';
    return;
  }
  const d = clientState.diagnosis || {};
  const diagnosisRows = [
    ['当前阶段', d.stage || clientState.project_stage],
    ['策略清晰度', d.strategy_score ?? d.score ? `${d.strategy_score ?? d.score}/100` : '未生成'],
    ['当前最大问题', d.priority_problem],
    ['核心判断', d.insight],
    ['下一步动作', d.next_step || d.weekly_action],
  ];
  el.innerHTML = `<div class="snapshot-card evidence-split-card">
    <div class="snapshot-title">
      <strong>${esc(customerDisplayName(a, clientState.project))}</strong>
      <span>${esc(a.created_at || '本地暂存')}</span>
    </div>
    <div class="evidence-index"><span>依据中心</span>${evidenceLink('evidence-k','客户档案')}${evidenceLink('evidence-v','系统判断')}${evidenceLink('evidence-r','内容复盘依据')}</div>
    <div class="evidence-split-grid">
      <section class="evidence-column evidence-k" id="evidence-k">
        <div class="evidence-label"><b>档案</b><span>客户档案</span></div>
        <div class="kv-grid evidence-kv-grid">
          ${fieldRow('行业', a.industry)}
          ${fieldRow('主要目标', a.main_goal)}
          ${fieldRow('目标客户', a.target_customer)}
          ${fieldRow('产品/服务入口', a.offer)}
          ${fieldRow('当前平台', a.current_channels)}
          ${fieldRow('发布频率', a.posting_frequency)}
          ${fieldRow('最大问题', a.biggest_problem)}
          ${fieldRow('内容资产', a.content_assets)}
          ${fieldRow('月预算', a.monthly_budget)}
          ${fieldRow('决策周期', a.decision_cycle)}
          ${fieldRow('联系人', a.contact)}
          ${fieldRow('对标账号参考', hasBenchmark(a.benchmark) ? `${a.benchmark.platform || '未标注平台'}｜${(a.benchmark.accounts || []).length} 个账号` : '未填写')}
        </div>
        <div class="pain-box"><span>客户核心痛点</span><p>${esc(a.customer_pain || '未填写')}</p></div>
        ${hasBenchmark(a.benchmark) ? `<div class="pain-box"><span>对标账号备注</span><p>${esc([a.benchmark.notes, a.benchmark.sample_content].filter(Boolean).join('｜'))}</p></div>` : ''}
      </section>
      <section class="evidence-column evidence-v" id="evidence-v">
        <div class="evidence-label"><b>判断</b><span>系统判断</span></div>
        <div class="kv-grid evidence-kv-grid">
          ${diagnosisRows.map(([label, value]) => fieldRow(label, value)).join('')}
        </div>
        <div class="pain-box"><span>评分说明</span><p>${esc(d.score_note || '诊断分与闭环分需要由客户输入、发布计划、反馈回填和复盘数据共同支撑。')}</p></div>
        <div class="pain-box"><span>风险提醒</span><p>${esc(d.risk_warning || '未生成风险提醒')}</p></div>
      </section>
    </div>
    <details class="evidence-r-panel" id="evidence-r">
      <summary><span><b>内容复盘依据</b></span><em>最新反馈 + 自动周复盘，默认只显示最近5条</em></summary>
      ${renderFeedbackEvidenceRows()}
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

function renderDiagnosis(d){
  if(!d){ $('#latestDiagnosis').innerHTML='<div class="empty">提交后会生成当前问题、本周建议、7天内容计划和发布后回填提醒。</div>'; return; }
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
  const extraModules = `${benchmarkModule}${renderAccountSetup(d.account_setup)}${platformModule}`;
  $('#latestDiagnosis').innerHTML = `<div class="diagnosis-card compact-diagnosis customer-result">
    <div class="result-block">
      <div class="small">当前最大问题</div>
      <div class="big-action">${esc(d.priority_problem)}</div>
      <p>${esc(d.insight)}</p>
    </div>
    <div class="result-block">
      <div class="small">本周建议</div>
      <p><strong>${esc(d.next_step || d.weekly_action)}</strong></p>
    </div>
    <div class="result-block">
      <div class="small">7天内容计划</div>
      <p>下方已生成 7 条内容选题，先从前三条开始执行。</p>
      <button class="secondary" type="button" onclick="scrollToSection('#planSection')">查看7天计划</button>
    </div>
    <div class="result-block">
      <div class="small">发布后回填提醒</div>
      <p>内容发出去后，在计划卡片里点“发布后回填”，补链接和数据。</p>
    </div>
    <details class="diagnosis-more">
      <summary>查看补充依据</summary>
      <div class="warning"><div class="small">版本</div><p>${esc(d.version_label || VERSION_LABEL)}</p></div>
      <div class="warning"><div class="small">评分</div><p>策略清晰度 ${esc(d.strategy_score ?? d.score)}/100；数据回填后才看复盘分。</p></div>
      <div class="warning"><div class="small">评分说明</div><p>${esc(d.score_note || '闭环分必须由发布反馈和复盘数据驱动。')}</p></div>
      ${extraModules}
      <div><div class="small">本周动作</div><p><strong>${esc(d.weekly_action)}</strong></p></div>
      <div class="warning"><div class="small">风险提醒</div><p>${esc(d.risk_warning)}</p></div>
    </details>
  </div>`;
}

function hasFeedbackForPlan(planId){
  return clientState.feedback.some((f)=>Number(f.content_plan_id) === Number(planId) && f.publish_link);
}
function planUiMeta(plan, firstOpenId){
  const feedback = clientState.feedback.find((f)=>Number(f.content_plan_id) === Number(plan.id));
  if (feedback) return {label:`已回填 ${feedback.feedback_stage || 'T+24'}`, className:'plan-done', action:'查看/补充', tone:'green'};
  if (plan.publish_link || plan.status === '已发布') return {label:'待回填 T+72', className:'plan-next', action:'回填数据', tone:'orange'};
  if (Number(plan.id) === Number(firstOpenId)) return {label:'今日优先', className:'plan-next', action:'复制/回填', tone:'orange'};
  return {label:'待发布', className:'plan-pending', action:'发布后回填', tone:'default'};
}

function renderPlans(plans){
  const summaryEl = $('#plansSummary');
  const firstOpen = plans.find((p)=>!(p.status === '已发布' || p.publish_link || hasFeedbackForPlan(p.id)));
  const feedbackByPlan = (id) => clientState.feedback.find((f)=>Number(f.content_plan_id) === Number(id));
  if (summaryEl) {
    summaryEl.innerHTML = plans.slice(0, 3).map((p)=>{
      const meta = planUiMeta(p, firstOpen?.id);
      const f = feedbackByPlan(p.id);
      const stats = f ? `<div class="experiment-stats"><span>曝光 <b>${compactNumber(f.views)}</b></span><span>收藏 <b>${num(f.favorites)}</b></span><span>咨询 <b>${num(f.consultations)}</b></span></div>` : `<div class="experiment-stats"><span>日期 <b>${esc(p.planned_date || '待定')}</b></span></div>`;
      return `<article class="experiment-card ${meta.className}">
        <div><div class="experiment-title">#${p.id} ${esc(p.topic)}</div><div class="experiment-meta"><span class="war-tag">${esc(p.platform)}</span><span class="war-tag ${meta.tone === 'orange' ? 'orange' : meta.tone === 'green' ? 'green' : ''}">${esc(meta.label)}</span><span class="war-tag">${esc(p.target_metric || '待观察')}</span></div><details class="experiment-detail"><summary>查看角度</summary><p>${esc(p.angle || '')}</p></details></div>
        <div class="experiment-side">${stats}<button class="small-btn" type="button" onclick="prefillFeedback(${Number(p.id)})">${esc(meta.action)}</button></div>
      </article>`;
    }).join('') || '<div class="empty">暂无计划，先提交一次快速体检。</div>';
  }
  $('#plansBody').innerHTML = plans.map(p=>{
    const meta = planUiMeta(p, firstOpen?.id);
    return `<tr class="${meta.className}">
      <td><span class="small">#${p.id}</span><br>${esc(p.planned_date)}</td>
      <td>${esc(p.platform)}</td>
      <td><strong>${esc(p.topic)}</strong></td>
      <td>${esc(p.angle)}</td>
      <td>${esc(p.content_type || '')}</td>
      <td>${esc(p.cta || '')}<div class="small">${esc(p.publish_quality || '')}${p.quality_note ? '：' + esc(p.quality_note) : ''}</div></td>
      <td>${esc(p.target_metric)}${p.publish_link ? `<div class="small"><a href="${esc(p.publish_link)}" target="_blank">发布链接已回填</a></div>` : '<div class="small">发布后需回填链接</div>'}</td>
      <td><span class="status">${meta.label}</span></td>
      <td><button class="secondary" type="button" onclick="prefillFeedback(${Number(p.id)})">${meta.action}</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="9">暂无计划</td></tr>';
}

function renderFeedback(items){
  const sorted = (items || []).slice().sort((a,b)=>String(b.created_at || '').localeCompare(String(a.created_at || '')));
  $('#feedbackList').innerHTML = sorted.map(f=>`<div class="list-item feedback-record-card">
    <div class="feedback-record-head"><strong>计划 #${f.content_plan_id}</strong><span class="badge">${esc(f.feedback_stage || '未标注')}</span></div>
    <div class="feedback-record-metrics"><span>曝光｜查看 ${f.views}</span><span>互动｜点赞 ${f.likes}</span><span>互动｜评论 ${f.comments}</span><span>互动｜收藏/分享 ${Number(f.favorites || 0) + Number(f.shares || 0)}</span><span>转化｜私信/咨询 ${f.consultations}</span></div>
    ${f.publish_link ? `<div><a href="${esc(f.publish_link)}" target="_blank">查看发布链接</a></div>` : '<div class="warning">缺少发布链接：本条不算完整闭环</div>'}
    <div class="small">${esc(f.notes || '无备注')} · ${esc(f.created_at)}</div>
  </div>`).join('') || '<div class="empty">暂无记录。保存至少1条发布反馈后，系统会自动更新看板和周复盘。</div>';
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
  const details = document.querySelector('.client-snapshot-panel');
  if (details) details.open = true;
  const target = anchor ? document.getElementById(anchor) : details;
  window.setTimeout(() => (target || details)?.scrollIntoView({behavior:'smooth', block:'start'}), 40);
}
window.openClientEvidence = openClientEvidence;

function autoReviewFromFeedback(){
  if (!clientState.feedback.length) return null;
  return {...createLocalReview(), is_auto: true};
}

function renderReview(r){
  if(!r){ $('#reviewBox').innerHTML='暂无回填数据。保存至少1条发布链接和反馈后，这里会自动出现复盘。'; return; }
  $('#reviewBox').innerHTML = `<div class="review ${r.is_auto ? 'auto-review' : ''}">
    <div class="small">${r.is_auto ? '自动复盘 · ' : ''}${esc(r.week_start)} 至 ${esc(r.week_end)}</div>
    <p><strong>发布样本：</strong>${r.total_posts} 条 · <strong>曝光：</strong>${r.total_views} · <strong>互动：</strong>${r.total_interactions} · <strong>咨询：</strong>${r.total_consultations}</p>
    <p><strong>胜出主题：</strong>${esc(r.winner_topic || '暂无')}</p>
    <p><strong>当前瓶颈：</strong>${esc(r.bottleneck)}</p>
    <p class="big-action">${esc((r.next_actions || '').replace('加码「」同类角度', '加码「最高咨询内容」同类角度'))}</p>
  </div>`;
}

function prefillFeedback(id){
  const planId = Number(id);
  const form = $('#feedbackForm');
  const workflow = $('#feedbackWorkflow');
  const plan = clientState.plans.find((item) => Number(item.id) === Number(planId));
  const existingFeedback = latestFeedbackRows().find((item) => Number(item.content_plan_id) === Number(planId));
  const planInput = form?.querySelector('[name=content_plan_id]');
  const linkInput = form?.querySelector('[name=publish_link]');
  const stageInput = form?.querySelector('[name=feedback_stage]');
  const notesInput = form?.querySelector('[name=notes]');
  if (!form || !planInput) return;
  if (workflow) workflow.hidden = false;
  planInput.value = Number.isFinite(planId) ? String(planId) : String(id || '');
  if (linkInput) linkInput.value = existingFeedback?.publish_link || plan?.publish_link || '';
  if (stageInput && existingFeedback?.feedback_stage) stageInput.value = existingFeedback.feedback_stage;
  ['views','likes','comments','favorites','shares','consultations'].forEach((key) => {
    const input = form.querySelector(`[name=${key}]`);
    if (input && existingFeedback && existingFeedback[key] !== undefined) input.value = existingFeedback[key];
  });
  if (notesInput && existingFeedback?.notes) notesInput.value = existingFeedback.notes;
  planInput.dispatchEvent(new Event('input', {bubbles:true}));
  planInput.dispatchEvent(new Event('change', {bubbles:true}));
  workflow?.classList.remove('is-highlighted');
  void workflow?.offsetWidth;
  workflow?.classList.add('is-highlighted');
  (workflow || form).scrollIntoView({behavior:'smooth', block:'start'});
  window.setTimeout(()=>{
    linkInput?.focus();
    toast(`已选择计划 #${planInput.value}，请填写发布链接和数据。`);
  }, 260);
  window.setTimeout(()=>workflow?.classList.remove('is-highlighted'), 1900);
}
window.prefillFeedback = prefillFeedback;

function selectProblem(value){
  const input = $('#assessmentForm')?.querySelector('[name=biggest_problem]');
  if (!input) return;
  input.value = value;
  document.querySelectorAll('[data-problem-option]').forEach((button) => {
    const selected = button.dataset.problemOption === value;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}
window.selectProblem = selectProblem;

function clearProblemSelection(){
  const input = $('#assessmentForm')?.querySelector('[name=biggest_problem]');
  if (input) input.value = '';
  document.querySelectorAll('[data-problem-option]').forEach((button) => {
    button.classList.remove('is-selected');
    button.setAttribute('aria-pressed', 'false');
  });
}

document.querySelectorAll('[data-problem-option]').forEach((button) => {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => selectProblem(button.dataset.problemOption));
});

function createLocalReview(){
  const rows = latestFeedbackRows().map((feedback) => ({
    ...feedback,
    topic: clientState.plans.find((plan) => plan.id === Number(feedback.content_plan_id))?.topic || '',
  }));
  const total_posts = rows.length;
  const total_views = rows.reduce((sum, item) => sum + num(item.views), 0);
  const total_interactions = rows.reduce((sum, item) => sum + interactions(item), 0);
  const total_consultations = rows.reduce((sum, item) => sum + num(item.consultations), 0);
  const winner = rows.slice().sort((a, b) =>
    (num(b.consultations) - num(a.consultations)) ||
    ((num(b.favorites) + num(b.comments)) - (num(a.favorites) + num(a.comments))) ||
    (num(b.views) - num(a.views))
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
    next_actions = `加码「${winnerTopic}」同类角度，下周至少复制3条，并保留合规私信/主页咨询入口。`;
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

$('#assessmentForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  await withBusy(e.submitter, '生成中...', async () => {
    const payload = formData(e.target);
    if (!String(payload.biggest_problem || '').trim()) throw new Error('请选择当前最大问题，再生成内容建议。');
    if (payload.posting_frequency_detail) payload.posting_frequency = payload.posting_frequency_detail;
    delete payload.posting_frequency_detail;
    payload.benchmark = normalizeBenchmark(payload);
    ['benchmark_platform','benchmark_accounts','benchmark_account_1','benchmark_account_2','benchmark_account_3','benchmark_notes','benchmark_sample_content'].forEach((key)=>delete payload[key]);
    const result = await api('/api/assessments', {method:'POST', body: JSON.stringify(payload)});
    const assessment = result.assessment || payload;
    clientState = normalizeState({
      project: makeProject({...assessment, project_id: `project-${Date.now()}`}),
      project_stage: '待启动',
      current_cycle_id: 'cycle-1',
      assessment,
      diagnosis: result.diagnosis,
      plans: result.plans || [],
      feedback: [],
      review: null,
    });
    saveLocal();
    e.target.reset();
    clearProblemSelection();
    internalWorkbenchVisible = false;
    toast('内容增长建议已生成');
    renderAllFromClient();
    scrollToSection('#latestDiagnosis');
  });
});

$('#feedbackForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  await withBusy(e.submitter, '保存中...', async () => {
    const data = formData(e.target);
    if (!String(data.content_plan_id || '').trim()) throw new Error('请先选择或填写发布计划ID，再保存反馈。');
    ['content_plan_id','views','likes','comments','favorites','shares','consultations'].forEach(k=>data[k]=toNonNegative(data[k]));
    data.publish_link = String(data.publish_link || '').trim();
    if (!data.publish_link) throw new Error('首次/本条发布链接必填：请粘贴已发布内容链接后再保存反馈');
    const plan = clientState.plans.find((item) => Number(item.id) === Number(data.content_plan_id));
    if (!plan) throw new Error('发布计划ID不存在，请先生成计划');
    const feedback = {
      id: Date.now(),
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
    clientState.feedback = [feedback, ...clientState.feedback.filter((item) => !(Number(item.content_plan_id) === Number(data.content_plan_id) && String(item.feedback_stage || 'T+24') === String(feedback.feedback_stage)))];
    clientState.review = createLocalReview();
    isCreatingNewProject = false;
    saveLocal();
    renderAllFromClient();
    e.target.reset();
    toast('反馈已保存，看板和复盘已更新。');
    api('/api/feedback', {method:'POST', body: JSON.stringify(data)})
      .catch(() => toast('本地已保存；云端临时接口同步失败，不影响本浏览器查看'));
  });
});

$('#reviewBtn').addEventListener('click', async ()=>{
  await withBusy($('#reviewBtn'), '生成中...', async () => {
    clientState.review = createLocalReview();
    saveLocal();
    renderAllFromClient();
    toast('周复盘已更新');
    api('/api/reviews', {method:'POST', body: JSON.stringify({})})
      .catch(() => toast('本地复盘已保存；云端临时接口同步失败'));
  });
});
const refreshBtn = $('#refreshBtn');
if (refreshBtn) refreshBtn.addEventListener('click', () => {
  clearAllLocalData();
});
loadAll().catch(err=>toast(err.message));
