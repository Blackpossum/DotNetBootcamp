/* =====================================================================
   .NET Bootcamp LMS engine
   - hash router, markdown renderer, C# highlighter, progress store
   ===================================================================== */
"use strict";

const CONTENT_FILES = [
  "content/m01.md", "content/m02.md", "content/m03.md", "content/m04.md",
  "content/m05.md", "content/m06.md", "content/m07.md", "content/m08.md",
  "content/m09.md", "content/m10.md", "content/m11.md", "content/m12.md",
];

const MODULES = [];
const LESSONS = [];

/* ---------------- Content file parser ----------------
   Format (one file per module):
     @MODULE id | num | icon | Level | Title | Description
     @LESSON id | Title | minutes
     @MATERIAL   ...markdown...
     @TUTORIAL   ...markdown...
     @TASK       ...markdown (may contain :::solution blocks)...
     @CHECKS     - checklist item per line
     @QUIZ       ? question / - wrong / * correct / > explanation      */
function parseModuleFile(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let module = null, lesson = null, section = null, buf = [];

  const flush = () => {
    if (!lesson || !section) { buf = []; return; }
    const md = buf.join("\n").trim();
    if (section === "MATERIAL") lesson.material = md;
    else if (section === "TUTORIAL") lesson.tutorial = md;
    else if (section === "TASK") lesson.task = md;
    else if (section === "CHECKS") {
      lesson.checks = buf.filter(x => /^\s*-\s+/.test(x)).map(x => x.replace(/^\s*-\s+/, "").trim());
    } else if (section === "QUIZ") {
      lesson.quiz = [];
      let q = null;
      for (const raw of buf) {
        const t = raw.trim();
        if (t.startsWith("? ")) { q = { q: t.slice(2), options: [], a: 0, why: "" }; lesson.quiz.push(q); }
        else if (!q) continue;
        else if (t.startsWith("* ")) { q.a = q.options.length; q.options.push(t.slice(2)); }
        else if (t.startsWith("- ")) { q.options.push(t.slice(2)); }
        else if (t.startsWith("> ")) { q.why = t.slice(2); }
      }
    }
    buf = [];
  };

  for (const line of lines) {
    const dir = line.match(/^@(MODULE|LESSON|MATERIAL|TUTORIAL|TASK|CHECKS|QUIZ)\b\s*(.*)$/);
    if (!dir) { buf.push(line); continue; }
    flush();
    const kind = dir[1], rest = dir[2];
    if (kind === "MODULE") {
      const p = rest.split("|").map(s => s.trim());
      module = { id: p[0], num: +p[1], icon: p[2], level: p[3], title: p[4], description: p[5] || "", lessons: [] };
      MODULES.push(module);
      section = null; lesson = null;
    } else if (kind === "LESSON") {
      const p = rest.split("|").map(s => s.trim());
      lesson = { id: p[0], title: p[1], minutes: +p[2] || 20, material: "", tutorial: "", task: "", checks: [], quiz: [] };
      module.lessons.push(lesson);
      section = null;
    } else {
      section = kind;
    }
  }
  flush();
}

async function loadContent() {
  const results = await Promise.allSettled(
    CONTENT_FILES.map(f => fetch(f).then(r => { if (!r.ok) throw new Error(f); return r.text(); })));
  for (const r of results) if (r.status === "fulfilled") parseModuleFile(r.value);
  MODULES.forEach(m => m.lessons.forEach(l => {
    l.moduleId = m.id; l.moduleTitle = m.title; l.level = m.level; LESSONS.push(l);
  }));
}

/* ---------------- Progress store ---------------- */
const STORE_KEY = "bootcamp-progress-v1";
const Store = {
  data: { completed: {}, checks: {}, quiz: {}, theme: "dark" },
  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(STORE_KEY) || "{}")); } catch { /* fresh start */ }
  },
  save() { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); },
  isDone(id) { return !!this.data.completed[id]; },
  toggleDone(id) {
    if (this.data.completed[id]) delete this.data.completed[id];
    else this.data.completed[id] = Date.now();
    this.save();
  },
  check(lessonId, idx, val) {
    const c = this.data.checks[lessonId] || (this.data.checks[lessonId] = {});
    if (val) c[idx] = true; else delete c[idx];
    this.save();
  },
  isChecked(lessonId, idx) { return !!(this.data.checks[lessonId] || {})[idx]; },
  quizAnswer(lessonId, qIdx, sel) {
    const q = this.data.quiz[lessonId] || (this.data.quiz[lessonId] = {});
    if (q[qIdx] === undefined) { q[qIdx] = sel; this.save(); }
  },
  quizSelected(lessonId, qIdx) {
    const q = this.data.quiz[lessonId];
    return q ? q[qIdx] : undefined;
  },
  moduleProgress(mod) {
    const done = mod.lessons.filter(l => this.isDone(l.id)).length;
    return { done, total: mod.lessons.length, pct: mod.lessons.length ? Math.round(done / mod.lessons.length * 100) : 0 };
  },
  globalProgress() {
    const done = LESSONS.filter(l => this.isDone(l.id)).length;
    return { done, total: LESSONS.length, pct: LESSONS.length ? Math.round(done / LESSONS.length * 100) : 0 };
  }
};

/* ---------------- HTML helpers ---------------- */
function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function attrEscape(s) { return s.replace(/"/g, "&quot;"); }

/* ---------------- Syntax highlighting ----------------
   Input is HTML-escaped for & < > only, so quotes are literal. */
const CS_KEYWORDS = new Set(("abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly record ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while var dynamic async await yield when where select from group into orderby join let on equals by ascending descending partial get set init add remove global file scoped required with and or not nameof notnull unmanaged value nint nuint field extension allows").split(" "));

function highlightCSharp(code) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(\$@"[\s\S]*?"|@\$"[\s\S]*?"|@"(?:[^"]|"")*"|\$"(?:[^"\\\n]|\\.)*"|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(^#[a-z]+[^\n]*)|(\b\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?[fFdDmMuUlL]{0,3}\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/gm;
  return code.replace(re, (m, com, str, pre, num, word) => {
    if (com) return `<span class="tok-com">${m}</span>`;
    if (str) return `<span class="tok-str">${m}</span>`;
    if (pre) return `<span class="tok-pre">${m}</span>`;
    if (num) return `<span class="tok-num">${m}</span>`;
    if (word) {
      if (CS_KEYWORDS.has(word)) return `<span class="tok-kw">${m}</span>`;
      if (/^[A-Z]/.test(word)) return `<span class="tok-type">${m}</span>`;
      return m;
    }
    return m;
  });
}

function highlightGeneric(code, lang) {
  if (lang === "bash" || lang === "sh" || lang === "powershell") {
    return code.replace(/(#[^\n]*|&lt;#[\s\S]*?#&gt;)|("(?:[^"\\\n]|\\.)*"|'[^'\n]*')|(^\s*(?:dotnet|git|cd|mkdir|curl|nuget|sqlite3)\b)/gm,
      (m, com, str, cmd) => com ? `<span class="tok-com">${m}</span>` : str ? `<span class="tok-str">${m}</span>` : cmd ? `<span class="tok-kw">${m}</span>` : m);
  }
  if (lang === "json") {
    return code.replace(/("(?:[^"\\]|\\.)*")(\s*:)?|(\b-?\d+\.?\d*\b)|\b(true|false|null)\b/g,
      (m, str, colon, num, kw) => str ? (colon ? `<span class="tok-type">${str}</span>${colon}` : `<span class="tok-str">${str}</span>`) : num ? `<span class="tok-num">${m}</span>` : kw ? `<span class="tok-kw">${m}</span>` : m);
  }
  if (lang === "xml" || lang === "html" || lang === "xaml") {
    return code.replace(/(&lt;\/?)([\w.:-]+)|("(?:[^"]*)")|(&lt;!--[\s\S]*?--&gt;)/g,
      (m, open, tag, str, com) => com ? `<span class="tok-com">${m}</span>` : str ? `<span class="tok-str">${m}</span>` : open ? `${open}<span class="tok-kw">${tag}</span>` : m);
  }
  if (lang === "sql") {
    return code.replace(/\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|PRIMARY|KEY|FOREIGN|REFERENCES|JOIN|INNER|LEFT|ON|ORDER|BY|GROUP|HAVING|LIMIT|AND|OR|NOT|NULL|INTEGER|TEXT|REAL|AS|DISTINCT|COUNT|INDEX)\b|('[^']*')|(--[^\n]*)/gi,
      (m, kw, str, com) => kw ? `<span class="tok-kw">${m}</span>` : str ? `<span class="tok-str">${m}</span>` : com ? `<span class="tok-com">${m}</span>` : m);
  }
  return code;
}

function highlight(code, lang) {
  const l = (lang || "").toLowerCase();
  if (l === "csharp" || l === "cs" || l === "c#") return highlightCSharp(code);
  return highlightGeneric(code, l);
}

/* ---------------- Markdown renderer ---------------- */
let codeBlockId = 0;

function renderInline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const ext = /^https?:\/\//.test(url);
    return `<a href="${attrEscape(url)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`;
  });
  return s;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const flushPara = buf => {
    if (buf.length) { out.push(`<p>${renderInline(buf.join(" "))}</p>`); buf.length = 0; }
  };
  let para = [];

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      flushPara(para);
      const lang = fence[1] || "";
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      const escaped = escapeHtml(buf.join("\n"));
      const id = "cb" + (codeBlockId++);
      out.push(
        `<pre>${lang ? `<span class="lang-tag">${lang}</span>` : ""}` +
        `<button class="copy-btn" data-copy="${id}">copy</button>` +
        `<code id="${id}">${highlight(escaped, lang)}</code></pre>`);
      continue;
    }

    // callouts / solution  :::type Optional title
    const co = line.match(/^:::\s*(note|tip|warn|solution)\s*(.*)$/);
    if (co) {
      flushPara(para);
      const type = co[1];
      const title = co[2].trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      const inner = renderMarkdown(buf.join("\n"));
      if (type === "solution") {
        out.push(`<details class="solution"><summary>💡 ${title || "Show solution"}</summary><div class="sol-body">${inner}</div></details>`);
      } else {
        const label = { note: "📘 Note", tip: "✅ Tip", warn: "⚠️ Watch out" }[type];
        out.push(`<div class="callout ${type}"><span class="co-title">${title || label}</span>${inner}</div>`);
      }
      continue;
    }

    // headings
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flushPara(para); out.push(`<h${h[1].length}>${renderInline(h[2])}</h${h[1].length}>`); i++; continue; }

    // hr
    if (/^---+\s*$/.test(line)) { flushPara(para); out.push("<hr>"); i++; continue; }

    // blockquote
    if (/^>\s?/.test(line)) {
      flushPara(para);
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${renderMarkdown(buf.join("\n"))}</blockquote>`);
      continue;
    }

    // table
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flushPara(para);
      const header = line.split("|").slice(1, -1).map(c => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map(c => c.trim()));
        i++;
      }
      out.push("<table><thead><tr>" + header.map(c => `<th>${renderInline(c)}</th>`).join("") + "</tr></thead><tbody>" +
        rows.map(r => "<tr>" + r.map(c => `<td>${renderInline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table>");
      continue;
    }

    // lists (with one nesting level via two-space indent)
    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      flushPara(para);
      const ordered = /\d+\./.test(li[2]);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!m) break;
        const indent = m[1].length;
        if (indent >= 2 && items.length) {
          // nested item -> append to last item's sub-list
          const last = items[items.length - 1];
          last.sub = last.sub || [];
          last.sub.push(m[3]);
        } else {
          items.push({ text: m[3] });
        }
        i++;
      }
      out.push(`<${tag}>` + items.map(it => {
        let html = `<li>${renderInline(it.text)}`;
        if (it.sub) html += "<ul>" + it.sub.map(s => `<li>${renderInline(s)}</li>`).join("") + "</ul>";
        return html + "</li>";
      }).join("") + `</${tag}>`);
      continue;
    }

    // blank line
    if (/^\s*$/.test(line)) { flushPara(para); i++; continue; }

    para.push(line.trim());
    i++;
  }
  flushPara(para);
  return out.join("\n");
}

/* ---------------- Router & views ---------------- */
const $main = document.getElementById("main");
const $nav = document.getElementById("nav");

function route() {
  const hash = location.hash || "#/";
  const parts = hash.slice(2).split("/");
  document.getElementById("sidebar").classList.remove("open");
  if (parts[0] === "lesson" && parts[1]) renderLesson(parts[1], parts[2] || "material");
  else if (parts[0] === "module" && parts[1]) renderModule(parts[1]);
  else renderDashboard();
  renderNav();
  updateGlobalBar();
  $main.scrollIntoView({ block: "start" });
  window.scrollTo(0, 0);
}

function lessonById(id) { return LESSONS.find(l => l.id === id); }
function moduleById(id) { return MODULES.find(m => m.id === id); }

/* ----- Sidebar nav ----- */
function renderNav(filter) {
  const activeLesson = (location.hash.match(/#\/lesson\/([^/]+)/) || [])[1];
  $nav.innerHTML = MODULES.map(m => {
    const p = Store.moduleProgress(m);
    const lessons = m.lessons
      .filter(l => !filter || l.title.toLowerCase().includes(filter))
      .map(l => `
        <div class="nav-lesson ${Store.isDone(l.id) ? "done" : ""} ${l.id === activeLesson ? "active" : ""}"
             onclick="location.hash='#/lesson/${l.id}'">
          <span class="tick">${Store.isDone(l.id) ? "✔" : "○"}</span>
          <span>${l.title}</span>
        </div>`).join("");
    if (filter && !lessons) return "";
    const isOpen = filter || m.lessons.some(l => l.id === activeLesson);
    return `
      <div class="nav-module ${isOpen ? "open" : ""}" data-mod="${m.id}">
        <div class="nav-module-header" onclick="this.parentElement.classList.toggle('open')">
          <span>${m.icon}</span>
          <span>${m.num}. ${m.title}</span>
          <span class="mod-progress">${p.done}/${p.total}</span>
          <span class="chev">▶</span>
        </div>
        <div class="nav-lessons">${lessons}</div>
      </div>`;
  }).join("");
}

/* ----- Dashboard ----- */
function renderDashboard() {
  const g = Store.globalProgress();
  const modsDone = MODULES.filter(m => Store.moduleProgress(m).pct === 100).length;
  const next = LESSONS.find(l => !Store.isDone(l.id));
  const totalMinutes = LESSONS.reduce((s, l) => s + (l.minutes || 0), 0);

  const levels = ["Beginner", "Intermediate", "Advanced", "Expert"];
  const sections = levels.map(level => {
    const mods = MODULES.filter(m => m.level === level);
    if (!mods.length) return "";
    return `
      <div class="level-section">
        <div class="level-title">${level}</div>
        <div class="module-grid">
          ${mods.map(m => {
            const p = Store.moduleProgress(m);
            return `
              <div class="module-card" onclick="location.hash='#/module/${m.id}'">
                <div class="mc-top">
                  <span class="mc-icon">${m.icon}</span>
                  <div><div class="mc-num">Module ${m.num}</div><h3>${m.title}</h3></div>
                </div>
                <p>${m.description}</p>
                <div class="mc-bar"><div class="mc-fill" style="width:${p.pct}%"></div></div>
                <div class="mc-meta"><span>${p.done}/${p.total} lessons</span><span>${p.pct}%</span></div>
              </div>`;
          }).join("")}
        </div>
      </div>`;
  }).join("");

  $main.innerHTML = `
    <div class="hero">
      <h1>🎓 .NET Bootcamp: Beginner → Expert</h1>
      <p>A complete, hands-on curriculum for <strong>.NET 10 (LTS)</strong> and <strong>C# 14</strong>, distilled from
         Microsoft Learn. Every lesson pairs deep theory with a guided tutorial, a real coding challenge, and a quiz.
         Work top to bottom — each module builds on the last.</p>
      <div class="hero-stats">
        <div class="stat"><strong>${g.done}/${g.total}</strong><span>lessons completed</span></div>
        <div class="stat"><strong>${modsDone}/${MODULES.length}</strong><span>modules finished</span></div>
        <div class="stat"><strong>${g.pct}%</strong><span>overall progress</span></div>
        <div class="stat"><strong>~${Math.round(totalMinutes / 60)}h</strong><span>total course time</span></div>
      </div>
      ${next ? `<button class="resume-btn" onclick="location.hash='#/lesson/${next.id}'">${g.done ? "▶ Resume: " : "▶ Start: "}${next.title}</button>`
             : `<button class="resume-btn">🏆 Course complete — congratulations!</button>`}
    </div>
    ${sections}`;
}

/* ----- Module page ----- */
function renderModule(id) {
  const m = moduleById(id);
  if (!m) { renderDashboard(); return; }
  const p = Store.moduleProgress(m);
  $main.innerHTML = `
    <div class="crumbs"><a href="#/">Dashboard</a> / Module ${m.num}</div>
    <div class="hero">
      <h1>${m.icon} ${m.title}</h1>
      <p>${m.description}</p>
      <div class="hero-stats">
        <div class="stat"><strong>${p.done}/${p.total}</strong><span>lessons done</span></div>
        <div class="stat"><strong>${m.level}</strong><span>level</span></div>
        <div class="stat"><strong>~${m.lessons.reduce((s, l) => s + (l.minutes || 0), 0)} min</strong><span>module time</span></div>
      </div>
    </div>
    ${m.lessons.map((l, idx) => `
      <div class="sr-item" onclick="location.hash='#/lesson/${l.id}'">
        <div class="sr-mod">Lesson ${idx + 1} · ~${l.minutes} min ${Store.isDone(l.id) ? " · ✔ completed" : ""}</div>
        <strong>${l.title}</strong>
      </div>`).join("")}`;
}

/* ----- Lesson page ----- */
function renderLesson(id, tab) {
  const l = lessonById(id);
  if (!l) { renderDashboard(); return; }
  const m = moduleById(l.moduleId);
  const idx = LESSONS.indexOf(l);
  const prev = LESSONS[idx - 1];
  const next = LESSONS[idx + 1];
  const done = Store.isDone(id);

  const tabs = [
    ["material", "📖 Material"],
    ["tutorial", "🛠️ Tutorial"],
    ["task", "💻 Challenge"],
  ];
  if (l.quiz && l.quiz.length) tabs.push(["quiz", "❓ Quiz"]);
  if (!tabs.some(t => t[0] === tab)) tab = "material";

  let body = "";
  if (tab === "material") body = `<div class="md">${renderMarkdown(l.material)}</div>`;
  else if (tab === "tutorial") body = `<div class="md">${renderMarkdown(l.tutorial)}</div>`;
  else if (tab === "task") body = renderTask(l);
  else if (tab === "quiz") body = renderQuiz(l);

  $main.innerHTML = `
    <div class="crumbs"><a href="#/">Dashboard</a> / <a href="#/module/${m.id}">${m.icon} ${m.title}</a></div>
    <div class="lesson-header">
      <div>
        <h1>${l.title}</h1>
        <div class="lesson-meta">
          <span class="pill level-${l.level}">${l.level}</span>
          <span class="pill">~${l.minutes} min</span>
          <span class="pill">Module ${m.num} · Lesson ${m.lessons.indexOf(l) + 1}/${m.lessons.length}</span>
        </div>
      </div>
      <button class="complete-btn ${done ? "done" : ""}" onclick="toggleComplete('${id}')">
        ${done ? "✔ Completed" : "Mark as complete"}
      </button>
    </div>
    <div class="tabs">
      ${tabs.map(([key, label]) =>
        `<button class="tab ${key === tab ? "active" : ""}" onclick="location.hash='#/lesson/${id}/${key}'">${label}</button>`).join("")}
    </div>
    ${body}
    <div class="lesson-nav">
      ${prev ? `<a href="#/lesson/${prev.id}"><small>← Previous</small>${prev.title}</a>` : "<span class='spacer'></span>"}
      ${next ? `<a href="#/lesson/${next.id}" style="text-align:right"><small>Next →</small>${next.title}</a>` : ""}
    </div>`;
  wireCopyButtons();
}

function renderTask(l) {
  let checksHtml = "";
  if (l.checks && l.checks.length) {
    checksHtml = `<h2>✅ Acceptance checklist</h2>` + l.checks.map((c, i) => `
      <label class="task-check ${Store.isChecked(l.id, i) ? "checked" : ""}">
        <input type="checkbox" ${Store.isChecked(l.id, i) ? "checked" : ""}
               onchange="onCheck('${l.id}', ${i}, this.checked)">
        <span>${renderInline(c)}</span>
      </label>`).join("");
  }
  return `<div class="md">${renderMarkdown(l.task)}</div><div class="md">${checksHtml}</div>`;
}

function renderQuiz(l) {
  return `<div class="md"><p>Answer all questions — explanations appear after you pick.</p></div>` +
    l.quiz.map((q, qi) => {
      const sel = Store.quizSelected(l.id, qi);
      const answered = sel !== undefined;
      return `
        <div class="quiz-q ${answered ? "answered" : ""}" id="q-${qi}">
          <div class="qq-text">${qi + 1}. ${renderInline(q.q)}</div>
          ${q.options.map((opt, oi) => {
            let cls = "";
            if (answered) {
              if (oi === q.a) cls = "correct";
              else if (oi === sel) cls = "wrong";
            }
            return `<span class="quiz-opt ${cls}" onclick="onQuiz('${l.id}', ${qi}, ${oi}, ${q.a})">${renderInline(opt)}</span>`;
          }).join("")}
          <div class="quiz-expl">💬 ${renderInline(q.why)}</div>
        </div>`;
    }).join("");
}

/* ----- interactions (global handlers used by inline HTML) ----- */
window.toggleComplete = id => { Store.toggleDone(id); route(); };
window.onCheck = (lessonId, idx, val) => {
  Store.check(lessonId, idx, val);
  const label = event.target.closest(".task-check");
  label.classList.toggle("checked", val);
};
window.onQuiz = (lessonId, qi, oi, correct) => {
  if (Store.quizSelected(lessonId, qi) !== undefined) return;
  Store.quizAnswer(lessonId, qi, oi);
  const q = document.getElementById(`q-${qi}`);
  q.classList.add("answered");
  const opts = q.querySelectorAll(".quiz-opt");
  opts[correct].classList.add("correct");
  if (oi !== correct) opts[oi].classList.add("wrong");
};

function wireCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.onclick = () => {
      const code = document.getElementById(btn.dataset.copy);
      navigator.clipboard.writeText(code.innerText).then(() => {
        btn.textContent = "copied!";
        setTimeout(() => (btn.textContent = "copy"), 1200);
      });
    };
  });
}

/* ----- global progress bar ----- */
function updateGlobalBar() {
  const g = Store.globalProgress();
  document.getElementById("gp-fill").style.width = g.pct + "%";
  document.getElementById("gp-label").textContent = g.pct + "%";
}

/* ----- search ----- */
document.getElementById("search").addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) { route(); return; }
  renderNav(q);
  const hits = LESSONS.filter(l =>
    l.title.toLowerCase().includes(q) ||
    (l.material && l.material.toLowerCase().includes(q)));
  $main.innerHTML = `
    <div class="search-results">
      <h2>Search: “${escapeHtml(q)}” — ${hits.length} lesson${hits.length === 1 ? "" : "s"}</h2>
      ${hits.length ? hits.map(l => `
        <div class="sr-item" onclick="location.hash='#/lesson/${l.id}'">
          <div class="sr-mod">${moduleById(l.moduleId).icon} ${l.moduleTitle} · ${l.level}</div>
          <strong>${l.title}</strong>
        </div>`).join("") : `<div class="empty-result">Nothing found. Try a different term.</div>`}
    </div>`;
});

/* ----- theme, export/import/reset, sidebar toggle ----- */
function applyTheme() {
  document.documentElement.setAttribute("data-theme", Store.data.theme === "light" ? "light" : "dark");
}
document.getElementById("theme-toggle").onclick = () => {
  Store.data.theme = Store.data.theme === "light" ? "dark" : "light";
  Store.save();
  applyTheme();
};
document.getElementById("export-btn").onclick = () => {
  const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "bootcamp-progress.json";
  a.click();
  URL.revokeObjectURL(a.href);
};
document.getElementById("import-input").onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      Object.assign(Store.data, JSON.parse(reader.result));
      Store.save();
      applyTheme();
      route();
    } catch { alert("That file is not valid progress JSON."); }
  };
  reader.readAsText(file);
};
document.getElementById("reset-btn").onclick = () => {
  if (confirm("Reset ALL progress (completed lessons, checklists, quiz answers)?")) {
    localStorage.removeItem(STORE_KEY);
    Store.data = { completed: {}, checks: {}, quiz: {}, theme: Store.data.theme };
    route();
  }
};
document.getElementById("sidebar-toggle").onclick = () =>
  document.getElementById("sidebar").classList.toggle("open");

/* ---------------- boot ---------------- */
(async function boot() {
  Store.load();
  applyTheme();
  try {
    await loadContent();
  } catch (e) {
    $main.innerHTML = `<div class="empty-result">Failed to load course content: ${escapeHtml(String(e))}</div>`;
    return;
  }
  window.addEventListener("hashchange", route);
  route();
})();
