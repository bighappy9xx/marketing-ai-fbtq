const branchOf = user => user?.branch || user?.branchName || user?.branchId || '';
const formatTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short'
});
const timeOf = row => row.createdAt?.toMillis?.() ?? 0;
const expiresAt = row => timeOf(row) + (row.durationHours === 48 ? 48 : 24) * 3600000;

export function initDailyAnnouncements({root, getSession, setAvatarElement, getTeams, getSelectedTeam, onNewAnnouncement}) {
  const query = selector => root.querySelector(selector);
  const composer = query('[data-announcement-composer]');
  const writeButton = query('[data-announcement-write]');
  const form = composer.querySelector('form');
  const submit = form.querySelector('button');
  const audienceSelect = form.elements.audience;
  const activeList = query('[data-announcement-active]');
  const status = query('[data-announcement-status]');
  const formStatus = query('[data-announcement-form-status]');
  let subscriptions = [], results = [], errors = [], generation = 0, expiryTimer;
  let audiences = new Map();

  function refreshAudiences(preferred = audienceSelect.value) {
    if (writeButton.hidden) return;
    const {user, role} = getSession();
    const branch = branchOf(user);
    const options = [];
    if (role === 'director') {
      options.push({key: 'company', label: 'Toàn công ty', branch: '', department: ''});
    } else if (role === 'branch_manager') {
      options.push({key: 'branch', label: 'Chi nhánh ' + branch, branch, department: ''});
    }
    if (role === 'department_manager') {
      options.push({key: 'department', label: 'Nhóm ' + user.department, branch, department: user.department});
    } else {
      for (const team of getTeams()) {
        if (!team.branch || role === 'branch_manager' && team.branch !== branch) continue;
        options.push({...team, label: 'Nhóm ' + team.label});
      }
    }
    audiences = new Map(options.map(option => [option.key, option]));
    audienceSelect.replaceChildren(...options.map(({label, key}) => new Option(label, key)));
    if (audiences.has(preferred)) audienceSelect.value = preferred;
  }

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
    audiences.clear();
    audienceSelect.replaceChildren();
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
    refreshAudiences();
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
    const seen = new Set();
    subscriptions = feeds.map((feed, index) => {
      let ready = false;
      return storeMod.onSnapshot(feed, {includeMetadataChanges: Boolean(onNewAnnouncement)}, snapshot => {
        if (session !== generation) return;
        results[index] = snapshot.docs.map(doc => doc.data({serverTimestamps: 'estimate'}));
        if (onNewAnnouncement && !snapshot.metadata.fromCache) {
          const now = Date.now();
          snapshot.docs.forEach((doc, position) => {
            if (doc.metadata.hasPendingWrites || seen.has(doc.id)) return;
            seen.add(doc.id);
            const row = results[index][position];
            const at = timeOf(row);
            if (ready && row.createdBy !== user.uid && at > now - 120000 && at <= now + 5000) {
              onNewAnnouncement(user.uid);
            }
          });
          ready = true;
        }
        errors[index] = false;
        render();
      }, () => {
        if (session !== generation) return;
        results[index] = [];
        errors[index] = true;
        render();
      });
    });
  }

  writeButton.addEventListener('click', () => {
    if (submit.disabled) return;
    formStatus.textContent = '';
    if (composer.hidden) refreshAudiences(getSelectedTeam());
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
    const audience = audiences.get(audienceSelect.value);
    if (!audience) {
      formStatus.textContent = 'Chọn nhóm người nhận trước khi đăng.';
      return;
    }
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
        branch: audience.branch, department: audience.department,
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
  return {start, stop, refreshAudiences};
}
