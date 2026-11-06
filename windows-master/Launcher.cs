using System;
using System.IO;
using System.Reflection;
using System.Diagnostics;
using System.Windows.Forms;

internal static class Launcher
{
    private static void Extract(string resource, string destination)
    {
        using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource))
        {
            if (input == null) throw new InvalidOperationException("Missing embedded component: " + resource);
            using (var output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.Read))
                input.CopyTo(output);
        }
    }
    [STAThread]
    private static int Main(string[] args)
    {
        string dir = Path.Combine(Path.GetTempPath(), "MoOLVaMaster-" + Guid.NewGuid().ToString("N"));
        try
        {
            Directory.CreateDirectory(dir);
            string script = Path.Combine(dir, "MoOLVa_Windows_Master.ps1");
            Extract("main.ps1", script);
            Extract("drivers.ps1", Path.Combine(dir, "Драйверы_Windows_Update.ps1"));
            string ps = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), @"WindowsPowerShell\v1.0\powershell.exe");
            var start = new ProcessStartInfo(ps, "-NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File \"" + script + "\"");
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            using (var p = Process.Start(start)) { if (p == null) throw new InvalidOperationException("PowerShell did not start"); p.WaitForExit(); return p.ExitCode; }
        }
        catch (Exception ex) { MessageBox.Show("Не удалось запустить MoOLVa: " + ex.Message, "MoOLVa Windows Master", MessageBoxButtons.OK, MessageBoxIcon.Error); return 1; }
        finally { try { if (Directory.Exists(dir)) Directory.Delete(dir, true); } catch { } }
    }
}
