// Preload — exposes a minimal bridge between the renderer (the web page) and
// the Electron main process. Runs in an isolated context, no Node in the page.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("boggl", {
  platform: process.platform,
  versions: process.versions,

  // Main → renderer (menu clicks, deep links, etc.)
  onMenu: (handler) => {
    ipcRenderer.on("menu-action", (_e, action) => handler(action));
  },

  // Renderer → main (timer state for Dock badge / notifications)
  send: (channel, payload) => {
    const allowed = new Set(["timer-state"]);
    if (allowed.has(channel)) ipcRenderer.send(channel, payload);
  },
});
