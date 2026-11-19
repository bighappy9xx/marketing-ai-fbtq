const limit = 300;
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();

export const faqMarkup = `
<section class="chatbot-faq" aria-labelledby="chatbotFaqHeading">
  <h4 id="chatbotFaqHeading">Kịch bản trả lời · FAQ</h4>
  <p>Mỗi FAQ đang bật là một kịch bản. Khi câu hỏi khớp, chế độ Kịch bản hoặc Kết hợp dùng câu trả lời đã lưu. Chế độ AI tham khảo FAQ phù hợp để diễn đạt tự nhiên. Bấm Lưu &amp; áp dụng để cập nhật.</p>
  <div class="chatbot-faq-toolbar">
    <input type="search" data-faq-search placeholder="Tìm câu hỏi hoặc câu trả lời" aria-label="Tìm FAQ">
    <select data-faq-sort aria-label="Sắp xếp FAQ"><option value="new">Mới nhất</option><option value="old">Cũ nhất</option></select>
    <button type="button" class="btn btn-secondary" data-faq-export>Xuất JSON</button>
    <button type="button" class="btn btn-secondary" data-faq-import>Nhập JSON</button>
    <input type="file" data-faq-file accept=".json,application/json" hidden>
    <button type="button" class="btn btn-primary" data-faq-add>+ Thêm FAQ</button>
  </div>
  <div class="chatbot-faq-toolbar"><span data-faq-count></span><button type="button" class="btn btn-secondary" data-faq-delete>Xóa mục đã chọn</button></div>
  <div class="chatbot-faq-table"><table><thead><tr><th><input type="checkbox" data-faq-select-all aria-label="Chọn tất cả FAQ đang hiển thị"></th><th>Câu hỏi</th><th>Trả lời</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody></tbody></table></div>
  <div class="chatbot-faq-editor" hidden>
    <label>Câu hỏi<textarea data-faq-question maxlength="240" rows="2"></textarea></label>
    <label>Trả lời<textarea data-faq-answer maxlength="1200" rows="3"></textarea></label>
    <div><button type="button" class="btn btn-primary" data-faq-apply>Lưu FAQ vào danh sách</button><button type="button" class="btn btn-secondary" data-faq-cancel>Hủy</button></div>
  </div>
  <p data-faq-status role="status"></p>
  <input type="hidden" name="faqChanges" value="">
</section>`;

export function bindFaqEditor(root, {faqs, faqRevision, esc}) {
  const find = selector => root.querySelector(selector);
  const rows = faqs.map(row => ({...row}));
  const selected = new Set();
  const editor = find('.chatbot-faq-editor');
  const question = find('[data-faq-question]');
  const answer = find('[data-faq-answer]');
  const status = find('[data-faq-status]');
  let editing = null;
  let visible = [];

  function render() {
    const query = normalize(find('[data-faq-search]').value);
    visible = rows.map((row, index) => ({row, index})).filter(({row}) => normalize(row.question + ' ' + row.answer).includes(query));
    if (find('[data-faq-sort]').value === 'new') visible.reverse();
    find('tbody').innerHTML = visible.map(({row, index}) => `
      <tr>
        <td><input type="checkbox" data-faq-select="${index}" aria-label="Chọn FAQ ${index + 1}" ${selected.has(index) ? 'checked' : ''}></td>
        <td>${esc(row.question)}</td><td>${esc(row.answer)}</td>
        <td><label><input type="checkbox" data-faq-enabled="${index}" ${row.enabled ? 'checked' : ''}>${row.enabled ? 'Đang bật' : 'Đã tắt'}</label></td>
        <td><button type="button" class="btn btn-secondary" data-faq-edit="${index}">Sửa</button></td>
      </tr>`).join('') || '<tr><td colspan="5">Không có FAQ phù hợp.</td></tr>';
    find('[data-faq-count]').textContent = `${rows.length} FAQ · ${selected.size} mục đã chọn`;
    find('[data-faq-delete]').disabled = !selected.size;
    const all = find('[data-faq-select-all]');
    const checked = visible.filter(item => selected.has(item.index)).length;
    all.checked = !!visible.length && checked === visible.length;
    all.indeterminate = checked > 0 && checked < visible.length;
  }
  function changed() {
    if (rows.some(row => !row.question || !row.answer)) return;
    find('[name=faqChanges]').value = JSON.stringify({faqs: rows, faqRevision});
    render();
  }
  function openEditor(index) {
    if (index < 0 && rows.length >= limit) {
      status.textContent = 'Đã đạt giới hạn 300 FAQ.';
      return;
    }
    editing = index;
    editor.hidden = false;
    question.value = rows[index]?.question || '';
    answer.value = rows[index]?.answer || '';
    question.focus();
  }
  function closeEditor() {
    editing = null;
    editor.hidden = true;
  }

  root.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('[data-faq-search]')) event.preventDefault();
  });
  find('[data-faq-search]').oninput = render;
  find('[data-faq-sort]').onchange = render;
  find('[data-faq-add]').onclick = () => openEditor(-1);
  find('[data-faq-cancel]').onclick = closeEditor;
  find('[data-faq-apply]').onclick = () => {
    if (editing === null) return;
    const row = {question: question.value.trim(), answer: answer.value.trim(), enabled: rows[editing]?.enabled ?? true};
    if (!row.question || !row.answer) {
      status.textContent = 'Nhập cả câu hỏi và câu trả lời.';
      return;
    }
    if (editing < 0) rows.push(row);
    else rows[editing] = row;
    closeEditor();
    status.textContent = '';
    changed();
  };
  find('tbody').onclick = event => {
    const button = event.target.closest('[data-faq-edit]');
    if (button) openEditor(Number(button.dataset.faqEdit));
  };
  find('tbody').onchange = ({target}) => {
    if (target.matches('[data-faq-enabled]')) {
      rows[Number(target.dataset.faqEnabled)].enabled = target.checked;
      changed();
    }
    if (target.matches('[data-faq-select]')) {
      const index = Number(target.dataset.faqSelect);
      if (target.checked) selected.add(index);
      else selected.delete(index);
      render();
    }
  };
  find('[data-faq-select-all]').onchange = ({target}) => {
    for (const {index} of visible) {
      if (target.checked) selected.add(index);
      else selected.delete(index);
    }
    render();
  };
  find('[data-faq-delete]').onclick = () => {
    for (const index of [...selected].sort((a, b) => b - a)) rows.splice(index, 1);
    selected.clear();
    closeEditor();
    changed();
  };
  const input = find('[data-faq-file]');
  find('[data-faq-import]').onclick = () => input.click();
  input.onchange = async () => {
    try {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 1000000) throw Error('Tệp JSON tối đa 1 MB.');
      const parsed = JSON.parse(await file.text());
      const imported = Array.isArray(parsed) ? parsed : parsed?.faqs;
      if (!Array.isArray(imported) || !imported.length) throw Error('Tệp cần chứa danh sách FAQ có question và answer.');
      if (rows.length + imported.length > limit) throw Error('Tổng số không được vượt quá 300 FAQ.');
      const clean = imported.map((item, index) => {
        const q = typeof item?.question === 'string' ? item.question.trim() : '';
        const a = typeof item?.answer === 'string' ? item.answer.trim() : '';
        if (!q || q.length > 240 || !a || a.length > 1200 || (item.enabled !== undefined && typeof item.enabled !== 'boolean')) throw Error('FAQ số ' + (index + 1) + ' không hợp lệ.');
        return {question: q, answer: a, enabled: item.enabled ?? true};
      });
      rows.push(...clean);
      status.textContent = `Đã thêm ${clean.length} FAQ vào danh sách. Bấm Lưu & áp dụng để lưu.`;
      changed();
    } catch (error) {
      status.textContent = error instanceof SyntaxError ? 'Tệp JSON không đúng định dạng.' : error.message;
    } finally {
      input.value = '';
    }
  };
  find('[data-faq-export]').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({faqs: rows}, null, 2)], {type:'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chatbot-faqs.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  render();
}
