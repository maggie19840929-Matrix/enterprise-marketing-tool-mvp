const planGrid = document.querySelector('#commercialPlanGrid');
const planStatus = document.querySelector('#commercialPlanStatus');
const planMessage = document.querySelector('#commercialPlanMessage');

const money = (value) => Number(value || 0).toLocaleString('zh-CN');
const entitlementEndText = (entitlement = null) => {
  const date = new Date(entitlement?.access_ends_at || '');
  return Number.isNaN(date.getTime()) ? '' : `，权益有效至 ${date.toLocaleDateString('zh-CN', {timeZone:'Asia/Shanghai', month:'numeric', day:'numeric'})}`;
};
const planAction = (plan) => {
  if (plan.code === 'free') return '<a class="customer-plan-action is-secondary" href="/#customerFormCard">开始免费使用</a>';
  if (plan.code === 'pro' && !plan.public_sales) return '<a class="customer-plan-action is-secondary" href="/contact">联系评估</a>';
  return '<a class="customer-plan-action" href="/contact">联系开通</a>';
};
const planPrice = (plan) => plan.code === 'free'
  ? '<strong>免费</strong><span>先验证一个完整周期</span>'
  : `<strong>¥${money(plan.monthly_price_cny)}<small>/月</small></strong><span>年付 ¥${money(plan.yearly_price_cny)}</span>`;
const renderPlans = (plans = [], currentPlan = '') => {
  planGrid.innerHTML = plans.map((plan) => `<article class="customer-plan-card${plan.code === 'plus' ? ' is-recommended' : ''}">
    <div class="customer-plan-card-head"><div><p>${plan.name}</p><h2>${plan.audience}</h2></div>${plan.code === currentPlan ? '<span>当前套餐</span>' : (plan.code === 'plus' ? '<span>推荐</span>' : '')}</div>
    <div class="customer-plan-price">${planPrice(plan)}</div>
    <ul>
      <li>${plan.code === 'free' ? `首次 ${plan.trial_strategy_cycles} 轮策略周期` : `每月 ${plan.strategy_cycles} 轮策略周期`}</li>
      <li>${plan.complete_content ? `每月 ${plan.complete_content} 份完整内容` : '内容计划与效果记录'}</li>
      <li>最多 ${plan.active_projects} 个活跃项目</li>
      <li>每天最多生成 ${plan.daily_generations} 次</li>
    </ul>
    ${planAction(plan)}
  </article>`).join('');
};
const loadPlans = async () => {
  try {
    const [plansResponse, sessionResponse] = await Promise.all([
      fetch('/api/commercial/plans', {headers:{accept:'application/json'}}),
      fetch('/api/auth/session', {headers:{accept:'application/json'}}),
    ]);
    if (!plansResponse.ok) throw new Error('套餐暂时无法读取');
    const plans = await plansResponse.json();
    const session = sessionResponse.ok ? await sessionResponse.json() : {};
    let entitlement = null;
    if (session.signed_in) {
      const response = await fetch('/api/account/entitlements', {headers:{accept:'application/json'}});
      if (response.ok) entitlement = (await response.json()).entitlement;
    }
    renderPlans(Array.isArray(plans.plans) ? plans.plans : [], entitlement?.plan_code || session.account?.plan_code || '');
    planStatus.textContent = entitlement
      ? `当前 ${entitlement.plan_name}：本期已使用 ${Math.max(Number(entitlement.usage?.strategy_cycles_used || 0), Number(entitlement.usage?.strategy_cycles_reserved || 0))} / ${Number(entitlement.limits?.strategy_cycles || 0)} 轮策略周期${entitlementEndText(entitlement)}`
      : '未登录也可以先免费体验；登录后可查看本期用量并跨设备找回项目。';
  } catch (error) {
    planStatus.textContent = '套餐信息暂时没有加载出来。';
    planMessage.textContent = '请稍后刷新重试，当前内容项目不会受影响。';
    planMessage.hidden = false;
  }
};

loadPlans();
