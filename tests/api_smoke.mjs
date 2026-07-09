import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

['ARK_API_KEY', 'VOLCENGINE_ARK_API_KEY', 'ARK_MODEL', 'DOUBAO_MODEL', 'VOLCENGINE_ARK_MODEL', 'CUSTOMER_PUBLIC_MODEL', 'SAFE_TO_RUN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GLM_API_KEY'].forEach((key) => {
  delete process.env[key];
});
const { default: handler, shanghaiDateIso } = await import('../netlify/functions/api.mjs');

const request = (method, path, body) => new Request(`http://localhost/.netlify/functions/api/${path}`, {
  method,
  headers: { 'content-type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
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

const submitAssessment = async (body) => {
  const res = await handler(request('POST', 'assessments', body));
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
assert(diagnosis.app_version === '1.6.79', `expected app_version 1.6.79, got ${diagnosis.app_version}`);
assert(assessment.benchmark.platform === '小红书', 'assessment should preserve benchmark platform');
assert(diagnosis.benchmark_reference.recent_topics.length >= 2, 'diagnosis should include benchmark reference topics');
assert(JSON.stringify(diagnosis.benchmark_reference).includes('不照抄'), 'benchmark reference should warn against copying');
assert(diagnosis.loop_score < 30, `loop_score must stay low before feedback, got ${diagnosis.loop_score}`);
assert(diagnosis.account_setup.account_name === '内容决策局', 'meta-marketing test account should get 内容决策局 cold-start setup');
assert(diagnosis.account_setup.starting_platform.platform === '小红书', 'cold-start setup should expose starting platform');
assert(diagnosis.account_setup.naming_warning.includes('保持专业和尊重'), 'cold-start setup should include naming warning');
assert(diagnosis.platform_recommendations.primary[0].platform === '小红书', 'new account should prioritize 小红书');
assert(!diagnosis.platform_recommendations.primary.some((x) => x.platform.includes('美团')), '美团/大众点评 must not be own-account primary platform');
assert(diagnosis.platform_recommendations.client_platforms.some((x) => x.platform.includes('美团')), '美团 can appear only as target-client platform');
assert(plans.length === 7, `expected 7 plans, got ${plans.length}`);
assert(diagnosis.strategy_mvp && diagnosis.strategy_mvp.seven_day_flywheel.length === 7, 'diagnosis should expose platform strategy MVP and 7-day flywheel');
assert(plans.every((plan) => plan.experiment_type && plan.why_platform_fit && Array.isArray(plan.observe_metrics) && plan.observe_metrics.length >= 3 && plan.next_adjustment && plan.content_hypothesis), 'plans should include experiment type, platform fit, metrics, next adjustment and hypothesis');
assert(diagnosis.merchant_profile && diagnosis.merchant_profile.bottleneck && diagnosis.merchant_profile.conversion_action, 'diagnosis should expose merchant_profile for differentiated customer advice');
assert(plans.every((plan) => plan.customer_reasoning?.pain_basis && plan.customer_reasoning?.platform_basis && plan.customer_reasoning?.conversion_basis && plan.customer_reasoning?.validation_goal && plan.customer_reasoning?.publish_note), 'plans should include concrete customer_reasoning fields for why-this-plan explanations');
assert(plans.every((plan) => plan.publish_audit?.risk_level && Array.isArray(plan.publish_audit.checks) && plan.publish_audit.checks.length >= 1), 'plans should include publish_audit checks for platform-rule review');
assert(plans.some((plan) => plan.platform === '小红书' && plan.publish_audit.checks.some((check) => String(check.label || '').includes('小红书'))), 'XHS plans should include a 小红书 publish pre-check');
assert(data.model_info && data.generation_meta, 'POST /assessments should return model_info and generation_meta');
assert(data.generation_meta.provider === 'local' && data.generation_meta.actual_model === 'rule_template' && data.generation_meta.fallback === true && data.generation_meta.fallback_reason === 'missing_ark_api_key', 'missing Ark env should produce explicit local rule_template fallback evidence');

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
const dentalPlansGet = await handler(request('GET', 'plans?client_id=dental'));
assert(dentalPlansGet.status === 200, 'GET /plans?client_id=dental should succeed');
const dentalPlans = await dentalPlansGet.json();
assert(dentalPlans.length >= 7 && dentalPlans.every((plan) => plan.client_id === 'dental'), 'GET /plans should filter to dental client_id');
const basketballAssessmentsGet = await handler(request('GET', 'assessments?client_id=basketball'));
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
assert(customersPublicGet.status === 403, `GET /customers without internal gate should be rejected, got ${customersPublicGet.status}`);
const mergePreviewPublicGet = await handler(request('GET', 'customers/merge-preview?display_name=' + encodeURIComponent('子武限武术搏击俱乐部')));
assert(mergePreviewPublicGet.status === 403, `GET /customers/merge-preview without internal gate should be rejected, got ${mergePreviewPublicGet.status}`);
const customersInternalGet = await handler(request('GET', 'customers?mode=internal'));
assert(customersInternalGet.status === 200, `GET /customers?mode=internal should succeed, got ${customersInternalGet.status}`);
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
const ziwuxianPreviewGet = await handler(request('GET', 'customers/merge-preview?mode=internal&display_name=' + encodeURIComponent('子武限武术搏击俱乐部')));
assert(ziwuxianPreviewGet.status === 200, `GET /customers/merge-preview should succeed, got ${ziwuxianPreviewGet.status}`);
const ziwuxianPreview = await ziwuxianPreviewGet.json();
assert(ziwuxianPreview.dry_run === true && ziwuxianPreview.readonly === true && ziwuxianPreview.would_write === false, 'merge preview must be dry-run and readonly');
assert(ziwuxianPreview.source_client_ids.length === 3 && ziwuxianPreview.backup_plan.required === true, 'merge preview should include source keys and backup plan');
const customersAfterPreview = await (await handler(request('GET', 'customers?mode=internal'))).json();
const ziwuxianAfterPreview = customersAfterPreview.customers.find((item) => item.display_name === '子武限武术搏击俱乐部');
assert(ziwuxianAfterPreview?.records.length === 3, 'merge preview must not mutate or merge customer blob records');
const floristStateGet = await handler(request('GET', 'state?client_id=florist'));
const floristState = await floristStateGet.json();
assert(!floristState.project_store.projects.some((item) => item.id === 'project-dental'), 'GET /state?client_id=florist must not return dental project store');
const internalStateGet = await handler(request('GET', 'state?client_id=internal&mode=internal'));
assert(internalStateGet.status === 200, 'GET /state?client_id=internal&mode=internal should succeed');
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
const dentalFeedbackBody = await dentalFeedbackPost.json();
assert(dentalFeedbackBody.feedback.client_id === 'dental', 'POST /feedback should echo client_id');
const floristFeedbackGet = await handler(request('GET', 'feedback?client_id=florist'));
const floristFeedback = await floristFeedbackGet.json();
assert(!floristFeedback.some((item) => item.publish_link === 'https://example.com/dental-post'), 'GET /feedback?client_id=florist must not return dental feedback');
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
const aboutHtml = readFileSync(new URL('../static/about/index.html', import.meta.url), 'utf8');
const privacyHtml = readFileSync(new URL('../static/privacy/index.html', import.meta.url), 'utf8');
const termsHtml = readFileSync(new URL('../static/terms/index.html', import.meta.url), 'utf8');
const contactHtml = readFileSync(new URL('../static/contact/index.html', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../netlify/functions/api.mjs', import.meta.url), 'utf8');
const warRoomCss = readFileSync(new URL('../static/war-room-v1.6.1.css', import.meta.url), 'utf8');
const apiSourceIncludes = (needle) => apiSource.includes(needle);
const redirects = readFileSync(new URL('../static/_redirects', import.meta.url), 'utf8');
const localDevServer = readFileSync(new URL('../scripts/local-dev-server.mjs', import.meta.url), 'utf8');
assert(appJs.includes("const APP_VERSION = '1.6.79'"), 'app should expose v1.6.79 internally/API-side');
assert(appJs.includes("const INTERNAL_CLIENT_ID = 'internal'") && appJs.includes("mode=internal") && appJs.includes('function customerClientId') && appJs.includes('isInternalDataScope() ? INTERNAL_CLIENT_ID'), 'internal page should use stable internal client_id and request internal cloud seed state from the route data scope');
assert(appJs.includes('const VIEW_PROFILES = {') && appJs.includes('internal_admin') && appJs.includes('client_viewer') && appJs.includes('selfserve_client') && appJs.includes('outsourced_worker') && appJs.includes('const getProfile ='), 'app should define role-based VIEW_PROFILES for one-system rendering');
assert(appJs.includes("delivery: 'qa_passed_only'") && appJs.includes('profileDeliveryView') && appJs.includes('&view=${profileDeliveryView(profile)}'), 'profile delivery settings should map customer views to server-side filtered data requests');
assert(appJs.includes('function sharedJourneySteps') && appJs.includes('function renderSharedJourneyShell') && appJs.includes('document.body.dataset.viewRole = profile.role'), 'customer/internal journey shell should have a shared profile-aware entry point');
assert(appJs.includes('const isInternalDataScope = () => isInternalMode();') && appJs.includes('projectsStorageKey') && appJs.includes('appStateStorageKey'), 'internal storage keys should be based on the stable route data scope, not a stale rendered profile');
assert(appJs.includes("return '检测合规服务';"), 'app should collapse legacy/real compliance project aliases into one dropdown item');
assert(!appJs.includes('function isAnbiaoCustomerProject()') && !appJs.includes('renderAnbiaoCustomerData') && !appJs.includes('ANBIAO_CUSTOMER_ROWS'), 'anbiao publish-link refill module should be removed from internal app');
assert(!appJs.includes('安标检测 / 发布链接回填') && !appJs.includes('查看回填链接表'), 'anbiao publish-link refill UI should not be rendered');
assert(appJs.includes('function initCustomerTrial()') && appJs.includes('CUSTOMER_STORAGE_KEY'), 'default app should initialize the customer trial flow');
assert(appJs.includes("location.replace('/internal/');") && !appJs.includes("params.get('mode') === 'internal'"), 'public ?mode=internal entries must not open the internal workbench');
assert(appJs.includes("return path === '/internal' || path.startsWith('/internal/');") && appJs.includes("currentPath() === '/internal/generation-workbench'"), 'internal rendering should be path-gated to /internal/ and the generation workbench route');
assert(appJs.includes('function syncRouteState') && appJs.includes('function initInternalRouteNavigation') && appJs.includes('history.pushState') && appJs.includes("window.addEventListener('popstate', syncRouteState)") && appJs.includes('generationWorkbenchInitialized'), 'internal navigation should re-apply shell/workbench visibility and initialize the workbench after route changes');
assert(indexHtml.includes('id="internalHeroTitle"') && indexHtml.includes('客户运营工作区') && indexHtml.includes('素材生产工作台'), 'internal hero should label operations and production workspaces separately');
assert(appJs.includes('function renderInternalWorkspaceShell') && appJs.includes('document.body.dataset.internalWorkspace') && appJs.includes('internal-production-mode') && appJs.includes('if (planLink) planLink.hidden = active'), 'internal shell should switch copy/actions between operations and production routes');
assert(warRoomCss.includes('body.internal-mode:not(.generation-workbench-mode) #generationWorkbench') && warRoomCss.includes('body.internal-mode.generation-workbench-mode #diagnosisWorkflow') && warRoomCss.includes('body.internal-mode.generation-workbench-mode #allCustomersPanel'), 'internal CSS should prevent production workbench and operations modules from rendering together');
assert(appJs.includes('function activateCustomerNextRound') && appJs.includes('data-customer-activate-round') && appJs.includes('previous_rounds') && appJs.includes('content_rounds'), 'customer client should support activating the next 7-day round and carrying prior round topics forward');
assert(indexHtml.includes('id="customerRoundHistory"') && appJs.includes('function renderCustomerRoundHistory') && appJs.includes('customerArchivedPlanTopics') && appJs.includes('renderCustomerRoundHistory(nextState)'), 'customer client should expose content-round history and refresh it after round changes');
assert(appJs.includes('function syncCustomerTrialCloudState') && appJs.includes('customer_public_cloud_sync') && appJs.includes('scheduleCustomerTrialCloudSync(generatedState)') && appJs.includes('scheduleCustomerTrialCloudSync(nextState)'), 'customer public flow should sync generated plans, feedback records and round changes to cloud project store');
assert(indexHtml.includes('id="customerCoCreationSection"') && appJs.includes('function renderCustomerCoCreation') && appJs.includes('function collectCustomerCoCreation') && appJs.includes('co_creation: coCreation'), 'customer public flow should include a co-creation confirmation layer before generating the 7-day plan');
assert(indexHtml.includes('data-customer-observation-tags') && appJs.includes('observation_tags') && apiSource.includes('observation_tags'), 'customer feedback should capture observation tags for next-round advice');
assert(indexHtml.includes('data-customer-step-target="intake"') && indexHtml.includes('data-customer-step-target="confirm"') && indexHtml.includes('data-customer-step-target="plan"') && indexHtml.includes('data-customer-step-target="record"') && indexHtml.includes('data-customer-step-target="next"') && appJs.includes("const CUSTOMER_FLOW_STEPS = ['intake', 'confirm', 'plan', 'record', 'next']") && appJs.includes('function setCustomerStep'), 'customer public flow should render as a five-step guided experience');
assert(appJs.includes("label: '填入基本信息'") && appJs.includes("label: '确认方向'") && appJs.includes("label: '内容计划'") && appJs.includes("label: '记录效果'") && appJs.includes("label: '下一轮优化'"), 'customer public flow should keep five distinct navigation labels with a clear first-step label');
assert(apiSource.includes("path === '/customers'") && apiSource.includes('listCustomersFromCloudState') && apiSource.includes("store.list({ prefix: CLOUD_STATE_KEY") && apiSource.includes('isTestCustomerKey') && apiSource.includes('groupCustomerRecords'), 'API should expose a read-only grouped internal customer aggregation endpoint backed by blob key listing');
assert(apiSource.includes("path === '/customers/merge-preview'") && apiSource.includes('previewCustomerMerge') && apiSource.includes('would_write: false'), 'API should expose a dry-run-only customer merge preview endpoint');
assert(indexHtml.includes('id="allCustomersPanel"') && indexHtml.includes('全部客户') && indexHtml.includes('只读聚合各 client_id') && appJs.includes('function loadAllCustomers') && appJs.includes("api('/api/customers?mode=internal&client_id=internal')") && appJs.includes('primary_client_id') && appJs.includes('data-all-customer-client'), 'internal app should render and load the grouped all-customers panel with specific-record drill-down');
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
assert(appJs.includes("resultSection.hidden = !((nextStep === 'plan' || nextStep === 'record') && hasGenerated)"), 'customer record step should keep generated plan context visible while opening the effect form');
assert(appJs.includes("api('/api/customer-growth-advice'") && appJs.includes('daily_advice') && appJs.includes('next_round') && appJs.includes('本条内容优化建议') && appJs.includes('阶段性下一轮建议'), 'customer next-round advice should call the daily advice endpoint but distinguish one-record advice from staged next-round advice');
assert(apiSourceIncludes('callArkChatCompletion') && apiSourceIncludes('ARK_API_KEY') && apiSourceIncludes('VOLCENGINE_ARK_API_KEY') && apiSourceIncludes('ARK_MODEL') && apiSourceIncludes('DOUBAO_MODEL') && apiSourceIncludes('VOLCENGINE_ARK_MODEL') && apiSourceIncludes('CUSTOMER_PUBLIC_MODEL'), 'public customer generation should support Volcengine Ark/Doubao through backend env vars');
assert(apiSourceIncludes('modelProviderFor') && apiSourceIncludes('model_provider') && apiSourceIncludes('model_mode') && apiSourceIncludes('CUSTOMER_STRATEGY_MODEL') && apiSourceIncludes('OPENAI_API_KEY') && apiSourceIncludes('CUSTOMER_COPY_MODEL') && apiSourceIncludes('ANTHROPIC_API_KEY'), 'internal mode should keep lightweight model routing for Ark/OpenAI/Anthropic/local');
assert(apiSourceIncludes("path === '/customer-growth-advice'") && apiSourceIncludes('每日回填必须绑定具体内容计划'), 'API should expose customer-growth-advice and reject unbound daily refill');
assert(appJs.includes('function buildVersionedProjectState') && appJs.includes('diagnosis_history') && appJs.includes('intake_history'), 'customer/internal submissions should create versioned project states');
assert(appJs.includes('customer_public') && appJs.includes('saveLocal();') && appJs.includes('scheduleCloudSync'), 'customer public submissions should enter the same project store and cloud sync path');
assert(appJs.includes('function regenerateCurrentDiagnosis') && appJs.includes('旧诊断已归档'), 'internal workbench should support rediagnosis with archived old diagnoses');
assert(appJs.includes('已记录这条内容。系统先给出本条优化建议') && appJs.includes('结束本轮，使用第') && appJs.includes('至少记录 ${readiness.minRequired} 条不同内容后') && !appJs.includes('已记录这条内容。系统已生成复盘判断和下一轮内容计划'), 'effect save should not present a full next-round plan after only one feedback record');
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
assert(indexHtml.includes('<title>获客罗盘 · 内容增长循环工具</title>'), 'default title should be customer-facing product title without version text');
assert(indexHtml.includes('/app.js?v=1.6.79') && indexHtml.includes('/war-room-v1.6.1.css?v=1.6.79'), 'customer page should cache-bust current v1.6.79 assets');
assert(indexHtml.includes('customer-brand-mark') && warRoomCss.includes('.customer-brand-mark::after') && indexHtml.includes('获客罗盘'), 'customer page should expose the renamed product with a compass-style brand mark');
assert(indexHtml.includes('class="customer-site-nav"') && indexHtml.includes('使用工具') && !indexHtml.includes('开始填写') && indexHtml.includes('关于我们') && indexHtml.includes('隐私政策') && indexHtml.includes('用户协议') && indexHtml.includes('联系我们'), 'customer page should expose mature website-level trust/navigation entries');
assert(indexHtml.includes('id="customerResumeBanner"') && indexHtml.includes('继续上次项目') && indexHtml.includes('新建空白项目') && appJs.includes('function renderCustomerResumeBanner') && appJs.includes('function startBlankCustomerProject'), 'customer page should distinguish saved local projects from a blank first-customer start');
assert(indexHtml.includes('苏ICP备2026037570号') && !indexHtml.includes('苏ICP备2026037570号-1') && !indexHtml.includes('网信备案：') && indexHtml.includes('https://beian.miit.gov.cn/') && !indexHtml.includes('公安备案'), 'customer footer should show only the corrected ICP filing number and hide unfinished public-security filing');
assert(indexHtml.includes('customer-footer-primary') && indexHtml.includes('customer-footer-meta') && indexHtml.includes('Copyright 2016-2026 南京尚下联信息科技有限公司') && indexHtml.includes('mailto:contact@fpmatrix.cn'), 'customer footer should use a standard company/link/filing information layout');
assert(!indexHtml.includes('id="customerInfoPages"') && !indexHtml.includes('本地存储与云端同步') && !indexHtml.includes('AI 内容说明'), 'homepage should not inline long policy and agreement content');
assert(aboutHtml.includes('南京尚下联信息科技有限公司') && contactHtml.includes('contact@fpmatrix.cn'), 'independent info pages should expose the service entity and complaint email');
assert(privacyHtml.includes('本地存储与云端同步') && privacyHtml.includes('第三方服务与模型调用') && privacyHtml.includes('查阅、复制、更正、补充、删除'), 'privacy policy should cover storage, model calls and data-subject rights');
assert(termsHtml.includes('AI 内容说明') && termsHtml.includes('禁止行为') && termsHtml.includes('内容效果和责任限制') && termsHtml.includes('不承诺固定流量、咨询量、成交量或商业结果') && termsHtml.includes('投诉与争议处理'), 'terms should cover AI content, prohibited behavior, effect disclaimer and complaint handling');
assert(redirects.includes('/about /about/index.html 200') && redirects.includes('/privacy /privacy/index.html 200') && redirects.includes('/terms /terms/index.html 200') && redirects.includes('/contact /contact/index.html 200'), 'customer info pages should rewrite to independent static pages');
assert(indexHtml.includes('获客罗盘') && indexHtml.includes('把内容发布，变成持续获客的经营动作') && indexHtml.includes('customer-first-screen') && indexHtml.includes('customer-first-form-shell') && !indexHtml.includes('给篮球培训客户的全平台内容矩阵'), 'default customer page should use a formal product first screen, not a single-customer static page title');
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
assert(appJs.includes('为什么这样发 ›') && appJs.includes('这条发完了，去记录效果') && appJs.includes('customer-plan-lite'), 'client plan cards should be scan-friendly with collapsed reasoning and one primary action');
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
assert(dailyAdvice.every((item) => item.model_info && item.generation_meta), 'customer-growth-advice should return model evidence');
assert(dailyAdvice.every((item) => item.model_info.provider === 'local' && item.model_info.actual_model === 'rule_template' && item.model_info.fallback === true), 'without Ark env, customer-growth-advice should transparently fall back to rule_template');
assert(dailyAdvice.every((item) => item.model_info.fallback_reason === 'missing_ark_api_key' && item.transparent_note.includes('missing_ark_api_key')), 'fallback model calls must expose missing Ark key reason');

const unboundAdvice = await handler(request('POST', 'customer-growth-advice', {
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
});
const blockedInternal = await handler(request('POST', 'assessments', {...basketballGoods.assessment, offer: '', customer_pain: '', content_assets: '', best_recent_content: '', client_mode: 'internal_test', source: 'internal_test'}));
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
assert(basketball.generation_meta.provider === 'local' && basketball.generation_meta.actual_model === 'rule_template' && basketball.generation_meta.fallback === true && basketball.generation_meta.fallback_reason === 'missing_ark_api_key', 'without Ark env, assessment generation should expose rule_template fallback evidence');
assert(basketball.plans.every((plan) => plan.actual_model === 'rule_template' && plan.provider === 'local' && plan.fallback === true && plan.fallback_reason === 'missing_ark_api_key'), 'without Ark env, plan rows should carry fallback model evidence');
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
const dashboardAfterMissingLink = await (await handler(request('GET', 'dashboard'))).json();
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

const reviewRes = await handler(request('POST', 'reviews', {}));
if (reviewRes.status !== 201) throw new Error(`review expected 201, got ${reviewRes.status}: ${await reviewRes.text()}`);
const reviewData = await reviewRes.json();
assert(reviewData.review.next_actions.includes('加码'), 'review should generate next-round action from feedback');

const healthRes = await handler(request('GET', 'health'));
assert(healthRes.status === 200, 'GET /health should succeed');
const health = await healthRes.json();
assert(health.module === 'generation-workbench', 'health should expose generation workbench module');
assert(health.module_version === 'generation-workbench-v1', 'health should expose generation workbench module_version');
assert(Array.isArray(health.features) && health.features.includes('async_video_polling'), 'health should list generation workbench features');

const qaProjectId = 'qa_generation_project';
const qaClientId = 'internal';
const referenceText = 'mock video reference asset for generation workbench';
const referenceSha = createHash('sha256').update(referenceText).digest('hex');
const assetRes = await handler(request('POST', 'assets', {
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

const videoTaskRes = await handler(request('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_001',
  platform: '小红书',
  content_type: '视频',
  generation_type: 'video',
  requested_model: 'Seedance 2.0',
  prompt: '生成一条项目化素材验收短视频 mock',
  output_spec: { size: '1080x1920', duration: '6s', style: '真实工作台演示', client_visible: true },
  input_asset_ids: [assetData.asset.asset_id],
}));
if (videoTaskRes.status !== 201) throw new Error(`POST /generation-tasks video should create task, got ${videoTaskRes.status}: ${await videoTaskRes.text()}`);
const videoTask = (await videoTaskRes.json()).task;
assert(videoTask.status === 'draft', 'video task should start as draft');
assert(videoTask.requested_model === 'Seedance 2.0', 'video task requested_model should be Seedance 2.0');

const submittedVideo = await (await handler(request('POST', `generation-tasks/${videoTask.task_id}/submit`, { client_id: qaClientId }))).json();
assert(submittedVideo.task.status === 'generating', 'video submit should enter generating, not wait for final output');
assert(submittedVideo.task.provider_job_id, 'video submit should return provider_job_id');
assert(submittedVideo.task.actual_model === 'Seedance 2.0', 'mock video adapter should set actual_model to requested model');
assert(submittedVideo.task.provider === 'seedance-video', 'video adapter provider should be seedance-video');
assert(submittedVideo.task.fallback === true && submittedVideo.task.fallback_reason === 'MOCK_KEY_MISSING', 'missing Ark key should return explicit Seedance mock evidence');
assert(submittedVideo.task.adapter_manifest?.mode === 'mock', 'video submit should persist adapter manifest');

const videoPoll1 = await (await handler(request('POST', `generation-tasks/${videoTask.task_id}/poll`, { client_id: qaClientId }))).json();
assert(videoPoll1.task.status === 'generating', 'first video poll should remain generating');
assert(videoPoll1.task.adapter_state?.backoff_ms > 0, 'video poll should persist retry/backoff state for resume');
const videoPoll2 = await (await handler(request('POST', `generation-tasks/${videoTask.task_id}/poll`, { client_id: qaClientId }))).json();
assert(videoPoll2.task.status === 'qa_pending', 'second video poll should produce output and enter qa_pending');
assert(videoPoll2.task.output_asset_ids.length === 1, 'generated video should create one output asset');
assert(videoPoll2.task.adapter_manifest?.provider === 'seedance-video', 'video poll should keep output manifest');

const qaFailed = await (await handler(request('POST', `generation-tasks/${videoTask.task_id}/qa`, {
  client_id: qaClientId,
  qa_status: 'failed',
  qa_reviewer: 'QA',
  rejection_reason: '画面字幕需要调整',
  qa_notes: '先失败一次验证状态机',
}))).json();
assert(qaFailed.task.status === 'qa_failed', 'QA failed should move task to qa_failed');
assert(qaFailed.task.qa.rejection_reason.includes('字幕'), 'QA failed should record rejection_reason');
const clientTasksAfterFail = await (await handler(request('GET', `generation-tasks?client_id=${qaClientId}&project_id=${qaProjectId}&view=client`))).json();
assert(!clientTasksAfterFail.tasks.some((task) => task.task_id === videoTask.task_id), 'failed QA task must not appear in client delivery view');

const qaPassed = await (await handler(request('POST', `generation-tasks/${videoTask.task_id}/qa`, {
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
const clientTasksAfterPass = await (await handler(request('GET', `generation-tasks?client_id=${qaClientId}&project_id=${qaProjectId}&view=client`))).json();
const visibleVideoTask = clientTasksAfterPass.tasks.find((task) => task.task_id === videoTask.task_id);
assert(visibleVideoTask, 'passed QA task should appear in client delivery view');
const visibleText = JSON.stringify(visibleVideoTask);
['requested_model', 'actual_model', 'provider', 'fallback', 'error', 'provider_job_id', 'debug'].forEach((word) => {
  assert(!visibleText.includes(word), `client delivery task must hide internal field ${word}`);
});

const deliveredVideo = await (await handler(request('POST', `generation-tasks/${videoTask.task_id}/deliver`, { client_id: qaClientId }))).json();
assert(deliveredVideo.task.status === 'delivered', 'client_ready task should be deliverable');
const feishuMock = await (await handler(request('POST', 'feishu/sync', { client_id: qaClientId, task_id: videoTask.task_id }))).json();
assert(feishuMock.synced === false && feishuMock.mode === 'mock', 'feishu sync should be mock in V1');
['A_customer_profile', 'B_content_plan', 'C_outsourced_production', 'D_internal_qa', 'E_client_delivery', 'F_data_return'].forEach((key) => {
  assert(feishuMock.payload[key], `feishu payload should include ${key}`);
});

const coverTask = await (await handler(request('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_002',
  platform: '小红书',
  content_type: '封面',
  generation_type: 'cover',
  requested_model: 'GPT-Image-2',
  prompt: '生成一张项目化素材验收封面图 mock',
  output_spec: { size: '1024x1024', style: '清晰专业', client_visible: true },
}))).json();
assert(coverTask.task.requested_model === 'GPT-Image-2', 'cover task should request GPT-Image-2');
const submittedCover = await (await handler(request('POST', `generation-tasks/${coverTask.task.task_id}/submit`, { client_id: qaClientId }))).json();
assert(submittedCover.task.status === 'qa_pending', 'cover task should synchronously generate and enter qa_pending');
assert(submittedCover.task.actual_model === 'GPT-Image-2' && submittedCover.task.provider === 'openai-image', 'cover task should use openai-image mock adapter');
assert(submittedCover.task.fallback === true && submittedCover.task.fallback_reason === 'MOCK_KEY_MISSING', 'missing OpenAI key should return explicit image mock evidence');
const coverPassed = await (await handler(request('POST', `generation-tasks/${coverTask.task.task_id}/qa`, {
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

const copyTask = await (await handler(request('POST', 'generation-tasks', {
  project_id: qaProjectId,
  client_id: qaClientId,
  client_name: 'QA测试客户',
  content_plan_record_id: 'qa_content_plan_003',
  platform: '小红书',
  content_type: '脚本',
  generation_type: 'copy',
  requested_model: 'Claude + GLM A/B',
  prompt: '生成一段 A/B 文案测试脚本',
  output_spec: { style: 'A/B', client_visible: false },
}))).json();
const submittedCopy = await (await handler(request('POST', `generation-tasks/${copyTask.task.task_id}/submit`, { client_id: qaClientId }))).json();
assert(submittedCopy.task.status === 'qa_pending', 'copy task should synchronously generate and enter qa_pending');
assert(submittedCopy.task.provider === 'claude-text+glm-text', 'copy task should run Claude + GLM A/B adapter');
assert(submittedCopy.task.fallback === true && submittedCopy.task.fallback_reason.includes('MOCK_KEY_MISSING'), 'missing text keys should return explicit A/B mock evidence');
assert(submittedCopy.task.adapter_manifest?.output?.variants?.claude && submittedCopy.task.adapter_manifest?.output?.variants?.glm, 'copy task manifest should include both text adapter variants');

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
    feishu_mock_mode: feishuMock.mode,
  },
}, null, 2));
