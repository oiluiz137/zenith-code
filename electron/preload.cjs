// Ponte mínima entre a janela e o app de desktop: só o que a interface precisa.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zenithDesktop", {
  isDesktop: true,
  platform: process.platform,
  pickFolder: (title) => ipcRenderer.invoke("zenith:pick-folder", title),
  openPath: (p) => ipcRenderer.invoke("zenith:open-path", p),
});
