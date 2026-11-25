const {contextBridge, ipcRenderer} = require('electron');

if (process.isMainFrame && location.origin === 'https://mediafbtq-6e1bb.web.app') {
  contextBridge.exposeInMainWorld('fbtqDesktop', {
    importResourceBackup: () => ipcRenderer.invoke('fbtq:import-resource-backup'),
    exportResourceBackup: content => ipcRenderer.invoke('fbtq:export-resource-backup', content),
    openVpnSettings: () => ipcRenderer.invoke('fbtq:open-vpn-settings'),
    connectExpressVpn: () => ipcRenderer.invoke('fbtq:connect-express-vpn'),
    notify: notification => ipcRenderer.send('fbtq:notify', notification),
    onOpenNotification: callback => {
      ipcRenderer.on('fbtq:open-notification', (_, notification) => callback(notification));
    }
  });
}
