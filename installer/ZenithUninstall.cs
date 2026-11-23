// Uninstall.exe — remove o Zenith Code instalado, os atalhos e o registro em "Aplicativos instalados".
// Os dados do usuário (%LOCALAPPDATA%\Zenith Code) só são apagados se a pessoa marcar a opção.
using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

static class ZenithUninstall
{
    const string AppName = "Zenith Code";
    const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\ZenithCode";

    [STAThread]
    static int Main(string[] args)
    {
        bool silent = false, removeData = false;
        string from = null;
        foreach (var a in args)
        {
            if (a.Equals("/silent", StringComparison.OrdinalIgnoreCase)) silent = true;
            else if (a.Equals("/removedata", StringComparison.OrdinalIgnoreCase)) removeData = true;
            else if (a.StartsWith("/from=", StringComparison.OrdinalIgnoreCase)) from = a.Substring(6).Trim('"');
        }
        string dir = from ?? Path.GetDirectoryName(Application.ExecutablePath);
        string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppName);

        if (from == null)
        {
            if (!silent)
            {
                var answer = MessageBox.Show(
                    "Remover o " + AppName + " deste computador?\n\nClique em Sim para remover só o programa.\nSuas conversas e modelos em " + data + " ficam guardados.",
                    "Desinstalar " + AppName, MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (answer != DialogResult.Yes) return 0;
                if (Directory.Exists(data))
                {
                    removeData = MessageBox.Show(
                        "Também apagar seus dados do Zenith (conversas, configurações, modelos .gguf e a pasta de trabalho)?\n\n" + data + "\n\nIsso não pode ser desfeito.",
                        "Desinstalar " + AppName, MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2) == DialogResult.Yes;
                }
            }
            // Um programa não apaga a própria pasta enquanto roda: continua a partir de uma cópia temporária.
            string tmp = Path.Combine(Path.GetTempPath(), "zenith-uninstall-" + Guid.NewGuid().ToString("N") + ".exe");
            File.Copy(Application.ExecutablePath, tmp, true);
            Process.Start(new ProcessStartInfo(tmp, "/from=\"" + dir + "\"" + (silent ? " /silent" : "") + (removeData ? " /removedata" : "")) { UseShellExecute = false });
            return 0;
        }

        Thread.Sleep(800);
        foreach (var lnk in new[] {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), AppName + ".lnk"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), AppName + ".lnk") })
        {
            try { if (File.Exists(lnk)) File.Delete(lnk); } catch { }
        }
        try { Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false); } catch { }

        bool ok = TryDelete(dir);
        if (removeData) ok &= TryDelete(data);
        if (!silent)
        {
            MessageBox.Show(ok ? AppName + " foi removido." : "Alguns arquivos estavam em uso e não foram apagados. Feche o Zenith Code e apague a pasta:\n" + dir,
                "Desinstalar " + AppName, MessageBoxButtons.OK, ok ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
        }
        // Apaga a cópia temporária depois de sair.
        Process.Start(new ProcessStartInfo("cmd.exe", "/c ping 127.0.0.1 -n 3 > nul & del \"" + Application.ExecutablePath + "\"") { CreateNoWindow = true, UseShellExecute = false });
        return ok ? 0 : 1;
    }

    static bool TryDelete(string path)
    {
        for (int i = 0; i < 5; i++)
        {
            try { if (Directory.Exists(path)) Directory.Delete(path, true); return true; }
            catch { Thread.Sleep(700); }
        }
        return !Directory.Exists(path);
    }
}
