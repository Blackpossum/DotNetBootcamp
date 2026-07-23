using System.Diagnostics;
using System.IO;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace DotNetBootcamp;

public partial class MainWindow : Window
{
    private const string VirtualHost = "bootcamp.app";

    public MainWindow()
    {
        InitializeComponent();
        Loaded += async (_, _) => await InitializeWebViewAsync();
    }

    private async Task InitializeWebViewAsync()
    {
        // Persist WebView2 state (localStorage progress lives here) under the user profile.
        string userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "DotNetBootcamp", "WebView2");

        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
        await WebView.EnsureCoreWebView2Async(environment);

        var core = WebView.CoreWebView2;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.AreDefaultContextMenusEnabled = true;
        core.Settings.IsZoomControlEnabled = true;

        // Serve the bundled course files over a proper origin so localStorage works reliably.
        string wwwroot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        core.SetVirtualHostNameToFolderMapping(
            VirtualHost, wwwroot, CoreWebView2HostResourceAccessKind.Allow);

        // Any link that leaves the app (Microsoft Learn, GitHub, …) opens in the default browser.
        core.NewWindowRequested += (_, e) =>
        {
            e.Handled = true;
            OpenExternal(e.Uri);
        };
        core.NavigationStarting += (_, e) =>
        {
            var uri = new Uri(e.Uri);
            if (!uri.Host.Equals(VirtualHost, StringComparison.OrdinalIgnoreCase))
            {
                e.Cancel = true;
                OpenExternal(e.Uri);
            }
        };
        core.NavigationCompleted += (_, _) => LoadingText.Visibility = Visibility.Collapsed;

        core.Navigate($"https://{VirtualHost}/index.html");
    }

    private static void OpenExternal(string url)
    {
        if (url.StartsWith("http://") || url.StartsWith("https://"))
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }
}
