const {app, BrowserWindow, Menu, Notification, ipcMain, session, shell, dialog, clipboard} = require('electron');
const path = require('node:path');
const {validateExpressVpnUrl, requestExpressVpnConnection} = require('./express-vpn.cjs');
const {workspaceUrl, workspacePage, metaPage, metaEntry, metaReturn, externalPage, vpnSettingsUrl, notificationPayload, desktopLink} = require('./policy.cjs');

const appId = 'vn.fbtq.workspace';
const partition = 'persist:fbtq-workspace';
const icon = path.join(__dirname, 'icon.png');
const notifications = new Set();
const notificationLimit = 5;
let window;
let recentTimes = [];
let expressVpnEndpoint = null;
let expressVpnBusy = false;
let pendingDesktopUrl = process.argv.map(desktopLink).find(Boolean);
let desktopReady = false;

app.setAppUserModelId(appId);
app.enableSandbox();

function focusWorkspace(url) {
  if (!window || window.isDestroyed()) createWindow(url);
  else if (url) window.webContents.loadURL(url).catch(() => {});
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function showNotification(title, body, destination) {
  if (!Notification.isSupported()) return false;
  if (notifications.size >= notificationLimit) notifications.values().next().value.close();
  const notification = new Notification({title, body, icon, silent: destination?.silent === true});
  notifications.add(notification);
  const release = () => notifications.delete(notification);
  notification.on('close', release);
  notification.on('failed', release);
  notification.on('click', () => {
    release();
    focusWorkspace();
    if (destination && workspacePage(window.webContents.getURL())) {
      window.webContents.send('fbtq:open-notification', destination);
    }
  });
  notification.show();
  return true;
}

function openExternal(url) {
  if (externalPage(url)) shell.openExternal(url).catch(() => {});
}

function createWindow(initialUrl = workspaceUrl) {
  window = new BrowserWindow({
    title: 'FBTQ Workspace', width: 1350, height: 880, minWidth: 430, minHeight: 580,
    backgroundColor: '#f2f6fc', icon, show: false,
    webPreferences: {
      partition, sandbox: true, contextIsolation: true, nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'), backgroundThrottling: false
    }
  });
  const currentWindow = window;
  const contents = currentWindow.webContents;
  let metaLoginExpiresAt = 0;
  function loadWorkspace() {
    contents.loadURL(initialUrl).catch(() => {});
  }
  function protectNavigation(event) {
    const {url, isMainFrame, isSameDocument} = event;
    if (!isMainFrame || isSameDocument || workspacePage(url)) return;
    if (metaEntry(url)) metaLoginExpiresAt = Date.now() + 600000;
    if (Date.now() < metaLoginExpiresAt) {
      if (metaPage(url)) return;
      const callback = metaReturn(url);
      if (callback) {
        event.preventDefault();
        contents.loadURL(callback).catch(() => {});
        return;
      }
    }
    event.preventDefault();
  }

  contents.on('did-navigate', (_, url) => {
    if (workspacePage(url)) metaLoginExpiresAt = 0;
  });
  contents.on('will-frame-navigate', protectNavigation);
  contents.on('will-redirect', protectNavigation);
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.setWindowOpenHandler(({url, disposition}) => {
    if (workspacePage(url)) {
      contents.loadURL(url).catch(() => {});
    } else if (['new-window', 'foreground-tab', 'background-tab'].includes(disposition)) {
      openExternal(url);
    }
    return {action: 'deny'};
  });
  contents.on('did-fail-load', (_, code, __, url, isMainFrame) => {
    if (code !== -3 && isMainFrame && workspacePage(url)) {
      contents.loadFile('offline.html').catch(() => {});
    }
  });
  currentWindow.once('ready-to-show', () => currentWindow.show());
  currentWindow.on('closed', () => {
    if (window === currentWindow) window = null;
    for (const notification of notifications) notification.close();
    notifications.clear();
  });
  loadWorkspace();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const target = desktopLink(url);
    if (!target) return;
    if (desktopReady) focusWorkspace(target);
    else pendingDesktopUrl = target;
  });
  app.on('second-instance', (_, args) => {
    const target = args.map(desktopLink).find(Boolean);
    if (desktopReady) focusWorkspace(target);
    else if (target) pendingDesktopUrl = target;
  });
  app.on('activate', () => {
    if (desktopReady) focusWorkspace();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.whenReady().then(() => {
    if (app.isPackaged && process.platform === 'win32') app.setAsDefaultProtocolClient('fbtq-workspace');
    const workspaceSession = session.fromPartition(partition);
    const allowedPermission = (permission, origin, mainFrame) => Boolean(mainFrame && workspacePage(origin)
      && ['clipboard-sanitized-write', 'fullscreen'].includes(permission));
    workspaceSession.setPermissionCheckHandler((_, permission, origin, details) => allowedPermission(permission, origin, details.isMainFrame));
    workspaceSession.setPermissionRequestHandler((_, permission, callback, details) => {
      callback(allowedPermission(permission, details.requestingUrl, details.isMainFrame));
    });
    const trustedWorkspace = event => event.sender === window?.webContents
      && event.senderFrame === event.sender.mainFrame && workspacePage(event.senderFrame?.url);
    ipcMain.handle('fbtq:open-vpn-settings', async event => {
      if (!trustedWorkspace(event)) return false;
      const target = vpnSettingsUrl(process.platform);
      if (!target) return false;
      try {
        await shell.openExternal(target);
        return true;
      } catch {
        return false;
      }
    });
    ipcMain.handle('fbtq:connect-express-vpn', async event => {
      if (!trustedWorkspace(event)) return 'unavailable';
      if (!expressVpnEndpoint) return 'setup';
      if (expressVpnBusy) return 'busy';
      expressVpnBusy = true;
      try {
        const decision = await dialog.showMessageBox(window, {
          type: 'question', title: 'FBTQ Workspace', message: 'Kết nối ExpressVPN?',
          detail: 'ExpressVPN sẽ kết nối bằng cấu hình hiện được chọn trong ứng dụng của nhà cung cấp.',
          buttons: ['Hủy', 'Kết nối'], defaultId: 0, cancelId: 0
        });
        if (decision.response !== 1 || !trustedWorkspace(event)) return 'cancelled';
        return await requestExpressVpnConnection(expressVpnEndpoint);
      } finally {
        expressVpnBusy = false;
      }
    });
    ipcMain.on('fbtq:notify', (event, data) => {
      if (!trustedWorkspace(event)) return;
      const destination = notificationPayload(data);
      if (!destination) return;
      const now = Date.now();
      recentTimes = recentTimes.filter(time => now - time < 10000);
      if (recentTimes.length >= 8) return;
      recentTimes.push(now);
      if (destination.kind === 'announcement') {
        showNotification('Thông báo nội bộ mới', 'Mở FBTQ Workspace để đọc thông báo.', destination);
      } else {
        showNotification('Tin nhắn Fanpage mới', 'Mở FBTQ Workspace để đọc tin nhắn.', destination);
      }
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label: 'FBTQ Workspace', submenu: [
        {label: 'Mở không gian làm việc', accelerator: 'CmdOrCtrl+Shift+R', click: () => {
          focusWorkspace();
          window.loadURL(workspaceUrl).catch(() => {});
        }},
        {label: 'Gửi thông báo thử', click: () => {
          if (!showNotification('FBTQ Workspace', 'Thông báo thử trên máy tính.')) {
            dialog.showMessageBox({message: 'Thiết bị hiện chưa hỗ trợ thông báo của ứng dụng.'});
          }
        }},
        {type: 'separator'},
        {label: 'Nhập địa chỉ ExpressVPN từ bộ nhớ tạm…', click: async () => {
          focusWorkspace();
          const decision = await dialog.showMessageBox(window, {
            type: 'question', title: 'Thiết lập ExpressVPN',
            message: 'Dùng địa chỉ MCP ExpressVPN đã sao chép?',
            detail: 'Sao chép địa chỉ trong ExpressVPN → Add-ons → MCP Server. FBTQ giữ địa chỉ trong phiên desktop hiện tại.',
            buttons: ['Hủy', 'Dùng địa chỉ'], defaultId: 0, cancelId: 0
          });
          if (decision.response !== 1) return;
          const endpoint = validateExpressVpnUrl(clipboard.readText());
          if (!endpoint) {
            return dialog.showMessageBox(window, {message: 'Địa chỉ MCP không hợp lệ. Hãy sao chép lại từ ứng dụng ExpressVPN.'});
          }
          expressVpnEndpoint = endpoint;
          await dialog.showMessageBox(window, {message: 'Đã nhập địa chỉ. Mở Tài Nguyên Global để kết nối ExpressVPN.'});
        }},
        {role: 'quit', label: 'Thoát'}
      ]},
      {label: 'Chỉnh sửa', role: 'editMenu'},
      {label: 'Cửa sổ', role: 'windowMenu'}
    ]));
    desktopReady = true;
    if (!window) createWindow(pendingDesktopUrl);
  });
}
