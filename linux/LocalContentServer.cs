using System.Net;
using System.Text;

namespace DotNetBootcamp;

/// <summary>
/// A minimal static file server for the bundled wwwroot/, bound to loopback only.
/// It exists purely to give the course a real http origin (so localStorage
/// persists) — nothing here is reachable off the machine.
///
/// When serving index.html it injects a tiny bridge script that hands external
/// links and the Export action to the native shell (see Program.cs). The script
/// is added to the response bytes only; the file on disk is never modified.
/// </summary>
internal sealed class LocalContentServer : IDisposable
{
    private readonly HttpListener _listener = new();
    private readonly string _root;

    public LocalContentServer(string root, int port)
    {
        _root = Path.GetFullPath(root);
        _listener.Prefixes.Add($"http://127.0.0.1:{port}/");
    }

    public void Start()
    {
        _listener.Start();
        _ = Task.Run(AcceptLoopAsync);
    }

    private async Task AcceptLoopAsync()
    {
        while (_listener.IsListening)
        {
            HttpListenerContext context;
            try { context = await _listener.GetContextAsync(); }
            catch { break; } // listener stopped
            _ = Task.Run(() => Handle(context));
        }
    }

    private void Handle(HttpListenerContext context)
    {
        try
        {
            string relative = Uri.UnescapeDataString(context.Request.Url!.AbsolutePath).TrimStart('/');
            if (relative.Length == 0)
                relative = "index.html";

            string fullPath = Path.GetFullPath(Path.Combine(_root, relative));

            // Guard against path traversal outside wwwroot.
            if (!fullPath.StartsWith(_root, StringComparison.Ordinal) || !File.Exists(fullPath))
            {
                context.Response.StatusCode = 404;
                context.Response.Close();
                return;
            }

            byte[] body = File.ReadAllBytes(fullPath);

            if (Path.GetFileName(fullPath).Equals("index.html", StringComparison.OrdinalIgnoreCase))
                body = InjectBridge(body);

            context.Response.ContentType = ContentType(fullPath);
            context.Response.ContentLength64 = body.Length;
            context.Response.OutputStream.Write(body, 0, body.Length);
        }
        catch
        {
            try { context.Response.StatusCode = 500; } catch { /* ignore */ }
        }
        finally
        {
            try { context.Response.Close(); } catch { /* ignore */ }
        }
    }

    private static byte[] InjectBridge(byte[] html)
    {
        string text = Encoding.UTF8.GetString(html);
        int at = text.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        string injected = at >= 0 ? text.Insert(at, BridgeScript) : text + BridgeScript;
        return Encoding.UTF8.GetBytes(injected);
    }

    private const string BridgeScript = """
<script>
/* Native shell bridge — injected by the Linux/macOS host, not part of the source files. */
(function () {
  function send(m) { try { window.external.sendMessage(m); } catch (_) {} }

  // Route links that leave the app (target=_blank / any http(s) host that isn't ours)
  // to the default browser, matching the Windows shell's NewWindowRequested handling.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.href || '';
    if (/^https?:\/\//i.test(href) && a.host !== location.host) {
      e.preventDefault();
      send('open:' + href);
    }
  }, true);

  var nativeOpen = window.open;
  window.open = function (u) {
    if (u && /^https?:/i.test(u)) { send('open:' + u); return null; }
    return nativeOpen.apply(window, arguments);
  };

  // Export: WebKitGTK ignores anchor blob downloads, so hand the JSON to the host,
  // which writes it to ~/Downloads/bootcamp-progress.json.
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('export-btn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      send('save:' + (localStorage.getItem('bootcamp-progress-v1') || '{}'));
    }, true);
  });
})();
</script>
""";

    private static string ContentType(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".html" => "text/html; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".js" => "text/javascript; charset=utf-8",
        ".json" => "application/json; charset=utf-8",
        ".md" => "text/plain; charset=utf-8",
        ".svg" => "image/svg+xml",
        ".png" => "image/png",
        ".ico" => "image/x-icon",
        ".woff2" => "font/woff2",
        _ => "application/octet-stream",
    };

    public void Dispose()
    {
        try { _listener.Stop(); _listener.Close(); } catch { /* ignore */ }
    }
}
