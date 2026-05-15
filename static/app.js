const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'enterpriseMarketingMvpState.v2';

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

async function loadAll(){
  const local = loadLocal();
  if (local?.plans?.length || local?.diagnosis) {
    clientState = {...clientState, ...local};
  } else {
    // Netlify Functions are serverless and may expose stale demo memory from another invocation.
    // For the MVP demo, the browser's localStorage is the trusted session state.
    clientState = { diagnosis: null, plans: [], feedback: [], review: null };
  }
  renderAllFromClient();
}

function pct(n){ return `${Math.round((Number(n)||0)*100)}%`; }
function esc(v){ return String(v ?? '').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function num(v){ return Number(v || 0); }
function interactions(f){ return num(f.likes) + num(f.comments) + num(f.favorites) + num(f.shares); }
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
  let next_suggestion = '先执行：还没有发布反馈，优先完成第一条内容发布和数据回填。';
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
  ].map(([k,v])=>`<div class="card"><span>${k}</span><b>${v}</b></div>`).join('') +
  `<div class="card advice"><span>下一轮建议</span><b>${esc(d.next_suggestion)}</b></div>`;
}

function renderDiagnosis(d){
  if(!d){ $('#latestDiagnosis').innerHTML='暂无诊断，先提交一次营销体检。'; return; }
  const platformRecommendations = parsePlatformRecommendations(d.platform_recommendations);
  const platformModule = platformRecommendations ? `<div class="warning">
    <div class="small">平台发布建议</div>
    <p>${esc(platformRecommendations.strategy || '')}</p>
    ${renderPlatformGroup('优先平台', platformRecommendations.primary)}
    ${renderPlatformGroup('辅助平台', platformRecommendations.support)}
    ${renderPlatformGroup('暂不建议', platformRecommendations.avoid)}
  </div>` : '';
  $('#latestDiagnosis').innerHTML = `<div class="diagnosis-card">
    <div class="score"><span>营销闭环分</span><strong>${d.score}</strong><em>/100</em></div>
    <span class="badge">${esc(d.stage)}</span>
    <div><div class="small">优先问题</div><div class="big-action">${esc(d.priority_problem)}</div></div>
    <div><div class="small">诊断</div><p>${esc(d.insight)}</p></div>
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
    <td>${esc(p.cta || '')}</td>
    <td>${esc(p.target_metric)}</td>
    <td><span class="status">${esc(p.status)}</span></td>
    <td><button class="secondary" onclick="prefillFeedback(${p.id})">填反馈</button></td>
  </tr>`).join('') || '<tr><td colspan="9">暂无计划</td></tr>';
}

function renderFeedback(items){
  $('#feedbackList').innerHTML = items.map(f=>`<div class="list-item">
    <strong>计划 #${f.content_plan_id}</strong> · 曝光 ${f.views} · 互动 ${interactions(f)} · 咨询 ${f.consultations}
    ${f.publish_link ? `<div><a href="${esc(f.publish_link)}" target="_blank">查看发布链接</a></div>` : ''}
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
  const monday = new Date(day);
  monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
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
    week_start: monday.toISOString().slice(0, 10),
    week_end: sunday.toISOString().slice(0, 10),
    total_posts, total_views, total_interactions, total_consultations,
    winner_topic: winner?.topic || '', bottleneck, next_actions,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}

$('#assessmentForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
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

$('#feedbackForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = formData(e.target);
  ['content_plan_id','views','likes','comments','favorites','shares','consultations'].forEach(k=>data[k]=Number(data[k]||0));
  const plan = clientState.plans.find((item) => Number(item.id) === Number(data.content_plan_id));
  if (!plan) { toast('发布计划ID不存在，请先生成计划'); return; }
  const feedback = {
    id: Date.now(),
    ...data,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
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

$('#reviewBtn').addEventListener('click', async ()=>{
  clientState.review = createLocalReview();
  saveLocal();
  renderAllFromClient();
  toast('周复盘已生成');
  api('/api/reviews', {method:'POST', body: JSON.stringify({})}).catch(() => {});
});
$('#refreshBtn').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); loadAll().catch(err=>toast(err.message)); });
loadAll().catch(err=>toast(err.message));
