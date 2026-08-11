const planGrid = document.querySelector('#commercialPlanGrid');
const planStatus = document.querySelector('#commercialPlanStatus');
const planMessage = document.querySelector('#commercialPlanMessage');
const checkout = document.querySelector('#billingCheckout');
const checkoutTitle = document.querySelector('#billingCheckoutTitle');
const checkoutAmount = document.querySelector('#billingCheckoutAmount');
const checkoutPeriod = document.querySelector('#billingCheckoutPeriod');
const checkoutResult = document.querySelector('#billingCheckoutResult');
const orderHistory = document.querySelector('#billingOrderHistory');
const orderList = document.querySelector('#billingOrderList');

const billingState = {
  plans: [],
  signedIn: false,
  entitlement: null,
  selectedPlan: null,
  interval: 'month',
  idempotencyKey: '',
};

const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));
const money = (value) => Number(value || 0).toLocaleString('zh-CN');
const orderRequestId = () => `checkout_${globalThis.crypto?.randomUUID?.().replaceAll('-', '') || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
const entitlementEndText = (entitlement = null) => {
  const date = new Date(entitlement?.access_ends_at || '');
  return Number.isNaN(date.getTime()) ? '' : `，权益有效至 ${date.toLocaleDateString('zh-CN', {timeZone:'Asia/Shanghai', month:'numeric', day:'numeric'})}`;
};
const planPrice = (plan) => plan.code === 'free'
  ? '<strong>免费</strong><span>先验证一个完整周期</span>'
  : `<strong>¥${money(plan.monthly_price_cny)}<small>/月</small></strong><span>年付 ¥${money(plan.yearly_price_cny)}</span>`;
const planAction = (plan, currentPlan = '') => {
  if (plan.code === 'free') return '<a class="customer-plan-action is-secondary" href="/#customerFormCard">开始免费使用</a>';
  if (plan.code === 'pro' && !plan.public_sales) return '<a class="customer-plan-action is-secondary" href="/contact">联系评估</a>';
  const label = currentPlan === plan.code ? `续费 ${plan.name}` : `选择 ${plan.name}`;
  return `<button class="customer-plan-action" type="button" data-plan-checkout="${esc(plan.code)}">${esc(label)}</button>`;
};
const renderPlans = (plans = [], currentPlan = '') => {
  planGrid.innerHTML = plans.map((plan) => `<article class="customer-plan-card${plan.code === 'plus' ? ' is-recommended' : ''}">
    <div class="customer-plan-card-head"><div><p>${esc(plan.name)}</p><h2>${esc(plan.audience)}</h2></div>${plan.code === currentPlan ? '<span>当前套餐</span>' : (plan.code === 'plus' ? '<span>推荐</span>' : '')}</div>
    <div class="customer-plan-price">${planPrice(plan)}</div>
    <ul>
      <li>${plan.code === 'free' ? `首次 ${Number(plan.trial_strategy_cycles || 0)} 轮策略周期` : `每月 ${Number(plan.strategy_cycles || 0)} 轮策略周期`}</li>
      <li>${plan.complete_content ? `每月 ${Number(plan.complete_content)} 份完整内容` : '内容计划与效果记录'}</li>
      <li>最多 ${Number(plan.active_projects || 0)} 个活跃项目</li>
      <li>每天最多生成 ${Number(plan.daily_generations || 0)} 次</li>
    </ul>
    ${planAction(plan, currentPlan)}
  </article>`).join('');
};
const selectedPrice = () => billingState.interval === 'year'
  ? Number(billingState.selectedPlan?.yearly_price_cny || 0)
  : Number(billingState.selectedPlan?.monthly_price_cny || 0);
const updateCheckout = () => {
  if (!billingState.selectedPlan) return;
  checkoutTitle.textContent = `${billingState.selectedPlan.name} 套餐`;
  checkoutAmount.textContent = `¥${money(selectedPrice())}`;
  checkoutPeriod.textContent = `${billingState.selectedPlan.name} · ${billingState.interval === 'year' ? '12 个月' : '1 个月'}`;
  checkout.querySelectorAll('[data-billing-interval]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.billingInterval === billingState.interval);
  });
};
const openCheckout = (planCode = '') => {
  const plan = billingState.plans.find((item) => item.code === planCode);
  if (!plan) return;
  if (!billingState.signedIn) {
    window.location.assign('/?account=login&next=/plans');
    return;
  }
  billingState.selectedPlan = plan;
  billingState.interval = 'month';
  billingState.idempotencyKey = orderRequestId();
  checkoutResult.hidden = true;
  checkoutResult.textContent = '';
  checkout.hidden = false;
  updateCheckout();
  checkout.scrollIntoView({behavior:'smooth', block:'center'});
};
const statusLabel = (status = '') => ({
  pending_payment: '等待付款确认',
  payment_creating: '正在创建支付',
  awaiting_payment: '等待支付宝付款',
  processing: '正在开通',
  paid: '已开通',
  canceled: '已取消',
  expired: '已过期',
  failed: '处理失败',
}[status] || '处理中');
const dateText = (value = '') => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', {timeZone:'Asia/Shanghai', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'});
};
const renderOrders = (orders = []) => {
  orderHistory.hidden = !billingState.signedIn;
  orderList.classList.toggle('empty', !orders.length);
  if (!orders.length) {
    orderList.textContent = '暂无订单。选择 Plus 套餐后，可以在这里查看处理状态。';
    return;
  }
  orderList.innerHTML = orders.map((order) => `<article class="billing-order-item" data-order-id="${esc(order.order_id)}">
    <div class="billing-order-item-head"><div><strong>${esc(order.plan_name)} · ${order.billing_interval === 'year' ? '年付' : '月付'}</strong><span>${esc(order.order_no)}</span></div><em class="is-${esc(order.status)}">${esc(statusLabel(order.status))}</em></div>
    <div class="billing-order-item-meta"><span>¥${money(order.amount_cny)}</span><span>${esc(dateText(order.created_at))}</span>${order.subscription_ends_at ? `<span>权益至 ${esc(dateText(order.subscription_ends_at))}</span>` : ''}</div>
    ${['pending_payment', 'awaiting_payment'].includes(order.status) ? `<p>${esc(order.payment?.instructions || '')}</p><div class="billing-order-actions">${order.payment_options?.includes('alipay') ? `<button type="button" class="is-primary" data-alipay-order="${esc(order.order_id)}">支付宝付款</button>` : ''}<button type="button" data-copy-order="${esc(order.order_no)}">复制订单号</button><a href="mailto:${esc(order.payment?.contact_email || 'contact@fpmatrix.cn')}?subject=${encodeURIComponent(`获客罗盘订单 ${order.order_no}`)}">联系人工</a>${order.status === 'pending_payment' ? `<button type="button" data-cancel-order="${esc(order.order_id)}">取消订单</button>` : ''}</div>` : ''}
  </article>`).join('');
};
const loadOrders = async () => {
  if (!billingState.signedIn) return renderOrders([]);
  try {
    const response = await fetch('/api/billing/orders', {headers:{accept:'application/json'}});
    if (!response.ok) throw new Error('订单读取失败');
    const data = await response.json();
    renderOrders(Array.isArray(data.orders) ? data.orders : []);
  } catch {
    orderList.classList.add('empty');
    orderList.textContent = '订单暂时无法读取，请稍后刷新。';
  }
};
const showCheckoutResult = (order = {}, message = '') => {
  checkoutResult.hidden = false;
  checkoutResult.innerHTML = `<strong>${esc(message || '订单已创建')}</strong><span>订单号 ${esc(order.order_no)}</span><p>${esc(order.payment?.instructions || '')}</p><div>${order.payment_options?.includes('alipay') ? `<button type="button" class="is-primary" data-alipay-order="${esc(order.order_id)}">支付宝付款</button>` : ''}<button type="button" data-copy-order="${esc(order.order_no)}">复制订单号</button><a href="mailto:${esc(order.payment?.contact_email || 'contact@fpmatrix.cn')}?subject=${encodeURIComponent(`获客罗盘订单 ${order.order_no}`)}">联系人工</a></div>`;
};
const paymentRequestId = (orderId = '') => `alipay_${String(orderId || '').replace(/[^a-z0-9]/gi, '').slice(-24)}_${Date.now().toString(36)}`;
const startAlipayPayment = async (orderId = '', trigger = null) => {
  if (!orderId) throw new Error('付款订单不存在，请重新创建订单。');
  if (trigger) {
    trigger.disabled = true;
    trigger.textContent = '正在打开支付宝...';
  }
  try {
    const response = await fetch(`/api/billing/orders/${encodeURIComponent(orderId)}/payment-intents`, {
      method: 'POST',
      headers: {'content-type':'application/json', accept:'application/json'},
      body: JSON.stringify({provider:'alipay', idempotency_key:paymentRequestId(orderId)}),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) return window.location.assign('/?account=login&next=/plans');
    if (!response.ok) throw new Error(data.error || '支付宝支付暂时无法打开');
    const actionUrl = String(data.payment?.client_action?.url || '');
    const parsed = new URL(actionUrl);
    if (parsed.protocol !== 'https:' || !/(^|\.)alipay(?:dev)?\.com$/i.test(parsed.hostname)) throw new Error('支付地址校验失败，请联系人工处理。');
    sessionStorage.setItem('pendingAlipayOrderId', orderId);
    window.location.assign(parsed.toString());
  } finally {
    if (trigger) {
      trigger.disabled = false;
      trigger.textContent = '支付宝付款';
    }
  }
};
const createOrder = async (button) => {
  if (!billingState.selectedPlan) return;
  button.disabled = true;
  button.textContent = '正在创建订单...';
  try {
    const response = await fetch('/api/billing/orders', {
      method: 'POST',
      headers: {'content-type':'application/json', accept:'application/json'},
      body: JSON.stringify({
        plan_code: billingState.selectedPlan.code,
        billing_interval: billingState.interval,
        idempotency_key: billingState.idempotencyKey,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) return window.location.assign('/?account=login&next=/plans');
    if (!response.ok) throw new Error(data.error || '订单创建失败');
    const order = data.order || {};
    showCheckoutResult(order, order.payment_options?.includes('alipay') ? '订单已创建，正在前往支付宝' : '订单已创建');
    await loadOrders();
    if (order.payment_options?.includes('alipay')) await startAlipayPayment(order.order_id, button);
  } catch (error) {
    checkoutResult.hidden = false;
    checkoutResult.textContent = error.message || '订单创建失败，请稍后重试。';
  } finally {
    button.disabled = false;
    button.textContent = '支付宝安全支付';
  }
};
const copyOrderNumber = async (orderNo = '') => {
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(orderNo);
  else {
    const input = document.createElement('textarea');
    input.value = orderNo;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }
  planMessage.textContent = '订单号已复制。';
  planMessage.hidden = false;
};
const cancelOrder = async (orderId = '') => {
  const response = await fetch(`/api/billing/orders/${encodeURIComponent(orderId)}/cancel`, {method:'POST', headers:{accept:'application/json'}});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '订单取消失败');
  billingState.idempotencyKey = orderRequestId();
  checkoutResult.hidden = true;
  await loadOrders();
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
    billingState.plans = Array.isArray(plans.plans) ? plans.plans : [];
    billingState.signedIn = session.signed_in === true;
    billingState.entitlement = null;
    if (billingState.signedIn) {
      const response = await fetch('/api/account/entitlements', {headers:{accept:'application/json'}});
      if (response.ok) billingState.entitlement = (await response.json()).entitlement;
    }
    renderPlans(billingState.plans, billingState.entitlement?.plan_code || session.account?.plan_code || '');
    planStatus.textContent = billingState.entitlement
      ? `当前 ${billingState.entitlement.plan_name}：本期已使用 ${Math.max(Number(billingState.entitlement.usage?.strategy_cycles_used || 0), Number(billingState.entitlement.usage?.strategy_cycles_reserved || 0))} / ${Number(billingState.entitlement.limits?.strategy_cycles || 0)} 轮策略周期${entitlementEndText(billingState.entitlement)}`
      : '未登录也可以先免费体验；登录后可创建订单、查看用量并跨设备找回项目。';
    await loadOrders();
  } catch {
    planStatus.textContent = '套餐信息暂时没有加载出来。';
    planMessage.textContent = '请稍后刷新重试，当前内容项目不会受影响。';
    planMessage.hidden = false;
  }
};

const resumeAlipayReturn = async () => {
  if (new URLSearchParams(window.location.search).get('payment') !== 'alipay') return;
  const orderId = sessionStorage.getItem('pendingAlipayOrderId') || '';
  planMessage.hidden = false;
  planMessage.textContent = '正在确认支付宝支付结果，请稍候...';
  if (!orderId) {
    planMessage.textContent = '已返回套餐页。支付结果会自动同步，可点击“刷新状态”查看。';
    return;
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`/api/billing/orders/${encodeURIComponent(orderId)}`, {headers:{accept:'application/json'}});
    const data = response.ok ? await response.json() : {};
    if (data.order?.status === 'paid') {
      sessionStorage.removeItem('pendingAlipayOrderId');
      planMessage.textContent = '支付成功，套餐权益已经开通。';
      await loadPlans();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1800));
  }
  planMessage.textContent = '支付结果仍在确认中，可稍后点击“刷新状态”。请勿重复付款。';
  await loadOrders();
};

planGrid?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-plan-checkout]');
  if (button) openCheckout(button.dataset.planCheckout);
});
checkout?.addEventListener('click', (event) => {
  const interval = event.target.closest('[data-billing-interval]');
  if (interval) {
    billingState.interval = interval.dataset.billingInterval;
    billingState.idempotencyKey = orderRequestId();
    checkoutResult.hidden = true;
    updateCheckout();
  }
  const copy = event.target.closest('[data-copy-order]');
  if (copy) copyOrderNumber(copy.dataset.copyOrder).catch(() => {});
  const alipay = event.target.closest('[data-alipay-order]');
  if (alipay) startAlipayPayment(alipay.dataset.alipayOrder, alipay).catch((error) => {
    checkoutResult.hidden = false;
    checkoutResult.textContent = error.message || '支付宝支付暂时无法打开，请稍后重试。';
  });
});
document.querySelector('#billingCheckoutClose')?.addEventListener('click', () => { checkout.hidden = true; });
document.querySelector('#billingCreateOrder')?.addEventListener('click', (event) => createOrder(event.currentTarget));
document.querySelector('#billingOrdersRefresh')?.addEventListener('click', loadOrders);
orderList?.addEventListener('click', (event) => {
  const copy = event.target.closest('[data-copy-order]');
  if (copy) copyOrderNumber(copy.dataset.copyOrder).catch(() => {});
  const alipay = event.target.closest('[data-alipay-order]');
  if (alipay) startAlipayPayment(alipay.dataset.alipayOrder, alipay).catch((error) => {
    planMessage.textContent = error.message || '支付宝支付暂时无法打开，请稍后重试。';
    planMessage.hidden = false;
  });
  const cancel = event.target.closest('[data-cancel-order]');
  if (cancel) cancelOrder(cancel.dataset.cancelOrder).catch((error) => {
    planMessage.textContent = error.message || '订单取消失败。';
    planMessage.hidden = false;
  });
});

loadPlans().then(resumeAlipayReturn);
