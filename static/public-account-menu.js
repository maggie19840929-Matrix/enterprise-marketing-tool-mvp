(() => {
  const root = document.querySelector('[data-public-account-menu]');
  if (!root) return;

  const trigger = root.querySelector('#customerAccountBtn');
  if (!trigger) return;

  root.insertAdjacentHTML('beforeend', `
    <div class="customer-account-popover" role="menu" aria-label="账号菜单" hidden>
      <div class="customer-account-popover-head">
        <div><strong>我的账号</strong><span data-account-status>正在读取账号状态</span></div>
        <b data-account-plan>Free</b>
      </div>
      <button type="button" class="customer-account-menu-item" data-account-action="account" role="menuitem">
        <span><strong>我的账号</strong><small>项目与账号信息</small></span><i aria-hidden="true">›</i>
      </button>
      <a class="customer-account-menu-item" href="/plans" role="menuitem">
        <span><strong>剩余用量</strong><small>查看套餐与额度</small></span><em data-account-usage>读取中</em>
      </a>
      <button type="button" class="customer-account-menu-item" data-account-action="invite" role="menuitem">
        <span><strong>邀请好友</strong><small>分享获客罗盘</small></span><i aria-hidden="true">›</i>
      </button>
      <button type="button" class="customer-account-menu-item" data-account-action="settings" role="menuitem">
        <span><strong>设置</strong><small>隐私与个性化推荐</small></span><i aria-hidden="true">›</i>
      </button>
      <button type="button" class="customer-account-menu-item is-logout" data-account-action="logout" role="menuitem">退出登录</button>
    </div>
    <p class="customer-account-menu-toast" role="status" aria-live="polite" hidden></p>
  `);

  const popover = root.querySelector('.customer-account-popover');
  const label = trigger.querySelector('[data-public-account-label]');
  const status = root.querySelector('[data-account-status]');
  const plan = root.querySelector('[data-account-plan]');
  const usage = root.querySelector('[data-account-usage]');
  const menuToast = root.querySelector('.customer-account-menu-toast');
  const state = { loading: true, signedIn: false, account: null, entitlement: null };
  let toastTimer = 0;

  const planLabel = (code = 'free') => ({ free: 'Free', plus: 'Plus', pro: 'Pro' }[String(code || '').toLowerCase()] || 'Free');
  const usageLabel = (entitlement = null) => {
    if (!entitlement) return '查看';
    const used = Math.max(
      Number(entitlement.usage?.strategy_cycles_used || 0),
      Number(entitlement.usage?.strategy_cycles_reserved || 0),
    );
    const limit = Number(entitlement.limits?.strategy_cycles || 0);
    return `剩余 ${Math.max(0, limit - used)} / ${limit} 轮`;
  };
  const close = () => {
    popover.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };
  const showToast = (message = '') => {
    window.clearTimeout(toastTimer);
    menuToast.textContent = message;
    menuToast.hidden = !message;
    if (message) toastTimer = window.setTimeout(() => { menuToast.hidden = true; }, 2400);
  };
  const render = () => {
    root.classList.toggle('is-signed-in', state.signedIn);
    root.classList.toggle('is-loading', state.loading);
    trigger.disabled = state.loading;
    trigger.setAttribute('aria-haspopup', state.signedIn ? 'menu' : 'dialog');
    if (label) label.textContent = state.loading ? '账号' : (state.signedIn ? '我的账号' : '登录');
    if (status) status.textContent = state.signedIn ? '已登录，可跨设备找回项目' : '尚未登录';
    if (plan) plan.textContent = planLabel(state.entitlement?.plan_code || state.account?.plan_code);
    if (usage) usage.textContent = usageLabel(state.entitlement);
    if (!state.signedIn) close();
  };
  const requestHostAction = (name, fallbackUrl) => {
    const event = new CustomEvent(name, { cancelable: true });
    window.dispatchEvent(event);
    if (!event.defaultPrevented) window.location.assign(fallbackUrl);
  };
  const load = async () => {
    state.loading = true;
    render();
    try {
      const sessionResponse = await fetch('/api/auth/session', { headers: { accept: 'application/json' } });
      const session = sessionResponse.ok ? await sessionResponse.json() : {};
      state.signedIn = session.signed_in === true;
      state.account = session.account || null;
      state.entitlement = null;
      if (state.signedIn) {
        const entitlementResponse = await fetch('/api/account/entitlements', { headers: { accept: 'application/json' } });
        if (entitlementResponse.ok) state.entitlement = (await entitlementResponse.json()).entitlement || null;
      }
    } catch {
      state.signedIn = false;
      state.account = null;
      state.entitlement = null;
    } finally {
      state.loading = false;
      render();
    }
    return state;
  };
  const copyInviteLink = async () => {
    const inviteUrl = new URL('/', window.location.origin).href;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      const input = document.createElement('textarea');
      input.value = inviteUrl;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    close();
    showToast('邀请链接已复制');
  };
  const logout = async (button) => {
    button.disabled = true;
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error('logout_failed');
      state.signedIn = false;
      state.account = null;
      state.entitlement = null;
      render();
      showToast('已退出登录');
      window.dispatchEvent(new CustomEvent('public-account:logged-out'));
    } catch {
      showToast('暂时无法退出，请稍后再试');
    } finally {
      button.disabled = false;
    }
  };

  trigger.addEventListener('click', () => {
    if (state.loading) return;
    if (!state.signedIn) return requestHostAction('public-account:login-requested', '/?account=login');
    const opening = popover.hidden;
    popover.hidden = !opening;
    trigger.setAttribute('aria-expanded', String(opening));
  });
  popover.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-account-action]');
    if (!target) return;
    const action = target.dataset.accountAction;
    if (action === 'account') {
      close();
      requestHostAction('public-account:profile-requested', '/?account=profile');
    } else if (action === 'invite') {
      await copyInviteLink();
    } else if (action === 'settings') {
      close();
      requestHostAction('public-account:settings-requested', '/?account=settings');
    } else if (action === 'logout') {
      await logout(target);
    }
  });
  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !popover.hidden) {
      close();
      trigger.focus();
    }
  });
  window.addEventListener('customer-account:changed', load);
  window.publicAccountMenu = { refresh: load, close };
  render();
  load();
})();
