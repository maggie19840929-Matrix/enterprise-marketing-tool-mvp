import { createHash } from 'node:crypto';

export const MODEL_ROUTING_VERSION = 'routing-v1';
export const MODEL_QUALITY_VERSION = 'quality-v1';
export const MODEL_OBSERVABILITY_VERSION = 'model-observability-p0';

const allowedModes = new Set(['off', 'observe']);
const clean = (value = '') => String(value || '').trim();
const numberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const envFlag = (name, fallback = false) => {
  const value = clean(process.env[name]).toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
};
const stableId = (prefix, parts = []) => `${prefix}_${createHash('sha256')
  .update(parts.map((item) => clean(item)).join('|'))
  .digest('hex')
  .slice(0, 24)}`;

export const modelRoutingMode = () => {
  const mode = clean(process.env.MODEL_ROUTING_MODE || 'observe').toLowerCase();
  return allowedModes.has(mode) ? mode : 'observe';
};

export const modelRunLedgerEnabled = () => modelRoutingMode() !== 'off'
  && envFlag('MODEL_RUN_LEDGER_ENABLED', true);

export const modelCostTrackingEnabled = () => modelRunLedgerEnabled()
  && envFlag('MODEL_COST_TRACKING_ENABLED', true);

export const modelRoutingSampleRate = () => {
  const parsed = Number(process.env.MODEL_ROUTING_SAMPLE_RATE ?? 100);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 100;
};

export const shouldObserveModelTask = (taskId = '') => {
  if (!modelRunLedgerEnabled()) return false;
  const rate = modelRoutingSampleRate();
  if (rate >= 100) return true;
  if (rate <= 0) return false;
  const bucket = Number.parseInt(createHash('sha256').update(clean(taskId) || 'unknown').digest('hex').slice(0, 8), 16) % 10000;
  return bucket < Math.round(rate * 100);
};

const taskTypeFor = ({ route = '', purpose = '', generationType = '' } = {}) => {
  const value = `${route} ${purpose} ${generationType}`.toLowerCase();
  if (/benchmark/.test(value)) return 'benchmark';
  if (/customer-growth-advice|review|复盘/.test(value)) return 'review';
  if (/plan|assessment|diagnos/.test(value)) return 'plan';
  if (/cover|image|avatar|background/.test(value)) return 'image';
  if (/video|seedance/.test(value)) return 'video';
  if (/script/.test(value)) return 'script';
  if (/copy|kimi|text/.test(value)) return 'copy';
  if (/audit|check|qa/.test(value)) return 'audit';
  return 'other';
};

const taskLevelFor = (taskType = 'other') => {
  if (['image', 'video'].includes(taskType)) return { complexity: 'L3', risk: 'high' };
  if (['plan', 'review', 'benchmark', 'script', 'copy'].includes(taskType)) return { complexity: 'L2', risk: 'medium' };
  if (taskType === 'audit') return { complexity: 'L1', risk: 'medium' };
  return { complexity: 'L0', risk: 'low' };
};

const adapterFor = ({ provider = '', taskType = '' } = {}) => {
  const value = clean(provider).toLowerCase();
  if (value.includes('ark') || value.includes('volcengine')) return taskType === 'video' ? 'seedance-video' : 'ark-text';
  if (value.includes('seedance')) return 'seedance-video';
  if (value.includes('kimi')) return 'kimi-text';
  if (value.includes('openai-image')) return 'openai-image';
  if (value.includes('openai')) return 'openai-text';
  if (value.includes('claude') || value.includes('anthropic')) return 'claude-text';
  if (value.includes('glm')) return 'glm-text';
  if (value.includes('local') || !value) return 'local-rule';
  return value;
};

const reasonCodesFor = ({ taskType = '', fallback = false, fallbackReason = '' } = {}) => {
  const codes = [`observe_current_${taskType || 'other'}_route`];
  if (fallback) codes.push('provider_fallback_observed');
  if (fallbackReason) codes.push(`reason_${clean(fallbackReason).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, 80)}`);
  return [...new Set(codes)];
};

export const buildRouteDecision = ({
  clientId = '', projectId = '', taskId = '', route = '', purpose = '', generationType = '',
  requestedModel = '', provider = '', createdAt = new Date().toISOString(),
} = {}) => {
  const taskType = taskTypeFor({ route, purpose, generationType });
  const level = taskLevelFor(taskType);
  return {
    route_id: stableId('route', [MODEL_ROUTING_VERSION, clientId, taskId, route, purpose, generationType]),
    task_id: clean(taskId),
    client_id: clean(clientId),
    project_id: clean(projectId),
    task_type: taskType,
    complexity_level: level.complexity,
    risk_level: level.risk,
    route_policy_version: MODEL_ROUTING_VERSION,
    routing_mode: modelRoutingMode(),
    selected_adapter: adapterFor({ provider, taskType }),
    selected_model: clean(requestedModel) || 'rule_template',
    reason_codes: reasonCodesFor({ taskType }),
    budget_ceiling_cny: 0,
    created_at: createdAt,
  };
};

const usageFor = (usage = null) => {
  if (!usage || typeof usage !== 'object') return null;
  return {
    prompt_tokens: Number(usage.prompt_tokens || usage.input_tokens || 0),
    completion_tokens: Number(usage.completion_tokens || usage.output_tokens || 0),
    total_tokens: Number(usage.total_tokens || (Number(usage.prompt_tokens || usage.input_tokens || 0) + Number(usage.completion_tokens || usage.output_tokens || 0))),
  };
};

const tokenCost = ({ provider = '', usage = null } = {}) => {
  if (!modelCostTrackingEnabled() || !usage) return null;
  const prefix = clean(provider).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const inputPrice = numberOrNull(process.env[`${prefix}_INPUT_CNY_PER_MILLION_TOKENS`]);
  const outputPrice = numberOrNull(process.env[`${prefix}_OUTPUT_CNY_PER_MILLION_TOKENS`]);
  if (inputPrice === null && outputPrice === null) return null;
  return Number((((usage.prompt_tokens || 0) * (inputPrice || 0) + (usage.completion_tokens || 0) * (outputPrice || 0)) / 1_000_000).toFixed(6));
};

export const buildModelRuns = ({
  clientId = '', projectId = '', taskId = '', route = '', purpose = '', generationType = '',
  meta = {}, status = '', finishReason = '', createdAt = new Date().toISOString(),
} = {}) => {
  const taskType = taskTypeFor({ route, purpose, generationType });
  const usage = usageFor(meta.usage || meta.raw_usage || null);
  const rawAttemptCount = Number(meta.provider_attempt_count || 1);
  const attemptCount = Number.isFinite(rawAttemptCount) ? Math.max(1, Math.min(20, Math.floor(rawAttemptCount))) : 1;
  const fallbackReason = clean(meta.fallback_reason || meta.failure_reason || '') || null;
  const finalStatus = status || (fallbackReason?.includes('timeout') ? 'timeout' : (meta.fallback ? 'failed' : 'succeeded'));
  const estimatedCost = tokenCost({ provider: meta.provider, usage });
  return Array.from({ length: attemptCount }, (_, index) => {
    const attempt = index + 1;
    const finalAttempt = attempt === attemptCount;
    return {
      run_id: stableId('run', [clientId, taskId, route, purpose, meta.requested_model, attempt]),
      task_id: clean(taskId),
      client_id: clean(clientId),
      project_id: clean(projectId),
      task_type: taskType,
      route,
      purpose,
      attempt,
      provider_attempt_count: attemptCount,
      requested_model: meta.requested_model || null,
      actual_model: meta.actual_model || (meta.fallback ? 'rule_template' : meta.requested_model) || null,
      provider: meta.provider || 'local',
      fallback: finalAttempt ? Boolean(meta.fallback) : false,
      fallback_reason: finalAttempt ? fallbackReason : null,
      latency_ms: finalAttempt ? Number(meta.latency_ms || 0) : null,
      latency_is_aggregate: attemptCount > 1,
      usage: finalAttempt ? usage : null,
      usage_is_aggregate: attemptCount > 1,
      estimated_cost_cny: finalAttempt ? estimatedCost : null,
      finish_reason: finalAttempt ? (finishReason || null) : 'retried',
      status: finalAttempt ? finalStatus : 'retried',
      route_policy_version: MODEL_ROUTING_VERSION,
      created_at: createdAt,
    };
  });
};

export const buildQualityResult = ({
  clientId = '', projectId = '', taskId = '', runId = '', passed = null, scores = {},
  issueCodes = [], action = '', source = 'automatic', createdAt = new Date().toISOString(),
} = {}) => ({
  quality_id: stableId('quality', [clientId, taskId, runId, source, passed, action, (Array.isArray(issueCodes) ? issueCodes : []).join(','), createdAt]),
  task_id: clean(taskId),
  run_id: clean(runId),
  client_id: clean(clientId),
  project_id: clean(projectId),
  gate_version: MODEL_QUALITY_VERSION,
  passed: passed === null ? null : Boolean(passed),
  scores: scores && typeof scores === 'object' ? scores : {},
  issue_codes: [...new Set((Array.isArray(issueCodes) ? issueCodes : []).map(clean).filter(Boolean))],
  action: action || (passed === true ? 'deliver' : (passed === false ? 'manual_review' : 'observe')),
  source,
  created_at: createdAt,
});

export const summarizeModelObservability = ({ decisions = [], runs = [], qualityResults = [] } = {}) => {
  const latencies = runs.map((run) => Number(run.latency_ms)).filter((value) => Number.isFinite(value) && value >= 0);
  const costs = runs
    .filter((run) => run.estimated_cost_cny !== null && run.estimated_cost_cny !== undefined)
    .map((run) => Number(run.estimated_cost_cny))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const finalRuns = runs.filter((run) => run.status !== 'retried');
  const scoredQuality = qualityResults.filter((item) => typeof item.passed === 'boolean');
  return {
    routing_mode: modelRoutingMode(),
    decision_count: decisions.length,
    provider_attempt_count: runs.length,
    task_run_count: new Set(runs.map((run) => run.task_id).filter(Boolean)).size,
    fallback_count: finalRuns.filter((run) => run.fallback).length,
    fallback_rate: finalRuns.length ? Number((finalRuns.filter((run) => run.fallback).length / finalRuns.length).toFixed(4)) : 0,
    average_latency_ms: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
    estimated_cost_cny: costs.length ? Number(costs.reduce((sum, value) => sum + value, 0).toFixed(6)) : null,
    quality_checked_count: scoredQuality.length,
    quality_pass_rate: scoredQuality.length ? Number((scoredQuality.filter((item) => item.passed).length / scoredQuality.length).toFixed(4)) : null,
  };
};
