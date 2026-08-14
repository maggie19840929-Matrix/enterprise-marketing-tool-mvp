import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

['ARK_API_KEY', 'VOLCENGINE_ARK_API_KEY', 'ARK_MODEL', 'ARK_PLAN_MODEL', 'DOUBAO_MODEL', 'VOLCENGINE_ARK_MODEL', 'CUSTOMER_PUBLIC_MODEL', 'CUSTOMER_PUBLIC_PLAN_TIMEOUT_MS', 'SAFE_TO_RUN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GLM_API_KEY', 'KIMI_API_KEY', 'MOONSHOT_API_KEY', 'KIMI_MODEL', 'KIMI_BASE_URL', 'KIMI_TIMEOUT_MS', 'KIMI_BG_TIMEOUT_MS', 'KIMI_MAX_RETRIES', 'KIMI_MAX_TOKENS', 'KIMI_CONTINUATION_MAX_TOKENS', 'KIMI_COMPLETENESS_REPAIR_ROUNDS', 'KIMI_REGENERATION_MAX_TOKENS', 'BACKGROUND_GENERATION_TOKEN', 'BACKGROUND_GENERATION_LOCK_MS', 'INTERNAL_ACCESS_TOKEN', 'METERING_HASH_SECRET', 'RATE_LIMIT_ENFORCE', 'GENERATION_RATE_WINDOW_SECONDS', 'GENERATION_RATE_CLIENT_MAX', 'GENERATION_RATE_IP_MAX', 'GENERATION_DAILY_CLIENT_MAX', 'TRACKING_ENABLED', 'CUSTOMER_LEGACY_CLAIM_UNTIL', 'ACCOUNT_AUTH_ENABLED', 'ACCOUNT_AUTH_SECRET', 'ACCOUNT_EMAIL_RESEND_SECONDS', 'ACCOUNT_EMAIL_DAILY_IP_MAX', 'AUTH_TEST_MODE', 'EMAIL_PROVIDER', 'EMAIL_FROM', 'RESEND_API_KEY', 'PAYMENT_P1_INTERNAL_ENABLED', 'PAYMENT_P1_SANDBOX_ENABLED', 'PAYMENT_P1_SANDBOX_TOKEN', 'WECHATPAY_MCHID', 'WECHATPAY_APPID', 'WECHATPAY_API_V3_KEY', 'ALIPAY_APP_ID', 'ALIPAY_APP_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY', 'FEISHU_INBOUND_TOKEN', 'FEISHU_WEBHOOK_URL', 'FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_BASE_TOKEN', 'FEISHU_WIKI_NODE_TOKEN', 'FEISHU_TABLE_EFFECT', 'FEISHU_TABLE_CHECKIN', 'FEISHU_TABLE_REPUTATION', 'FEISHU_TABLE_PLAN', 'FEISHU_WORKSPACE_URL', 'FEISHU_BOT_WEBHOOK', 'FEISHU_PULL_TIMEOUT_MS', 'FEISHU_PULL_PAGE_SIZE', 'FEISHU_PULL_MAX_RECORDS', 'FEISHU_PULL_DEADLINE_MS'].forEach((key) => {
  delete process.env[key];
});
['COMMERCIALIZATION_ENABLED', 'FREE_TRIAL_STRATEGY_CYCLES', 'FREE_TRIAL_VALID_DAYS', 'FREE_MONTHLY_STRATEGY_CYCLES', 'PLUS_MONTHLY_STRATEGY_CYCLES', 'PRO_MONTHLY_STRATEGY_CYCLES', 'FREE_MONTHLY_COMPLETE_CONTENT', 'PLUS_MONTHLY_COMPLETE_CONTENT', 'PRO_MONTHLY_COMPLETE_CONTENT', 'PRO_PUBLIC_SALES_ENABLED', 'FREE_DAILY_GENERATIONS', 'PLUS_DAILY_GENERATIONS', 'PRO_DAILY_GENERATIONS', 'FREE_ACTIVE_PROJECTS', 'PLUS_ACTIVE_PROJECTS', 'PRO_ACTIVE_PROJECTS', 'PLUS_MONTHLY_PRICE_CNY', 'PRO_MONTHLY_PRICE_CNY', 'PLUS_YEARLY_PRICE_CNY', 'PRO_YEARLY_PRICE_CNY', 'BILLING_ORDER_TTL_HOURS', 'BILLING_CONTACT_EMAIL'].forEach((key) => {
  delete process.env[key];
});
const INTERNAL_ACCESS_TOKEN = 'smoke-internal-token-1.6.122';
const BACKGROUND_GENERATION_TOKEN = 'smoke-background-token-1.6.122';
const FEISHU_INBOUND_TOKEN = 'smoke-feishu-inbound-token-1.6.122';
process.env.INTERNAL_ACCESS_TOKEN = INTERNAL_ACCESS_TOKEN;
process.env.BACKGROUND_GENERATION_TOKEN = BACKGROUND_GENERATION_TOKEN;
process.env.METERING_HASH_SECRET = 'smoke-metering-secret-v1.6.122-not-production';
process.env.RATE_LIMIT_ENFORCE = 'false';
process.env.GENERATION_RATE_WINDOW_SECONDS = '60';
process.env.GENERATION_RATE_CLIENT_MAX = '100';
process.env.GENERATION_RATE_IP_MAX = '100';
process.env.GENERATION_DAILY_CLIENT_MAX = '100';
process.env.TRACKING_ENABLED = 'true';
process.env.CUSTOMER_LEGACY_CLAIM_UNTIL = '2099-12-31T23:59:59.999Z';
process.env.ACCOUNT_AUTH_ENABLED = 'true';
process.env.ACCOUNT_AUTH_SECRET = 'smoke-account-auth-secret-v1-at-least-32-bytes';
process.env.AUTH_TEST_MODE = 'true';
process.env.EMAIL_PROVIDER = 'mock';
process.env.PAYMENT_P1_INTERNAL_ENABLED = 'true';
process.env.PAYMENT_P1_SANDBOX_ENABLED = 'true';
process.env.PAYMENT_P1_SANDBOX_TOKEN = 'smoke-payment-sandbox-token-v1-at-least-16';
process.env.NODE_ENV = 'test';
const { default: handler, shanghaiDateIso, timestampToEpoch, extractBitableFieldValue, toBitableFieldValue, buildFeishuPlanFields } = await import('../netlify/functions/api.mjs');
const { default: backgroundGenerationHandler } = await import('../netlify/functions/generate-background.mjs');
const { default: scheduledFeishuPull, config: scheduledFeishuConfig } = await import('../netlify/functions/feishu-pull-scheduled.mjs');
const { benchmarkIndustryGuard, normalizeBenchmarkInsightOutput } = await import('../netlify/functions/benchmark-insights.mjs');

const stateClientIdForRequest = (path = '', body = {}) => {
  const url = new URL(String(path || ''), 'http://localhost');
  return String(body?.client_id || body?.customer_key || url.searchParams.get('client_id') || url.searchParams.get('customer') || 'anonymous');
};
const customerAccessTokenFor = (clientId = '') => `smoke-customer-access-${stateClientIdForRequest('', { client_id: clientId })}`;
const request = (method, path, body, options = {}) => {
  const normalizedPath = String(path || '').replace(/^\/+/, '').split('?')[0];
  const providedHeaders = options.headers || {};
  const requiresCustomerAccess = normalizedPath === 'state'
    || normalizedPath === 'customer-shares'
    || normalizedPath === 'user/settings'
    || normalizedPath === 'feedback'
    || normalizedPath === 'customer-growth-advice'
    || normalizedPath === 'track'
    || normalizedPath === 'customer-brand-images'
    || normalizedPath.startsWith('customer-brand-images/')
    || normalizedPath === 'plan-jobs'
    || normalizedPath.startsWith('plan-jobs/');
  const hasExplicitCustomerAccess = Object.prototype.hasOwnProperty.call(providedHeaders, 'x-customer-access-token');
  const customerAccessHeaders = requiresCustomerAccess && options.customerAccess !== false && !hasExplicitCustomerAccess
    ? { 'x-customer-access-token': customerAccessTokenFor(stateClientIdForRequest(path, body)) }
    : {};
  return new Request(`http://localhost/.netlify/functions/api/${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...customerAccessHeaders, ...providedHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
};
const internalRequest = (method, path, body) => request(method, path, body, {
  headers: { 'x-internal-token': INTERNAL_ACCESS_TOKEN },
});

const payload = {
  company_name: '企业内容增长验证号',
  industry: '企业内容增长 / 企业获客 / AI营销复盘',
  main_goal: '30天内验证一套企业内容获客 + 数据回流 + AI复盘的最小闭环',
  target_customer: '老板、本地生活服务商家、中小企业负责人、不懂内容运营但需要线上获客的人、已经发内容但不知道怎么复盘的人。',
  offer: '账号定位建议、平台发布建议、7天内容计划、发布后数据记录、周复盘结论',
  customer_pain: '不知道该发什么；发了不知道有没有用；只看点赞不看咨询；没有每周复盘；AI生成内容很快但不一定带来客户。',
  current_channels: '小红书、视频号、朋友圈，后续视数据扩展到抖音。',
  posting_frequency: '每周3条',
  biggest_problem: '不知道发什么',
  content_assets: '企业真实服务案例、老板经验、客户常见问题、行业痛点、内容发布后的数据、咨询/咨询记录、竞品爆款内容。',
  monthly_budget: '低预算，优先靠老板认知内容、案例内容和AI辅助复盘，不做大额投流。',
  decision_cycle: '7天看内容反馈，14天看栏目方向，30天判断是否形成可复用增长闭环。',
  best_recent_content: '方法论类内容、老板真实误区拆解、AI营销复盘案例、企业账号为什么发了没咨询。',
  benchmark: {
    platform: '小红书',
    accounts: ['https://example.com/content-growth-benchmark'],
    notes: '对标账号多用真实问题、避坑清单、复盘表方法论，收藏和咨询反馈较高。',
    sample_content: '代表内容：发了很多内容为什么还是没人咨询？数据摘要：收藏高于点赞，咨询集中问复盘表。',
  },
  contact: ' / 企业营销工具验证',
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertNoUnsafeCommentCta = (label, value) => {
  const text = JSON.stringify(value);
  ['评论区告诉我', '留言关键词', '留言“复盘”', '评论/咨询“方案”', '可以留言你的情况'].forEach((word) => {
    assert(!text.includes(word), `${label} must not include unsafe comment CTA: ${word}`);
  });
};

const assertNoWrongDefaultScenario = (label, value) => {
  const text = JSON.stringify(value);
  ['工厂', '机械制造', 'B2B生产企业', '工业品', '外贸工厂', '采购负责人'].forEach((word) => {
    assert(!text.includes(word), `${label} must not include wrong default scenario: ${word}`);
  });
};

const assertCustomerFacingPlans = (label, value) => {
  const text = JSON.stringify(value.plans.map((plan) => [plan.topic, plan.angle, plan.cta, plan.qa_note]));
  ['发了内容但没咨询', '内容曝光不足', '发完内容不会复盘', 'AI文案没有转化', '老板做内容', '企业主发内容', '获客断点', '内容运营问题'].forEach((word) => {
    assert(!text.includes(word), `${label} should not leak our/operator perspective into customer-facing plans: ${word}`);
  });
};

const testCtaActionKey = (value = '') => {
  const text = String(value || '');
  const actions = [
    ['保存', /保存|收藏|存下|存起来/], ['主页', /主页/], ['预约', /预约/], ['到店', /到店/],
    ['截图', /截图/], ['了解', /了解|查看/], ['对照', /对照|核对/], ['咨询', /咨询|问问|问款/],
  ];
  return actions.find(([, pattern]) => pattern.test(text))?.[0] || text.slice(0, 2);
};

const assertPlanCtaQuality = (label, value) => {
  const ctas = (value.plans || []).map((plan) => String(plan.cta || ''));
  assert(ctas.length === 7, `${label} should return seven CTAs`);
  ctas.forEach((cta) => {
    assert(Array.from(cta).length <= 14, `${label} CTA must stay within 14 characters: ${cta}`);
    assert(!/(咨询咨询|预约预约|到店到店|了解了解|咨询问|咨询获取|点击咨询|引导客户|引导家长)/.test(cta), `${label} CTA should be grammatical and deduplicated: ${cta}`);
    assert(!/(?:或者|或是|以及|并且)$/.test(cta), `${label} CTA should not end as a broken clause: ${cta}`);
    assert(!/私信|评论区|留言|关键词|暗号|扣\d|回复/.test(cta), `${label} CTA should not use risky interaction inducement: ${cta}`);
    assert(!/^(?:如果|假如|要是|不确定|拿不准|想知道|想了解|想看|还有)|第一次.+后$/.test(cta), `${label} CTA should not be an unfinished thought: ${cta}`);
    assert(/保存|收藏|存下|存起来|主页|咨询|预约|到店|截图|了解|查看|对照|核对|转发|问我|问问|体验|确认/.test(cta), `${label} CTA should contain a clear customer action: ${cta}`);
  });
  assert(new Set(ctas.map(testCtaActionKey)).size >= 5, `${label} should use at least five distinct CTA actions: ${ctas.join(' / ')}`);
  assertNoUnsafeCommentCta(label, value.plans);
};

const assertRetailAccessoryPlans = (label, value) => {
  const text = JSON.stringify(value.plans.map((plan) => [plan.topic, plan.angle, plan.cta, plan.qa_note, plan.platform]));
  ['相关服务', '服务前', '服务流程', '到店前', '预约服务', '到店服务', '真实案例/过程内容'].forEach((word) => {
    assert(!text.includes(word), `${label} must not fall back to service template word: ${word}`);
  });
  const topicHits = (text.match(/饰品|首饰|耳饰|耳环|项链|手链|戒指|发夹|配饰|款式|穿搭|佩戴|上新|礼物|材质|下单|订单/g) || []).length;
  assert(topicHits >= 10, `${label} should strongly stay on accessory/product topic, got ${topicHits} topic hits`);
  assert(value.diagnosis.platform_recommendations.primary.some((x) => x.platform === '小红书'), `${label} should prioritize 小红书 for product seeding`);
  assert(!value.diagnosis.platform_recommendations.primary.some((x) => x.platform.includes('美团')), `${label} should not prioritize 美团 as product retail primary platform`);
};

const submitAssessment = async (body, { internal = true } = {}) => {
  const res = await handler((internal ? internalRequest : request)('POST', 'assessments', body));
  if (res.status !== 201) throw new Error(`expected 201, got ${res.status}: ${await res.text()}`);
  return res.json();
};

const submitAssessmentForClient = async (client_id, overrides = {}) => submitAssessment({
  ...payload,
  client_id,
  customer_key: client_id,
  company_name: overrides.company_name || `${client_id}客户`,
  industry: overrides.industry || payload.industry,
  main_goal: overrides.main_goal || payload.main_goal,
  target_customer: overrides.target_customer || payload.target_customer,
  offer: overrides.offer || payload.offer,
  customer_pain: overrides.customer_pain || payload.customer_pain,
  content_assets: overrides.content_assets || payload.content_assets,
  current_channels: overrides.current_channels || payload.current_channels,
  biggest_problem: overrides.biggest_problem || payload.biggest_problem,
  co_creation: overrides.co_creation,
});

const data = await submitAssessment(payload);
const { assessment, diagnosis, plans } = data;

assert(assessment.company_name === payload.company_name, 'POST /assessments should return the full assessment customer data');
assert(assessment.target_customer === payload.target_customer, 'assessment response should preserve target_customer for customer snapshot UI');
assert(diagnosis.strategy_score >= 80, `strategy_score should reflect clear inputs, got ${diagnosis.strategy_score}`);
assert(diagnosis.app_version === '1.6.157', `public diagnosis should return app_version 1.6.157, got ${diagnosis.app_version}`);
assert(assessment.benchmark.platform === '小红书', 'assessment should preserve benchmark platform');
assert(diagnosis.benchmark_reference.recent_topics.length >= 2, 'diagnosis should include benchmark reference topics');
assert(JSON.stringify(diagnosis.benchmark_reference).includes('不照抄'), 'benchmark reference should warn against copying');
assert(diagnosis.loop_score < 30, `loop_score must stay low before feedback, got ${diagnosis.loop_score}`);
assert(diagnosis.account_setup.account_name === '获客罗盘', 'meta-marketing test account should use the current public product name in cold-start setup');
assert(diagnosis.account_setup.starting_platform.platform === '小红书', 'cold-start setup should expose starting platform');
assert(diagnosis.account_setup.naming_warning.includes('保持专业和尊重'), 'cold-start setup should include naming warning');
assert(diagnosis.account_setup.background_direction && diagnosis.account_setup.pinned_note_directions.length === 3 && diagnosis.account_setup.pinning_rule.includes('已经发布的笔记'), 'Xiaohongshu account setup should include avatar-adjacent background guidance and the real published-note pinning rule');
const douyinAccountSetupData = await submitAssessment({
  ...payload,
  client_id: 'douyin-account-setup-smoke',
  customer_key: 'douyin-account-setup-smoke',
  company_name: '青禾美甲',
  industry: '本地美容美甲门店',
  main_goal: '通过短视频获得附近客户预约',
  target_customer: '附近三公里25至35岁爱美女性',
  offer: '通勤款和节日款美甲套餐',
  customer_pain: '有播放但没有到店咨询',
  current_channels: '抖音',
  biggest_problem: '有浏览没咨询',
  benchmark: {},
});
const douyinAccountSetup = douyinAccountSetupData.diagnosis.account_setup;
assert(douyinAccountSetup.starting_platform.platform === '抖音' && douyinAccountSetup.platform_profile === 'douyin', 'an explicitly selected Douyin account should receive the Douyin cold-start profile even when another platform is also recommended');
assert(douyinAccountSetup.pinned_content_label === '建议置顶的视频' && douyinAccountSetup.background_direction.includes('抖音主页背景'), 'Douyin cold-start setup should use video pinning and Douyin-specific background guidance');
assert(douyinAccountSetup.homepage_focus.includes('几秒内看懂业务') && douyinAccountSetup.bio_lines.join('').includes('真实过程'), 'Douyin cold-start setup should optimize fast profile comprehension and short-video trust evidence');

const channelsAccountSetupData = await submitAssessment({
  ...payload,
  client_id: 'channels-account-setup-smoke',
  customer_key: 'channels-account-setup-smoke',
  company_name: '启航少儿素质教育',
  industry: '少儿素质教育培训机构',
  main_goal: '获得家长咨询和试听预约',
  target_customer: '附近有6至12岁孩子的家长',
  offer: '周末素质教育体验课',
  customer_pain: '家长不了解课程是否适合孩子',
  current_channels: '视频号',
  biggest_problem: '不知道发什么',
  benchmark: {},
});
const channelsAccountSetup = channelsAccountSetupData.diagnosis.account_setup;
assert(channelsAccountSetup.starting_platform.platform === '视频号' && channelsAccountSetup.platform_profile === 'wechat_channels', 'an explicitly selected Channels account should receive the Channels cold-start profile instead of the first generic recommendation');
assert(channelsAccountSetup.pinned_content_label === '主页优先展示的视频' && channelsAccountSetup.background_direction.includes('视频号主页背景'), 'Channels cold-start setup should use trust-first homepage content and platform-specific background guidance');
assert(channelsAccountSetup.homepage_focus.includes('微信好友') && channelsAccountSetup.bio_lines.join('').includes('微信内'), 'Channels cold-start setup should account for WeChat trust and social forwarding context');
assert(JSON.stringify(douyinAccountSetup) !== JSON.stringify(channelsAccountSetup), 'Douyin and Channels account setup must not share one generic configuration');
const multiPlatformAccountSetupData = await submitAssessment({
  ...payload,
  client_id: 'multi-platform-account-setup-smoke',
  customer_key: 'multi-platform-account-setup-smoke',
  company_name: '青禾美甲',
  industry: '本地美容美甲门店',
  main_goal: '获得附近客户咨询和预约',
  target_customer: '附近三公里25至35岁爱美女性',
  offer: '美甲套餐',
  customer_pain: '有浏览但咨询少',
  current_channels: '抖音、视频号',
  biggest_problem: '有浏览没咨询',
  benchmark: {},
});
const multiPlatformSetups = multiPlatformAccountSetupData.diagnosis.account_setup.platform_setups;
assert(multiPlatformSetups.length === 2 && multiPlatformSetups.map((item) => item.starting_platform.platform).join(',') === '抖音,视频号', 'multiple explicitly selected platforms should each receive an independent account setup in the selected order');
assert(multiPlatformSetups[0].platform_profile === 'douyin' && multiPlatformSetups[1].platform_profile === 'wechat_channels', 'multi-platform account setup should preserve different Douyin and Channels profiles');
assert(diagnosis.platform_recommendations.primary[0].platform === '小红书', 'new account should prioritize 小红书');
assert(!diagnosis.platform_recommendations.primary.some((x) => x.platform.includes('美团')), '美团/大众点评 must not be own-account primary platform');
assert(diagnosis.platform_recommendations.client_platforms.some((x) => x.platform.includes('美团')), '美团 can appear only as target-client platform');
assert(plans.length === 7, `expected 7 plans, got ${plans.length}`);
assert(plans.filter((plan) => plan.platform === '小红书').every((plan) => Array.from(plan.topic).length <= 20), 'all Xiaohongshu plan topics should pass the server-side 20-character hard limit');

const personalizationSettingsClientId = 'non-personalized-plan-owner';
const defaultPersonalizationSettingsResponse = await handler(request('GET', `user/settings?client_id=${personalizationSettingsClientId}`));
assert(defaultPersonalizationSettingsResponse.status === 200, 'GET /user/settings should return default settings');
const nakedPersonalizationSettingsResponse = await handler(request('GET', `user/settings?client_id=${personalizationSettingsClientId}`, undefined, { customerAccess: false }));
assert(nakedPersonalizationSettingsResponse.status === 401, 'GET /user/settings with only a naked client_id must be rejected');
const defaultPersonalizationSettings = await defaultPersonalizationSettingsResponse.json();
assert(defaultPersonalizationSettings.personalized_recommendation_enabled === true, 'personalized recommendation should default to enabled');
const disabledPersonalizationResponse = await handler(request('PATCH', 'user/settings', {
  client_id: personalizationSettingsClientId,
  personalized_recommendation_enabled: false,
}));
assert(disabledPersonalizationResponse.status === 200, 'PATCH /user/settings should save the personalization switch');
const disabledPersonalizationSettings = await disabledPersonalizationResponse.json();
assert(disabledPersonalizationSettings.personalized_recommendation_enabled === false, 'PATCH /user/settings should return false after opt-out');
const anotherClientSettingsId = 'another-client-must-not-be-trusted';
await handler(request('PATCH', 'user/settings', {
  client_id: anotherClientSettingsId,
  personalized_recommendation_enabled: false,
}));
const crossClientPersonalizationPatch = await handler(request('PATCH', 'user/settings', {
  client_id: personalizationSettingsClientId,
  settings_client_id: anotherClientSettingsId,
  personalized_recommendation_enabled: true,
}));
assert(crossClientPersonalizationPatch.status === 200, 'settings API should ignore an untrusted settings_client_id override and update only the authenticated client');
const anotherClientSettingsAfterCrossPatch = await (await handler(request('GET', `user/settings?client_id=${anotherClientSettingsId}`))).json();
assert(anotherClientSettingsAfterCrossPatch.personalized_recommendation_enabled === false, 'a customer request must not change another client settings bucket');
await handler(request('PATCH', 'user/settings', {
  client_id: personalizationSettingsClientId,
  personalized_recommendation_enabled: false,
}));
const refreshedPersonalizationSettings = await (await handler(request('GET', `user/settings?client_id=${personalizationSettingsClientId}`))).json();
assert(refreshedPersonalizationSettings.personalized_recommendation_enabled === false, 'GET /user/settings should keep false after a simulated refresh');

const personalizationMarker = 'PERSONALIZED-BENCHMARK-MARKER';
let nonPersonalizedPlanJobPromise = null;
const nonPersonalizedPlanJobResponse = await handler(request('POST', 'plan-jobs', {
  ...payload,
  client_id: 'non-personalized-plan-owner',
  customer_key: 'non-personalized-plan-owner',
  settings_client_id: 'another-client-must-not-be-trusted',
  personalized_recommendation_enabled: true,
  best_recent_content: personalizationMarker,
  account_preference: personalizationMarker,
  benchmark: {
    platform: '小红书',
    accounts: [personalizationMarker],
    notes: personalizationMarker,
    sample_content: personalizationMarker,
  },
  request_id: 'non-personalized-plan-request-0001',
}), {
  waitUntil(promise) { nonPersonalizedPlanJobPromise = promise; },
});
assert(nonPersonalizedPlanJobResponse.status === 202 && nonPersonalizedPlanJobPromise, 'non-personalized plan job should still generate basic service content');
await nonPersonalizedPlanJobPromise;
const nonPersonalizedPlanJobCreated = await nonPersonalizedPlanJobResponse.json();
const nonPersonalizedPlanJob = await (await handler(request('GET', `plan-jobs/${encodeURIComponent(nonPersonalizedPlanJobCreated.job_id)}?client_id=non-personalized-plan-owner`))).json();
assert(nonPersonalizedPlanJob.personalization_mode === 'non_personalized', 'stored opt-out must override a stale enabled request');
assert(nonPersonalizedPlanJob.result?.personalization_mode === 'non_personalized', 'plan result should record non-personalized mode');
assert(nonPersonalizedPlanJob.result?.assessment?.personalized_recommendation_enabled === false, 'assessment should record the effective opt-out');
assert(nonPersonalizedPlanJob.result?.assessment?.best_recent_content === '' && nonPersonalizedPlanJob.result?.assessment?.account_preference === '', 'non-personalized generation must remove content and account preferences');
assert((nonPersonalizedPlanJob.result?.assessment?.benchmark?.accounts || []).length === 0, 'non-personalized generation must remove benchmark profile signals');
assert(!JSON.stringify(nonPersonalizedPlanJob.result).includes(personalizationMarker), 'non-personalized plan output must not use stripped personalization markers');

const nonPersonalizedPlan = nonPersonalizedPlanJob.result.plans[0];
const nonPersonalizedCurrentRecord = {
  content_plan_id: nonPersonalizedPlan.id,
  plan_topic: nonPersonalizedPlan.topic,
  publish_link: 'https://example.com/non-personalized-current',
  created_at: shanghaiDateIso(0) + ' 10:00:00',
  views: 600,
  engagement: 20,
  consultations: 1,
};
const nonPersonalizedAdviceResponse = await handler(request('POST', 'customer-growth-advice', {
  request_id: 'non-personalized-advice-request-0001',
  client_id: 'non-personalized-plan-owner',
  settings_client_id: personalizationSettingsClientId,
  personalized_recommendation_enabled: true,
  assessment: {
    ...nonPersonalizedPlanJob.result.assessment,
    best_recent_content: personalizationMarker,
    benchmark: {platform:'小红书', accounts:[personalizationMarker], notes:personalizationMarker, sample_content:personalizationMarker},
  },
  diagnosis: nonPersonalizedPlanJob.result.diagnosis,
  plans: nonPersonalizedPlanJob.result.plans,
  previous_rounds: [{round_number:1, plans:[{topic:personalizationMarker}]}],
  previous_plan_topics: [personalizationMarker],
  records: [
    nonPersonalizedCurrentRecord,
    {
      content_plan_id: 'historical-plan',
      plan_topic: personalizationMarker,
      publish_link: 'https://example.com/non-personalized-history',
      created_at: shanghaiDateIso(-1) + ' 10:00:00',
      views: 5000,
      engagement: 500,
      consultations: 80,
    },
  ],
  record: nonPersonalizedCurrentRecord,
  selected_plan_id: nonPersonalizedPlan.id,
}));
assert(nonPersonalizedAdviceResponse.status === 200, 'non-personalized customer advice should remain available');
const nonPersonalizedAdvice = await nonPersonalizedAdviceResponse.json();
assert(nonPersonalizedAdvice.personalization_mode === 'non_personalized', 'customer advice should expose the effective non-personalized mode');
assert(nonPersonalizedAdvice.context_used.history_feedback_count === 0, 'non-personalized advice must not use historical feedback');
assert(!JSON.stringify(nonPersonalizedAdvice).includes(personalizationMarker), 'non-personalized advice must not use previous-round or preference markers');
const nakedAdviceResponse = await handler(request('POST', 'customer-growth-advice', {
  request_id: 'unauthorized-advice-request-0001',
  client_id: 'non-personalized-plan-owner',
  assessment: payload,
  plans: nonPersonalizedPlanJob.result.plans,
  records: [nonPersonalizedCurrentRecord],
  record: nonPersonalizedCurrentRecord,
}, { customerAccess: false }));
assert(nakedAdviceResponse.status === 401, 'customer growth advice with only a naked client_id must be rejected before model metering');

let queuedPlanJobPromise = null;
const nakedPlanJobCreateResponse = await handler(request('POST', 'plan-jobs', {
  ...payload,
  client_id: 'unauthorized-plan-job-owner',
  customer_key: 'unauthorized-plan-job-owner',
  request_id: 'unauthorized-plan-job-request-0001',
}, { customerAccess: false }));
assert(nakedPlanJobCreateResponse.status === 401, 'POST /plan-jobs with only a naked client_id must be rejected before queueing');
const planJobStartedAt = Date.now();
const planJobCreateResponse = await handler(request('POST', 'plan-jobs', {
  ...payload,
  client_id: 'plan-job-owner',
  customer_key: 'plan-job-owner',
}), {
  waitUntil(promise) { queuedPlanJobPromise = promise; },
});
const planJobSubmitLatencyMs = Date.now() - planJobStartedAt;
assert(planJobCreateResponse.status === 202, `POST /plan-jobs should return 202, got ${planJobCreateResponse.status}`);
assert(planJobSubmitLatencyMs < 500, `POST /plan-jobs should return immediately, took ${planJobSubmitLatencyMs}ms`);
const createdPlanJob = await planJobCreateResponse.json();
assert(createdPlanJob.job_id && createdPlanJob.status === 'pending', 'POST /plan-jobs should return a pending job id');
assert(queuedPlanJobPromise, 'POST /plan-jobs should schedule background processing with context.waitUntil');
await queuedPlanJobPromise;
const ownPlanJobResponse = await handler(request('GET', `plan-jobs/${encodeURIComponent(createdPlanJob.job_id)}?client_id=plan-job-owner`));
assert(ownPlanJobResponse.status === 200, `same client should read its plan job, got ${ownPlanJobResponse.status}`);
const nakedPlanJobResponse = await handler(request('GET', `plan-jobs/${encodeURIComponent(createdPlanJob.job_id)}?client_id=plan-job-owner`, undefined, { customerAccess: false }));
assert(nakedPlanJobResponse.status === 401, 'plan job polling with only a naked client_id must be rejected');
const wrongTokenPlanJobResponse = await handler(request('GET', `plan-jobs/${encodeURIComponent(createdPlanJob.job_id)}?client_id=plan-job-owner`, undefined, {
  headers: { 'x-customer-access-token': customerAccessTokenFor('plan-job-other') },
}));
assert(wrongTokenPlanJobResponse.status === 401, 'plan job polling with another customer token must be rejected');
const ownPlanJob = await ownPlanJobResponse.json();
assert(ownPlanJob.status === 'completed' && ownPlanJob.result?.plans?.length === 7, 'same client should receive the completed seven-plan result');
let repeatedPlanJobPromise = null;
const repeatedPlanJobResponse = await handler(request('POST', 'plan-jobs', {
  ...payload,
  client_id: 'plan-job-owner',
  customer_key: 'plan-job-owner',
}), {
  waitUntil(promise) { repeatedPlanJobPromise = promise; },
});
assert(repeatedPlanJobResponse.status === 202 && repeatedPlanJobPromise, 'repeated customer plan job should be queued normally');
const repeatedPlanJobCreated = await repeatedPlanJobResponse.json();
await repeatedPlanJobPromise;
const repeatedPlanJob = await (await handler(request('GET', `plan-jobs/${encodeURIComponent(repeatedPlanJobCreated.job_id)}?client_id=plan-job-owner`))).json();
const firstPlanTopics = ownPlanJob.result.plans.map((plan) => plan.topic);
const repeatedPlanTopics = repeatedPlanJob.result.plans.map((plan) => plan.topic);
assert(JSON.stringify(firstPlanTopics) !== JSON.stringify(repeatedPlanTopics), 'same customer input submitted twice should rotate the creative direction instead of returning the identical seven-topic order');
const ownPlanJobText = JSON.stringify(ownPlanJob);
['requested_model', 'actual_model', 'provider', 'fallback_reason', 'generation_meta', 'model_info', 'strategy_quality_context', 'strategy_quality'].forEach((word) => {
  assert(!ownPlanJobText.includes(word), `customer plan job response must hide model field ${word}`);
});
const crossClientPlanJobResponse = await handler(request('GET', `plan-jobs/${encodeURIComponent(createdPlanJob.job_id)}?client_id=plan-job-other`));
assert(crossClientPlanJobResponse.status === 401, `cross-client plan job read should fail authentication before lookup, got ${crossClientPlanJobResponse.status}`);
const noClientPlanJobResponse = await handler(request('GET', `plan-jobs/${encodeURIComponent(createdPlanJob.job_id)}`));
assert(noClientPlanJobResponse.status === 400, `plan job read without client_id should return 400, got ${noClientPlanJobResponse.status}`);
const planJobListResponse = await handler(request('GET', 'plan-jobs?client_id=plan-job-owner'));
assert(planJobListResponse.status === 404, `plan jobs must not expose a customer listing endpoint, got ${planJobListResponse.status}`);

const publicFunnelBefore = await handler(request('GET', 'analytics/funnel'));
assert(publicFunnelBefore.status === 401, 'public clients must not read funnel or metering aggregates');
const meteringBefore = await (await handler(internalRequest('GET', 'analytics/funnel'))).json();
process.env.RATE_LIMIT_ENFORCE = 'true';
process.env.GENERATION_RATE_CLIENT_MAX = '1';
process.env.GENERATION_RATE_IP_MAX = '100';
process.env.GENERATION_DAILY_CLIENT_MAX = '1';
const idempotentPayload = {
  ...payload,
  client_id: 'p0-idempotent-client',
  customer_key: 'p0-idempotent-client',
  request_id: 'p0-idempotent-request-0001',
};
let idempotentJobPromise = null;
const idempotentFirstResponse = await handler(request('POST', 'plan-jobs', idempotentPayload, {
  headers: { 'x-nf-client-connection-ip': '198.51.100.21' },
}), {
  waitUntil(promise) { idempotentJobPromise = promise; },
});
let duplicateJobPromise = null;
const idempotentRetryResponse = await handler(request('POST', 'plan-jobs', idempotentPayload, {
  headers: { 'x-nf-client-connection-ip': '198.51.100.21' },
}), {
  waitUntil(promise) { duplicateJobPromise = promise; },
});
assert(idempotentFirstResponse.status === 202 && idempotentRetryResponse.status === 202, 'same request_id retry should remain accepted under a one-use daily limit');
const idempotentFirst = await idempotentFirstResponse.json();
const idempotentRetry = await idempotentRetryResponse.json();
assert(idempotentFirst.job_id === idempotentRetry.job_id, 'same request_id must resolve to the same deterministic plan job');
assert(idempotentJobPromise && !duplicateJobPromise, 'idempotent network retry must not queue a second provider task');
await idempotentJobPromise;
const meteringAfterIdempotent = await (await handler(internalRequest('GET', 'analytics/funnel'))).json();
assert(meteringAfterIdempotent.metering.product_usage === meteringBefore.metering.product_usage + 1, 'idempotent retry should record product usage exactly once after delivery');

process.env.RATE_LIMIT_ENFORCE = 'false';
process.env.GENERATION_RATE_CLIENT_MAX = '100';
process.env.GENERATION_RATE_IP_MAX = '1';
process.env.GENERATION_DAILY_CLIENT_MAX = '100';
let shadowFirstPromise = null;
const shadowFirstResponse = await handler(request('POST', 'plan-jobs', {
  ...payload,
  client_id: 'p0-shadow-client-a',
  customer_key: 'p0-shadow-client-a',
  request_id: 'p0-shadow-request-0001',
}, { headers: { 'x-nf-client-connection-ip': '198.51.100.31' } }), {
  waitUntil(promise) { shadowFirstPromise = promise; },
});
let shadowSharedIpPromise = null;
const shadowSharedIpResponse = await handler(request('POST', 'plan-jobs', {
  ...payload,
  client_id: 'p0-shadow-client-b',
  customer_key: 'p0-shadow-client-b',
  request_id: 'p0-shadow-request-0002',
}, { headers: { 'x-nf-client-connection-ip': '198.51.100.31' } }), {
  waitUntil(promise) { shadowSharedIpPromise = promise; },
});
assert(shadowFirstResponse.status === 202 && shadowSharedIpResponse.status === 202, 'shadow mode must not block two customers sharing one IP even when the IP threshold is exceeded');
await Promise.all([shadowFirstPromise, shadowSharedIpPromise]);
const shadowSummary = await (await handler(internalRequest('GET', 'analytics/funnel'))).json();
assert(shadowSummary.rate_limit_shadow_hits >= 1, 'shadow limit hit should be visible in the internal funnel summary');

process.env.RATE_LIMIT_ENFORCE = 'true';
process.env.GENERATION_RATE_CLIENT_MAX = '1';
process.env.GENERATION_RATE_IP_MAX = '100';
process.env.GENERATION_DAILY_CLIENT_MAX = '1';
let enforcedFirstPromise = null;
const enforcedFirst = await handler(request('POST', 'plan-jobs', {
  ...payload,
  client_id: 'p0-enforced-client',
  customer_key: 'p0-enforced-client',
  request_id: 'p0-enforced-request-0001',
}, { headers: { 'x-nf-client-connection-ip': '198.51.100.41' } }), {
  waitUntil(promise) { enforcedFirstPromise = promise; },
});
assert(enforcedFirst.status === 202 && enforcedFirstPromise, 'first enforced-mode request should stay within the configured limit');
const enforcedSecond = await handler(request('POST', 'plan-jobs', {
  ...payload,
  client_id: 'p0-enforced-client',
  customer_key: 'p0-enforced-client',
  request_id: 'p0-enforced-request-0002',
}, { headers: { 'x-nf-client-connection-ip': '198.51.100.42' } }));
assert(enforcedSecond.status === 429, `second enforced-mode request should return 429, got ${enforcedSecond.status}`);
const enforcedBody = await enforcedSecond.json();
assert(enforcedBody.code === 'rate_limited' && enforcedBody.error === '生成太频繁，稍等片刻再试', 'enforced rate limit should return the approved friendly business message');
await enforcedFirstPromise;

for (const [event, suffix] of [['home_view', 'home'], ['intake_started', 'intake'], ['effect_recorded', 'effect'], ['next_round_entered', 'next']]) {
  const tracked = await handler(request('POST', 'track', {
    client_id: 'p0-funnel-client',
    event,
    event_id: `p0-funnel-${suffix}-0001`,
    properties: { source: 'customer_public', round_number: 1, ignored_business_content: '不应保存客户业务内容' },
  }));
  assert(tracked.status === 202, `POST /track should accept allowlisted event ${event}`);
}
const unsupportedTrack = await handler(request('POST', 'track', { client_id: 'p0-funnel-client', event: 'customer_email', event_id: 'p0-funnel-invalid-0001' }));
assert(unsupportedTrack.status === 400, 'POST /track must reject non-allowlisted event names');
const unauthorizedTrack = await handler(request('POST', 'track', {
  client_id: 'p0-funnel-client',
  event: 'home_view',
  event_id: 'p0-funnel-unauthorized-0001',
}, { customerAccess: false }));
assert(unauthorizedTrack.status === 401, 'POST /track with only a naked client_id must not poison customer analytics');
const funnelSummaryResponse = await handler(internalRequest('GET', 'analytics/funnel'));
assert(funnelSummaryResponse.status === 200, 'authorized internal request should read funnel aggregates');
const funnelData = await funnelSummaryResponse.json();
for (const event of ['home_view', 'intake_started', 'generation_submitted', 'generation_result', 'effect_recorded', 'next_round_entered']) {
  assert(funnelData.counts[event] >= 1, `funnel aggregate should include ${event}`);
}
assert(!JSON.stringify(funnelData).includes('不应保存客户业务内容'), 'funnel aggregate must not expose ignored business content');
process.env.RATE_LIMIT_ENFORCE = 'false';
process.env.GENERATION_RATE_CLIENT_MAX = '100';
process.env.GENERATION_RATE_IP_MAX = '100';
process.env.GENERATION_DAILY_CLIENT_MAX = '100';

assert(diagnosis.strategy_mvp && diagnosis.strategy_mvp.seven_day_flywheel.length === 7, 'diagnosis should expose platform strategy MVP and 7-day flywheel');
assert(plans.every((plan) => plan.experiment_type && plan.why_platform_fit && Array.isArray(plan.observe_metrics) && plan.observe_metrics.length >= 3 && plan.next_adjustment && plan.content_hypothesis), 'plans should include experiment type, platform fit, metrics, next adjustment and hypothesis');
assert(diagnosis.merchant_profile && diagnosis.merchant_profile.bottleneck && diagnosis.merchant_profile.conversion_action, 'diagnosis should expose merchant_profile for differentiated customer advice');
assert(diagnosis.strategy_quality_context?.framework_version === 'customer-evidence-p0', 'diagnosis should expose the P0 customer-evidence strategy framework internally');
assert(diagnosis.strategy_quality_context.customer_language.some((item) => item.includes('不知道该发什么')), 'strategy framework should preserve customer language instead of reducing it to an industry label');
assert(diagnosis.strategy_quality_context.proof_assets.some((item) => item.includes('企业真实服务案例')), 'strategy framework should preserve available proof assets');
assert(diagnosis.strategy_quality_context.market_calibration.some((item) => item.includes('真实问题')), 'strategy framework should preserve benchmark market calibration without copying it');
assert(plans.every((plan) => plan.strategy_quality?.framework_version === 'customer-evidence-p0' && plan.strategy_quality?.checks?.customer_specific && plan.strategy_quality?.checks?.platform_specific && plan.strategy_quality?.checks?.measurable), 'plans should retain an internal customer-specific, platform-specific and measurable strategy-quality record');
assert(plans.every((plan) => plan.customer_reasoning?.customer_voice_basis && plan.customer_reasoning?.pain_basis && plan.customer_reasoning?.proof_basis && plan.customer_reasoning?.platform_basis && plan.customer_reasoning?.conversion_basis && plan.customer_reasoning?.validation_goal && plan.customer_reasoning?.decision_rule && plan.customer_reasoning?.publish_note), 'plans should include customer voice, evidence and decision rules in why-this-plan explanations');
assert(plans.every((plan) => plan.publish_audit?.risk_level && Array.isArray(plan.publish_audit.checks) && plan.publish_audit.checks.length >= 1), 'plans should include publish_audit checks for platform-rule review');
assert(plans.some((plan) => plan.platform === '小红书' && plan.publish_audit.checks.some((check) => String(check.label || '').includes('小红书'))), 'XHS plans should include a 小红书 publish pre-check');
const publicAssessmentDenied = await handler(request('POST', 'assessments', payload));
assert(publicAssessmentDenied.status === 401, `public POST /assessments must be protected by INTERNAL_ACCESS_TOKEN, got ${publicAssessmentDenied.status}`);
assert(data.model_info && data.generation_meta, 'authorized assessment smoke data should retain internal model evidence');
const internalEvidence = await submitAssessment({
  ...payload,
  client_id: 'internal-evidence-smoke',
  customer_key: 'internal-evidence-smoke',
  customer_pain: '企业主常问该发什么、如何判断内容是否带来咨询、下一条应该怎样调整',
  client_mode: 'internal_test',
  source: 'internal_test',
}, { internal: true });
assert(internalEvidence.model_info && internalEvidence.generation_meta, 'authorized internal POST /assessments should retain model evidence');
assert(internalEvidence.generation_meta.provider === 'local' && internalEvidence.generation_meta.actual_model === 'rule_template' && typeof internalEvidence.generation_meta.fallback === 'boolean', 'authorized internal generation should retain explicit model evidence');
process.env.ARK_API_KEY = 'safe-gate-smoke-key';
process.env.ARK_MODEL = 'safe-gate-smoke-model';
delete process.env.SAFE_TO_RUN;
const fetchBeforeSafeGate = globalThis.fetch;
let safeGateFetchCount = 0;
globalThis.fetch = async (...args) => {
  safeGateFetchCount += 1;
  return fetchBeforeSafeGate(...args);
};
const safeGateEvidence = await submitAssessment({
  ...payload,
  client_id: 'safe-gate-smoke',
  customer_key: 'safe-gate-smoke',
  client_mode: 'internal_version',
  source: 'internal_version',
});
globalThis.fetch = fetchBeforeSafeGate;
delete process.env.ARK_API_KEY;
delete process.env.ARK_MODEL;
assert(safeGateFetchCount === 0, 'SAFE_TO_RUN disabled must prevent every Ark outbound request');
assert(safeGateEvidence.generation_meta.fallback === true && safeGateEvidence.generation_meta.fallback_reason === 'safe_to_run_disabled', 'SAFE_TO_RUN disabled should preserve a renderable rule fallback with explicit internal evidence');

const basketballData = await submitAssessmentForClient('basketball', {
  company_name: '星跃少儿篮球训练营',
  industry: '少儿篮球培训',
  main_goal: '提升暑期班体验课预约',
  target_customer: '6-12岁小学生家长',
  offer: '少儿篮球体验课和暑期班',
  customer_pain: '家长担心安全、孩子跟不上、时间不合适',
  content_assets: '课堂训练视频、教练资质、家长反馈',
  current_channels: '抖音,小红书,视频号',
  co_creation: {
    selected_direction: '体验课转化型',
    avoided_content: ['不想承诺效果'],
    customer_emphasis: '暑期班周末体验课',
    confirmed_at: '2026-07-01 12:00:00',
  },
});
const basketballPlanText = JSON.stringify({assessment: basketballData.assessment, diagnosis: basketballData.diagnosis, plans: basketballData.plans});
assert(basketballData.assessment.co_creation.selected_direction === '体验课转化型', 'assessment should preserve customer co-creation selected direction');
assert(/体验课|周末|适合|预约/.test(basketballData.plans.slice(0, 3).map((plan)=>plan.topic).join(' ')), 'co-created basketball plans should prioritize the confirmed experience-class direction');
assert(!/保证|承诺|一定/.test(basketballData.plans.map((plan)=>[plan.topic, plan.angle, plan.quality_note].join(' ')).join(' ')), 'co-created plans should avoid customer rejected promise/effect language');
['安标', '医疗器械', 'PTE', 'SunPace', 'Sunny', 'P01', 'P02', 'P03'].forEach((word) => {
  assert(!basketballPlanText.includes(word), `basketball strategy output must not leak cross-project term: ${word}`);
});
['抖音', '小红书', '视频号'].forEach((platform) => {
  assert(basketballData.plans.some((plan) => plan.platform === platform), `basketball plans should include ${platform}`);
});
const basketballPlatformStrategies = new Map(basketballData.plans.map((plan) => [plan.platform, [plan.why_platform_fit, plan.platform_expression, plan.next_adjustment, (plan.observe_metrics || []).join('/')].join('|')]));
assert(basketballPlatformStrategies.get('抖音') && basketballPlatformStrategies.get('小红书') && basketballPlatformStrategies.get('视频号'), 'basketball should have strategies for Douyin/XHS/Video Account');
assert(new Set([...basketballPlatformStrategies.values()]).size >= 3, 'Douyin/XHS/Video Account strategy text should be clearly different');
assert(new Set(basketballData.plans.map((plan) => plan.experiment_type)).size >= 5, 'basketball 7-day plan should cover multiple experiment types, not average posting');
assert(Array.isArray(basketballData.diagnosis.strategy_mvp.growth_gaps), 'basketball diagnosis should expose growth gap prompts as a non-blocking array');

const huokeCompassData = await submitAssessmentForClient('huoke-compass-self-test', {
  company_name: '',
  industry: '线上营销咨询与内容增长工具',
  main_goal: '获得更多有效咨询',
  target_customer: '需要持续线上获客的企业主、门店负责人和服务型商家',
  offer: '',
  current_channels: '小红书',
  biggest_problem: '不知道发什么',
  co_creation: {
    selected_direction: '客户痛点型',
    avoided_content: ['不想太硬广'],
    confirmed_at: '2026-08-14 10:00:00',
  },
});
const huokeCompassTopics = huokeCompassData.plans.slice(0, 3).map((plan) => plan.topic);
assert(huokeCompassData.diagnosis.account_setup.account_name === '获客罗盘', 'marketing-growth account setup should use the current product name instead of a retired sample name');
assert(huokeCompassTopics.some((topic) => topic.includes('企业不知道发什么')) && huokeCompassTopics.some((topic) => topic.includes('AI生成内容')), 'marketing-growth first topics should directly explain the customer problem and system differentiation');
assert(!huokeCompassTopics.some((topic) => /与内容增长工具|这思路|太顺了/.test(topic)), `marketing-growth topics should remain grammatical and concrete: ${huokeCompassTopics.join(' / ')}`);
assert(huokeCompassData.plans.every((plan) => Array.from(plan.topic).length <= 20), 'marketing-growth Xiaohongshu topics should stay within 20 characters');

const martialArtsData = await submitAssessmentForClient('ziwuxian-martial-arts', {
  company_name: '子武限武术搏击俱乐部',
  industry: '少儿武术搏击俱乐部，做武术、散打、搏击启蒙和体能训练，服务附近社区家庭',
  main_goal: '希望获得附近家长咨询和体验课预约',
  target_customer: '附近3公里内6-12岁孩子家长，担心孩子胆小、坐不住、缺少规则感',
  offer: '武术搏击体验课和周末班',
  customer_pain: '家长担心受伤、强度太大、孩子零基础跟不上',
  content_assets: '课堂训练片段、护具和垫面、防护动作、教练资质、孩子课堂反馈',
  current_channels: '抖音,小红书,视频号',
  co_creation: {
    selected_direction: '体验课转化型',
    customer_emphasis: '安全保护和零基础体验课',
    confirmed_at: '2026-07-09 10:00:00',
  },
});
const martialArtsText = JSON.stringify({ diagnosis: martialArtsData.diagnosis, plans: martialArtsData.plans });
assert(/武术|搏击|散打|防护|安全|体验课|规则感/.test(martialArtsText), 'martial arts plans should use martial arts / safety / experience-class semantics');
assert(martialArtsData.diagnosis.merchant_profile.service_type === 'martial_arts', 'martial arts diagnosis should carry a martial_arts merchant profile');
assert(martialArtsData.plans.every((plan) => plan.customer_reasoning?.pain_basis && plan.publish_audit?.risk_level), 'martial arts plans should carry customer reasoning and publish audit');
['篮球课', '少儿篮球', '运球', '投篮', '篮筐', '篮球商品'].forEach((word) => {
  assert(!martialArtsText.includes(word), `martial arts output must not leak basketball wording: ${word}`);
});
const lowInfoBasketball = await submitAssessment({
  client_id: 'basketball-low-info',
  customer_key: 'basketball-low-info',
  industry: '少儿篮球培训',
  main_goal: '提升体验课预约',
  target_customer: '6-12岁孩子家长',
  current_channels: '抖音,小红书,视频号',
  biggest_problem: '不知道发什么',
});
assert(lowInfoBasketball.plans.length === 7, 'low-info basketball payload should still generate a 7-day plan without posting_frequency/offer/pain/assets');
assert(lowInfoBasketball.diagnosis.strategy_mvp.growth_gaps.length >= 3, 'low-info basketball payload should show non-blocking growth gap prompts');
assert(lowInfoBasketball.plans.every((plan) => plan.why_platform_fit && plan.next_adjustment), 'low-info basketball plans should still include platform strategy and adjustment advice');
const dentalData = await submitAssessmentForClient('dental', {
  company_name: '社区口腔门诊',
  industry: '口腔护理/牙科门诊',
  main_goal: '提升洗牙和正畸咨询',
  target_customer: '周边家庭和年轻白领',
  offer: '洗牙套餐、儿童涂氟、正畸咨询',
  customer_pain: '担心疼、价格不透明、医生不专业',
  content_assets: '门诊环境、医生资质、客户评价',
  current_channels: '小红书,视频号',
});
const floristData = await submitAssessmentForClient('florist', {
  company_name: '清屿花艺工作室',
  industry: '社区花店/鲜花订阅',
  main_goal: '提升节日花束预订和企业客户咨询',
  target_customer: '周边社区居民、情侣、企业行政',
  offer: '节日花束、周花订阅、开业花篮',
  customer_pain: '不知道选什么款式，担心配送不准时',
  content_assets: '花束实拍、客户反馈、节日搭配案例',
  current_channels: '小红书,朋友圈,视频号',
});

[
  ['basketball', basketballData],
  ['dental', dentalData],
  ['florist', floristData],
].forEach(([clientId, item]) => {
  assert(item.assessment.client_id === clientId, `${clientId} assessment should echo client_id`);
  assert(item.diagnosis.client_id === clientId, `${clientId} diagnosis should echo client_id`);
  assert(item.plans.length === 7, `${clientId} should generate 7 plans`);
  assert(item.plans.every((plan) => plan.client_id === clientId), `${clientId} plans should bind client_id`);
});
const dentalPlansPublicGet = await handler(request('GET', 'plans?client_id=dental'));
assert(dentalPlansPublicGet.status === 401, 'anonymous GET /plans must be rejected');
const dentalPlansGet = await handler(internalRequest('GET', 'plans?client_id=dental'));
assert(dentalPlansGet.status === 200, 'authorized GET /plans?client_id=dental should succeed');
const dentalPlans = await dentalPlansGet.json();
assert(dentalPlans.length >= 7 && dentalPlans.every((plan) => plan.client_id === 'dental'), 'GET /plans should filter to dental client_id');
const basketballAssessmentsGet = await handler(internalRequest('GET', 'assessments?client_id=basketball'));
assert(basketballAssessmentsGet.status === 200, 'authorized GET /assessments should remain available to the internal workspace');
const basketballAssessments = await basketballAssessmentsGet.json();
assert(basketballAssessments.some((item) => item.company_name === '星跃少儿篮球训练营'), 'basketball assessments should include basketball client');
assert(!basketballAssessments.some((item) => item.company_name === '社区口腔门诊' || item.company_name === '清屿花艺工作室'), 'basketball assessment list must not include dental/florist clients');
const postProjectStore = (clientId, projectId, name, data, updatedAt) => handler(request('POST', 'state', {
  client_id: clientId,
  project_store: {
    activeProjectId: projectId,
    projects: [{
      id: projectId,
      name,
      updated_at: updatedAt,
      state: {
        client_id: clientId,
        project: { id: projectId, client_id: clientId, name, updated_at: updatedAt },
        assessment: { ...data.assessment, client_id: clientId, company_name: name },
        diagnosis: { ...data.diagnosis, client_id: clientId },
        plans: data.plans.map((plan) => ({ ...plan, client_id: clientId })),
        feedback: [],
        updated_at: updatedAt,
      },
    }],
  },
}));
const dentalStatePost = await handler(request('POST', 'state', {
  client_id: 'dental',
  project_store: {
    activeProjectId: 'project-dental',
    projects: [{
      id: 'project-dental',
      name: '社区口腔门诊',
      state: {
        client_id: 'dental',
        project: { id: 'project-dental', client_id: 'dental', name: '社区口腔门诊' },
        assessment: dentalData.assessment,
        diagnosis: dentalData.diagnosis,
        plans: dentalData.plans,
        feedback: [],
      },
    }],
  },
}));
assert(dentalStatePost.status === 201, 'POST /state should accept client_id');
const dentalState = await dentalStatePost.json();
assert(dentalState.client_id === 'dental' && dentalState.storage_key.includes('dental'), 'POST /state response should be scoped by client_id');
const ziwuxianOldStatePost = await postProjectStore('anonymous-mqap9sxv-k803wl', 'project-zwx-old', '子武限武术搏击俱乐部', basketballData, '2026-06-13 11:07');
const ziwuxianMidStatePost = await postProjectStore('anonymous-mqd67u5o-i5irvr', 'project-zwx-mid', '子武限武术搏击俱乐部作战台', basketballData, '2026-06-14 10:36');
const ziwuxianNewStatePost = await postProjectStore('anonymous-mqbrw6q8-q6nkmw', 'project-zwx-new', '子武限武术搏击俱乐部', basketballData, '2026-06-15 09:20');
assert(ziwuxianOldStatePost.status === 201 && ziwuxianMidStatePost.status === 201 && ziwuxianNewStatePost.status === 201, 'duplicate ziwuxian states should be accepted for grouped customer list smoke');
const basketballCanonicalStatePost = await postProjectStore('basketball', 'project-basketball-primary', '中傲少儿篮球训练营', basketballData, '2026-06-16 08:00');
const basketballDefaultStatePost = await postProjectStore('default', 'project-basketball-default', '中傲少儿篮球训练营作战台', basketballData, '2026-06-12 08:00');
assert(basketballCanonicalStatePost.status === 201 && basketballDefaultStatePost.status === 201, 'basketball duplicate states should be accepted for grouped customer list smoke');
const floristStatePost = await postProjectStore('florist', 'project-florist', '清屿花艺工作室作战台', floristData, '2026-06-11 10:00');
assert(floristStatePost.status === 201, 'florist demo state should be accepted for grouped customer list smoke');
const qaProbeStatePost = await handler(request('POST', 'state', {
  client_id: 'qa-probe-customer-list',
  project_store: {
    activeProjectId: 'project-qa-probe',
    projects: [{
      id: 'project-qa-probe',
      name: 'QA探针客户',
      state: {
        client_id: 'qa-probe-customer-list',
        project: { id: 'project-qa-probe', client_id: 'qa-probe-customer-list', name: 'QA探针客户' },
        assessment: dentalData.assessment,
        diagnosis: dentalData.diagnosis,
        plans: dentalData.plans,
        feedback: [],
      },
    }],
  },
}));
assert(qaProbeStatePost.status === 201, 'POST /state should create a qa probe state for customer-list filtering');
const customersPublicGet = await handler(request('GET', 'customers'));
assert(customersPublicGet.status === 401, `GET /customers without internal token should be rejected, got ${customersPublicGet.status}`);
const mergePreviewPublicGet = await handler(request('GET', 'customers/merge-preview?display_name=' + encodeURIComponent('子武限武术搏击俱乐部')));
assert(mergePreviewPublicGet.status === 401, `GET /customers/merge-preview without internal token should be rejected, got ${mergePreviewPublicGet.status}`);
const customersModeOnlyGet = await handler(request('GET', 'customers?mode=internal&client_id=internal'));
assert(customersModeOnlyGet.status === 401, 'URL mode/client_id claims must not grant internal access');
const customersWrongTokenGet = await handler(request('GET', 'customers', undefined, { headers: { 'x-internal-token': 'wrong-token' } }));
assert(customersWrongTokenGet.status === 401, 'wrong internal token must be rejected');
delete process.env.INTERNAL_ACCESS_TOKEN;
const customersMissingEnvGet = await handler(internalRequest('GET', 'customers'));
assert(customersMissingEnvGet.status === 401, 'missing INTERNAL_ACCESS_TOKEN env must fail closed');
process.env.INTERNAL_ACCESS_TOKEN = INTERNAL_ACCESS_TOKEN;
for (const protectedPath of ['dashboard', 'diagnoses?client_id=dental', 'plans?client_id=dental', 'reviews', 'assets?client_id=internal', 'generation-tasks?client_id=internal']) {
  const protectedResponse = await handler(request('GET', protectedPath));
  assert(protectedResponse.status === 401, `anonymous GET /${protectedPath} must be rejected`);
}
const anonymousTaskDetail = await handler(request('GET', 'generation-tasks/nonexistent?client_id=internal'));
assert(anonymousTaskDetail.status === 401, 'anonymous generation task detail must be rejected before existence is disclosed');
for (const protectedPath of ['delivery-profiles', 'delivery-projects?client_id=delivery-p0-professional', 'delivery-cycles?client_id=delivery-p0-professional', 'collaboration-tasks?client_id=delivery-p0-professional', 'weekly-reports?client_id=delivery-p0-professional']) {
  const protectedResponse = await handler(request('GET', protectedPath));
  assert(protectedResponse.status === 401, `anonymous GET /${protectedPath} must be rejected`);
}
const deliveryProfilesResponse = await handler(internalRequest('GET', 'delivery-profiles'));
assert(deliveryProfilesResponse.status === 200, 'authorized GET /delivery-profiles should succeed');
const deliveryProfilesPayload = await deliveryProfilesResponse.json();
assert(deliveryProfilesPayload.audience === 'internal_only', 'delivery collaboration profiles must declare their internal-only audience');
assert(deliveryProfilesPayload.profiles.some((item) => item.id === 'professional_project' && item.example === '安标检测'), 'delivery profiles should include the professional project template');
assert(deliveryProfilesPayload.profiles.some((item) => item.id === 'local_growth_operation' && item.example === '伊美德儿'), 'delivery profiles should include the local growth operations template');
assert(deliveryProfilesPayload.feishu_phase === 'binding_only', 'P0 Feishu collaboration must remain binding-only');
assert(deliveryProfilesPayload.field_ownership.system.includes('status_events'), 'delivery profiles should expose field ownership rules');

const createDeliverySmokeResource = async (kind, body) => {
  const response = await handler(internalRequest('POST', kind, body));
  if (response.status !== 201) throw new Error(`POST /${kind} should succeed, got ${response.status}: ${await response.text()}`);
  return (await response.json()).resource;
};
const patchDeliverySmokeResource = async (kind, id, body) => {
  const response = await handler(internalRequest('PATCH', `${kind}/${encodeURIComponent(id)}`, body));
  if (response.status !== 200) throw new Error(`PATCH /${kind}/${id} should succeed, got ${response.status}: ${await response.text()}`);
  return (await response.json()).resource;
};

const professionalDeliveryClientId = 'delivery-p0-professional';
const professionalProjectId = 'project-anbiao-p0';
const professionalStateBefore = await (await handler(request('GET', `state?client_id=${professionalDeliveryClientId}`))).json();
const professionalDeliveryProject = await createDeliverySmokeResource('delivery-projects', {
  client_id: professionalDeliveryClientId,
  project_id: professionalProjectId,
  project_name: '安标检测内容交付项目',
  client_name: '安标检测',
  delivery_profile: 'professional_project',
  internal_owner: '项目运营',
  weekly_target: { videos: 2, report: 1 },
});
assert(professionalDeliveryProject.delivery_profile === 'professional_project', 'professional delivery project should keep its profile');
const professionalCycle = await createDeliverySmokeResource('delivery-cycles', {
  client_id: professionalDeliveryClientId,
  project_id: professionalProjectId,
  delivery_project_id: professionalDeliveryProject.delivery_project_id,
  week_start: '2026-08-03',
  week_end: '2026-08-09',
  goals: ['完成两条专业视频', '约客户现场拍摄'],
  target_deliverables: [{ type: 'video', count: 2 }, { type: 'weekly_report', count: 1 }],
});
const activeProfessionalCycle = await patchDeliverySmokeResource('delivery-cycles', professionalCycle.cycle_id, {
  client_id: professionalDeliveryClientId,
  status: 'active',
  status_note: '本周项目启动',
});
assert(activeProfessionalCycle.status === 'active' && activeProfessionalCycle.status_events.length === 2, 'delivery cycle should record valid status transitions');
const professionalTask = await createDeliverySmokeResource('collaboration-tasks', {
  client_id: professionalDeliveryClientId,
  project_id: professionalProjectId,
  delivery_project_id: professionalDeliveryProject.delivery_project_id,
  cycle_id: professionalCycle.cycle_id,
  task_type: 'technical_review',
  title: 'V2 脚本技术审核',
  description: '确认术语、口径和现场可拍内容',
  assignee_role: 'technical_reviewer',
  deadline: '2026-08-05',
});
const plannedProfessionalTask = await patchDeliverySmokeResource('collaboration-tasks', professionalTask.collaboration_task_id, {
  client_id: professionalDeliveryClientId,
  status: 'planned',
});
assert(plannedProfessionalTask.status === 'planned', 'collaboration task should enter planned');
const clientAnnotatedTask = await patchDeliverySmokeResource('collaboration-tasks', professionalTask.collaboration_task_id, {
  client_id: professionalDeliveryClientId,
  actor_role: 'client_reviewer',
  actor_name: '客户审核人',
  client_feedback: '术语已确认，现场补拍设备操作镜头',
});
assert(clientAnnotatedTask.client_feedback.includes('现场补拍'), 'client reviewer should be able to write client feedback');
const forbiddenClientUpdate = await handler(internalRequest('PATCH', `collaboration-tasks/${encodeURIComponent(professionalTask.collaboration_task_id)}`, {
  client_id: professionalDeliveryClientId,
  actor_role: 'client_reviewer',
  internal_notes: '客户不应修改内部备注',
}));
assert(forbiddenClientUpdate.status === 400, 'field ownership should reject client changes to internal notes');
const professionalApproval = await createDeliverySmokeResource('collaboration-approvals', {
  client_id: professionalDeliveryClientId,
  project_id: professionalProjectId,
  delivery_project_id: professionalDeliveryProject.delivery_project_id,
  cycle_id: professionalCycle.cycle_id,
  task_id: professionalTask.collaboration_task_id,
  approval_type: 'technical_review',
  reviewer_role: 'technical_reviewer',
  reviewer_name: '技术审核人',
});
const passedProfessionalApproval = await patchDeliverySmokeResource('collaboration-approvals', professionalApproval.approval_id, {
  client_id: professionalDeliveryClientId,
  status: 'passed',
  notes: '术语和合规表述通过',
});
assert(passedProfessionalApproval.status === 'passed' && passedProfessionalApproval.decided_at, 'approval should record its decision time');
const professionalShooting = await createDeliverySmokeResource('shooting-schedules', {
  client_id: professionalDeliveryClientId,
  project_id: professionalProjectId,
  delivery_project_id: professionalDeliveryProject.delivery_project_id,
  cycle_id: professionalCycle.cycle_id,
  task_id: professionalTask.collaboration_task_id,
  proposed_slots: ['2026-08-06 14:00', '2026-08-07 10:00'],
  location: '客户现场',
  scenes: ['检测设备操作', '工程师讲解'],
  asset_checklist: ['设备全景', '操作特写', '工程师口播'],
});
const confirmedProfessionalShooting = await patchDeliverySmokeResource('shooting-schedules', professionalShooting.shooting_schedule_id, {
  client_id: professionalDeliveryClientId,
  status: 'confirmed',
  confirmed_at: '2026-08-06 14:00',
});
assert(confirmedProfessionalShooting.status === 'confirmed', 'shooting schedule should support client-confirmed slots');
const professionalReport = await createDeliverySmokeResource('weekly-reports', {
  client_id: professionalDeliveryClientId,
  project_id: professionalProjectId,
  delivery_project_id: professionalDeliveryProject.delivery_project_id,
  cycle_id: professionalCycle.cycle_id,
  title: '安标检测 2026-08-03 至 2026-08-09 周报',
  completed_items: ['V2 脚本技术审核完成'],
  next_week_tasks: ['现场拍摄', '完成两条视频'],
  client_actions: ['确认拍摄联系人'],
  metrics: { completed_scripts: 1, planned_videos: 2 },
});
assert(professionalReport.status === 'draft', 'weekly report should start as draft');
const professionalFeishuBinding = await createDeliverySmokeResource('delivery-feishu-bindings', {
  client_id: professionalDeliveryClientId,
  project_id: professionalProjectId,
  delivery_project_id: professionalDeliveryProject.delivery_project_id,
  workspace_url: 'https://example.feishu.cn/base/anbiao',
  base_app_token: 'app-token-placeholder',
  tables: { tasks: 'tblTasks', approvals: 'tblApprovals', weekly_reports: 'tblReports' },
  sync_mode: 'binding_only',
});
assert(professionalFeishuBinding.sync_mode === 'binding_only' && !professionalFeishuBinding.cycle_id, 'P0 Feishu binding should stay project-scoped and not perform sync');
const forbiddenFeishuSyncMode = await handler(internalRequest('PATCH', `delivery-feishu-bindings/${encodeURIComponent(professionalFeishuBinding.feishu_binding_id)}`, {
  client_id: professionalDeliveryClientId,
  sync_mode: 'automatic',
}));
assert(forbiddenFeishuSyncMode.status === 400, 'P0 should reject attempts to present a Feishu binding as active synchronization');
const forbiddenDeliveryProfile = await handler(internalRequest('PATCH', `delivery-projects/${encodeURIComponent(professionalDeliveryProject.delivery_project_id)}`, {
  client_id: professionalDeliveryClientId,
  delivery_profile: 'unknown_profile',
}));
assert(forbiddenDeliveryProfile.status === 400, 'delivery projects should reject unknown profile changes');
const invalidCycleRange = await handler(internalRequest('PATCH', `delivery-cycles/${encodeURIComponent(professionalCycle.cycle_id)}`, {
  client_id: professionalDeliveryClientId,
  week_start: '2026-08-10',
  week_end: '2026-08-09',
}));
assert(invalidCycleRange.status === 400, 'delivery cycles should reject an inverted date range on update');
const forbiddenSystemIdUpdate = await handler(internalRequest('PATCH', `collaboration-tasks/${encodeURIComponent(professionalTask.collaboration_task_id)}`, {
  client_id: professionalDeliveryClientId,
  collaboration_task_id: 'replacement-id',
}));
assert(forbiddenSystemIdUpdate.status === 400, 'delivery resources should reject changes to system-owned IDs');
const professionalTaskList = await (await handler(internalRequest('GET', `collaboration-tasks?client_id=${professionalDeliveryClientId}&project_id=${professionalProjectId}&cycle_id=${professionalCycle.cycle_id}`))).json();
assert(professionalTaskList.tasks.length === 1 && professionalTaskList.storage_key === `collaboration-tasks/${professionalDeliveryClientId}`, 'collaboration task list should be client-scoped and use an independent blob key');
const professionalStateAfter = await (await handler(request('GET', `state?client_id=${professionalDeliveryClientId}`))).json();
assert(JSON.stringify(professionalStateAfter.project_store) === JSON.stringify(professionalStateBefore.project_store), 'P0 delivery records must not mutate the existing project_store');

const localDeliveryClientId = 'delivery-p0-local-growth';
const localProjectId = 'project-yimeideer-p0';
const localDeliveryProject = await createDeliverySmokeResource('delivery-projects', {
  client_id: localDeliveryClientId,
  project_id: localProjectId,
  project_name: '伊美德儿持续增长运营',
  client_name: '伊美德儿',
  delivery_profile: 'local_growth_operation',
});
const localCycle = await createDeliverySmokeResource('delivery-cycles', {
  client_id: localDeliveryClientId,
  project_id: localProjectId,
  delivery_project_id: localDeliveryProject.delivery_project_id,
  week_start: '2026-08-03',
  week_end: '2026-08-09',
  goals: ['发布内容并记录咨询与预约'],
});
const localTask = await createDeliverySmokeResource('collaboration-tasks', {
  client_id: localDeliveryClientId,
  project_id: localProjectId,
  delivery_project_id: localDeliveryProject.delivery_project_id,
  cycle_id: localCycle.cycle_id,
  task_type: 'content_production',
  title: '本周门店内容制作',
});
const invalidTaskTransition = await handler(internalRequest('PATCH', `collaboration-tasks/${encodeURIComponent(localTask.collaboration_task_id)}`, {
  client_id: localDeliveryClientId,
  status: 'completed',
}));
assert(invalidTaskTransition.status === 400, 'delivery status machine should reject draft-to-completed shortcuts');
const localTaskList = await (await handler(internalRequest('GET', `collaboration-tasks?client_id=${localDeliveryClientId}`))).json();
assert(localTaskList.tasks.length === 1 && localTaskList.tasks[0].delivery_profile === 'local_growth_operation', 'local growth profile should keep its own collaboration task');
const crossClientTaskList = await (await handler(internalRequest('GET', `collaboration-tasks?client_id=${localDeliveryClientId}&project_id=${professionalProjectId}`))).json();
assert(crossClientTaskList.tasks.length === 0, 'delivery collections must not expose another client project');
const missingDeliveryOwnership = await handler(internalRequest('POST', 'collaboration-tasks', {
  client_id: localDeliveryClientId,
  title: '缺少归属的任务',
}));
assert(missingDeliveryOwnership.status === 400, 'delivery task creation should reject missing project/cycle ownership');
const customersInternalGet = await handler(internalRequest('GET', 'customers?mode=internal'));
assert(customersInternalGet.status === 200, `authorized GET /customers should succeed, got ${customersInternalGet.status}`);
const customersBearerGet = await handler(request('GET', 'customers', undefined, { headers: { authorization: `Bearer ${INTERNAL_ACCESS_TOKEN}` } }));
assert(customersBearerGet.status === 200, 'Authorization Bearer token should also authorize internal endpoints');
const customersInternal = await customersInternalGet.json();
assert(Array.isArray(customersInternal.customers), 'GET /customers should return a customers array');
assert(customersInternal.readonly === true, 'GET /customers must explicitly be readonly');
assert(customersInternal.grouped === true, 'GET /customers should return grouped customer records');
assert(customersInternal.customers.some((item) => item.primary_client_id === 'dental' && item.names.includes('社区口腔门诊')), 'GET /customers should aggregate the dental customer from its own blob key');
const ziwuxianGroup = customersInternal.customers.find((item) => item.display_name === '子武限武术搏击俱乐部');
assert(ziwuxianGroup && ziwuxianGroup.records.length === 3 && ziwuxianGroup.primary_client_id === 'anonymous-mqbrw6q8-q6nkmw', 'GET /customers should group duplicate ziwuxian clients and pick the newest primary_client_id');
const basketballGroup = customersInternal.customers.find((item) => item.display_name === '中傲少儿篮球训练营');
assert(basketballGroup && basketballGroup.records.length === 2 && basketballGroup.primary_client_id === 'basketball', 'GET /customers should group duplicate basketball clients into one visible customer');
const floristGroup = customersInternal.customers.find((item) => item.display_name === '清屿花艺工作室');
assert(floristGroup?.is_test === true, '清屿花艺 should remain folded as test/demo group');
assert(!customersInternal.customers.some((item) => item.records?.some((record) => String(record.client_id).startsWith('qa-'))), 'GET /customers should filter qa/probe customer keys from the operations list');
const ziwuxianPreviewGet = await handler(internalRequest('GET', 'customers/merge-preview?mode=internal&display_name=' + encodeURIComponent('子武限武术搏击俱乐部')));
assert(ziwuxianPreviewGet.status === 200, `GET /customers/merge-preview should succeed, got ${ziwuxianPreviewGet.status}`);
const ziwuxianPreview = await ziwuxianPreviewGet.json();
assert(ziwuxianPreview.dry_run === true && ziwuxianPreview.readonly === true && ziwuxianPreview.would_write === false, 'merge preview must be dry-run and readonly');
assert(ziwuxianPreview.source_client_ids.length === 3 && ziwuxianPreview.backup_plan.required === true, 'merge preview should include source keys and backup plan');
const customersAfterPreview = await (await handler(internalRequest('GET', 'customers?mode=internal'))).json();
const ziwuxianAfterPreview = customersAfterPreview.customers.find((item) => item.display_name === '子武限武术搏击俱乐部');
assert(ziwuxianAfterPreview?.records.length === 3, 'merge preview must not mutate or merge customer blob records');
const floristStateGet = await handler(request('GET', 'state?client_id=florist'));
assert(floristStateGet.status === 200, 'the originating browser access token should read its own customer state');
const floristState = await floristStateGet.json();
assert(!floristState.project_store.projects.some((item) => item.id === 'project-dental'), 'GET /state?client_id=florist must not return dental project store');
const floristStateWithoutToken = await handler(request('GET', 'state?client_id=florist', undefined, { customerAccess: false }));
assert(floristStateWithoutToken.status === 401, 'GET /state with only a naked client_id must be rejected');
const floristStateWithWrongToken = await handler(request('GET', 'state?client_id=florist', undefined, {
  headers: { 'x-customer-access-token': 'smoke-customer-access-wrong-browser' },
}));
assert(floristStateWithWrongToken.status === 401, 'GET /state with another browser token must be rejected');
const floristShareCreate = await handler(request('POST', 'customer-shares', {
  client_id: 'florist',
  project_id: 'project-florist',
}));
assert(floristShareCreate.status === 201, 'POST /customer-shares should create a scoped project save link for the owner');
const floristShare = await floristShareCreate.json();
assert(/^share_[a-z0-9]+$/i.test(floristShare.share_token || ''), 'customer share should return an opaque share token');
const floristShareRead = await handler(request('GET', `customer-shares/${encodeURIComponent(floristShare.share_token)}`));
assert(floristShareRead.status === 200, 'GET /customer-shares/:token should restore the shared project without exposing a client id in the URL');
const floristShareState = await floristShareRead.json();
assert(floristShareState.project_store.projects.length === 1 && floristShareState.project_store.projects[0]?.id === 'project-florist', 'customer share should be restricted to one project');
const floristShareSettingsPatch = await handler(request('PATCH', 'user/settings', {
  client_id: 'florist',
  personalized_recommendation_enabled: false,
}, {
  headers: { 'x-customer-share-token': floristShare.share_token },
}));
assert(floristShareSettingsPatch.status === 403, 'an editable project share must not change the owner privacy settings');

process.env.ACCOUNT_AUTH_ENABLED = 'false';
const disabledAccountStart = await handler(request('POST', 'auth/email/start', { email: 'owner@example.com' }));
assert(disabledAccountStart.status === 503, 'disabled account auth must fail closed without affecting the anonymous customer journey');
const disabledAccountSession = await (await handler(request('GET', 'auth/session'))).json();
assert(disabledAccountSession.enabled === false && disabledAccountSession.signed_in === false, 'disabled account auth should expose a safe optional state');
process.env.ACCOUNT_AUTH_ENABLED = 'true';
const unsignedAccountSession = await handler(request('GET', 'auth/session'));
const unsignedAccountSessionData = await unsignedAccountSession.json();
assert(unsignedAccountSession.status === 200 && unsignedAccountSessionData.enabled === true && unsignedAccountSessionData.signed_in === false, 'account session should remain optional and must not create a login wall');
const publicCommercialPlansResponse = await handler(request('GET', 'commercial/plans'));
const publicCommercialPlansData = await publicCommercialPlansResponse.json();
assert(publicCommercialPlansResponse.status === 200 && publicCommercialPlansData.plans?.length === 3, 'public commercial plans should expose Free, Plus and Pro without requiring login');
assert(publicCommercialPlansData.plans.find((plan) => plan.code === 'free')?.trial_strategy_cycles === 3, 'Free should expose the three-cycle introductory entitlement');
assert(publicCommercialPlansData.plans.find((plan) => plan.code === 'plus')?.monthly_price_cny === 299, 'Plus should use the configurable V1 monthly price');
assert(publicCommercialPlansData.pro_invite_only === true, 'Pro should remain invite-only until complete-content production is stable');
const accountStart = await handler(request('POST', 'auth/email/start', { email: 'owner@example.com' }));
const accountStartData = await accountStart.json();
assert(accountStart.status === 202 && /^\d{6}$/.test(accountStartData.test_code || ''), 'test-only email adapter should issue a six-digit verification code');
const repeatedAccountStart = await handler(request('POST', 'auth/email/start', { email: 'owner@example.com' }));
assert(repeatedAccountStart.status === 429, 'email verification requests should be throttled before they can create provider cost or inbox spam');
const wrongAccountVerify = await handler(request('POST', 'auth/email/verify', {
  email: 'owner@example.com',
  code: '000000',
  challenge_id: accountStartData.challenge_id,
}));
assert(wrongAccountVerify.status === 401, 'invalid email verification code must be rejected');
const accountVerify = await handler(request('POST', 'auth/email/verify', {
  email: 'owner@example.com',
  code: accountStartData.test_code,
  challenge_id: accountStartData.challenge_id,
}));
const accountVerifyData = await accountVerify.json();
const accountCookie = String(accountVerify.headers.get('set-cookie') || '').split(';')[0];
assert(accountVerify.status === 200 && accountVerifyData.signed_in === true && accountCookie.startsWith('fp_account_session='), 'verified email should create an opaque HttpOnly account session');
assert(!JSON.stringify(accountVerifyData).includes('owner@example.com'), 'account API must not return or persist the plaintext email identity');
const signedAccountSession = await handler(request('GET', 'auth/session', undefined, { headers: { cookie: accountCookie } }));
const signedAccountSessionData = await signedAccountSession.json();
assert(signedAccountSessionData.signed_in === true && signedAccountSessionData.account?.plan_code === 'free', 'verified session should restore the account without blocking anonymous flows');
const accountLinkFlorist = await handler(request('POST', 'account/link-client', { client_id: 'florist' }, {
  headers: { cookie: accountCookie, 'x-customer-access-token': customerAccessTokenFor('florist') },
}));
const accountLinkFloristData = await accountLinkFlorist.json();
assert(accountLinkFlorist.status === 200 && accountLinkFloristData.client_id === 'florist' && accountLinkFloristData.account?.linked_client_count === 1, 'account binding should require and preserve existing customer ownership proof');
const accountLinkFloristAgain = await handler(request('POST', 'account/link-client', { client_id: 'florist' }, {
  headers: { cookie: accountCookie, 'x-customer-access-token': customerAccessTokenFor('florist') },
}));
assert(accountLinkFloristAgain.status === 200, 'repeating the same account-client binding should be idempotent');
const accountProjects = await handler(request('GET', 'account/projects', undefined, { headers: { cookie: accountCookie } }));
const accountProjectsData = await accountProjects.json();
assert(accountProjects.status === 200 && accountProjectsData.clients?.some((client) => client.client_id === 'florist' && client.projects?.some((project) => project.id === 'project-florist')), 'signed-in account should restore only its linked cloud projects');
const accountEntitlements = await handler(request('GET', 'account/entitlements', undefined, { headers: { cookie: accountCookie } }));
const accountEntitlementsData = await accountEntitlements.json();
assert(accountEntitlements.status === 200 && accountEntitlementsData.entitlement?.plan_code === 'free', 'signed-in account should read only its own Free entitlement snapshot');
assert(accountEntitlementsData.entitlement?.limits?.strategy_cycles === 3 && accountEntitlementsData.entitlement?.period_type === 'trial', 'new Free account should start with the three-cycle introductory period');
assert(!('subject_key' in (accountEntitlementsData.entitlement || {})) && !('account_id' in (accountEntitlementsData.entitlement || {})), 'public entitlement response must not expose storage subjects or account identifiers');
const nakedAccountEntitlements = await handler(request('GET', 'account/entitlements'));
assert(nakedAccountEntitlements.status === 401, 'account entitlement endpoint must require the verified account session');

const nakedReferralDashboard = await handler(request('GET', 'referrals/me'));
assert(nakedReferralDashboard.status === 401, 'referral dashboard must require the verified account session');
const referralOwnerDashboard = await handler(request('GET', 'referrals/me', undefined, { headers: { cookie: accountCookie } }));
const referralOwnerDashboardData = await referralOwnerDashboard.json();
const referralCode = String(referralOwnerDashboardData.referral?.invite_code || '');
assert(referralOwnerDashboard.status === 200 && /^fp_[a-z0-9]{20}$/i.test(referralCode), 'signed-in account should receive an opaque, server-owned referral code');
assert(referralOwnerDashboardData.referral?.reward_days_per_friend === 7 && referralOwnerDashboardData.referral?.monthly_max_reward_days === 28, 'referral program should expose the reviewed 7-day reward and 28-day monthly cap');

const invitedAccountStart = await handler(request('POST', 'auth/email/start', { email: 'invited-friend@example.com' }));
const invitedAccountStartData = await invitedAccountStart.json();
const invitedAccountVerify = await handler(request('POST', 'auth/email/verify', {
  email: 'invited-friend@example.com',
  code: invitedAccountStartData.test_code,
  challenge_id: invitedAccountStartData.challenge_id,
  referral_code: referralCode,
}));
const invitedAccountVerifyData = await invitedAccountVerify.json();
const invitedAccountCookie = String(invitedAccountVerify.headers.get('set-cookie') || '').split(';')[0];
assert(invitedAccountVerify.status === 200 && invitedAccountVerifyData.referral_attribution?.status === 'pending', 'a new verified account should create a pending referral attribution without granting an early reward');
const pendingReferralDashboard = await handler(request('GET', 'referrals/me', undefined, { headers: { cookie: accountCookie } }));
const pendingReferralDashboardData = await pendingReferralDashboard.json();
assert(pendingReferralDashboardData.referral?.summary?.pending_count === 1 && pendingReferralDashboardData.referral?.summary?.total_reward_days === 0, 'opening and registering from an invite must not reward before the first successful plan');

let referralPlanPromise = null;
const referralClientId = 'referral-first-plan';
const referralPlanPayload = {
  ...payload,
  client_id: referralClientId,
  customer_key: referralClientId,
  request_id: 'referral-first-plan-request-0001',
};
const referralPlanResponse = await handler(request('POST', 'plan-jobs', referralPlanPayload, {
  headers: { cookie: invitedAccountCookie, 'x-customer-access-token': customerAccessTokenFor(referralClientId) },
}), {
  waitUntil(promise) { referralPlanPromise = promise; },
});
assert(referralPlanResponse.status === 202 && referralPlanPromise, 'the invited account first plan should queue normally before referral settlement');
await referralPlanPromise;
const rewardedReferralDashboard = await handler(request('GET', 'referrals/me', undefined, { headers: { cookie: accountCookie } }));
const rewardedReferralDashboardData = await rewardedReferralDashboard.json();
assert(rewardedReferralDashboardData.referral?.summary?.rewarded_count === 1 && rewardedReferralDashboardData.referral?.summary?.total_reward_days === 7, 'first successful plan should settle exactly one seven-day referral reward');
assert(!JSON.stringify(rewardedReferralDashboardData).includes('invited-friend@example.com') && !JSON.stringify(rewardedReferralDashboardData).includes('acct_'), 'referral dashboard must not reveal invitee email or internal account identifiers');
const rewardedOwnerEntitlements = await handler(request('GET', 'account/entitlements', undefined, { headers: { cookie: accountCookie } }));
const rewardedOwnerEntitlementsData = await rewardedOwnerEntitlements.json();
assert(rewardedOwnerEntitlementsData.entitlement?.plan_code === 'plus' && rewardedOwnerEntitlementsData.entitlement?.referral_bonus_days === 7 && rewardedOwnerEntitlementsData.entitlement?.access_ends_at, 'a Free inviter should receive a visible seven-day temporary Plus entitlement after an effective invitation');
const duplicateReferralPlan = await handler(request('POST', 'plan-jobs', referralPlanPayload, {
  headers: { cookie: invitedAccountCookie, 'x-customer-access-token': customerAccessTokenFor(referralClientId) },
}), { waitUntil() {} });
assert(duplicateReferralPlan.status === 202, 'retrying the invited friend plan request should remain idempotent');
const referralAfterRetry = await (await handler(request('GET', 'referrals/me', undefined, { headers: { cookie: accountCookie } }))).json();
assert(referralAfterRetry.referral?.summary?.total_reward_days === 7, 'network retries must not grant the same referral reward twice');

process.env.COMMERCIALIZATION_ENABLED = 'true';
process.env.FREE_TRIAL_STRATEGY_CYCLES = '1';
process.env.FREE_DAILY_GENERATIONS = '10';
let quotaPlanPromise = null;
const quotaPlanPayload = {
  ...payload,
  client_id: 'commercial-quota-owner',
  customer_key: 'commercial-quota-owner',
  request_id: 'commercial-quota-request-0001',
};
const firstQuotaPlan = await handler(request('POST', 'plan-jobs', quotaPlanPayload), {
  waitUntil(promise) { quotaPlanPromise = promise; },
});
assert(firstQuotaPlan.status === 202 && quotaPlanPromise, 'first Free strategy cycle should reserve quota and queue normally');
const duplicateQuotaPlan = await handler(request('POST', 'plan-jobs', quotaPlanPayload), { waitUntil() {} });
assert(duplicateQuotaPlan.status === 202, 'retrying the same request_id must reuse the reservation without consuming quota twice');
const exceededQuotaPlan = await handler(request('POST', 'plan-jobs', {
  ...quotaPlanPayload,
  request_id: 'commercial-quota-request-0002',
}), { waitUntil() {} });
const exceededQuotaPlanData = await exceededQuotaPlan.json();
assert(exceededQuotaPlan.status === 429 && exceededQuotaPlanData.code === 'quota_exceeded', 'a second unique Free strategy cycle should be blocked when commercial enforcement is enabled');
assert(exceededQuotaPlanData.error === '本月生成额度已用完' && exceededQuotaPlanData.plan_url === '/plans', 'quota response should use customer language and preserve a clear plan entry');
await quotaPlanPromise;
process.env.COMMERCIALIZATION_ENABLED = 'false';
delete process.env.FREE_TRIAL_STRATEGY_CYCLES;
delete process.env.FREE_DAILY_GENERATIONS;
const accountRestoredFloristState = await handler(request('GET', 'state?client_id=florist', undefined, {
  customerAccess: false,
  headers: { cookie: accountCookie },
}));
assert(accountRestoredFloristState.status === 200, 'a verified account session should restore its linked project without the original browser access token');
const accountDeniedDentalState = await handler(request('GET', 'state?client_id=dental', undefined, {
  customerAccess: false,
  headers: { cookie: accountCookie },
}));
assert(accountDeniedDentalState.status === 401, 'an account session must not read an unlinked customer bucket');
const nakedAccountProjects = await handler(request('GET', 'account/projects'));
assert(nakedAccountProjects.status === 401, 'account projects must not accept a naked account_id or unauthenticated request');

const secondAccountStart = await handler(request('POST', 'auth/email/start', { email: 'other@example.com' }));
const secondAccountStartData = await secondAccountStart.json();
const secondAccountVerify = await handler(request('POST', 'auth/email/verify', {
  email: 'other@example.com',
  code: secondAccountStartData.test_code,
  challenge_id: secondAccountStartData.challenge_id,
}));
const secondAccountCookie = String(secondAccountVerify.headers.get('set-cookie') || '').split(';')[0];
const crossAccountLink = await handler(request('POST', 'account/link-client', { client_id: 'florist' }, {
  headers: { cookie: secondAccountCookie, 'x-customer-access-token': customerAccessTokenFor('florist') },
}));
assert(crossAccountLink.status === 409, 'a client bucket already owned by one account must not be rebound to another account');
const secondAccountProjects = await handler(request('GET', 'account/projects', undefined, { headers: { cookie: secondAccountCookie } }));
const secondAccountProjectsData = await secondAccountProjects.json();
assert(secondAccountProjects.status === 200 && secondAccountProjectsData.clients?.length === 0, 'account project listing must remain isolated per verified account');
const secondAccountFloristState = await handler(request('GET', 'state?client_id=florist', undefined, {
  customerAccess: false,
  headers: { cookie: secondAccountCookie },
}));
assert(secondAccountFloristState.status === 401, 'another verified account must not restore a customer bucket it does not own');

const nakedBillingOrders = await handler(request('GET', 'billing/orders'));
assert(nakedBillingOrders.status === 401, 'billing order list must require a verified account session');
const nakedBillingCreate = await handler(request('POST', 'billing/orders', {
  plan_code: 'plus',
  billing_interval: 'month',
  idempotency_key: 'billing-naked-request-0001',
}));
assert(nakedBillingCreate.status === 401, 'billing order creation must require a verified account session');
const billingAccountStart = await handler(request('POST', 'auth/email/start', { email: 'billing-owner@example.com' }));
const billingAccountStartData = await billingAccountStart.json();
const billingAccountVerify = await handler(request('POST', 'auth/email/verify', {
  email: 'billing-owner@example.com',
  code: billingAccountStartData.test_code,
  challenge_id: billingAccountStartData.challenge_id,
}));
const billingAccountCookie = String(billingAccountVerify.headers.get('set-cookie') || '').split(';')[0];
assert(billingAccountVerify.status === 200 && billingAccountCookie.startsWith('fp_account_session='), 'billing test account should receive an isolated verified session');
const invalidBillingInterval = await handler(request('POST', 'billing/orders', {
  plan_code: 'plus',
  billing_interval: 'quarter',
  idempotency_key: 'billing-invalid-period-0001',
}, { headers: { cookie: billingAccountCookie } }));
assert(invalidBillingInterval.status === 400, 'billing order must reject an unsupported period instead of silently changing the customer choice');
const inviteOnlyProOrder = await handler(request('POST', 'billing/orders', {
  plan_code: 'pro',
  billing_interval: 'month',
  idempotency_key: 'billing-pro-request-0001',
}, { headers: { cookie: billingAccountCookie } }));
assert(inviteOnlyProOrder.status === 400, 'public checkout must not bypass the Pro invite-only gate');
const billingCreatePayload = {
  plan_code: 'plus',
  billing_interval: 'month',
  idempotency_key: 'billing-plus-month-request-0001',
};
const billingCreate = await handler(request('POST', 'billing/orders', billingCreatePayload, {
  headers: { cookie: billingAccountCookie },
}));
const billingCreateData = await billingCreate.json();
const paidOrderId = String(billingCreateData.order?.order_id || '');
assert(billingCreate.status === 201 && /^order_[a-z0-9]+$/i.test(paidOrderId), 'signed-in customer should create a server-owned Plus order');
assert(billingCreateData.order?.amount_cny === 299 && billingCreateData.order?.currency === 'CNY' && billingCreateData.order?.status === 'pending_payment', 'public order should use the server price and start pending payment');
assert(billingCreateData.order?.payment_mode === 'manual_review' && billingCreateData.order?.payment?.contact_email === 'contact@fpmatrix.cn', 'P1 order should honestly expose the manual confirmation path');
assert(!('account_id' in billingCreateData.order) && !('amount_fen' in billingCreateData.order) && !('payment_reference' in billingCreateData.order), 'public order must hide account, settlement and internal payment fields');
const duplicateBillingCreate = await handler(request('POST', 'billing/orders', billingCreatePayload, {
  headers: { cookie: billingAccountCookie },
}));
const duplicateBillingCreateData = await duplicateBillingCreate.json();
assert(duplicateBillingCreate.status === 200 && duplicateBillingCreateData.duplicate === true && duplicateBillingCreateData.order?.order_id === paidOrderId, 'network retry must reuse the idempotent order instead of creating another charge intent');
const ownBillingOrders = await handler(request('GET', 'billing/orders', undefined, { headers: { cookie: billingAccountCookie } }));
const ownBillingOrdersData = await ownBillingOrders.json();
assert(ownBillingOrders.status === 200 && ownBillingOrdersData.orders?.filter((order) => order.order_id === paidOrderId).length === 1, 'customer order history should contain exactly one idempotent order');
const crossAccountBillingRead = await handler(request('GET', `billing/orders/${paidOrderId}`, undefined, { headers: { cookie: secondAccountCookie } }));
assert(crossAccountBillingRead.status === 404, 'one account must not discover another account order');
const nakedInternalBillingOrders = await handler(request('GET', 'internal/billing/orders'));
assert(nakedInternalBillingOrders.status === 401, 'commercial operations order list must require internal access');
const internalBillingOrders = await handler(internalRequest('GET', 'internal/billing/orders?status=pending_payment'));
const internalBillingOrdersData = await internalBillingOrders.json();
assert(internalBillingOrders.status === 200 && internalBillingOrdersData.orders?.some((order) => order.order_id === paidOrderId && order.account_reference), 'internal operator should see pending orders with a non-PII account reference');
const mismatchedBillingConfirmation = await handler(internalRequest('POST', `internal/billing/orders/${paidOrderId}/confirm`, {
  payment_reference: 'smoke-payment-mismatch',
  amount_fen: 1,
}));
assert(mismatchedBillingConfirmation.status === 400, 'operator confirmation must reject a mismatched received amount');
const billingConfirmation = await handler(internalRequest('POST', `internal/billing/orders/${paidOrderId}/confirm`, {
  payment_reference: 'smoke-payment-reference-0001',
  amount_fen: 29900,
  operator_note: 'smoke test confirmed receipt',
}));
const billingConfirmationData = await billingConfirmation.json();
assert(billingConfirmation.status === 200 && billingConfirmationData.order?.status === 'paid' && billingConfirmationData.order?.subscription_ends_at, 'internal receipt confirmation should mark the order paid and activate subscription access');
const firstSubscriptionEnd = billingConfirmationData.order.subscription_ends_at;
const duplicateBillingConfirmation = await handler(internalRequest('POST', `internal/billing/orders/${paidOrderId}/confirm`, {
  payment_reference: 'smoke-payment-reference-0001-retry',
  amount_fen: 29900,
}));
const duplicateBillingConfirmationData = await duplicateBillingConfirmation.json();
assert(duplicateBillingConfirmation.status === 200 && duplicateBillingConfirmationData.duplicate === true && duplicateBillingConfirmationData.order?.subscription_ends_at === firstSubscriptionEnd, 'repeating payment confirmation must not extend the same subscription twice');
const paidBillingEntitlement = await handler(request('GET', 'account/entitlements', undefined, { headers: { cookie: billingAccountCookie } }));
const paidBillingEntitlementData = await paidBillingEntitlement.json();
assert(paidBillingEntitlement.status === 200 && paidBillingEntitlementData.entitlement?.plan_code === 'plus' && paidBillingEntitlementData.entitlement?.access_ends_at === firstSubscriptionEnd, 'paid account should immediately receive the Plus entitlement returned by its own session');
const cancelOrderCreate = await handler(request('POST', 'billing/orders', {
  plan_code: 'plus',
  billing_interval: 'year',
  idempotency_key: 'billing-plus-year-request-0001',
}, { headers: { cookie: billingAccountCookie } }));
const cancelOrderCreateData = await cancelOrderCreate.json();
const canceledOrderId = String(cancelOrderCreateData.order?.order_id || '');
const cancelBillingOrderResponse = await handler(request('POST', `billing/orders/${canceledOrderId}/cancel`, undefined, { headers: { cookie: billingAccountCookie } }));
const cancelBillingOrderData = await cancelBillingOrderResponse.json();
assert(cancelBillingOrderResponse.status === 200 && cancelBillingOrderData.order?.status === 'canceled', 'customer should be able to cancel an unpaid order without changing active access');
const cancelBillingOrderAgain = await handler(request('POST', `billing/orders/${canceledOrderId}/cancel`, undefined, { headers: { cookie: billingAccountCookie } }));
assert(cancelBillingOrderAgain.status === 200, 'canceling the same unpaid order twice should be idempotent');

const paymentP1OrderCreate = await handler(request('POST', 'billing/orders', {
  plan_code: 'plus',
  billing_interval: 'month',
  idempotency_key: 'billing-payment-p1-order-0001',
}, { headers: { cookie: billingAccountCookie } }));
const paymentP1OrderData = await paymentP1OrderCreate.json();
const paymentP1OrderId = String(paymentP1OrderData.order?.order_id || '');
assert(paymentP1OrderCreate.status === 201 && paymentP1OrderId, 'payment P1 test requires a new pending order');
const nakedPaymentIntentCreate = await handler(request('POST', `internal/billing/orders/${paymentP1OrderId}/payment-intents`, {
  provider: 'wechat_pay',
  idempotency_key: 'payment-p1-naked-request-0001',
}));
assert(nakedPaymentIntentCreate.status === 401, 'payment intent creation must require internal access');
const paymentIntentCreatePayload = {
  provider: 'wechat_pay',
  idempotency_key: 'payment-p1-intent-request-0001',
};
const paymentIntentCreate = await handler(internalRequest('POST', `internal/billing/orders/${paymentP1OrderId}/payment-intents`, paymentIntentCreatePayload));
const paymentIntentCreateData = await paymentIntentCreate.json();
const paymentP1Id = String(paymentIntentCreateData.payment?.payment_id || '');
assert(paymentIntentCreate.status === 201 && /^pay_[a-z0-9]+$/i.test(paymentP1Id), 'internal P1 should create a server-owned payment intent');
assert(paymentIntentCreateData.payment?.mode === 'sandbox_mock' && paymentIntentCreateData.payment?.status === 'created' && paymentIntentCreateData.payment?.amount_fen === 29900, 'P1 must only use an explicit sandbox mock and preserve the locked order amount');
const duplicatePaymentIntentCreate = await handler(internalRequest('POST', `internal/billing/orders/${paymentP1OrderId}/payment-intents`, paymentIntentCreatePayload));
const duplicatePaymentIntentCreateData = await duplicatePaymentIntentCreate.json();
assert(duplicatePaymentIntentCreate.status === 200 && duplicatePaymentIntentCreateData.duplicate === true && duplicatePaymentIntentCreateData.payment?.payment_id === paymentP1Id, 'payment intent retries must reuse the idempotent payment intent');
const internalPaymentsForOrder = await handler(internalRequest('GET', `internal/billing/payments?order_id=${encodeURIComponent(paymentP1OrderId)}`));
const internalPaymentsForOrderData = await internalPaymentsForOrder.json();
assert(internalPaymentsForOrder.status === 200 && internalPaymentsForOrderData.payments?.length === 1 && internalPaymentsForOrderData.payments[0]?.payment_id === paymentP1Id, 'internal payment list should return only the requested order payment intents');
const publicPaymentNotificationDenied = await handler(request('POST', 'payments/wechat_pay/notify', {
  event_id: 'sandbox-payment-event-denied-0001',
  payment_id: paymentP1Id,
  amount_fen: 29900,
  trade_state: 'SUCCESS',
}));
assert(publicPaymentNotificationDenied.status === 401, 'payment callback must reject missing sandbox/provider authentication');
const mismatchedPaymentNotification = await handler(request('POST', 'payments/wechat_pay/notify', {
  event_id: 'sandbox-payment-event-mismatch-0001',
  payment_id: paymentP1Id,
  amount_fen: 1,
  trade_state: 'SUCCESS',
}, { headers: { 'x-payment-sandbox-token': process.env.PAYMENT_P1_SANDBOX_TOKEN } }));
assert(mismatchedPaymentNotification.status === 400, 'payment callback must reject an amount that does not match the server-owned order');
const paymentNotification = await handler(request('POST', 'payments/wechat_pay/notify', {
  event_id: 'sandbox-payment-event-success-0001',
  payment_id: paymentP1Id,
  amount_fen: 29900,
  trade_state: 'SUCCESS',
  provider_transaction_id: 'sandbox-wechat-transaction-0001',
}, { headers: { 'x-payment-sandbox-token': process.env.PAYMENT_P1_SANDBOX_TOKEN } }));
const paymentNotificationData = await paymentNotification.json();
assert(paymentNotification.status === 200 && paymentNotificationData.received === true && paymentNotificationData.duplicate === false, 'signed sandbox callback should activate the matching payment exactly once');
const duplicatePaymentNotification = await handler(request('POST', 'payments/wechat_pay/notify', {
  event_id: 'sandbox-payment-event-success-0001',
  payment_id: paymentP1Id,
  amount_fen: 29900,
  trade_state: 'SUCCESS',
  provider_transaction_id: 'sandbox-wechat-transaction-0001',
}, { headers: { 'x-payment-sandbox-token': process.env.PAYMENT_P1_SANDBOX_TOKEN } }));
const duplicatePaymentNotificationData = await duplicatePaymentNotification.json();
assert(duplicatePaymentNotification.status === 200 && duplicatePaymentNotificationData.duplicate === true, 'duplicate payment callbacks must not activate entitlement twice');
const paymentP1Detail = await handler(internalRequest('GET', `internal/billing/payments/${paymentP1Id}`));
const paymentP1DetailData = await paymentP1Detail.json();
assert(paymentP1Detail.status === 200 && paymentP1DetailData.payment?.status === 'succeeded' && paymentP1DetailData.payment?.provider_transaction_id === 'sandbox-wechat-transaction-0001', 'internal payment detail should retain provider settlement evidence without exposing it publicly');
const publicPaymentP1Order = await handler(request('GET', `billing/orders/${paymentP1OrderId}`, undefined, { headers: { cookie: billingAccountCookie } }));
const publicPaymentP1OrderData = await publicPaymentP1Order.json();
assert(publicPaymentP1Order.status === 200 && publicPaymentP1OrderData.order?.status === 'paid' && !('payment_intent_id' in publicPaymentP1OrderData.order) && !('payment_reference' in publicPaymentP1OrderData.order), 'customer order response must not expose internal payment identifiers or settlement references');
const refundRequest = await handler(internalRequest('POST', `internal/billing/payments/${paymentP1Id}/refunds`, { reason: 'P1 sandbox refund workflow verification' }));
const refundRequestData = await refundRequest.json();
assert(refundRequest.status === 201 && refundRequestData.refund?.status === 'requested' && refundRequestData.payment?.refund_status === 'requested', 'P1 refund endpoint must create an auditable request without simulating a provider refund');
const reconciliation = await handler(internalRequest('GET', 'internal/billing/reconciliation'));
const reconciliationData = await reconciliation.json();
assert(reconciliation.status === 200 && reconciliationData.reconciliation?.mode === 'internal_skeleton' && reconciliationData.reconciliation?.total_payment_intents >= 1, 'internal reconciliation skeleton should report payment intent state without calling an external provider');

const accountLogout = await handler(request('POST', 'auth/logout', undefined, { headers: { cookie: accountCookie } }));
assert(accountLogout.status === 200 && String(accountLogout.headers.get('set-cookie') || '').includes('Max-Age=0'), 'logout should revoke the server session and clear the browser cookie');
const revokedAccountSession = await handler(request('GET', 'auth/session', undefined, { headers: { cookie: accountCookie } }));
const revokedAccountSessionData = await revokedAccountSession.json();
assert(revokedAccountSessionData.signed_in === false, 'revoked account session must not restore access');

const expiredLegacyClientId = 'legacy-expired-claim';
const expiredLegacyProject = {
  id: 'project-legacy-expired-claim',
  name: '旧浏览器迁移验证项目',
  updated_at: '2026-08-08 12:00:00',
  state: {
    assessment: {
      industry: '本地服务门店',
      main_goal: '获得更多咨询',
      target_customer: '附近客户',
    },
    diagnosis: { summary: '旧项目迁移验证' },
    plans: [{ id: 'legacy-plan-1', topic: '附近客户最关心的3个问题' }],
  },
};
const expiredLegacyStore = {
  activeProjectId: expiredLegacyProject.id,
  lastActiveProjectId: null,
  projects: [expiredLegacyProject],
};
const expiredLegacySeed = await handler(internalRequest('POST', 'state', {
  client_id: expiredLegacyClientId,
  project_store: expiredLegacyStore,
}));
assert(expiredLegacySeed.status === 201, 'internal migration setup should seed a legacy project without claiming a customer browser token');
const expiredLegacySeedRead = await (await handler(internalRequest('GET', `state?client_id=${expiredLegacyClientId}`))).json();
assert(expiredLegacySeedRead.project_store.projects.some((item) => item.id === expiredLegacyProject.id), `legacy migration setup must be readable before testing claim expiry: ${JSON.stringify(expiredLegacySeedRead.project_store.projects)}`);
const expiredLegacyProofInput = JSON.stringify({
  id: expiredLegacyProject.id,
  name: expiredLegacyProject.name,
  industry: expiredLegacyProject.state.assessment.industry,
  main_goal: expiredLegacyProject.state.assessment.main_goal,
  target_customer: expiredLegacyProject.state.assessment.target_customer,
  plan_topics: [['legacy-plan-1', '附近客户最关心的3个问题']],
});
const expiredLegacyProof = createHash('sha256').update(expiredLegacyProofInput).digest('hex');
process.env.CUSTOMER_LEGACY_CLAIM_UNTIL = 'disabled';
const expiredLegacyClaim = await handler(request('POST', 'state', {
  client_id: expiredLegacyClientId,
  project_store: expiredLegacyStore,
  legacy_state_proof: expiredLegacyProof,
}));
assert(expiredLegacyClaim.status === 401, `legacy project proof must stop working after the configured migration deadline, got ${expiredLegacyClaim.status}`);
process.env.CUSTOMER_LEGACY_CLAIM_UNTIL = '2099-12-31T23:59:59.999Z';
const anonymousInternalStateGet = await handler(request('GET', 'state?client_id=internal&mode=internal'));
assert(anonymousInternalStateGet.status === 401, 'anonymous GET /state for the internal bucket must be rejected');
const anonymousInternalStatePost = await handler(request('POST', 'state', { client_id: 'internal', project_store: { projects: [] } }));
assert(anonymousInternalStatePost.status === 401, 'anonymous POST /state for the internal bucket must be rejected');
const internalStateGet = await handler(internalRequest('GET', 'state?client_id=internal&mode=internal'));
assert(internalStateGet.status === 200, 'authorized GET /state?client_id=internal should succeed');
const internalState = await internalStateGet.json();
assert(Array.isArray(internalState.project_store.projects), 'internal state should return a project store array');
assert(!internalState.project_store.projects.some((item) => String(item.id || '').includes('project-p03') || String(item.name || '').includes('安标') || String(item.state?.source || '').includes('feishu_bitable_p03')), 'internal state must not auto-inject P03/安标 seed content');
assert(!floristState.project_store.projects.some((item) => String(item.name || '').includes('安标')), 'non-internal state must not receive unrelated internal seed content');
const dentalFeedbackPost = await handler(request('POST', 'feedback', {
  client_id: 'dental',
  content_plan_id: dentalData.plans[0].id,
  publish_link: 'https://example.com/dental-post',
  views: 120,
  likes: 8,
  comments: 1,
  favorites: 4,
  shares: 1,
  consultations: 2,
}));
assert(dentalFeedbackPost.status === 201, 'POST /feedback should accept dental plan feedback');
const dentalFeedbackWithoutToken = await handler(request('POST', 'feedback', {
  client_id: 'dental',
  content_plan_id: dentalData.plans[0].id,
  publish_link: 'https://example.com/unauthorized-dental-post',
}, { customerAccess: false }));
assert(dentalFeedbackWithoutToken.status === 401, 'POST /feedback with only a naked client_id must be rejected');
const dentalFeedbackBody = await dentalFeedbackPost.json();
assert(dentalFeedbackBody.feedback.client_id === 'dental', 'POST /feedback should echo client_id');
const floristFeedbackGet = await handler(request('GET', 'feedback?client_id=florist'));
const floristFeedback = await floristFeedbackGet.json();
assert(!floristFeedback.some((item) => item.publish_link === 'https://example.com/dental-post'), 'GET /feedback?client_id=florist must not return dental feedback');
const floristFeedbackWithoutToken = await handler(request('GET', 'feedback?client_id=florist', undefined, { customerAccess: false }));
assert(floristFeedbackWithoutToken.status === 401, 'GET /feedback with only a naked client_id must be rejected');
const statePayload = {
  activeProjectId: 'project-smoke-sync',
  lastActiveProjectId: null,
  projects: [{
    id: 'project-smoke-sync',
    name: '跨端同步烟测项目',
    stage: '待启动',
    updated_at: '2026-05-28 12:00:00',
    state: {
      project: { id: 'project-smoke-sync', name: '跨端同步烟测项目', created_at: '2026-05-28 12:00:00' },
      project_stage: '待启动',
      current_cycle_id: 'cycle-1',
      assessment,
      diagnosis,
      plans,
      feedback: [],
      review: null,
      saved_at: '2026-05-28 12:00:00',
    },
  }],
};
const statePost = await handler(request('POST', 'state', { project_store: statePayload }));
assert(statePost.status === 201, `POST /state should persist project store, got ${statePost.status}: ${await statePost.text()}`);
const stateGet = await handler(request('GET', 'state'));
assert(stateGet.status === 200, `GET /state should return project store, got ${stateGet.status}`);
const cloudState = await stateGet.json();
assert(cloudState.project_store.projects.some((item) => item.id === 'project-smoke-sync'), 'GET /state should include saved cross-device project');
const customerCloudSyncPost = await handler(request('POST', 'state', {
  client_id: 'customer-cloud-sync',
  source: 'customer_public_cloud_sync',
  sync_version: '1.6.79',
  project_store: {
    activeProjectId: 'project-customer-cloud-sync',
    projects: [{
      id: 'project-customer-cloud-sync',
      name: '少儿篮球云端同步样本',
      updated_at: '2026-07-01 10:00:00',
      state: {
        client_id: 'customer-cloud-sync',
        project: { id: 'project-customer-cloud-sync', client_id: 'customer-cloud-sync', name: '少儿篮球云端同步样本' },
        project_stage: '运营中',
        current_cycle_id: 'customer-round-2',
        assessment: { ...basketballData.assessment, client_id: 'customer-cloud-sync', company_name: '少儿篮球云端同步样本' },
        diagnosis: { ...basketballData.diagnosis, client_id: 'customer-cloud-sync' },
        plans: basketballData.plans.map((plan) => ({ ...plan, client_id: 'customer-cloud-sync', project_id: 'project-customer-cloud-sync', cycle_id: 'customer-round-2' })),
        feedback: [{ id: 'record-1', client_id: 'customer-cloud-sync', content_plan_id: basketballData.plans[0].id, views: 1200, consultations: 4, source: 'customer_public_record' }],
        records: [{ content_plan_id: basketballData.plans[0].id, views: 1200, consultations: 4, notes: '家长关注体验课时间', created_at: '2026-07-01 10:00:00' }],
        content_rounds: [{ round_number: 1, plans: basketballData.plans.slice(0, 3), archived_at: '2026-07-01 10:00:00' }],
        active_round: 2,
        current_round: 2,
        cloud_sync_version: '1.6.79',
        source: 'customer_public_cloud_sync',
      },
    }],
  },
}));
assert(customerCloudSyncPost.status === 201, 'POST /state should accept customer public cloud sync payload');
const customerCloudSyncGet = await handler(request('GET', 'state?client_id=customer-cloud-sync'));
const customerCloudSyncState = await customerCloudSyncGet.json();
const syncedProject = customerCloudSyncState.project_store.projects.find((item) => item.id === 'project-customer-cloud-sync');
assert(syncedProject?.state?.records?.length === 1, 'customer public cloud sync should preserve customer records in project state');
assert(syncedProject?.state?.content_rounds?.length === 1 && syncedProject.state.active_round === 2, 'customer public cloud sync should preserve round history and active round');
assertNoUnsafeCommentCta('content decision diagnosis/plans', { diagnosis, plans });
const appJs = readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../static/index.html', import.meta.url), 'utf8');
const methodHtml = readFileSync(new URL('../static/method/index.html', import.meta.url), 'utf8');
const plansHtml = readFileSync(new URL('../static/plans/index.html', import.meta.url), 'utf8');
const plansJs = readFileSync(new URL('../static/plans.js', import.meta.url), 'utf8');
const publicAccountMenuJs = readFileSync(new URL('../static/public-account-menu.js', import.meta.url), 'utf8');
const inviteHtml = readFileSync(new URL('../static/invite/index.html', import.meta.url), 'utf8');
const inviteJs = readFileSync(new URL('../static/invite.js', import.meta.url), 'utf8');
const aboutHtml = readFileSync(new URL('../static/about/index.html', import.meta.url), 'utf8');
const privacyHtml = readFileSync(new URL('../static/privacy/index.html', import.meta.url), 'utf8');
const termsHtml = readFileSync(new URL('../static/terms/index.html', import.meta.url), 'utf8');
const contactHtml = readFileSync(new URL('../static/contact/index.html', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../netlify/functions/api.mjs', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../static/styles.css', import.meta.url), 'utf8');
const warRoomCss = readFileSync(new URL('../static/war-room-v1.6.1.css', import.meta.url), 'utf8');
const fpMatrixLogo = readFileSync(new URL('../static/fp-matrix-elephant.svg', import.meta.url), 'utf8');
const fpMatrixFavicon = readFileSync(new URL('../static/fp-matrix-favicon.svg', import.meta.url), 'utf8');
const huokeCompassMark = readFileSync(new URL('../static/huoke-compass-mark.svg', import.meta.url), 'utf8');
const customerAssessmentFormHtml = indexHtml.match(/<form id="customerAssessmentForm"[\s\S]*?<\/form>/)?.[0] || '';
const customerEffectFormHtml = indexHtml.match(/<form id="customerEffectForm"[\s\S]*?<\/form>/)?.[0] || '';
const apiSourceIncludes = (needle) => apiSource.includes(needle);
const redirects = readFileSync(new URL('../static/_redirects', import.meta.url), 'utf8');
const localDevServer = readFileSync(new URL('../scripts/local-dev-server.mjs', import.meta.url), 'utf8');
assert(appJs.includes("const APP_VERSION = '1.6.157'") && appJs.includes("v1.6.157 · 团队访问稳定修复版"), 'application should expose the reviewed v1.6.157 internal access release');
assert(indexHtml.includes("document.body.classList.toggle('internal-auth-pending', internal)") && stylesCss.includes('.internal-mode.internal-auth-pending #internalAccessGate[hidden]{display:grid!important}') && stylesCss.includes('.internal-mode #customerApp{display:none!important}') && appJs.includes("document.body.classList.remove('internal-auth-pending')"), 'internal routes should hide customer content and paint the access gate before the application script initializes');
assert(warRoomCss.includes('body.internal-mode .internal-access-card input:-webkit-autofill') && warRoomCss.includes('-webkit-text-fill-color:#f7f8f8!important') && warRoomCss.includes('0 0 0 1000px #0d0f12 inset!important'), 'internal password input should retain readable dark-field contrast when focused or autofilled');
assert(stylesCss.includes('body.customer-mode.customer-step-record .customer-account-setup{display:none!important}') && warRoomCss.includes('body.customer-mode.customer-step-record .customer-account-setup{display:none!important}'), 'customer feedback step should hide first-time account avatar/background setup while preserving the plan context');
assert(appJs.includes('return {...state, plans, content_rounds: contentRounds};'), 'legacy customer project migration should return the normalized content round variable without a reference error');
assert(appJs.includes('document.body.dataset.customerRestoreError = restoreError') && appJs.includes('console.error(`[customer_project_restore_failed] ${restoreError}`)'), 'customer project recovery failures should expose a payload-free diagnostic code');
const customerResumeCandidateSource = appJs.match(/function customerResumeCandidateFromBrowser\(\)[\s\S]*?\n}\n\nfunction renderCustomerResumeBanner/)?.[0] || '';
assert(customerResumeCandidateSource.includes('enterpriseMarketingMvpProjects\\.([a-z0-9_-]+)\\.v1') && !customerResumeCandidateSource.includes('clientId === currentId') && appJs.includes('safeStorage.setItem(CUSTOMER_SESSION_KEY, candidate.client_id)') && appJs.includes('clientState = normalizeState(saved)'), 'customer resume should recover generated state from the current or an older browser-scoped anonymous project store without rebuilding it');
assert(appJs.includes('function continueCustomerSavedProject') && appJs.includes("$('#customerResumeContinue')?.addEventListener('click', continueCustomerSavedProject)") && appJs.includes('customerResumeDecisionMade = true') && appJs.includes('renderCustomerResumeBanner({})'), 'continuing a saved customer project should restore its current state and dismiss the resume banner');
assert(appJs.includes('LEGACY_CUSTOMER_TOPIC_MIGRATIONS') && appJs.includes("'做内容总卡壳？这思路太顺了': '企业内容不知道发什么？先从3类素材开始'") && appJs.includes('migrateLegacyCustomerStateCopy(state)'), 'saved projects should migrate only the reviewed legacy topic copy without changing plan identity or feedback');
assert(!appJs.includes('const writeHashStore') && appJs.includes('const clearLegacyStateHash') && appJs.includes('const hashStore = readHashStore();') && appJs.includes('if (Object.keys(hashStore).length) return hashStore;') && appJs.includes('return writeWindowStore(store);') && appJs.includes("for (const name of ['localStorage', 'sessionStorage'])") && appJs.includes('for (const area of storageAreas())'), 'storage fallback must prioritize explicit legacy hash recovery, fall through local/session storage safely, and no longer write whole project state into the browser address bar');
assert(appJs.includes('function generateCustomerBrandImage') && appJs.includes('function restoreCustomerBrandImages') && appJs.includes("api('/api/customer-brand-images'") && appJs.includes('data-customer-brand-generate'), 'customer results should generate, poll, restore and retry account avatar/background images through the dedicated customer API');
assert(appJs.includes('resetCustomerBrandImageRuntime();') && appJs.includes('account_visuals: clientState.account_visuals || {}'), 'customer account visual state should be project-scoped and cleared when starting a blank project');
assert(warRoomCss.includes('.customer-brand-image-studio') && warRoomCss.includes('.customer-brand-image-grid') && warRoomCss.includes('@keyframes customer-brand-image-spin'), 'customer avatar/background generation should have scoped responsive loading and preview styles');
assert(apiSource.includes("path === '/customer-brand-images'") && apiSource.includes('customerBrandImageTaskView') && apiSource.includes('customerBrandImagePromptFor'), 'backend should expose a dedicated customer-safe account visual API and build prompts server-side');
assert(apiSource.includes('process.env.DEPLOY_URL || process.env.DEPLOY_PRIME_URL || process.env.URL'), 'background generation should stay on the current deploy so previews cannot invoke an older production function');
assert(indexHtml.includes('id="customerAccountUsage"') && indexHtml.includes('href="/plans"') && appJs.includes("api('/api/account/entitlements'"), 'signed-in account panel should show strategy-cycle usage and link to the plan page');
assert(appJs.match(/entitlement = entitlement \|\| \{\};/g)?.length >= 2, 'signed-out account rendering should tolerate a missing entitlement snapshot');
assert(plansHtml.includes('选择适合你经营节奏的套餐') && plansHtml.includes('额度怎么计算') && plansJs.includes("fetch('/api/commercial/plans'") && plansJs.includes("fetch('/api/account/entitlements'"), 'public plan page should explain customer-facing units and load server-owned entitlements');
assert(plansHtml.includes('id="billingCheckout"') && plansHtml.includes('id="billingOrderHistory"') && plansHtml.includes('当前采用人工到账确认'), 'plan page should provide an honest account order and manual payment-confirmation flow');
assert(plansJs.includes("fetch('/api/billing/orders'") && plansJs.includes('idempotency_key') && plansJs.includes('contact@fpmatrix.cn') && plansJs.includes('/?account=login&next=/plans'), 'customer checkout should require a verified session, create an idempotent server order, and preserve the plan return path');
assert(indexHtml.includes('id="internalBillingPanel"') && appJs.includes("api('/api/internal/billing/orders?limit=100'") && appJs.includes('/api/internal/billing/orders/${encodeURIComponent(orderId)}/confirm'), 'internal operations should expose the protected order confirmation panel without changing the customer shell');
assert(redirects.includes('/plans /plans/index.html 200'), 'Netlify redirects should expose the independent plan page');
assert(apiSource.includes("const COMMERCIAL_SUBSCRIPTION_PREFIX = 'subscriptions/v1'") && apiSource.includes("const COMMERCIAL_ENTITLEMENT_PREFIX = 'entitlements/v1'") && apiSource.includes("const COMMERCIAL_USAGE_PREFIX = 'usage/v1'"), 'P2 commercial records should use independent subscription, entitlement and usage namespaces');
assert(apiSource.includes("const COMMERCIAL_ORDER_PREFIX = 'orders/v1'") && apiSource.includes("const COMMERCIAL_ORDER_IDEMPOTENCY_PREFIX = 'order-idempotency/v1'") && apiSource.includes("const COMMERCIAL_BILLING_AUDIT_PREFIX = 'billing-audit/v1'"), 'commercial orders, idempotency records and billing audit logs should use independent namespaces');
assert(apiSource.includes('applyPaidOrderSubscription') && apiSource.includes('payment_order_ids') && apiSource.includes('manual_payment'), 'payment confirmation should activate subscriptions idempotently through a server-owned order id');
assert(apiSource.includes('reserveCommercialUsage') && apiSource.includes('settleCommercialUsage') && apiSource.includes("code: 'quota_exceeded'"), 'generation should reserve customer units idempotently and settle them after delivery');
assert(apiSource.includes('customerAdviceStrategyCycleId') && apiSource.includes("next-round-${sha256Hex(planIds.join('|')).slice(0, 24)}") && apiSource.includes('recordedPlanIds.size >= threshold'), 'next-round quota should be keyed to the current plan set instead of an individual feedback request');
['delivery-profiles', 'delivery-projects', 'delivery-cycles', 'collaboration-tasks', 'collaboration-approvals', 'shooting-schedules', 'weekly-reports', 'delivery-feishu-bindings'].forEach((routeName) => {
  assert(!appJs.includes(`/api/${routeName}`) && !indexHtml.includes(routeName), `P0 internal API ${routeName} must not be wired into the shared customer UI`);
});
assert(appJs.includes('CUSTOMER_PUBLIC_BRAND_PLACEHOLDER') && apiSource.includes('CUSTOMER_PUBLIC_BRAND_PLACEHOLDER'), 'customer sanitization should preserve only the approved FP Matrix public brand phrase while retaining the internal-term filter');
assert(appJs.includes("if (/^data:(?:image|video)\\//i.test(raw)) return raw;") && apiSource.includes("if (/^data:(?:image|video)\\//i.test(raw)) return raw;"), 'customer sanitizers must preserve embedded image and video data URLs byte-for-byte');
assert(apiSource.includes('timestampToEpoch =') && apiSource.includes('const preferIncomingTimestamp =') && apiSource.includes('compareTimestampDesc(a.updated_at, b.updated_at)'), 'cloud project merges and ordering should compare parsed timestamp epochs instead of timestamp strings');
assert(appJs.includes('function timestampToEpoch') && appJs.includes('function preferIncomingTimestamp') && appJs.includes('compareTimestampDesc(a.updated_at, b.updated_at)'), 'browser local/cloud project merges should use the same mixed-format timestamp comparison rule');
assert(apiSource.includes("'视频号': '更适合负责人/老板口播、真实案例复盘和信任建立") && apiSource.includes('好内容可被转发到群/朋友圈并经好友社交推荐') && apiSource.includes('公众号/社群/企业微信/私信等私域入口'), 'Video Account platform rule should cover mature-audience trust, social forwarding, and private-domain conversion');
assert(appJs.includes("const INTERNAL_ACCESS_TOKEN_STORAGE_KEY = 'internalAccessToken'") && appJs.includes("headers['x-internal-token'] = token") && appJs.includes('function initInternalAccessGate') && appJs.includes('function verifyInternalAccessToken'), 'internal UI should require and attach a validated access token before loading admin data');
assert(indexHtml.includes('id="internalAccessGate"') && indexHtml.includes('id="internalAccessForm"') && indexHtml.includes('id="internalAccessToken"') && indexHtml.includes('autocomplete="one-time-code"') && appJs.includes("tokenInput.value = ''"), 'internal shell should avoid stale password autofill and clear rejected access codes before retrying');
assert(appJs.includes('cryptoApi?.randomUUID') && appJs.includes('cryptoApi?.getRandomValues') && !appJs.includes("Math.random().toString(36).slice(2, 8)"), 'new anonymous client ids should use cryptographic randomness');
assert(apiSource.includes('timingSafeEqual') && apiSource.includes("request?.headers?.get('x-internal-token')") && apiSource.includes('const unauthorized = () => json') && !apiSource.includes("url?.searchParams?.get('token')"), 'server internal auth should use a constant-time header token check without URL-token fallback');
assert(apiSource.includes('stripCustomerModelMetadata') && apiSource.includes('CUSTOMER_HIDDEN_MODEL_FIELDS'), 'customer API responses should strip model/provider metadata unless internally authorized');
assert(apiSource.includes("envValue('ARK_PLAN_MODEL') || arkModel()") && apiSource.includes('model: arkPlanModel()'), 'initial plan generation should prefer the dedicated ARK_PLAN_MODEL and fall back to ARK_MODEL');
assert(apiSource.includes('MODEL_TIMEOUT_MS || process.env.ARK_TIMEOUT_MS || 19000') && apiSource.includes('CUSTOMER_PUBLIC_PLAN_TIMEOUT_MS || 19000') && apiSource.includes('), 20000);'), 'model timeouts should leave enough room for a rule fallback before the Netlify request limit');
assert(apiSource.includes('每条仅含这4个核心字段') && apiSource.includes("responseFormat: { type: 'json_object' }") && apiSource.includes('planRuleFields') && apiSource.includes('limitPlanText'), 'plan model output should be compact and JSON-stable while rule post-processing restores the seven-field row contract');
assert(apiSource.includes('UNSUPPORTED_PLAN_CLAIMS') && apiSource.includes("throw new Error('unsupported_claim')"), 'model plans should reject unsupported discounts, pickup promises, or outcome claims');
assert(appJs.includes("['正在分析业务...', '正在生成选题...', '正在适配平台...']"), 'customer generation should show staged progress copy');
assert(apiSource.includes("path === '/plan-jobs'") && apiSource.includes("path.match(/^\\/plan-jobs\\/([^/]+)$/)") && apiSource.includes("readCloudCollection('plan-jobs'") && apiSource.includes('context.waitUntil(promise)'), 'customer plan jobs should use a client-scoped blob collection and Netlify waitUntil processing');
assert(apiSource.includes('planJobClientIdFrom') && apiSource.includes('读取计划任务需要 client_id') && apiSource.includes("return json({ error: '计划任务不存在' }, 404)"), 'plan job reads should require client_id and hide cross-client job existence');
assert(appJs.includes("api('/api/plan-jobs'") && appJs.includes('function pollCustomerPlanJob') && appJs.includes('function resumeCustomerPlanJob') && !appJs.includes('&fallback=1'), 'customer plan generation should resume the same job after a long wait instead of overwriting it with a template fallback');
assert(appJs.includes('CUSTOMER_ACCESS_TOKEN_STORAGE_PREFIX') && appJs.includes("api('/api/customer-shares'") && apiSource.includes('authorizeCustomerStateAccess') && apiSource.includes("path === '/customer-shares'"), 'customer cloud state must require a browser access token or scoped save-link token');
assert(apiSource.includes("const COMMERCIAL_METERING_PREFIX = 'metering/v1'") && apiSource.includes("const COMMERCIAL_ANALYTICS_PREFIX = 'analytics/v1'") && apiSource.includes('reserveGenerationRequest') && apiSource.includes('RATE_LIMIT_ENFORCE'), 'P0 should keep metering and analytics in independent blob namespaces with a shadow/enforced switch');
assert(apiSource.includes('maxTokens: 1400'), 'Ark should have enough output budget to return seven structured content-plan rows without truncation fallback');
assert(apiSource.includes('CUSTOMER_GROWTH_ADVICE_TIMEOUT_MS || 15000') && apiSource.includes('), 18000);'), 'next-round Ark generation should allow the measured 2.1 Turbo response window');
assert(apiSource.includes("purpose: 'initial_7_day_plan_repair'") && apiSource.includes('provider_attempt_count: 2'), 'structured plan parse failures should get one bounded Ark repair attempt and expose the real provider attempt count');
assert(apiSource.includes("purpose: 'initial_7_day_plan_retry'") && apiSource.includes('isRetryableArkFailure'), 'transient Ark network, timeout, 429, and 5xx failures should get one bounded retry');
assert(apiSource.includes('reservationKeyFor') && apiSource.includes('existingJob') && apiSource.includes("job_id: `planjob_${sha256Hex(`${client_id}:${requestId}`).slice(0, 24)}`"), 'request_id should key both reservation and deterministic plan job identity');
assert(apiSource.includes("error: '生成太频繁，稍等片刻再试'") && appJs.includes("生成太频繁，稍等片刻再试。"), 'enforced rate limiting should use the approved friendly customer message');
assert(apiSource.includes("if (!paidGenerationSafeToRun())") && apiSource.includes("fallbackReason: 'safe_to_run_disabled'") && apiSource.includes('MOCK_SAFE_TO_RUN_REQUIRED'), 'SAFE_TO_RUN should guard Ark and internal paid provider adapters without breaking local fallbacks');
assert(apiSource.includes("if (request.method === 'POST' && path === '/assessments')") && apiSource.includes('if (!internalAuthorized) return unauthorized();'), 'direct assessments generation should require INTERNAL_ACCESS_TOKEN');
for (const event of ['home_view', 'intake_started', 'generation_submitted', 'generation_result', 'effect_recorded', 'next_round_entered']) {
  assert(apiSource.includes(`'${event}'`), `P0 server funnel allowlist should include ${event}`);
}
for (const event of ['home_view', 'intake_started', 'generation_submitted', 'effect_recorded', 'next_round_entered']) {
  assert(appJs.includes(`'${event}'`), `customer flow should emit ${event}`);
}
assert(apiSource.includes('PLAN_VARIATION_DIRECTIONS') && apiSource.includes('generation_variant: generationVariant') && apiSource.includes('temperature: 0.45') && apiSource.includes('variation_direction'), 'customer plan jobs should rotate a lightweight creative direction while keeping title semantics stable');
assert(apiSource.includes("framework_version: 'customer-evidence-p0'") && apiSource.includes('customer_language') && apiSource.includes('buyer_objections') && apiSource.includes('proof_assets') && apiSource.includes('market_calibration'), 'P0 strategy framework should carry customer language, objections, evidence and market calibration into both generation rounds');
assert(apiSource.includes('至少3条直接回应 customer_language/buyer_objections') && apiSource.includes('至少2条使用 proof_assets') && apiSource.includes('market_calibration 只用于识别已验证的主题和表达结构'), 'initial plan prompt should require evidence-grounded customer-specific topics without copying benchmarks');
assert(apiSource.includes('优先沿用strategy_quality里的客户原话、购买异议和真实素材') && apiSource.includes('每条可用指标决定下一步'), 'next-round prompt should use customer evidence and measurable feedback decisions');
assert(appJs.includes('客户原话依据') && appJs.includes('可用证据') && appJs.includes('策略证据'), 'existing collapsed reasoning and internal plan QA should expose customer evidence without adding a new customer page');
assert(indexHtml.includes('name="current_channels" value="还不确定"') && indexHtml.includes('name="biggest_problem" value="不知道发什么"'), 'customer intake should require only the three core text fields and carry safe defaults for platform and biggest problem');
assert(indexHtml.includes('list="customerMainGoalOptions"') && indexHtml.includes('获得更多有效咨询') && indexHtml.includes('暂时不确定，请系统根据业务建议') && indexHtml.includes('可直接选择，也可以写自己的目标'), 'customer goal input should provide clear common choices while preserving free-form input');
assert(indexHtml.includes('暂时不确定，由系统推荐') && indexHtml.includes('不想拍人物正脸') && !indexHtml.includes('不想拍孩子正脸'), 'customer choices should explain automatic platform recommendation and avoid industry-specific face-shooting copy');
assert((customerAssessmentFormHtml.match(/\srequired(?:\s|\/?>)/g) || []).length === 3, 'customer intake should contain exactly three required fields');
const customerOptionalStart = customerAssessmentFormHtml.indexOf('<details class="customer-more-fields customer-optional-fields">');
assert(customerOptionalStart >= 0 && customerAssessmentFormHtml.indexOf('name="current_channels"') > customerOptionalStart && customerAssessmentFormHtml.indexOf('name="content_mode"') > customerOptionalStart && customerAssessmentFormHtml.indexOf('name="biggest_problem"') > customerOptionalStart, 'platform, content mode and biggest problem should all live inside the default-collapsed optional section');
assert(apiSource.includes("assessment.current_channels === '还不确定'") && appJs.includes('generatedPlatforms') && appJs.includes("selectedPlatform !== '还不确定'"), 'an uncertain platform default should be rendered as the actual recommended plan platforms, not as literal uncertain copy');
assert(indexHtml.includes('class="customer-effect-more"') && indexHtml.includes('<summary>更多（可选）</summary>') && !indexHtml.includes('<input name="likes" type="hidden"'), 'customer effect form should show only three core metrics by default and place split engagement fields in optional details');
const customerEffectMoreStart = customerEffectFormHtml.indexOf('<details class="customer-effect-more">');
assert(['views', 'likes', 'consultations'].every((name) => customerEffectFormHtml.indexOf(`name="${name}"`) >= 0 && customerEffectFormHtml.indexOf(`name="${name}"`) < customerEffectMoreStart), 'views, likes and consultations should be the only core metrics before optional details');
const customerEffectMoreHtml = customerEffectFormHtml.slice(customerEffectMoreStart);
assert(['comments', 'favorites', 'shares'].every((name) => customerEffectMoreHtml.includes(`name="${name}" type="number" min="0" value="0"`)), 'comments, favorites and shares should be optional collapsed metrics defaulting to zero');
assert(appJs.includes('lastCustomerGenerationPayload') && appJs.includes('customerGenerationRetry') && appJs.includes('function resumeCustomerPlanJob') && appJs.includes("'继续获取结果'"), 'failed or slow customer plan generation should preserve the submitted payload and let the customer resume the same job');
assert(appJs.includes('function isP03AnbiaoSubmission') && appJs.includes('defaultCustomerCoCreation(scopedPayload)') && appJs.includes('submitCustomerAssessmentPayload({'), 'P03/anbiao customer intake should bypass the extra co-creation edit step and submit directly through plan-jobs');
assert(appJs.includes('function restoreCustomerTrialFromCloud') && appJs.includes('function showCustomerCloudRestoreGate') && appJs.includes('const gateCloudRestore = shouldGateCustomerCloudRestore(savedCustomerState)'), 'explicit customer links should show a restore gate and hydrate generated state from /api/state before exposing the blank intake form');
assert(appJs.includes('就能解锁更准的下一轮建议') && !appJs.includes('才会开放下一轮计划'), 'next-round readiness copy should encourage additional records without changing the gate');
assert(warRoomCss.includes('v1.6.86 customer contrast closeout') && warRoomCss.includes('body.customer-mode .war-tag.green') && warRoomCss.includes('color:#065f46!important') && warRoomCss.includes('.war-tag.green{color:#8ff2cb'), 'customer light mode should use dark green readable text while the internal dark theme keeps its mint green baseline');
assert(warRoomCss.includes('.customer-selected-plan{') && warRoomCss.includes('color:#065f46!important') && !warRoomCss.includes('.customer-selected-plan{grid-column:1/-1!important;padding:12px 14px!important;border:1px solid rgba(16,185,129,.26)!important;border-radius:16px!important;background:rgba(16,185,129,.08)!important;color:#bdf7df'), 'selected customer plan copy should use dark green ink instead of pale green');
assert(warRoomCss.includes('.customer-advice-block>span{') && warRoomCss.includes('background:rgba(94,106,210,.2)!important;color:#312e81!important'), 'customer advice number badges should use deep purple ink');
assert(!warRoomCss.includes('#bdf7df'), 'customer stylesheet should contain no pale green #bdf7df residue');
assert(!warRoomCss.includes('#d8dcff'), 'customer stylesheet should contain no pale purple #d8dcff residue');
assert(warRoomCss.includes('.customer-more-fields>summary{cursor:pointer!important;list-style:none!important;color:#312e81!important') && warRoomCss.includes('.customer-plan-item .plan-day{display:grid!important;place-items:center!important;padding:8px 4px!important;border-radius:12px!important;background:rgba(94,106,210,.18)!important;color:#312e81!important'), 'customer optional summary and legacy plan-day state should use deep purple ink');
assert(warRoomCss.includes('body.internal-mode .customer-more-fields>summary,') && warRoomCss.includes('body.internal-mode .customer-plan-item .plan-day{') && warRoomCss.includes('color:rgb(216,220,255)!important'), 'internal dark mode should retain the original pale-purple visual value through an internal-only override');
assert(!indexHtml.includes('你当前最大的内容问题是什么？*</legend>'), 'biggest content problem label should not show a required star');
assert(!warRoomCss.split('\n').some((line) => line.includes('body.customer-mode') && /#bdf7df|#8ff2cb|#9ee5c[0-9a-f]?|#a7f3d0|#dfffee|#eafff6/i.test(line)), 'customer-mode declarations must not retain pale green text values');
assert(warRoomCss.includes('v1.6.87 customer inner-page design unification') && warRoomCss.includes('body.customer-mode .customer-direction-card.is-selected{') && warRoomCss.includes('border:1.5px solid #111827!important') && warRoomCss.includes('body.customer-mode .customer-direction-radio{'), 'customer direction cards should render as an explicit single-choice control with a strong selected state');
assert(indexHtml.includes('class="customer-direction-hint">选一个方向') && indexHtml.includes('用这个方向生成内容 →') && appJs.includes('class="customer-direction-radio"') && appJs.includes('aria-pressed='), 'direction confirmation should separate choice affordance from the single primary action without changing event hooks');
assert(appJs.includes('class="plan-lite-copy"') && appJs.includes('class="plan-angle"') && appJs.includes('class="customer-plan-more"') && appJs.includes('查看全部 ${safePlans.length} 天 →'), 'customer plan cards should show a secondary angle and progressively disclose the remaining days');
assert(warRoomCss.includes('body.customer-mode .customer-plan-more:not([open])>.customer-plan-more-list{') && warRoomCss.includes('display:none!important'), 'closed customer plan details must actually hide days four through seven despite grid overrides');
assert(warRoomCss.includes('body.customer-mode .customer-plan-lite .plan-day-pill{') && warRoomCss.includes('width:26px!important') && warRoomCss.includes('body.customer-mode .customer-plan-lite .plan-platform-pill{') && warRoomCss.includes('border:.5px solid #d0d5dd!important'), 'customer plans should use quiet circular day numbers and neutral platform pills');
assert(warRoomCss.includes('body.customer-mode .customer-why summary{') && warRoomCss.includes('color:#1f2937!important') && warRoomCss.includes('font-weight:500!important'), 'customer rationale disclosure should use readable neutral ink and regular emphasis');
assert(warRoomCss.includes('body.customer-mode .customer-loop-note{') && warRoomCss.includes('background:#fff!important') && warRoomCss.includes('body.customer-mode .customer-effect-step{'), 'effect and next-round surfaces should use white hairline cards rather than large green tints');
assert(warRoomCss.includes('v1.6.88 customer inner-page cleanup') && warRoomCss.includes('body.customer-mode .customer-preview-kicker{\n  color:#1f2937!important'), 'customer preview kicker should use high-contrast dark ink while internal mode keeps its original palette');
assert(indexHtml.includes('class="customer-inline-link"') && warRoomCss.includes('body.customer-mode .customer-inline-link{') && warRoomCss.includes('border:.5px solid rgba(17,24,39,.20)!important') && warRoomCss.includes('background:#fff!important;\n  color:#1f2937!important') && warRoomCss.includes('font-weight:500!important'), 'the live customer inline link should use neutral ink, a solid hairline border and regular emphasis');
assert(warRoomCss.includes('body.customer-mode .customer-plan-item.is-selected{\n  border:1.5px solid #111827!important;\n  background:#fff!important;\n  box-shadow:none!important'), 'customer plan selection should use a neutral dark border without green tint');
assert(warRoomCss.includes('body.customer-mode .customer-section-head p,\nbody.customer-mode .customer-plan-head p{\n  color:#667085!important'), 'customer section and plan kickers should meet small-text contrast requirements');
assert(appJs.includes("const INTERNAL_CLIENT_ID = 'internal'") && appJs.includes("mode=internal") && appJs.includes('function customerClientId') && appJs.includes('isInternalDataScope() ? INTERNAL_CLIENT_ID'), 'internal page should use stable internal client_id and request internal cloud seed state from the route data scope');
assert(appJs.includes('const VIEW_PROFILES = {') && appJs.includes('internal_admin') && appJs.includes('client_viewer') && appJs.includes('selfserve_client') && appJs.includes('outsourced_worker') && appJs.includes('const getProfile ='), 'app should define role-based VIEW_PROFILES for one-system rendering');
assert(appJs.includes("delivery: 'qa_passed_only'") && appJs.includes('profileDeliveryView') && appJs.includes('&view=${profileDeliveryView(profile)}'), 'profile delivery settings should map customer views to server-side filtered data requests');
assert(appJs.includes('function sharedJourneySteps') && appJs.includes('function renderSharedJourneyShell') && appJs.includes('document.body.dataset.viewRole = profile.role'), 'customer/internal journey shell should have a shared profile-aware entry point');
assert(appJs.includes('const isInternalDataScope = () => isInternalMode();') && appJs.includes('projectsStorageKey') && appJs.includes('appStateStorageKey'), 'internal storage keys should be based on the stable route data scope, not a stale rendered profile');
assert(appJs.includes("return '检测合规服务';"), 'app should collapse legacy/real compliance project aliases into one dropdown item');
assert(!appJs.includes('function isAnbiaoCustomerProject()') && !appJs.includes('renderAnbiaoCustomerData') && !appJs.includes('ANBIAO_CUSTOMER_ROWS'), 'anbiao publish-link refill module should be removed from internal app');
assert(!appJs.includes('安标检测 / 发布链接回填') && !appJs.includes('查看回填链接表'), 'anbiao publish-link refill UI should not be rendered');
assert(appJs.includes('function initCustomerTrial()') && appJs.includes('CUSTOMER_STORAGE_KEY'), 'default app should initialize the customer trial flow');
assert(appJs.includes("normalizedUrl.pathname = '/internal/'") && !appJs.includes("params.get('mode') === 'internal'"), 'public ?mode=internal entries must not open the internal workbench');
assert(appJs.includes("return path === '/internal' || path.startsWith('/internal/');") && appJs.includes("currentPath() === '/internal/generation-workbench'") && appJs.includes("currentPath() === '/internal/benchmark-insights'"), 'internal rendering should be path-gated to /internal/ and both standalone workbench routes');
assert(appJs.includes('function syncRouteState') && appJs.includes('function initInternalRouteNavigation') && appJs.includes('history.pushState') && appJs.includes("window.addEventListener('popstate', syncRouteState)") && appJs.includes('generationWorkbenchInitialized'), 'internal navigation should re-apply shell/workbench visibility and initialize the workbench after route changes');
assert(indexHtml.includes('id="internalHeroTitle"') && indexHtml.includes('客户运营工作区') && indexHtml.includes('对标内容洞察') && indexHtml.includes('素材生产工作台'), 'internal hero should label operations, benchmark evidence and production workspaces separately');
assert(appJs.includes('function renderInternalWorkspaceShell') && appJs.includes('document.body.dataset.internalWorkspace') && appJs.includes('internal-production-mode') && appJs.includes('internal-benchmark-mode') && appJs.includes('if (planLink) planLink.hidden = standaloneActive'), 'internal shell should switch copy/actions across operations, benchmark and production routes');
assert(warRoomCss.includes('body.internal-mode:not(.generation-workbench-mode) #generationWorkbench') && warRoomCss.includes('body.internal-mode.generation-workbench-mode #diagnosisWorkflow') && warRoomCss.includes('body.internal-mode.generation-workbench-mode #allCustomersPanel'), 'internal CSS should prevent production workbench and operations modules from rendering together');
assert(indexHtml.includes('脚本 · Kimi K2.6') && indexHtml.includes('文案 · Kimi K2.6') && !indexHtml.includes('script · Claude Opus'), 'internal generation form should label the configured Kimi script and copy provider instead of the stale Claude label');
assert(appJs.includes("script: 'Kimi (kimi-k2.6)'") && appJs.includes('function generationOutputTextForTask') && appJs.includes('function renderGenerationOutput') && appJs.includes('data-gw-action="copy-output"'), 'internal generation workbench should map Kimi tasks and render copyable output text from generated assets');
assert(appJs.includes('function renderGenerationCompleteness') && appJs.includes('completeness_checked') && appJs.includes('continuation_rounds') && appJs.includes('regeneration_attempted'), 'internal task cards should progressively disclose Kimi completeness, continuation, and regeneration evidence');
assert(appJs.includes("submitButton.textContent = '正在创建并提交...'") && appJs.includes("api(`/api/generation-tasks/${encodeURIComponent(taskId)}/submit`") && appJs.includes("taskCard?.scrollIntoView({behavior:'smooth', block:'center'})"), 'creating an internal generation task should immediately submit it and locate the active task card');
assert(appJs.includes('form.dataset.activeRequestId') && appJs.includes('data.idempotency_key = form.dataset.activeRequestId'), 'generation form retries should reuse an explicit idempotency key instead of creating duplicate tasks');
assert(appJs.includes('function copyGenerationText') && appJs.includes('浏览器没有允许复制'), 'generation output copying should fall back cleanly when clipboard permission is denied');
assert(appJs.includes('function syncGenerationProjectContext') && appJs.includes("setValue('#generationTaskForm [name=\"content_plan_record_id\"]', planId)"), 'generation workbench should bind the active customer project and content plan instead of keeping QA defaults');
assert(indexHtml.includes('id="generationPlanSelect"') && indexHtml.includes('从客户内容计划选择') && indexHtml.includes('id="generationPlanSelectionHint"'), 'internal generation should visibly start from a customer content-plan item instead of exposing only hidden record ids');
assert(appJs.includes('function renderGenerationPlanSelector') && appJs.includes('function applyGenerationPlanSelection') && appJs.includes('function generationPromptForPlan') && appJs.includes('forcePrompt: true'), 'selecting a customer plan should bind its real id and prefill platform-aware generation requirements');
assert(warRoomCss.includes('body.internal-mode .generation-workbench select:focus') && warRoomCss.includes('body.internal-mode .generation-workbench select option') && warRoomCss.includes('color-scheme:dark!important'), 'all internal generation inputs and native select options should remain readable in dark mode while focused');
assert(appJs.includes('function customerAccountSetupListHtml') && appJs.includes('function customerAccountSetupHtml') && appJs.includes('customer-account-platform-setups') && appJs.includes('setup.pinned_content_label') && appJs.includes('setup.homepage_focus'), 'customer results should progressively disclose one independent account setup per selected platform');
assert(warRoomCss.includes('body.customer-mode .customer-account-platform-setups{') && warRoomCss.includes('body.customer-mode .customer-account-platform-setup>summary{'), 'multi-platform account setups should use compact nested disclosure styling instead of becoming an information wall');
assert(appJs.includes("return '内容增长咨询与工具'") && appJs.includes('const goalText = customerText(goal'), 'customer offer inference should identify marketing-growth services before parsing goal verbs so it cannot produce a broken conjunction-led offer');
assert(apiSource.includes("topic: '企业不知道发什么，先问客户这3题'") && apiSource.includes("topic: 'AI生成内容为什么总像模板'") && apiSource.includes("topic: '内容发了没效果，先看哪3个数'"), 'meta-marketing co-creation should use concrete customer-facing topic seeds instead of generic offer concatenation');
assert(appJs.includes("task.adapter_state?.background_started_at || task.adapter_state?.triggered_at") && appJs.includes('const latestFailed = latestTask'), 'generation UI should use the real background start time and must not let historical success mask the latest failure');
assert(warRoomCss.includes('v1.6.114 internal Kimi output preview') && warRoomCss.includes('body.internal-mode .generation-output-preview') && warRoomCss.includes('body.internal-mode .generation-completeness-grid'), 'internal dark-theme stylesheet should provide readable output and completeness panels without changing the customer shell');
assert(appJs.includes('GENERATION_WORKBENCH_REFRESH_MS = 5000') && appJs.includes('function scheduleGenerationWorkbenchRefresh') && appJs.includes('function refreshGeneratingWorkbenchTasks') && appJs.includes('页面每 5 秒自动更新'), 'internal background generation should refresh automatically instead of leaving Kimi tasks visibly stuck in generating');
assert(appJs.includes('function renderGenerationTaskActions') && appJs.includes('function renderGenerationTechnicalDetails') && appJs.includes('查看历史任务') && appJs.includes('generation-running-button'), 'internal task cards should expose only status-appropriate actions and collapse technical/history details');
assert(appJs.includes("title: '内容生产工作台'") && indexHtml.includes('关联项目、参考素材与交付设置') && indexHtml.includes('参考素材（可选）') && indexHtml.includes('技术与飞书调试'), 'internal generation workbench should prioritize prompt-to-output flow and collapse secondary operational panels');
assert(warRoomCss.includes('v1.6.115 internal generation flow focus') && warRoomCss.includes('body.internal-mode .generation-primary-fields') && warRoomCss.includes('body.internal-mode .generation-collapsible'), 'internal-only styles should support the simplified generation flow without changing the customer surface');
for (const type of ['script', 'copy', 'video', 'cover', 'image']) {
  assert(indexHtml.includes(`data-generation-fields="${type}"`), `generation form should expose dedicated ${type} fields`);
}
assert(appJs.includes('const GENERATION_TYPE_UI = {') && appJs.includes('function generationOutputSpecFor') && appJs.includes('data-generation-fields') && appJs.includes('generationOutputMediaForTask'), 'internal generation form should switch type-specific fields and render text/image/video outputs');
assert(appJs.includes("String(asset?.storage_url || '').trim()"), 'text generation output should not crash when no image or video asset exists');
assert(apiSource.includes('const IMAGE_BG_TIMEOUT_MS =') && apiSource.includes('const shouldRunAdapterInBackground =') && apiSource.includes("adapter.name === 'openai-image'"), 'real cover and image tasks should use the existing long-running background generation path');
assert(apiSource.includes("context_version: 'business-context-v1'") && apiSource.includes('const generationProjectContext = async') && apiSource.includes('const autoLinkedGenerationAssetIds = async'), 'generation tasks should carry server-built customer context and automatically link same-plan assets');
assert(apiSource.includes('idempotent_replay: true') && apiSource.includes('idempotency_key'), 'generation task creation should be idempotent across network retries');
assert(indexHtml.includes('name="content_plan_record_id" type="hidden" value="qa_content_plan_001"'), 'uploaded assets should carry a content plan binding that can be replaced with the active project plan');
assert(appJs.includes("data-gw-action=\"check-progress\"") && appJs.includes('generatingTasks.map((task)') && apiSource.includes('missingStartIsStale') && apiSource.includes('markBackgroundGenerationFailure'), 'generating tasks should support active progress checks, missed-trigger recovery and explicit background failure states');
assert(warRoomCss.includes('v1.6.116 generation type fields and resilient progress') && warRoomCss.includes('.generation-type-field-group[hidden]') && warRoomCss.includes('.generation-running-state') && warRoomCss.includes('.generation-output-media'), 'internal-only styles should keep typed inputs, progress and media previews readable');
assert(appJs.includes('function activateCustomerNextRound') && appJs.includes('data-customer-activate-round') && appJs.includes('previous_rounds') && appJs.includes('content_rounds'), 'customer client should support activating the next 7-day round and carrying prior round topics forward');
assert(indexHtml.includes('id="customerRoundHistory"') && appJs.includes('function renderCustomerRoundHistory') && appJs.includes('customerArchivedPlanTopics') && appJs.includes('renderCustomerRoundHistory(nextState)'), 'customer client should expose content-round history and refresh it after round changes');
assert(appJs.includes('function syncCustomerTrialCloudState') && appJs.includes('customer_public_cloud_sync') && appJs.includes('scheduleCustomerTrialCloudSync(generatedState)') && appJs.includes('scheduleCustomerTrialCloudSync(nextState)'), 'customer public flow should sync generated plans, feedback records and round changes to cloud project store');
assert(indexHtml.includes('id="saveCustomerLinkBtn"') && appJs.includes('function saveCustomerLink') && appJs.includes("url.searchParams.set('share', shareToken)") && appJs.includes("api('/api/customer-shares'") && appJs.includes("$('#saveCustomerLinkBtn')?.addEventListener('click', saveCustomerLink)"), 'customer result should offer an opaque project-scoped save link without exposing client_id');
assert(apiSource.includes('cachedCloudStore') && apiSource.includes('__store_probe__') && apiSource.includes("getStore({ name: CLOUD_STATE_STORE, consistency: 'strong' })"), 'cloud store should prefer the runtime-injected strong-consistency store before falling back to explicit credentials');
assert(indexHtml.includes('id="customerCoCreationSection"') && appJs.includes('function renderCustomerCoCreation') && appJs.includes('function collectCustomerCoCreation') && appJs.includes('co_creation: coCreation'), 'customer public flow should include a co-creation confirmation layer before generating the 7-day plan');
assert(indexHtml.includes('data-customer-observation-tags') && appJs.includes('observation_tags') && apiSource.includes('observation_tags'), 'customer feedback should capture observation tags for next-round advice');
assert(indexHtml.includes('data-customer-step-target="intake"') && indexHtml.includes('data-customer-step-target="confirm"') && indexHtml.includes('data-customer-step-target="plan"') && indexHtml.includes('data-customer-step-target="record"') && indexHtml.includes('data-customer-step-target="next"') && appJs.includes("const CUSTOMER_FLOW_STEPS = ['intake', 'confirm', 'plan', 'record', 'next']") && appJs.includes('function setCustomerStep'), 'customer public flow should render as a five-step guided experience');
assert(appJs.includes("label: '填入基本信息'") && appJs.includes("label: '确认方向'") && appJs.includes("label: '内容计划'") && appJs.includes("label: '记录效果'") && appJs.includes("label: '下一轮优化'"), 'customer public flow should keep five distinct navigation labels with a clear first-step label');
assert(apiSource.includes("path === '/customers'") && apiSource.includes('listCustomersFromCloudState') && apiSource.includes("store.list({ prefix: CLOUD_STATE_KEY") && apiSource.includes('isTestCustomerKey') && apiSource.includes('groupCustomerRecords'), 'API should expose a read-only grouped internal customer aggregation endpoint backed by blob key listing');
assert(apiSource.includes("path === '/customers/merge-preview'") && apiSource.includes('previewCustomerMerge') && apiSource.includes('would_write: false'), 'API should expose a dry-run-only customer merge preview endpoint');
assert(indexHtml.includes('id="allCustomersPanel"') && indexHtml.includes('全部客户') && indexHtml.includes('只读聚合各 client_id') && appJs.includes('function loadAllCustomers') && appJs.includes("api('/api/customers?mode=internal&client_id=internal', { suppressInternalUnauthorized: true })") && appJs.includes('primary_client_id') && appJs.includes('data-all-customer-client'), 'internal app should render and load the grouped all-customers panel with specific-record drill-down');
assert(apiSource.includes("path === '/feishu/push'") && apiSource.includes('pushFeishuContentPlans') && apiSource.includes('batch_create') && apiSource.includes('batch_update') && apiSource.includes('内容计划ID'), 'Stage C should expose an authenticated Bitable plan upsert route');
assert(apiSource.includes("path === '/feishu/status'") && apiSource.includes('feishuCollaborationStatus') && apiSource.includes('FEISHU_WORKSPACE_URL'), 'Stage C should expose a protected non-sensitive collaboration status endpoint');
assert(indexHtml.includes('id="feishuCollaborationPanel"') && indexHtml.includes('id="feishuPushPlansBtn"') && indexHtml.includes('id="feishuWorkspaceLink"') && appJs.includes("api('/api/feishu/push'") && appJs.includes('function loadFeishuCollaborationStatus'), 'internal app should expose the Feishu collaboration panel and push action');
assert(indexHtml.indexOf('id="feishuCollaborationPanel"') > indexHtml.indexOf('id="internalApp"') && !customerAssessmentFormHtml.includes('飞书'), 'Feishu collaboration controls must live only in the internal app tree');
assert(stylesCss.includes('v1.6.110 internal Feishu collaboration') && stylesCss.includes('.feishu-collaboration-status') && stylesCss.includes('@media(max-width:760px)'), 'Feishu collaboration panel should include internal-only responsive styles');
assert(redirects.includes('/internal /index.html 200') && redirects.includes('/internal/ /index.html 200') && redirects.includes('/internal/* /index.html 200') && !redirects.includes('/?mode=internal'), 'internal routes should rewrite to the app shell without a Netlify self-redirect loop');
assert(!existsSync(new URL('../static/internal/index.html', import.meta.url)), 'static/internal/index.html must not exist because it shadows the /internal/ SPA rewrite on Netlify');
assert(localDevServer.includes("pathname === '/internal'") && localDevServer.includes("location: '/internal/'") && localDevServer.includes("pathname.startsWith('/internal/')"), 'local dev server should mirror /internal -> /internal/ and /internal/* -> app-shell behavior');
assert(localDevServer.includes("'about'") && localDevServer.includes("'privacy'") && localDevServer.includes('customerInfoPages.has(infoPageName)') && localDevServer.includes('/index.html`'), 'local dev server should mirror independent customer info pages');
assert(appJs.includes('function syncCustomerChoicesBeforeSubmit') && appJs.includes("aria-pressed") && !appJs.includes('lastPointerSelect'), 'customer choice chips should use stable click handling and submit-time sync');
assert(!appJs.includes('onpointerdown = handleButtonChoice') && !appJs.includes("addEventListener('pointerdown', handleChoiceEvent)") && appJs.includes("addEventListener('keydown'") && appJs.includes("if (typeof group.__applyChoice === 'function') {\n      return;"), 'customer choice chips must not double-toggle through pointer/capture fallback handlers');
assert(appJs.includes('isInternalProfile()') && appJs.includes('initInternalApp()'), 'internal workbench should be gated behind the internal profile');
assert(appJs.includes('function prefillFeedback(id)'), 'app should expose prefillFeedback for plan feedback buttons');
assert(appJs.includes("[name=content_plan_id]"), 'prefillFeedback should target the content_plan_id field');
assert(appJs.includes('function samePlanId') && appJs.includes('function planIdValue'), 'plan feedback matching should preserve the original plan.id instead of coercing all ids to numbers');
assert(appJs.includes('js-prefill-feedback') && appJs.includes('data-plan-id="${esc(planIdValue(p))}"'), 'all plan feedback buttons should carry the exact plan.id in data-plan-id');
assert(appJs.includes('function setInternalFeedbackPlan') && appJs.includes('planInput.value = selectedPlanId;'), 'prefillFeedback must write the exact plan.id into #feedbackForm [name=content_plan_id]');
assert(appJs.includes('function resolveInternalFeedbackPlan') && appJs.includes('auto_visible_first_fallback'), 'internal feedback submit should auto-bind a visible plan instead of blocking on an empty hidden selector');
assert(appJs.includes('planDisplay.textContent = displayNumber ? `计划 #${displayNumber}${topic}`'), 'prefillFeedback must update #selectedPlanDisplay to the selected plan label');
assert(appJs.includes('initPlanFeedbackButtons();'), 'plan feedback buttons should use stable delegated click binding');
assert(appJs.includes("[name=publish_link]") && appJs.includes('linkInput?.focus()'), 'prefillFeedback should focus the publish link field');
assert(appJs.includes('normalizeExternalUrl(existingFeedback?.publish_link || plan?.publish_link'), 'prefillFeedback should prefill existing publish links with protocol-normalized URLs');
assert(appJs.includes('function normalizeExternalUrl') && appJs.includes('https://${text}'), 'app should normalize bare external URLs to https:// before display/save');
assert(indexHtml.includes('name="publish_link" required type="text" inputmode="url"'), 'publish link input should accept bare domains so the app can normalize them');
assert(appJs.includes('scrollIntoView'), 'prefillFeedback should scroll to the feedback form area');
assert(appJs.includes('is-highlighted'), 'prefillFeedback should highlight the feedback area');
assert(appJs.includes('已选择计划 #'), 'prefillFeedback should show a business toast after locating the form');
assert(appJs.includes('function hasRestorableState'), 'app should detect restorable local state before showing the first form again');
assert(appJs.includes('function resetForNewCustomer'), 'war-room should keep a reset/new customer entry');
assert(appJs.includes('customerDisplayName') && !appJs.includes("a.company_name || '未命名客户'"), 'app should not render 未命名客户 as the customer title');

assert(appJs.includes('function renderSmartDiagnosisModule') && appJs.includes('内测智能诊断内核') && appJs.includes("payload.client_mode = 'internal_test'"), 'internal mode should render the smart diagnosis kernel without changing customer entry');
assert(appJs.includes('function internalIntakeSnapshot') && appJs.includes('系统理解卡') && appJs.includes('组件 3 · 缺项补充卡') && appJs.includes('组件 4 · 项目误判风险卡') && appJs.includes('组件 5 · 确认继续') && appJs.includes('业务字段已齐，可以生成'), 'internal AI intake should render project-understanding components while keeping generation aligned with the customer flow');
assert(indexHtml.includes('id="aiExtractBtn"') && indexHtml.includes('分析项目') && indexHtml.includes('id="aiClearBtn"') && indexHtml.includes('清空重写'), 'internal AI intake should expose analyze and clear actions in the input card');
assert(indexHtml.includes('id="publishedLinkPicker"') && indexHtml.includes('internal-ai-fold') && appJs.includes('function renderPublishedLinkPicker') && appJs.includes('function selectPublishedLink') && appJs.includes('published_link_picker'), 'internal feedback should keep AI/debug collection folded and let testers select existing published links');
assert(indexHtml.includes('id="refillCockpit"') && indexHtml.includes('data-zone="A"') && indexHtml.includes('data-zone="F"'), 'internal refill UI should expose a cockpit and A-F dashboard zones');
assert(appJs.includes('function renderRefillCockpit') && appJs.includes('function feedbackMetricSet') && appJs.includes('feedback-compare-card'), 'internal refill UI should render cockpit metrics and comparison cards');
assert(warRoomCss.includes('.internal-feedback-dashboard') && warRoomCss.includes('.refill-cockpit') && warRoomCss.includes('.refill-metric.is-missing'), 'internal refill CSS should style dashboard zones, cockpit, and missing metrics');
assert(appJs.includes('id="aiIntakeUnderstanding"') || readFileSync(new URL('../static/index.html', import.meta.url), 'utf8').includes('id="aiIntakeUnderstanding"'), 'internal AI intake should have a dedicated understanding card container');
assert(appJs.includes('function buildCustomerNextAdvice') && appJs.includes('function buildCustomerNextRoundPlan') && appJs.includes('customerNextAdvice'), 'customer trial should generate review judgment and gated next-round candidates after effect record save');
assert(appJs.includes('CUSTOMER_NEXT_ROUND_MIN_RECORDS = 3') && appJs.includes('function customerNextRoundReadiness') && appJs.includes('customerRoundRecordCount'), 'customer next-round activation should be gated by enough distinct content feedback records');
assert(indexHtml.includes('name="content_plan_id" type="hidden" required') && indexHtml.includes('id="customerSelectedPlan"'), 'customer daily refill must carry an explicit selected content_plan_id');
assert(appJs.includes('data-customer-record-plan') && appJs.includes('selectCustomerEffectPlan') && appJs.includes('请先在上方内容计划里选择实际发布的那一条'), 'customer refill should require the customer to select the exact published plan');
assert(!appJs.includes('const firstPlan = clientState.plans[0]') && !appJs.includes('content_plan_id: firstPlan.id'), 'customer refill must not default feedback to the first plan');
assert(appJs.includes('function customerStateWithLiveGenerated') && appJs.includes('const current = customerStateWithLiveGenerated(loadCustomerTrialState())') && appJs.includes('saveCustomerTrialState(selectedState)') && !appJs.includes('saveCustomerTrialState({ selected_plan_id: planIdValue(plan) })'), 'customer plan selection should preserve the generated state instead of overwriting storage with only selected_plan_id');
const customerEffectSubmitSource = appJs.slice(appJs.indexOf("$('#customerEffectForm')?.addEventListener('submit'"), appJs.indexOf('function dynamicLoopScore'));
assert(customerEffectSubmitSource.includes("if (form.dataset.saving === 'true') return") && customerEffectSubmitSource.includes("submitButton.textContent = '正在保存...'"), 'customer effect save should lock immediately and ignore repeated clicks while advice is generating');
assert(customerEffectSubmitSource.indexOf('persistEffectState();') < customerEffectSubmitSource.indexOf('await requestCustomerDailyAdvice'), 'customer effect data should persist before waiting for AI advice');
assert(customerEffectSubmitSource.includes('clientState.records = nextState.records') && customerEffectSubmitSource.includes('existingRecord') && customerEffectSubmitSource.includes('otherRecords'), 'customer effect save should keep cloud records aligned and update the same round/plan instead of duplicating it');
assert(appJs.includes("resultSection.hidden = !((nextStep === 'plan' || nextStep === 'record') && hasGenerated)"), 'customer record step should keep generated plan context visible while opening the effect form');
assert(appJs.includes("api('/api/customer-growth-advice'") && appJs.includes('daily_advice') && appJs.includes('next_round') && appJs.includes('本条内容优化建议') && appJs.includes('阶段性下一轮建议'), 'customer next-round advice should call the daily advice endpoint but distinguish one-record advice from staged next-round advice');
assert(apiSourceIncludes('callArkChatCompletion') && apiSourceIncludes('ARK_API_KEY') && apiSourceIncludes('VOLCENGINE_ARK_API_KEY') && apiSourceIncludes('ARK_MODEL') && apiSourceIncludes('DOUBAO_MODEL') && apiSourceIncludes('VOLCENGINE_ARK_MODEL') && apiSourceIncludes('CUSTOMER_PUBLIC_MODEL'), 'public customer generation should support Volcengine Ark/Doubao through backend env vars');
assert(apiSourceIncludes('modelProviderFor') && apiSourceIncludes('model_provider') && apiSourceIncludes('model_mode') && apiSourceIncludes('CUSTOMER_STRATEGY_MODEL') && apiSourceIncludes('OPENAI_API_KEY') && apiSourceIncludes('CUSTOMER_COPY_MODEL') && apiSourceIncludes('ANTHROPIC_API_KEY'), 'internal mode should keep lightweight model routing for Ark/OpenAI/Anthropic/local');
assert(apiSourceIncludes("path === '/customer-growth-advice'") && apiSourceIncludes('每日回填必须绑定具体内容计划'), 'API should expose customer-growth-advice and reject unbound daily refill');
assert(appJs.includes('function buildVersionedProjectState') && appJs.includes('diagnosis_history') && appJs.includes('intake_history'), 'customer/internal submissions should create versioned project states');
assert(appJs.includes('customer_public') && appJs.includes('saveLocal();') && appJs.includes('scheduleCloudSync'), 'customer public submissions should enter the same project store and cloud sync path');
assert(appJs.includes('function regenerateCurrentDiagnosis') && appJs.includes('旧诊断已归档'), 'internal workbench should support rediagnosis with archived old diagnoses');
assert(appJs.includes('已记录这条内容。系统先给出本条优化建议') && appJs.includes('结束本轮，使用第') && appJs.includes('就能解锁更准的下一轮建议') && !appJs.includes('已记录这条内容。系统已生成复盘判断和下一轮内容计划'), 'effect save should not present a full next-round plan after only one feedback record');
assert(appJs.includes('盆底肌修复'), 'customer offer extraction should recognize postpartum pelvic-floor repair instead of generic service wording');

assert(appJs.includes('function autoReviewFromFeedback()'), 'app should auto-generate weekly review from existing feedback');
assert(appJs.includes('保存至少 1 条发布链接和反馈后') || appJs.includes('这里会自动生成周复盘'), 'weekly review empty state should explain auto review');
assert(appJs.includes('function planUiMeta'), 'plan cards should classify priority/pending/done states');
assert(appJs.includes('plan-next') && appJs.includes('今日优先'), 'first pending plan should be visually distinguished in-place');
assert(appJs.includes('openClientEvidence') && appJs.includes('客户输入') && appJs.includes('系统判断') && (appJs.includes('内容复盘依据') || indexHtml.includes('内容表现依据')), 'evidence should be reachable with customer-facing labels');
assert(appJs.includes('查看判断依据') && !appJs.includes('为什么？') && !appJs.includes('依据 ${evidenceLink'), 'duplicate evidence labels should be collapsed into one action');
assert(appJs.includes('war-main-row') && appJs.includes('war-decision-main'), 'next decision should stay in the top war-room layout');
assert(appJs.includes('function renderOutcomeCards') && appJs.includes('war-metrics'), 'outcome metrics should live inside the top war-room layout');
assert(appJs.indexOf('下一步判断') < appJs.indexOf('function renderOutcomeCards'), 'next decision should stay before outcome metrics');
assert(!appJs.includes('首条待回填'), 'first-link gate should not duplicate the plan cards');
assert(appJs.includes('plans.slice(0, 3)') && appJs.includes('查看发布角度'), 'plan summary should show only three scan-friendly cards with details collapsed');
assert(indexHtml.includes('<title>获客罗盘｜FP Matrix 企业第一方增长智能</title>'), 'default title should expose the FP Matrix master brand and customer-facing product name without version text');
assert(indexHtml.includes('/app.js?v=1.6.157') && indexHtml.includes('/styles.css?v=1.6.157') && indexHtml.includes('/war-room-v1.6.1.css?v=1.6.157'), 'public customer page should use the v1.6.157 cache-busted asset references');
assert(indexHtml.includes('<body class="customer-mode">') && indexHtml.includes("path === '/internal' || path.startsWith('/internal/')") && indexHtml.indexOf('<body class="customer-mode">') < indexHtml.indexOf('id="customerApp"'), 'initial HTML should choose the customer skin before first paint and switch internal routes synchronously');
assert(indexHtml.includes("customer-cloud-restore-pending") && stylesCss.includes('body.customer-mode.customer-cloud-restore-pending #customerFormCard') && stylesCss.includes('正在恢复项目'), 'explicit customer links should hide the blank intake form during first-paint cloud restore');
assert(indexHtml.includes('fp-matrix-lockup') && indexHtml.includes('fp-matrix-elephant.svg?v=1.6.157') && indexHtml.includes('/fp-matrix-favicon.svg?v=1.6.157') && indexHtml.includes('<strong>FP</strong><em>MATRIX</em>') && indexHtml.includes('企业第一方增长智能'), 'customer page should expose the official FP Matrix lockup and dedicated favicon');
assert(indexHtml.includes('customer-product-lockup') && indexHtml.includes('/huoke-compass-mark.svg?v=1.6.157') && indexHtml.includes('获客<span>罗盘</span>') && indexHtml.includes('by FP Matrix'), 'customer hero should expose the Huoke Compass product lockup below the parent brand');
assert(huokeCompassMark.includes('<title>获客罗盘产品标志</title>') && huokeCompassMark.includes('#F23B49') && huokeCompassMark.includes('#808080'), 'Huoke Compass mark should be a lightweight vector using approved brand colors');
assert(fpMatrixLogo.includes('viewBox="0 0 182 140"') && fpMatrixLogo.includes('#F23B49') && fpMatrixLogo.includes('FP Matrix 大象标志'), 'FP Matrix logo should use the finalized compact brand-red vector elephant mark');
assert(fpMatrixFavicon.includes('viewBox="0 0 182 182"') && fpMatrixFavicon.includes('#F23B49') && fpMatrixFavicon.includes('FP Matrix 图标'), 'browser favicon should use a dedicated square safe-area vector');
assert(warRoomCss.includes('v1.6.99 FP Matrix and Huoke Compass brand lockups') && warRoomCss.includes('color:#1a1c24') && warRoomCss.includes('color:#4d4d4d') && warRoomCss.includes('letter-spacing:.18em'), 'official lockups should use the approved brand colors, medium MATRIX weight, and tightened Chinese descriptor');
assert([methodHtml, aboutHtml, privacyHtml, termsHtml, contactHtml].every((html) => html.includes('fp-matrix-lockup') && html.includes('企业第一方增长智能')), 'all independent customer information pages should use the same finalized FP Matrix identity');
assert(aboutHtml.includes('让企业拥有自己的增长判断') && aboutHtml.includes('第一方真实') && aboutHtml.includes('持续学习') && aboutHtml.includes('智能辅助') && aboutHtml.includes('为什么叫 FP Matrix') && aboutHtml.includes('First Party'), 'about page should tell the approved first-party growth brand story instead of reading like a feature list');
assert(warRoomCss.includes('v1.6.97 customer information-page spacing and text rhythm') && warRoomCss.includes('body.customer-mode.customer-info-mode .customer-info-pages') && warRoomCss.includes('max-width:none!important'), 'information pages should keep breathing room below the header and use the full card width for lead copy');
assert(indexHtml.includes('class="customer-site-nav"') && indexHtml.includes('使用工具') && !indexHtml.includes('开始填写') && indexHtml.includes('关于我们') && indexHtml.includes('隐私政策') && indexHtml.includes('用户协议') && indexHtml.includes('联系我们'), 'customer page should expose mature website-level trust/navigation entries');
assert(indexHtml.includes('id="customerResumeBanner"') && indexHtml.includes('继续上次项目') && indexHtml.includes('新建空白项目') && appJs.includes('function renderCustomerResumeBanner') && appJs.includes('function startBlankCustomerProject'), 'customer page should distinguish saved local projects from a blank first-customer start');
assert(indexHtml.includes('苏ICP备2026037570号') && !indexHtml.includes('苏ICP备2026037570号-1') && !indexHtml.includes('网信备案：') && indexHtml.includes('https://beian.miit.gov.cn/') && !indexHtml.includes('公安备案'), 'customer footer should show only the corrected ICP filing number and hide unfinished public-security filing');
assert(indexHtml.includes('customer-footer-primary') && indexHtml.includes('customer-footer-meta') && indexHtml.includes('© 2016–2026 南京尚下联信息科技有限公司') && !indexHtml.includes('mailto:contact@fpmatrix.cn') && indexHtml.includes('class="customer-filing-link" href="https://beian.miit.gov.cn/"') && warRoomCss.includes('justify-content:center!important') && warRoomCss.includes('.customer-footer-meta>*:not(:first-child)::before'), 'customer footer should center company and linked filing in one refined meta line without a dangling separator');
assert(!indexHtml.includes('id="customerInfoPages"') && !indexHtml.includes('本地存储与云端同步') && !indexHtml.includes('AI 内容说明'), 'homepage should not inline long policy and agreement content');
assert(aboutHtml.includes('南京尚下联信息科技有限公司') && contactHtml.includes('contact@fpmatrix.cn'), 'independent info pages should expose the service entity and complaint email');
const publicHeaderNav = (html) => html.match(/<div class="customer-site-links">[\s\S]*?<\/div>/)?.[0] || '';
[indexHtml, plansHtml, methodHtml, aboutHtml, contactHtml, privacyHtml, termsHtml, inviteHtml].forEach((html) => {
  const nav = publicHeaderNav(html);
  assert(nav.includes('使用工具') && nav.includes('方法与案例') && nav.includes('关于我们') && nav.includes('data-public-account-menu'), 'every public page should use the same primary navigation and shared account-menu slot');
  assert(!nav.includes('联系我们') && !nav.includes('隐私政策') && !nav.includes('用户协议') && !nav.includes('返回首页'), 'secondary company and policy links must not reappear in the primary navigation');
});
assert([plansHtml, methodHtml, aboutHtml, contactHtml, privacyHtml, termsHtml, inviteHtml].every((html) => html.includes('war-room-v1.6.1.css?v=1.6.138') && html.includes('/public-account-menu.js?v=1.6.138') && !html.includes('class="customer-account-nav" href="/?account=login"')), 'unchanged independent public pages should retain the shared session-aware account menu instead of a static login link');
assert([aboutHtml, contactHtml, privacyHtml, termsHtml].every((html) => !html.includes('>· 苏ICP备')), 'information-page filing links should rely on the shared separator and never render a duplicated dot');
assert(aboutHtml.includes('<h2>联系我们</h2>') && aboutHtml.includes('href="/contact"'), 'contact details should sit beneath the About page while retaining the dedicated support page');
assert(warRoomCss.includes('v1.6.131 public information pages: restrained editorial typography') && warRoomCss.includes('max-width:980px!important') && warRoomCss.includes('font-size:clamp(30px,3.2vw,40px)!important') && warRoomCss.includes('border-radius:0!important'), 'public information pages should use the restrained editorial typography system instead of nested oversized cards');
assert(indexHtml.includes('获客罗盘是一位会跟着真实结果持续调整的') && indexHtml.includes('AI 内容策略助手') && indexHtml.includes('customer-method-teaser') && indexHtml.includes('内容为什么会带来客户'), 'homepage should explain the AI strategy role and provide a lightweight method entry');
assert(appJs.includes('customer-ai-context') && appJs.includes('不是套用固定模板，本次建议已结合') && appJs.includes("['业务', business]") && appJs.includes("['平台', platform]"), 'generated customer advice should show the real business context used instead of claiming a fixed template');
assert(methodHtml.includes('典型经营场景演示') && methodHtml.includes('不代表特定客户案例') && methodHtml.includes('不构成效果或收益承诺') && methodHtml.includes('同一项服务，两种完全不同的表达'), 'method page should use an explicitly illustrative scenario instead of inventing a real customer case');
assert(methodHtml.includes('小红书') && methodHtml.includes('抖音') && methodHtml.includes('视频号') && methodHtml.includes('被看见') && methodHtml.includes('持续优化'), 'method page should explain platform content mechanisms and the customer growth path');
assert(warRoomCss.includes('v1.6.133 method entry and scenario page') && warRoomCss.includes('.customer-expression-compare') && warRoomCss.includes('.customer-growth-path'), 'method entry and scenario page should have responsive, scoped presentation styles');
assert(warRoomCss.includes('.customer-growth-path li{') && warRoomCss.includes('margin-top:0!important'), 'method growth-path steps should override generic adjacent-list spacing so labels and arrows stay aligned');
assert(privacyHtml.includes('本地存储与云端同步') && privacyHtml.includes('第三方服务与模型调用') && privacyHtml.includes('查阅、复制、更正、补充、删除'), 'privacy policy should cover storage, model calls and data-subject rights');
assert(!indexHtml.includes('id="customerPrivacySettingsBtn"') && indexHtml.includes('id="customerFooterPrivacySettingsBtn"') && indexHtml.includes('id="personalizedRecommendationToggle"') && indexHtml.includes('个性化推荐/推送'), 'privacy settings should move out of the primary navigation while remaining accessible to signed-out customers');
assert(indexHtml.includes('id="customerAccountBtn"') && indexHtml.includes('data-public-account-label') && indexHtml.includes('/public-account-menu.js?v=1.6.157') && indexHtml.includes('id="customerAccountDialog"') && indexHtml.includes('id="customerAccountEmailForm"') && indexHtml.includes('id="customerAccountCodeForm"') && indexHtml.includes('id="customerAccountPrivacySettings"'), 'customer navigation should expose the shared account menu while retaining account verification, projects and privacy dialogs');
assert(publicAccountMenuJs.includes("fetch('/api/auth/session'") && publicAccountMenuJs.includes("fetch('/api/account/entitlements'") && publicAccountMenuJs.includes("fetch('/api/auth/logout'") && publicAccountMenuJs.includes("window.location.assign('/invite')") && publicAccountMenuJs.includes('剩余用量'), 'shared public account menu should read the real session and quota, enter the invitation center, and perform backend logout');
assert(publicAccountMenuJs.includes('initPublicNavigationState') && publicAccountMenuJs.includes('publicNavIcon') && publicAccountMenuJs.includes("link.setAttribute('aria-current', 'page')") && !publicAccountMenuJs.includes("link.classList.add('is-navigating')"), 'public navigation should add consistent leading icons and retain a destination-page state without a synthetic loading indicator');
assert(warRoomCss.includes('a[aria-current="page"]') && warRoomCss.includes('.public-nav-icon') && warRoomCss.includes('a:hover') && !warRoomCss.includes('.public-navigation-status') && !warRoomCss.includes('public-nav-progress') && !warRoomCss.includes('public-nav-soft-glow'), 'public navigation should change icon and label color on hover/current state without a spinner, progress bar, status toast or glow animation');
assert(inviteHtml.includes('邀请好友，获得 7 天 Plus 权益') && inviteHtml.includes('好友通过你的专属链接首次注册') && inviteJs.includes("fetch('/api/referrals/me'") && inviteJs.includes('navigator.share'), 'invitation center should explain effective invitations, load server-owned rewards, and support native sharing');
assert(redirects.includes('/invite /invite/index.html 200'), 'Netlify redirects should expose the invitation center');
assert(localDevServer.includes("['about', 'method', 'plans', 'invite', 'privacy', 'terms', 'contact']"), 'local preview should resolve every independent public navigation page used in browser QA');
assert(indexHtml.includes('class="customer-account-code-head"') && indexHtml.includes('class="customer-account-change-email"') && indexHtml.includes('>修改邮箱</button>') && warRoomCss.includes('#customerAccountCodeForm .customer-account-change-email{'), 'verification state should present email switching as a quiet field-level action instead of a standalone pill');
assert(warRoomCss.includes('gap:5px!important') && warRoomCss.includes('min-height:31px!important') && warRoomCss.includes('font-weight:500!important') && warRoomCss.includes('padding:7px 9px!important'), 'customer navigation should retain a compact, lower-weight hierarchy while giving icon links a precise hover target');
assert(appJs.includes("api('/api/auth/email/start'") && appJs.includes("api('/api/auth/email/verify'") && appJs.includes("api('/api/account/link-client'") && appJs.includes('ACCOUNT_RESTORE_PROJECT_KEY'), 'customer account UI should verify email, bind the current project, and restore a selected cloud project');
assert(appJs.includes('showLoading = true') && appJs.includes('hasKnownAccountState') && appJs.includes('loadCustomerAccountSession({showLoading: !hasKnownAccountState})'), 'known signed-out customers should see the email form immediately while account state refreshes in the background');
assert(appJs.includes("api('/api/user/settings'") && appJs.includes("method:'PATCH'") && appJs.includes('personalized_recommendation_enabled') && appJs.includes('USER_SETTINGS_STORAGE_PREFIX'), 'customer personalization setting should persist locally and through the backend settings API');
assert(apiSourceIncludes("path === '/user/settings'") && apiSourceIncludes('applyPersonalizationPolicy') && apiSourceIncludes('nonPersonalizedAssessment') && apiSourceIncludes('personalization_mode'), 'backend recommendation routes should enforce personalized and non-personalized modes');
assert(privacyHtml.includes('你可以在隐私设置中关闭个性化推荐/推送') && privacyHtml.includes('个人偏好、历史行为或用户画像') && privacyHtml.includes('邀请归因') && privacyHtml.includes('不向邀请人展示好友邮箱'), 'privacy policy should explain personalization controls and privacy-safe referral records');
assert(privacyHtml.includes('订单与权益信息') && privacyHtml.includes('到账核验记录') && termsHtml.includes('套餐、订单与付款') && termsHtml.includes('当前采用人工到账确认，不自动续费'), 'public policies should explain the P1 order data and manual non-renewing payment mode');
assert(termsHtml.includes('AI 内容说明') && termsHtml.includes('禁止行为') && termsHtml.includes('内容效果和责任限制') && termsHtml.includes('不承诺固定流量、咨询量、成交量或商业结果') && termsHtml.includes('投诉与争议处理'), 'terms should cover AI content, prohibited behavior, effect disclaimer and complaint handling');
assert(redirects.includes('/about /about/index.html 200') && redirects.includes('/method /method/index.html 200') && redirects.includes('/privacy /privacy/index.html 200') && redirects.includes('/terms /terms/index.html 200') && redirects.includes('/contact /contact/index.html 200'), 'customer info pages should rewrite to independent static pages');
assert(indexHtml.includes('获客<span>罗盘</span>') && indexHtml.includes('让每一次发布，都成为下一次增长的依据') && indexHtml.includes('customer-first-screen') && indexHtml.includes('customer-first-form-shell') && !indexHtml.includes('给篮球培训客户的全平台内容矩阵'), 'default customer page should use the approved Huoke Compass brand proposition, not a single-customer static page title');
assert(!indexHtml.includes('填 5 个问题，得到你的内容发布计划') && !indexHtml.includes('customer-hero-bullets') && !indexHtml.includes('customer-steps'), 'customer hero should remove noisy checklist-style guidance and duplicate step card');
assert(indexHtml.includes('id="customerAssessmentForm"') && indexHtml.includes('data-customer-problems'), 'customer page should use the customer trial form and problem cards');
assert(indexHtml.includes('id="internalApp" hidden') && indexHtml.includes('内测版 · 智能诊断内核'), 'internal workbench should be hidden by default but expose the internal smart diagnosis kernel label');
assert(indexHtml.includes('id="customerGuide"') && indexHtml.includes('填写示例') && !indexHtml.includes('id="customerGuide" class="customer-guide-panel" open') && warRoomCss.includes('body.customer-mode .customer-side{display:none'), 'customer page should keep examples available in markup but hidden from the default first screen');
assert(indexHtml.includes('本地服务机构，主要做专业服务和咨询转化') && indexHtml.includes('让目标客户看懂服务价值') && indexHtml.includes('填入通用示例') && indexHtml.includes('我知道怎么填了'), 'customer guide should show generic public examples and a sample-fill action');
assert(!indexHtml.includes('id="heroPrimaryBtn"') && !indexHtml.includes('id="sampleBtn"'), 'hero should remove duplicate primary/sample buttons');
assert(indexHtml.includes('id="topReturnProjectBtn"'), 'new project return action should sit next to the More button');
assert(indexHtml.includes('填入基本信息') && indexHtml.includes('生成我的内容建议'), 'first form should present a clear low-noise basic information intake');
assert(indexHtml.includes('开始生成内容建议') && indexHtml.includes('href="#customerFormCard"'), 'customer hero should expose a clear start/fill info entry');
assert(indexHtml.includes('customer-hero-product') && indexHtml.includes('hidden') && !indexHtml.includes('查看已生成建议'), 'customer first screen should hide the product capability panel and remove the secondary hero action by default');
assert(indexHtml.includes('customer-mini-icon customer-icon-platform') && indexHtml.includes('customer-mini-icon customer-icon-topic') && indexHtml.includes('customer-mini-icon customer-icon-loop') && indexHtml.includes('customer-mini-icon customer-icon-brief'), 'customer page should keep the refined product icon system for progressive surfaces');
assert(warRoomCss.includes('v1.6.69 customer homepage de-noise') && warRoomCss.includes('body.customer-mode .customer-hero-product{display:none') && warRoomCss.includes('body.customer-mode .customer-field-examples{display:none') && warRoomCss.includes('body.customer-mode .cps-item:first-child .cps-label'), 'customer mode should keep the light skin but reduce first-screen density and preserve the first nav label');
assert(warRoomCss.includes('v1.6.70 customer progress visibility fix') && warRoomCss.includes('body.customer-mode .customer-progress-strip button.cps-item.cps-active') && warRoomCss.includes('opacity:1!important'), 'customer mode should override transparent button styles so the active progress label stays visible');
assert(warRoomCss.includes('v1.6.71 productized first screen') && warRoomCss.includes('body.customer-mode .customer-first-screen') && warRoomCss.includes('body.customer-mode .customer-first-form-shell') && warRoomCss.includes('body.customer-mode .customer-footer-meta span'), 'customer mode should expose a productized first screen and clearer footer meta');
assert(warRoomCss.includes('v1.6.73 refined legal footer') && warRoomCss.includes('body.customer-mode .customer-site-footer') && warRoomCss.includes('background:transparent!important') && warRoomCss.includes('box-shadow:none!important') && warRoomCss.includes('color:#8b93a1!important') && warRoomCss.includes('font-weight:520!important'), 'customer footer legal information should be light grey, readable, and not visually heavy');
assert(warRoomCss.includes('v1.6.74 hero typography refinement') && warRoomCss.includes('font-size:clamp(38px,4.2vw,52px)!important') && warRoomCss.includes('line-height:1.18!important') && warRoomCss.includes('letter-spacing:0!important'), 'customer hero headline should use calmer Chinese typography');
assert(warRoomCss.includes('v1.6.75 first-screen balance') && warRoomCss.includes('max-width:1128px!important') && warRoomCss.includes('grid-template-columns:minmax(0,0.92fr) minmax(420px,520px)!important') && warRoomCss.includes('align-items:center!important'), 'customer first screen should center the hero copy and form as one balanced product surface');
assert(warRoomCss.includes('v1.6.76 right rail alignment') && warRoomCss.includes('max-width:1120px!important') && warRoomCss.includes('gap:56px!important') && warRoomCss.includes('justify-self:end!important') && warRoomCss.includes('max-width:520px!important'), 'customer brief card should sit on the right rail with more space between hero and form');
assert(indexHtml.includes('你的目标客户是谁？*') && indexHtml.includes('required placeholder="如：附近客户'), 'target customer should be required because advice quality depends on audience');
assert(indexHtml.includes('3 项核心信息') && indexHtml.includes('平台语境识别') && indexHtml.includes('补充更多（可选）') && indexHtml.includes('公司/门店名') && indexHtml.includes('当前产品/服务') && indexHtml.includes('服务区域/交付方式') && indexHtml.includes('可预约时间/服务节奏') && indexHtml.includes('补充说明') && indexHtml.includes('资质/服务保障（可选）') && indexHtml.includes('没有也可以先不填') && indexHtml.includes('客户最常问的问题或顾虑') && indexHtml.includes('你现在手里有什么素材？') && indexHtml.includes('最近表现最好的一条内容/对标内容'), 'customer page should expose only 3 required fields first and keep trust/detail fields optional');
assert(indexHtml.includes('<input type="hidden" name="current_channels" />') && indexHtml.includes('<input type="hidden" name="biggest_problem" />') && appJs.includes("current_channels: rawForm.current_channels || '还不确定'") && appJs.includes("biggest_problem: rawForm.biggest_problem || '不知道发什么'"), 'customer minimal intake should make platform/problem optional with safe generation defaults');
assert(appJs.includes('BASKETBALL_CUSTOMER_PROFILE') && appJs.includes('dedicatedCustomerKey') && appJs.includes('只需要补充上课地址和可预约时间') && appJs.includes('store_location') && appJs.includes('course_schedule') && appJs.includes('coach_credentials'), 'basketball prefill should be isolated behind a dedicated customer URL and keep detail fields optional');
assert(appJs.includes('rawForm.offer || customerOfferFromGoal') && appJs.includes('rawForm.customer_pain || rawForm.biggest_problem'), 'customer submit should preserve optional precision fields instead of overwriting them');
assert(appJs.includes('function fillGenericCustomerSample') && appJs.includes('customerGenericSampleBtn') && appJs.includes("current_channels: '抖音,小红书'") && appJs.includes('function prefillDedicatedCustomer') && appJs.includes('BASKETBALL_CUSTOMER_PROFILE'), 'customer page should include generic public sample fill and isolated dedicated prefill helpers');
assert(indexHtml.includes('class="customer-choice-chip" type="button" data-value="有浏览没咨询"'), 'customer biggest problem should use checkbox-like chips');
assert(indexHtml.includes('id="customerBriefPreview"') && appJs.includes('function renderCustomerBriefPreview') && warRoomCss.includes('.customer-brief-preview-panel'), 'customer intake should include a live growth brief preview panel');
assert(indexHtml.includes('platform-choice-chip') && indexHtml.includes('data-customer-platforms data-multi-select="true"') && indexHtml.indexOf('data-value="抖音"') < indexHtml.indexOf('data-value="小红书"') && indexHtml.includes('可多选') && !indexHtml.includes('platform-brand-dot') && !indexHtml.includes('platform-douyin') && !indexHtml.includes('platform-redbook') && !indexHtml.includes('platform-video') && !indexHtml.includes('>抖</i>') && !indexHtml.includes('>书</i>') && !indexHtml.includes('>号</i>'), 'customer platform choice should use standard text-only platform labels when official logo assets are unavailable');
assert(indexHtml.includes('data-customer-content-mode') && indexHtml.includes('推荐模式：平台适配') && indexHtml.includes('省事模式：一稿多发') && indexHtml.includes('建议适配，不强迫适配'), 'customer page should let customers choose one-draft multi-posting or platform adaptation');
assert(appJs.includes('function customerPlatformMatrixHtml') && appJs.includes('function customerContentModeHtml') && appJs.includes('一稿多发省时间') && appJs.includes('系统只建议适配，不强迫每个平台都写不同稿') && appJs.includes('短视频曝光 / 案例讲解 / 咨询承接') && appJs.includes('搜索沉淀 / 决策清单 / 案例信任') && appJs.includes('微信信任 / 专业说明 / 私域承接'), 'customer results should explain platform-specific content roles and mode tradeoffs');
assert(indexHtml.includes('默认先看前三条，完整计划用卡片展开，避免密集表格。'), 'plan section should include a short plan hint');
assert(warRoomCss.includes('.feedback-focus[hidden]') && warRoomCss.includes('display:none!important'), 'mobile css must not override hidden feedback/review workflow');
assert(warRoomCss.includes('body.customer-mode') && warRoomCss.includes('.customer-choice-chip span') && warRoomCss.includes('.customer-problem-grid button.is-selected'), 'customer page should separate checkbox-like choices from primary buttons');
assert(warRoomCss.includes('.customer-brief-field-main') && warRoomCss.includes('.customer-field-examples') && warRoomCss.includes('.platform-text-tag') && !warRoomCss.includes('.platform-brand-dot') && !warRoomCss.includes('.platform-mini') && warRoomCss.includes('.customer-more-fields') && warRoomCss.includes('.customer-more-grid') && warRoomCss.includes('越具体越准'), 'brief intake fields, text-only platform tags and optional precision fields should be styled as a polished low-noise section');
assert(warRoomCss.includes('.customer-guide-panel') && warRoomCss.includes('.guide-row p::before'), 'customer filling guide should look like an annotated form card');
assert(indexHtml.includes('<h2>内容数据回填</h2>') && indexHtml.includes('回填记录') && indexHtml.includes('内容表现依据'), 'review evidence should sit next to feedback records');
assert(indexHtml.indexOf('内容表现依据') > indexHtml.indexOf('回填记录'), 'review evidence should appear after feedback records');
assert(indexHtml.lastIndexOf('客户输入与诊断依据') > indexHtml.indexOf('系统判断与下一步') && indexHtml.includes('客户输入 / 系统诊断依据'), 'customer/diagnosis evidence should be grouped inside the weekly review evidence area instead of interrupting plan execution');
assert(indexHtml.includes('保存反馈') && indexHtml.includes('↻ 更新复盘'), 'feedback buttons should be clear');
assert(indexHtml.includes('id="customerRecordSummary"') && indexHtml.includes('只填几个关键数字'), 'customer result after saving should show a lightweight record summary area');
assert(indexHtml.includes('id="customerRegenerateBtn"') && indexHtml.includes('修改信息并重新生成'), 'customer side should provide a lightweight regenerate entry without exposing internal version history');
assert(appJs.includes('function renderCustomerRecordSummary') && appJs.includes('本条内容结果') && appJs.includes('咨询率'), 'customer feedback submit should render actionable result metrics, not only a saved record');
assert(appJs.includes('<summary>为什么这样发</summary>') && appJs.includes('这条发完了，去记录效果') && appJs.includes('customer-plan-lite') && appJs.includes('customer-plan-more'), 'client plan cards should be scan-friendly with collapsed reasoning, progressive disclosure and a clear record action');
assert(indexHtml.includes('填几个数') && indexHtml.includes('曝光') && indexHtml.includes('互动') && indexHtml.includes('咨询') && indexHtml.includes('一句话观察'), 'client effect recording should use the three-step lightweight form with only key numbers and an observation');
assert(appJs.includes('customer-next-actions') && appJs.includes('查看判断依据'), 'client next-seven advice should render one conclusion, checklist actions and folded evidence');
assert(appJs.includes('企业主发内容没咨询，通常不是内容太少') && !appJs.includes('发了很多内容为什么还是没人咨询'), 'internal sample plans should also use target-customer-facing topics');
assert(indexHtml.includes('class="panel-head review-panel-head"') && indexHtml.includes('class="review-primary-btn"'), 'weekly review action should sit in the title row as an obvious primary button');
assert(appJs.includes('review-metric-grid') && appJs.includes('review-decision-grid') && appJs.includes('review-next'), 'weekly review should render as visual cards instead of dense paragraphs');
assert(indexHtml.includes('id="nextSevenDataPage"') && appJs.includes('function buildNextSevenData') && appJs.includes('function renderNextSevenDataPage'), 'internal view should expose a next 7 days data module after weekly review');
assert(appJs.includes('下一个七天数据') && appJs.includes('不代发') && appJs.includes('预计曝光'), 'next 7 days module should be data/prediction focused and must not introduce auto publishing');
assert(appJs.includes('client-snapshot-summary') && appJs.includes('完整客户输入') && appJs.includes('full-plan-card'), 'evidence and full plans should use readable cards instead of dense grids/tables');
assert(appJs.includes("api('/api/state'") && appJs.includes('pullCloudProjectStore') && appJs.includes('pushCloudProjectStore') && appJs.includes('mergeProjectStores'), 'app should sync project store through /api/state for cross-device usage');
assert(warRoomCss.includes('v1.6.13 readability completion') && warRoomCss.includes('.project-switcher span{white-space:nowrap'), 'v1.6.13 css should protect project switcher label and full readability');
assert(indexHtml.includes('曝光｜查看') && indexHtml.includes('互动｜点赞') && indexHtml.includes('互动｜评论') && indexHtml.includes('互动｜收藏') && indexHtml.includes('转化｜咨询'), 'feedback fields should be grouped as growth judgment signals');
assert(shanghaiDateIso(0, new Date('2026-05-16T16:05:00.000Z')) === '2026-05-17', 'Shanghai business date should roll forward at UTC+8 midnight');
assert(shanghaiDateIso(1, new Date('2026-05-16T16:05:00.000Z')) === '2026-05-18', 'Shanghai offset should advance from business date');
assert(timestampToEpoch('2026-08-09 00:48:26') === Date.parse('2026-08-09T00:48:26+08:00'), 'account resend throttling must parse Shanghai business timestamps in UTC+8 instead of server-local UTC');
assert(plans[0].planned_date === shanghaiDateIso(), `planned_date should start today in Asia/Shanghai, got ${plans[0].planned_date}`);
assert(!plans[0].topic.includes('本地生活服务商家、中小企业负责人'), 'topic should use short audience label, not field-stuffed target_customer');
assert(!plans[0].topic.includes('小老板'), 'first topic should avoid 小老板 wording');
assert(!JSON.stringify(plans.map((p) => p.topic)).includes('为什么你发了') && !JSON.stringify(plans.map((p) => p.topic)).includes('客户迟迟不咨询') && !JSON.stringify(plans.map((p) => p.topic)).includes('负责人亲自讲'), '7-day plan topics should use end-customer perspective, not operator/internal perspective');
assert(plans.some((p) => /企业主|老板|客户|选择|第一次了解|担心|适不适合|到店前/.test(p.topic)), '7-day plan should include target-customer-facing topics, not internal/operator-only topics');
assert(plans.every((p) => p.publish_quality), 'each plan should include publish_quality');
assert(plans.some((p) => p.publish_quality.includes('可直接进入草稿')), 'plans should mark draft-ready items');
assert(plans.some((p) => p.publish_quality.includes('仅为策略方向')), 'plans should mark data-dependent items');

const basketballAdviceCase = await submitAssessment({
  company_name: '星跃少儿篮球训练营',
  industry: '少儿篮球培训',
  main_goal: '连续3天验证内容是否能带来体验课咨询',
  target_customer: '6-12岁孩子家长，担心孩子运动基础差、上课安全和教练专业度',
  offer: '少儿篮球体验课，99元一次，适合零基础和基础薄弱孩子',
  store_location: '星悦篮球社区训练馆，服务附近三公里家庭',
  course_schedule: '周三/周五晚课，周末上午体验课，寒暑假可预约集训班',
  coach_credentials: '持证教练带课，小班教学，课前热身拉伸，训练过程有安全保护，家长可旁听。',
  customer_pain: '家长担心孩子跟不上、训练不安全、体验课只是推销、上课时间不合适',
  current_channels: '小红书、视频号',
  posting_frequency: '每天1条',
  biggest_problem: '有浏览没咨询',
  content_assets: '课堂训练片段、教练资质、孩子进步前后对比、家长反馈截图',
  best_recent_content: '孩子第一次运球从怕球到敢拍球的课堂片段，家长评论问适合几岁',
  contact: '篮球培训3天验收',
});
assert(basketballAdviceCase.assessment.company_name === '星跃少儿篮球训练营', 'basketball company_name should be treated as the brand name');
assert(basketballAdviceCase.assessment.store_location === '星悦篮球社区训练馆，服务附近三公里家庭', 'basketball store location should be saved into assessment state');
assert(basketballAdviceCase.assessment.course_schedule.includes('周末上午体验课'), 'basketball course schedule should be saved into assessment state');
assert(basketballAdviceCase.assessment.coach_credentials.includes('安全保护'), 'basketball coach credentials/safety field should be saved into assessment state');

const basketballWithoutOptionalTrust = await submitAssessment({
  company_name: '星悦篮球',
  industry: '少儿篮球培训',
  main_goal: '让附近家长预约体验课',
  target_customer: '附近三公里内6-12岁孩子家长',
  offer: '少儿篮球体验课',
  store_location: '星悦篮球社区训练馆',
  course_schedule: '周末上午可预约',
  current_channels: '抖音、小红书',
  posting_frequency: '偶尔发布',
  biggest_problem: '有浏览没咨询',
});
assert(basketballWithoutOptionalTrust.plans.length === 7 && basketballWithoutOptionalTrust.assessment.coach_credentials === '', 'missing optional coach/safety/case details must not block customer content generation');

const basketballRecords = [];
const dailyAdvice = [];
for (const [index, metrics] of [
  { views: 260, engagement: 8, consultations: 0, notes: '第一天曝光少，家长主要问几岁能学。' },
  { views: 1260, engagement: 58, consultations: 0, notes: '第二天收藏多但没人预约，评论担心安全和孩子跟不上。' },
  { views: 980, engagement: 46, consultations: 5, notes: '第三天有5个体验课咨询，集中问周末班和零基础。' },
  { views: 1480, engagement: 90, consultations: 9, notes: '第四天咨询更多，家长集中问周末班名额和体验课安排。' },
].entries()) {
  const plan = basketballAdviceCase.plans[index];
  const record = {
    content_plan_id: plan.id,
    plan_topic: plan.topic,
    published_at: shanghaiDateIso(index),
    created_at: shanghaiDateIso(index) + ' 10:00:00',
    publish_link: 'https://example.com/basketball-day-' + (index + 1),
    ...metrics,
  };
  const res = await handler(request('POST', 'customer-growth-advice', {
    request_id: `basketball-advice-day-${index + 1}-0001`,
    client_id: 'basketball-advice-cycle',
    assessment: basketballAdviceCase.assessment,
    diagnosis: basketballAdviceCase.diagnosis,
    plans: basketballAdviceCase.plans,
    records: [record, ...basketballRecords],
    record,
    selected_plan_id: plan.id,
  }));
  if (res.status !== 200) throw new Error('customer-growth-advice day ' + (index + 1) + ' expected 200, got ' + res.status + ': ' + await res.text());
  const body = await res.json();
  dailyAdvice.push(body);
  basketballRecords.unshift(record);
}
assert(new Set(dailyAdvice.map((item) => item.advice.judgment)).size === 4, 'basketball 4-day advice judgment should change as daily data changes');
assert(new Set(dailyAdvice.map((item) => item.context_used.selected_plan_id)).size === 4, 'basketball 4-day advice should bind each day to its explicit content plan');
assert(new Set(dailyAdvice.map((item) => item.advice.nextTopic)).size >= 3, 'basketball 4-day next topics should progress instead of looping old plans');
assert(dailyAdvice[0].context_used.history_feedback_count === 0 && dailyAdvice[1].context_used.history_feedback_count === 1 && dailyAdvice[2].context_used.history_feedback_count === 2 && dailyAdvice[3].context_used.history_feedback_count === 3, 'basketball advice should include growing historical feedback context');
dailyAdvice.forEach((item, index) => {
  const completedTopics = basketballAdviceCase.plans.slice(0, index + 1).map((plan) => plan.topic);
  const historicalTopics = basketballAdviceCase.plans.slice(0, index).map((plan) => plan.topic);
  assert(!completedTopics.some((topic) => item.context_used.unpublished_plan_topics.includes(topic)), 'unpublished plans should exclude completed basketball plan topics through day ' + (index + 1));
  assert(!historicalTopics.includes(item.advice.nextTopic), 'nextTopic should not return to historical basketball plan topic on day ' + (index + 1));
});
const skippedFirstPlanRes = await handler(request('POST', 'customer-growth-advice', {
  request_id: 'basketball-advice-skip-first-0001',
  client_id: 'basketball-advice-cycle',
  assessment: basketballAdviceCase.assessment,
  diagnosis: basketballAdviceCase.diagnosis,
  plans: basketballAdviceCase.plans,
  records: [],
  record: {
    content_plan_id: basketballAdviceCase.plans[1].id,
    plan_topic: basketballAdviceCase.plans[1].topic,
    published_at: shanghaiDateIso(1),
    created_at: shanghaiDateIso(1) + ' 12:00:00',
    publish_link: 'https://example.com/basketball-skip-first',
    views: 1320,
    engagement: 64,
    consultations: 6,
    notes: '客户先发布第二条计划，下一条建议不能倒退回第一条。',
  },
  selected_plan_id: basketballAdviceCase.plans[1].id,
}));
if (skippedFirstPlanRes.status !== 200) throw new Error('customer-growth-advice skipped first plan expected 200, got ' + skippedFirstPlanRes.status + ': ' + await skippedFirstPlanRes.text());
const skippedFirstPlanAdvice = await skippedFirstPlanRes.json();
assert(!skippedFirstPlanAdvice.context_used.unpublished_plan_topics.includes(basketballAdviceCase.plans[0].topic), 'skipping to day 2 should not put day 1 back into unpublished candidates');
assert(skippedFirstPlanAdvice.advice.nextTopic !== basketballAdviceCase.plans[0].topic, 'skipping to day 2 should not recommend day 1 as the next topic');
assert(dailyAdvice[2].advice.judgment.includes('5个咨询') || dailyAdvice[2].advice.judgment.includes('咨询'), 'day 3 advice should react to consultation data');
assert(dailyAdvice.every((item) => item.next_round && item.next_round.review_judgment && Array.isArray(item.next_round.next_7_day_plan) && item.next_round.next_7_day_plan.length === 7), 'customer-growth-advice should return a review judgment and full next-round 7-day plan');
assert(dailyAdvice[2].next_round.review_judgment.type === '加码', `day 3 next-round judgment should 加码 after consultation data, got ${dailyAdvice[2].next_round.review_judgment.type}`);
assert(dailyAdvice[2].next_round.review_judgment.decision === '加码', 'day 3 next-round judgment should explicitly decide to amplify after consultation data');
assert(dailyAdvice[2].customer_summary.includes('多发') && dailyAdvice[2].customer_summary.includes('少发'), 'customer summary should say what to post more and less next week');
assert(dailyAdvice[2].next_7_day_plan.every((row) => row.target_metric && row.based_on && row.experiment_type && row.why_platform_fit && Array.isArray(row.observe_metrics) && row.next_adjustment), 'next-round plan rows should include target_metric, based_on, experiment type, platform fit, metrics and adjustment');
assert(dailyAdvice[2].next_7_day_plan.every((row) => row.customer_reasoning?.customer_voice_basis && row.customer_reasoning?.proof_basis && row.customer_reasoning?.decision_rule), 'next-round public plans should preserve customer voice, evidence guidance and a measurable adjustment rule');
assert(!JSON.stringify(dailyAdvice[2]).includes('strategy_quality'), 'customer next-round response should hide the internal strategy-quality record');
const firstRoundBasketballTopics = new Set(basketballAdviceCase.plans.map((plan) => plan.topic));
dailyAdvice.forEach((item, index) => {
  const nextRoundTopics = item.next_7_day_plan.map((row) => row.topic);
  assert(nextRoundTopics.length === new Set(nextRoundTopics).size, 'next-round basketball topics should be unique on day ' + (index + 1));
  assert(!nextRoundTopics.some((topic) => firstRoundBasketballTopics.has(topic)), 'next-round basketball topics should not repeat first-round plan topics on day ' + (index + 1));
});
const basketballNextRoundText = JSON.stringify(dailyAdvice[2].next_7_day_plan.map((row) => row.topic));
assert(/体验课|家长|孩子|体能|周末班|零基础/.test(basketballNextRoundText), 'next-round basketball plan should use feedback-specific basketball semantics instead of generic education templates');
const secondRoundPlans = dailyAdvice[2].next_7_day_plan.map((row, index) => ({
  ...row,
  id: `basketball-r2-${index + 1}`,
  topic: row.topic,
  platform: row.platform || '小红书',
}));
const secondRoundRecord = {
  content_plan_id: secondRoundPlans[0].id,
  plan_topic: secondRoundPlans[0].topic,
  published_at: shanghaiDateIso(8),
  created_at: shanghaiDateIso(8) + ' 10:00:00',
  publish_link: 'https://example.com/basketball-round-2-day-1',
  views: 1720,
  engagement: 88,
  consultations: 7,
  notes: '第二轮第一条也有体验课咨询，家长继续问零基础和周末班。',
};
const thirdRoundRes = await handler(request('POST', 'customer-growth-advice', {
  request_id: 'basketball-advice-third-round-0001',
  client_id: 'basketball-advice-cycle',
  assessment: basketballAdviceCase.assessment,
  diagnosis: basketballAdviceCase.diagnosis,
  plans: secondRoundPlans,
  previous_rounds: [{ round_number: 1, plans: basketballAdviceCase.plans }],
  records: [secondRoundRecord, ...basketballRecords],
  record: secondRoundRecord,
  selected_plan_id: secondRoundPlans[0].id,
}));
if (thirdRoundRes.status !== 200) throw new Error('customer-growth-advice third round expected 200, got ' + thirdRoundRes.status + ': ' + await thirdRoundRes.text());
const thirdRoundAdvice = await thirdRoundRes.json();
const secondRoundTopicSet = new Set(secondRoundPlans.map((plan) => plan.topic));
const thirdRoundTopics = thirdRoundAdvice.next_7_day_plan.map((row) => row.topic);
assert(thirdRoundAdvice.next_7_day_plan.length === 7, 'third-round basketball advice should return another 7-day plan');
assert(thirdRoundTopics.length === new Set(thirdRoundTopics).size, 'third-round basketball topics should be unique');
assert(!thirdRoundTopics.some((topic) => secondRoundTopicSet.has(topic)), 'third-round basketball topics should not repeat second-round plan topics');
assert(!thirdRoundTopics.some((topic) => firstRoundBasketballTopics.has(topic)), 'third-round basketball topics should not revive first-round plan topics when previous_rounds are provided');
assert(/体验课|家长|孩子|体能|周末班|零基础/.test(JSON.stringify(thirdRoundTopics)), 'third-round basketball plan should continue using basketball-specific feedback semantics');
assert(dailyAdvice.every((item) => !('model_info' in item) && !('generation_meta' in item) && !('transparent_note' in item)), 'anonymous customer-growth-advice responses must strip model metadata');
assert(dailyAdvice.every((item) => !/"requested_model"|"actual_model"|"provider"|"fallback_reason"|"raw_usage"/.test(JSON.stringify(item))), 'anonymous customer-growth-advice responses must not leak nested model fields');
const internalAdviceEvidenceRes = await handler(internalRequest('POST', 'customer-growth-advice', {
  request_id: 'basketball-advice-internal-0001',
  client_id: 'basketball-advice-internal',
  assessment: basketballAdviceCase.assessment,
  diagnosis: basketballAdviceCase.diagnosis,
  plans: basketballAdviceCase.plans,
  records: [basketballRecords[0]],
  record: basketballRecords[0],
  selected_plan_id: basketballRecords[0].content_plan_id,
  client_mode: 'internal_test',
  source: 'internal_test',
}));
assert(internalAdviceEvidenceRes.status === 200, 'authorized internal customer-growth-advice should succeed');
const internalAdviceEvidence = await internalAdviceEvidenceRes.json();
assert(internalAdviceEvidence.model_info && internalAdviceEvidence.generation_meta, 'authorized internal customer-growth-advice should retain model evidence');
assert(internalAdviceEvidence.model_info.provider === 'local' && internalAdviceEvidence.model_info.actual_model === 'rule_template' && typeof internalAdviceEvidence.model_info.fallback === 'boolean', 'authorized internal advice should expose rule_template model evidence');

const unboundAdvice = await handler(request('POST', 'customer-growth-advice', {
  request_id: 'basketball-advice-unbound-0001',
  client_id: 'basketball-advice-unbound',
  assessment: basketballAdviceCase.assessment,
  diagnosis: basketballAdviceCase.diagnosis,
  plans: basketballAdviceCase.plans,
  records: [],
  record: { views: 100, engagement: 2, consultations: 0 },
}));
assert(unboundAdvice.status === 400, 'customer-growth-advice should reject records without explicit content_plan_id');

const preferredName = await submitAssessment({
  ...payload,
  account_preference: '企业获客复盘号',
});
assert(preferredName.diagnosis.account_setup.account_name === '企业获客复盘号', 'account_preference should override default account name');

const noCompanyName = await submitAssessment({
  industry: '本地亲子摄影工作室',
  main_goal: '提升小红书咨询和到店预约',
  target_customer: '25-38岁宝妈',
  current_channels: '小红书',
  posting_frequency: '偶尔发布',
  biggest_problem: '没咨询',
});
assert(noCompanyName.assessment.company_name === '', 'empty company_name should stay empty instead of becoming 未命名客户');
assert(!JSON.stringify(noCompanyName).includes('未命名客户'), 'no-company output should not include 未命名客户');

const photo = await submitAssessment({
  industry: '广州本地高端儿童摄影工作室，主打满月照、周岁照和亲子纪实拍摄',
  main_goal: '通过小红书内容获得宝妈咨询和到店预约',
  target_customer: '一二线城市新手妈妈、重视审美和纪念感的家庭',
  current_channels: '小红书',
  posting_frequency: '偶尔发布',
  biggest_problem: '没咨询',
});
assert(photo.plans.some((plan) => plan.topic.includes('拍满月照') || plan.topic.includes('儿童摄影作品') || plan.topic.includes('最在意的不是价格')), 'photo plans should generate human-readable content titles');
assert(!JSON.stringify(photo.plans).includes('最关心的3个广州本地高端儿童摄影工作室'), 'photo plans should not stuff the long industry field into titles');
assertCustomerFacingPlans('photo service output', photo);

const beauty = await submitAssessment({
  company_name: '本地美容美甲门店',
  industry: '美容美甲门店',
  main_goal: '获得更多到店预约',
  target_customer: '附近3公里爱美客户和通勤女性',
  offer: '美甲美睫到店体验套餐',
  customer_pain: '担心效果不自然、价格不透明、卫生不放心',
  current_channels: '小红书、抖音、朋友圈',
  posting_frequency: '每周3条',
  biggest_problem: '发了内容但没咨询',
});
assertNoWrongDefaultScenario('beauty service output', beauty);
assert(beauty.diagnosis.platform_recommendations.primary.some((x) => x.platform === '小红书'), 'beauty shop should prioritize 小红书');
assert(beauty.diagnosis.platform_recommendations.primary.some((x) => x.platform === '抖音'), 'beauty shop should prioritize 抖音');
assert(JSON.stringify(beauty).includes('美容美甲门店'), 'beauty output should preserve industry');
const beautyPlanText = JSON.stringify(beauty.plans.map((plan) => [plan.topic, plan.angle, plan.cta]));
assert(/显白美甲|短甲女生|通勤|真实客照|款式/.test(beautyPlanText), 'nail/beauty plans should speak to end customers choosing nail styles and booking a visit');
assert(!/美业服务|判断标准|适不适合你|内容曝光不足/.test(beautyPlanText), 'nail/beauty plans should avoid generic beauty-service/operator wording');
assertCustomerFacingPlans('beauty service output', beauty);

const education = await submitAssessment({
  company_name: '本地教育培训机构',
  industry: '教育培训机构',
  main_goal: '获得更多试听课报名',
  target_customer: '本地家长和小学阶段学生家庭',
  offer: '数学思维试听课',
  customer_pain: '担心孩子跟不上、试听后不知道是否适合',
  current_channels: '视频号、小红书、朋友圈',
  posting_frequency: '每周3条',
  biggest_problem: '不知道发什么',
});
assertNoWrongDefaultScenario('education service output', education);
assert(education.diagnosis.platform_recommendations.primary.some((x) => x.platform === '视频号'), 'education should include 视频号');
assert(JSON.stringify(education).includes('教育培训机构'), 'education output should preserve industry');
assertCustomerFacingPlans('education service output', education);

const accessory = await submitAssessment({
  company_name: '饰品零售客户',
  industry: '饰品店，主要卖耳饰、项链、手链、戒指等时尚配饰，也有新品上新和礼物款',
  main_goal: '增加产品曝光度，带来咨询询价和订单',
  target_customer: '18-35岁爱美的女士，关注通勤穿搭、约会拍照、送礼和日常精致感',
  offer: '耳饰、项链、手链、戒指、礼物款饰品',
  customer_pain: '不知道发什么，担心图片好看但没有人咨询下单',
  current_channels: '小红书、抖音、朋友圈',
  posting_frequency: '偶尔发布',
  biggest_problem: '不知道发什么',
});
assertRetailAccessoryPlans('accessory retail output', accessory);
assertCustomerFacingPlans('accessory retail output', accessory);

const basketballGoods = await submitAssessment({
  company_name: '篮球销售客户',
  industry: '篮球销售，卖篮球、训练篮球、比赛篮球、篮球用品，主要做线上曝光和咨询订单',
  main_goal: '增加产品曝光度，带来订单',
  target_customer: '学生、篮球运动爱好者',
  offer: '室内篮球、室外耐磨篮球、训练篮球、比赛篮球',
  customer_pain: '学生不知道怎么选篮球，担心买错尺寸、材质和场地不适合',
  current_channels: '小红书',
  posting_frequency: '偶尔发布',
  biggest_problem: '发了没流量',
});
const basketballGoodsText = JSON.stringify(basketballGoods.plans.map((plan) => [plan.topic, plan.angle, plan.cta, plan.qa_note]));
assert(/篮球|室内球|室外球|耐磨|控球|水泥地|学生|爱好者|训练球|比赛球/.test(basketballGoodsText), 'basketball goods plans should focus on basketball product selection');
['相关服务', '服务流程', '服务前', '到店前', '预约咨询', '体验课', '篮球课', '教练', '班型'].forEach((word) => {
  assert(!basketballGoodsText.includes(word), `basketball goods plans must not include ${word}`);
});
assert(basketballGoods.diagnosis.platform_recommendations.primary.map((x) => x.platform).join('|') === '小红书|抖音|朋友圈/私域', 'basketball goods should use product retail channel mix');
assert(!basketballGoods.diagnosis.smart_context, 'customer/default assessment should not expose internal smart diagnosis context');
const internalBasketballGoods = await submitAssessment({
  ...basketballGoods.assessment,
  content_assets: '篮球产品实拍、材质对比图、学生使用场景、客户评价截图',
  client_mode: 'internal_test',
  source: 'internal_test',
}, { internal: true });
const blockedInternal = await handler(internalRequest('POST', 'assessments', {...basketballGoods.assessment, offer: '', customer_pain: '', content_assets: '', best_recent_content: '', client_mode: 'internal_test', source: 'internal_test'}));
assert(blockedInternal.status === 400, 'internal assessment should be blocked by the generation gate when precision fields are missing');
const blockedText = await blockedInternal.text();
assert(blockedText.includes('生成门禁') && blockedText.includes('主推产品/服务和价格带'), 'internal generation gate should explain missing precision fields');
assert(internalBasketballGoods.diagnosis.smart_context?.module === 'internal_smart_diagnosis_kernel', 'internal assessment should include smart diagnosis kernel context');
assert(internalBasketballGoods.diagnosis.smart_context.business_type === '商品零售/产品销售', 'internal smart diagnosis should classify basketball sales as product retail');
assert(internalBasketballGoods.diagnosis.smart_context.risk_gates.some((x) => x.includes('禁止写成篮球培训')), 'internal smart diagnosis should include anti-cross-industry gate');
assert(internalBasketballGoods.diagnosis.insight.includes('商品零售/产品销售') && internalBasketballGoods.diagnosis.weekly_action.includes('篮球商品'), 'internal smart diagnosis should replace fixed-field diagnosis copy with transaction-context reasoning');
assertCustomerFacingPlans('basketball goods output', basketballGoods);

const safetyCompliance = await submitAssessment({
  company_name: 'P03安标项目验证客户',
  industry: '安全生产标准化辅导，服务工厂、制造企业、仓储企业做安标、验厂和合规整改',
  main_goal: '通过抖音短视频获得企业负责人咨询，验证安全生产标准化辅导内容获客',
  target_customer: '制造企业老板、安全负责人、工厂管理者、需要做安标或验厂整改的企业负责人',
  offer: '安全生产标准化辅导、验厂整改辅导、企业合规材料梳理',
  customer_pain: '担心评审不过、现场整改不知道从哪里开始、台账材料不完整、临近验厂才发现风险',
  current_channels: '抖音',
  posting_frequency: '每周3条',
  biggest_problem: '不知道在抖音发什么才能让企业负责人愿意咨询',
});
const safetyPlatforms = safetyCompliance.diagnosis.platform_recommendations.primary.map((x) => x.platform).join('|');
const safetyText = JSON.stringify(safetyCompliance.plans.map((plan) => [plan.platform, plan.topic, plan.angle, plan.content_type, plan.cta, plan.qa_note]));
assert(safetyCompliance.diagnosis.platform_recommendations.primary[0].platform === '抖音', 'P03 safety compliance should prioritize 抖音 as first platform');
assert(safetyPlatforms === '抖音|视频号|朋友圈/私域', `P03 safety compliance platform mix should be 抖音|视频号|朋友圈/私域, got ${safetyPlatforms}`);
assert(safetyCompliance.plans.every((p) => p.platform === '抖音'), 'P03 safety compliance plans should use only the user-selected platform (抖音), not spread to recommended platforms');
assert(/安标|安全生产标准化|验厂|合规|整改|台账|评审|工厂/.test(safetyText), 'P03 safety compliance plans should stay on safety/compliance topics');
['小红书标签', '#小红书', '种草', '美团/大众点评', '到店前', '预约服务', '篮球课', '体验课', '儿童牙齿'].forEach((word) => {
  assert(!safetyText.includes(word), `P03 safety compliance plans must not include wrong platform/template word: ${word}`);
});
assertCustomerFacingPlans('P03 safety compliance output', safetyCompliance);

const basketball = await submitAssessment({
  company_name: '少儿篮球培训机构',
  industry: '少儿篮球培训机构，主要做小学生篮球启蒙、体能提升、基础运球投篮训练，服务附近三公里社区家庭',
  main_goal: '希望获得附近家长咨询和到店体验课预约，提升周末班、寒暑假班报名转化',
  target_customer: '附近三公里内有6-12岁小学生的家长，尤其是想让孩子长高、提升体能、减少玩手机、培养团队协作的家庭',
  current_channels: '小红书',
  posting_frequency: '偶尔发布',
  biggest_problem: '不知道发什么',
});
const basketballText = JSON.stringify(basketball.plans.map((plan) => [plan.topic, plan.angle, plan.cta]));
assert(/篮球|体能|体验课|6-12岁|家长|教练|班型|课堂|运球|投篮/.test(basketballText), 'basketball plans should speak to parents choosing youth basketball training');
assert(!basketballText.includes('课程/体验课') && !basketballText.includes('家长报名前，最容易踩的3个坑') && !basketballText.includes('相关服务'), 'basketball plans should not fall back to generic education/service wording');
assert(basketball.diagnosis.platform_recommendations.primary.map((x) => x.platform).join('|') === '抖音|小红书|视频号', 'basketball should use Douyin + Xiaohongshu + Shipinhao content matrix');
assert(basketball.plans.every((p) => p.platform === '小红书'), 'basketball plans should use only the user-selected platform (小红书), not spread to recommended matrix');
assert(basketball.generation_meta && basketball.model_info, 'authorized internal basketball fixture should retain model evidence for QA');
assertCustomerFacingPlans('basketball service output', basketball);

const restaurant = await submitAssessment({
  company_name: '本地餐饮门店',
  industry: '餐饮门店',
  main_goal: '获得更多周末到店消费',
  target_customer: '周边家庭顾客和年轻上班族',
  offer: '周末家庭套餐',
  customer_pain: '不知道附近哪里适合聚餐、担心排队和性价比',
  current_channels: '抖音、小红书、美团',
  posting_frequency: '每周3条',
  biggest_problem: '曝光不足',
});
assertNoWrongDefaultScenario('restaurant service output', restaurant);
assert(restaurant.diagnosis.platform_recommendations.primary.some((x) => x.platform === '美团/大众点评'), 'restaurant should include 美团/大众点评');
assert(JSON.stringify(restaurant).includes('餐饮门店'), 'restaurant output should preserve industry');
assertCustomerFacingPlans('restaurant service output', restaurant);

const oral = await submitAssessment({
  company_name: '本地口腔门诊',
  industry: '口腔门诊',
  main_goal: '让更多家长预约儿童牙齿矫正咨询',
  target_customer: '25-45岁本地宝妈和家庭客户',
  offer: '儿童牙齿矫正、种植牙、口腔检查',
  customer_pain: '怕贵、怕没效果、不信任医生专业度',
  current_channels: '朋友圈、小红书、美团',
  posting_frequency: '每周3条',
  biggest_problem: '不知道发什么',
  benchmark: {
    platform: '小红书',
    accounts: ['https://example.com/oral-benchmark'],
    notes: '同城口腔账号里，宝妈收藏儿童矫正时机、医生专业度、价格透明类内容。',
    sample_content: '爆款标题：孩子几岁做牙齿矫正更合适？数据摘要：收藏高，咨询问矫正周期。',
  },
});
const oralText = JSON.stringify(oral);
assertNoUnsafeCommentCta('customer diagnosis/plans', oral);
assertNoWrongDefaultScenario('oral clinic output', oral);
assert(oral.plans.length === 7, `oral sample expected 7 plans, got ${oral.plans.length}`);
assertCustomerFacingPlans('oral clinic output', oral);
assert(oral.plans.slice(0, 6).map((p) => p.platform).join('|') === '小红书|美团/大众点评|朋友圈/私域|小红书|美团/大众点评|朋友圈/私域', 'oral plans should rotate recommended platforms');
['口腔门诊', '宝妈', '儿童牙齿矫正', '种植牙', '口腔检查', '怕贵', '医生专业度'].forEach((word) => {
  assert(oralText.includes(word), `oral output should include ${word}`);
});
assert(!oralText.includes('AI写文案'), 'oral output must not use meta-marketing template');
assert(oralText.includes('对标账号主题参考'), 'oral diagnosis should include benchmark reference module');
assert(oralText.includes('儿童矫正时机判断'), 'oral plans should use benchmark-calibrated theme without copying title');

const missingLinkFeedbackRes = await handler(request('POST', 'feedback', {
  content_plan_id: oral.plans[0].id,
  views: 1200,
  likes: 36,
  comments: 8,
  favorites: 22,
  shares: 5,
  consultations: 4,
  notes: '评论集中问价格和儿童矫正周期',
}));
assert(missingLinkFeedbackRes.status === 400, `missing publish_link should be rejected, got ${missingLinkFeedbackRes.status}`);
const dashboardAfterMissingLink = await (await handler(internalRequest('GET', 'dashboard'))).json();
assert(dashboardAfterMissingLink.published_plans === 0, `missing publish_link must not count as published, got ${dashboardAfterMissingLink.published_plans}`);
assert(dashboardAfterMissingLink.feedback_rate === 0, `missing publish_link must not change feedback_rate, got ${dashboardAfterMissingLink.feedback_rate}`);

const feedbackRes = await handler(request('POST', 'feedback', {
  content_plan_id: oral.plans[0].id,
  publish_link: 'example.com/first-post',
  feedback_stage: 'T+24',
  backend_views: 1200,
  likes: 36,
  comments: 8,
  favorites: 22,
  shares: 5,
  consultations: 4,
  notes: '评论集中问价格和儿童矫正周期',
}));
if (feedbackRes.status !== 201) throw new Error(`feedback expected 201, got ${feedbackRes.status}: ${await feedbackRes.text()}`);
const feedbackData = await feedbackRes.json();
assert(feedbackData.feedback.publish_link === 'https://example.com/first-post', 'feedback must normalize bare publish links to https://');
assert(feedbackData.feedback.feedback_stage === 'T+24', 'feedback must preserve T+24 stage');
assert(feedbackData.dashboard.published_plans === 1, `published_plans should be 1, got ${feedbackData.dashboard.published_plans}`);
assert(feedbackData.dashboard.feedback_rate === 1 / 7, `feedback_rate should be 1/7, got ${feedbackData.dashboard.feedback_rate}`);
assert(feedbackData.dashboard.total_views === 1200, `total_views should be 1200, got ${feedbackData.dashboard.total_views}`);
assert(feedbackData.dashboard.total_interactions === 71, `total_interactions should be 71, got ${feedbackData.dashboard.total_interactions}`);
assert(feedbackData.dashboard.total_consultations === 4, `total_consultations should be 4, got ${feedbackData.dashboard.total_consultations}`);
assert(feedbackData.dashboard.loop_score > oral.diagnosis.loop_score, 'loop_score should rise after feedback');

const feedback72Res = await handler(request('POST', 'feedback', {
  content_plan_id: oral.plans[0].id,
  publish_link: 'https://example.com/first-post',
  feedback_stage: 'T+72',
  views: 1800,
  likes: 52,
  comments: 14,
  favorites: 31,
  shares: 8,
  consultations: 7,
  notes: '72小时后咨询增加，收藏继续增长',
}));
if (feedback72Res.status !== 201) throw new Error(`feedback T+72 expected 201, got ${feedback72Res.status}: ${await feedback72Res.text()}`);
const feedback72Data = await feedback72Res.json();
assert(feedback72Data.feedback.feedback_stage === 'T+72', 'feedback must preserve T+72 stage');
assert(feedback72Data.dashboard.published_plans === 1, `published_plans should remain 1, got ${feedback72Data.dashboard.published_plans}`);
assert(feedback72Data.dashboard.feedback_rate === 1 / 7, `feedback_rate should still count one closed-loop content, got ${feedback72Data.dashboard.feedback_rate}`);
assert(feedback72Data.dashboard.total_views === 1800, `dashboard should use latest stage, got ${feedback72Data.dashboard.total_views}`);
assert(feedback72Data.dashboard.total_interactions === 105, `dashboard should use latest stage interactions, got ${feedback72Data.dashboard.total_interactions}`);
assert(feedback72Data.dashboard.total_consultations === 7, `dashboard should use latest consultations, got ${feedback72Data.dashboard.total_consultations}`);
const allFeedback = await (await handler(request('GET', 'feedback'))).json();
assert(allFeedback.some((x) => x.feedback_stage === 'T+24') && allFeedback.some((x) => x.feedback_stage === 'T+72'), 'GET /feedback should keep multiple timepoint rows for one plan');

const anonymousReviewPost = await handler(request('POST', 'reviews', {}));
assert(anonymousReviewPost.status === 401, 'anonymous POST /reviews must be rejected');
const reviewRes = await handler(internalRequest('POST', 'reviews', {}));
if (reviewRes.status !== 201) throw new Error(`review expected 201, got ${reviewRes.status}: ${await reviewRes.text()}`);
const reviewData = await reviewRes.json();
assert(reviewData.review.next_actions.includes('加码'), 'review should generate next-round action from feedback');

const healthRes = await handler(request('GET', 'health'));
assert(healthRes.status === 200, 'GET /health should succeed');
const health = await healthRes.json();
assert(health.version === '1.6.157' && health.version_label === 'v1.6.157 · 团队访问稳定修复版', 'public application health version should report v1.6.157');
assert(health.features?.includes('account_project_recovery'), 'health should expose the account project recovery capability');
assert(health.features?.includes('commercial_entitlements_p2') && health.features?.includes('commercial_usage_reservations'), 'health should expose P2 entitlements and usage reservations');
assert(health.features?.includes('referral_rewards_v1'), 'health should expose the account-scoped referral reward capability');
assert(health.features?.includes('customer_account_visual_generation'), 'health should expose customer account avatar/background generation');
assert(health.features?.includes('billing_orders_p1') && health.features?.includes('manual_payment_activation') && health.commercialization?.billing_mode === 'manual_review', 'health should expose the honest P1 billing order and manual activation mode');
assert(health.commercialization?.enabled === false && health.commercialization?.quota_mode === 'observe_only', 'commercial enforcement should remain observe-only unless explicitly enabled');
assert(health.delivery_module_version === '1.6.122' && !health.delivery_module_label, 'health should expose only the non-sensitive internal delivery module version');
assert(health.module === 'generation-workbench', 'health should expose generation workbench module');
assert(health.module_version === 'generation-workbench-v1', 'health should expose generation workbench module_version');
assert(Array.isArray(health.features) && health.features.includes('async_video_polling'), 'health should list generation workbench features');
assert(['generation_business_context_v1', 'generation_asset_auto_link', 'generation_multimodal_assets', 'generation_idempotency'].every((feature) => health.features.includes(feature)), 'health should expose the contextual and idempotent generation production chain');
assert(health.features.includes('feishu_inbound_v1') && health.features.includes('feishu_bitable_pull_v1') && health.features.includes('feishu_bitable_push_v1') && health.features.includes('feishu_webhook'), 'health should expose Feishu stage-A inbound, stage-B pull, stage-C push and webhook capabilities');
assert(health.providers?.openai === false && health.providers?.image_model === 'gpt-image-2' && health.providers?.image_background === true, 'health should expose non-secret image provider readiness, model and background execution evidence');
assert(health.providers?.ark === false && health.providers?.seedance_model === 'doubao-seedance-2-0-260128', 'health should expose non-secret video provider readiness and model evidence');
assert(health.benchmark_module_version === 'benchmark-insights-p0' && health.features.includes('benchmark_insights_p0') && health.features.includes('benchmark_evidence_review'), 'health should expose the internal benchmark-insights P0 capability');

const benchmarkProjectId = 'project-benchmark-martial';
const benchmarkOtherProjectId = 'project-benchmark-other';
const benchmarkClientId = 'benchmark-martial-client';
const benchmarkProjectStore = {
  activeProjectId: benchmarkProjectId,
  projects: [
    {
      id: benchmarkProjectId,
      name: '子武限武术搏击俱乐部',
      updated_at: '2026-08-11 10:00:00',
      state: {
        project: { id: benchmarkProjectId, name: '子武限武术搏击俱乐部' },
        assessment: {
          company_name: '子武限武术搏击俱乐部',
          industry: '少儿武术与搏击培训',
          main_goal: '获得附近家长体验课咨询',
          target_customer: '附近有6-12岁孩子的家长',
          offer: '少儿武术搏击体验课',
          customer_pain: '担心受伤，不知道孩子是否适合',
          current_channels: '小红书',
          posting_frequency: '每周3条',
          biggest_problem: '不知道发什么',
          content_assets: '课堂保护细节、教练分层和家长观察素材',
        },
        diagnosis: { id: 'diagnosis-benchmark-martial' },
        plans: [], feedback: [], review: null,
      },
    },
    {
      id: benchmarkOtherProjectId,
      name: '其他项目',
      updated_at: '2026-08-10 10:00:00',
      state: { project: { id: benchmarkOtherProjectId, name: '其他项目' }, assessment: { industry: '本地服务' }, plans: [] },
    },
  ],
};
const benchmarkStateWrite = await handler(internalRequest('POST', 'state', { client_id: benchmarkClientId, project_store: benchmarkProjectStore }));
assert(benchmarkStateWrite.status === 201, 'benchmark fixture project store should persist');
const benchmarkStateBefore = await (await handler(internalRequest('GET', `state?client_id=${benchmarkClientId}&mode=internal`))).json();
const benchmarkProjectStoreBefore = JSON.stringify(benchmarkStateBefore.project_store);

for (const path of ['benchmark-profiles', 'benchmark-contents', 'benchmark-jobs', 'benchmark-insights']) {
  const unauthorizedBenchmark = await handler(request('GET', `${path}?client_id=${benchmarkClientId}&project_id=${benchmarkProjectId}`));
  assert(unauthorizedBenchmark.status === 401, `GET /${path} must require internal authentication`);
}

const benchmarkProfileResponse = await handler(internalRequest('POST', 'benchmark-profiles', {
  client_id: benchmarkClientId,
  project_id: benchmarkProjectId,
  platform: '小红书',
  account_name: '少儿武术家长观察账号',
  account_url: 'https://example.com/martial-account',
  reference_reason: ['选题', '安全感表达'],
  operator_notes: '重点观察家长对课堂安全和教练分层的关注',
}));
assert(benchmarkProfileResponse.status === 201, `benchmark profile should be created, got ${benchmarkProfileResponse.status}`);
const benchmarkProfile = (await benchmarkProfileResponse.json()).profile;

const benchmarkBareLink = await handler(internalRequest('POST', 'benchmark-contents', {
  client_id: benchmarkClientId,
  project_id: benchmarkProjectId,
  benchmark_profile_id: benchmarkProfile.benchmark_profile_id,
  content_url: 'https://example.com/bare-link',
}));
assert(benchmarkBareLink.status === 400 && (await benchmarkBareLink.json()).error.includes('链接暂不能自动读取'), 'bare benchmark link must be rejected with an actionable message');

const crossProjectAssetResponse = await handler(internalRequest('POST', 'assets', {
  client_id: benchmarkClientId,
  project_id: benchmarkOtherProjectId,
  text_content: 'cross-project-screenshot',
  original_filename: 'cross-project.txt',
  mime_type: 'text/plain',
}));
const crossProjectAsset = (await crossProjectAssetResponse.json()).asset;
const crossProjectScreenshot = await handler(internalRequest('POST', 'benchmark-contents', {
  client_id: benchmarkClientId,
  project_id: benchmarkProjectId,
  benchmark_profile_id: benchmarkProfile.benchmark_profile_id,
  title: '武术课安全观察内容',
  screenshot_asset_id: crossProjectAsset.asset_id,
}));
assert(crossProjectScreenshot.status === 404, 'benchmark screenshot asset must belong to the same project');

const benchmarkContentPayloads = [
  {
    title: '孩子第一次上武术课，家长最该看什么',
    content_url: 'https://example.com/martial-first-class',
    content_summary: '讲课堂秩序、安全保护和教练分层',
    operator_observation: '家长集中询问安全和孩子是否适合',
    visible_metrics: { likes: 24, favorites: 18, comments: 7, shares: null, views: null },
    confidence: 'C',
  },
  {
    title: '搏击课会不会受伤？先看课堂里的3个保护细节',
    content_summary: '展示热身、护具检查和分组训练',
    operator_observation: '仅有运营观察，公开指标未知',
    visible_metrics: { likes: null, favorites: null, comments: null, shares: null, views: null },
    confidence: 'C',
  },
];
const benchmarkContents = [];
for (const content of benchmarkContentPayloads) {
  const response = await handler(internalRequest('POST', 'benchmark-contents', {
    ...content,
    client_id: benchmarkClientId,
    project_id: benchmarkProjectId,
    benchmark_profile_id: benchmarkProfile.benchmark_profile_id,
    platform: '小红书',
  }));
  assert(response.status === 201, `benchmark content should be created, got ${response.status}`);
  benchmarkContents.push((await response.json()).content);
}
assert(benchmarkContents[0].visible_metrics.views === null && benchmarkContents[0].visible_metrics.shares === null, 'missing benchmark metrics must stay null instead of becoming zero');
assert(benchmarkContents[1].confidence === 'E', 'confidence C without a link, screenshot or visible metric must downgrade to E');

const crossClientPatch = await handler(internalRequest('PATCH', `benchmark-profiles/${encodeURIComponent(benchmarkProfile.benchmark_profile_id)}`, {
  client_id: 'benchmark-other-client',
  account_name: '不应成功',
}));
assert(crossClientPatch.status === 404, 'cross-client benchmark profile update must not reveal or modify the record');

const martialGuard = benchmarkIndustryGuard({ projectText: '少儿武术搏击培训', sourceText: '武术体验课、安全防护、家长观察', outputText: '教练分层和规则感' });
const basketballGuard = benchmarkIndustryGuard({ projectText: '少儿篮球训练营', sourceText: '篮球体能、运球投篮、体验课', outputText: '孩子和家长' });
const beautyGuard = benchmarkIndustryGuard({ projectText: '本地美容美甲门店', sourceText: '通勤款、甲型和持久度', outputText: '到店预约' });
const dentalGuard = benchmarkIndustryGuard({ projectText: '社区口腔门诊', sourceText: '口腔检查、正畸和医生专业度', outputText: '价格和信任' });
assert(martialGuard.passed && basketballGuard.passed && beautyGuard.passed && dentalGuard.passed, 'four supported industries should pass their own evidence guard');
const mismatchGuard = benchmarkIndustryGuard({ projectText: '少儿武术搏击培训', sourceText: '篮球运球和投篮体验课', outputText: '篮筐训练' });
assert(!mismatchGuard.passed && mismatchGuard.source_mismatch, 'basketball evidence on a martial-arts project must fail the industry guard');
const mismatchInsight = normalizeBenchmarkInsightOutput({
  projectSnapshot: { industry: '少儿武术搏击培训' },
  contents: [{ benchmark_content_id: 'basketball-source', title: '孩子投篮训练', content_summary: '篮球运球和篮筐练习', observed_at: '2026-08-11' }],
  modelOutput: {
    fit_summary: '可以参考', fit_status: 'high',
    market_signals: [{ statement: '家长关注投篮', source_content_ids: ['basketball-source'], confidence: 'C', adaptation_reason: '孩子训练' }],
    transferable_directions: [{ statement: '篮球训练方法', source_content_ids: ['basketball-source'], confidence: 'C', adaptation_reason: '课程获客' }],
  },
});
assert(mismatchInsight.fit_status === 'low' && mismatchInsight.transferable_directions.length === 0, 'cross-industry model output must be downgraded and prevented from application');

let benchmarkFailurePromise = null;
const benchmarkFailureResponse = await handler(internalRequest('POST', 'benchmark-jobs', {
  client_id: benchmarkClientId,
  project_id: benchmarkProjectId,
  benchmark_profile_ids: [benchmarkProfile.benchmark_profile_id],
  benchmark_content_ids: benchmarkContents.map((item) => item.benchmark_content_id),
  request_id: 'benchmark-missing-model-001',
}), { waitUntil(promise) { benchmarkFailurePromise = promise; } });
assert(benchmarkFailureResponse.status === 202 && benchmarkFailurePromise, 'benchmark model failure should still use the async task path');
const benchmarkFailureJob = await benchmarkFailureResponse.json();
await benchmarkFailurePromise;
const benchmarkFailureResult = await (await handler(internalRequest('GET', `benchmark-jobs/${encodeURIComponent(benchmarkFailureJob.job.job_id)}?client_id=${benchmarkClientId}`))).json();
assert(benchmarkFailureResult.job.status === 'failed' && benchmarkFailureResult.job.fallback === true && benchmarkFailureResult.job.actual_model === 'rule_template', 'missing Ark configuration must fail explicitly and never masquerade as a market insight');

const benchmarkFetchBefore = globalThis.fetch;
process.env.SAFE_TO_RUN = 'true';
process.env.ARK_API_KEY = 'benchmark-smoke-ark-key';
process.env.ARK_MODEL = 'benchmark-smoke-ark-model';
globalThis.fetch = async (_url, options = {}) => {
  const requestBody = JSON.parse(options.body || '{}');
  const promptText = JSON.stringify(requestBody.messages || []);
  const modelContent = promptText.includes('分析对标内容并生成可审核的市场洞察')
    ? {
      fit_summary: '来源与少儿武术项目高度匹配，家长关注安全、规则感和体验课观察。',
      fit_status: 'high',
      market_signals: [{ statement: '家长会先确认课堂安全和训练秩序', source_content_ids: [benchmarkContents[0].benchmark_content_id], confidence: 'C', adaptation_reason: '当前项目同样服务附近6-12岁孩子家长' }],
      proven_pains: [{ statement: '家长担心受伤，也担心孩子跟不上', source_content_ids: benchmarkContents.map((item) => item.benchmark_content_id), confidence: 'C', adaptation_reason: '与当前项目的咨询顾虑一致' }],
      title_patterns: [{ statement: '先提出家长顾虑，再给出可观察的课堂细节', source_content_ids: [benchmarkContents[1].benchmark_content_id], confidence: 'E', adaptation_reason: '可转成当前门店的真实课堂观察' }],
      content_formats: [{ statement: '课堂纪实短视频配家长检查清单', source_content_ids: [benchmarkContents[1].benchmark_content_id], confidence: 'E', adaptation_reason: '项目已有课堂保护素材' }],
      trust_evidence_patterns: [{ statement: '展示热身、护具检查和教练分层', source_content_ids: [benchmarkContents[1].benchmark_content_id], confidence: 'E', adaptation_reason: '用真实流程建立信任' }],
      conversion_paths: [{ statement: '内容后承接到店体验课观察', source_content_ids: [benchmarkContents[0].benchmark_content_id], confidence: 'C', adaptation_reason: '符合当前获得体验课咨询的目标' }],
      transferable_directions: [{ statement: '用课堂保护细节回答家长的安全顾虑', source_content_ids: benchmarkContents.map((item) => item.benchmark_content_id), confidence: 'C', adaptation_reason: '当前项目可用自有课堂素材重新表达' }],
      avoid_copying: [{ statement: '不照抄来源标题，不搬运其他教练案例', source_content_ids: [benchmarkContents[0].benchmark_content_id], confidence: 'C', adaptation_reason: '必须保持当前门店事实边界' }],
      platform_risks: [{ statement: '避免承诺零受伤或保证训练效果', source_content_ids: [benchmarkContents[1].benchmark_content_id], confidence: 'E', adaptation_reason: '教育培训内容不能夸大效果和安全承诺' }],
    }
    : {
      plans: Array.from({ length: 7 }, (_, index) => ({
        topic: `武术体验课第${index + 1}个家长观察角度`,
        angle: `用当前门店的真实课堂细节说明安全、规则感和教练分层${index + 1}`,
        content_type: index % 2 ? '短视频' : '图文',
        cta: '主页咨询体验课',
        target_metric: '咨询',
      })),
    };
  return new Response(JSON.stringify({
    model: 'benchmark-smoke-ark-model',
    choices: [{ message: { content: JSON.stringify(modelContent) } }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

let benchmarkJobPromise = null;
const benchmarkJobResponse = await handler(internalRequest('POST', 'benchmark-jobs', {
  client_id: benchmarkClientId,
  project_id: benchmarkProjectId,
  benchmark_profile_ids: [benchmarkProfile.benchmark_profile_id],
  benchmark_content_ids: benchmarkContents.map((item) => item.benchmark_content_id),
  request_id: 'benchmark-martial-idempotency-001',
}), { waitUntil(promise) { benchmarkJobPromise = promise; } });
assert(benchmarkJobResponse.status === 202 && benchmarkJobPromise, 'benchmark job should return 202 and continue through waitUntil');
const benchmarkJobCreated = await benchmarkJobResponse.json();
const benchmarkJobRetry = await handler(internalRequest('POST', 'benchmark-jobs', {
  client_id: benchmarkClientId,
  project_id: benchmarkProjectId,
  request_id: 'benchmark-martial-idempotency-001',
}));
const benchmarkJobRetryData = await benchmarkJobRetry.json();
assert(benchmarkJobRetryData.duplicate === true && benchmarkJobRetryData.job.job_id === benchmarkJobCreated.job.job_id, 'same benchmark request_id must reuse the original job');
await benchmarkJobPromise;
const completedBenchmarkJob = await (await handler(internalRequest('GET', `benchmark-jobs/${encodeURIComponent(benchmarkJobCreated.job.job_id)}?client_id=${benchmarkClientId}`))).json();
assert(completedBenchmarkJob.job.status === 'review_required' && completedBenchmarkJob.job.fallback === false, 'successful benchmark job should wait for human review without fallback');
const benchmarkInsightList = await (await handler(internalRequest('GET', `benchmark-insights?client_id=${benchmarkClientId}&project_id=${benchmarkProjectId}`))).json();
const benchmarkInsight = benchmarkInsightList.insights[0];
assert(benchmarkInsight.market_signals.every((item) => item.source_content_ids.length && item.adaptation_reason), 'every benchmark signal must retain evidence ids and an adaptation reason');
assert(!JSON.stringify(benchmarkInsight).includes('运球') && !JSON.stringify(benchmarkInsight).includes('投篮') && !JSON.stringify(benchmarkInsight).includes('篮筐'), 'martial-arts benchmark insight must not contain basketball terms');

const approvedBenchmark = await handler(internalRequest('PATCH', `benchmark-insights/${encodeURIComponent(benchmarkInsight.benchmark_insight_id)}/review`, {
  client_id: benchmarkClientId,
  status: 'approved',
  reviewer: 'smoke-qa',
  notes: '行业、证据和适配理由已确认',
}));
assert(approvedBenchmark.status === 200 && (await approvedBenchmark.json()).insight.status === 'approved', 'valid benchmark insight should support human approval');
const benchmarkTestPlanResponse = await handler(internalRequest('POST', `benchmark-insights/${encodeURIComponent(benchmarkInsight.benchmark_insight_id)}/test-plan`, {
  client_id: benchmarkClientId,
}));
assert(benchmarkTestPlanResponse.status === 200, `approved benchmark insight should generate a test plan, got ${benchmarkTestPlanResponse.status}`);
const benchmarkTestPlan = (await benchmarkTestPlanResponse.json()).test_plan;
assert(benchmarkTestPlan.plans?.length === 7, 'benchmark test plan should contain seven rows');
assert(benchmarkTestPlan.plans.every((plan) => !benchmarkContents.some((source) => plan.topic === source.title)), 'benchmark test plan must not copy a source title verbatim');
assert(benchmarkTestPlan.plans.every((plan) => !/篮球|运球|投篮|篮筐/.test(`${plan.topic} ${plan.angle}`)), 'martial-arts benchmark test plan must remain industry-isolated');

globalThis.fetch = benchmarkFetchBefore;
delete process.env.SAFE_TO_RUN;
delete process.env.ARK_API_KEY;
delete process.env.ARK_MODEL;
const benchmarkStateAfter = await (await handler(internalRequest('GET', `state?client_id=${benchmarkClientId}&mode=internal`))).json();
assert(JSON.stringify(benchmarkStateAfter.project_store) === benchmarkProjectStoreBefore, 'benchmark collections and test-plan generation must not modify global-project-store data');

const benchmarkSourceAssertions = [
  "currentPath() === '/internal/benchmark-insights'",
  'id="benchmarkInsightsWorkbench"',
  '对标内容洞察',
  'benchmark-insights-mode',
];
benchmarkSourceAssertions.forEach((needle) => assert(`${appJs}\n${indexHtml}\n${stylesCss}`.includes(needle), `benchmark workbench source should include ${needle}`));
const publicCustomerAppHtml = indexHtml.split('<main id="internalAccessGate"')[0];
assert(!publicCustomerAppHtml.includes('/internal/benchmark-insights'), 'public customer app must not expose the internal benchmark workbench link');

const timestampProject = ({ id, name, updatedAt, marker }) => ({
  id,
  name,
  stage: '待启动',
  updated_at: updatedAt,
  state: {
    project: { id, name },
    project_stage: '待启动',
    assessment: { id: `assessment-${id}`, industry: name },
    diagnosis: { id: `diagnosis-${id}`, summary: `时间戳回归：${marker}` },
    plans: [{ id: `plan-${id}`, topic: '时间戳回归内容', status: '待发布' }],
    feedback: [],
    records: [],
    merge_marker: marker,
    saved_at: updatedAt,
  },
});
const writeTimestampState = async (clientId, activeProjectId, projects) => handler(request('POST', 'state', {
  client_id: clientId,
  project_store: { activeProjectId, projects },
}));

const mixedTimestampClient = 'timestamp-mixed-format';
const mixedTimestampProjectId = 'project-timestamp-mixed';
const mixedTimestampName = '混合时间格式门店';
const mixedIsoSeed = timestampProject({
  id: mixedTimestampProjectId,
  name: mixedTimestampName,
  updatedAt: '2026-07-13T10:00:00Z',
  marker: 'iso-seed',
});
const mixedSeedResponse = await writeTimestampState(mixedTimestampClient, mixedTimestampProjectId, [mixedIsoSeed]);
assert(mixedSeedResponse.status === 201, 'mixed timestamp ISO seed should persist');
const mixedSpaceNewer = timestampProject({
  id: mixedTimestampProjectId,
  name: mixedTimestampName,
  updatedAt: '2026-07-13 23:21:07',
  marker: 'space-newer',
});
const mixedNewerResponse = await writeTimestampState(mixedTimestampClient, mixedTimestampProjectId, [mixedSpaceNewer]);
assert(mixedNewerResponse.status === 201, 'later Shanghai business timestamp should persist over ISO seed');
let mixedTimestampState = await (await handler(request('GET', `state?client_id=${mixedTimestampClient}`))).json();
let mixedTimestampProject = mixedTimestampState.project_store.projects.find((item) => item.id === mixedTimestampProjectId);
assert(mixedTimestampProject?.state?.merge_marker === 'space-newer', 'later YYYY-MM-DD HH:mm:ss write must not be silently dropped behind an ISO timestamp');

const mixedActuallyOlder = timestampProject({
  id: mixedTimestampProjectId,
  name: mixedTimestampName,
  updatedAt: '2026-07-13T14:00:00Z',
  marker: 'iso-actually-older',
});
const mixedOlderResponse = await writeTimestampState(mixedTimestampClient, mixedTimestampProjectId, [mixedActuallyOlder]);
assert(mixedOlderResponse.status === 201, 'older mixed-format write should return a stable state response');
mixedTimestampState = await (await handler(request('GET', `state?client_id=${mixedTimestampClient}`))).json();
mixedTimestampProject = mixedTimestampState.project_store.projects.find((item) => item.id === mixedTimestampProjectId);
assert(mixedTimestampProject?.state?.merge_marker === 'space-newer', 'a truly older ISO write must not overwrite the newer Shanghai business timestamp');

const sameNameClient = 'timestamp-same-name-normalization';
const sameNameIso = timestampProject({ id: 'same-name-iso', name: '同名项目作战台', updatedAt: '2026-07-13T10:00:00Z', marker: 'same-name-iso' });
const sameNameSpace = timestampProject({ id: 'same-name-space', name: '同名项目作战台', updatedAt: '2026-07-13 23:21:07', marker: 'same-name-space-newer' });
const sameNameResponse = await writeTimestampState(sameNameClient, sameNameSpace.id, [sameNameIso, sameNameSpace]);
assert(sameNameResponse.status === 201, 'same-name mixed timestamp projects should normalize successfully');
const sameNameState = await (await handler(request('GET', `state?client_id=${sameNameClient}`))).json();
assert(sameNameState.project_store.projects.length === 1 && sameNameState.project_store.projects[0].id === sameNameSpace.id, 'same-name normalization must retain the truly newer mixed-format project');

const invalidTimestampClient = 'timestamp-invalid-incoming';
const invalidTimestampProjectId = 'project-invalid-timestamp';
const invalidSeed = timestampProject({ id: invalidTimestampProjectId, name: '异常时间兜底门店', updatedAt: '2026-07-13T10:00:00Z', marker: 'valid-seed' });
const invalidIncoming = timestampProject({ id: invalidTimestampProjectId, name: '异常时间兜底门店', updatedAt: 'invalid-incoming-timestamp', marker: 'invalid-incoming-preferred' });
assert((await writeTimestampState(invalidTimestampClient, invalidTimestampProjectId, [invalidSeed])).status === 201, 'invalid timestamp fallback seed should persist');
assert((await writeTimestampState(invalidTimestampClient, invalidTimestampProjectId, [invalidIncoming])).status === 201, 'unparseable incoming timestamp should still produce a stable write response');
const invalidTimestampState = await (await handler(request('GET', `state?client_id=${invalidTimestampClient}`))).json();
assert(invalidTimestampState.project_store.projects[0]?.state?.merge_marker === 'invalid-incoming-preferred', 'when either timestamp is invalid, the incoming write should be preferred instead of silently dropped');

const feishuProjectEnvelope = (clientId, projectId, planId) => ({
  client_id: clientId,
  project_store: {
    activeProjectId: projectId,
    projects: [{
      id: projectId,
      name: `${clientId}门店`,
      stage: '待启动',
      updated_at: '2026-07-13 09:00:00',
      state: {
        project: { id: projectId, client_id: clientId, name: `${clientId}门店` },
        client_id: clientId,
        project_stage: '待启动',
        current_cycle_id: 'cycle-feishu-a',
        assessment: { id: `assessment-${clientId}`, client_id: clientId, industry: '本地服务门店' },
        diagnosis: { id: `diagnosis-${clientId}`, client_id: clientId, summary: '飞书回流隔离验证' },
        plans: [{
          id: planId,
          content_plan_record_id: `${planId}-record`,
          platform: '小红书',
          topic: '门店真实案例',
          angle: '用真实服务过程回应客户顾虑',
          content_type: '图文',
          cta: '查看主页了解详情',
          planned_date: '2026-07-18',
          status: '待发布',
        }],
        feedback: [],
        records: [],
        saved_at: '2026-07-13 09:00:00',
      },
    }],
  },
});
const feishuClientA = 'feishu-client-a';
const feishuClientB = 'feishu-client-b';
const feishuProjectA = 'project-feishu-a';
const feishuProjectB = 'project-feishu-b';
const feishuPlanA = 'plan-feishu-a-1';
const feishuPlanB = 'plan-feishu-b-1';
for (const seedPayload of [
  feishuProjectEnvelope(feishuClientA, feishuProjectA, feishuPlanA),
  feishuProjectEnvelope(feishuClientB, feishuProjectB, feishuPlanB),
]) {
  const seeded = await handler(request('POST', 'state', seedPayload));
  assert(seeded.status === 201, `Feishu inbound smoke state should seed, got ${seeded.status}`);
}
const feishuInboundPayload = {
  client_id: feishuClientA,
  project_id: feishuProjectA,
  event_type: '效果回填',
  record_id: 'rec-feishu-effect-a-001',
  fields: {
    内容计划ID: feishuPlanA,
    发布链接: 'https://example.com/feishu-effect-a',
    反馈时间点: 'T+72',
    曝光: 1800,
    点赞: 42,
    评论: 8,
    收藏: 26,
    转发: 4,
    咨询人数: 6,
    观察: '家长更关注到店体验流程',
  },
};
const feishuInboundWithoutToken = await handler(request('POST', 'feishu/inbound', feishuInboundPayload));
assert(feishuInboundWithoutToken.status === 401, 'Feishu inbound without configured/provided token must return 401');
process.env.FEISHU_INBOUND_TOKEN = FEISHU_INBOUND_TOKEN;
const feishuInboundWrongToken = await handler(request('POST', 'feishu/inbound', feishuInboundPayload, {
  headers: { 'x-feishu-inbound-token': 'wrong-token', 'x-feishu-client-id': feishuClientA },
}));
assert(feishuInboundWrongToken.status === 401, 'Feishu inbound with wrong token must return 401');
const feishuInboundWrongClient = await handler(request('POST', 'feishu/inbound', feishuInboundPayload, {
  headers: { 'x-feishu-inbound-token': FEISHU_INBOUND_TOKEN, 'x-feishu-client-id': feishuClientB },
}));
assert(feishuInboundWrongClient.status === 403, 'Feishu inbound bound to another client must return 403');
const feishuInboundWrongProject = await handler(request('POST', 'feishu/inbound', { ...feishuInboundPayload, project_id: feishuProjectB }, {
  headers: { 'x-feishu-inbound-token': FEISHU_INBOUND_TOKEN, 'x-feishu-client-id': feishuClientA },
}));
assert(feishuInboundWrongProject.status === 404, 'Feishu inbound must not search or write a project from another client bucket');
const feishuInboundCreated = await handler(request('POST', 'feishu/inbound', feishuInboundPayload, {
  headers: { 'x-feishu-inbound-token': FEISHU_INBOUND_TOKEN, 'x-feishu-client-id': feishuClientA },
}));
if (feishuInboundCreated.status !== 201) throw new Error(`first Feishu effect inbound should create, got ${feishuInboundCreated.status}: ${await feishuInboundCreated.text()}`);
const feishuInboundCreatedBody = await feishuInboundCreated.json();
assert(feishuInboundCreatedBody.client_id === feishuClientA && feishuInboundCreatedBody.content_plan_id === feishuPlanA, 'Feishu inbound should preserve client/project/plan ownership');
const feishuInboundRetry = await handler(request('POST', 'feishu/inbound', {
  ...feishuInboundPayload,
  fields: { ...feishuInboundPayload.fields, 曝光: 2400, 咨询人数: 9 },
}, {
  headers: { 'x-feishu-inbound-token': FEISHU_INBOUND_TOKEN, 'x-feishu-client-id': feishuClientA },
}));
assert(feishuInboundRetry.status === 200, 'same Feishu record retry should be an idempotent update');
const feishuInboundRetryBody = await feishuInboundRetry.json();
assert(feishuInboundRetryBody.idempotent_update === true, 'same Feishu record retry should report idempotent_update');
const feishuDailyCheckin = await handler(request('POST', 'feishu/inbound', {
  client_id: feishuClientA,
  project_id: feishuProjectA,
  event_type: '每日打卡',
  record_id: 'rec-feishu-checkin-a-001',
  fields: { 任务名称: '发布门店案例', 是否完成: '已完成', 打卡内容: '已按计划发布并记录链接' },
}, { headers: { authorization: `Bearer ${FEISHU_INBOUND_TOKEN}`, 'x-feishu-client-id': feishuClientA } }));
assert(feishuDailyCheckin.status === 201, 'Feishu daily check-in should write through the authenticated inbound endpoint');
const feishuAState = await (await handler(request('GET', `state?client_id=${feishuClientA}`))).json();
const feishuBState = await (await handler(request('GET', `state?client_id=${feishuClientB}`))).json();
const feishuAProjectState = feishuAState.project_store.projects.find((item) => item.id === feishuProjectA)?.state;
const feishuBProjectState = feishuBState.project_store.projects.find((item) => item.id === feishuProjectB)?.state;
assert(feishuAProjectState.feedback.length === 1 && feishuAProjectState.records.length === 1, 'Feishu retry must not duplicate feedback or customer records');
assert(feishuAProjectState.feedback[0].views === 2400 && feishuAProjectState.feedback[0].consultations === 9, 'Feishu retry should update existing metrics');
assert(feishuAProjectState.daily_checkins.length === 1 && feishuAProjectState.feishu_inbound_records.length === 2, 'Feishu inbound should persist auditable effect and daily check-in records');
assert(feishuAProjectState.feedback[0].feishu_record_id === 'rec-feishu-effect-a-001' && feishuAProjectState.daily_checkins[0].feishu_record_id === 'rec-feishu-checkin-a-001', 'Feishu effect and check-in data must be readable from persisted project state, not only acknowledged by the inbound response');
assert(feishuBProjectState.feedback.length === 0 && feishuBProjectState.records.length === 0, 'Feishu client A inbound must not mutate client B state');

assert(extractBitableFieldValue([{ type: 'text', text: '附近家长' }, { type: 'text', text: '关注体验课' }]) === '附近家长，关注体验课', 'Bitable rich text arrays should flatten into readable text');
assert(extractBitableFieldValue({ text: '展示文字', link: 'https://example.com/bitable-link' }) === 'https://example.com/bitable-link', 'Bitable hyperlinks should prefer the actual link');
assert(extractBitableFieldValue(Date.parse('2026-07-15T04:00:00Z')) === '2026-07-15 12:00:00', 'Bitable millisecond timestamps should convert to Shanghai business time');
assert(toBitableFieldValue({ type: 'date' }, '2026-07-18') === Date.parse('2026-07-18T00:00:00+08:00'), 'Bitable outbound dates should use millisecond timestamps at Shanghai midnight');
assert(toBitableFieldValue({ type: 'single_select' }, { name: '小红书' }) === '小红书', 'Bitable outbound single-select fields should use option names');
assert(JSON.stringify(toBitableFieldValue({ type: 'hyperlink', name: '作品链接' }, 'example.com/post')) === JSON.stringify({ link: 'https://example.com/post', text: '作品链接' }), 'Bitable outbound hyperlinks should use {link,text}');
assert(toBitableFieldValue({ type: 'text' }, ['真实案例', '家长顾虑']) === '真实案例，家长顾虑', 'Bitable outbound text arrays should flatten safely');
const outboundPlanFields = buildFeishuPlanFields({
  clientId: feishuClientA,
  projectId: feishuProjectA,
  plan: feishuProjectEnvelope(feishuClientA, feishuProjectA, feishuPlanA).project_store.projects[0].state.plans[0],
});
assert(outboundPlanFields.客户ID === feishuClientA && outboundPlanFields.项目ID === feishuProjectA && outboundPlanFields.内容计划ID === feishuPlanA, 'Feishu outbound fields must preserve exact client/project/plan ownership');
assert(outboundPlanFields.平台 === '小红书' && outboundPlanFields.计划发布日期 === Date.parse('2026-07-18T00:00:00+08:00'), 'Feishu outbound plan fields should format select/date values correctly');
assert(scheduledFeishuConfig.schedule === '*/15 * * * *', 'Feishu scheduled pull should run every 15 minutes');

const anonymousFeishuPull = await handler(request('POST', 'feishu/pull', { app_token: 'base-smoke', table_id: 'tbl-effect-smoke' }));
assert(anonymousFeishuPull.status === 401, 'anonymous POST /feishu/pull must be rejected');
const missingFeishuPull = await handler(internalRequest('POST', 'feishu/pull', { app_token: 'base-smoke', table_id: 'tbl-effect-smoke' }));
assert(missingFeishuPull.status === 200, 'missing Feishu credentials should fail closed without crashing');
const missingFeishuPullBody = await missingFeishuPull.json();
assert(missingFeishuPullBody.skipped === true && missingFeishuPullBody.reason === 'missing_feishu_app_credentials', 'missing Feishu credentials should report an explicit skip reason');

process.env.FEISHU_APP_ID = 'cli_smoke_app';
process.env.FEISHU_APP_SECRET = 'smoke-app-secret-not-production';
process.env.FEISHU_BASE_TOKEN = 'base-smoke';
process.env.FEISHU_TABLE_EFFECT = 'tbl-effect-smoke';
process.env.FEISHU_TABLE_CHECKIN = 'tbl-checkin-smoke';
process.env.FEISHU_TABLE_REPUTATION = 'tbl-reputation-smoke';
process.env.FEISHU_PULL_PAGE_SIZE = '2';
process.env.FEISHU_PULL_MAX_RECORDS = '20';
let bitableEffectViews = 3100;
let bitableAuthCalls = 0;
let bitableRecordCalls = 0;
let bitableWikiResolveCalls = 0;
const bitableAppTokens = [];
const fetchBeforeFeishuBitable = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const requestUrl = new URL(String(url));
  if (requestUrl.pathname.endsWith('/auth/v3/tenant_access_token/internal')) {
    bitableAuthCalls += 1;
    const credentials = JSON.parse(String(options.body || '{}'));
    assert(credentials.app_id === process.env.FEISHU_APP_ID && credentials.app_secret === process.env.FEISHU_APP_SECRET, 'Feishu auth should read credentials from server env');
    return new Response(JSON.stringify({ code: 0, tenant_access_token: 'tenant-smoke-token', expire: 7200 }), { status: 200 });
  }
  assert(String(options.headers?.authorization || '') === 'Bearer tenant-smoke-token', 'Feishu API requests should use the cached tenant token');
  if (requestUrl.pathname.endsWith('/wiki/v2/spaces/get_node')) {
    bitableWikiResolveCalls += 1;
    assert(requestUrl.searchParams.get('token') === 'wiki-smoke-node', 'Wiki resolver should query the configured node token');
    return new Response(JSON.stringify({ code: 0, data: {
      node: { node_token: 'wiki-smoke-node', obj_type: 'bitable', obj_token: 'base-smoke-from-wiki' },
    } }), { status: 200 });
  }
  bitableRecordCalls += 1;
  const appMatch = requestUrl.pathname.match(/\/bitable\/v1\/apps\/([^/]+)\/tables\//);
  const resolvedAppToken = decodeURIComponent(appMatch?.[1] || '');
  bitableAppTokens.push(resolvedAppToken);
  assert(['base-smoke', 'base-smoke-from-wiki'].includes(resolvedAppToken), 'Bitable records should use the configured or Wiki-resolved app token');
  const tableMatch = requestUrl.pathname.match(/\/tables\/([^/]+)\/records$/);
  const tableId = decodeURIComponent(tableMatch?.[1] || '');
  const pageToken = requestUrl.searchParams.get('page_token') || '';
  if (tableId === process.env.FEISHU_TABLE_EFFECT && !pageToken) {
    return new Response(JSON.stringify({ code: 0, data: {
      items: [{
        record_id: 'rec-feishu-bitable-effect-001',
        fields: {
          客户ID: [{ type: 'text', text: feishuClientA }],
          项目ID: [{ type: 'text', text: feishuProjectA }],
          内容计划ID: [{ type: 'text', text: feishuPlanA }],
          发布链接: { text: '查看作品', link: 'https://example.com/feishu-bitable-effect' },
          反馈时间点: 'T+72',
          曝光量: bitableEffectViews,
          点赞: 55,
          收藏: 31,
          咨询人数: 8,
          发布时间: Date.parse('2026-07-15T04:00:00Z'),
          观察: [{ type: 'text', text: '家长关注体验课' }, { type: 'text', text: '也会问教练资质' }],
        },
      }],
      has_more: true,
      page_token: 'effect-page-2',
    } }), { status: 200 });
  }
  if (tableId === process.env.FEISHU_TABLE_EFFECT && pageToken === 'effect-page-2') {
    return new Response(JSON.stringify({ code: 0, data: {
      items: [
        {
          record_id: 'rec-feishu-bitable-effect-002',
          fields: { 客户ID: feishuClientA, 项目ID: feishuProjectA, 内容计划ID: feishuPlanA, 曝光: 1600, 咨询人数: 4 },
        },
        {
          record_id: 'rec-feishu-bitable-missing-project',
          fields: { 客户ID: feishuClientA, 项目ID: 'project-does-not-exist', 内容计划ID: feishuPlanA, 曝光: 9999 },
        },
      ],
      has_more: false,
      page_token: '',
    } }), { status: 200 });
  }
  if (tableId === process.env.FEISHU_TABLE_CHECKIN) {
    return new Response(JSON.stringify({ code: 0, data: {
      items: [{
        record_id: 'rec-feishu-bitable-checkin-001',
        fields: { 客户ID: feishuClientA, 项目ID: feishuProjectA, 任务名称: [{ type: 'text', text: '发布训练日常' }], 是否完成: '已完成' },
      }],
      has_more: false,
    } }), { status: 200 });
  }
  if (tableId === process.env.FEISHU_TABLE_REPUTATION) {
    return new Response(JSON.stringify({ code: 0, data: {
      items: [{
        record_id: 'rec-feishu-bitable-reputation-001',
        fields: { 客户ID: feishuClientA, 项目ID: feishuProjectA, 口碑任务: '邀请家长记录真实体验', 完成状态: '已记录' },
      }],
      has_more: false,
    } }), { status: 200 });
  }
  return new Response(JSON.stringify({ code: 1254040, msg: 'table not found' }), { status: 404 });
};

const firstFeishuPull = await handler(internalRequest('POST', 'feishu/pull', {}));
if (firstFeishuPull.status !== 200) throw new Error(`Feishu Bitable pull should succeed, got ${firstFeishuPull.status}: ${await firstFeishuPull.text()}`);
const firstFeishuPullBody = await firstFeishuPull.json();
assert(firstFeishuPullBody.ok === true && firstFeishuPullBody.summary.fetched === 5, 'Feishu pull should page through all configured tables');
assert(firstFeishuPullBody.token_source === 'base', 'direct Base configuration should report its non-sensitive token source');
assert(firstFeishuPullBody.summary.created === 4 && firstFeishuPullBody.summary.skipped === 1, 'Feishu pull should ingest valid records and skip a missing project without cross-bucket writes');
assert(bitableAuthCalls === 1 && bitableRecordCalls === 4, 'Feishu pull should authenticate once and fetch two effect pages plus two single-page tables');

let feishuPulledState = await (await handler(request('GET', `state?client_id=${feishuClientA}`))).json();
let feishuPulledProjectState = feishuPulledState.project_store.projects.find((item) => item.id === feishuProjectA)?.state;
const pulledEffect = feishuPulledProjectState.feedback.find((item) => item.feishu_record_id === 'rec-feishu-bitable-effect-001');
assert(pulledEffect.views === 3100 && pulledEffect.publish_link === 'https://example.com/feishu-bitable-effect', 'Bitable rich metrics and hyperlink should persist as clean scalar values');
assert(pulledEffect.created_at === '2026-07-15 12:00:00' && pulledEffect.notes === '家长关注体验课，也会问教练资质', 'Bitable timestamp and rich text should persist in normalized form');
assert(feishuPulledProjectState.daily_checkins.some((item) => item.feishu_record_id === 'rec-feishu-bitable-checkin-001'), 'check-in table should map to daily_checkins');
assert(feishuPulledProjectState.reputation_tasks.some((item) => item.feishu_record_id === 'rec-feishu-bitable-reputation-001'), 'reputation table should map to reputation_tasks');

const pulledFeedbackCount = feishuPulledProjectState.feedback.length;
const pulledAuditCount = feishuPulledProjectState.feishu_inbound_records.length;
bitableEffectViews = 4200;
const secondFeishuPull = await handler(internalRequest('POST', 'feishu/pull', {}));
assert(secondFeishuPull.status === 200, 'repeating a Feishu full pull should remain safe');
const secondFeishuPullBody = await secondFeishuPull.json();
assert(secondFeishuPullBody.summary.created === 0 && secondFeishuPullBody.summary.updated === 4, 'repeating the same record ids should be reported as idempotent updates');
feishuPulledState = await (await handler(request('GET', `state?client_id=${feishuClientA}`))).json();
feishuPulledProjectState = feishuPulledState.project_store.projects.find((item) => item.id === feishuProjectA)?.state;
assert(feishuPulledProjectState.feedback.length === pulledFeedbackCount && feishuPulledProjectState.feishu_inbound_records.length === pulledAuditCount, 'repeated Bitable pulls must not duplicate feedback or audit records');
assert(feishuPulledProjectState.feedback.find((item) => item.feishu_record_id === 'rec-feishu-bitable-effect-001')?.views === 4200, 'repeated Bitable pulls should update the existing record in place');
assert(bitableAuthCalls === 1, 'tenant access token should be reused from the in-memory cache');

const scheduledFeishuResponse = await scheduledFeishuPull(new Request('http://localhost/.netlify/functions/feishu-pull-scheduled', {
  method: 'POST',
  body: JSON.stringify({ next_run: '2026-07-15T12:15:00Z' }),
}));
assert(scheduledFeishuResponse.status === 200, 'scheduled Feishu pull should finish without throwing');
const scheduledFeishuBody = await scheduledFeishuResponse.json();
assert(scheduledFeishuBody.trigger === 'scheduled' && scheduledFeishuBody.ok === true, 'scheduled function should run the same Bitable pull path');

delete process.env.FEISHU_BASE_TOKEN;
process.env.FEISHU_WIKI_NODE_TOKEN = 'wiki-smoke-node';
const wikiFeishuPull = await handler(internalRequest('POST', 'feishu/pull', {}));
assert(wikiFeishuPull.status === 200, 'Wiki-backed Bitable pull should finish through the same internal route');
const wikiFeishuPullBody = await wikiFeishuPull.json();
assert(wikiFeishuPullBody.ok === true && wikiFeishuPullBody.token_source === 'wiki', 'Wiki-backed pull should resolve obj_token and report only the token source');
assert(bitableWikiResolveCalls === 1 && bitableAppTokens.includes('base-smoke-from-wiki'), 'Wiki node token should resolve to its Bitable app_token before records are fetched');
const repeatedWikiFeishuPull = await handler(internalRequest('POST', 'feishu/pull', {}));
assert(repeatedWikiFeishuPull.status === 200, 'repeated Wiki-backed pull should remain available');
assert(bitableWikiResolveCalls === 1, 'Wiki node resolution should use the in-memory cache on repeated pulls');
globalThis.fetch = fetchBeforeFeishuBitable;
['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_BASE_TOKEN', 'FEISHU_WIKI_NODE_TOKEN', 'FEISHU_TABLE_EFFECT', 'FEISHU_TABLE_CHECKIN', 'FEISHU_TABLE_REPUTATION', 'FEISHU_PULL_PAGE_SIZE', 'FEISHU_PULL_MAX_RECORDS'].forEach((key) => delete process.env[key]);

const anonymousFeishuPush = await handler(request('POST', 'feishu/push', { client_id: feishuClientA, project_id: feishuProjectA }));
assert(anonymousFeishuPush.status === 401, 'anonymous POST /feishu/push must be rejected');
const anonymousFeishuStatus = await handler(request('GET', `feishu/status?client_id=${feishuClientA}&project_id=${feishuProjectA}`));
assert(anonymousFeishuStatus.status === 401, 'anonymous GET /feishu/status must be rejected');
const missingFeishuPush = await handler(internalRequest('POST', 'feishu/push', { client_id: feishuClientA, project_id: feishuProjectA }));
assert(missingFeishuPush.status === 200, 'missing Feishu push credentials should fail closed without crashing');
const missingFeishuPushBody = await missingFeishuPush.json();
assert(missingFeishuPushBody.skipped === true && missingFeishuPushBody.reason === 'missing_feishu_app_credentials', 'missing Feishu push credentials should report an explicit skip reason');
const crossClientFeishuPush = await handler(internalRequest('POST', 'feishu/push', { client_id: feishuClientA, project_id: feishuProjectB }));
assert(crossClientFeishuPush.status === 404, 'Feishu push must not search another client bucket for the requested project');

process.env.FEISHU_APP_ID = 'cli_stage_c_smoke_app';
process.env.FEISHU_APP_SECRET = 'stage-c-smoke-secret-not-production';
process.env.FEISHU_BASE_TOKEN = 'base-stage-c-smoke';
const missingPlanTablePush = await handler(internalRequest('POST', 'feishu/push', { client_id: feishuClientA, project_id: feishuProjectA }));
assert(missingPlanTablePush.status === 200, 'missing FEISHU_TABLE_PLAN should fail closed without attempting a write');
assert((await missingPlanTablePush.json()).reason === 'missing_feishu_plan_table', 'missing plan table should return missing_feishu_plan_table');

process.env.FEISHU_TABLE_PLAN = 'tbl-plan-stage-c-smoke';
process.env.FEISHU_WORKSPACE_URL = 'https://example.feishu.cn/base/stage-c-smoke';
let feishuStageCAuthCalls = 0;
let feishuPlanListCalls = 0;
let feishuPlanCreateCalls = 0;
let feishuPlanUpdateCalls = 0;
let denyFeishuPlanWrites = false;
const remoteFeishuPlanRecords = [];
const fetchBeforeFeishuStageC = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const requestUrl = new URL(String(url));
  if (requestUrl.pathname.endsWith('/auth/v3/tenant_access_token/internal')) {
    feishuStageCAuthCalls += 1;
    return new Response(JSON.stringify({ code: 0, tenant_access_token: 'tenant-stage-c-smoke', expire: 7200 }), { status: 200 });
  }
  assert(String(options.headers?.authorization || '') === 'Bearer tenant-stage-c-smoke', 'Feishu Stage C requests should use the app tenant token');
  assert(requestUrl.pathname.includes('/apps/base-stage-c-smoke/tables/tbl-plan-stage-c-smoke/records'), 'Feishu Stage C must write only to the configured plan table');
  if (requestUrl.pathname.endsWith('/records') && String(options.method || 'GET').toUpperCase() === 'GET') {
    feishuPlanListCalls += 1;
    return new Response(JSON.stringify({ code: 0, data: { items: remoteFeishuPlanRecords, has_more: false, page_token: '' } }), { status: 200 });
  }
  if (requestUrl.pathname.endsWith('/records/batch_create')) {
    feishuPlanCreateCalls += 1;
    if (denyFeishuPlanWrites) return new Response(JSON.stringify({ code: 99991663, msg: 'permission denied' }), { status: 200 });
    const body = JSON.parse(String(options.body || '{}'));
    const records = body.records.map((record, index) => ({ record_id: `rec-stage-c-plan-${remoteFeishuPlanRecords.length + index + 1}`, fields: record.fields }));
    remoteFeishuPlanRecords.push(...records);
    return new Response(JSON.stringify({ code: 0, data: { records } }), { status: 200 });
  }
  if (requestUrl.pathname.endsWith('/records/batch_update')) {
    feishuPlanUpdateCalls += 1;
    if (denyFeishuPlanWrites) return new Response(JSON.stringify({ code: 99991663, msg: 'permission denied' }), { status: 200 });
    const body = JSON.parse(String(options.body || '{}'));
    body.records.forEach((record) => {
      const current = remoteFeishuPlanRecords.find((item) => item.record_id === record.record_id);
      if (current) current.fields = record.fields;
    });
    return new Response(JSON.stringify({ code: 0, data: { records: body.records } }), { status: 200 });
  }
  return new Response(JSON.stringify({ code: 1254040, msg: 'not found' }), { status: 404 });
};

const firstFeishuPush = await handler(internalRequest('POST', 'feishu/push', { client_id: feishuClientA, project_id: feishuProjectA }));
if (firstFeishuPush.status !== 200) throw new Error(`first Feishu plan push should succeed, got ${firstFeishuPush.status}: ${await firstFeishuPush.text()}`);
const firstFeishuPushBody = await firstFeishuPush.json();
assert(firstFeishuPushBody.summary.created === 1 && firstFeishuPushBody.summary.updated === 0 && firstFeishuPushBody.summary.failed === 0, 'first Feishu plan push should create one remote row');
assert(remoteFeishuPlanRecords.length === 1 && remoteFeishuPlanRecords[0].fields.内容计划ID === feishuPlanA, 'Feishu plan row should preserve the real plan id used by Stage B feedback matching');
assert(remoteFeishuPlanRecords[0].fields.客户ID === feishuClientA && remoteFeishuPlanRecords[0].fields.项目ID === feishuProjectA, 'Feishu plan row should preserve client/project isolation fields');
assert(remoteFeishuPlanRecords[0].fields.计划发布日期 === Date.parse('2026-07-18T00:00:00+08:00') && remoteFeishuPlanRecords[0].fields.平台 === '小红书', 'Feishu plan write should send date/select values in Bitable format');

const secondFeishuPush = await handler(internalRequest('POST', 'feishu/push', { client_id: feishuClientA, project_id: feishuProjectA }));
assert(secondFeishuPush.status === 200, 'repeating the same Feishu plan push should succeed');
const secondFeishuPushBody = await secondFeishuPush.json();
assert(secondFeishuPushBody.summary.created === 0 && secondFeishuPushBody.summary.updated === 1, 'repeated Feishu plan push should update the existing row');
assert(remoteFeishuPlanRecords.length === 1 && feishuPlanCreateCalls === 1 && feishuPlanUpdateCalls === 1, 'repeated Feishu plan push must not create a duplicate row');

const feishuStatusResponse = await handler(internalRequest('GET', `feishu/status?client_id=${feishuClientA}&project_id=${feishuProjectA}`));
assert(feishuStatusResponse.status === 200, 'internal Feishu collaboration status should be readable');
const feishuStatusBody = await feishuStatusResponse.json();
assert(feishuStatusBody.configured === true && feishuStatusBody.last_push_at && feishuStatusBody.plan_record_count === 1, 'Feishu collaboration status should expose non-sensitive sync state');
assert(feishuStatusBody.workspace_url === process.env.FEISHU_WORKSPACE_URL, 'Feishu collaboration status should expose only the configured workspace link');

denyFeishuPlanWrites = true;
const deniedFeishuPush = await handler(internalRequest('POST', 'feishu/push', { client_id: feishuClientA, project_id: feishuProjectA }));
assert(deniedFeishuPush.status === 502, 'Feishu write permission errors should fail closed');
const deniedFeishuPushBody = await deniedFeishuPush.json();
assert(deniedFeishuPushBody.ok === false && deniedFeishuPushBody.summary.failed === 1 && deniedFeishuPushBody.errors[0]?.reason === 'feishu_api_code_99991663', 'Feishu permission errors should remain explicit and must not masquerade as success');
assert(remoteFeishuPlanRecords.length === 1, 'failed Feishu writes must not create local or remote duplicate rows');
globalThis.fetch = fetchBeforeFeishuStageC;
['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_BASE_TOKEN', 'FEISHU_TABLE_PLAN', 'FEISHU_WORKSPACE_URL'].forEach((key) => delete process.env[key]);

const qaProjectId = 'qa_generation_project';
const qaClientId = 'internal';
const referenceText = 'mock video reference asset for generation workbench';
const referenceSha = createHash('sha256').update(referenceText).digest('hex');
const anonymousAssetPost = await handler(request('POST', 'assets', { client_id: qaClientId }));
assert(anonymousAssetPost.status === 401, 'anonymous POST /assets must be rejected');
const anonymousTaskPost = await handler(request('POST', 'generation-tasks', { client_id: qaClientId }));
assert(anonymousTaskPost.status === 401, 'anonymous POST /generation-tasks must be rejected');
const anonymousTaskActionPost = await handler(request('POST', 'generation-tasks/nonexistent/submit', { client_id: qaClientId }));
assert(anonymousTaskActionPost.status === 401, 'anonymous generation task action must be rejected');
const anonymousFeishuPost = await handler(request('POST', 'feishu/sync', { client_id: qaClientId, task_id: 'nonexistent' }));
assert(anonymousFeishuPost.status === 401, 'anonymous POST /feishu/sync must be rejected');
const assetRes = await handler(internalRequest('POST', 'assets', {
  client_id: qaClientId,
  client_name: 'QA测试客户',
  project_id: qaProjectId,
  project_name: '企业营销工具验收测试',
  original_filename: 'qa-reference.txt',
  mime_type: 'text/plain',
  text_content: referenceText,
  sha256: referenceSha,
  source: 'internal',
  usage_scope: 'current_project_only',
}));
if (assetRes.status !== 201) throw new Error(`POST /assets should create asset, got ${assetRes.status}: ${await assetRes.text()}`);
const assetData = await assetRes.json();
assert(assetData.asset.sha256 === referenceSha, 'asset upload should preserve server-verified sha256');
assert(assetData.asset.status === 'ok', 'asset status should be ok');

const dentalContextTaskResponse = await handler(internalRequest('POST', 'generation-tasks', {
  project_id: 'project-dental',
  client_id: 'dental',
  client_name: '社区口腔门诊',
  content_plan_record_id: String(dentalData.plans[0].id),
  platform: '小红书',
  generation_type: 'copy',
  prompt: '根据当前选题生成一篇小红书笔记',
  output_spec: { format: '小红书笔记', client_visible: false },
}));
assert(dentalContextTaskResponse.status === 201, 'generation task should load the existing customer project context');
const dentalContextTask = (await dentalContextTaskResponse.json()).task;
assert(dentalContextTask.production_context?.context_found === true, 'generation task should snapshot an existing project business context');
assert(dentalContextTask.production_context?.business?.industry.includes('口腔'), 'production context must retain the current customer industry');
assert(dentalContextTask.production_context?.plan?.topic === dentalData.plans[0].topic, 'production context must bind the selected content plan topic');
assert(dentalContextTask.production_context?.platform_rules?.some((rule) => rule.includes('20个字符')), 'production context must include the selected platform publishing rules');

const videoTaskRes = await handler(internalRequest('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_001',
  platform: '小红书',
  content_type: '视频',
  generation_type: 'video',
  idempotency_key: 'qa-video-generation-request-001',
  requested_model: 'Seedance 2.0',
  prompt: '生成一条项目化素材验收短视频 mock',
  output_spec: { size: '1080x1920', duration: '6s', ratio: '9:16', generate_audio: true, style: '真实工作台演示', client_visible: true },
  input_asset_ids: [assetData.asset.asset_id],
}));
if (videoTaskRes.status !== 201) throw new Error(`POST /generation-tasks video should create task, got ${videoTaskRes.status}: ${await videoTaskRes.text()}`);
const videoTask = (await videoTaskRes.json()).task;
assert(videoTask.status === 'draft', 'video task should start as draft');
assert(videoTask.requested_model === 'Seedance 2.0', 'video task requested_model should be Seedance 2.0');
assert(videoTask.output_spec.ratio === '9:16' && videoTask.output_spec.generate_audio === true, 'video task should preserve ratio and audio settings');
const repeatedVideoTaskResponse = await handler(internalRequest('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  content_plan_record_id: 'qa_content_plan_001',
  generation_type: 'video',
  idempotency_key: 'qa-video-generation-request-001',
}));
const repeatedVideoTask = (await repeatedVideoTaskResponse.json()).task;
assert(repeatedVideoTask.task_id === videoTask.task_id && repeatedVideoTask.idempotent_replay === true, 'repeating a generation create request with the same idempotency key must reuse the saved task');

const submittedVideo = await (await handler(internalRequest('POST', `generation-tasks/${videoTask.task_id}/submit`, { client_id: qaClientId }))).json();
assert(submittedVideo.task.status === 'generating', 'video submit should enter generating, not wait for final output');
assert(submittedVideo.task.provider_job_id, 'video submit should return provider_job_id');
assert(submittedVideo.task.actual_model === 'Seedance 2.0', 'mock video adapter should set actual_model to requested model');
assert(submittedVideo.task.provider === 'seedance-video', 'video adapter provider should be seedance-video');
assert(submittedVideo.task.fallback === true && submittedVideo.task.fallback_reason === 'MOCK_KEY_MISSING', 'missing Ark key should return explicit Seedance mock evidence');
assert(submittedVideo.task.adapter_manifest?.mode === 'mock', 'video submit should persist adapter manifest');

const videoPoll1 = await (await handler(internalRequest('POST', `generation-tasks/${videoTask.task_id}/poll`, { client_id: qaClientId }))).json();
assert(videoPoll1.task.status === 'generating', 'first video poll should remain generating');
assert(videoPoll1.task.adapter_state?.backoff_ms > 0, 'video poll should persist retry/backoff state for resume');
const videoPoll2 = await (await handler(internalRequest('POST', `generation-tasks/${videoTask.task_id}/poll`, { client_id: qaClientId }))).json();
assert(videoPoll2.task.status === 'qa_pending', 'second video poll should produce output and enter qa_pending');
assert(videoPoll2.task.output_asset_ids.length === 1, 'generated video should create one output asset');
assert(videoPoll2.task.adapter_manifest?.provider === 'seedance-video', 'video poll should keep output manifest');

const qaFailed = await (await handler(internalRequest('POST', `generation-tasks/${videoTask.task_id}/qa`, {
  client_id: qaClientId,
  qa_status: 'failed',
  qa_reviewer: 'QA',
  rejection_reason: '画面字幕需要调整',
  qa_notes: '先失败一次验证状态机',
}))).json();
assert(qaFailed.task.status === 'qa_failed', 'QA failed should move task to qa_failed');
assert(qaFailed.task.qa.rejection_reason.includes('字幕'), 'QA failed should record rejection_reason');
const clientTasksAfterFail = await (await handler(internalRequest('GET', `generation-tasks?client_id=${qaClientId}&project_id=${qaProjectId}&view=client`))).json();
assert(!clientTasksAfterFail.tasks.some((task) => task.task_id === videoTask.task_id), 'failed QA task must not appear in client delivery view');

const qaPassed = await (await handler(internalRequest('POST', `generation-tasks/${videoTask.task_id}/qa`, {
  client_id: qaClientId,
  qa_status: 'passed',
  qa_reviewer: 'QA',
  qa_notes: '验收通过，可交付',
  visual_check: true,
  content_check: true,
  brand_check: true,
  platform_fit_check: true,
  client_visibility_check: true,
}))).json();
assert(qaPassed.task.status === 'client_ready', 'QA passed should move task to client_ready');
assert(qaPassed.task.qa.qa_status === 'passed', 'QA passed should record qa_status');
const clientTasksAfterPass = await (await handler(internalRequest('GET', `generation-tasks?client_id=${qaClientId}&project_id=${qaProjectId}&view=client`))).json();
const visibleVideoTask = clientTasksAfterPass.tasks.find((task) => task.task_id === videoTask.task_id);
assert(visibleVideoTask, 'passed QA task should appear in client delivery view');
const visibleText = JSON.stringify(visibleVideoTask);
['requested_model', 'actual_model', 'provider', 'fallback', 'error', 'provider_job_id', 'debug'].forEach((word) => {
  assert(!visibleText.includes(word), `client delivery task must hide internal field ${word}`);
});

const deliveredVideo = await (await handler(internalRequest('POST', `generation-tasks/${videoTask.task_id}/deliver`, { client_id: qaClientId }))).json();
assert(deliveredVideo.task.status === 'delivered', 'client_ready task should be deliverable');
const feishuManual = await (await handler(internalRequest('POST', 'feishu/sync', { client_id: qaClientId, task_id: videoTask.task_id }))).json();
assert(feishuManual.synced === false && feishuManual.mode === 'manual_payload' && feishuManual.fallback_reason === 'missing_feishu_webhook_url', 'Feishu stage A should return an importable payload when webhook is not configured');
['A_customer_profile', 'B_content_plan', 'C_outsourced_production', 'D_internal_qa', 'E_client_delivery', 'F_data_return'].forEach((key) => {
  assert(feishuManual.payload[key], `feishu payload should include ${key}`);
});
const fetchBeforeFeishuWebhook = globalThis.fetch;
let feishuWebhookRequest = null;
process.env.FEISHU_BOT_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/smoke-only';
globalThis.fetch = async (url, options = {}) => {
  feishuWebhookRequest = { url: String(url), body: JSON.parse(String(options.body || '{}')) };
  return new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const feishuWebhook = await (await handler(internalRequest('POST', 'feishu/sync', { client_id: qaClientId, task_id: videoTask.task_id }))).json();
assert(feishuWebhook.synced === true && feishuWebhook.mode === 'webhook', 'configured Feishu webhook should receive the outbound task message');
assert(feishuWebhookRequest?.url === process.env.FEISHU_BOT_WEBHOOK && feishuWebhookRequest?.body?.msg_type === 'text', 'Feishu webhook request should prefer FEISHU_BOT_WEBHOOK and use a bot text payload');
globalThis.fetch = fetchBeforeFeishuWebhook;
delete process.env.FEISHU_BOT_WEBHOOK;

const coverTask = await (await handler(internalRequest('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_002',
  platform: '小红书',
  content_type: '封面',
  generation_type: 'cover',
  requested_model: 'GPT-Image-2',
  prompt: '生成一张项目化素材验收封面图 mock',
  output_spec: { size: '1024x1024', cover_text: '项目化素材验收', style: '清晰专业', client_visible: true },
}))).json();
assert(coverTask.task.requested_model === 'GPT-Image-2', 'cover task should request GPT-Image-2');
assert(coverTask.task.output_spec.cover_text === '项目化素材验收', 'cover task should preserve the cover headline');
const submittedCover = await (await handler(internalRequest('POST', `generation-tasks/${coverTask.task.task_id}/submit`, { client_id: qaClientId }))).json();
assert(submittedCover.task.status === 'qa_pending', 'cover task should synchronously generate and enter qa_pending');
assert(submittedCover.task.actual_model === 'GPT-Image-2' && submittedCover.task.provider === 'openai-image', 'cover task should use openai-image mock adapter');
assert(submittedCover.task.fallback === true && submittedCover.task.fallback_reason === 'MOCK_KEY_MISSING', 'missing OpenAI key should return explicit image mock evidence');
const coverPassed = await (await handler(internalRequest('POST', `generation-tasks/${coverTask.task.task_id}/qa`, {
  client_id: qaClientId,
  qa_status: 'passed',
  qa_reviewer: 'QA',
  visual_check: true,
  content_check: true,
  brand_check: true,
  platform_fit_check: true,
  client_visibility_check: true,
}))).json();
assert(coverPassed.task.status === 'client_ready', 'cover QA passed should enter client_ready');

const imageTask = await (await handler(internalRequest('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_002_image',
  platform: '小红书',
  generation_type: 'image',
  prompt: '生成一张真实门店服务场景配图 mock',
  output_spec: { size: '1024x1536', usage: '服务场景', style: '真实摄影、自然光', client_visible: false },
}))).json();
assert(imageTask.task.content_type === '图文', 'image task should default to the correct customer-facing content type');
assert(imageTask.task.output_spec.usage === '服务场景', 'image task should preserve its type-specific usage setting');
const submittedImage = await (await handler(internalRequest('POST', `generation-tasks/${imageTask.task.task_id}/submit`, { client_id: qaClientId }))).json();
assert(submittedImage.task.status === 'qa_pending', 'image task should synchronously generate and enter qa_pending');
assert(submittedImage.task.provider === 'openai-image' && submittedImage.task.fallback_reason === 'MOCK_KEY_MISSING', 'image task should expose an explicit mock when OpenAI Images is unavailable');
assert(submittedImage.task.output_asset_ids.length === 1, 'image task should persist one output asset');

const copyTask = await (await handler(internalRequest('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_002',
  platform: '小红书',
  generation_type: 'copy',
  requested_model: 'Claude + GLM A/B',
  prompt: '生成一段 A/B 文案测试脚本',
  output_spec: { style: 'A/B', client_visible: false },
}))).json();
assert(copyTask.task.content_type === '文案', 'copy task should default to the correct customer-facing content type');
assert(copyTask.task.output_spec.style === 'A/B', 'copy task should preserve its type-specific output setting');
assert(copyTask.task.input_asset_ids.includes(submittedCover.task.output_asset_ids[0]), 'copy tasks should automatically inherit generated images from the same content plan');
assert(copyTask.task.auto_linked_asset_ids.includes(submittedCover.task.output_asset_ids[0]) && copyTask.task.production_context?.asset_briefs?.length >= 1, 'automatic same-batch asset linking should remain auditable in task context');
const submittedCopy = await (await handler(internalRequest('POST', `generation-tasks/${copyTask.task.task_id}/submit`, { client_id: qaClientId }))).json();
assert(submittedCopy.task.status === 'qa_pending', 'copy task should synchronously generate and enter qa_pending');
assert(submittedCopy.task.provider === 'claude-text+glm-text', 'copy task should run Claude + GLM A/B adapter');
assert(submittedCopy.task.fallback === true && submittedCopy.task.fallback_reason.includes('MOCK_KEY_MISSING'), 'missing text keys should return explicit A/B mock evidence');
assert(submittedCopy.task.adapter_manifest?.output?.variants?.claude && submittedCopy.task.adapter_manifest?.output?.variants?.glm, 'copy task manifest should include both text adapter variants');

const originalFetch = globalThis.fetch;
process.env.KIMI_API_KEY = 'smoke-kimi-key';
process.env.SAFE_TO_RUN = 'true';
process.env.URL = 'https://background-smoke.example';
let backgroundTriggerRequest = null;
let kimiGenerationCalls = 0;
let lastKimiUserPrompt = '';
let lastKimiUserContent = null;
let lastKimiRequestBody = null;
const kimiGeneratedText = '安标系统短视频脚本：先说明企业最容易忽略的合规节点，再给出现场可执行的检查清单。';
let kimiResponseQueue = [];
globalThis.fetch = async (url, options = {}) => {
  const requestUrl = String(url);
  if (requestUrl.endsWith('/.netlify/functions/generate-background')) {
    backgroundTriggerRequest = {
      method: options.method,
      token: options.headers?.['x-background-generation-token'],
      body: JSON.parse(String(options.body || '{}')),
    };
    return new Response('', { status: 202 });
  }
  if (requestUrl.endsWith('/chat/completions')) {
    kimiGenerationCalls += 1;
    const requestBody = JSON.parse(String(options.body || '{}'));
    lastKimiRequestBody = requestBody;
    lastKimiUserContent = requestBody.messages?.filter((item) => item.role === 'user')?.[0]?.content || '';
    lastKimiUserPrompt = Array.isArray(lastKimiUserContent)
      ? String(lastKimiUserContent.find((item) => item?.type === 'text')?.text || '')
      : String(lastKimiUserContent || '');
    const queued = kimiResponseQueue.shift() || {};
    return new Response(JSON.stringify({
      model: 'kimi-k2.6',
      choices: [{
        finish_reason: queued.finish_reason || 'stop',
        message: { content: queued.text || kimiGeneratedText },
      }],
      usage: queued.usage || { prompt_tokens: 120, completion_tokens: 180, total_tokens: 300 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error(`unexpected Kimi smoke fetch: ${requestUrl}`);
};
const kimiReferenceAsset = (await (await handler(internalRequest('POST', 'assets', {
  client_id: qaClientId,
  client_name: 'QA测试客户',
  project_id: qaProjectId,
  project_name: '企业营销工具验收测试',
  content_plan_record_id: 'qa_content_plan_kimi_background',
  original_filename: 'kimi-reference.png',
  mime_type: 'image/png',
  storage_url: 'data:image/png;base64,AAAA',
  generation_brief: '负责人在检测现场展示资料检查清单',
  source: 'internal',
  usage_scope: 'current_project_only',
}))).json()).asset;
const kimiTaskResponse = await handler(internalRequest('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_kimi_background',
  platform: '小红书',
  content_type: '脚本',
  generation_type: 'script',
  prompt: '为安标系统生成一条负责人能直接录制的短视频脚本',
  output_spec: { format: '口播脚本', target_duration: '60秒', must_include: '合规节点、检查清单', style: '负责人专业口播', client_visible: false },
  input_asset_ids: [kimiReferenceAsset.asset_id],
}));
assert(kimiTaskResponse.status === 201, 'Kimi background task should be created');
const kimiTask = (await kimiTaskResponse.json()).task;
assert(kimiTask.provider === 'kimi-text' && kimiTask.requested_model.includes('kimi-k2.6'), 'configured Kimi should own script generation');
assert(kimiTask.output_spec.format === '口播脚本' && kimiTask.output_spec.target_duration === '60秒' && kimiTask.output_spec.must_include.includes('检查清单'), 'script task should preserve type-specific production settings');
const submittedKimiResponse = await handler(internalRequest('POST', `generation-tasks/${kimiTask.task_id}/submit`, { client_id: qaClientId }));
assert(submittedKimiResponse.status === 200, 'Kimi background task submit should return immediately');
const submittedKimi = (await submittedKimiResponse.json()).task;
assert(submittedKimi.status === 'generating', 'Kimi submit should stop at generating while the background function works');
assert(kimiGenerationCalls === 0, 'Kimi submit must not call the long-running model in the synchronous API function');
assert(backgroundTriggerRequest?.method === 'POST', 'Kimi submit should trigger the Netlify background function');
assert(backgroundTriggerRequest?.token === BACKGROUND_GENERATION_TOKEN, 'background trigger should carry the server-only background token');
assert(backgroundTriggerRequest?.body?.task_id === kimiTask.task_id, 'background trigger should identify the saved generation task');

const unauthorizedBackgroundResponse = await backgroundGenerationHandler(new Request('http://localhost/.netlify/functions/generate-background', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ client_id: qaClientId, task_id: kimiTask.task_id }),
}));
assert(unauthorizedBackgroundResponse.status === 401, 'background generation must reject unsigned public requests');
const authorizedBackgroundRequest = () => new Request('http://localhost/.netlify/functions/generate-background', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-background-generation-token': BACKGROUND_GENERATION_TOKEN,
  },
  body: JSON.stringify({ client_id: qaClientId, task_id: kimiTask.task_id }),
});
const generatedKimiResponse = await backgroundGenerationHandler(authorizedBackgroundRequest());
assert(generatedKimiResponse.status === 200, 'authorized background generation should complete locally');
const generatedKimiBody = await generatedKimiResponse.json();
assert(generatedKimiBody.ok === true && generatedKimiBody.status === 'qa_pending', 'background generation should persist the final QA-pending status');
const polledKimi = await (await handler(internalRequest('POST', `generation-tasks/${kimiTask.task_id}/poll`, { client_id: qaClientId }))).json();
assert(polledKimi.task.status === 'qa_pending', 'Kimi poll should read the result written by the background function');
assert(polledKimi.task.actual_model === 'kimi-k2.6' && polledKimi.task.fallback === false, 'Kimi task should retain real-model evidence');
assert(polledKimi.task.output_asset_ids.length === 1, 'Kimi background generation should persist exactly one output asset');
const kimiAssetsResponse = await handler(internalRequest('GET', `assets?client_id=${qaClientId}&project_id=${qaProjectId}`));
const kimiAssets = (await kimiAssetsResponse.json()).assets;
const kimiOutputAsset = kimiAssets.find((asset) => asset.asset_id === polledKimi.task.output_asset_ids[0]);
assert(kimiOutputAsset?.notes === kimiGeneratedText, 'generated Kimi script should be readable from the output asset notes field');
assert(lastKimiUserPrompt.includes('内容形式：口播脚本') && lastKimiUserPrompt.includes('目标时长：60秒') && lastKimiUserPrompt.includes('必须包含：合规节点、检查清单'), 'Kimi should receive the structured script settings in its model prompt');
assert(lastKimiRequestBody?.thinking?.type === 'disabled', 'Kimi copy and script generation should disable extended thinking so the response budget remains available for the deliverable');
assert(Array.isArray(lastKimiUserContent) && lastKimiUserContent.some((item) => item?.type === 'image_url'), 'Kimi should receive selected image assets through the multimodal message when a readable image URL exists');
assert(lastKimiUserPrompt.includes('本批次已关联素材') && lastKimiUserPrompt.includes('负责人在检测现场展示资料检查清单'), 'Kimi should receive the same-batch asset brief in addition to the image payload');
assert(lastKimiUserPrompt.includes('小红书所有标题候选都不得超过20个字符') && lastKimiUserPrompt.includes('标点和emoji均计入'), 'Kimi should receive the Xiaohongshu 20-character title limit as a platform-level hard rule');
assert(polledKimi.task.adapter_manifest?.output?.completeness_checked === true && polledKimi.task.adapter_manifest?.output?.completeness_passed === true, 'complete Kimi text should retain positive completeness evidence');
assert(polledKimi.task.adapter_manifest?.output?.continuation_rounds === 0 && polledKimi.task.adapter_manifest?.output?.regeneration_attempted === false, 'complete Kimi text should not spend continuation or regeneration calls');
const repeatedBackgroundResponse = await backgroundGenerationHandler(authorizedBackgroundRequest());
assert(repeatedBackgroundResponse.status === 200, 'repeating a completed background request should be safe');
assert(kimiGenerationCalls === 1, 'completed background tasks must be idempotent and must not call Kimi twice');

kimiResponseQueue = [
  {
    text: '## 口播文案\n明天开标，检测报告还没拿到？先别慌。\n\n## 字幕与包装\n- 大字',
    finish_reason: 'length',
    usage: { prompt_tokens: 180, completion_tokens: 1800, total_tokens: 1980 },
  },
  {
    text: '：明天开标，检测报告还没拿到？\n- 小字：投标检测至少提前两周准备。',
    finish_reason: 'stop',
    usage: { prompt_tokens: 240, completion_tokens: 120, total_tokens: 360 },
  },
];
const continuationTask = (await (await handler(internalRequest('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_kimi_continuation',
  platform: '视频号',
  content_type: '脚本',
  generation_type: 'script',
  prompt: '生成带有口播文案和字幕包装的完整短视频脚本',
  output_spec: { style: '负责人专业口播', client_visible: false },
}))).json()).task;
await handler(internalRequest('POST', `generation-tasks/${continuationTask.task_id}/submit`, { client_id: qaClientId }));
const continuedResponse = await backgroundGenerationHandler(new Request('http://localhost/.netlify/functions/generate-background', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-background-generation-token': BACKGROUND_GENERATION_TOKEN,
  },
  body: JSON.stringify({ client_id: qaClientId, task_id: continuationTask.task_id }),
}));
assert(continuedResponse.status === 200, 'truncated Kimi output should be repaired inside the background function');
const continuedTask = (await (await handler(internalRequest('POST', `generation-tasks/${continuationTask.task_id}/poll`, { client_id: qaClientId }))).json()).task;
const continuedAssets = (await (await handler(internalRequest('GET', `assets?client_id=${qaClientId}&project_id=${qaProjectId}`))).json()).assets;
const continuedAsset = continuedAssets.find((asset) => asset.asset_id === continuedTask.output_asset_ids[0]);
assert(continuedTask.status === 'qa_pending' && continuedTask.fallback === false, 'successfully continued Kimi output should enter QA without fallback');
assert(continuedAsset?.notes.includes('- 大字：明天开标') && continuedAsset?.notes.includes('- 小字：投标检测至少提前两周准备。'), 'continuation should join the interrupted list item into a complete script');
assert((continuedAsset?.notes.match(/## 字幕与包装/g) || []).length === 1, 'continuation merge should not duplicate existing sections');
assert(continuedTask.adapter_manifest?.output?.initial_incomplete_reasons.includes('provider_token_limit'), 'truncated Kimi output should record the provider token-limit evidence');
assert(continuedTask.adapter_manifest?.output?.continuation_rounds === 1 && continuedTask.adapter_manifest?.output?.completeness_passed === true, 'one successful continuation should satisfy the completeness gate');
assert(continuedTask.adapter_manifest?.output?.regeneration_attempted === false, 'successful continuation should avoid a full regeneration');

kimiResponseQueue = [
  {
    text: '## 口播文案\n先讲清企业最容易遗漏的检测资料。\n\n## 拍摄提示',
    finish_reason: 'length',
    usage: { prompt_tokens: 170, completion_tokens: 1800, total_tokens: 1970 },
  },
  {
    text: '## 拍摄提示',
    finish_reason: 'stop',
    usage: { prompt_tokens: 210, completion_tokens: 20, total_tokens: 230 },
  },
  {
    text: '## 口播文案\n先讲清企业最容易遗漏的检测资料，再给出提前准备清单。\n\n## 拍摄提示\n负责人正对镜头说明三个准备节点，结尾提醒提前咨询。',
    finish_reason: 'stop',
    usage: { prompt_tokens: 190, completion_tokens: 220, total_tokens: 410 },
  },
];
const regenerationTask = (await (await handler(internalRequest('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_kimi_regeneration',
  platform: '视频号',
  content_type: '脚本',
  generation_type: 'script',
  prompt: '生成包含口播文案和拍摄提示的完整短视频脚本',
  output_spec: { style: '负责人专业口播', client_visible: false },
}))).json()).task;
await handler(internalRequest('POST', `generation-tasks/${regenerationTask.task_id}/submit`, { client_id: qaClientId }));
const regeneratedResponse = await backgroundGenerationHandler(new Request('http://localhost/.netlify/functions/generate-background', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-background-generation-token': BACKGROUND_GENERATION_TOKEN,
  },
  body: JSON.stringify({ client_id: qaClientId, task_id: regenerationTask.task_id }),
}));
assert(regeneratedResponse.status === 200, 'Kimi should regenerate from scratch when continuation makes no progress');
const regeneratedTask = (await (await handler(internalRequest('POST', `generation-tasks/${regenerationTask.task_id}/poll`, { client_id: qaClientId }))).json()).task;
const regeneratedAssets = (await (await handler(internalRequest('GET', `assets?client_id=${qaClientId}&project_id=${qaProjectId}`))).json()).assets;
const regeneratedAsset = regeneratedAssets.find((asset) => asset.asset_id === regeneratedTask.output_asset_ids[0]);
assert(regeneratedTask.status === 'qa_pending' && regeneratedTask.fallback === false, 'complete full regeneration should enter QA without fallback');
assert(regeneratedAsset?.notes.endsWith('结尾提醒提前咨询。'), 'full regeneration should replace the incomplete draft with a complete ending');
assert(regeneratedTask.adapter_manifest?.output?.regeneration_attempted === true && regeneratedTask.adapter_manifest?.output?.completeness_passed === true, 'regeneration path should remain visible in internal completeness evidence');
assert(regeneratedTask.adapter_manifest?.output?.provider_attempts === 3, 'regeneration evidence should count initial, continuation, and full-rewrite provider calls');
assert(kimiGenerationCalls === 6, 'Kimi completeness smoke should make one normal, two continuation, and three regeneration-path calls');

kimiResponseQueue = [
  {
    text: '## 口播文案\n先说明客户最关心的问题。\n\n## 字幕包装',
    finish_reason: 'length',
    usage: { prompt_tokens: 170, completion_tokens: 1800, total_tokens: 1970 },
  },
  {
    text: '：主标题',
    finish_reason: 'length',
    usage: { prompt_tokens: 210, completion_tokens: 1200, total_tokens: 1410 },
  },
  {
    text: '- 小字',
    finish_reason: 'stop',
    usage: { prompt_tokens: 220, completion_tokens: 20, total_tokens: 240 },
  },
  {
    text: '## 完整稿\n重新说明业务问题。\n\n## 结尾',
    finish_reason: 'length',
    usage: { prompt_tokens: 180, completion_tokens: 2400, total_tokens: 2580 },
  },
];
const incompleteTask = (await (await handler(internalRequest('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_kimi_incomplete',
  platform: '视频号',
  content_type: '脚本',
  generation_type: 'script',
  prompt: '生成一份必须完整收尾的短视频脚本',
  output_spec: { style: '负责人专业口播', client_visible: false },
}))).json()).task;
await handler(internalRequest('POST', `generation-tasks/${incompleteTask.task_id}/submit`, { client_id: qaClientId }));
const incompleteResponse = await backgroundGenerationHandler(new Request('http://localhost/.netlify/functions/generate-background', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-background-generation-token': BACKGROUND_GENERATION_TOKEN,
  },
  body: JSON.stringify({ client_id: qaClientId, task_id: incompleteTask.task_id }),
}));
assert(incompleteResponse.status === 200, 'background handler should persist an explicit failed task when every completeness repair is exhausted');
const failedIncompleteTask = (await (await handler(internalRequest('POST', `generation-tasks/${incompleteTask.task_id}/poll`, { client_id: qaClientId }))).json()).task;
assert(failedIncompleteTask.status === 'failed' && failedIncompleteTask.fallback === true, 'unrepaired incomplete Kimi text must fail closed instead of entering QA');
assert(failedIncompleteTask.output_asset_ids.length === 0, 'unrepaired incomplete Kimi text must not create a deliverable output asset');
assert(failedIncompleteTask.fallback_reason.startsWith('kimi_incomplete_after_repair:'), 'failed completeness gate should retain a specific machine-readable reason');
assert(failedIncompleteTask.adapter_manifest?.output?.completeness_passed === false && failedIncompleteTask.adapter_manifest?.output?.continuation_rounds === 2, 'failed completeness evidence should retain both continuation rounds');
assert(kimiGenerationCalls === 10, 'Kimi completeness smoke should include the four fail-closed provider calls');
globalThis.fetch = originalFetch;
delete process.env.KIMI_API_KEY;
delete process.env.SAFE_TO_RUN;
delete process.env.URL;

process.env.OPENAI_API_KEY = 'smoke-openai-image-key';
process.env.SAFE_TO_RUN = 'true';
process.env.URL = 'https://background-image-smoke.example';
let openAiImageTrigger = null;
let openAiImageTriggerCalls = 0;
let openAiImageCalls = 0;
globalThis.fetch = async (url, options = {}) => {
  const requestUrl = String(url);
  if (requestUrl.endsWith('/.netlify/functions/generate-background')) {
    openAiImageTriggerCalls += 1;
    openAiImageTrigger = JSON.parse(String(options.body || '{}'));
    return new Response('', { status: 202 });
  }
  if (requestUrl.endsWith('/images/generations')) {
    openAiImageCalls += 1;
    return new Response(JSON.stringify({
      model: 'gpt-image-2',
      data: [{ b64_json: 'AAAAAP01MatrixPTEAAAA=' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error(`unexpected OpenAI image smoke fetch: ${requestUrl}`);
};
const backgroundCoverTask = (await (await handler(internalRequest('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_openai_background',
  platform: '小红书',
  generation_type: 'cover',
  prompt: '生成一张后台图片任务验收封面',
  output_spec: { size: '1024x1024', cover_text: '后台出图验收', style: '简洁专业', client_visible: false },
}))).json()).task;
const submittedBackgroundCover = (await (await handler(internalRequest('POST', `generation-tasks/${backgroundCoverTask.task_id}/submit`, { client_id: qaClientId }))).json()).task;
assert(submittedBackgroundCover.status === 'generating', 'configured OpenAI image tasks should return immediately and generate in the background');
assert(openAiImageCalls === 0, 'image submit must not wait for the long-running image model in the synchronous API request');
assert(openAiImageTrigger?.task_id === backgroundCoverTask.task_id, 'image submit should trigger the shared authenticated background function');
const repeatedBackgroundCoverSubmit = (await (await handler(internalRequest('POST', `generation-tasks/${backgroundCoverTask.task_id}/submit`, { client_id: qaClientId }))).json()).task;
assert(repeatedBackgroundCoverSubmit.task_id === backgroundCoverTask.task_id && repeatedBackgroundCoverSubmit.status === 'generating', 'repeated image submit should return the existing in-flight task');
assert(openAiImageTriggerCalls === 1 && openAiImageCalls === 0, 'repeated image submit must not trigger a second provider job or image generation call');
const generatedBackgroundCoverResponse = await backgroundGenerationHandler(new Request('http://localhost/.netlify/functions/generate-background', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-background-generation-token': BACKGROUND_GENERATION_TOKEN,
  },
  body: JSON.stringify({ client_id: qaClientId, task_id: backgroundCoverTask.task_id }),
}));
assert(generatedBackgroundCoverResponse.status === 200, 'background image generation should complete through the background function');
const generatedBackgroundCover = (await (await handler(internalRequest('POST', `generation-tasks/${backgroundCoverTask.task_id}/poll`, { client_id: qaClientId }))).json()).task;
assert(generatedBackgroundCover.status === 'qa_pending' && generatedBackgroundCover.fallback === false, 'real background image output should enter QA without fallback');
assert(generatedBackgroundCover.actual_model === 'gpt-image-2' && generatedBackgroundCover.output_asset_ids.length === 1, 'background image output should preserve real-model evidence and one output asset');
const backgroundCoverAssets = (await (await handler(internalRequest('GET', `assets?client_id=${qaClientId}&project_id=${qaProjectId}`))).json()).assets;
const generatedBackgroundCoverAsset = backgroundCoverAssets.find((asset) => asset.asset_id === generatedBackgroundCover.output_asset_ids[0]);
assert(generatedBackgroundCoverAsset?.storage_url === 'data:image/png;base64,AAAAAP01MatrixPTEAAAA=', 'customer sanitizer must not alter embedded image data URLs');
assert(openAiImageCalls === 1, 'completed background image tasks should call the image provider exactly once');

const nakedCustomerAvatarResponse = await handler(request('POST', 'customer-brand-images', {
  client_id: 'dental',
  project_id: 'project-dental',
  image_type: 'avatar',
  request_id: 'customer-avatar-no-auth-0001',
}, { customerAccess: false }));
assert(nakedCustomerAvatarResponse.status === 401, 'customer account image generation must require customer ownership proof');
const crossProjectAvatarResponse = await handler(request('POST', 'customer-brand-images', {
  client_id: 'dental',
  project_id: 'project-florist',
  image_type: 'avatar',
  request_id: 'customer-avatar-cross-project-0001',
}));
assert(crossProjectAvatarResponse.status === 404, 'customer account image generation must not cross project/client boundaries');

const customerAvatarPayload = {
  client_id: 'dental',
  project_id: 'project-dental',
  image_type: 'avatar',
  request_id: 'customer-avatar-generation-0001',
};
const customerAvatarResponse = await handler(request('POST', 'customer-brand-images', customerAvatarPayload));
assert(customerAvatarResponse.status === 202, `customer avatar generation should queue asynchronously, got ${customerAvatarResponse.status}`);
const customerAvatarCreated = await customerAvatarResponse.json();
assert(customerAvatarCreated.task?.status === 'generating' && customerAvatarCreated.task?.image_type === 'avatar', 'customer avatar endpoint should return a safe generating state');
const customerAvatarPublicCreateText = JSON.stringify(customerAvatarCreated);
['provider', 'requested_model', 'actual_model', 'fallback', 'debug', 'prompt', 'qa'].forEach((field) => {
  assert(!customerAvatarPublicCreateText.includes(field), `customer avatar create response must hide internal field ${field}`);
});
const customerAvatarReplayResponse = await handler(request('POST', 'customer-brand-images', customerAvatarPayload));
const customerAvatarReplay = await customerAvatarReplayResponse.json();
assert(customerAvatarReplay.task?.task_id === customerAvatarCreated.task.task_id && customerAvatarReplay.duplicate === true, 'customer avatar request retry should reuse the same task');
assert(openAiImageTriggerCalls === 2, 'customer avatar request retry must not trigger a duplicate background job');
const customerAvatarInternal = (await (await handler(internalRequest('GET', `generation-tasks/${customerAvatarCreated.task.task_id}?client_id=dental`))).json()).task;
assert(customerAvatarInternal.purpose === 'customer_account_visual' && customerAvatarInternal.asset_role === 'account_avatar', 'customer avatar task should retain an internal account-visual purpose and asset role');
assert(customerAvatarInternal.output_spec.size === '1024x1024' && customerAvatarInternal.prompt.includes('社区口腔门诊'), 'customer avatar prompt should be generated on the server from the current project business');
assert(customerAvatarInternal.prompt.includes('不要生成任何文字') && customerAvatarInternal.prompt.includes('手机端头像尺寸'), 'customer avatar prompt should enforce text-free mobile-size legibility');
const customerAvatarBackgroundResponse = await backgroundGenerationHandler(new Request('http://localhost/.netlify/functions/generate-background', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-background-generation-token': BACKGROUND_GENERATION_TOKEN,
  },
  body: JSON.stringify({ client_id: 'dental', task_id: customerAvatarCreated.task.task_id }),
}));
assert(customerAvatarBackgroundResponse.status === 200, 'customer avatar should complete through the authenticated background function');
const customerAvatarDetailResponse = await handler(request('GET', `customer-brand-images/${customerAvatarCreated.task.task_id}?client_id=dental&project_id=project-dental`));
assert(customerAvatarDetailResponse.status === 200, 'customer avatar detail should be readable by the owning customer');
const customerAvatarDetail = await customerAvatarDetailResponse.json();
assert(customerAvatarDetail.image?.status === 'ready' && customerAvatarDetail.image?.image?.url?.startsWith('data:image/png;base64,'), 'completed customer avatar should expose a usable image preview and download URL');
const customerAvatarPublicDetailText = JSON.stringify(customerAvatarDetail);
['provider', 'requested_model', 'actual_model', 'fallback', 'debug', 'prompt', 'qa'].forEach((field) => {
  assert(!customerAvatarPublicDetailText.includes(field), `customer avatar detail must hide internal field ${field}`);
});

const customerBackgroundResponse = await handler(request('POST', 'customer-brand-images', {
  client_id: 'dental',
  project_id: 'project-dental',
  image_type: 'background',
  request_id: 'customer-background-generation-0001',
}));
assert(customerBackgroundResponse.status === 202, 'customer background image should queue asynchronously');
const customerBackgroundCreated = await customerBackgroundResponse.json();
const customerBackgroundInternal = (await (await handler(internalRequest('GET', `generation-tasks/${customerBackgroundCreated.task.task_id}?client_id=dental`))).json()).task;
assert(customerBackgroundInternal.asset_role === 'account_background' && customerBackgroundInternal.output_spec.size === '1536x1024', 'customer background task should use its own wide output specification and asset role');
assert(customerBackgroundInternal.prompt.includes('右侧和上半区') && customerBackgroundInternal.prompt.includes('左下与中下区域保留充足安全留白'), 'customer background prompt should protect the profile and introduction overlay areas');
const customerBackgroundGenerationResponse = await backgroundGenerationHandler(new Request('http://localhost/.netlify/functions/generate-background', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-background-generation-token': BACKGROUND_GENERATION_TOKEN,
  },
  body: JSON.stringify({ client_id: 'dental', task_id: customerBackgroundCreated.task.task_id }),
}));
assert(customerBackgroundGenerationResponse.status === 200, 'customer background image should complete through the background function');
const customerBrandImageListResponse = await handler(request('GET', 'customer-brand-images?client_id=dental&project_id=project-dental'));
assert(customerBrandImageListResponse.status === 200, 'owning customer should list the latest avatar and background tasks for the current project');
const customerBrandImageList = await customerBrandImageListResponse.json();
assert(customerBrandImageList.images?.length === 2 && new Set(customerBrandImageList.images.map((item) => item.image_type)).size === 2, 'customer account visual list should restore one latest avatar and one latest background task');
const crossCustomerBrandImageRead = await handler(request('GET', `customer-brand-images/${customerAvatarCreated.task.task_id}?client_id=florist&project_id=project-florist`));
assert(crossCustomerBrandImageRead.status === 404, 'another customer bucket must not read an account image task by task id');
assert(openAiImageCalls === 3, 'internal cover plus customer avatar and background should each call the image provider exactly once');
globalThis.fetch = originalFetch;
delete process.env.OPENAI_API_KEY;
delete process.env.SAFE_TO_RUN;
delete process.env.URL;

process.env.ARK_API_KEY = 'timeout-smoke-key';
process.env.ARK_MODEL = 'ep-timeout-baseline';
process.env.ARK_PLAN_MODEL = 'doubao-timeout-plan';
process.env.SAFE_TO_RUN = 'true';
globalThis.fetch = async () => {
  const error = new Error('simulated timeout');
  error.name = 'AbortError';
  throw error;
};
const { default: timeoutHandler } = await import(`../netlify/functions/api.mjs?timeout-smoke=${Date.now()}`);
const timeoutResponse = await timeoutHandler(internalRequest('POST', 'assessments', {
  ...payload,
  client_id: 'timeout-fallback-smoke',
  company_name: '超时兜底验证客户',
}));
assert(timeoutResponse.status === 201, `simulated Ark timeout should return 201, got ${timeoutResponse.status}`);
const timeoutData = await timeoutResponse.json();
assert(timeoutData.plans?.length === 7, 'simulated Ark timeout should still return seven rule-template plans');
assert(timeoutData.generation_meta?.fallback === true && timeoutData.generation_meta?.actual_model === 'rule_template', 'simulated Ark timeout should explicitly use the rule-template fallback');
assert(timeoutData.generation_meta?.fallback_reason === 'ark_timeout', `expected ark_timeout fallback reason, got ${timeoutData.generation_meta?.fallback_reason}`);
assert(timeoutData.generation_meta?.requested_model === 'doubao-timeout-plan', 'timeout evidence should identify the dedicated plan model request');
const publicTimeoutResponse = await timeoutHandler(request('POST', 'assessments', {
  ...payload,
  client_id: 'timeout-public-smoke',
  company_name: '公开超时兜底验证客户',
}));
assert(publicTimeoutResponse.status === 401, `public POST /assessments must stay behind the internal token during provider timeout, got ${publicTimeoutResponse.status}`);
let claimGuardRequestBody = '';
globalThis.fetch = async (_url, options = {}) => {
  claimGuardRequestBody = String(options.body || '');
  return new Response(JSON.stringify({
  model: 'doubao-timeout-plan',
  choices: [{ message: { content: JSON.stringify({
    plans: Array.from({ length: 7 }, (_, index) => ({
      topic: index === 0 ? '免费接送孩子上篮球课' : `安全选题${index + 1}`,
      angle: '围绕家长真实顾虑说明课程',
      content_type: '图文',
      cta: '咨询体验课安排',
    })),
  }) } }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const { default: claimGuardHandler } = await import(`../netlify/functions/api.mjs?claim-smoke=${Date.now()}`);
const claimGuardResponse = await claimGuardHandler(internalRequest('POST', 'assessments', {
  ...payload,
  client_id: 'unsupported-claim-smoke',
  company_name: '模型承诺门禁验证客户',
  industry: '少儿篮球培训机构',
  main_goal: '获得家长咨询和体验课预约',
  target_customer: '附近有6-12岁孩子的家长',
  customer_pain: '担心安全和孩子跟不上',
}));
assert(claimGuardResponse.status === 201, `unsupported model claim should still return 201, got ${claimGuardResponse.status}`);
const claimGuardData = await claimGuardResponse.json();
assert(claimGuardData.generation_meta?.provider === 'volcengine_ark' && claimGuardData.generation_meta?.fallback === false, 'safe local claim cleanup should preserve the real Ark result instead of dropping the whole batch to templates');
assert(claimGuardData.generation_meta?.content_safety_adjusted === true && claimGuardData.generation_meta?.safety_adjustment_count >= 2, 'claim cleanup must remain auditable in internal model evidence');
assert(!JSON.stringify(claimGuardData.plans).includes('免费接送'), 'unsupported model claim must not reach the returned content plans');
for (const claim of ['免费', '接送', '无隐形消费', '包会', '保证效果', '立减', '折扣', '优惠', '赠送', '返现']) {
  assert(!JSON.stringify(claimGuardData.plans).includes(claim), `unsupported model claim must be removed before delivery: ${claim}`);
}
for (const claim of ['免费', '接送', '无隐形消费', '包会', '保证效果', '立减', '折扣', '优惠', '赠送', '返现']) {
  assert(claimGuardRequestBody.includes(claim), `Ark plan prompt should explicitly forbid unsupported claim: ${claim}`);
}
assert(claimGuardRequestBody.includes('cta<=14字') && claimGuardRequestBody.includes('咨询咨询') && claimGuardRequestBody.includes('7条cta动作要多样'), 'Ark plan prompt should constrain CTA length, grammar, and action diversity');
assert(claimGuardRequestBody.includes('小红书标题口语化') && claimGuardRequestBody.includes('不要把小红书语气套到其他平台'), 'Ark plan prompt should strengthen XHS tone without leaking it into other platforms');
assert(claimGuardRequestBody.includes('脱离正文也能独立看懂') && claimGuardRequestBody.includes('禁止模糊指代'), 'Ark plan prompt should require semantically complete standalone titles');

let nextRoundRequestBody = null;
globalThis.fetch = async (_url, options = {}) => {
  nextRoundRequestBody = JSON.parse(String(options.body || '{}'));
  return new Response(JSON.stringify({
    model: 'ep-doubao-seed-2-1-turbo-smoke',
    choices: [{ message: { content: JSON.stringify({
      title: '下一轮先补家长信任',
      nextTopic: '零基础孩子第一节课练什么',
      judgment: '有浏览和咨询，继续放大体验课信任证据',
      action: '补充课堂实拍和教练讲解',
      copy_suggestion: '用真实课堂片段回答家长最担心的问题',
      review_judgment: { type: '加码', more: '真实课堂', less: '泛泛口号', why: '咨询集中在零基础与安全' },
      customer_summary: '多发真实课堂，少发泛泛介绍',
      next_7_day_plan: Array.from({ length: 7 }, (_, index) => ({
        day: index + 1,
        topic: [
          '零基础孩子第一节课练什么',
          '家长旁听时先看这三个细节',
          '孩子怕球时教练会怎么带',
          '运球训练也在提升哪些体能',
          '周末体验课怎样选择合适班型',
          '教练如何保护第一次上课的孩子',
          '体验课结束后家长该观察什么',
        ][index],
        angle: '围绕真实家长顾虑给出具体判断',
        platform: '小红书',
        action: '保存后对照体验课安排',
        target_metric: '观察家长咨询与预约',
      })),
    }) } }],
    usage: { prompt_tokens: 120, completion_tokens: 520, total_tokens: 640 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const turboAdvicePlan = claimGuardData.plans[0];
const turboAdviceResponse = await claimGuardHandler(internalRequest('POST', 'customer-growth-advice', {
  request_id: 'doubao-seed-2-1-turbo-advice-smoke',
  client_id: 'doubao-seed-2-1-turbo-advice-smoke',
  client_mode: 'internal_test',
  source: 'internal_test',
  assessment: claimGuardData.assessment,
  diagnosis: claimGuardData.diagnosis,
  plans: claimGuardData.plans,
  records: [],
  record: {
    content_plan_id: turboAdvicePlan.id,
    plan_topic: turboAdvicePlan.topic,
    publish_link: 'https://example.com/turbo-advice-smoke',
    views: 1280,
    engagement: 76,
    consultations: 6,
    notes: '家长集中问零基础、安全和周末体验课安排。',
  },
  selected_plan_id: turboAdvicePlan.id,
}));
assert(turboAdviceResponse.status === 200, `2.1 Turbo next-round advice should return 200, got ${turboAdviceResponse.status}`);
const turboAdviceData = await turboAdviceResponse.json();
assert(turboAdviceData.generation_meta?.provider === 'volcengine_ark' && turboAdviceData.generation_meta?.fallback === false, '2.1 Turbo next-round advice should preserve real Ark model evidence internally');
assert(turboAdviceData.next_7_day_plan?.length === 7, '2.1 Turbo next-round advice should preserve all seven structured rows');
assert(nextRoundRequestBody?.max_tokens === 1000, `next-round generation should request 1000 tokens, got ${nextRoundRequestBody?.max_tokens}`);
assert(nextRoundRequestBody?.response_format?.type === 'json_object', 'next-round generation should request a JSON object response');
assert(nextRoundRequestBody?.thinking?.type === 'disabled', 'next-round generation should disable extended thinking for predictable customer latency');

const noisyCtas = [
  '点击咨询咨询详细方案',
  '咨询问你的具体情况',
  '咨询获取服务详情',
  '如果孩子还不确定',
  '第一次体验后',
  '点击私信预约到店体验',
  '有问题可以评论区问我',
];
const qualityCases = [
  {
    id: 'tax',
    industry: '财税代理与代理记账服务',
    main_goal: '获得中小企业老板的代账和税务咨询',
    target_customer: '刚成立公司或准备更换代账服务的企业负责人',
    offer: '代理记账、纳税申报和工商财税咨询',
    customer_pain: '担心漏报、资料交接混乱和收费不透明',
    content_assets: '申报节点清单、票据整理示例和服务流程说明',
    topics: ['一文讲清真相：代理记账怎么选', '干货整理：报税前要准备什么', '公司刚成立先办哪3项财税', '票据总对不上问题在哪', '代账报价差很多看哪几点', '老板最容易漏掉的申报节点', '财税资料怎么交接更省心'],
    expected: /财税|代理记账|报税|票据|申报/,
  },
  {
    id: 'nail',
    industry: '本地美容美甲门店',
    main_goal: '获得附近客户的小红书咨询和到店预约',
    target_customer: '附近3公里想做通勤款和节日款的女性',
    offer: '显白美甲、短甲通勤款和节日款到店服务',
    customer_pain: '担心款式显手黑、客照与到店效果不一致',
    content_assets: '真实客照、手型肤色对比和款式细节图',
    topics: ['一文讲清真相：显白美甲怎么选', '干货整理：短甲适合哪几款', '通勤女生做美甲先看这3点', '美甲客照怎么看出细节', '节日前换款要提前多久', '怕翻车先看手型和肤色', '到店前怎么选参考款'],
    expected: /美甲|短甲|手型|肤色|款式/,
  },
  {
    id: 'massage',
    industry: '本地中医推拿与肩颈调理门店',
    main_goal: '获得附近上班族咨询和到店体验',
    target_customer: '附近久坐、肩颈紧张的通勤上班族',
    offer: '肩颈推拿和久坐人群到店调理体验',
    customer_pain: '担心手法不适合、不知道第一次体验怎么判断',
    content_assets: '门店环境、服务流程和常见问题说明',
    topics: ['一文讲清真相：肩颈推拿怎么选', '干货整理：久坐酸痛先看哪3点', '第一次推拿要说清哪些感受', '上班族肩颈紧先别硬扛', '推拿前后要注意什么', '哪些情况要先问清是否适合', '到店体验怎么判断手法'],
    expected: /推拿|肩颈|久坐|到店|手法/,
  },
  {
    id: 'basketball',
    industry: '少儿篮球培训机构',
    main_goal: '获得附近家长咨询和体验课预约',
    target_customer: '附近三公里有6-12岁孩子的家长',
    offer: '篮球启蒙、体能训练和周末体验课',
    customer_pain: '担心孩子零基础跟不上、课堂安全和训练效果',
    content_assets: '课堂实拍、教练讲解和体能训练过程',
    topics: ['一文讲清真相：孩子篮球课怎么选', '干货整理：体验课先看哪3点', '6-12岁零基础怎么开始', '练运球也在练哪些体能', '家长旁听先观察这4点', '孩子怕跟不上怎么办', '周末体验课怎么选班型'],
    expected: /篮球|体验课|孩子|家长|体能/,
  },
  {
    id: 'marketing-growth',
    industry: '线上营销咨询与企业内容增长工具',
    main_goal: '获得有内容营销需求的企业主咨询和产品试用',
    target_customer: '选题不稳定、发布后不会分析数据的企业主和门店负责人',
    offer: '获客罗盘内容增长诊断、内容计划与发布效果优化工具',
    customer_pain: '担心AI内容模板化，不知道发布后如何根据真实数据持续优化',
    content_assets: '产品页面截图、功能演示和真实发布数据',
    topics: ['做内容总卡壳？这思路太顺了', '线上做内容不用蹲在电脑前', '内容发了没效果怎么办', '企业账号别急着追热点', '一条内容怎么进入下一轮', '有浏览没咨询问题在哪', '真实数据怎么调整选题'],
    expected: /AI|内容|企业|获客|数据/,
  },
];

for (const qualityCase of qualityCases) {
  globalThis.fetch = async () => new Response(JSON.stringify({
    model: 'doubao-timeout-plan',
    choices: [{ message: { content: JSON.stringify({
      plans: qualityCase.topics.map((topic, index) => ({
        topic,
        angle: `围绕真实客户顾虑给出第${index + 1}个具体判断`,
        content_type: '图文',
        cta: noisyCtas[index],
      })),
    }) } }],
    usage: { prompt_tokens: 20, completion_tokens: 40, total_tokens: 60 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  const response = await claimGuardHandler(internalRequest('POST', 'assessments', {
    ...payload,
    client_id: `content-quality-${qualityCase.id}`,
    company_name: `内容质量验证-${qualityCase.id}`,
    industry: qualityCase.industry,
    main_goal: qualityCase.main_goal,
    target_customer: qualityCase.target_customer,
    offer: qualityCase.offer,
    customer_pain: qualityCase.customer_pain,
    content_assets: qualityCase.content_assets,
    current_channels: '小红书',
    biggest_problem: '有浏览没咨询',
  }));
  assert(response.status === 201, `${qualityCase.id} content-quality assessment should return 201, got ${response.status}`);
  const result = await response.json();
  assert(result.generation_meta?.provider === 'volcengine_ark' && result.generation_meta?.fallback === false, `${qualityCase.id} quality cleanup should preserve real model evidence`);
  assert(result.plans.every((plan) => plan.platform === '小红书'), `${qualityCase.id} selected XHS platform should not be replaced`);
  assert(result.plans.every((plan) => Array.from(plan.topic).length <= 20), `${qualityCase.id} XHS titles should pass the 20-character server gate`);
  assertPlanCtaQuality(`${qualityCase.id} content quality`, result);
  const topicText = result.plans.map((plan) => plan.topic).join('｜');
  assert(!/一文讲清|干货整理|全面解析|深度解析|知识科普/.test(topicText), `${qualityCase.id} XHS titles should remove textbook phrasing: ${topicText}`);
  assert(/先看清|别急着选|避坑先看|别急着决定|先判断/.test(topicText) || qualityCase.id === 'marketing-growth', `${qualityCase.id} XHS titles should use a clear conversational hook when textbook phrasing is cleaned: ${topicText}`);
  assert(qualityCase.expected.test(topicText), `${qualityCase.id} titles should stay specific to the customer business: ${topicText}`);
  assert(!/这思路|这方法|这样做|太顺了|真香|绝了|谁懂啊|不用蹲在电脑前|全自动|自动发布|自动运营/.test(topicText), `${qualityCase.id} titles should pass semantic clarity and capability gates: ${topicText}`);
}

globalThis.fetch = async () => new Response(JSON.stringify({
  model: 'doubao-timeout-plan',
  choices: [{ message: { content: JSON.stringify({
    plans: Array.from({ length: 7 }, (_, index) => ({
      topic: `一文讲清真相：视频号财税问题${index + 1}`,
      angle: `稳健口播解释企业财税问题${index + 1}`,
      content_type: '口播',
      cta: noisyCtas[index],
    })),
  }) } }],
  usage: { prompt_tokens: 20, completion_tokens: 40, total_tokens: 60 },
}), { status: 200, headers: { 'content-type': 'application/json' } });
const videoToneResponse = await claimGuardHandler(internalRequest('POST', 'assessments', {
  ...payload,
  client_id: 'content-quality-video-account',
  company_name: '视频号语感隔离验证',
  industry: '财税代理与代理记账服务',
  main_goal: '通过视频号建立企业客户信任',
  target_customer: '需要财税服务的中小企业负责人',
  offer: '代理记账与税务咨询',
  customer_pain: '担心申报遗漏和服务流程不透明',
  content_assets: '财税流程说明与常见问题',
  current_channels: '视频号',
  biggest_problem: '不知道发什么',
}));
const videoToneData = await videoToneResponse.json();
assert(videoToneResponse.status === 201 && videoToneData.plans.every((plan) => plan.platform === '视频号'), 'video-account quality case should preserve the selected platform');
assert(videoToneData.plans.some((plan) => plan.topic.includes('一文讲清真相')), 'non-XHS title cleanup should not rewrite textbook phrasing with XHS hooks');
assert(!/谁懂啊|后悔没早知道|别急着决定/.test(videoToneData.plans.map((plan) => plan.topic).join('|')), 'XHS emotional hooks must not spill into Video Account titles');
assertPlanCtaQuality('video-account content quality', videoToneData);

let repairFetchCount = 0;
let repairRequestBody = '';
globalThis.fetch = async (_url, options = {}) => {
  repairFetchCount += 1;
  const content = repairFetchCount === 1
    ? '{"plans":[{"topic":"已保留的真实选题","angle":"结合真实客户顾虑","content_type":"图文","cta":"咨询到店预约"},{"topic":"被截断的内容"'
    : JSON.stringify({
      plans: Array.from({ length: 7 }, (_, index) => ({
        topic: `结构修复选题${index + 1}`,
        angle: `结合真实客户顾虑说明${index + 1}`,
        content_type: '图文',
        cta: '咨询到店预约安排',
      })),
    });
  if (repairFetchCount === 2) repairRequestBody = String(options.body || '');
  return new Response(JSON.stringify({
    model: 'doubao-timeout-plan',
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const repairResponse = await claimGuardHandler(internalRequest('POST', 'assessments', {
  ...payload,
  client_id: 'structured-repair-smoke',
  company_name: '结构修复验证客户',
  industry: '本地美容美甲门店',
  main_goal: '获得附近客户咨询和到店预约',
  target_customer: '附近三公里通勤女性',
}));
const repairData = await repairResponse.json();
assert(repairResponse.status === 201 && repairData.plans?.length === 7, 'one Ark repair attempt should recover seven plans after a truncated JSON response');
assert(repairData.generation_meta?.provider === 'volcengine_ark' && repairData.generation_meta?.fallback === false, 'successful Ark repair must not be marked as a local fallback');
assert(repairData.generation_meta?.provider_attempt_count === 2 && repairData.generation_meta?.repair_attempted === true && repairData.generation_meta?.repair_succeeded === true, 'Ark repair metadata should expose two provider attempts and a successful repair');
assert(repairData.generation_meta?.repair_recovered_count === 1 && repairData.plans[0]?.topic === '已保留的真实选题', 'repair should preserve complete Ark rows from the first response');
assert(repairRequestBody.includes('只补充正好 6 条'), 'repair prompt should request only the missing rows instead of regenerating the whole batch');
let transientFetchCount = 0;
globalThis.fetch = async () => {
  transientFetchCount += 1;
  if (transientFetchCount === 1) throw new Error('simulated transient network failure');
  return new Response(JSON.stringify({
    model: 'doubao-timeout-plan',
    choices: [{ message: { content: JSON.stringify({
      plans: Array.from({ length: 7 }, (_, index) => ({
        topic: `网络重试选题${index + 1}`,
        angle: `结合真实客户顾虑说明${index + 1}`,
        content_type: '图文',
        cta: '咨询到店预约安排',
      })),
    }) } }],
    usage: { prompt_tokens: 12, completion_tokens: 22, total_tokens: 34 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const transientRetryResponse = await claimGuardHandler(internalRequest('POST', 'assessments', {
  ...payload,
  client_id: 'transient-retry-smoke',
  company_name: '瞬时网络重试验证客户',
}));
const transientRetryData = await transientRetryResponse.json();
assert(transientRetryResponse.status === 201 && transientRetryData.plans?.length === 7, 'one transient Ark network retry should recover seven plans');
assert(transientRetryData.generation_meta?.provider === 'volcengine_ark' && transientRetryData.generation_meta?.fallback === false, 'successful transient retry must remain a real Ark result');
assert(transientRetryData.generation_meta?.provider_attempt_count === 2 && transientRetryData.generation_meta?.repair_succeeded === true, 'transient retry should record both paid provider attempts');
process.env.CUSTOMER_PUBLIC_PLAN_TIMEOUT_MS = '600';
globalThis.fetch = async (_url, options = {}) => new Promise((_resolve, reject) => {
  const abort = () => {
    const error = new Error('simulated long provider call');
    error.name = 'AbortError';
    reject(error);
  };
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });
});
const { default: slowPlanJobHandler } = await import(`../netlify/functions/api.mjs?slow-plan-job-smoke=${Date.now()}`);
let slowPlanJobPromise = null;
const slowPlanJobStartedAt = Date.now();
const slowPlanJobCreateResponse = await slowPlanJobHandler(request('POST', 'plan-jobs', {
  ...payload,
  client_id: 'slow-plan-job-owner',
  customer_key: 'slow-plan-job-owner',
}), {
  waitUntil(promise) { slowPlanJobPromise = promise; },
});
const slowPlanJobSubmitLatencyMs = Date.now() - slowPlanJobStartedAt;
assert(slowPlanJobCreateResponse.status === 202, `slow provider plan job should return 202, got ${slowPlanJobCreateResponse.status}`);
assert(slowPlanJobSubmitLatencyMs < 500, `slow provider should not block plan-job submit, took ${slowPlanJobSubmitLatencyMs}ms`);
const slowPlanJobCreated = await slowPlanJobCreateResponse.json();
assert(slowPlanJobPromise, 'slow provider plan job should continue through waitUntil');
const slowPlanJobFallbackQueryResponse = await slowPlanJobHandler(request('GET', `plan-jobs/${encodeURIComponent(slowPlanJobCreated.job_id)}?client_id=slow-plan-job-owner&fallback=1`));
const slowPlanJobFallbackQuery = await slowPlanJobFallbackQueryResponse.json();
assert(slowPlanJobFallbackQueryResponse.status === 200 && slowPlanJobFallbackQuery.status !== 'completed', 'legacy fallback=1 polling must not overwrite a still-running plan job with a template result');
await slowPlanJobPromise;
const slowPlanJobPollResponse = await slowPlanJobHandler(request('GET', `plan-jobs/${encodeURIComponent(slowPlanJobCreated.job_id)}?client_id=slow-plan-job-owner`));
assert(slowPlanJobPollResponse.status === 200, `slow provider plan job poll should return 200, got ${slowPlanJobPollResponse.status}`);
const slowPlanJob = await slowPlanJobPollResponse.json();
assert(slowPlanJob.status === 'completed' && slowPlanJob.result?.plans?.length === 7, 'slow provider should complete asynchronously with seven fallback plans instead of 504');
globalThis.fetch = originalFetch;
delete process.env.ARK_API_KEY;
delete process.env.ARK_MODEL;
delete process.env.ARK_PLAN_MODEL;
delete process.env.CUSTOMER_PUBLIC_PLAN_TIMEOUT_MS;
delete process.env.SAFE_TO_RUN;

console.log(JSON.stringify({
  strategy_score: diagnosis.strategy_score,
  app_version: diagnosis.app_version,
  unsafe_comment_cta_count: JSON.stringify({ diagnosis, plans, beauty, education, restaurant, oral }).match(/评论区告诉我|留言关键词|留言“复盘”|评论\/咨询“方案”|可以留言你的情况/g)?.length || 0,
  loop_score: diagnosis.loop_score,
  account_setup: diagnosis.account_setup,
  own_platforms: diagnosis.platform_recommendations.primary.map((x) => x.platform),
  client_platforms: diagnosis.platform_recommendations.client_platforms.map((x) => x.platform),
  oral_platforms: oral.plans.slice(0, 3).map((p) => p.platform),
  feedback_dashboard: feedbackData.dashboard,
  first_date: plans[0].planned_date,
  first_topics: plans.slice(0, 3).map((p) => p.topic),
  quality_labels: plans.map((p) => p.publish_quality),
  simulated_plan_timeout: {
    status: timeoutResponse.status,
    fallback: timeoutData.generation_meta.fallback,
    fallback_reason: timeoutData.generation_meta.fallback_reason,
    plan_count: timeoutData.plans.length,
  },
  unsupported_claim_guard: {
    status: claimGuardResponse.status,
    provider: claimGuardData.generation_meta.provider,
    fallback: claimGuardData.generation_meta.fallback,
    safety_adjustment_count: claimGuardData.generation_meta.safety_adjustment_count,
  },
  async_plan_job: {
    submit_status: planJobCreateResponse.status,
    submit_latency_ms: planJobSubmitLatencyMs,
    completed_status: ownPlanJob.status,
    repeated_plan_differs: JSON.stringify(firstPlanTopics) !== JSON.stringify(repeatedPlanTopics),
    cross_client_status: crossClientPlanJobResponse.status,
    no_client_status: noClientPlanJobResponse.status,
    list_status: planJobListResponse.status,
    slow_submit_status: slowPlanJobCreateResponse.status,
    slow_submit_latency_ms: slowPlanJobSubmitLatencyMs,
    slow_completed_status: slowPlanJob.status,
  },
  commercial_billing_p1: {
    create_status: billingCreate.status,
    idempotent_retry: duplicateBillingCreateData.duplicate,
    cross_account_status: crossAccountBillingRead.status,
    internal_list_status: internalBillingOrders.status,
    confirmed_status: billingConfirmationData.order.status,
    duplicate_confirmation: duplicateBillingConfirmationData.duplicate,
    entitlement_plan: paidBillingEntitlementData.entitlement.plan_code,
    canceled_status: cancelBillingOrderData.order.status,
    billing_mode: health.commercialization.billing_mode,
  },
  feishu_bitable_pull: {
    first_pull: firstFeishuPullBody.summary,
    repeated_pull: secondFeishuPullBody.summary,
    scheduled_trigger: scheduledFeishuBody.trigger,
    token_requests: bitableAuthCalls,
    wiki_token_resolutions: bitableWikiResolveCalls,
    wiki_token_source: wikiFeishuPullBody.token_source,
    record_requests: bitableRecordCalls,
  },
  feishu_bitable_push: {
    first_push: firstFeishuPushBody.summary,
    repeated_push: secondFeishuPushBody.summary,
    remote_record_count: remoteFeishuPlanRecords.length,
    create_calls: feishuPlanCreateCalls,
    update_calls: feishuPlanUpdateCalls,
    permission_denied_status: deniedFeishuPush.status,
    status_plan_record_count: feishuStatusBody.plan_record_count,
  },
  delivery_collaboration_p0: {
    profiles: deliveryProfilesPayload.profiles.map((item) => item.id),
    professional_project_id: professionalDeliveryProject.delivery_project_id,
    professional_cycle_status: activeProfessionalCycle.status,
    professional_task_status: clientAnnotatedTask.status,
    technical_approval_status: passedProfessionalApproval.status,
    shooting_status: confirmedProfessionalShooting.status,
    weekly_report_status: professionalReport.status,
    feishu_sync_mode: professionalFeishuBinding.sync_mode,
    local_profile: localDeliveryProject.delivery_profile,
    cross_client_task_count: crossClientTaskList.tasks.length,
    existing_project_store_unchanged: JSON.stringify(professionalStateAfter.project_store) === JSON.stringify(professionalStateBefore.project_store),
  },
  generation_workbench: {
    asset_sha256: assetData.asset.sha256,
    video_task_id: videoTask.task_id,
    video_provider_job_id: submittedVideo.task.provider_job_id,
    video_requested_model: submittedVideo.task.requested_model,
    video_actual_model: submittedVideo.task.actual_model,
    video_provider: submittedVideo.task.provider,
    video_fallback: submittedVideo.task.fallback,
    video_qa_status: qaPassed.task.qa.qa_status,
    video_client_visible: Boolean(visibleVideoTask),
    cover_task_id: coverTask.task.task_id,
    cover_requested_model: coverTask.task.requested_model,
    cover_actual_model: submittedCover.task.actual_model,
    cover_provider: submittedCover.task.provider,
    cover_qa_status: coverPassed.task.qa.qa_status,
    image_task_id: imageTask.task.task_id,
    image_content_type: imageTask.task.content_type,
    image_provider: submittedImage.task.provider,
    image_fallback: submittedImage.task.fallback,
    background_cover_status: generatedBackgroundCover.status,
    background_cover_actual_model: generatedBackgroundCover.actual_model,
    background_cover_provider_calls: openAiImageCalls,
    copy_task_id: copyTask.task.task_id,
    copy_content_type: copyTask.task.content_type,
    copy_provider: submittedCopy.task.provider,
    kimi_task_id: kimiTask.task_id,
    kimi_submit_status: submittedKimi.status,
    kimi_final_status: polledKimi.task.status,
    kimi_actual_model: polledKimi.task.actual_model,
    kimi_fallback: polledKimi.task.fallback,
    kimi_model_calls: kimiGenerationCalls,
    kimi_output_asset_id: kimiOutputAsset.asset_id,
    kimi_output_text: kimiOutputAsset.notes,
    feishu_inbound_mode: 'authenticated_client_scoped',
    feishu_outbound_mode: feishuManual.mode,
  },
}, null, 2));
