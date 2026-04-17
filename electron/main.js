// BogglTrack — macOS Electron shell.
// Wraps the production web app in a native window with macOS-feeling chrome.
// Keep this file plain CommonJS so electron-builder can run it without a TS step.

const { app, BrowserWindow, Menu, shell, globalShortcut, Notification, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const PROD_URL = process.env.BOGGLTRACK_URL || "https://boggl-track.vercel.app";
const IS_DEV = process.env.ELECTRON_IS_DEV === "1";

let mainWindow = null;
let isQuitting = false;

// ------------------------------------------------------------------
// Window-state persistence (size + position across launches)
// ------------------------------------------------------------------
function stateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return { width: 1280, height: 800, x: undefined, y: undefined };
  }
}
function saveState() {
  if (!mainWindow) return;
  try {
    const b = mainWindow.getBounds();
    fs.writeFileSync(
      stateFile(),
      JSON.stringify({ ...b, isFullScreen: mainWindow.isFullScreen() }, null, 2)
    );
  } catch {
    // best-effort
  }
}

// ------------------------------------------------------------------
// Window
// ------------------------------------------------------------------
function createWindow() {
  const s = loadState();

  mainWindow = new BrowserWindow({
    width: s.width ?? 1280,
    height: s.height ?? 800,
    x: s.x,
    y: s.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    vibrancy: "sidebar",
    visualEffectState: "active",
    backgroundColor: "#FAFAFA",
    show: false,
    title: "BogglTrack",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("resize", saveState);
  mainWindow.on("move", saveState);
  mainWindow.on("close", (e) => {
    saveState();
    if (process.platform === "darwin" && !isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // External links (reset-password emails, GitHub, etc.) open in default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(PROD_URL)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  const url = IS_DEV ? "http://localhost:3000" : PROD_URL;
  mainWindow.loadURL(url);
}

// ------------------------------------------------------------------
// Native application menu
// ------------------------------------------------------------------
function sendMenu(action) {
  mainWindow?.webContents.send("menu-action", action);
}

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { label: "Preferences…", accelerator: "Cmd+,", click: () => sendMenu("nav:/settings") },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        { label: "New Time Entry", accelerator: "CmdOrCtrl+N", click: () => sendMenu("new-entry") },
        { type: "separator" },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Dashboard", accelerator: "CmdOrCtrl+1", click: () => sendMenu("nav:/") },
        { label: "Timer",     accelerator: "CmdOrCtrl+2", click: () => sendMenu("nav:/timer") },
        { label: "Calendar",  accelerator: "CmdOrCtrl+3", click: () => sendMenu("nav:/calendar") },
        { label: "Tracking",  accelerator: "CmdOrCtrl+4", click: () => sendMenu("nav:/tracking") },
        { label: "Projects",  accelerator: "CmdOrCtrl+5", click: () => sendMenu("nav:/projects") },
        { type: "separator" },
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Timer",
      submenu: [
        { label: "Start / Stop Timer", accelerator: "CmdOrCtrl+T", click: () => sendMenu("toggle-timer") },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "BogglTrack Website", click: () => shell.openExternal(PROD_URL) },
        { label: "Report an Issue…", click: () => shell.openExternal("https://github.com/burhankhatri/BogglTrack/issues/new") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ------------------------------------------------------------------
// App lifecycle
// ------------------------------------------------------------------
app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: "BogglTrack",
    applicationVersion: app.getVersion(),
    copyright: `© ${new Date().getFullYear()} BogglTrack`,
    credits: "Time tracking & earnings for freelancers.",
  });

  createWindow();
  buildMenu();

  // Global shortcut — toggle timer from anywhere
  globalShortcut.register("CommandOrControl+Shift+T", () => sendMenu("toggle-timer"));
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

// IPC: renderer can send timer state to update Dock badge + notifications
let fourHourFired = false;
let eightHourFired = false;
ipcMain.on("timer-state", (_e, payload) => {
  if (!payload || typeof payload !== "object") return;
  const { running, label, elapsedSeconds } = payload;
  if (!running) {
    fourHourFired = false;
    eightHourFired = false;
    app.dock?.setBadge("");
    mainWindow?.setTitle("BogglTrack");
    return;
  }
  if (label) {
    app.dock?.setBadge(label);
    mainWindow?.setTitle(`${label} — BogglTrack`);
  }
  if (elapsedSeconds >= 14400 && !fourHourFired) {
    fourHourFired = true;
    new Notification({ title: "4 hours tracked", body: "Nice work. Take a break?" }).show();
  }
  if (elapsedSeconds >= 28800 && !eightHourFired) {
    eightHourFired = true;
    new Notification({ title: "Timer still running", body: "Did you forget to stop it?" }).show();
  }
});
