// Instalador do Zenith Code. O pacote (zip) vem anexado ao final deste .exe:
// [exe][zip][8 bytes: início do zip][8 bytes: "ZENITHPK"].
// Instala por usuário (sem administrador) em %LOCALAPPDATA%\Programs\Zenith Code.
// Argumentos para testes: /silent /dir=CAMINHO /noshortcuts /noregistry
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

static class ZenithSetup
{
    const string AppName = "Zenith Code";
    // Gerado pelo build-release.ps1 (BuildInfo.Version) a partir do package.json.
    const string Version = BuildInfo.Version;
    const string Publisher = "oiluiz137";
    const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\ZenithCode";

    [STAThread]
    static int Main(string[] args)
    {
        bool silent = false, shortcuts = true, registry = true;
        string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", AppName);
        foreach (var a in args)
        {
            if (a.Equals("/silent", StringComparison.OrdinalIgnoreCase)) silent = true;
            else if (a.Equals("/noshortcuts", StringComparison.OrdinalIgnoreCase)) shortcuts = false;
            else if (a.Equals("/noregistry", StringComparison.OrdinalIgnoreCase)) registry = false;
            else if (a.StartsWith("/dir=", StringComparison.OrdinalIgnoreCase)) dir = a.Substring(5).Trim('"');
        }
        if (silent)
        {
            try { Install(dir, shortcuts, shortcuts, registry, null); return 0; }
            catch (Exception e) { Console.Error.WriteLine(e.Message); return 1; }
        }
        Application.EnableVisualStyles();
        Application.Run(new SetupForm(dir));
        return 0;
    }

    /// Lê o zip anexado ao final do próprio executável.
    static Stream OpenPayload()
    {
        var fs = new FileStream(Application.ExecutablePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        var tail = new byte[16];
        fs.Seek(-16, SeekOrigin.End);
        fs.Read(tail, 0, 16);
        if (Encoding.ASCII.GetString(tail, 8, 8) != "ZENITHPK") throw new Exception("Instalador corrompido: pacote não encontrado.");
        long start = BitConverter.ToInt64(tail, 0);
        return new SubStream(fs, start, fs.Length - 16 - start);
    }

    public static void Install(string dir, bool desktop, bool startMenu, bool registry, Action<int, string> progress)
    {
        if (progress == null) progress = (p, s) => { };
        // Atualização: a pasta do programa só tem arquivos do Zenith (os dados do usuário ficam em
        // %LOCALAPPDATA%\Zenith Code), então a versão anterior é removida inteira antes de copiar a nova.
        string fullDir = Path.GetFullPath(dir).TrimEnd('\\');
        foreach (var p in Process.GetProcessesByName(AppName))
        {
            string path = null;
            try { path = p.MainModule.FileName; } catch { }
            if (path != null && path.StartsWith(fullDir + "\\", StringComparison.OrdinalIgnoreCase))
                throw new Exception("O Zenith Code está aberto. Feche o programa e tente de novo.");
        }
        if (File.Exists(Path.Combine(dir, AppName + ".exe")))
        {
            progress(2, "Removendo a versão anterior…");
            try
            {
                foreach (var d in Directory.GetDirectories(dir)) Directory.Delete(d, true);
                foreach (var f in Directory.GetFiles(dir)) File.Delete(f);
            }
            catch (Exception e) { throw new Exception("Não foi possível substituir a versão instalada. Feche o Zenith Code e tente de novo.\n" + e.Message); }
        }
        Directory.CreateDirectory(dir);
        using (var payload = OpenPayload())
        using (var zip = new ZipArchive(payload, ZipArchiveMode.Read))
        {
            int total = zip.Entries.Count, done = 0;
            string root = Path.GetFullPath(dir).TrimEnd('\\') + "\\";
            foreach (var entry in zip.Entries)
            {
                string rel = entry.FullName.Replace('/', '\\');
                string target = Path.GetFullPath(Path.Combine(dir, rel));
                if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) continue;
                if (rel.EndsWith("\\")) { Directory.CreateDirectory(target); }
                else
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    entry.ExtractToFile(target, true);
                }
                done++;
                if (done % 40 == 0 || done == total) progress(5 + (int)(90L * done / total), "Copiando arquivos… " + done + " de " + total);
            }
        }
        string exe = Path.Combine(dir, AppName + ".exe");
        if (startMenu) Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk"), exe, dir);
        if (desktop) Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk"), exe, dir);
        if (registry)
        {
            using (var k = Registry.CurrentUser.CreateSubKey(UninstallKey))
            {
                k.SetValue("DisplayName", AppName);
                k.SetValue("DisplayVersion", Version);
                k.SetValue("Publisher", Publisher);
                k.SetValue("InstallLocation", dir);
                k.SetValue("DisplayIcon", exe);
                k.SetValue("UninstallString", "\"" + Path.Combine(dir, "Uninstall.exe") + "\"");
                k.SetValue("QuietUninstallString", "\"" + Path.Combine(dir, "Uninstall.exe") + "\" /silent");
                k.SetValue("URLInfoAbout", "https://github.com/oiluiz137/zenith-code");
                k.SetValue("NoModify", 1, RegistryValueKind.DWord);
                k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                k.SetValue("EstimatedSize", (int)(DirSize(new DirectoryInfo(dir)) / 1024), RegistryValueKind.DWord);
            }
        }
        progress(100, "Pronto.");
    }

    static long DirSize(DirectoryInfo d)
    {
        long n = 0;
        foreach (var f in d.GetFiles("*", SearchOption.AllDirectories)) n += f.Length;
        return n;
    }

    static void Shortcut(string lnk, string target, string workDir)
    {
        var shellType = Type.GetTypeFromProgID("WScript.Shell");
        dynamic shell = Activator.CreateInstance(shellType);
        dynamic s = shell.CreateShortcut(lnk);
        s.TargetPath = target;
        s.WorkingDirectory = workDir;
        s.IconLocation = target + ",0";
        s.Description = "Assistente de IA local com agente de código";
        s.Save();
    }

    class SetupForm : Form
    {
        TextBox dirBox;
        CheckBox desktopBox, launchBox;
        Button installBtn, cancelBtn, browseBtn;
        ProgressBar bar;
        Label status;

        public SetupForm(string dir)
        {
            Text = "Instalar " + AppName + " " + Version;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(520, 300);
            Font = new Font("Segoe UI", 9.5f);
            BackColor = Color.White;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            var head = new Panel { Dock = DockStyle.Top, Height = 70, BackColor = Color.FromArgb(38, 38, 36) };
            head.Controls.Add(new Label { Text = AppName, ForeColor = Color.FromArgb(242, 240, 233), Font = new Font("Segoe UI Semibold", 16f), AutoSize = true, Location = new Point(20, 10) });
            head.Controls.Add(new Label { Text = "Assistente de IA local · sem conta e sem telemetria", ForeColor = Color.FromArgb(190, 186, 176), AutoSize = true, Location = new Point(22, 42) });
            Controls.Add(head);

            Controls.Add(new Label { Text = "Pasta de instalação", AutoSize = true, Location = new Point(20, 88) });
            dirBox = new TextBox { Text = dir, Location = new Point(20, 110), Width = 390 };
            browseBtn = new Button { Text = "Procurar…", Location = new Point(418, 108), Width = 82 };
            browseBtn.Click += (s, e) =>
            {
                using (var f = new FolderBrowserDialog { SelectedPath = dirBox.Text, Description = "Escolha onde instalar o Zenith Code" })
                    if (f.ShowDialog(this) == DialogResult.OK) dirBox.Text = Path.Combine(f.SelectedPath, AppName);
            };
            desktopBox = new CheckBox { Text = "Criar atalho na área de trabalho", Checked = true, AutoSize = true, Location = new Point(20, 146) };
            launchBox = new CheckBox { Text = "Abrir o Zenith Code ao terminar", Checked = true, AutoSize = true, Location = new Point(20, 172) };
            var note = new Label { Text = "Os dados (conversas, modelos .gguf e pasta de trabalho) ficam em %LOCALAPPDATA%\\Zenith Code.", AutoSize = false, Size = new Size(480, 34), Location = new Point(20, 198), ForeColor = Color.DimGray };
            bar = new ProgressBar { Location = new Point(20, 236), Width = 480, Height = 8, Visible = false };
            status = new Label { Text = "", AutoSize = true, Location = new Point(20, 250), ForeColor = Color.DimGray };
            installBtn = new Button { Text = "Instalar", Location = new Point(334, 262), Width = 80, Height = 28 };
            cancelBtn = new Button { Text = "Cancelar", Location = new Point(420, 262), Width = 80, Height = 28 };
            cancelBtn.Click += (s, e) => Close();
            installBtn.Click += (s, e) => RunInstall();
            AcceptButton = installBtn;
            Controls.AddRange(new Control[] { dirBox, browseBtn, desktopBox, launchBox, note, bar, status, installBtn, cancelBtn });
        }

        void RunInstall()
        {
            string dir = dirBox.Text.Trim();
            bool desktop = desktopBox.Checked, launch = launchBox.Checked;
            installBtn.Enabled = cancelBtn.Enabled = browseBtn.Enabled = dirBox.Enabled = false;
            bar.Visible = true;
            var t = new Thread(() =>
            {
                try
                {
                    Install(dir, desktop, true, true, (p, s) => BeginInvoke((Action)(() => { bar.Value = Math.Min(100, p); status.Text = s; })));
                    BeginInvoke((Action)(() =>
                    {
                        if (launch) Process.Start(new ProcessStartInfo(Path.Combine(dir, AppName + ".exe")) { WorkingDirectory = dir });
                        MessageBox.Show(this, AppName + " foi instalado.\n\nPara usar um modelo local, coloque um arquivo .gguf na pasta de modelos (o app mostra um botão para abri-la).", AppName, MessageBoxButtons.OK, MessageBoxIcon.Information);
                        Close();
                    }));
                }
                catch (Exception ex)
                {
                    BeginInvoke((Action)(() =>
                    {
                        MessageBox.Show(this, "A instalação falhou:\n" + ex.Message, AppName, MessageBoxButtons.OK, MessageBoxIcon.Error);
                        installBtn.Enabled = cancelBtn.Enabled = browseBtn.Enabled = dirBox.Enabled = true;
                        bar.Visible = false;
                        status.Text = "";
                    }));
                }
            });
            t.IsBackground = true;
            t.Start();
        }
    }
}

/// Janela de leitura sobre um trecho de outro stream (o zip dentro do .exe).
class SubStream : Stream
{
    readonly Stream inner; readonly long start, length; long pos;
    public SubStream(Stream inner, long start, long length) { this.inner = inner; this.start = start; this.length = length; }
    public override bool CanRead { get { return true; } }
    public override bool CanSeek { get { return true; } }
    public override bool CanWrite { get { return false; } }
    public override long Length { get { return length; } }
    public override long Position { get { return pos; } set { pos = value; } }
    public override void Flush() { }
    public override int Read(byte[] buffer, int offset, int count)
    {
        if (pos >= length) return 0;
        if (count > length - pos) count = (int)(length - pos);
        inner.Seek(start + pos, SeekOrigin.Begin);
        int n = inner.Read(buffer, offset, count);
        pos += n;
        return n;
    }
    public override long Seek(long offset, SeekOrigin origin)
    {
        if (origin == SeekOrigin.Begin) pos = offset;
        else if (origin == SeekOrigin.Current) pos += offset;
        else pos = length + offset;
        return pos;
    }
    public override void SetLength(long value) { throw new NotSupportedException(); }
    public override void Write(byte[] buffer, int offset, int count) { throw new NotSupportedException(); }
    protected override void Dispose(bool disposing) { if (disposing) inner.Dispose(); base.Dispose(disposing); }
}
