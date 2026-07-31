# 🎓 .NET Bootcamp — Beginner to Expert

A **native desktop app** (itself written in .NET 10 / C#) containing a complete,
offline learning management system for mastering **.NET 10 (LTS)** and **C# 14** — from your first
`dotnet run` to Native AOT, distributed systems, and a full capstone project.

It ships two native shells around one shared course (`wwwroot/`): **WPF + WebView2 on Windows**,
and **Photino.NET + webkit2gtk on Linux/macOS**.

Content is grounded in [Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/) — every lesson links
to the official docs it draws from, and links open in your default browser.

> **Platforms:** Windows 10/11 · Linux (GNOME/KDE/any freedesktop desktop) · macOS.

## Installing on Windows (recommended)

Double-click **`build\Install.cmd`**, or run:

```bash
powershell -ExecutionPolicy Bypass -File "D:\Software Development\DotNetBootcamp\build\Install.ps1"
```

This installs to `%LOCALAPPDATA%\Programs\DotNetBootcamp`, creates a **Desktop shortcut** and a
**Start Menu** entry, and registers the app in *Settings → Apps* so it uninstalls normally.
No administrator rights needed. The build is **self-contained** (~134 MB) — the .NET runtime is
bundled, so it keeps working even if you change or remove your SDK.

**Uninstall:** *Settings → Apps → .NET Bootcamp*, or double-click `build\Uninstall.cmd`.
Your progress survives uninstall (add `-RemoveData` to delete it too).

### Installing on another PC

```bash
powershell -ExecutionPolicy Bypass -File build\package.ps1
```

produces `build\DotNetBootcamp-1.0.0-win-x64.zip` (app + installer scripts + README).
Copy it anywhere, unzip, double-click `Install.cmd`. Target machine needs Windows 10/11 —
no .NET install required.

## Installing on Linux

Requires the **.NET 10 SDK** and **webkit2gtk 4.1** (`webkit2gtk4.1` on Fedora,
`libwebkit2gtk-4.1-0` on Debian/Ubuntu). Then:

```bash
./build/install-linux.sh
```

This publishes a **self-contained** binary to `~/.local/share/dotnet-bootcamp`, adds a launcher
symlink at `~/.local/bin/dotnet-bootcamp`, and registers a `.desktop` entry + hicolor icons — so
**.NET Bootcamp** appears in your applications menu and launches like any other Linux app. No root
needed. Progress is stored locally in the WebKit data store and survives restarts.

**Uninstall:** `./build/uninstall-linux.sh` (keeps your saved progress).

The Linux shell is [Photino.NET](https://www.tryphotino.io/) (`linux/`); it serves the same
`wwwroot/` course over a fixed loopback origin so `localStorage` progress persists, and sends
external doc links to your default browser via `xdg-open` — mirroring the Windows shell.

## Running from source (for development)

```bash
# Windows (WPF + WebView2)
dotnet run --project "D:\Software Development\DotNetBootcamp"

# Linux / macOS (Photino.NET + webkit2gtk)
dotnet run --project linux/DotNetBootcamp.Desktop.csproj
```

Rebuild the installable payload after changing content or code:

```bash
dotnet publish "D:\Software Development\DotNetBootcamp" -c Release -r win-x64 --self-contained true -o dist
```

then re-run `build\Install.cmd` to update the installed copy.

## The curriculum — 12 modules · 53 lessons · ~36 hours

| # | Module | Level |
|---|--------|-------|
| 1 | Getting Started with .NET — platform, CLR/JIT/GC internals, CLI, tooling & debugging | Beginner |
| 2 | C# Fundamentals — type system, value vs reference, operators, control flow, methods + calculator capstone | Beginner |
| 3 | Working with Data — arrays/List, Dictionary/HashSet/Queue/Stack + Big-O, string mastery, dates & GUIDs | Beginner |
| 4 | Object-Oriented Programming — encapsulation, inheritance, interfaces, structs/enums/records + library capstone | Intermediate |
| 5 | Advanced C# — generics, delegates/lambdas/events, LINQ deep dive, C# 14 extension members, pattern matching | Intermediate |
| 6 | Errors, Null Safety, Files & JSON — exception design, nullable reference types, streams/IDisposable, System.Text.Json | Intermediate |
| 7 | Async, Concurrency & HTTP — async/await internals, cancellation, HttpClient, parallelism & channels | Intermediate |
| 8 | Testing & Quality — xUnit, theories/fixtures, test doubles & DI-for-testability, TDD | Intermediate |
| 9 | Data Access with EF Core 10 — DbContext, migrations & relationships, query performance, transactions & concurrency | Advanced |
| 10 | ASP.NET Core 10 — minimal APIs, DI/middleware/config, EF-backed CRUD, JWT auth, integration testing | Advanced |
| 11 | Architecture & Patterns — SOLID with judgment, layers vs vertical slices, design patterns, Generic Host workers | Advanced |
| 12 | Expert .NET — Span/benchmarking, source generators, Native AOT & containers, microservices/gRPC/messaging + **DevBoard capstone** | Expert |

Every lesson has four parts:

- **📖 Material** — deep theory: internals, tables, pitfalls, best practices, Microsoft Learn links
- **🛠️ Tutorial** — guided hands-on steps you run in your own terminal/editor
- **💻 Challenge** — a real coding task with an acceptance checklist and a collapsible full solution
- **❓ Quiz** — instant-feedback questions with explanations

## App features

- Progress tracking (lessons completed, per-task checklists, quiz answers) — stored locally and
  survives restarts (`%LocalAppData%\DotNetBootcamp` on Windows; the WebKit data store under
  `~/.local/share` on Linux)
- Export / import progress as JSON; reset button
- Full-text lesson search, dark/light theme, C# syntax highlighting, copy-to-clipboard on all code blocks
- 100% offline after build — no network needed except the external doc links

## Project structure

```
DotNetBootcamp/
├── DotNetBootcamp.csproj        Windows shell: WPF app, net10.0-windows, WebView2
├── MainWindow.xaml(.cs)         Native shell: virtual-host mapping, external-link handling
├── App.xaml(.cs)
├── app.ico                      Generated app icon (build\make-icon.ps1)
├── linux/                       Linux/macOS shell (Photino.NET + webkit2gtk)
│   ├── DotNetBootcamp.Desktop.csproj
│   ├── Program.cs               Native window; routes external links to xdg-open
│   ├── LocalContentServer.cs    Serves wwwroot over a fixed loopback origin
│   └── Assets/icon.png          256px window/app icon (from app.ico)
├── build/                       Packaging & install tooling
│   ├── Install.cmd / .ps1       Windows per-user install + Desktop/Start Menu shortcuts
│   ├── Uninstall.cmd / .ps1     Windows clean removal (keeps progress unless -RemoveData)
│   ├── install-linux.sh         Linux per-user install + .desktop entry & hicolor icons
│   ├── uninstall-linux.sh       Linux clean removal (keeps progress)
│   ├── package.ps1              Publishes + zips a distributable installer
│   └── make-icon.ps1            Regenerates app.ico at 7 resolutions
├── dist/                        Self-contained publish output (installer payload)
└── wwwroot/                     The LMS (shared course served to the webview by both shells)
    ├── index.html
    ├── css/styles.css
    ├── js/app.js                Engine: router, markdown renderer, highlighter, progress store
    └── content/m01..m12.md      Curriculum (plain-text format: @MODULE/@LESSON/@MATERIAL/…)
```

The app is intentionally its own teaching artifact: a native-shell + webview hybrid (WPF + WebView2 on
Windows, Photino.NET + webkit2gtk on Linux/macOS) — the same architecture as Visual Studio Code or
Teams — whose source you can read after Module 4, and fully understand after Module 11.

## Editing / extending the course

Content is plain markdown-ish text in `wwwroot/content/`. Each file:

```
@MODULE id | number | icon | Level | Title | Description
@LESSON id | Title | minutes
@MATERIAL   …markdown (supports ```code fences, tables, :::note/tip/warn callouts)…
@TUTORIAL   …
@TASK       …(:::solution blocks render as collapsible reveals)…
@CHECKS     - one checklist item per line
@QUIZ       ? question   /  - wrong answer  /  * correct answer  /  > explanation
```

Edit, save, relaunch (or just refresh with Ctrl+R inside the app) — no build step for content changes
when running from the project folder (`dotnet run` copies content on build).
