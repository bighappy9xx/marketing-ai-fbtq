const destinations = new Map([
  ['meta', {label: 'Meta Business Suite', href: 'https://business.facebook.com/'}],
  ['content', {label: 'Studio Nội Dung', page: 'content'}],
  ['analytics', {label: 'Hiệu Suất Marketing', page: 'analytics'}],
  ['inbox', {label: 'Chatbot AI', page: 'inbox'}],
  ['automation', {label: 'Báo Cáo Hóa Đơn', page: 'automation'}]
]);
const maxBackupBytes = 256 * 1024;
const maxResources = 300;

export function readResourceBackup(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > maxBackupBytes) throw new Error('Bản sao quá lớn.');
  const data = JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (data?.format !== 'fbtq-global-resources' || data.version !== 1 ||
      !Array.isArray(data.resources) || data.resources.length > maxResources) throw new Error('Định dạng bản sao FBTQ không hợp lệ.');
  return data.resources.map(item => {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const group = typeof item?.group === 'string' ? item.group.trim() : '';
    if (!name || name.length > 100 || !group || group.length > 60 || !destinations.has(item.destination)) {
      throw new Error('Bản sao chứa tài nguyên không hợp lệ.');
    }
    return {name, group, destination: item.destination};
  });
}

export function initGlobalResources({root, normalize, onNavigate}) {
  const get = id => root.querySelector('#' + id);
  const nav = get('globalResourceGroups');
  const search = get('globalResourceSearch');
  const form = get('globalResourceForm');
  const fields = form.elements;
  const add = get('globalResourceAdd');
  const options = get('globalGroupOptions');
  const table = get('globalResourceTable');
  const rows = get('globalResourceRows');
  const status = get('globalResourceStatus');
  const empty = get('globalResourceEmpty');
  const backup = get('globalResourceBackup');
  const exportButton = get('globalResourceExport');
  const importButton = get('globalResourceImport');
  const fileInput = get('globalResourceFile');
  const desktop = window.fbtqDesktop;
  let key = '', resources = [], selectedGroup = '', editingId = '';

  function showBackup() {
    backup.open = true;
    backup.querySelector('summary').focus();
  }
  if (desktop?.importResourceBackup) {
    get('globalDesktopBackup').addEventListener('click', event => {
      event.preventDefault();
      showBackup();
    });
  }

  fields.destination.replaceChildren(...Array.from(destinations, ([id, {label}]) => new Option(label, id)));

  function textCell(value) {
    const cell = document.createElement('td');
    cell.textContent = value;
    return cell;
  }

  function button(label, action, className = 'btn btn-secondary') {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = label;
    element.addEventListener('click', action);
    return element;
  }

  function render() {
    const groups = [...new Set(resources.map(item => item.group))].sort((a, b) => a.localeCompare(b, 'vi'));
    if (selectedGroup && !groups.includes(selectedGroup)) selectedGroup = '';
    nav.replaceChildren(...['', ...groups].map(group => {
      const filter = button(group || 'Tất cả', () => {
        selectedGroup = group;
        render();
        [...nav.children].find(element => element.getAttribute('aria-pressed') === 'true')?.focus();
      }, '');
      filter.setAttribute('aria-pressed', String(group === selectedGroup));
      return filter;
    }));
    options.replaceChildren(...groups.map(group => new Option(group, group)));

    const query = normalize(search.value);
    const visible = resources.filter(item =>
      (!selectedGroup || item.group === selectedGroup) &&
      normalize([item.name, item.group, destinations.get(item.destination).label].join(' ')).includes(query));
    rows.replaceChildren(...visible.map(item => {
      const destination = destinations.get(item.destination);
      const row = document.createElement('tr');
      const controls = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'global-resource-actions';
      const open = destination.href ? document.createElement('a') : button('Mở', () => onNavigate(destination.page));
      if (destination.href) {
        open.className = 'btn btn-secondary';
        open.href = destination.href;
        open.target = '_blank';
        open.rel = 'noopener noreferrer';
        open.textContent = 'Mở';
      }
      actions.append(open, button('Sửa', () => openForm(item)), button('Xóa', () => {
        if (!window.confirm('Xóa tài nguyên “' + item.name + '”?')) return;
        if (save(resources.filter(entry => entry.id !== item.id)) && editingId === item.id) closeForm();
      }));
      controls.append(actions);
      row.append(textCell(item.name), textCell(item.group), textCell(destination.label), controls);
      return row;
    }));
    table.hidden = !visible.length;
    empty.hidden = Boolean(visible.length);
    empty.textContent = resources.length ? 'Không tìm thấy tài nguyên phù hợp.' : 'Chưa có tài nguyên. Bấm Thêm tài nguyên để bắt đầu.';
    status.textContent = visible.length + ' / ' + resources.length + ' tài nguyên';
    exportButton.disabled = resources.length === 0;
  }

  function save(next) {
    if (!key) return false;
    if (next.length > maxResources) {
      status.textContent = 'Danh sách có thể lưu tối đa ' + maxResources + ' tài nguyên.';
      return false;
    }
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      status.textContent = 'Chưa lưu được danh sách trên thiết bị này.';
      return false;
    }
    resources = next;
    render();
    return true;
  }

  function closeForm() {
    form.reset();
    form.hidden = true;
    editingId = '';
  }

  function openForm(item) {
    editingId = item?.id || '';
    fields.resourceName.value = item?.name || '';
    fields.group.value = item?.group || selectedGroup;
    fields.destination.value = item?.destination || destinations.keys().next().value;
    form.hidden = false;
    fields.resourceName.focus();
  }

  add.addEventListener('click', () => openForm());
  get('globalResourceCancel').addEventListener('click', () => {closeForm(); add.focus();});
  search.addEventListener('input', render);
  exportButton.addEventListener('click', async () => {
    if (!key || !resources.length) return;
    const account = key;
    const raw = JSON.stringify({format: 'fbtq-global-resources', version: 1, resources: resources.map(({name, group, destination}) => ({name, group, destination}))}, null, 2);
    try {
      if (desktop?.exportResourceBackup) {
        if (await desktop.exportResourceBackup(raw) && account === key) status.textContent = 'Đã lưu bản sao JSON.';
      } else {
        const url = URL.createObjectURL(new Blob([raw], {type: 'application/json'}));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'FBTQ-Tai-Nguyen-Global.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      if (account === key) status.textContent = 'Không thể lưu bản sao JSON.';
    }
  });
  function mergeBackup(raw) {
    const signature = item => JSON.stringify([item.name, item.group, item.destination]);
    const seen = new Set(resources.map(signature));
    const added = [];
    for (const item of readResourceBackup(raw)) {
      const id = signature(item);
      if (seen.has(id)) continue;
      seen.add(id);
      added.push({...item, id: crypto.randomUUID()});
    }
    if (save([...resources, ...added])) {
      selectedGroup = '';
      search.value = '';
      render();
      status.textContent = 'Đã nhập ' + added.length + ' tài nguyên mới.';
    }
  }
  async function importBackup(read) {
    if (!key || importButton.disabled) return;
    const account = key;
    importButton.disabled = true;
    try {
      const raw = await read();
      if (account === key && raw !== null) mergeBackup(raw);
    } catch {
      if (account === key) status.textContent = 'Không đọc được bản sao. Hãy chọn tệp JSON đã xuất từ FBTQ (tối đa 256 KB).';
    } finally {
      importButton.disabled = false;
    }
  }
  importButton.addEventListener('click', () => {
    if (desktop?.importResourceBackup) void importBackup(() => desktop.importResourceBackup());
    else fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (file) void importBackup(() => {
      if (file.size > maxBackupBytes) throw new Error('Bản sao quá lớn.');
      return file.text();
    });
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = fields.resourceName.value.trim();
    const group = fields.group.value.trim();
    const destination = fields.destination.value;
    if (!name || !group || !destinations.has(destination)) {
      status.textContent = 'Điền tên, nhóm và điểm đến hợp lệ.';
      return;
    }
    const item = {id: editingId || crypto.randomUUID(), name, group, destination};
    const next = editingId ? resources.map(entry => entry.id === editingId ? item : entry) : [...resources, item];
    if (save(next)) {
      selectedGroup = group;
      search.value = '';
      closeForm();
      render();
      add.focus();
    }
  });

  return {
    showBackup,
    useAccount(uid) {
      const nextKey = uid ? 'fbtq_global_resources_v1_' + uid : '';
      if (nextKey === key) return;
      key = nextKey;
      resources = [];
      if (key) {
        try {
          const stored = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(stored)) resources = stored.filter(item =>
            item && typeof item.id === 'string' && typeof item.name === 'string' &&
            typeof item.group === 'string' && destinations.has(item.destination));
        } catch {}
      }
      selectedGroup = '';
      search.value = '';
      backup.open = false;
      closeForm();
      render();
    }
  };
}
