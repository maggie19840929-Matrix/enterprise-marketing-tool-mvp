const text = (value = '') => String(value ?? '').trim();
const list = (value) => Array.isArray(value) ? value : [];
const unique = (values = []) => [...new Set(values.map(text).filter(Boolean))];

export const BENCHMARK_PLATFORMS = ['小红书', '抖音', '视频号', '其他'];
export const BENCHMARK_FIT_STATUSES = ['high', 'medium', 'low'];
export const BENCHMARK_REVIEW_STATUSES = ['review_required', 'approved', 'rejected'];

const INDUSTRY_RULES = {
  martial_arts: {
    match: /武术|搏击|散打|跆拳道|拳击|格斗/i,
    allowed: ['武术', '搏击', '散打', '防护', '规则感', '体验课', '教练', '孩子', '家长'],
    forbidden: ['篮球课', '篮球训练', '运球', '投篮', '篮筐'],
  },
  basketball: {
    match: /篮球|运球|投篮|篮筐/i,
    allowed: ['篮球', '孩子', '家长', '体能', '运球', '投篮', '体验课', '教练'],
    forbidden: ['武术', '散打', '搏击', '护具对抗训练'],
  },
  beauty_nail: {
    match: /美甲|美睫|美容院|美容门店|医美/i,
    allowed: ['款式', '通勤', '到店', '甲型', '持久度', '预约', '附近客户'],
    forbidden: ['儿童课程', '课程报名', '医生诊疗', '工业采购', '机械设备'],
  },
  dental: {
    match: /口腔|牙科|牙齿|正畸|种植牙/i,
    allowed: ['检查', '正畸', '种植', '医生', '价格', '信任', '口腔', '儿童矫正'],
    forbidden: ['美甲', '课程报名', '工业设备', '机械采购'],
  },
  general: {
    match: /.*/,
    allowed: [],
    forbidden: [],
  },
};

export const benchmarkIndustryType = (value = '') => {
  const source = text(value);
  return Object.entries(INDUSTRY_RULES).find(([key, rule]) => key !== 'general' && rule.match.test(source))?.[0] || 'general';
};

export const benchmarkIndustryGuard = ({ projectText = '', sourceText = '', outputText = '' } = {}) => {
  const expected = benchmarkIndustryType(projectText);
  const sourceType = benchmarkIndustryType(sourceText);
  const rule = INDUSTRY_RULES[expected] || INDUSTRY_RULES.general;
  const combined = `${sourceText}\n${outputText}`;
  const forbidden = unique(rule.forbidden.filter((term) => combined.includes(term)));
  const sourceMismatch = expected !== 'general' && sourceType !== 'general' && sourceType !== expected;
  return {
    expected_business_type: expected,
    source_business_type: sourceType,
    forbidden_terms_found: forbidden,
    passed: !sourceMismatch && forbidden.length === 0,
    source_mismatch: sourceMismatch,
  };
};

const nullableMetric = (value) => {
  if (value === null || value === undefined || text(value) === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export const normalizeVisibleMetrics = (metrics = {}) => ({
  views: nullableMetric(metrics.views),
  likes: nullableMetric(metrics.likes),
  favorites: nullableMetric(metrics.favorites),
  comments: nullableMetric(metrics.comments),
  shares: nullableMetric(metrics.shares),
});

const hasVisibleMetric = (metrics = {}) => Object.values(normalizeVisibleMetrics(metrics)).some((value) => value !== null);

export const normalizeBenchmarkProfileInput = (payload = {}, existing = {}) => {
  const platform = text(payload.platform ?? existing.platform) || '小红书';
  if (!BENCHMARK_PLATFORMS.includes(platform)) throw new Error('请选择有效的对标平台');
  const accountName = text(payload.account_name ?? existing.account_name);
  const accountUrl = text(payload.account_url ?? existing.account_url);
  if (!accountName && !accountUrl) throw new Error('请填写对标账号名称或主页链接');
  return {
    ...existing,
    platform,
    account_name: accountName,
    account_url: accountUrl,
    reference_reason: unique(Array.isArray(payload.reference_reason)
      ? payload.reference_reason
      : text(payload.reference_reason ?? existing.reference_reason).split(/[，,、\n]+/)),
    operator_notes: text(payload.operator_notes ?? existing.operator_notes),
    source_mode: ['customer_supplied', 'operator_curated'].includes(payload.source_mode)
      ? payload.source_mode
      : (existing.source_mode || 'operator_curated'),
    privacy_scope: 'project_private',
    observed_at: text(payload.observed_at ?? existing.observed_at),
    status: payload.status === 'archived' ? 'archived' : 'active',
  };
};

export const normalizeBenchmarkContentInput = (payload = {}, existing = {}) => {
  const title = text(payload.title ?? existing.title);
  const contentUrl = text(payload.content_url ?? existing.content_url);
  const summary = text(payload.content_summary ?? existing.content_summary);
  const screenshotAssetId = text(payload.screenshot_asset_id ?? existing.screenshot_asset_id);
  if (contentUrl && !title && !summary && !screenshotAssetId) {
    throw new Error('链接暂不能自动读取，请补充标题、截图或内容摘要');
  }
  if (!title) throw new Error('请填写代表内容标题');
  if (Array.from(title).length < 6 && !summary) throw new Error('标题较短，请补充内容摘要');
  const visibleMetrics = normalizeVisibleMetrics(payload.visible_metrics ?? existing.visible_metrics ?? {});
  const hasEvidence = Boolean(contentUrl || screenshotAssetId || hasVisibleMetric(visibleMetrics));
  const requestedConfidence = ['C', 'D', 'E'].includes(payload.confidence) ? payload.confidence : (existing.confidence || 'E');
  return {
    ...existing,
    title,
    content_url: contentUrl,
    content_summary: summary,
    content_format: text(payload.content_format ?? existing.content_format) || '图文',
    published_at: text(payload.published_at ?? existing.published_at) || null,
    visible_metrics: visibleMetrics,
    screenshot_asset_id: screenshotAssetId || null,
    operator_observation: text(payload.operator_observation ?? existing.operator_observation),
    source_mode: ['customer_supplied', 'operator_curated'].includes(payload.source_mode)
      ? payload.source_mode
      : (existing.source_mode || 'operator_curated'),
    confidence: requestedConfidence === 'C' && !hasEvidence ? 'E' : requestedConfidence,
    privacy_scope: 'project_private',
    observed_at: text(payload.observed_at ?? existing.observed_at),
    status: payload.status === 'archived' ? 'archived' : 'ready',
  };
};

const sourceRowsForPrompt = (contents = []) => contents.map((item) => ({
  benchmark_content_id: item.benchmark_content_id,
  platform: item.platform,
  title: item.title,
  content_summary: item.content_summary,
  content_format: item.content_format,
  visible_metrics: item.visible_metrics,
  operator_observation: item.operator_observation,
  confidence: item.confidence,
  observed_at: item.observed_at,
}));

export const buildBenchmarkInsightPrompt = ({ projectSnapshot = {}, profiles = [], contents = [] } = {}) => ({
  system: [
    '你是企业内容增长研究员。你只能根据输入的对标内容证据提炼市场信号，不能把模型常识冒充市场验证。',
    '不得照抄原始标题、脚本、案例或素材。每条结论必须引用真实 source_content_ids，并说明如何适配当前项目。',
    '证据不足时明确写待验证。发现行业不匹配时 fit_status 必须为 low，transferable_directions 必须为空。',
    '输出严格 JSON，不要 Markdown。',
  ].join('\n'),
  user: JSON.stringify({
    task: '分析对标内容并生成可审核的市场洞察',
    project_snapshot: projectSnapshot,
    benchmark_profiles: profiles.map((item) => ({
      benchmark_profile_id: item.benchmark_profile_id,
      platform: item.platform,
      account_name: item.account_name,
      reference_reason: item.reference_reason,
      operator_notes: item.operator_notes,
      observed_at: item.observed_at,
    })),
    evidence_contents: sourceRowsForPrompt(contents),
    required_schema: {
      fit_summary: 'string',
      fit_status: 'high|medium|low',
      market_signals: [{ statement: 'string', source_content_ids: ['id'], confidence: 'C|D|E', adaptation_reason: 'string' }],
      proven_pains: [{ statement: 'string', source_content_ids: ['id'], confidence: 'C|D|E', adaptation_reason: 'string' }],
      title_patterns: [{ statement: 'string', source_content_ids: ['id'], confidence: 'C|D|E', adaptation_reason: 'string' }],
      content_formats: [{ statement: 'string', source_content_ids: ['id'], confidence: 'C|D|E', adaptation_reason: 'string' }],
      trust_evidence_patterns: [{ statement: 'string', source_content_ids: ['id'], confidence: 'C|D|E', adaptation_reason: 'string' }],
      conversion_paths: [{ statement: 'string', source_content_ids: ['id'], confidence: 'C|D|E', adaptation_reason: 'string' }],
      transferable_directions: [{ statement: 'string', source_content_ids: ['id'], confidence: 'C|D|E', adaptation_reason: 'string' }],
      avoid_copying: [{ statement: 'string', source_content_ids: ['id'], confidence: 'C|D|E', adaptation_reason: 'string' }],
      platform_risks: [{ statement: 'string', source_content_ids: ['id'], confidence: 'C|D|E', adaptation_reason: 'string' }],
    },
  }, null, 2),
});

export const parseBenchmarkModelJson = (content = '') => {
  const raw = text(content);
  if (!raw) throw new Error('benchmark_model_empty');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || raw;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('benchmark_invalid_json');
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    throw new Error('benchmark_invalid_json');
  }
};

const normalizedSignal = (item = {}, validIds = new Set(), fallbackObservedAt = '') => {
  const sourceIds = unique(item.source_content_ids);
  if (!sourceIds.length || sourceIds.some((id) => !validIds.has(id))) throw new Error('benchmark_unknown_source_content_id');
  const statement = text(item.statement);
  const adaptationReason = text(item.adaptation_reason);
  if (!statement || !adaptationReason) throw new Error('benchmark_signal_incomplete');
  return {
    statement,
    source_content_ids: sourceIds,
    confidence: ['C', 'D', 'E'].includes(item.confidence) ? item.confidence : 'E',
    observed_at: text(item.observed_at) || fallbackObservedAt,
    adaptation_reason: adaptationReason,
  };
};

const normalizedSignals = (value, validIds, observedAt, { required = false } = {}) => {
  const items = list(value).map((item) => normalizedSignal(item, validIds, observedAt));
  if (required && !items.length) throw new Error('benchmark_required_signals_missing');
  return items.slice(0, 12);
};

const normalizedComparable = (value = '') => text(value).toLowerCase().replace(/[\s，。！？、,.!?;；:“”"'（）()《》【】\[\]-]+/g, '');

export const normalizeBenchmarkInsightOutput = ({ modelOutput = {}, projectSnapshot = {}, contents = [] } = {}) => {
  const contentIds = new Set(contents.map((item) => text(item.benchmark_content_id)).filter(Boolean));
  if (!contentIds.size) throw new Error('benchmark_sources_missing');
  const observedAt = contents.map((item) => text(item.observed_at)).filter(Boolean).sort().at(-1) || new Date().toISOString();
  const result = {
    fit_summary: text(modelOutput.fit_summary),
    fit_status: BENCHMARK_FIT_STATUSES.includes(modelOutput.fit_status) ? modelOutput.fit_status : 'medium',
    market_signals: normalizedSignals(modelOutput.market_signals, contentIds, observedAt, { required: true }),
    proven_pains: normalizedSignals(modelOutput.proven_pains, contentIds, observedAt),
    title_patterns: normalizedSignals(modelOutput.title_patterns, contentIds, observedAt),
    content_formats: normalizedSignals(modelOutput.content_formats, contentIds, observedAt),
    trust_evidence_patterns: normalizedSignals(modelOutput.trust_evidence_patterns, contentIds, observedAt),
    conversion_paths: normalizedSignals(modelOutput.conversion_paths, contentIds, observedAt),
    transferable_directions: normalizedSignals(modelOutput.transferable_directions, contentIds, observedAt, { required: true }),
    avoid_copying: normalizedSignals(modelOutput.avoid_copying, contentIds, observedAt),
    platform_risks: normalizedSignals(modelOutput.platform_risks, contentIds, observedAt),
  };
  const sourceText = contents.map((item) => `${item.title} ${item.content_summary} ${item.operator_observation}`).join('\n');
  const outputText = JSON.stringify(result);
  const guard = benchmarkIndustryGuard({
    projectText: JSON.stringify(projectSnapshot),
    sourceText,
    outputText,
  });
  const sourceTitles = new Set(contents.map((item) => normalizedComparable(item.title)).filter(Boolean));
  const copiedStatements = [
    ...result.market_signals,
    ...result.title_patterns,
    ...result.transferable_directions,
  ].filter((item) => sourceTitles.has(normalizedComparable(item.statement))).map((item) => item.statement);
  if (!guard.passed) {
    result.fit_status = 'low';
    result.fit_summary = '参考对象与当前项目不匹配，需要补充同一行业的对标来源。';
    result.transferable_directions = [];
  }
  return {
    ...result,
    industry_guard: guard,
    validation_warnings: copiedStatements.length ? ['发现与来源标题高度相似的表达，审核时不得直接使用。'] : [],
    copied_statements: copiedStatements,
  };
};

export const benchmarkInsightPlanCalibration = (insight = {}) => {
  const directions = list(insight.transferable_directions).map((item) => text(item.statement)).filter(Boolean).slice(0, 5);
  const pains = list(insight.proven_pains).map((item) => text(item.statement)).filter(Boolean).slice(0, 4);
  const patterns = list(insight.title_patterns).map((item) => text(item.statement)).filter(Boolean).slice(0, 4);
  return {
    platform: '',
    accounts: [],
    notes: `已审核市场信号：${[...directions, ...pains].join('；')}`,
    sample_content: `只迁移表达结构，不照抄来源。可参考结构：${patterns.join('；') || '客户问题 + 信任证据 + 明确行动'}`,
  };
};
