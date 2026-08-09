const inviteLoading = document.querySelector('#inviteLoading');
const inviteSignedOut = document.querySelector('#inviteSignedOut');
const inviteDashboard = document.querySelector('#inviteDashboard');
const inviteLink = document.querySelector('#inviteLink');
const inviteMessage = document.querySelector('#inviteMessage');

const showInviteMessage = (message = '', kind = 'success') => {
  inviteMessage.textContent = message;
  inviteMessage.classList.toggle('error', kind === 'error');
  inviteMessage.hidden = !message;
};

const copyText = async (text = '') => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    inviteLink.focus();
    inviteLink.select();
    document.execCommand('copy');
  }
};

const referralStatus = (record = {}) => {
  if (record.status === 'rewarded') return { label: '奖励已到账', className: 'is-rewarded' };
  if (record.status === 'reward_limit_reached') return { label: '已达本月上限', className: 'is-limited' };
  return { label: '等待好友完成首次生成', className: 'is-pending' };
};

const dateText = (value = '') => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '刚刚邀请' : date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' });
};

const renderInviteRecords = (records = []) => {
  const list = document.querySelector('#inviteRecordList');
  list.replaceChildren();
  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'customer-invite-empty';
    empty.textContent = '还没有邀请记录。复制专属链接，邀请第一位好友试用吧。';
    list.appendChild(empty);
    return;
  }
  records.forEach((record) => {
    const status = referralStatus(record);
    const row = document.createElement('div');
    row.className = 'customer-invite-record';
    const identity = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = record.friend_label || '好友';
    const time = document.createElement('small');
    time.textContent = dateText(record.created_at);
    identity.append(name, time);
    const badge = document.createElement('span');
    badge.className = status.className;
    badge.textContent = status.label;
    const reward = document.createElement('b');
    reward.textContent = record.status === 'rewarded' ? `+${Number(record.reward_days || 7)} 天` : '待生效';
    row.append(identity, badge, reward);
    list.appendChild(row);
  });
};

const renderInviteDashboard = (referral = {}) => {
  const code = String(referral.invite_code || '');
  const url = new URL('/', window.location.origin);
  url.searchParams.set('ref', code);
  inviteLink.value = url.toString();
  document.querySelector('#inviteCount').textContent = Number(referral.summary?.invited_count || 0);
  document.querySelector('#invitePending').textContent = Number(referral.summary?.pending_count || 0);
  document.querySelector('#inviteRewardDays').textContent = Number(referral.summary?.total_reward_days || 0);
  document.querySelector('#inviteMonthlyDays').textContent = Number(referral.summary?.monthly_reward_days || 0);
  renderInviteRecords(Array.isArray(referral.records) ? referral.records : []);
};

const loadInviteDashboard = async () => {
  try {
    const response = await fetch('/api/referrals/me', { headers: { accept: 'application/json' } });
    if (response.status === 401) {
      inviteLoading.hidden = true;
      inviteSignedOut.hidden = false;
      return;
    }
    if (!response.ok) throw new Error('invite_unavailable');
    const data = await response.json();
    renderInviteDashboard(data.referral || {});
    inviteLoading.hidden = true;
    inviteDashboard.hidden = false;
  } catch {
    inviteLoading.textContent = '邀请信息暂时没有加载出来，请稍后刷新重试。';
  }
};

document.querySelector('#inviteCopy')?.addEventListener('click', async () => {
  await copyText(inviteLink.value);
  showInviteMessage('专属邀请链接已复制');
});

document.querySelector('#inviteShare')?.addEventListener('click', async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: '获客罗盘',
        text: '填入真实业务信息，生成适合自己的内容增长建议。',
        url: inviteLink.value,
      });
      showInviteMessage('分享面板已打开');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await copyText(inviteLink.value);
  showInviteMessage('专属邀请链接已复制，可以发给好友了');
});

loadInviteDashboard();
