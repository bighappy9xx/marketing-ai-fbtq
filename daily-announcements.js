const branchOf = user => user?.branch || user?.branchName || user?.branchId || '';
const formatTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short'
});
const timeOf = row => row.createdAt?.toMillis?.() ?? 0;
const expiresAt = row => timeOf(row) + (row.durationHours === 48 ? 48 : 24) * 3600000;

export function initDailyAnnouncements({root, getSession, setAvatarElement}) {
  const query = selector => root.querySelector(selector);
  const composer = query('[data-announcement-composer]');
  const writeButton = query('[data-announcement-write]');
  const form = composer.querySelector('form');
  const submit = form.querySelector('button');
  const activeList = query('[data-announcement-active]');
  const status = query('[data-announcement-status]');
  const formStatus = query('[data-announcement-form-status]');
  let subscriptions = [], results = [], errors = [], generation = 0, expiryTimer;

  function toggleComposer(open) {
    composer.hidden = !open;
    writeButton.setAttribute('aria-expanded', String(open));
    if (open) form.elements.message.focus();
  }

  function renderList(rows) {
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const item = document.createElement('article');
      const avatar = document.createElement('span');
      const text = document.createElement('p');
      const posted = document.createElement('time');
      const name = row.createdByName || 'Người đăng';
      const initials = name.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase();
      avatar.className = 'avatar avatar-blue announcement-avatar';
      avatar.title = name;
      avatar.setAttribute('role', 'img');
      avatar.setAttribute('aria-label', name);
      setAvatarElement(avatar, row.photoData, initials);
      text.textContent = [row.title, row.message].filter(Boolean).join('\n');
      posted.dateTime = new Date(timeOf(row)).toISOString();
      posted.textContent = formatTime.format(timeOf(row));
      item.append(avatar, text, posted);
      fragment.append(item);
    }
    activeList.replaceChildren(fragment);
  }

  function render() {
    clearTimeout(expiryTimer);
    const now = Date.now();
    const rows = results.flat().sort((a, b) => timeOf(b) - timeOf(a));
    const active = rows.filter(row => timeOf(row) && expiresAt(row) > now);
    activeList.hidden = !active.length;
    renderList(active);
    if (active.length) {
      const nextExpiry = active.reduce((next, row) => Math.min(next, expiresAt(row)), Infinity);
      expiryTimer = setTimeout(render, nextExpiry - now);
    }
    status.textContent = errors.some(Boolean) ? 'Có phần thông báo chưa tải được. Hãy thử tải lại trang.' : '';
  }

  function stop() {
    generation++;
    subscriptions.forEach(unsubscribe => unsubscribe());
    subscriptions = [];
    results = [];
    errors = [];
    writeButton.hidden = true;
    toggleComposer(false);
    form.reset();
    submit.disabled = false;
    formStatus.textContent = '';
    render();
  }

  function start() {
    stop();
    const {user, role, firebase} = getSession();
    if (!user || !firebase) return;
    const {db, storeMod} = firebase;
    const branch = branchOf(user);
    const department = user.department || '';
    const canPublish = role === 'director' || Boolean(branch && (role === 'branch_manager' || role === 'department_manager' && department));
    writeButton.hidden = !canPublish;
    const audience = role === 'director' ? 'toàn công ty' : role === 'department_manager'
      ? `phòng ${department} · ${branch}` : `chi nhánh ${branch}`;
    query('[data-announcement-audience]').textContent = 'Người nhận: ' + audience;
    const collection = storeMod.collection(db, 'workspaces', 'fbtq', 'dailyAnnouncements');
    const ownBranch = branch ? storeMod.where('branch', '==', branch) : null;
    const feeds = role === 'director' ? [collection] : [storeMod.query(collection,
      storeMod.where('branch', '==', ''), storeMod.where('department', '==', ''))];
    if (role === 'branch_manager' && ownBranch) feeds.push(storeMod.query(collection, ownBranch));
    else if (role !== 'director' && ownBranch) {
      for (const value of new Set(['', department])) {
        feeds.push(storeMod.query(collection, ownBranch, storeMod.where('department', '==', value)));
      }
    }

    const session = generation;
    subscriptions = feeds.map((feed, index) => storeMod.onSnapshot(feed, snapshot => {
      if (session !== generation) return;
      results[index] = snapshot.docs.map(doc => doc.data({serverTimestamps: 'estimate'}));
      errors[index] = false;
      render();
    }, () => {
      if (session !== generation) return;
      results[index] = [];
      errors[index] = true;
      render();
    }));
  }

  writeButton.addEventListener('click', () => {
    if (submit.disabled) return;
    formStatus.textContent = '';
    toggleComposer(composer.hidden);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (composer.hidden || submit.disabled) return;
    const {user, role, firebase} = getSession();
    if (!user || !firebase) return;
    const {db, storeMod} = firebase;
    const message = form.elements.message.value.trim();
    const durationHours = Number(form.elements.durationHours.value);
    if (!message) {
      formStatus.textContent = 'Nhập nội dung trước khi đăng.';
      return;
    }
    if (durationHours !== 24 && durationHours !== 48) {
      formStatus.textContent = 'Chọn thời hạn 24 giờ hoặc 48 giờ.';
      return;
    }
    const session = generation;
    submit.disabled = true;
    formStatus.textContent = 'Đang đăng thông báo…';
    try {
      const profile = (await storeMod.getDoc(storeMod.doc(db, 'users', user.uid))).data();
      if (session !== generation) return;
      const photoData = profile?.photoData || '';
      await storeMod.addDoc(storeMod.collection(db, 'workspaces', 'fbtq', 'dailyAnnouncements'), {
        createdBy: user.uid, createdByName: user.name, authorRole: role,
        branch: role === 'director' ? '' : branchOf(user),
        department: role === 'department_manager' ? user.department : '',
        message, photoData, durationHours, createdAt: storeMod.serverTimestamp()
      });
      if (session !== generation) return;
      form.reset();
      toggleComposer(false);
      writeButton.focus();
      formStatus.textContent = 'Đã đăng thông báo.';
    } catch {
      if (session === generation) formStatus.textContent = 'Không đăng được thông báo. Hãy kiểm tra kết nối và quyền rồi thử lại.';
    } finally {
      if (session === generation) submit.disabled = false;
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  return {start, stop};
}
