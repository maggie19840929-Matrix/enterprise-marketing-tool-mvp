import handler, { shanghaiDateIso } from '../netlify/functions/api.mjs';
import { readFileSync } from 'node:fs';

const request = (method, path, body) => new Request(`http://localhost/.netlify/functions/api/${path}`, {
  method,
  headers: { 'content-type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
});

const payload = {
  company_name: '企业内容增长测试号',
  industry: '企业内容增长 / 企业获客 / AI营销复盘',
  main_goal: '30天内验证一套企业内容获客 + 数据回流 + AI复盘的最小闭环',
  target_customer: '老板、本地生活服务商家、中小企业负责人、不懂内容运营但需要线上获客的人、已经发内容但不知道怎么复盘的人。',
  offer: '账号定位建议、平台发布建议、7天内容计划、发布后数据记录、周复盘结论',
  customer_pain: '不知道该发什么；发了不知道有没有用；只看点赞不看咨询；没有每周复盘；AI生成内容很快但不一定带来客户。',
  current_channels: '小红书、视频号、朋友圈，后续视数据扩展到抖音。',
  posting_frequency: '每周3条',
  biggest_problem: '不知道发什么',
  content_assets: '企业真实服务案例、老板经验、客户常见问题、行业痛点、内容发布后的数据、私信/咨询记录、竞品爆款内容。',
  monthly_budget: '低预算，优先靠老板认知内容、案例内容和AI辅助复盘，不做大额投流。',
  decision_cycle: '7天看内容反馈，14天看栏目方向，30天判断是否形成可复用增长闭环。',
  best_recent_content: '方法论类内容、老板真实误区拆解、AI营销复盘案例、企业账号为什么发了没咨询。',
  benchmark: {
    platform: '小红书',
    accounts: ['https://example.com/content-growth-benchmark'],
    notes: '对标账号多用真实问题、避坑清单、复盘表方法论，收藏和私信反馈较高。',
    sample_content: '代表内容：发了很多内容为什么还是没人咨询？数据摘要：收藏高于点赞，私信集中问复盘表。',
  },
  contact: 'Cookie / 企业营销工具测试',
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertNoUnsafeCommentCta = (label, value) => {
  const text = JSON.stringify(value);
  ['评论区告诉我', '留言关键词', '留言“复盘”', '评论/私信“方案”', '可以留言你的情况'].forEach((word) => {
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

const data = await submitAssessment(payload);
const { assessment, diagnosis, plans } = data;

assert(assessment.company_name === payload.company_name, 'POST /assessments should return the full assessment customer data');
assert(assessment.target_customer === payload.target_customer, 'assessment response should preserve target_customer for customer snapshot UI');
assert(diagnosis.strategy_score >= 80, `strategy_score should reflect clear inputs, got ${diagnosis.strategy_score}`);
assert(diagnosis.app_version === '1.6.36', `expected app_version 1.6.36, got ${diagnosis.app_version}`);
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
assertNoUnsafeCommentCta('content decision diagnosis/plans', { diagnosis, plans });
const appJs = readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');
assert(appJs.includes("const APP_VERSION = '1.6.36'"), 'app should expose v1.6.36 internally/API-side');
assert(appJs.includes("return '安标检测';"), 'app should collapse legacy/real 安标 project aliases into one dropdown item');
assert(!appJs.includes('function isAnbiaoCustomerProject()') && !appJs.includes('renderAnbiaoCustomerData') && !appJs.includes('ANBIAO_CUSTOMER_ROWS'), 'anbiao publish-link refill module should be removed from internal app');
assert(!appJs.includes('安标检测 / 发布链接回填') && !appJs.includes('查看回填链接表'), 'anbiao publish-link refill UI should not be rendered');
assert(appJs.includes('function initCustomerTrial()') && appJs.includes('CUSTOMER_STORAGE_KEY'), 'default app should initialize the customer trial flow');
assert(appJs.includes('function syncCustomerChoicesBeforeSubmit') && appJs.includes("aria-pressed") && !appJs.includes('lastPointerSelect'), 'customer choice chips should use stable click handling and submit-time sync');
assert(appJs.includes('isInternalMode()') && appJs.includes('initInternalApp()'), 'internal workbench should be gated behind internal mode');
assert(appJs.includes('function prefillFeedback(id)'), 'app should expose prefillFeedback for plan feedback buttons');
assert(appJs.includes("[name=content_plan_id]"), 'prefillFeedback should target the content_plan_id field');
assert(appJs.includes('function samePlanId') && appJs.includes('function planIdValue'), 'plan feedback matching should preserve the original plan.id instead of coercing all ids to numbers');
assert(appJs.includes('js-prefill-feedback') && appJs.includes('data-plan-id="${esc(planIdValue(p))}"'), 'all plan feedback buttons should carry the exact plan.id in data-plan-id');
assert(appJs.includes('planInput.value = planId;'), 'prefillFeedback must write the exact plan.id into #feedbackForm [name=content_plan_id]');
assert(appJs.includes('planDisplay.textContent = displayNumber ? `计划 #${displayNumber}`'), 'prefillFeedback must update #selectedPlanDisplay to 计划 #N');
assert(appJs.includes('initPlanFeedbackButtons();'), 'plan feedback buttons should use stable delegated click binding');
assert(appJs.includes("[name=publish_link]") && appJs.includes('linkInput?.focus()'), 'prefillFeedback should focus the publish link field');
assert(appJs.includes('existingFeedback?.publish_link || plan?.publish_link'), 'prefillFeedback should prefill existing publish links');
assert(appJs.includes('scrollIntoView'), 'prefillFeedback should scroll to the feedback form area');
assert(appJs.includes('is-highlighted'), 'prefillFeedback should highlight the feedback area');
assert(appJs.includes('已选择计划 #'), 'prefillFeedback should show a business toast after locating the form');
assert(appJs.includes('function hasRestorableState'), 'app should detect restorable local state before showing the first form again');
assert(appJs.includes('function resetForNewCustomer'), 'war-room should keep a reset/new customer entry');
assert(appJs.includes('customerDisplayName') && !appJs.includes("a.company_name || '未命名客户'"), 'app should not render 未命名客户 as the customer title');

assert(appJs.includes('function renderSmartDiagnosisModule') && appJs.includes('内测智能诊断内核') && appJs.includes("payload.client_mode = 'internal_test'"), 'internal mode should render the smart diagnosis kernel without changing customer entry');
assert(appJs.includes('function buildCustomerNextAdvice') && appJs.includes('customerNextAdvice'), 'customer trial should generate immediate next-step advice after effect record save');
assert(appJs.includes('function buildVersionedProjectState') && appJs.includes('diagnosis_history') && appJs.includes('intake_history'), 'customer/internal submissions should create versioned project states');
assert(appJs.includes('customer_public') && appJs.includes('saveLocal();') && appJs.includes('scheduleCloudSync'), 'customer public submissions should enter the same project store and cloud sync path');
assert(appJs.includes('function regenerateCurrentDiagnosis') && appJs.includes('旧诊断已归档'), 'internal workbench should support rediagnosis with archived old diagnoses');
assert(appJs.includes('已记录这条内容。根据这条数据，下一条建议先发'), 'effect save should tell customer the next content direction immediately');
assert(appJs.includes('盆底肌修复'), 'customer offer extraction should recognize postpartum pelvic-floor repair instead of generic service wording');

assert(appJs.includes('function autoReviewFromFeedback()'), 'app should auto-generate weekly review from existing feedback');
assert(appJs.includes('保存至少 1 条发布链接和反馈后') || appJs.includes('这里会自动生成周复盘'), 'weekly review empty state should explain auto review');
assert(appJs.includes('function planUiMeta'), 'plan cards should classify priority/pending/done states');
assert(appJs.includes('plan-next') && appJs.includes('今日优先'), 'first pending plan should be visually distinguished in-place');
assert(appJs.includes('openClientEvidence') && appJs.includes('客户输入') && appJs.includes('系统判断') && appJs.includes('内容复盘依据'), 'evidence should be reachable with customer-facing labels');
assert(appJs.includes('查看判断依据') && !appJs.includes('为什么？') && !appJs.includes('依据 ${evidenceLink'), 'duplicate evidence labels should be collapsed into one action');
assert(appJs.includes('war-main-row') && appJs.includes('war-decision-main'), 'next decision should stay in the top war-room layout');
assert(appJs.includes('function renderOutcomeCards') && appJs.includes('war-metrics'), 'outcome metrics should live inside the top war-room layout');
assert(appJs.indexOf('下一步判断') < appJs.indexOf('function renderOutcomeCards'), 'next decision should stay before outcome metrics');
assert(!appJs.includes('首条待回填'), 'first-link gate should not duplicate the plan cards');
assert(appJs.includes('plans.slice(0, 3)') && appJs.includes('查看发布角度'), 'plan summary should show only three scan-friendly cards with details collapsed');
const indexHtml = readFileSync(new URL('../static/index.html', import.meta.url), 'utf8');
assert(indexHtml.includes('<title>企业内容增长助手 · 生成发布计划与效果复盘</title>'), 'default title should be customer-facing product title without version text');
assert(indexHtml.includes('企业内容增长助手') && indexHtml.includes('把你的业务变成可执行的内容增长计划'), 'default customer page should use a product title instead of a form instruction as hero title');
assert(!indexHtml.includes('填 5 个问题，得到你的内容发布计划') && !indexHtml.includes('customer-hero-bullets') && !indexHtml.includes('customer-steps'), 'customer hero should remove noisy checklist-style guidance and duplicate step card');
assert(indexHtml.includes('id="customerAssessmentForm"') && indexHtml.includes('data-customer-problems'), 'customer page should use the customer trial form and problem cards');
assert(indexHtml.includes('id="internalApp" hidden') && indexHtml.includes('内测版 · 智能诊断内核'), 'internal workbench should be hidden by default but expose the internal smart diagnosis kernel label');
assert(indexHtml.includes('id="customerGuide"') && indexHtml.includes('参考一个填写示例') && !indexHtml.includes('id="customerGuide" class="customer-guide-panel" open'), 'customer page should keep examples collapsed by default');
assert(indexHtml.includes('本地美容美甲门店') && indexHtml.includes('让附近客户咨询美甲套餐') && indexHtml.includes('我知道怎么填了'), 'customer guide should show field-specific examples and a collapse action');
assert(!indexHtml.includes('id="heroPrimaryBtn"') && !indexHtml.includes('id="sampleBtn"'), 'hero should remove duplicate primary/sample buttons');
assert(indexHtml.includes('id="topReturnProjectBtn"'), 'new project return action should sit next to the More button');
assert(indexHtml.includes('先说清楚你的业务和目标') && indexHtml.includes('生成我的内容建议'), 'first form should keep the core customer path without using the form task as product title');
assert(indexHtml.includes('你的目标客户是谁？*') && indexHtml.includes('required placeholder="如：附近3公里爱美女性'), 'target customer should be required because advice quality depends on audience');
assert(indexHtml.includes('想让建议更准？补充这些信息') && indexHtml.includes('主推产品/服务和价格带') && indexHtml.includes('客户最常问的问题或顾虑') && indexHtml.includes('你现在手里有什么素材？') && indexHtml.includes('最近表现最好的一条内容/对标内容'), 'customer page should offer optional precision fields without overloading the first screen');
assert(appJs.includes('rawForm.offer || customerOfferFromGoal') && appJs.includes('rawForm.customer_pain || rawForm.biggest_problem'), 'customer submit should preserve optional precision fields instead of overwriting them');
assert(indexHtml.includes('class="customer-choice-chip" type="button" data-value="有浏览没咨询"'), 'customer biggest problem should use checkbox-like chips');
assert(indexHtml.includes('默认先看前三条，完整计划用卡片展开，避免密集表格。'), 'plan section should include a short plan hint');
const warRoomCss = readFileSync(new URL('../static/war-room-v1.6.1.css', import.meta.url), 'utf8');
assert(warRoomCss.includes('.feedback-focus[hidden]') && warRoomCss.includes('display:none!important'), 'mobile css must not override hidden feedback/review workflow');
assert(warRoomCss.includes('body.customer-mode') && warRoomCss.includes('.customer-choice-chip span') && warRoomCss.includes('.customer-problem-grid button.is-selected'), 'customer page should separate checkbox-like choices from primary buttons');
assert(warRoomCss.includes('.customer-more-fields') && warRoomCss.includes('.customer-more-grid') && warRoomCss.includes('越具体越准'), 'optional precision fields should be styled as a collapsed low-noise section');
assert(warRoomCss.includes('.customer-guide-panel') && warRoomCss.includes('.guide-row p::before'), 'customer filling guide should look like an annotated form card');
assert(indexHtml.includes('<h2>内容数据回填</h2>') && indexHtml.includes('回填记录') && indexHtml.includes('内容复盘依据'), 'review evidence should sit next to feedback records');
assert(indexHtml.indexOf('内容复盘依据') > indexHtml.indexOf('回填记录'), 'review evidence should appear after feedback records');
assert(indexHtml.indexOf('客户输入与诊断依据') > indexHtml.indexOf('周复盘') && indexHtml.indexOf('客户输入与诊断依据') > indexHtml.indexOf('内容复盘依据'), 'customer/diagnosis evidence should be grouped inside the weekly review evidence area instead of interrupting plan execution');
assert(indexHtml.includes('保存反馈') && indexHtml.includes('↻ 更新复盘'), 'feedback buttons should be clear');
assert(indexHtml.includes('id="customerRecordSummary"') && indexHtml.includes('本期只做轻量记录，不做复杂运营跟踪'), 'customer result after saving should show record summary while clarifying P0 is not full operations tracking');
assert(indexHtml.includes('id="customerRegenerateBtn"') && indexHtml.includes('修改信息并重新生成'), 'customer side should provide a lightweight regenerate entry without exposing internal version history');
assert(appJs.includes('function renderCustomerRecordSummary') && appJs.includes('本条内容结果') && appJs.includes('咨询率'), 'customer feedback submit should render actionable result metrics, not only a saved record');
assert(appJs.includes('企业主发内容没咨询，通常不是内容太少') && !appJs.includes('发了很多内容为什么还是没人咨询'), 'internal sample plans should also use target-customer-facing topics');
assert(indexHtml.includes('class="panel-head review-panel-head"') && indexHtml.includes('class="review-primary-btn"'), 'weekly review action should sit in the title row as an obvious primary button');
assert(appJs.includes('review-metric-grid') && appJs.includes('review-decision-grid') && appJs.includes('review-next'), 'weekly review should render as visual cards instead of dense paragraphs');
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
  main_goal: '增加产品曝光度，带来私信询价和订单',
  target_customer: '18-35岁爱美的女士，关注通勤穿搭、约会拍照、送礼和日常精致感',
  offer: '耳饰、项链、手链、戒指、礼物款饰品',
  customer_pain: '不知道发什么，担心图片好看但没有人私信下单',
  current_channels: '小红书、抖音、朋友圈',
  posting_frequency: '偶尔发布',
  biggest_problem: '不知道发什么',
});
assertRetailAccessoryPlans('accessory retail output', accessory);
assertCustomerFacingPlans('accessory retail output', accessory);

const basketballGoods = await submitAssessment({
  company_name: '篮球销售客户',
  industry: '篮球销售，卖篮球、训练篮球、比赛篮球、篮球用品，主要做线上曝光和私信订单',
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
  client_mode: 'internal_test',
  source: 'internal_test',
});
assert(internalBasketballGoods.diagnosis.smart_context?.module === 'internal_smart_diagnosis_kernel', 'internal assessment should include smart diagnosis kernel context');
assert(internalBasketballGoods.diagnosis.smart_context.business_type === '商品零售/产品销售', 'internal smart diagnosis should classify basketball sales as product retail');
assert(internalBasketballGoods.diagnosis.smart_context.risk_gates.some((x) => x.includes('禁止写成篮球培训')), 'internal smart diagnosis should include anti-cross-industry gate');
assert(internalBasketballGoods.diagnosis.insight.includes('商品零售/产品销售') && internalBasketballGoods.diagnosis.weekly_action.includes('篮球商品'), 'internal smart diagnosis should replace fixed-field diagnosis copy with transaction-context reasoning');
assertCustomerFacingPlans('basketball goods output', basketballGoods);

const safetyCompliance = await submitAssessment({
  company_name: 'P03安标项目测试客户',
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
assert(safetyCompliance.plans.slice(0, 3).map((p) => p.platform).join('|') === '抖音|视频号|朋友圈/私域', 'P03 safety compliance plans should rotate chosen platforms without forcing 小红书');
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
assert(basketball.diagnosis.platform_recommendations.primary.map((x) => x.platform).join('|') === '小红书|视频号|朋友圈/私域', 'basketball should use dedicated parent/local training channel mix');
assert(basketball.plans.every((plan) => plan.requested_model === 'rule_template' && plan.actual_model === 'rule_template' && plan.provider === 'local' && plan.fallback === false), 'tonight delivery should use original rule_template model without Opus fallback');
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
    sample_content: '爆款标题：孩子几岁做牙齿矫正更合适？数据摘要：收藏高，私信问矫正周期。',
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
  publish_link: 'https://example.com/first-post',
  feedback_stage: 'T+24',
  views: 1200,
  likes: 36,
  comments: 8,
  favorites: 22,
  shares: 5,
  consultations: 4,
  notes: '评论集中问价格和儿童矫正周期',
}));
if (feedbackRes.status !== 201) throw new Error(`feedback expected 201, got ${feedbackRes.status}: ${await feedbackRes.text()}`);
const feedbackData = await feedbackRes.json();
assert(feedbackData.feedback.publish_link === 'https://example.com/first-post', 'feedback must preserve first publish link');
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

console.log(JSON.stringify({
  strategy_score: diagnosis.strategy_score,
  app_version: diagnosis.app_version,
  unsafe_comment_cta_count: JSON.stringify({ diagnosis, plans, beauty, education, restaurant, oral }).match(/评论区告诉我|留言关键词|留言“复盘”|评论\/私信“方案”|可以留言你的情况/g)?.length || 0,
  loop_score: diagnosis.loop_score,
  account_setup: diagnosis.account_setup,
  own_platforms: diagnosis.platform_recommendations.primary.map((x) => x.platform),
  client_platforms: diagnosis.platform_recommendations.client_platforms.map((x) => x.platform),
  oral_platforms: oral.plans.slice(0, 3).map((p) => p.platform),
  feedback_dashboard: feedbackData.dashboard,
  first_date: plans[0].planned_date,
  first_topics: plans.slice(0, 3).map((p) => p.topic),
  quality_labels: plans.map((p) => p.publish_quality),
}, null, 2));
