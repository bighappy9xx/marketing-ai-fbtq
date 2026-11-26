const {contextBridge, ipcRenderer} = require('electron');

if (process.isMainFrame && location.origin === 'https://mediafbtq-6e1bb.web.app') {
  contextBridge.exposeInMainWorld('fbtqDesktop', {
    openWorkProfile: (id, destination) => ipcRenderer.invoke('fbtq:open-work-profile', id, destination),
    closeWorkProfiles: () => ipcRenderer.send('fbtq:close-work-profiles'),
    notify: notification => ipcRenderer.send('fbtq:notify', notification),
    onOpenNotification: callback => {
      ipcRenderer.on('fbtq:open-notification', (_, notification) => callback(notification));
    }
  });
}
