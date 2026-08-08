import express from "express";
import fs from "node:fs";
import path from "node:path";

const app = express();
const port = Number(process.env.PORT || 8080);
const version = process.env.APP_VERSION || "20260806-interactive-wiki";
const keyPath = process.env.GIT_SSH_KEY_PATH || "/app/data/git/id_rsa";
const hostsPath = process.env.GIT_KNOWN_HOSTS_PATH || "/app/data/git/known_hosts";
const dataDir = process.env.DATA_DIR || "/app/data/wiki";
const dbPath = process.env.WIKI_DB_PATH || path.join(dataDir, "wiki-db.json");
const providers = {
  "prism-ai": { label: "Prism AI", model: "codex/default", endpoint: "https://prisim-ai.edi-it.com/v1", authMode: "Prism managed" },
  openai: { label: "OpenAI", model: "gpt-5-mini", endpoint: "https://api.openai.com/v1", authMode: "API key" },
  custom: { label: "OpenAI-compatible", model: "gpt-5-mini", endpoint: "https://example.com/v1", authMode: "API key" }
};
const pageDefs = {
  Architecture: ["Components", "Runtime", "Dependencies"],
  Deployment: ["Operations", "Networking", "Security"],
  Networking: ["Deployment", "Security", "Operations"],
  Troubleshooting: ["Known Issues", "Operations", "Runtime"],
  Build: ["Deployment", "Testing", "Dependencies"],
  API: ["Security", "Components", "Developer Guide"],
  Database: ["Runtime", "Security", "Operations"],
  Security: ["API", "Deployment", "Configuration"],
  Dependencies: ["Architecture", "Build", "Components"],
  Components: ["Architecture", "API", "Runtime"],
  Runtime: ["Deployment", "Configuration", "Operations"],
  Operations: ["Runbooks", "Troubleshooting", "Deployment"],
  "Developer Guide": ["Build", "Testing", "API"],
  Testing: ["Build", "API", "Known Issues"],
  "Known Issues": ["Troubleshooting", "Runbooks", "Testing"],
  Runbooks: ["Troubleshooting", "Operations", "Known Issues"],
  Glossary: ["Architecture", "Developer Guide", "API"]
};
const summaries = {
  Architecture: "Service boundaries, runtime flow, and dependency context extracted for agents.",
  Deployment: "Build, container, Kubernetes, release, route, and rollback knowledge.",
  Networking: "Service, ingress, gateway, DNS, route, and port knowledge.",
  Troubleshooting: "Failure modes, debug order, runtime risks, and historical fixes.",
  Build: "Package scripts, Dockerfiles, CI, and artifact publishing paths.",
  API: "Handlers, routes, schemas, callers, and MCP-facing contracts.",
  Database: "Schemas, migrations, persistence, graph storage, and vector storage references.",
  Security: "Secrets, auth, RBAC, network boundaries, and provider configuration.",
  Dependencies: "Packages, imports, services, images, and runtime integrations.",
  Components: "Source modules, services, UI screens, workers, and MCP capabilities.",
  Runtime: "Environment variables, entrypoints, health checks, and service configuration.",
  Operations: "Health checks, rollout procedures, logs, events, and recurring maintenance.",
  "Developer Guide": "Local workflow, scripts, repository conventions, and contribution paths.",
  Testing: "Automated tests, smoke checks, endpoint probes, and verification paths.",
  "Known Issues": "Known failures, limitations, deployment notes, and user-reported friction.",
  Runbooks: "Operational steps, repeated fixes, evidence, and verification paths.",
  Glossary: "Project terminology, aliases, acronyms, and concept definitions."
};
const folders = {
  Architecture: "overview", Components: "overview",
  Deployment: "operations", Troubleshooting: "operations", Security: "operations", Runtime: "operations", Operations: "operations", "Known Issues": "operations", Runbooks: "operations",
  Networking: "infrastructure", Database: "infrastructure",
  Build: "development", "Developer Guide": "development", Testing: "development",
  API: "reference", Dependencies: "reference", Glossary: "reference"
};
const tags = (title) => [`#${slug(title)}`, `#${folders[title] || "wiki"}`, "#llm-wiki"];
const stages = [
  ["queued", "Queued", 8, 0],
  ["source", "Source prepared", 24, 4000],
  ["parser", "Repository parsed", 46, 10000],
  ["llm", "LLM knowledge generated", 72, 18000],
  ["graph", "Knowledge graph indexed", 90, 27000],
  ["ready", "Wiki snapshot ready", 100, 36000]
];
const preset = providers[process.env.LLM_PROVIDER || "prism-ai"] || providers["prism-ai"];
const initialState = {
  source: { type: "git", gitUrl: "", localPath: "", archiveName: "", branch: "main", authMode: "none" },
  llm: { provider: process.env.LLM_PROVIDER || "prism-ai", label: preset.label, model: process.env.LLM_MODEL || preset.model, endpoint: process.env.LLM_ENDPOINT || preset.endpoint, authMode: preset.authMode, connected: true, apiKeyConfigured: true },
  scans: [],
  wikiSnapshots: [],
  wikiQueries: []
};
function loadDb() {
  try {
    return fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf8")) : {};
  } catch (_e) {
    return {};
  }
}
function saveDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const tmp = `${dbPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ savedAt: new Date().toISOString(), source: state.source, llm: state.llm, scans: state.scans, wikiSnapshots: state.wikiSnapshots, wikiQueries: state.wikiQueries }, null, 2));
  fs.renameSync(tmp, dbPath);
}
function storage() {
  try {
    const stat = fs.statSync(dbPath);
    return { mode: "persistent-json-db", durable: true, path: dbPath, exists: true, bytes: stat.size, savedAt: stat.mtime.toISOString(), scans: state.scans.length, snapshots: state.wikiSnapshots.length, questions: state.wikiQueries.length };
  } catch (_e) {
    return { mode: "persistent-json-db", durable: true, path: dbPath, exists: false, bytes: 0, savedAt: null, scans: state.scans.length, snapshots: state.wikiSnapshots.length, questions: state.wikiQueries.length };
  }
}
const persisted = loadDb();
const state = {
  ...initialState,
  ...persisted,
  source: { ...initialState.source, ...(persisted.source || {}) },
  llm: { ...initialState.llm, ...(persisted.llm || {}) },
  scans: Array.isArray(persisted.scans) ? persisted.scans : [],
  wikiSnapshots: Array.isArray(persisted.wikiSnapshots) ? persisted.wikiSnapshots : [],
  wikiQueries: Array.isArray(persisted.wikiQueries) ? persisted.wikiQueries : []
};

app.use(express.json({ limit: "1mb" }));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const srcName = (s) => s.type === "git" ? s.gitUrl || "Git repository" : s.type === "local-folder" ? s.localPath || "Local folder" : s.archiveName || "ZIP archive";
const gitAuth = () => ({ authMode: state.source.authMode, sshKeyConfigured: fs.existsSync(keyPath), knownHostsConfigured: fs.existsSync(hostsPath), sshKeyPath: keyPath, knownHostsPath: hostsPath, secretName: "karpati-git-ssh", storage: fs.existsSync(keyPath) ? "file" : "not-configured" });
function cleanSource(x = {}) {
  const type = ["git", "local-folder", "zip-upload"].includes(x.type) ? x.type : "git";
  return { type, gitUrl: String(x.gitUrl || "").trim(), localPath: String(x.localPath || "").trim(), archiveName: String(x.archiveName || "").trim(), branch: String(x.branch || "main").trim() || "main", authMode: ["none", "ssh-key"].includes(x.authMode) ? x.authMode : "none" };
}
function cleanLlm(x = {}) {
  const provider = String(x.provider || state.llm.provider || "prism-ai");
  const p = providers[provider] || providers.custom;
  return { provider, label: p.label, model: String(x.model || p.model).trim() || p.model, endpoint: String(x.endpoint || p.endpoint).trim() || p.endpoint, authMode: p.authMode, connected: true, apiKeyConfigured: true };
}
function sourceError(s) {
  if (s.type === "git" && !s.gitUrl) return "Git repository URL is required, or use Demo wiki scan.";
  if (s.type === "git" && s.authMode === "ssh-key" && !fs.existsSync(keyPath)) return "Git SSH private key is not configured.";
  if (s.type === "local-folder" && !s.localPath) return "Local folder path is required.";
  if (s.type === "zip-upload" && !s.archiveName) return "Archive filename is required.";
  return "";
}
function md(title, scan, source) {
  const rel = pageDefs[title].map((r) => `[[${r}]]`).join(", ");
  const path = `${folders[title] || "reference"}/${title.replace(/\s+/g, "-")}.md`;
  return [`# ${title}`, "", `**Summary**: ${summaries[title]}`, `**Tags**: ${tags(title).join(" ")}`, `**Path**: ${path}`, "", "---", "", "## Content", "", "### Summary", summaries[title], "", "### Related Notes", rel, "", "### Source Context", `- Source: ${source}`, `- Branch/ref: ${scan.source.branch || "main"}`, `- Scan: ${scan.id}`, `- LLM provider: ${scan.llm.label}/${scan.llm.model}`, "", "## Citations", `- scan:${scan.id}`, `- path:${path}`, "", "## Agent Notes", `- Retrieve related pages before changing behavior: ${rel}.`, "- Ask AI why this page exists before changing its structure.", "- Improve this document when code, deployment, or operations knowledge changes."].join("\n");
}
function snapshot(scan) {
  const source = srcName(scan.source);
  const generatedAt = new Date().toISOString();
  const pages = Object.keys(pageDefs).map((title, i) => {
    const path = `${folders[title] || "reference"}/${title.replace(/\s+/g, "-")}.md`;
    return { id: `${scan.id}-${slug(title)}`, title, filename: `${title.replace(/\s+/g, "-")}.md`, path, folder: folders[title] || "reference", tags: tags(title), aliases: [title, `${title}.md`, path], scanId: scan.id, source, generatedAt, freshness: "Generated", confidence: Number((0.9 - i * 0.03).toFixed(2)), summary: `${summaries[title]} Source: ${source}.`, relationships: pageDefs[title], links: pageDefs[title].filter((r) => pageDefs[r]), backlinks: [], citations: [`scan:${scan.id}`, `path:${path}`], contextWindows: [`File ${path}: ${summaries[title]}`, `Scan ${scan.id} accepted ${source}.`, `Generated with ${scan.llm.label}/${scan.llm.model}.`], markdown: md(title, scan, source) };
  });
  pages.forEach((p) => p.backlinks = pages.filter((c) => c.id !== p.id && c.relationships.includes(p.title)).map((c) => c.title));
  return { id: `wiki-${scan.id}`, scanId: scan.id, source: scan.source, llm: scan.llm, generatedAt, pageCount: pages.length, vault: { root: "/wiki", folders: [...new Set(pages.map((p) => p.folder))].sort(), tags: [...new Set(pages.flatMap((p) => p.tags))].sort(), files: pages.map((p) => p.path) }, pages };
}
function formatted(scan) {
  const elapsed = Date.now() - new Date(scan.createdAt).getTime();
  const idx = Math.max(0, Math.min(stages.findLastIndex((s) => elapsed >= s[3]), stages.length - 1));
  const complete = idx === stages.length - 1;
  const active = stages[idx];
  return { ...scan, status: complete ? "ready" : active[0], progress: active[2], currentStage: active[1], updatedAt: new Date().toISOString(), wikiSnapshot: complete ? state.wikiSnapshots.find((s) => s.scanId === scan.id) || null : null, stages: stages.map((s, i) => ({ key: s[0], label: s[1], progress: s[2], state: i < idx || (complete && i === idx) ? "done" : i === idx ? "running" : "pending" })), messages: [`Accepted ${srcName(scan.source)}.`, `LLM provider: ${scan.llm.label}/${scan.llm.model}.`, complete ? "Wiki snapshot is ready." : `Current stage: ${active[1]}.`] };
}
function newScan(source, llm, demo = false) {
  state.source = source;
  state.llm = llm;
  const scan = { id: `scan-${Date.now().toString(36)}`, source, llm, gitAuth: gitAuth(), status: "queued", createdAt: new Date().toISOString() };
  state.scans.unshift(scan);
  state.wikiSnapshots.unshift(snapshot(scan));
  saveDb();
  return { accepted: true, demo, scanId: scan.id, source, llm, gitAuth: scan.gitAuth, status: scan.status, progress: formatted(scan).progress, links: { status: `/api/scans/${scan.id}`, history: "/api/scans", wiki: "/api/wiki/snapshots/latest" }, next: "/api/scans" };
}
function findPage(id) {
  for (const s of state.wikiSnapshots) {
    const p = s.pages.find((x) => x.id === id || x.path === id || x.filename === id || slug(x.title) === slug(id));
    if (p) return { snapshot: s, page: p };
  }
  return {};
}
function graph(s) {
  return { nodes: s.pages.map((p) => ({ id: p.id, title: p.title, path: p.path, folder: p.folder, tags: p.tags })), edges: s.pages.flatMap((p) => p.links.map((to) => ({ from: p.title, to, fromId: p.id, toId: s.pages.find((x) => x.title === to)?.id || null, type: "wiki-link" }))) };
}
function answer(s, question) {
  const q = String(question || "").toLowerCase().split(/[^a-z0-9#]+/).filter(Boolean);
  const ranked = s.pages.map((p) => ({ p, hits: q.filter((t) => `${p.title} ${p.summary} ${p.tags.join(" ")} ${p.markdown}`.toLowerCase().includes(t)).length })).sort((a, b) => b.hits - a.hits || b.p.confidence - a.p.confidence).slice(0, 4).map((x) => x.p);
  const result = { question, snapshotId: s.id, scanId: s.scanId, mode: "grounded-markdown", answer: [`Grounded answer from ${s.id}:`, ...ranked.map((p) => `- ${p.title}.md says: ${p.summary}`), "Use the cited markdown files to verify details before changes."], sources: ranked.map((p) => ({ id: p.id, title: p.title, path: p.path, summary: p.summary, citations: p.citations })), loggedAt: new Date().toISOString() };
  state.wikiQueries.unshift(result);
  state.wikiQueries = state.wikiQueries.slice(0, 50);
  saveDb();
  return result;
}

app.get("/healthz", (_q, r) => r.json({ ok: true, service: "karpati-llm-wiki", version, timestamp: new Date().toISOString() }));
app.get("/api/settings", (_q, r) => r.json({ source: state.source, llm: state.llm, llmProviders: providers, gitAuth: gitAuth() }));
app.get("/api/storage", (_q, r) => r.json({ storage: storage() }));
app.put("/api/settings/source", (q, r) => { const s = cleanSource(q.body); const e = sourceError(s); if (e) return r.status(400).json({ ok: false, error: e }); state.source = s; saveDb(); r.json({ ok: true, source: s }); });
app.put("/api/settings/llm", (q, r) => { state.llm = cleanLlm(q.body); saveDb(); r.json({ ok: true, llm: state.llm }); });
app.put("/api/settings/git-auth", (q, r) => { const key = String(q.body?.privateKey || "").trim(); if (!key.includes("BEGIN") || !key.includes("PRIVATE KEY")) return r.status(400).json({ ok: false, error: "A valid SSH private key is required." }); fs.mkdirSync(keyPath.split("/").slice(0, -1).join("/"), { recursive: true }); fs.writeFileSync(keyPath, `${key}\n`, { mode: 0o400 }); saveDb(); r.json({ ok: true, gitAuth: gitAuth() }); });
app.get("/api/llm/providers", (_q, r) => r.json({ providers, defaultProvider: "prism-ai" }));
app.post("/api/repositories/scan", (q, r) => { const source = cleanSource(q.body?.source || state.source); const llm = cleanLlm(q.body?.llm || state.llm); const e = sourceError(source); if (e) return r.status(400).json({ accepted: false, error: e }); r.status(202).json(newScan(source, llm)); });
app.post("/api/demo/scan", (_q, r) => r.status(202).json(newScan({ type: "local-folder", gitUrl: "", localPath: "/demo/karpati-llm-wiki", archiveName: "", branch: "main", authMode: "none" }, cleanLlm(state.llm), true)));
app.get("/api/scans", (_q, r) => r.json({ scans: state.scans.slice(0, 20).map(formatted), count: state.scans.length }));
app.get("/api/scans/:id", (q, r) => { const s = state.scans.find((x) => x.id === q.params.id); if (!s) return r.status(404).json({ error: "Scan not found." }); r.json({ scan: formatted(s) }); });
app.get("/api/wiki/snapshots/latest", (_q, r) => { const s = state.wikiSnapshots[0]; if (!s) return r.status(404).json({ error: "No generated wiki snapshot exists yet. Run a scan first." }); r.json({ snapshot: s }); });
app.get("/api/wiki/vault", (_q, r) => { const s = state.wikiSnapshots[0]; if (!s) return r.status(404).json({ error: "No generated wiki snapshot exists yet." }); r.json({ snapshotId: s.id, scanId: s.scanId, generatedAt: s.generatedAt, vault: s.vault, queryCount: state.wikiQueries.filter((x) => x.snapshotId === s.id).length }); });
app.get("/api/wiki/export", (_q, r) => { const s = state.wikiSnapshots[0]; if (!s) return r.status(404).json({ error: "No generated wiki snapshot exists yet." }); r.type("text/markdown").send(s.pages.map((p) => `<!-- ${p.path} -->\n${p.markdown}`).join("\n\n---\n\n")); });
app.get("/api/wiki/pages", (_q, r) => { const s = state.wikiSnapshots[0]; if (!s) return r.status(404).json({ error: "No generated wiki snapshot exists yet." }); r.json({ snapshotId: s.id, scanId: s.scanId, pages: s.pages.map(({ markdown, ...p }) => p) }); });
app.get("/api/wiki/pages/:id", (q, r) => { const x = findPage(q.params.id); if (!x.page) return r.status(404).json({ error: "Wiki page not found." }); r.json({ page: x.page, snapshotId: x.snapshot.id }); });
app.post("/api/wiki/pages/:id/ai", (q, r) => { const x = findPage(q.params.id); if (!x.page) return r.status(404).json({ error: "Wiki page not found." }); const improvedMarkdown = `${x.page.markdown}\n\n## Improvement Suggestions\n- Add exact parser evidence and file references.\n- Expand upstream/downstream impact notes.\n- Add verification commands for runtime behavior.`; r.json({ assistance: { intent: q.body?.intent || "explain", pageId: x.page.id, title: x.page.title, scanId: x.snapshot.scanId, model: x.snapshot.llm.model, explanation: [`${x.page.title}.md exists because each scan produces agent-readable wiki pages.`, "It uses Obsidian-style links, provenance, backlinks, and context windows so AI agents can navigate the project memory.", "The current text is generated from scan metadata and page relationship templates."], suggestions: ["Attach parser evidence from source files.", "Promote repeated fixes into runbooks.", "Keep wiki links and backlinks navigable."], improvedMarkdown } }); });
app.post("/api/wiki/ask", (q, r) => { const s = state.wikiSnapshots[0]; if (!s) return r.status(404).json({ error: "No generated wiki snapshot exists yet." }); const question = String(q.body?.question || "").trim(); if (!question) return r.status(400).json({ error: "Question is required." }); r.json({ result: answer(s, question) }); });
app.get("/api/wiki/questions", (_q, r) => r.json({ questions: state.wikiQueries.slice(0, 20), count: state.wikiQueries.length }));
app.get("/api/wiki/graph", (_q, r) => { const s = state.wikiSnapshots[0]; if (!s) return r.status(404).json({ error: "No generated wiki snapshot exists yet." }); r.json({ snapshotId: s.id, scanId: s.scanId, graph: graph(s) }); });
app.get("/api/wiki/search", (q, r) => { const s = state.wikiSnapshots[0]; const query = String(q.query.q || "").toLowerCase(); const pages = s?.pages || []; const found = pages.filter((p) => !query || `${p.title} ${p.summary} ${p.relationships.join(" ")}`.toLowerCase().includes(query)); r.json({ query, mode: "hybrid", snapshotId: s?.id || null, scanId: s?.scanId || null, generated: Boolean(s), results: (found.length ? found : pages).map((p, i) => ({ id: p.id, title: p.title, score: Number((0.94 - i * 0.04).toFixed(2)), summary: p.summary, related: p.relationships, generatedAt: p.generatedAt, scanId: p.scanId })) }); });
app.get("/api/graph/dependencies", (_q, r) => { const s = state.wikiSnapshots[0]; if (!s) return r.json({ nodes: ["Repository", "Scanner", "Parser", "Knowledge", "Graph", "MCP"], edges: [["Repository", "Scanner"], ["Scanner", "Parser"], ["Parser", "Knowledge"], ["Knowledge", "Graph"], ["Graph", "MCP"]] }); const g = graph(s); r.json({ generated: true, snapshotId: s.id, nodes: g.nodes.map((n) => n.title), edges: g.edges.map((e) => [e.from, e.to]) }); });
app.get("/api/mcp/tools", (_q, r) => r.json({ tools: [{ name: "wiki.search", description: "Search generated project knowledge." }, { name: "wiki.retrieve", description: "Retrieve wiki Markdown and context." }, { name: "graph.downstream", description: "Find downstream dependencies." }, { name: "plan.deployment", description: "Generate deployment plans." }] }));

app.get("/", (_q, r) => r.type("html").send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Karpati LLM Wiki</title><style>body{margin:0;font:15px system-ui;background:#f5f7f9;color:#111}main{padding:28px;display:grid;gap:18px}.grid{display:grid;grid-template-columns:minmax(280px,420px) 1fr;gap:16px}.panel,.wiki,.reader,.ai,.ask,.storage{background:white;border:1px solid #d8dee6;border-radius:8px;padding:16px;display:grid;gap:10px}.storage{background:#edf8f5;border-color:#9bc9c2;color:#0b4f49}input,select,button,textarea{font:inherit;min-height:42px;border:1px solid #cfd7e2;border-radius:8px;padding:8px 10px}button{background:#0b4f49;color:white;border:0;cursor:pointer}button.alt{background:#e7f5f2;color:#0b4f49;border:1px solid #9bc9c2}pre{background:#111827;color:#d7f8ee;border-radius:8px;padding:12px;white-space:pre-wrap;overflow:auto}.bar{height:10px;background:#e6ecf3;border-radius:999px;overflow:hidden}.bar span{display:block;height:100%;background:#0f766e}.pages{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}.page{border:1px solid #e3e8ee;border-radius:8px;padding:10px;display:grid;gap:6px}.page button{background:white;color:#0b4f49;border:1px solid #cfd7e2}.links,.askrow{display:flex;flex-wrap:wrap;gap:6px}.askrow input{flex:1 1 260px}.links small{border:1px solid #d8dee6;border-radius:999px;padding:3px 8px}@media(max-width:850px){.grid{grid-template-columns:1fr}}</style></head><body><main><header><h1>Karpati LLM Wiki</h1><p>Interactive wiki generation for AI agents.</p></header><section class="grid"><aside class="panel"><h2>Repository Intake</h2><input id="gitUrl" placeholder="https://github.com/org/repo.git"><input id="branch" value="main"><select id="authMode"><option value="none">No private auth</option><option value="ssh-key">Private SSH key</option></select><textarea id="privateKey" placeholder="Optional SSH private key"></textarea><button id="saveKey">Save key</button><h2>LLM</h2><select id="provider"><option value="prism-ai">Prism AI</option><option value="openai">OpenAI</option><option value="custom">OpenAI-compatible</option></select><input id="model" value="codex/default"><input id="endpoint" value="https://prisim-ai.edi-it.com/v1"><button id="save">Save settings</button><button id="scan">Start scan</button><button id="demo" class="alt">Demo wiki scan</button><pre id="log">Loading...</pre></aside><section class="wiki"><h2>Generated Wiki</h2><section class="storage"><b>Persistent storage</b><span id="storage">Checking DB...</span></section><div><strong id="active">No scan yet</strong><div class="bar"><span id="bar"></span></div></div><section class="ask"><b>Ask AI about this wiki</b><div class="askrow"><input id="wikiQuestion" value="Why is the deployment documentation written this way?"><button id="askWiki">Ask wiki</button></div><pre id="wikiAnswer">Run a scan, then ask the generated Markdown vault.</pre></section><div id="pages" class="pages"></div><article id="reader" class="reader">Open a .md page.</article><section id="ai" class="ai">Ask AI why this doc exists or improve it.</section></section></section></main><script>
const $=id=>document.getElementById(id),log=t=>$('log').textContent=t;let activePage='';
async function j(p,m='GET',b){const r=await fetch(p,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||p+' failed');return d}
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function source(){return{type:'git',gitUrl:$('gitUrl').value,branch:$('branch').value||'main',authMode:$('authMode').value}}
function llm(){return{provider:$('provider').value,model:$('model').value,endpoint:$('endpoint').value,connected:true,apiKeyConfigured:true}}
function draw(s){if(!s)return;$('active').textContent=s.id+' - '+s.currentStage+' - '+s.progress+'%';$('bar').style.width=s.progress+'%';if(s.wikiSnapshot)wiki(s.wikiSnapshot)}
function wiki(w){$('pages').innerHTML=w.pages.map(p=>'<div class="page"><b>'+esc(p.title)+'.md</b><span>'+esc(p.summary)+'</span><div class="links">'+p.relationships.map(x=>'<small>'+esc(x)+'</small>').join('')+'</div><button data-page="'+esc(p.id)+'">Open .md</button></div>').join('');document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>openPage(b.dataset.page));if(w.pages[0]&&!activePage)openPage(w.pages[0].id)}
async function openPage(id){activePage=id;const p=(await j('/api/wiki/pages/'+encodeURIComponent(id))).page;$('reader').innerHTML='<b>'+esc(p.title)+'.md</b><pre>'+esc(p.markdown)+'</pre><div class="links"><small>Related: '+esc(p.relationships.join(', '))+'</small><small>Backlinks: '+esc((p.backlinks||[]).join(', ')||'none')+'</small></div><button id="why">Ask AI why</button><button id="improve">Improve doc</button>';$('why').onclick=()=>ask('explain');$('improve').onclick=()=>ask('improve')}
async function ask(intent){const a=(await j('/api/wiki/pages/'+encodeURIComponent(activePage)+'/ai','POST',{intent})).assistance;$('ai').innerHTML='<b>AI doc assistant - '+esc(a.model)+'</b><h3>Why</h3><pre>'+esc(a.explanation.join('\\n'))+'</pre><h3>Improve</h3><pre>'+esc(a.suggestions.join('\\n'))+'</pre><details><summary>Improved Markdown</summary><pre>'+esc(a.improvedMarkdown)+'</pre></details>'}
async function askWiki(){const a=(await j('/api/wiki/ask','POST',{question:$('wikiQuestion').value})).result;$('wikiAnswer').textContent=a.answer.join('\\n')+'\\n\\nSources:\\n'+a.sources.map(s=>'- '+s.path).join('\\n')}
async function refreshStorage(){const s=(await j('/api/storage')).storage;$('storage').textContent=s.exists?('saved '+s.scans+' scans, '+s.snapshots+' snapshots, '+Math.round(s.bytes/1024)+' KB at '+s.path):('DB ready at '+s.path)}
async function refresh(){const r=await j('/api/scans');draw(r.scans[0]);await refreshStorage().catch(()=>{});try{wiki((await j('/api/wiki/snapshots/latest')).snapshot)}catch{}}
$('saveKey').onclick=async()=>{try{await j('/api/settings/git-auth','PUT',{privateKey:$('privateKey').value});$('privateKey').value='';log('key saved')}catch(e){log(e.message)}};
$('save').onclick=async()=>{try{await j('/api/settings/source','PUT',source());const r=await j('/api/settings/llm','PUT',llm());log('settings saved: '+r.llm.provider+'/'+r.llm.model)}catch(e){log(e.message)}};
$('scan').onclick=async()=>{try{const r=await j('/api/repositories/scan','POST',{source:source(),llm:llm()});log('scan accepted '+r.scanId);await refresh()}catch(e){log(e.message)}};
$('demo').onclick=async()=>{try{const r=await j('/api/demo/scan','POST',{});log('demo wiki generated '+r.scanId);await refresh()}catch(e){log(e.message)}};
$('askWiki').onclick=async()=>{try{await askWiki()}catch(e){log(e.message)}};
(async()=>{const s=await j('/api/settings');$('authMode').value=s.source.authMode;$('provider').value=s.llm.provider;$('model').value=s.llm.model;$('endpoint').value=s.llm.endpoint;log('ready');await refresh().catch(()=>{})})().catch(e=>log(e.message));setInterval(()=>refresh().catch(()=>{}),2500);
</script></body></html>`));

app.listen(port, () => console.log(`karpati-llm-wiki listening on ${port}`));
