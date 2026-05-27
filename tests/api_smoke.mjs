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
assert(diagnosis.app_version === '1.6.9', `expected app_version 1.6.9, got ${diagnosis.app_version}`);
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
assertNoUnsafeCommentCta('content decision diagnosis/plans', { diagnosis, plans });
const appJs = readFileSync(new URL('../static/app.js', import.meta.url), 'utf8');
assert(appJs.includes('function prefillFeedback(id)'), 'app should expose prefillFeedback for plan feedback buttons');
assert(appJs.includes("[name=content_plan_id]"), 'prefillFeedback should target the content_plan_id field');
assert(appJs.includes("[name=publish_link]") && appJs.includes('linkInput?.focus()'), 'prefillFeedback should focus the publish link field');
assert(appJs.includes('existingFeedback?.publish_link || plan?.publish_link'), 'prefillFeedback should prefill existing publish links');
assert(appJs.includes('scrollIntoView'), 'prefillFeedback should scroll to the feedback form area');
assert(appJs.includes('is-highlighted'), 'prefillFeedback should highlight the feedback area');
assert(appJs.includes('已选择计划 #'), 'prefillFeedback should show a business toast after locating the form');
assert(appJs.includes('function hasRestorableState'), 'app should detect restorable local state before showing the first form again');
assert(appJs.includes('function resetForNewCustomer'), 'war-room should keep a reset/new customer entry');
assert(appJs.includes('customerDisplayName') && !appJs.includes("a.company_name || '未命名客户'"), 'app should not render 未命名客户 as the customer title');

assert(appJs.includes('function autoReviewFromFeedback()'), 'app should auto-generate weekly review from existing feedback');
assert(appJs.includes('保存至少1条发布链接和反馈后') || appJs.includes('这里会自动出现复盘'), 'weekly review empty state should explain auto review');
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
assert(indexHtml.includes('v1.6.9 · 页面降噪与复盘入口收口版'), 'index should show v1.6.9 label');
assert(!indexHtml.includes('id="heroPrimaryBtn"') && !indexHtml.includes('id="sampleBtn"'), 'hero should remove duplicate primary/sample buttons');
assert(indexHtml.includes('先填 5 个问题') && indexHtml.includes('生成我的内容增长建议'), 'first form should keep the core customer path');
assert(indexHtml.includes('select name="biggest_problem"'), 'v1.6.9 should stay on the v1.6.6 select-based baseline');
assert(indexHtml.includes('默认先看前三条，完整计划可展开。'), 'plan section should include a short plan hint');
assert(indexHtml.includes('<h2>内容数据回填</h2>') && indexHtml.includes('回填记录') && indexHtml.includes('内容复盘依据'), 'review evidence should sit next to feedback records');
assert(indexHtml.indexOf('内容复盘依据') > indexHtml.indexOf('回填记录'), 'review evidence should appear after feedback records');
assert(indexHtml.indexOf('客户输入与诊断依据') > indexHtml.indexOf('周复盘') && indexHtml.indexOf('客户输入与诊断依据') > indexHtml.indexOf('内容复盘依据'), 'customer/diagnosis evidence should be grouped inside the weekly review evidence area instead of interrupting plan execution');
assert(indexHtml.includes('保存反馈') && indexHtml.includes('更新复盘'), 'feedback buttons should be clear');
assert(indexHtml.includes('曝光｜查看') && indexHtml.includes('互动｜点赞') && indexHtml.includes('互动｜评论') && indexHtml.includes('互动｜收藏') && indexHtml.includes('转化｜咨询'), 'feedback fields should be grouped as growth judgment signals');
assert(shanghaiDateIso(0, new Date('2026-05-16T16:05:00.000Z')) === '2026-05-17', 'Shanghai business date should roll forward at UTC+8 midnight');
assert(shanghaiDateIso(1, new Date('2026-05-16T16:05:00.000Z')) === '2026-05-18', 'Shanghai offset should advance from business date');
assert(plans[0].planned_date === shanghaiDateIso(), `planned_date should start today in Asia/Shanghai, got ${plans[0].planned_date}`);
assert(!plans[0].topic.includes('本地生活服务商家、中小企业负责人'), 'topic should use short audience label, not field-stuffed target_customer');
assert(!plans[0].topic.includes('小老板'), 'first topic should avoid 小老板 wording');
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
