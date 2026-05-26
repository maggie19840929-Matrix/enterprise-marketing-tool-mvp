let state;

const APP_VERSION = '1.6.5';
const VERSION_LABEL = 'v1.6.5 · 依据中心与复盘判断升级版';

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const clean = (data, key, fallback = '') => String(data?.[key] ?? fallback).trim();
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
  if (['咨询', '私信', '转化'].some((word) => problem.includes(word))) return '内容不转化';
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
    if (!existing || stageRank(item.feedback_stage) > stageRank(existing.feedback_stage) || (stageRank(item.feedback_stage) === stageRank(existing.feedback_stage) && String(item.created_at || '') > String(existing.created_at || ''))) {
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
const normalizeBenchmark = (payload = {}) => {
  const source = payload.benchmark && typeof payload.benchmark === 'object' ? payload.benchmark : payload;
  const accountText = clean(source, 'benchmark_accounts').split(/[\n\r,，、]+/);
  const accounts = [
    ...(Array.isArray(source.accounts) ? source.accounts : []),
    ...accountText,
    clean(source, 'benchmark_account_1'),
    clean(source, 'benchmark_account_2'),
    clean(source, 'benchmark_account_3'),
  ].map((item) => String(item || '').trim()).filter(Boolean);
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
      '用收藏、私信、咨询数据判断哪些主题值得进入下一轮',
    ],
    avoid: [
      '不照抄对标账号标题、封面、脚本或案例原文',
      '不搬运未经授权的图片、视频和客户故事',
      '不把对标账号的人设直接套到本客户账号',
    ],
  };
};
const softCta = (offer = '', pain = '') => {
  if (hasAny(`${offer} ${pain}`, ['复盘', 'AI', '内容增长', '线上获客'])) return '如果你也发了内容但不知道有没有用，可以私信具体情况，从一张内容反馈表开始。';
  return `如果你也遇到「${pain || '类似问题'}」，可以私信具体情况，先判断问题卡在哪里。`;
};
const isMetaMarketingAccount = (assessment) => hasAny([assessment.industry, assessment.offer, assessment.main_goal].filter(Boolean).join(' '), ['企业内容增长', '线上获客', 'AI营销复盘', '营销增长', '内容获客']);
const addPlatform = (bucket, platform, reason) => {
  if (!bucket.some((item) => item.platform === platform)) bucket.push({ platform, reason });
};


const platformStyleRulesFor = (platform) => {
  const rules = {
    '小红书': '可适量使用 emoji、封面要有精致感，标题要像真实问题，不要像工具说明书。',
    '视频号': '更适合负责人/老板口播、案例复盘和信任建立，表达要稳，不追求过度网感。',
    '朋友圈/私域': '适合承接信任和轻咨询，少用营销腔，多用真实案例、过程和客户问题。',
    '公众号': '适合深度方案、案例沉淀和长期搜索资料，少用 emoji，结构要清楚。',
    '抖音': '适合短视频曝光测试，需要更强开头钩子和持续素材能力，不宜第一天就重投入。',
    '知乎': '适合专业问题搜索和方案型信任，重逻辑与证据，不追求小红书式精致感。',
  };
  return rules[platform] || '按该平台用户语境调整表达，不把小红书规则生搬硬套到所有平台。';
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
    '💬 有需求先私信具体情况',
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
    addPlatform(support, '抖音', '可后置测试短视频曝光，不作为第一轮主阵地。');
    addPlatform(avoid, '美团/大众点评', '这是本地商家的承接平台，不是企业营销工具测试号自身的发布平台。');
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
    current.slice(0, 3).forEach((platform) => addPlatform(primary, platform, '这是当前已有平台，1.0先用它低成本测试内容反馈。'));
    if (primary.length < 3) addPlatform(primary, '小红书', '适合测试用户痛点、案例和搜索型内容反馈。');
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

const planPlatforms = (recommendations, fallbackChannels) => {
  let parsed = recommendations;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { parsed = null; }
  }
  const primary = (parsed?.primary || []).map((item) => item.platform).filter(Boolean);
  return primary.length ? primary : (platformsFor(fallbackChannels).length ? platformsFor(fallbackChannels) : ['小红书']);
};

const planTemplates = (priority, industry, goal, target, offer, pain, problem = '', benchmarkReference = null) => {
  const audience = shortAudience(target);
  const painShort = painLabel(pain, problem);
  const benchmarkTheme = benchmarkReference?.recent_topics?.[0]?.replace(`${audience}对「`, '').replace('」类问题有明确兴趣', '');
  const cta = softCta(offer, painShort);
  const isMeta = isMetaMarketingAccount({ industry, main_goal: goal, offer });
  if (!isMeta) {
    const directCta = `想要「${goal}」，可以私信了解「${offer}」。`;
    const items = [
      [`${audience}最关心的3个${industry}问题`, `痛点共鸣：围绕「${painShort}」说清具体困扰`, '短视频/图文', directCta, '咨询数', '需要人工润色', '适合补充真实客户问题或本地案例后发布'],
      [`一个真实场景：${audience}如何判断是否需要${offer}`, '案例信任：讲清前后变化、过程和判断标准', '短视频', `可以通过主页咨询「${offer}」的适配情况。`, '私信数', '需要人工润色', '需要替换成真实案例，避免空泛承诺'],
      [`${audience}在选择${offer}前最容易忽略什么？`, '避坑科普：降低客户决策风险，建立专业信任', '图文', `保存这条，决策前对照检查；需要可咨询「${offer}」。`, '收藏数', '可直接进入草稿', '结构完整，发布前补充门店/服务细节即可'],
      [`为什么有「${painShort}」的人，迟迟没有行动？`, `阻力拆解：把「${painShort}」转成可理解、可咨询的问题`, '图文/短视频', directCta, '评论数', '需要人工润色', '适合测试痛点表达是否准确'],
      [`${offer}到底能帮${audience}解决什么？`, '价值说明：用客户语言解释交付结果和适合人群', '图文', directCta, '咨询数', '可直接进入草稿', '主题清楚，适合承接咨询'],
      [`${industry}负责人亲自说：我们如何服务${audience}`, '人设信任：展示专业判断、流程和真实态度', '短视频', `有「${painShort}」类似问题，可以直接私信你的情况。`, '互动数', '需要人工润色', '建议加入负责人出镜或真实服务过程'],
      [`本周${audience}问得最多的1个问题`, 'FAQ：把咨询问题反向变成内容，沉淀下周选题', '短视频/图文', `还有关于「${offer}」的问题，可以私信具体情况。`, '评论数', '仅为策略方向', '必须结合真实私信/咨询后再发布'],
    ];
    if (priority === '曝光不足') {
      items[0] = [`别再忽略：${audience}遇到「${painShort}」时最容易踩的坑`, '强钩子：用高相关痛点提升打开率', '短视频/图文', directCta, '曝光数', '需要人工润色', '适合先测标题/封面，不代表已形成闭环'];
    }
    if (benchmarkTheme) {
      items[0] = [`${audience}为什么会关注「${benchmarkTheme}」？`, '对标校准：提炼已验证痛点，转译为本客户场景，不照抄原文', '图文/短视频', directCta, '收藏数', '需要人工润色', '来自对标账号主题结构，发布前需替换成本客户案例'];
      items[1] = [`从对标爆款看：选择${offer}前先确认3件事`, '标题结构迁移：把高互动问题改写成服务决策清单', '图文', `保存这条，决策前对照检查；需要可咨询「${offer}」。`, '收藏/私信', '需要人工润色', '只借鉴结构，不复制标题和素材'];
    }
    return items;
  }
  const items = [
    [`发了很多内容，为什么还是没人咨询？`, `痛点诊断：围绕「${painShort}」拆出内容与获客断点`, '图文', cta, '收藏/评论', '需要人工润色', '策略方向可用，发布前需补充真实案例或老板经验'],
    [`AI写文案很快，为什么带不来客户？`, '误区拆解：区分内容产出和获客转化', '图文', cta, '收藏数', '需要人工润色', '适合作为方法论选题，避免写成AI工具教程'],
    [`一条内容有没有获客价值，不是看点赞`, '复盘方法：用收藏、评论、私信判断需求信号', '图文', '发布后记录浏览、收藏、私信、咨询四个数据，再决定下一条怎么改。', '收藏/私信', '可直接进入草稿', '主题清晰，可用于测试复盘能力'],
    [`企业账号别只发产品，先发客户问题`, `选题转译：把「${painShort}」改写成客户看得懂的问题`, '图文/短视频', cta, '评论数', '需要人工润色', '需要补充具体行业例子'],
    [`老板没时间做运营，怎么做每周内容复盘？`, '低成本流程：发布-回填-复盘-下条调整', '图文', '需要复盘表时，可以私信具体情况。', '私信/咨询', '可直接进入草稿', '符合闭环验证目标'],
    [`为什么爆款不等于能成交？`, '指标校准：曝光、互动、咨询分层看', '短视频/图文', '不要只问能不能火，先问能不能带来客户信号。', '评论/收藏', '需要人工润色', '适合做认知内容'],
    [`本周内容测试复盘：哪个问题带来了真实反馈？`, '复盘公开：把7天反馈转成下周选题依据', '图文', '如果你也想知道内容怎么复盘，可以私信你现在最卡的点。', '评论/关注', '仅为策略方向', '必须等真实数据回填后再发布'],
  ];
  if (priority === '曝光不足') {
    items[0] = [`${audience}内容没人看，先检查标题有没有说中痛点`, `强钩子：把「${painShort}」放到标题和封面第一眼`, '图文', cta, '曝光数', '需要人工润色', '适合先测标题/封面，不代表已形成闭环'];
  }
  if (benchmarkTheme) {
    items[0] = [`为什么「${benchmarkTheme}」这类问题更容易被收藏？`, '对标校准：拆出已验证痛点，再转译成企业内容获客场景', '图文', cta, '收藏数', '需要人工润色', '只迁移主题和结构，不照抄原文'];
    items[1] = [`从对标账号看，企业主最吃哪种标题结构？`, '结构拆解：痛点直问、避坑清单、案例复盘三类标题', '图文', cta, '收藏/私信', '可直接进入草稿', '适合做第一轮选题校准'];
  }
  return items;
};

const createAssessment = (payload) => {
  const required = ['industry', 'main_goal', 'current_channels', 'posting_frequency', 'biggest_problem'];
  const missing = required.filter((key) => !clean(payload, key));
  if (missing.length) throw new Error(`缺少必填字段：${missing.join(', ')}`);

  const assessment = {
    id: state.next.assessment++,
    company_name: clean(payload, 'company_name'),
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
    account_preference: clean(payload, 'account_preference'),
    benchmark: normalizeBenchmark(payload),
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
  const industry = assessment.industry || '当前行业';
  const goal = assessment.main_goal || '获得更多有效咨询';
  const target = assessment.target_customer || '目标客户';
  const offer = assessment.offer || '明确咨询入口';
  const pain = assessment.customer_pain || assessment.biggest_problem || '当前核心痛点';
  const channels = assessment.current_channels || '当前平台';
  const frequency = assessment.posting_frequency || '当前发布频率';
  const platformRecommendations = recommendPlatforms(assessment);
  const benchmarkReference = benchmarkReferenceFor(assessment);
  const diagnosis = {
    id: state.next.diagnosis++,
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
    benchmark_reference: benchmarkReference,
    account_setup: accountSetupFor(assessment, platformRecommendations),
    created_at: nowIso(),
  };

  if (priority === '选题不稳定') {
    diagnosis.insight = `当前「${industry}」的核心目标是「${goal}」，但内容还没有稳定围绕「${target}」和「${pain}」做选题测试。`;
    diagnosis.weekly_action = `本周在「${channels}」连续测试 7 条围绕「${target}」痛点、案例和避坑的内容，先验证哪个角度能带来「${goal}」。`;
    diagnosis.next_step = `先建立一周选题池，每条内容都指向「${offer}」，用反馈数据决定下周加码方向。`;
    diagnosis.risk_warning = '不要一开始追求精致大制作；先用低成本内容换真实反馈。';
  } else if (priority === '内容不转化') {
    diagnosis.insight = `当前「${industry}」内容可能有曝光，但没有把「${target}」从「${pain}」自然带到「${offer}」这个行动。`;
    diagnosis.weekly_action = `本周把「${channels}」内容结尾统一改成围绕「${goal}」的明确咨询入口，并记录私信/咨询数量。`;
    diagnosis.next_step = `把内容结尾改成「${offer}」相关合规私信/主页咨询入口，并追踪是否真的带来「${goal}」。`;
    diagnosis.risk_warning = '只看播放量会误判，第一版必须把咨询数作为核心反馈字段。';
  } else if (priority === '曝光不足') {
    diagnosis.insight = `当前「${industry}」需要先提升内容第一眼吸引力，让「${target}」一眼看见和自己有关的「${pain}」。`;
    diagnosis.weekly_action = `本周围绕「${pain}」做 7 个不同标题角度，在「${channels}」测试曝光差异。`;
    diagnosis.next_step = `先测标题/封面/开头三要素，再判断是否能承接到「${offer}」。`;
    diagnosis.risk_warning = '曝光不足时不要直接加预算，先确认内容钩子是否成立。';
  } else {
    diagnosis.insight = `当前「${industry}」营销动作还没有把「${channels}」发布、用户反馈和「${goal}」连成复盘闭环。`;
    diagnosis.weekly_action = `本周按「${frequency}」固定发布计划和反馈字段，围绕「${target}」完成一次发布-回填-复盘闭环。`;
    diagnosis.next_step = `每条内容按 T+24 / T+72 / T+7 分阶段回填曝光、互动和咨询，判断是否推动「${goal}」。`;
    diagnosis.risk_warning = '无回填就无法优化，系统会把“未回填”视为未闭环。';
  }

  state.diagnoses.unshift(diagnosis);
  state.current_diagnosis_id = diagnosis.id;
  return diagnosis;
};

const createContentPlan = (diagnosisId) => {
  const diagnosis = state.diagnoses.find((item) => item.id === diagnosisId);
  if (!diagnosis) throw new Error('诊断记录不存在');
  const assessment = state.assessments.find((item) => item.id === diagnosis.assessment_id);
  const industry = assessment?.industry || '当前行业';
  const goal = assessment?.main_goal || '获得更多有效咨询';
  const target = assessment?.target_customer || '目标客户';
  const offer = assessment?.offer || '一次免费诊断';
  const pain = assessment?.customer_pain || assessment?.biggest_problem || '当前核心痛点';
  const problem = assessment?.biggest_problem || '';
  const platforms = planPlatforms(diagnosis.platform_recommendations, assessment?.current_channels);
  // 不再在生成新诊断时清空反馈/复盘。serverless 内存不是可信数据库，
  // 但至少避免新诊断把同一实例中的历史反馈直接抹掉。
  const plans = planTemplates(diagnosis.priority_problem, industry, goal, target, offer, pain, problem, diagnosis.benchmark_reference).map(([topic, angle, content_type, cta, target_metric, publish_quality, quality_note], index) => ({
    id: state.next.plan++,
    diagnosis_id: diagnosisId,
    planned_date: todayIso(index),
    platform: platforms[index % platforms.length],
    topic,
    angle,
    content_type,
    cta,
    target_metric,
    publish_quality,
    quality_note,
    owner: '客户负责人',
    status: '待发布',
    publish_link: '',
    created_at: nowIso(),
  }));
  state.plans = [...plans, ...state.plans.filter((plan) => plan.diagnosis_id !== diagnosisId)];
  return plans;
};

const recordFeedback = (planId, payload) => {
  const plan = state.plans.find((item) => item.id === planId);
  if (!plan) throw new Error('发布计划不存在');
  const publishLink = clean(payload, 'publish_link');
  if (!publishLink) throw new Error('首次/本条发布链接必填：请粘贴已发布内容链接后再保存反馈');
  const feedback = {
    id: state.next.feedback++,
    content_plan_id: planId,
    views: Number(payload.views || 0),
    likes: Number(payload.likes || 0),
    comments: Number(payload.comments || 0),
    favorites: Number(payload.favorites || 0),
    shares: Number(payload.shares || 0),
    consultations: Number(payload.consultations || 0),
    feedback_stage: clean(payload, 'feedback_stage', 'T+24') || 'T+24',
    publish_link: publishLink,
    notes: clean(payload, 'notes'),
    created_at: nowIso(),
  };
  plan.status = '已发布';
  if (feedback.publish_link) plan.publish_link = feedback.publish_link;
  state.feedback = [feedback, ...state.feedback.filter((item) => !(Number(item.content_plan_id) === Number(planId) && String(item.feedback_stage || 'T+24') === String(feedback.feedback_stage)))];
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
  const total_views = rows.reduce((sum, item) => sum + item.views, 0);
  const total_interactions = rows.reduce((sum, item) => sum + item.likes + item.comments + item.favorites + item.shares, 0);
  const total_consultations = rows.reduce((sum, item) => sum + item.consultations, 0);
  let next_suggestion = '先执行：发布第一条内容，并把首次发布链接回填到系统，否则不算闭环。';
  if (total_consultations > 0) next_suggestion = '加码：已有内容带来咨询，下周复制最高咨询主题，并保留合规私信/主页咨询入口。';
  else if (published_plans > 0) next_suggestion = '优化：已有发布但暂无咨询，下周强化客户痛点表达，并用私信/主页咨询承接。';
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

export default async (request) => {
  ensureState();
  const url = new URL(request.url);
  const route = (
    url.searchParams.get('path') ||
    url.pathname.replace(/^\/api\/?/, '').replace(/^\/\.netlify\/functions\/api\/?/, '')
  );
  const path = `/${route.replace(/^\/+/, '')}`;
  try {
    if (request.method === 'GET') {
      if (path === '/health') return json({ ok: true, runtime: 'netlify-function', version: APP_VERSION, version_label: VERSION_LABEL });
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
      const assessment = state.assessments.find((item) => item.id === assessment_id);
      const diagnosis = generateDiagnosis(assessment_id);
      const plans = createContentPlan(diagnosis.id);
      return json({ assessment_id, assessment, diagnosis, plans }, 201);
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
