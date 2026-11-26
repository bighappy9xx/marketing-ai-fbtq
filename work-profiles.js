const destinations = new Map([
  ['overview', 'Tổng Quan'], ['analytics', 'Hiệu Suất Marketing'],
  ['content', 'Studio Nội Dung'], ['inbox', 'Chatbot AI']
]);

export function initWorkProfiles({root, getSession, normalize}) {
  const find = name => root.querySelector('[data-profile-' + name + ']');
  const form = find('form'), rows = find('rows'), status = find('status');
  const search = find('search'), group = find('group'), add = find('new');
  const submit = form.querySelector('[type=submit]');
  const desktop = window.fbtqDesktop?.openWorkProfile;
  add.hidden = !desktop;
  let records = [], editing = '', pendingOpen = '', stopFeed, generation = 0, ready = false;

  function render() {
    const selected = group.value;
    const groups = [...new Set(records.map(item => item.group))].sort((a,b) => a.localeCompare(b,'vi'));
    group.replaceChildren(new Option('Tất cả nhóm',''), ...groups.map(value => new Option(value,value)));
    group.value = groups.includes(selected) ? selected : '';
    root.querySelector('datalist').replaceChildren(...groups.map(value => new Option(value)));
    const query = normalize(search.value);
    const visible = records.filter(item => (!group.value || item.group === group.value)
      && normalize(item.title + ' ' + item.group).includes(query));
    rows.replaceChildren(...visible.map(renderRow));
    add.disabled = !ready;
    status.textContent = ready ? visible.length + ' / ' + records.length + ' hồ sơ' : 'Đang tải hồ sơ…';
  }

  function action(label, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.textContent = label;
    button.addEventListener('click', callback);
    return button;
  }

  function renderRow(item) {
    const row = document.createElement('tr');
    for (const value of [item.title, item.group, destinations.get(item.destination)]) {
      const cell = row.insertCell();
      cell.textContent = value;
    }
    if (item.note) {
      const note = document.createElement('small');
      note.textContent = item.note;
      row.cells[0].append(note);
    }
    const controls = document.createElement('div');
    controls.className = 'work-profile-actions';
    if (window.fbtqDesktop?.openWorkProfile) {
      controls.append(action('Mở', () => open(item)));
      controls.append(action('Sửa', () => edit(item)));
      controls.append(action('Xóa', () => remove(item)));
    } else {
      const link = document.createElement('a');
      link.className = 'btn btn-secondary';
      link.href = 'fbtq-workspace://open/profile/' + item.id;
      link.textContent = 'Mở trên Desktop';
      controls.append(link);
    }
    row.insertCell().append(controls);
    return row;
  }

  async function open(item) {
    const run = generation;
    try {
      if (await window.fbtqDesktop?.openWorkProfile(item.id, item.destination)) return;
    } catch {}
    if (run === generation) status.textContent = 'Chưa mở được cửa sổ hồ sơ. Dùng FBTQ Desktop phiên bản mới.';
  }

  function requestOpen(id) {
    if (!window.fbtqDesktop?.openWorkProfile) {
      status.textContent = 'Dùng FBTQ Desktop phiên bản mới để mở hồ sơ.';
      return;
    }
    if (!ready) { pendingOpen = id; return; }
    const item = records.find(record => record.id === id);
    if (item) void open(item);
    else status.textContent = 'Hồ sơ không có trong tài khoản đang đăng nhập.';
  }

  function documentFor(id) {
    const {user,firebase} = getSession();
    return firebase.storeMod.doc(firebase.db,'users',user.uid,'workProfiles',id);
  }

  function edit(item) {
    editing = item?.id || '';
    form.reset();
    if (item) for (const key of ['title','group','destination','note']) form.elements.namedItem(key).value = item[key];
    form.hidden = false;
    form.elements.namedItem('title').focus();
  }

  async function remove(item) {
    if (!ready || !confirm('Xóa hồ sơ “' + item.title + '”?')) return;
    const run = generation;
    try {
      await getSession().firebase.storeMod.deleteDoc(documentFor(item.id));
      if (run === generation && item.id === editing) form.hidden = true;
    } catch {
      if (run === generation) status.textContent = 'Chưa xóa được hồ sơ.';
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || submit.disabled) return;
    const data = Object.fromEntries(new FormData(form));
    for (const key of ['title','group','note']) data[key] = data[key].trim();
    if (!data.title || !data.group || !destinations.has(data.destination)) {
      status.textContent = 'Điền tên hồ sơ, nhóm và mục mở.';
      return;
    }
    const run = generation;
    submit.disabled = true;
    try {
      const {storeMod} = getSession().firebase;
      const document = documentFor(editing || crypto.randomUUID());
      const payload = {...data,updatedAt:storeMod.serverTimestamp()};
      if (editing) await storeMod.updateDoc(document,payload);
      else await storeMod.setDoc(document,payload);
      if (run === generation) form.hidden = true;
    } catch {
      if (run === generation) status.textContent = 'Chưa lưu được hồ sơ.';
    } finally {
      if (run === generation) submit.disabled = false;
    }
  });

  add.addEventListener('click', () => edit());
  find('cancel').addEventListener('click', () => {form.hidden = true;});
  search.addEventListener('input', render);
  group.addEventListener('change', render);

  function stop() {
    generation++;
    stopFeed?.();
    stopFeed = undefined;
    records = [];
    pendingOpen = '';
    ready = false;
    editing = '';
    form.hidden = true;
    submit.disabled = false;
    search.value = '';
    render();
  }

  function start() {
    stop();
    const {user,firebase} = getSession();
    if (!user || !firebase) return;
    const run = generation;
    const {db,storeMod} = firebase;
    stopFeed = storeMod.onSnapshot(storeMod.collection(db,'users',user.uid,'workProfiles'), {includeMetadataChanges: true}, snapshot => {
      if (run !== generation) return;
      records = snapshot.docs.map(doc => ({...doc.data(),id:doc.id})).filter(item => destinations.has(item.destination));
      records.sort((a,b) => a.title.localeCompare(b.title,'vi'));
      ready = !snapshot.metadata.fromCache;
      render();
      if (ready && pendingOpen) {
        const id = pendingOpen;
        pendingOpen = '';
        requestOpen(id);
      }
    }, () => {
      if (run !== generation) return;
      records = [];
      ready = false;
      render();
      status.textContent = 'Không tải được hồ sơ. Kiểm tra kết nối và quyền tài khoản.';
    });
  }

  return {start,stop,requestOpen};
}
