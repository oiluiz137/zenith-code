// Zenith Code.exe — inicia o servidor local escondido e abre o app numa janela própria.
// Compilado com o csc.exe do .NET Framework que já vem no Windows (ver build-release.ps1).
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

static class ZenithLauncher
{
    static string Root = Path.GetDirectoryName(Application.ExecutablePath);
    static string Home;
    static string LogPath;

    [STAThread]
    static int Main(string[] args)
    {
        // Modo portátil: com um arquivo "portable.txt" ao lado do .exe, os dados ficam em .\data.
        Home = File.Exists(Path.Combine(Root, "portable.txt"))
            ? Path.Combine(Root, "data")
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Zenith Code");
        Directory.CreateDirectory(Path.Combine(Home, "logs"));
        LogPath = Path.Combine(Home, "logs", "server.log");
        bool check = Array.IndexOf(args, "--check") >= 0;

        string node = Path.Combine(Root, "runtime", "node.exe");
        string server = Path.Combine(Root, "app", "dist-server", "index.mjs");
        if (!File.Exists(node) || !File.Exists(server))
        {
            return Fail(check, "Arquivos do Zenith Code não encontrados em " + Root + ". Reinstale o programa.");
        }

        int port = 5178;
        bool reuse = IsZenith(port);
        if (!reuse && PortBusy(port)) port = FreePort();
        if (check && reuse) { port = FreePort(); reuse = false; }

        Process srv = null;
        Splash splash = null;
        if (!reuse)
        {
            srv = StartServer(node, server, port);
            if (!check) { splash = new Splash(); splash.Show(); Application.DoEvents(); }
            bool ready = WaitReady(port, srv, 90);
            if (splash != null) splash.Close();
            if (!ready)
            {
                try { if (!srv.HasExited) srv.Kill(); } catch { }
                return Fail(check, "O servidor do Zenith Code não respondeu. Veja o registro em:\n" + LogPath);
            }
        }

        string url = "http://127.0.0.1:" + port + "/";
        if (check)
        {
            File.WriteAllText(Path.Combine(Home, "logs", "check.txt"), "OK " + url);
            try { srv.Kill(); } catch { }
            return 0;
        }

        OpenWindowAndWait(url);
        if (srv != null)
        {
            try { if (!srv.HasExited) srv.Kill(); } catch { }
        }
        return 0;
    }

    static int Fail(bool check, string message)
    {
        if (check) File.WriteAllText(Path.Combine(Home, "logs", "check.txt"), "ERRO " + message);
        else MessageBox.Show(message, "Zenith Code", MessageBoxButtons.OK, MessageBoxIcon.Error);
        return 1;
    }

    static Process StartServer(string node, string server, int port)
    {
        var psi = new ProcessStartInfo(node, "\"" + server + "\"");
        psi.WorkingDirectory = Path.Combine(Root, "app");
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;
        psi.EnvironmentVariables["ZENITH_HOME"] = Home;
        psi.EnvironmentVariables["ZENITH_PORT"] = port.ToString();
        psi.EnvironmentVariables["NODE_NO_WARNINGS"] = "1";
        var log = new StreamWriter(LogPath, true, Encoding.UTF8);
        log.AutoFlush = true;
        log.WriteLine("---- " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " porta " + port);
        var p = new Process();
        p.StartInfo = psi;
        p.OutputDataReceived += (s, e) => { if (e.Data != null) lock (log) log.WriteLine(e.Data); };
        p.ErrorDataReceived += (s, e) => { if (e.Data != null) lock (log) log.WriteLine(e.Data); };
        p.Start();
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        return p;
    }

    static bool IsZenith(int port)
    {
        try
        {
            var req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/bootstrap");
            req.Timeout = 1500;
            using (var res = (HttpWebResponse)req.GetResponse())
            using (var rd = new StreamReader(res.GetResponseStream()))
                return rd.ReadToEnd().Contains("Zenith");
        }
        catch { return false; }
    }

    static bool PortBusy(int port)
    {
        try { var l = new TcpListener(IPAddress.Loopback, port); l.Start(); l.Stop(); return false; }
        catch { return true; }
    }

    static int FreePort()
    {
        var l = new TcpListener(IPAddress.Loopback, 0);
        l.Start();
        int p = ((IPEndPoint)l.LocalEndpoint).Port;
        l.Stop();
        return p;
    }

    static bool WaitReady(int port, Process srv, int seconds)
    {
        var until = DateTime.Now.AddSeconds(seconds);
        while (DateTime.Now < until)
        {
            if (srv.HasExited) return false;
            if (IsZenith(port)) return true;
            Application.DoEvents();
            Thread.Sleep(300);
        }
        return false;
    }

    static string FindBrowser()
    {
        string[] keys = { @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe", @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" };
        foreach (var hive in new[] { Registry.CurrentUser, Registry.LocalMachine })
            foreach (var k in keys)
            {
                using (var key = hive.OpenSubKey(k))
                {
                    var v = key == null ? null : key.GetValue("") as string;
                    if (!string.IsNullOrEmpty(v) && File.Exists(v)) return v;
                }
            }
        string[] guesses = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
        };
        foreach (var g in guesses) if (File.Exists(g)) return g;
        return null;
    }

    /// Abre o app em modo janela (sem barra de endereço) com um perfil próprio do Zenith,
    /// e espera a janela fechar.
    static void OpenWindowAndWait(string url)
    {
        string browser = FindBrowser();
        if (browser != null)
        {
            string profile = Path.Combine(Home, "janela");
            var psi = new ProcessStartInfo(browser,
                "--app=" + url + " --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check " +
                "--window-size=1440,920 --disable-features=Translate,msEdgeSidebarV2 --lang=pt-BR");
            psi.UseShellExecute = false;
            var p = Process.Start(psi);
            p.WaitForExit();
            // Se outra janela do Zenith já estava aberta, o navegador entrega para ela e sai na hora;
            // nesse caso espera enquanto houver processos usando o perfil do Zenith.
            while (ProfileInUse(profile)) Thread.Sleep(1500);
            return;
        }
        Process.Start(url);
        MessageBox.Show("O Zenith Code está aberto no seu navegador em " + url + "\n\nClique em OK para encerrar o Zenith.", "Zenith Code", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    static bool ProfileInUse(string profile)
    {
        string lockFile = Path.Combine(profile, "lockfile");
        if (!File.Exists(lockFile)) return false;
        try { using (File.Open(lockFile, FileMode.Open, FileAccess.ReadWrite, FileShare.None)) { } return false; }
        catch { return true; }
    }

    class Splash : Form
    {
        public Splash()
        {
            Text = "Zenith Code";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(360, 140);
            BackColor = Color.FromArgb(38, 38, 36);
            ShowInTaskbar = true;
            TopMost = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            var title = new Label { Text = "Zenith Code", ForeColor = Color.FromArgb(242, 240, 233), Font = new Font("Segoe UI Semibold", 15f), AutoSize = true, Location = new Point(28, 30) };
            var sub = new Label { Text = "Iniciando o servidor local…", ForeColor = Color.FromArgb(163, 160, 151), Font = new Font("Segoe UI", 10f), AutoSize = true, Location = new Point(30, 70) };
            var bar = new Panel { BackColor = Color.FromArgb(217, 119, 87), Location = new Point(0, 136), Size = new Size(360, 4) };
            Controls.Add(title); Controls.Add(sub); Controls.Add(bar);
        }
    }
}
