import {vnToday} from './assistant-session.js?v=20261125-overview';

const branchOf = user => user?.branch || user?.branchName || user?.branchId || '';
const roleLabels = {branch_manager: 'Quản lý chi nhánh', department_manager: 'Trưởng phòng'};
const formatTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short'
});
const timeOf = row => row.createdAt?.toMillis?.() ?? 0;

export function initDailyAnnouncements({root, getSession}) {
  const query = selector => root.querySelector(selector);
  const composer = query('[data-announcement-composer]');
  const form = composer.querySelector('form');
  const submit = form.querySelector('button');
  const todayList = query('[data-announcement-today]');
  const historyList = query('[data-announcement-history]');
  const historyDate = query('[data-announcement-date]');
  const more = query('[data-announcement-more]');
  const status = query('[data-announcement-status]');
  const formStatus = query('[data-announcement-form-status]');
  let subscriptions = [], results = [], errors = [], visible = 15, generation = 0;

  function renderList(container, rows, emptyLabel) {
    container.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = emptyLabel;
      container.append(empty);
      return;
    }
    for (const row of rows) {
      const item = document.createElement('article');
      const title = document.createElement('h3');
      const text = document.createElement('p');
      const author = document.createElement('small');
      title.textContent = row.title;
      text.textContent = row.message;
      author.textContent = [row.createdByName, roleLabels[row.authorRole], row.branch, row.department,
        timeOf(row) && formatTime.format(timeOf(row))].filter(Boolean).join(' · ');
      item.append(title, author, text);
      container.append(item);
    }
  }

  function render() {
    const rows = results.flat().sort((a, b) => timeOf(b) - timeOf(a));
    const todayKey = vnToday();
    const day = row => timeOf(row) ? vnToday(new Date(timeOf(row))) : todayKey;
    const today = rows.filter(row => day(row) === todayKey);
    const history = rows.filter(row => !historyDate.value || day(row) === historyDate.value);
    historyDate.max = todayKey;
    renderList(todayList, today, 'Chưa có thông báo hôm nay.');
    renderList(historyList, history.slice(0, visible), 'Chưa có thông báo trong khoảng đã chọn.');
    more.hidden = history.length <= visible;
    status.textContent = errors.some(Boolean) ? 'Có phần thông báo chưa tải được. Hãy thử tải lại trang.' : '';
  }

  function stop() {
    generation++;
    subscriptions.forEach(unsubscribe => unsubscribe());
    subscriptions = [];
    results = [];
    errors = [];
    visible = 15;
    composer.hidden = true;
    composer.open = query('[data-announcement-history-box]').open = false;
    historyDate.value = '';
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
    const canPublish = Boolean(branch && (role === 'branch_manager' || role === 'department_manager' && department));
    composer.hidden = !canPublish;
    query('[data-announcement-audience]').textContent = role === 'department_manager'
      ? `Người nhận: phòng ${department} · ${branch}` : `Người nhận: chi nhánh ${branch}`;
    const collection = storeMod.collection(db, 'workspaces', 'fbtq', 'dailyAnnouncements');
    const ownBranch = branch ? storeMod.where('branch', '==', branch) : null;
    let feeds = [];
    if (role === 'director') feeds = [collection];
    else if (role === 'branch_manager' && ownBranch) feeds = [storeMod.query(collection, ownBranch)];
    else if (ownBranch) feeds = [...new Set(['', department])].map(value =>
      storeMod.query(collection, ownBranch, storeMod.where('department', '==', value)));

    const session = generation;
    subscriptions = feeds.map((feed, index) => storeMod.onSnapshot(feed, snapshot => {
      if (session !== generation) return;
      results[index] = snapshot.docs.map(doc => doc.data());
      errors[index] = false;
      render();
    }, () => {
      if (session !== generation) return;
      results[index] = [];
      errors[index] = true;
      render();
    }));
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (composer.hidden || submit.disabled) return;
    const {user, role, firebase} = getSession();
    if (!user || !firebase) return;
    const {db, storeMod} = firebase;
    const title = form.elements.title.value.trim();
    const message = form.elements.message.value.trim();
    if (!title || !message) {
      formStatus.textContent = 'Nhập tiêu đề và nội dung quan trọng trước khi đăng.';
      return;
    }
    const session = generation;
    submit.disabled = true;
    formStatus.textContent = 'Đang đăng thông báo…';
    try {
      await storeMod.addDoc(storeMod.collection(db, 'workspaces', 'fbtq', 'dailyAnnouncements'), {
        createdBy: user.uid, createdByName: user.name, authorRole: role,
        branch: branchOf(user), department: role === 'department_manager' ? user.department : '',
        title, message, createdAt: storeMod.serverTimestamp()
      });
      if (session !== generation) return;
      form.reset();
      formStatus.textContent = 'Đã đăng thông báo.';
    } catch {
      if (session === generation) formStatus.textContent = 'Không đăng được thông báo. Hãy kiểm tra kết nối và quyền rồi thử lại.';
    } finally {
      if (session === generation) submit.disabled = false;
    }
  });
  historyDate.addEventListener('change', () => { visible = 15; render(); });
  more.addEventListener('click', () => { visible += 15; render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  return {start, stop};
}
