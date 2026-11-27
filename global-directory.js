export function initGlobalDirectory(rows, status) {
  let unsubscribe, generation = 0;
  function stop() {
    generation++;
    unsubscribe?.();
    unsubscribe = undefined;
    rows.replaceChildren();
    status.textContent = 'Đang tải danh sách…';
  }
  function start({user, firebase}) {
    stop();
    if (!user || !firebase) return;
    const {db, storeMod} = firebase;
    const run = generation;
    unsubscribe = storeMod.onSnapshot(storeMod.query(
      storeMod.collection(db, 'users', user.uid, 'globalDirectory'),
      storeMod.limit(200)
    ), snapshot => {
      if (run !== generation) return;
      const data = snapshot.docs.map(doc => doc.data()).sort((a,b) => a.title.localeCompare(b.title,'vi'));
      rows.replaceChildren(...data.map(item => {
        const row = document.createElement('tr');
        for (const value of [item.title, item.displayName, item.group, item.status]) {
          const cell = row.insertCell();
          cell.textContent = value || '—';
        }
        return row;
      }));
      status.textContent = data.length ? data.length + ' hồ sơ' : 'Chưa có danh sách đồng bộ từ Bàn Hồ Sơ.';
    }, () => {
      if (run !== generation) return;
      rows.replaceChildren();
      status.textContent = 'Chưa tải được danh sách. Kiểm tra kết nối hoặc quyền tài khoản.';
    });
  }
  return {start, stop};
}
export function desktopDownloadFor({platform = '', architecture = '', bitness = '', mobile = false, userAgent = ''}) {
  if (mobile || /Android|iPhone|iPad|iPod/i.test(userAgent)) return {platform: 'mobile'};
  const os = (platform || userAgent).toLowerCase();
  const arch = architecture.toLowerCase();
  if (os.includes('mac')) {
    if (arch === 'arm' || arch === 'arm64') return {platform: 'mac', build: 'mac-arm64'};
    if ((arch === 'x86' && bitness === '64') || arch === 'x64' || arch === 'x86_64') return {platform: 'mac', build: 'mac-x64'};
    return {platform: 'mac'};
  }
  if (os.includes('win')) {
    if ((arch && !['x86','x64','x86_64'].includes(arch)) || bitness === '32') return {platform: 'windows'};
    return {platform: 'windows', build: 'windows-x64'};
  }
  return {platform: 'other'};
}

export async function initGlobalDownload(section, browser = navigator) {
  const button = section.querySelector('#globalDesktopDownload');
  const versions = section.querySelector('#globalDesktopVersions');
  const status = section.querySelector('#globalDesktopPlatform');
  button.addEventListener('click', event => {
    if (button.hasAttribute('download')) return;
    event.preventDefault();
    versions.open = true;
    versions.querySelector('summary').focus();
  });
  const client = browser.userAgentData;
  const hints = await Promise.resolve().then(() => client?.getHighEntropyValues?.(['architecture','bitness'])).catch(() => undefined);
  const {platform, build} = desktopDownloadFor({
    platform: client?.platform || browser.platform,
    userAgent: browser.userAgent,
    mobile: client?.mobile || (browser.platform === 'MacIntel' && browser.maxTouchPoints > 1),
    ...hints
  });
  const version = build && section.querySelector('[data-global-download="' + build + '"]');
  if (version) {
    button.href = version.href;
    button.download = '';
    button.textContent = 'Tải Bàn Hồ Sơ cho ' + version.textContent;
    status.textContent = build === 'windows-x64' && !hints?.architecture
      ? 'Đã nhận biết Windows. Gói hiện có dành cho máy x64.'
      : 'Bản đề xuất cho máy này.';
    return;
  }
  status.textContent = {
    mac: 'Đã nhận biết macOS. Xem Chip hoặc Bộ xử lý trong menu Apple → Giới thiệu về máy Mac này, rồi chọn bản tương ứng.',
    windows: 'Đã nhận biết Windows. Gói hiện có dành cho máy x64. Hãy kiểm tra loại hệ thống trước khi tải.',
    mobile: 'Bàn Hồ Sơ là ứng dụng máy tính. Bạn có thể xem các gói dành cho Mac và Windows.',
    other: 'Chọn bản tải phù hợp với máy của bạn.'
  }[platform];
}

