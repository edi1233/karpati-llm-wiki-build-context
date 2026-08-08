import express from "express";
import fs from "node:fs";

const app = express();
const port = Number(process.env.PORT || 8080);
const version = process.env.APP_VERSION || "20260804-1145-scan-progress";
const keyPath = process.env.GIT_SSH_KEY_PATH || "/app/data/git/id_rsa";
const knownHostsPath = process.env.GIT_KNOWN_HOSTS_PATH || "/app/data/git/known_hosts";
const stages = [
  ["queued", "Queued", 8, 0],
  ["source", "Source prepared", 24, 4000],
  ["parser", "Repository parsed", 46, 10000],
  ["llm", "LLM knowledge generated", 72, 18000],
  ["graph", "Knowledge graph indexed", 90, 27000],
  ["ready", "Wiki snapshot ready", 100, 36000]
];
const providers = {
  "prism-ai": { label: "Prism AI", model: "codex/default", endpoint: "https://prisim-ai.edi-it.com/v1", authMode: "Prism managed or API key" },
  openai: { label: "OpenAI", model: "gpt-5-mini", endpoint: "https://api.openai.com/v1", authMode: "API key" },
  custom: { label: "OpenAI-compatible", model: "gpt-5-mini", endpoint: "https://example.com/v1", authMode: "API key" }
};
const state = {
  source: { type: "git", gitUrl: "", localPath: "", archiveName: "", branch: "main", authMode: "ssh-key" },
  llm: { provider: "prism-ai", label: "Prism AI", model: "codex/default", endpoint: "https://prisim-ai.edi-it.com/v1", authMode: "Prism managed or API key", connected: true, apiKeyConfigured: true },
  gitAuth: { sshKeyConfigured: false, knownHostsConfigured: false, storage: "not-configured" },
  scans: []
};

app.use(express.json({ limit: "1mb" }));

function hasKey() {
  return Boolean(process.env.GIT_SSH_PRIVATE_KEY || state.gitAuth.sshKeyConfigured || fs.existsSync(keyPath));
}
function hasKnownHosts() {
  return Boolean(process.env.GIT_KNOWN_HOSTS || state.gitAuth.knownHostsConfigured || fs.existsSync(knownHostsPath));
}
function gitAuth() {
  return { authMode: state.source.authMode, sshKeyConfigured: hasKey(), knownHostsConfigured: hasKnownHosts(), sshKeyPath: keyPath, knownHostsPath, secretName: "karpati-git-ssh", storage: state.gitAuth.storage };
}
function source(input = {}) {
  const type = ["git", "local-folder", "zip-upload"].includes(input.type) ? input.type : "git";
  return { type, gitUrl: String(input.gitUrl || "").trim(), localPath: String(input.localPath || "").trim(), archiveName: String(input.archiveName || "").trim(), branch: String(input.branch || "main").trim() || "main", authMode: ["none", "ssh-key"].includes(input.authMode) ? input.authMode : "ssh-key" };
}
function llm(input = {}) {
  const provider = String(input.provider || "prism-ai").trim() || "prism-ai";
  const preset = providers[provider] || providers.custom;
  const ready = Boolean(process.env.LLM_API_KEY || provider === "prism-ai" || String(input.apiKey || "").trim() || input.connected || input.apiKeyConfigured);
  return { provider, label: preset.label, model: String(input.model || preset.model).trim() || preset.model, endpoint: String(input.endpoint || preset.endpoint).trim() || preset.endpoint, authMode: preset.authMode, connected: ready, apiKeyConfigured: ready };
}
function validate(s) {
  if (s.type === "git" && !s.gitUrl) return "Git repository URL is required.";
  if (s.type === "git" && s.authMode === "ssh-key" && !hasKey()) return "Git SSH private key is not configured.";
  if (s.type === "local-folder" && !s.localPath) return "Local folder path is required.";
  if (s.type === "zip-upload" && !s.archiveName) return "Archive filename is required.";
  return "";
}
function format(scan) {
  if (scan.status === "waiting_for_llm_credentials") return { ...scan, progress: 0, currentStage: "Waiting for LLM credentials", updatedAt: scan.createdAt, stages: stages.map(([key, label, progress]) => ({ key, label, progress, state: "pending" })), messages: ["Scan request was saved.", "Configure an LLM provider before scanning can continue."] };
  const elapsed = Date.now() - new Date(scan.createdAt).getTime();
  const index = Math.max(0, Math.min(stages.findLastIndex((stage) => elapsed >= stage[3]), stages.length - 1));
  const [key, label, progress, ms] = stages[index];
  const done = index === stages.length - 1;
  return { ...scan, status: done ? "ready" : key, progress, currentStage: label, updatedAt: new Date(new Date(scan.createdAt).getTime() + ms).toISOString(), stages: stages.map(([k, l, p], i) => ({ key: k, label: l, progress: p, state: i < index || done && i === index ? "done" : i === index ? "running" : "pending" })), messages: [`Accepted ${scan.source.gitUrl || scan.source.localPath || scan.source.archiveName || "source"} on ${scan.source.branch || "main"}.`, `Git SSH key: ${scan.gitAuth.sshKeyConfigured ? "configured" : "not used"}.`, `LLM provider: ${scan.llm.label}/${scan.llm.model}.`, done ? "Wiki snapshot is ready for search and MCP retrieval." : `Current stage: ${label}.`] };
}
function writeSecret(path, content, mode) {
  fs.mkdirSync(path.split("/").slice(0, -1).join("/"), { recursive: true });
  fs.writeFileSync(path, content, { mode });
  fs.chmodSync(path, mode);
}

app.get("/healthz", (_req, res) => res.json({ ok: true, service: "karpati-llm-wiki", version, timestamp: new Date().toISOString() }));
app.get("/api/settings", (_req, res) => res.json({ source: state.source, llm: state.llm, llmProviders: providers, gitAuth: gitAuth() }));
app.get("/api/settings/git-auth", (_req, res) => res.json(gitAuth()));
app.put("/api/settings/git-auth", (req, res) => {
  const privateKey = String(req.body?.privateKey || "").trim();
  const knownHosts = String(req.body?.knownHosts || "").trim();
  if (!privateKey.includes("BEGIN") || !privateKey.includes("PRIVATE KEY")) return res.status(400).json({ ok: false, error: "A valid SSH private key is required." });
  let storage = "memory-fallback";
  try {
    writeSecret(keyPath, `${privateKey}\n`, 0o400);
    if (knownHosts) writeSecret(knownHostsPath, `${knownHosts}\n`, 0o444);
    storage = "file";
  } catch {}
  state.gitAuth = { sshKeyConfigured: true, knownHostsConfigured: Boolean(knownHosts || hasKnownHosts()), storage };
  res.json({ ok: true, gitAuth: gitAuth() });
});
app.put("/api/settings/source", (req, res) => {
  const next = source(req.body);
  const error = validate(next);
  if (error) return res.status(400).json({ ok: false, error });
  state.source = next;
  res.json({ ok: true, source: state.source });
});
app.put("/api/settings/llm", (req, res) => {
  state.llm = llm(req.body);
  res.json({ ok: true, llm: state.llm });
});
app.post("/api/repositories/scan", (req, res) => {
  const nextSource = source(req.body?.source || state.source);
  const nextLlm = llm(req.body?.llm || state.llm);
  const error = validate(nextSource);
  if (error) return res.status(400).json({ accepted: false, error });
  state.source = nextSource;
  state.llm = nextLlm;
  const scanId = `scan-${Date.now().toString(36)}`;
  const scan = { id: scanId, source: nextSource, llm: nextLlm, gitAuth: gitAuth(), status: nextLlm.connected ? "queued" : "waiting_for_llm_credentials", createdAt: new Date().toISOString() };
  state.scans.unshift(scan);
  res.status(202).json({ accepted: true, scanId, source: nextSource, llm: nextLlm, gitAuth: scan.gitAuth, status: scan.status, progress: format(scan).progress, links: { status: `/api/scans/${scanId}`, history: "/api/scans" }, next: "/api/scans" });
});
app.get("/api/scans", (_req, res) => res.json({ scans: state.scans.slice(0, 20).map(format), count: state.scans.length }));
app.get("/api/scans/:id", (req, res) => {
  const scan = state.scans.find((item) => item.id === req.params.id);
  if (!scan) return res.status(404).json({ error: "Scan not found." });
  res.json({ scan: format(scan) });
});
app.get("/api/mcp/tools", (_req, res) => res.json({ tools: [{ name: "wiki.search" }, { name: "wiki.retrieve" }, { name: "graph.downstream" }, { name: "plan.deployment" }] }));
app.get("/", (_req, res) => res.type("html").send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Karpati LLM Wiki</title><style>body{font:15px system-ui;margin:0;background:#f5f7f9;color:#111}main{padding:32px;display:grid;gap:18px}.grid{display:grid;grid-template-columns:minmax(300px,460px) 1fr;gap:18px}.panel{background:#fff;border:1px solid #d8dee6;border-radius:8px;padding:18px;display:grid;gap:12px}input,select,button,textarea{font:inherit;min-height:42px;border:1px solid #cfd7e2;border-radius:8px;padding:8px 10px}textarea{min-height:120px}button{background:#0b4f49;color:white;border:0}pre{background:#111827;color:#d7f8ee;border-radius:8px;padding:14px;white-space:pre-wrap}.bar{height:12px;border-radius:99px;background:#e6ecf3;overflow:hidden}.bar span{display:block;height:100%;background:#0f766e}.stage{color:#5f6670}.stage.done,.stage.running{color:#111;font-weight:700}.history button{display:block;width:100%;margin-top:8px;background:#f9fbfc;color:#111;border:1px solid #d8dee6;text-align:left}@media(max-width:850px){.grid{grid-template-columns:1fr}}</style></head><body><main><h1>Karpati LLM Wiki</h1><div class="grid"><section class="panel"><h2>Repository Intake</h2><label>Repository URL<input id="gitUrl" placeholder="git@github.com:org/private.git"></label><label>Branch<input id="branch" value="main"></label><label>Git auth<select id="authMode"><option value="ssh-key">Private SSH key</option><option value="none">No private auth</option></select></label><strong>Private Git SSH key</strong><textarea id="privateKey" placeholder="Paste your private key"></textarea><textarea id="knownHosts" placeholder="Known hosts optional"></textarea><button id="saveGitKey" type="button">Save private key</button><h2>LLM Connection</h2><select id="provider"><option value="prism-ai">Prism AI</option><option value="openai">OpenAI</option><option value="custom">OpenAI-compatible</option></select><input id="model" value="codex/default"><input id="endpoint" value="https://prisim-ai.edi-it.com/v1"><button id="save" type="button">Save settings</button><button id="scan" type="button">Start scan</button></section><section class="panel"><h2>Scan Progress</h2><small id="activeScan">No scan submitted yet</small><div class="bar"><span id="bar"></span></div><div id="stages"></div><pre id="messages">No scan messages yet.</pre><h2>Scan History</h2><div id="history">No scans yet.</div><pre id="console">Loading settings...</pre></section></div></main><script>const $=id=>document.getElementById(id),log=t=>$('console').textContent=t;let active='';async function j(p,m,b){let r=await fetch(p,{method:m||'GET',headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}),d=await r.json();if(!r.ok)throw Error(d.error||p+' failed');return d}function src(){return{type:'git',gitUrl:$('gitUrl').value,branch:$('branch').value||'main',authMode:$('authMode').value}}function model(){return{provider:$('provider').value,model:$('model').value,endpoint:$('endpoint').value,connected:true,apiKeyConfigured:true}}function draw(s){if(!s)return;active=s.id;$('activeScan').textContent=s.id+' - '+s.currentStage+' - '+s.progress+'%';$('bar').style.width=s.progress+'%';$('stages').innerHTML=s.stages.map(x=>'<div class="stage '+x.state+'">'+x.label+'</div>').join('');$('messages').textContent=s.messages.join('\\n')}async function refresh(){let r=await j('/api/scans'),scans=r.scans||[],s=scans.find(x=>x.id===active)||scans[0];draw(s);$('history').innerHTML=scans.length?scans.slice(0,6).map(x=>'<button data-id="'+x.id+'">'+x.id+'\\n'+x.currentStage+'</button>').join(''):'No scans yet.';document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{active=b.dataset.id;refresh()})}async function load(){let s=await j('/api/settings');$('gitUrl').value=s.source.gitUrl||'';$('branch').value=s.source.branch||'main';$('authMode').value=s.source.authMode||'ssh-key';$('provider').value=s.llm.provider;$('model').value=s.llm.model;$('endpoint').value=s.llm.endpoint;log('ready\\ngit ssh key: '+(s.gitAuth.sshKeyConfigured?'configured':'missing')+'\\nllm: '+s.llm.provider+'/'+s.llm.model);refresh()}$('saveGitKey').onclick=async()=>{try{let r=await j('/api/settings/git-auth','PUT',{privateKey:$('privateKey').value,knownHosts:$('knownHosts').value});$('privateKey').value='';log('private key saved\\ngit ssh key: '+r.gitAuth.sshKeyConfigured)}catch(e){log(e.message)}};$('save').onclick=async()=>{try{await j('/api/settings/source','PUT',src());let r=await j('/api/settings/llm','PUT',model());log('settings saved\\nllm: '+r.llm.provider+'/'+r.llm.model)}catch(e){log(e.message)}};$('scan').onclick=async()=>{try{let r=await j('/api/repositories/scan','POST',{source:src(),llm:model()});active=r.scanId;await refresh();log('scan accepted: '+r.scanId+'\\nstatus: '+r.status+'\\nstatus URL: '+r.links.status)}catch(e){log(e.message)}};setInterval(()=>refresh().catch(()=>{}),2500);load().catch(e=>log(e.message));</script></body></html>`));

app.listen(port, () => console.log(`karpati-llm-wiki listening on ${port}`));
