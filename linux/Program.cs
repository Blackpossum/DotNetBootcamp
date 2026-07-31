using System.Diagnostics;
using Photino.NET;

namespace DotNetBootcamp;

/// <summary>
/// Linux/macOS entry point. Mirrors the Windows WPF shell (MainWindow.xaml.cs):
/// it hosts the bundled wwwroot/ course in a native WebView and sends any link
/// that leaves the app out to the default browser.
///
/// The content is served over a fixed loopback origin rather than file:// so that
/// localStorage (where all progress lives) has a stable, persistent origin — the
/// same reason the Windows build maps a virtual host name.
/// </summary>
internal static class Program
{
    // A fixed, obscure loopback port keeps the origin — and therefore saved
    // progress — stable across launches.
    private const int Port = 47838;
    private const string Origin = "http://127.0.0.1:47838";

    [STAThread]
    private static void Main()
    {
        string wwwroot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        using var server = new LocalContentServer(wwwroot, Port);
        server.Start();

        var window = new PhotinoWindow()
            .SetTitle(".NET Bootcamp — Beginner to Expert (.NET 10 / C# 14)")
            .SetUseOsDefaultSize(false)
            .SetSize(1280, 820)
            .SetMinSize(760, 520)
            .Center()
            .SetContextMenuEnabled(true)
            .SetChromeless(false);

        string iconPath = Path.Combine(AppContext.BaseDirectory, "Assets", "icon.png");
        if (File.Exists(iconPath))
            window.SetIconFile(iconPath);

        window.RegisterWebMessageReceivedHandler((object? _, string message) =>
        {
            if (message.StartsWith("open:", StringComparison.Ordinal))
                OpenExternal(message[5..]);
            else if (message.StartsWith("save:", StringComparison.Ordinal))
                SaveProgress(message[5..]);
        });

        window.Load($"{Origin}/index.html");
        window.WaitForClose();
    }

    /// <summary>Open a link (Microsoft Learn, GitHub, …) in the user's default browser.</summary>
    private static void OpenExternal(string url)
    {
        if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return;

        try
        {
            Process.Start(new ProcessStartInfo("xdg-open", url) { UseShellExecute = false });
        }
        catch
        {
            // No xdg-open (e.g. macOS): fall back to the OS shell handler.
            try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
            catch { /* nothing we can do */ }
        }
    }

    /// <summary>
    /// Save exported progress JSON. WebKitGTK does not honour anchor blob downloads
    /// the way WebView2 does, so the Export button routes the JSON here instead.
    /// </summary>
    private static void SaveProgress(string json)
    {
        try
        {
            string downloads = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            string dir = Directory.Exists(downloads)
                ? downloads
                : Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);

            string path = Path.Combine(dir, "bootcamp-progress.json");
            File.WriteAllText(path, json);
        }
        catch
        {
            // Best effort — Import still works via the native file picker.
        }
    }
}
