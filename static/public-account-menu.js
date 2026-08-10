(() => {
  const publicNavIcon = (name) => {
    const paths = {
      tool: '<circle cx="12" cy="12" r="9"></circle><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"></path>',
      method: '<path d="M2 5.5A3.5 3.5 0 0 1 5.5 2H11v18H5.5A3.5 3.5 0 0 0 2 23.5Z"></path><path d="M22 5.5A3.5 3.5 0 0 0 18.5 2H13v18h5.5a3.5 3.5 0 0 1 3.5 3.5Z"></path>',
      about: '<path d="M4 22V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v18"></path><path d="M9 22v-4h6v4"></path><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"></path>',
      account: '<circle cx="12" cy="8" r="4"></circle><path d="M4 22a8 8 0 0 1 16 0"></path>',
    };
    return `<svg class="public-nav-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.tool}</svg>`;
  };

  const initPublicNavigationState = () => {
    const navigationLinks = Array.from(document.querySelectorAll('.customer-site-nav .customer-site-links a[href]'));
    if (!navigationLinks.length) return;

    const normalizePath = (value = '/') => {
      const normalized = String(value || '/').replace(/\/+$/, '');
      return normalized || '/';
    };
    const currentPath = normalizePath(window.location.pathname);

    navigationLinks.forEach((link) => {
      const target = new URL(link.href, window.location.href);
      const targetPath = normalizePath(target.pathname);
      const iconName = targetPath === '/method' ? 'method' : (targetPath === '/about' ? 'about' : 'tool');
      if (!link.querySelector('.public-nav-icon')) link.insertAdjacentHTML('afterbegin', publicNavIcon(iconName));
      if (target.origin === window.location.origin && targetPath === currentPath) {
        link.setAttribute('aria-current', 'page');
      } else if (link.getAttribute('aria-current') === 'page') {
        link.removeAttribute('aria-current');
      }
    });
  };

  initPublicNavigationState();

  const referralStorageKey = 'fpReferralCode.v1';
  const referralCodeFromUrl = new URLSearchParams(window.location.search).get('ref') || '';
  if (/^[a-z0-9_-]{12,64}$/i.test(referralCodeFromUrl)) {
    try {
      localStorage.setItem(referralStorageKey, JSON.stringify({ code: referralCodeFromUrl, saved_at: new Date().toISOString() }));
    } catch {}
  }
  const root = document.querySelector('[data-public-account-menu]');
  if (!root) return;

  const trigger = root.querySelector('#customerAccountBtn');
  if (!trigger) return;
  if (!trigger.querySelector('.public-nav-icon')) trigger.insertAdjacentHTML('afterbegin', publicNavIcon('account'));

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
      close();
      window.location.assign('/invite');
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
