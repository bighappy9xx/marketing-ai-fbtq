const {contextBridge, ipcRenderer} = require('electron');

if (process.isMainFrame && location.origin === 'https://mediafbtq-6e1bb.web.app') {
  contextBridge.exposeInMainWorld('fbtqDesktop', {
    openVpnSettings: () => ipcRenderer.invoke('fbtq:open-vpn-settings'),
    connectExpressVpn: () => ipcRenderer.invoke('fbtq:connect-express-vpn'),
    notify: notification => ipcRenderer.send('fbtq:notify', notification),
    onOpenNotification: callback => {
      ipcRenderer.on('fbtq:open-notification', (_, notification) => callback(notification));
    }
  });
}
