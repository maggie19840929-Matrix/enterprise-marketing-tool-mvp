const $ = (s) => document.querySelector(s);
const api = async (url, opts={}) => {
  const res = await fetch(url, {headers:{'Content-Type':'application/json'}, ...opts});
  const data = await res.json();
  if(!res.ok) throw new Error(data.error || '请求失败');
  return data;
};
const toast = (msg) => { const el=$('#toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2400); };
const formData = (form) => Object.fromEntries(new FormData(form).entries());

async function loadAll(){
  const [dash, diagnoses, plans, feedback, reviews] = await Promise.all([
    api('/api/dashboard'), api('/api/diagnoses'), api('/api/plans'), api('/api/feedback'), api('/api/reviews')
  ]);
  renderDashboard(dash);
  renderDiagnosis(diagnoses[0]);
  renderPlans(plans);
  renderFeedback(feedback);
  renderReview(reviews[0]);
}

function pct(n){ return `${Math.round((Number(n)||0)*100)}%`; }
function esc(v){ return String(v ?? '').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

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

function freshDashboard(plans){
  return {
    total_plans: plans.length,
    published_plans: 0,
    feedback_rate: 0,
    total_views: 0,
    total_interactions: 0,
    total_consultations: 0,
    next_suggestion: '先执行：还没有发布反馈，优先完成第一条内容发布和数据回填。'
  };
}

function renderDiagnosis(d){
  if(!d){ $('#latestDiagnosis').innerHTML='暂无诊断，先提交一次营销体检。'; return; }
  $('#latestDiagnosis').innerHTML = `<div class="diagnosis-card">
    <div class="score"><span>营销闭环分</span><strong>${d.score}</strong><em>/100</em></div>
    <span class="badge">${esc(d.stage)}</span>
    <div><div class="small">优先问题</div><div class="big-action">${esc(d.priority_problem)}</div></div>
    <div><div class="small">诊断</div><p>${esc(d.insight)}</p></div>
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
    <strong>计划 #${f.content_plan_id}</strong> · 曝光 ${f.views} · 互动 ${f.likes+f.comments+f.favorites+f.shares} · 咨询 ${f.consultations}
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

$('#assessmentForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const result = await api('/api/assessments', {method:'POST', body: JSON.stringify(formData(e.target))});
  e.target.reset();
  toast('已生成诊断和7天发布计划');
  renderDashboard(freshDashboard(result.plans));
  renderDiagnosis(result.diagnosis);
  renderPlans(result.plans);
  renderFeedback([]);
  renderReview(null);
});

$('#feedbackForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = formData(e.target);
  ['content_plan_id','views','likes','comments','favorites','shares','consultations'].forEach(k=>data[k]=Number(data[k]||0));
  await api('/api/feedback', {method:'POST', body: JSON.stringify(data)});
  e.target.reset();
  toast('反馈已保存，闭环看板已更新');
  loadAll();
});

$('#reviewBtn').addEventListener('click', async ()=>{
  await api('/api/reviews', {method:'POST', body: JSON.stringify({})});
  toast('周复盘已生成');
  loadAll();
});
$('#refreshBtn').addEventListener('click', loadAll);
loadAll().catch(err=>toast(err.message));
