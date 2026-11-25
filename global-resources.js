const destinations = new Map([
  ['meta', {label: 'Meta Business Suite', href: 'https://business.facebook.com/'}],
  ['content', {label: 'Studio Nội Dung', page: 'content'}],
  ['analytics', {label: 'Hiệu Suất Marketing', page: 'analytics'}],
  ['inbox', {label: 'Chatbot AI', page: 'inbox'}],
  ['automation', {label: 'Báo Cáo Hóa Đơn', page: 'automation'}]
]);

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
  let key = '', resources = [], selectedGroup = '', editingId = '';

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
  }

  function save(next) {
    if (!key) return false;
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
      closeForm();
      render();
    }
  };
}
