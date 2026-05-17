const $ = (s) => document.querySelector(s);
const APP_VERSION = '1.3';
const VERSION_LABEL = 'v1.3 · 内容决策局测试样例入口 + 首发链接回填门禁';
const STORAGE_KEY = 'enterpriseMarketingMvpState.v3';
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
  best_recent_content: '一条内容有没有获客价值，不是看点赞，而是看收藏、评论、私信和咨询',
  account_preference: '内容决策局',
  contact: '企业营销工具测试样例',
};

let clientState = {
  diagnosis: null,
  plans: [],
  feedback: [],
  review: null,
};

const api = async (url, opts={}) => {
  const res = await fetch(url, {headers:{'Content-Type':'application/json'}, ...opts});
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || '请求失败');
  return data;
};
const toast = (msg) => { const el=$('#toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2400); };
const formData = (form) => Object.fromEntries(new FormData(form).entries());
const saveLocal = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(clientState));
const loadLocal = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
};
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

async function loadContentDecisionSample({silent = false} = {}){
  const result = await api('/api/assessments', {method:'POST', body: JSON.stringify(CONTENT_DECISION_SAMPLE)});
  clientState = {
    diagnosis: result.diagnosis,
    plans: result.plans || [],
    feedback: [],
    review: null,
  };
  localStorage.removeItem(DEMO_DISABLED_KEY);
  saveLocal();
  renderAllFromClient();
  if (!silent) toast('已载入内容决策局样例数据');
}

async function loadAll(){
  const local = loadLocal();
  if (local?.plans?.length || local?.diagnosis) {
    clientState = {...clientState, ...local};
    renderAllFromClient();
    return;
  }
  if (localStorage.getItem(DEMO_DISABLED_KEY) === '1') {
    clientState = { diagnosis: null, plans: [], feedback: [], review: null };
    renderAllFromClient();
    return;
  }
  // 首次进入产品测试页时，默认载入“内容决策局”样例，避免测试者看到空看板误判为系统无数据。
  await loadContentDecisionSample({silent: true});
}

function pct(n){ return `${Math.round((Number(n)||0)*100)}%`; }
function esc(v){ return String(v ?? '').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function num(v){ return Number(v || 0); }
function interactions(f){ return num(f.likes) + num(f.comments) + num(f.favorites) + num(f.shares); }
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
  const consultations = clientState.feedback.reduce((sum, f)=>sum + num(f.consultations), 0);
  const totalInteractions = clientState.feedback.reduce((sum, f)=>sum + interactions(f), 0);
  let score = clientState.diagnosis?.loop_score ?? 8;
  if (total) score = Math.max(score, 8 + Math.round((published / total) * 35));
  if (clientState.feedback.length) score += 12;
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

function clientDashboard(){
  const total_plans = clientState.plans.length;
  const published_plans = clientState.plans.filter((plan) => plan.status === '已发布').length;
  const total_views = clientState.feedback.reduce((sum, item) => sum + num(item.views), 0);
  const total_interactions = clientState.feedback.reduce((sum, item) => sum + interactions(item), 0);
  const total_consultations = clientState.feedback.reduce((sum, item) => sum + num(item.consultations), 0);
  let next_suggestion = '先执行：发布第一条内容，并把首次发布链接回填到系统，否则不算闭环。';
  if (total_consultations > 0) next_suggestion = '加码：已有内容带来咨询，下周复制最高咨询主题并保留CTA。';
  else if (published_plans > 0) next_suggestion = '优化：已有发布但暂无咨询，下周强化结尾引导和客户痛点表达。';
  if (clientState.review?.next_actions) next_suggestion = clientState.review.next_actions;
  return {total_plans, published_plans, feedback_rate: total_plans ? published_plans / total_plans : 0, total_views, total_interactions, total_consultations, next_suggestion};
}

function renderAllFromClient(){
  renderDashboard(clientDashboard());
  renderDiagnosis(clientState.diagnosis);
  renderPlans(clientState.plans);
  renderFeedback(clientState.feedback);
  renderReview(clientState.review);
}

function renderDashboard(d){
  $('#metricCards').innerHTML = [
    ['计划数', d.total_plans],
    ['已发布', d.published_plans],
    ['回填率', pct(d.feedback_rate)],
    ['总曝光', d.total_views],
    ['总互动', d.total_interactions],
    ['私信/咨询', d.total_consultations],
    ['动态闭环分', dynamicLoopScore()],
  ].map(([k,v])=>`<div class="card"><span>${k}</span><b>${v}</b></div>`).join('') +
  `<div class="card advice"><span>下一轮建议</span><b>${esc(d.next_suggestion)}</b></div>`;
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
  if(!d){ $('#latestDiagnosis').innerHTML='暂无诊断，先提交一次营销体检。'; return; }
  const platformRecommendations = parsePlatformRecommendations(d.platform_recommendations);
  const platformModule = platformRecommendations ? `<div class="warning">
    <div class="small">平台发布建议</div>
    <p>${esc(platformRecommendations.strategy || '')}</p>
    ${renderPlatformGroup('本账号优先平台', platformRecommendations.primary)}
    ${renderPlatformGroup('辅助平台', platformRecommendations.support)}
    ${renderPlatformGroup('目标客户可能适用平台（不是本账号发布平台）', platformRecommendations.client_platforms)}
    ${renderPlatformGroup('暂不建议', platformRecommendations.avoid)}
  </div>` : '';
  $('#latestDiagnosis').innerHTML = `<div class="diagnosis-card">
    <div class="small">${esc(d.version_label || VERSION_LABEL)}</div>
    <div class="score"><span>策略清晰度</span><strong>${d.strategy_score ?? d.score}</strong><em>/100</em></div>
    <div class="score"><span>初始闭环分</span><strong>${d.loop_score ?? 0}</strong><em>/100</em></div>
    <div class="score"><span>动态闭环分</span><strong>${dynamicLoopScore()}</strong><em>/100</em></div>
    <span class="badge">${esc(d.stage)}</span>
    <div class="warning"><div class="small">评分说明</div><p>${esc(d.score_note || '闭环分必须由发布反馈和复盘数据驱动。')}</p></div>
    <div><div class="small">优先问题</div><div class="big-action">${esc(d.priority_problem)}</div></div>
    <div><div class="small">诊断</div><p>${esc(d.insight)}</p></div>
    ${renderAccountSetup(d.account_setup)}
    ${platformModule}
    <div><div class="small">本周动作</div><p><strong>${esc(d.weekly_action)}</strong></p></div>
    <div class="warning"><div class="small">风险提醒</div><p>${esc(d.risk_warning)}</p></div>
    <div><div class="small">下一步</div><p>${esc(d.next_step)}</p></div>
  </div>`;
}

function renderPlans(plans){
  $('#plansBody').innerHTML = plans.map(p=>`<tr>
    <td><span class="small">#${p.id}</span><br>${esc(p.planned_date)}</td>
    <td>${esc(p.platform)}</td>
    <td><strong>${esc(p.topic)}</strong></td>
    <td>${esc(p.angle)}</td>
    <td>${esc(p.content_type || '')}</td>
    <td>${esc(p.cta || '')}<div class="small">${esc(p.publish_quality || '')}${p.quality_note ? '：' + esc(p.quality_note) : ''}</div></td>
    <td>${esc(p.target_metric)}${p.publish_link ? `<div class="small"><a href="${esc(p.publish_link)}" target="_blank">发布链接已回填</a></div>` : '<div class="small">发布后需回填链接</div>'}</td>
    <td><span class="status">${esc(p.status)}</span></td>
    <td><button class="secondary" onclick="prefillFeedback(${p.id})">填反馈</button></td>
  </tr>`).join('') || '<tr><td colspan="9">暂无计划</td></tr>';
}

function renderFeedback(items){
  $('#feedbackList').innerHTML = items.map(f=>`<div class="list-item">
    <strong>计划 #${f.content_plan_id}</strong> · 曝光 ${f.views} · 互动 ${interactions(f)} · 咨询 ${f.consultations}
    ${f.publish_link ? `<div><a href="${esc(f.publish_link)}" target="_blank">查看发布链接</a></div>` : '<div class="warning">缺少发布链接：本条不算完整闭环</div>'}
    <div class="small">${esc(f.notes || '无备注')} · ${esc(f.created_at)}</div>
  </div>`).join('') || '<div class="empty">暂无反馈。发布后回填数据，系统才会给下一轮建议。</div>';
}

function renderReview(r){
  if(!r){ $('#reviewBox').innerHTML='回填发布数据后，点击生成复盘。'; return; }
  $('#reviewBox').innerHTML = `<div class="review">
    <div class="small">${esc(r.week_start)} 至 ${esc(r.week_end)}</div>
    <p><strong>发布样本：</strong>${r.total_posts} 条 · <strong>曝光：</strong>${r.total_views} · <strong>互动：</strong>${r.total_interactions} · <strong>咨询：</strong>${r.total_consultations}</p>
    <p><strong>胜出主题：</strong>${esc(r.winner_topic || '暂无')}</p>
    <p><strong>当前瓶颈：</strong>${esc(r.bottleneck)}</p>
    <p class="big-action">${esc(r.next_actions)}</p>
  </div>`;
}

function prefillFeedback(id){
  $('#feedbackForm [name=content_plan_id]').value = id;
  window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'});
}
window.prefillFeedback = prefillFeedback;

function createLocalReview(){
  const rows = clientState.feedback.map((feedback) => ({
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
  return {
    week_start: localDateIso(monday),
    week_end: localDateIso(sunday),
    total_posts, total_views, total_interactions, total_consultations,
    winner_topic: winner?.topic || '', bottleneck, next_actions,
    created_at: localTimestamp(),
  };
}

$('#assessmentForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  await withBusy(e.submitter, '生成中...', async () => {
    const payload = formData(e.target);
    const result = await api('/api/assessments', {method:'POST', body: JSON.stringify(payload)});
    clientState = {
      diagnosis: result.diagnosis,
      plans: result.plans || [],
      feedback: [],
      review: null,
    };
    saveLocal();
    e.target.reset();
    toast('已生成诊断和7天发布计划');
    renderAllFromClient();
  });
});

$('#feedbackForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  await withBusy(e.submitter, '保存中...', async () => {
    const data = formData(e.target);
    ['content_plan_id','views','likes','comments','favorites','shares','consultations'].forEach(k=>data[k]=toNonNegative(data[k]));
    data.publish_link = String(data.publish_link || '').trim();
    if (!data.publish_link) throw new Error('首次/本条发布链接必填：请粘贴已发布内容链接后再保存反馈');
    const plan = clientState.plans.find((item) => Number(item.id) === Number(data.content_plan_id));
    if (!plan) throw new Error('发布计划ID不存在，请先生成计划');
    const feedback = {
      id: Date.now(),
      ...data,
      created_at: localTimestamp(),
    };
    plan.status = '已发布';
    if (feedback.publish_link) plan.publish_link = feedback.publish_link;
    clientState.feedback = [feedback, ...clientState.feedback.filter((item) => Number(item.content_plan_id) !== Number(data.content_plan_id))];
    clientState.review = null;
    saveLocal();
    renderAllFromClient();
    e.target.reset();
    toast('反馈已保存，闭环看板已更新');
    api('/api/feedback', {method:'POST', body: JSON.stringify(data)}).catch(() => {});
  });
});

$('#reviewBtn').addEventListener('click', async ()=>{
  await withBusy($('#reviewBtn'), '生成中...', async () => {
    clientState.review = createLocalReview();
    saveLocal();
    renderAllFromClient();
    toast('周复盘已生成');
    api('/api/reviews', {method:'POST', body: JSON.stringify({})}).catch(() => {});
  });
});
$('#sampleBtn').addEventListener('click', async () => {
  await withBusy($('#sampleBtn'), '载入中...', async () => loadContentDecisionSample());
});

$('#refreshBtn').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(DEMO_DISABLED_KEY, '1');
  clientState = { diagnosis: null, plans: [], feedback: [], review: null };
  renderAllFromClient();
  toast('已清空本浏览器演示数据，可重新载入样例');
});
loadAll().catch(err=>toast(err.message));
