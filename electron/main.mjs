// Zenith Code — app de desktop (Electron).
// A janela é nativa e o servidor roda num processo filho gerenciado pelo próprio app (utilityProcess):
// nasce e morre com o programa, usa uma porta livre escolhida na hora e só aceita pedidos com a senha da sessão.
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, session, shell, utilityProcess } from "electron";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXE_DIR = path.dirname(process.execPath);
const PORTABLE = app.isPackaged && fs.existsSync(path.join(EXE_DIR, "portable.txt"));
const LOCAL = process.env.LOCALAPPDATA ?? path.join(app.getPath("home"), "AppData", "Local");
const HOME = process.env.ZENITH_HOME ?? (PORTABLE ? path.join(EXE_DIR, "data") : path.join(LOCAL, "Zenith Code"));
const LOGS = path.join(HOME, "logs");
fs.mkdirSync(LOGS, { recursive: true });
// O perfil do Chromium (cache, armazenamento local) fica junto dos dados do Zenith.
app.setPath("userData", path.join(HOME, "janela"));
app.setAppUserModelId("Zenith.Code");
app.setName("Zenith Code");

const TOKEN = randomBytes(24).toString("hex");
const ICON = path.join(APP_DIR, "electron", "zenith.ico");
let server = null;
let serverPort = 0;
let win = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(start);
}

function log(line) {
  fs.appendFileSync(path.join(LOGS, "server.log"), line.endsWith("\n") ? line : line + "\n");
}

function startServer() {
  return new Promise((resolve, reject) => {
    const entry = path.join(APP_DIR, "dist-server", "index.mjs");
    if (!fs.existsSync(entry)) return reject(new Error(`Servidor não encontrado: ${entry}. Rode "npm run build:server".`));
    log(`---- ${new Date().toISOString()} iniciando`);
    server = utilityProcess.fork(entry, [], {
      cwd: APP_DIR,
      serviceName: "Zenith Code (servidor)",
      stdio: "pipe",
      env: { ...process.env, ZENITH_HOME: HOME, ZENITH_PORT: "0", ZENITH_TOKEN: TOKEN, ZENITH_APP_ROOT: APP_DIR, NODE_NO_WARNINGS: "1" },
    });
    server.stdout?.on("data", (d) => log(String(d)));
    server.stderr?.on("data", (d) => log(String(d)));
    const timer = setTimeout(() => reject(new Error("O servidor demorou demais para iniciar.")), 60_000);
    server.on("message", (m) => {
      if (m && m.type === "ready") {
        clearTimeout(timer);
        serverPort = m.port;
        resolve(m.port);
      }
    });
    server.on("exit", (code) => {
      clearTimeout(timer);
      log(`servidor encerrado (código ${code})`);
      server = null;
      if (!quitting && serverPort) onServerCrash(code);
      else reject(new Error(`O servidor parou ao iniciar (código ${code}).`));
    });
  });
}

async function onServerCrash(code) {
  serverPort = 0;
  const r = await dialog.showMessageBox(win ?? undefined, {
    type: "error",
    title: "Zenith Code",
    message: "O servidor interno do Zenith parou.",
    detail: `Código ${code}. O registro está em:\n${path.join(LOGS, "server.log")}`,
    buttons: ["Reiniciar", "Fechar"],
    defaultId: 0,
  });
  if (r.response === 0) {
    try {
      const port = await startServer();
      win?.loadURL(`http://127.0.0.1:${port}/`);
    } catch (e) {
      dialog.showErrorBox("Zenith Code", String(e.message ?? e));
      app.quit();
    }
  } else app.quit();
}

const LOADING = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#262624;color:#a3a097;font:15px 'Segoe UI',sans-serif">
<div style="text-align:center"><svg width="44" height="44" viewBox="0 0 32 32"><path d="M16 2c1 7 3.5 11 14 14-10.5 3-13 7-14 14-1-7-3.5-11-14-14C12.5 13 15 9 16 2z" fill="#d97757"/><circle cx="16" cy="16" r="2.4" fill="#262624"/></svg>
<div style="margin-top:14px;color:#f2f0e9;font-size:18px">Zenith Code</div><div style="margin-top:6px">Iniciando…</div></div></body></html>`)}`;

async function start() {
  nativeTheme.themeSource = "dark";

  // A senha da sessão vai em todo pedido da janela para o servidor local.
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["http://127.0.0.1/*", "http://127.0.0.1:*/*"] }, (details, cb) => {
    details.requestHeaders["x-zenith-token"] = TOKEN;
    cb({ requestHeaders: details.requestHeaders });
  });

  ipcMain.handle("zenith:pick-folder", async (_e, title) => {
    const r = await dialog.showOpenDialog(win, { title: title || "Escolha a pasta de trabalho", properties: ["openDirectory", "createDirectory"] });
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0];
  });
  ipcMain.handle("zenith:open-path", (_e, p) => shell.openPath(String(p)));

  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 820,
    minHeight: 560,
    title: "Zenith Code",
    icon: fs.existsSync(ICON) ? ICON : undefined,
    backgroundColor: "#262624",
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#00000000", symbolColor: "#a3a097", height: 46 },
    show: false,
    webPreferences: {
      preload: path.join(APP_DIR, "electron", "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.removeMenu();
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => (win = null));

  // Links externos abrem no navegador padrão; páginas geradas (blob:) abrem numa janela do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("blob:") || url.startsWith("about:blank")) return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: "#ffffff" } };
    if (/^https?:\/\//.test(url) && !url.startsWith("http://127.0.0.1")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:${serverPort}/`)) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  await win.loadURL(LOADING);
  try {
    const port = await startServer();
    await win.loadURL(`http://127.0.0.1:${port}/`);
  } catch (e) {
    dialog.showErrorBox("Zenith Code", `Não foi possível iniciar o Zenith.\n\n${e.message ?? e}\n\nRegistro: ${path.join(LOGS, "server.log")}`);
    app.quit();
  }
}

app.on("before-quit", () => {
  quitting = true;
  server?.kill();
});
app.on("window-all-closed", () => app.quit());
