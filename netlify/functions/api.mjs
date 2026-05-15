let state;

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const clean = (data, key, fallback = '') => String(data?.[key] ?? fallback).trim();
const todayIso = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};
const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

const blankState = () => ({
  next: { assessment: 1, diagnosis: 1, plan: 1, feedback: 1, review: 1 },
  assessments: [],
  diagnoses: [],
  plans: [],
  feedback: [],
  reviews: [],
});

const stageFor = (frequency = '') => {
  if (['每天', '日更', '稳定'].some((word) => frequency.includes(word))) return '稳定优化期';
  if (['每周', '一周', '周'].some((word) => frequency.includes(word))) return '节奏建立期';
  return '起步诊断期';
};

const priorityFor = (problem = '') => {
  if (['不知道', '发什么', '选题'].some((word) => problem.includes(word))) return '选题不稳定';
  if (['咨询', '私信', '转化'].some((word) => problem.includes(word))) return '内容不转化';
  if (['流量', '曝光', '播放'].some((word) => problem.includes(word))) return '曝光不足';
  return '营销动作缺少复盘';
};

const scoreFor = (assessment) => {
  let score = 35;
  if (assessment.target_customer) score += 12;
  if (assessment.offer) score += 12;
  if (assessment.best_recent_content) score += 10;
  if (['每周', '每天', '稳定'].some((word) => assessment.posting_frequency.includes(word))) score += 12;
  if (['视频号', '小红书', '抖音', '公众号'].some((channel) => assessment.current_channels.includes(channel))) score += 8;
  if (assessment.customer_pain) score += 6;
  if (assessment.content_assets) score += 5;
  return Math.max(0, Math.min(100, score));
};

const platformFor = (channels = '') =>
  ['视频号', '小红书', '抖音', '公众号'].find((channel) => channels.includes(channel)) || '视频号';

const planTemplates = (priority, target, offer) => {
  const items = [
    [`${target}最常遇到的3个问题`, '痛点共鸣：先说客户正在经历的具体困扰', '短视频/图文', `想要判断自己适不适合，可以私信领取「${offer}」`, '咨询数'],
    [`一个真实案例：${target}如何少走弯路`, '案例信任：前后变化/过程/结果', '短视频', '评论“案例”获取同类方案', '私信数'],
    ['选择服务前最容易踩的坑', '避坑科普：降低客户决策风险', '图文', `保存这条，决策前对照检查；需要可私信「${offer}」`, '收藏数'],
    ['为什么你现在做了内容但没有咨询？', '问题诊断：指出错误动作和修正方式', '短视频', '把你的情况发来，帮你看一个最优先修改点', '评论数'],
    [`${offer}到底能解决什么？`, '价值说明：用客户语言解释交付结果', '图文', `想了解下一步，私信「${offer}」`, '咨询数'],
    [`老板/负责人亲自说：我们如何服务${target}`, '人设信任：真实、专业、有温度', '短视频', '有类似问题可以直接留言', '互动数'],
    ['本周客户问得最多的1个问题', 'FAQ：把咨询问题反向变成内容', '短视频/图文', '还有其他问题，评论区告诉我', '评论数'],
  ];
  if (priority === '曝光不足') {
    items[0] = [`别再忽略这个问题：${target}90%会踩坑`, '强钩子：用高相关痛点提升打开率', '短视频', `想避坑可私信「${offer}」`, '曝光数'];
  }
  return items;
};

const createAssessment = (payload) => {
  const required = ['industry', 'main_goal', 'current_channels', 'posting_frequency', 'biggest_problem'];
  const missing = required.filter((key) => !clean(payload, key));
  if (missing.length) throw new Error(`缺少必填字段：${missing.join(', ')}`);

  const assessment = {
    id: state.next.assessment++,
    company_name: clean(payload, 'company_name', '未命名客户') || '未命名客户',
    industry: clean(payload, 'industry'),
    main_goal: clean(payload, 'main_goal'),
    current_channels: clean(payload, 'current_channels'),
    posting_frequency: clean(payload, 'posting_frequency'),
    biggest_problem: clean(payload, 'biggest_problem'),
    target_customer: clean(payload, 'target_customer'),
    offer: clean(payload, 'offer'),
    customer_pain: clean(payload, 'customer_pain'),
    content_assets: clean(payload, 'content_assets'),
    monthly_budget: clean(payload, 'monthly_budget'),
    decision_cycle: clean(payload, 'decision_cycle'),
    best_recent_content: clean(payload, 'best_recent_content'),
    contact: clean(payload, 'contact'),
    created_at: nowIso(),
  };
  state.assessments.unshift(assessment);
  return assessment.id;
};

const generateDiagnosis = (assessmentId) => {
  const assessment = state.assessments.find((item) => item.id === assessmentId);
  if (!assessment) throw new Error('体检记录不存在');
  const priority = priorityFor(assessment.biggest_problem);
  const target = assessment.target_customer || '目标客户';
  const offer = assessment.offer || '明确咨询入口';
  const diagnosis = {
    id: state.next.diagnosis++,
    assessment_id: assessmentId,
    score: scoreFor(assessment),
    stage: stageFor(assessment.posting_frequency),
    priority_problem: priority,
    insight: '',
    weekly_action: '',
    next_step: '',
    risk_warning: '',
    created_at: nowIso(),
  };

  if (priority === '选题不稳定') {
    diagnosis.insight = `当前不是缺平台，而是缺少围绕「${target}」真实痛点的稳定选题测试。`;
    diagnosis.weekly_action = '本周连续测试 7 条客户痛点/案例/避坑内容，先验证哪个角度能带来咨询。';
    diagnosis.next_step = '先建立一周选题池，用反馈数据决定下周加码方向。';
    diagnosis.risk_warning = '不要一开始追求精致大制作；先用低成本内容换真实反馈。';
  } else if (priority === '内容不转化') {
    diagnosis.insight = `当前内容可能有曝光，但没有把客户带到「${offer}」这个行动。`;
    diagnosis.weekly_action = '本周把内容结尾统一改成明确咨询入口，并记录私信/咨询数量。';
    diagnosis.next_step = '把内容结尾改成明确咨询入口，并追踪私信/咨询数量。';
    diagnosis.risk_warning = '只看播放量会误判，第一版必须把咨询数作为核心反馈字段。';
  } else if (priority === '曝光不足') {
    diagnosis.insight = '当前需要先提升内容第一眼吸引力和发布节奏，再判断转化能力。';
    diagnosis.weekly_action = '本周围绕同一痛点做 7 个不同标题角度，测试曝光差异。';
    diagnosis.next_step = '先测标题/封面/开头三要素，不急着扩大平台。';
    diagnosis.risk_warning = '曝光不足时不要直接加预算，先确认内容钩子是否成立。';
  } else {
    diagnosis.insight = '当前营销动作没有形成数据复盘，下一步要建立发布-回填-复盘闭环。';
    diagnosis.weekly_action = '本周固定发布计划和反馈字段，完成一次发布-回填-复盘闭环。';
    diagnosis.next_step = '每条内容发布后24-72小时回填曝光、互动和咨询。';
    diagnosis.risk_warning = '无回填就无法优化，系统会把“未回填”视为未闭环。';
  }

  state.diagnoses.unshift(diagnosis);
  return diagnosis;
};

const createContentPlan = (diagnosisId) => {
  const diagnosis = state.diagnoses.find((item) => item.id === diagnosisId);
  if (!diagnosis) throw new Error('诊断记录不存在');
  const assessment = state.assessments.find((item) => item.id === diagnosis.assessment_id);
  const target = assessment?.target_customer || '目标客户';
  const offer = assessment?.offer || '一次免费诊断';
  const platform = platformFor(assessment?.current_channels);
  const plans = planTemplates(diagnosis.priority_problem, target, offer).map(([topic, angle, content_type, cta, target_metric], index) => ({
    id: state.next.plan++,
    diagnosis_id: diagnosisId,
    planned_date: todayIso(index),
    platform,
    topic,
    angle,
    content_type,
    cta,
    target_metric,
    owner: '客户负责人',
    status: '待发布',
    publish_link: '',
    created_at: nowIso(),
  }));
  state.plans.push(...plans);
  return plans;
};

const recordFeedback = (planId, payload) => {
  const plan = state.plans.find((item) => item.id === planId);
  if (!plan) throw new Error('发布计划不存在');
  const feedback = {
    id: state.next.feedback++,
    content_plan_id: planId,
    views: Number(payload.views || 0),
    likes: Number(payload.likes || 0),
    comments: Number(payload.comments || 0),
    favorites: Number(payload.favorites || 0),
    shares: Number(payload.shares || 0),
    consultations: Number(payload.consultations || 0),
    publish_link: clean(payload, 'publish_link'),
    notes: clean(payload, 'notes'),
    created_at: nowIso(),
  };
  plan.status = '已发布';
  if (feedback.publish_link) plan.publish_link = feedback.publish_link;
  state.feedback.unshift(feedback);
  return feedback;
};

const createWeeklyReview = () => {
  const rows = state.feedback.map((feedback) => ({
    ...feedback,
    topic: state.plans.find((plan) => plan.id === feedback.content_plan_id)?.topic || '',
  }));
  const total_posts = rows.length;
  const total_views = rows.reduce((sum, item) => sum + item.views, 0);
  const total_interactions = rows.reduce((sum, item) => sum + item.likes + item.comments + item.favorites + item.shares, 0);
  const total_consultations = rows.reduce((sum, item) => sum + item.consultations, 0);
  const winner = rows.slice().sort((a, b) =>
    (b.consultations - a.consultations) ||
    ((b.favorites + b.comments) - (a.favorites + a.comments)) ||
    (b.views - a.views)
  )[0];
  let bottleneck = '暂无反馈数据';
  let next_actions = '先完成至少1条内容发布和反馈回填，否则无法复盘。';
  if (rows.length && total_consultations > 0) {
    bottleneck = '需要扩大有效内容样本';
    next_actions = `加码「${winner.topic}」同类角度，下周至少复制3条，并保留相同CTA。`;
  } else if (rows.length && total_views < 1000) {
    bottleneck = '曝光不足';
    next_actions = '优先优化标题/封面/开头，先获得足够曝光样本。';
  } else if (rows.length) {
    bottleneck = '转化不足';
    next_actions = '已有曝光但咨询不足，下周强化痛点表达、案例信任和明确咨询入口。';
  }
  const day = new Date();
  const monday = new Date(day);
  monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const review = {
    id: state.next.review++,
    week_start: monday.toISOString().slice(0, 10),
    week_end: sunday.toISOString().slice(0, 10),
    total_posts,
    total_views,
    total_interactions,
    total_consultations,
    winner_topic: winner?.topic || '',
    bottleneck,
    next_actions,
    created_at: nowIso(),
  };
  state.reviews.unshift(review);
  return review;
};

const dashboard = () => {
  const total_plans = state.plans.length;
  const published_plans = state.plans.filter((plan) => plan.status === '已发布').length;
  const total_views = state.feedback.reduce((sum, item) => sum + item.views, 0);
  const total_interactions = state.feedback.reduce((sum, item) => sum + item.likes + item.comments + item.favorites + item.shares, 0);
  const total_consultations = state.feedback.reduce((sum, item) => sum + item.consultations, 0);
  let next_suggestion = '先执行：还没有发布反馈，优先完成第一条内容发布和数据回填。';
  if (total_consultations > 0) next_suggestion = '加码：已有内容带来咨询，下周复制最高咨询主题并保留CTA。';
  else if (published_plans > 0) next_suggestion = '优化：已有发布但暂无咨询，下周强化结尾引导和客户痛点表达。';
  if (state.reviews[0]) next_suggestion = state.reviews[0].next_actions;
  return {
    total_plans,
    published_plans,
    feedback_rate: total_plans ? published_plans / total_plans : 0,
    total_views,
    total_interactions,
    total_consultations,
    next_suggestion,
  };
};

const seed = () => {
  state = blankState();
  const assessment_id = createAssessment({
    company_name: '南京样板制造有限公司',
    industry: '工业设备',
    main_goal: '获得更多咨询',
    current_channels: '视频号, 小红书',
    posting_frequency: '偶尔发布',
    biggest_problem: '不知道发什么',
    target_customer: '工厂采购负责人',
    offer: '免费选型建议',
    customer_pain: '不知道如何判断设备是否适合自己的产线',
    content_assets: '客户案例、产品演示视频',
    best_recent_content: '客户案例短视频',
    contact: '赵娜',
  });
  const diagnosis = generateDiagnosis(assessment_id);
  createContentPlan(diagnosis.id);
};

const ensureState = () => {
  if (!state) seed();
};

export default async (request) => {
  ensureState();
  const url = new URL(request.url);
  const path = `/${(url.searchParams.get('path') || '').replace(/^\/+/, '')}`;
  try {
    if (request.method === 'GET') {
      if (path === '/health') return json({ ok: true, runtime: 'netlify-function' });
      if (path === '/dashboard') return json(dashboard());
      if (path === '/assessments') return json(state.assessments);
      if (path === '/diagnoses') return json(state.diagnoses);
      if (path === '/plans') return json(state.plans);
      if (path === '/feedback') return json(state.feedback);
      if (path === '/reviews') return json(state.reviews);
    }

    const payload = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    if (request.method === 'POST' && path === '/assessments') {
      const assessment_id = createAssessment(payload);
      const diagnosis = generateDiagnosis(assessment_id);
      const plans = createContentPlan(diagnosis.id);
      return json({ assessment_id, diagnosis, plans }, 201);
    }
    if (request.method === 'POST' && path === '/feedback') {
      const plan_id = Number(payload.content_plan_id);
      const feedback = recordFeedback(plan_id, payload);
      return json({ feedback, dashboard: dashboard() }, 201);
    }
    if (request.method === 'POST' && path === '/reviews') {
      const review = createWeeklyReview();
      return json({ review, dashboard: dashboard() }, 201);
    }
    return json({ error: 'Not found' }, 404);
  } catch (error) {
    return json({ error: error.message || '请求失败' }, 400);
  }
};
