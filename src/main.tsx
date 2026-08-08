import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Archive,
  BookOpenCheck,
  Bot,
  Braces,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileSearch,
  FileText,
  GitBranch,
  KeyRound,
  Link2,
  ListChecks,
  Network,
  Play,
  Route,
  Save,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import "./styles.css";

type SourceMode = "git" | "local-folder" | "zip-upload";

type SourceSettings = {
  type: SourceMode;
  gitUrl: string;
  localPath: string;
  archiveName: string;
  branch: string;
  authMode: "none" | "ssh-key";
};

type LlmSettings = {
  provider: string;
  label?: string;
  model: string;
  endpoint: string;
  apiKey: string;
  authMode?: string;
  connected?: boolean;
  apiKeyConfigured?: boolean;
};

type WikiPage = {
  id?: string;
  title: string;
  filename?: string;
  path?: string;
  folder?: string;
  tags?: string[];
  aliases?: string[];
  summary: string;
  freshness: string;
  confidence: number;
  links?: string[];
  relationships?: string[];
  backlinks?: string[];
  citations?: string[];
  contextWindows?: string[];
  markdown?: string;
  generatedAt?: string;
  scanId?: string;
};

type WikiSnapshot = {
  id: string;
  scanId: string;
  generatedAt: string;
  pageCount: number;
  pattern?: string;
  layers?: string[];
  vault?: {
    root: string;
    rawRoot?: string;
    generatedRoot?: string;
    schemaPath?: string;
    folders: string[];
    tags: string[];
    files: string[];
  };
  pages: WikiPage[];
};

type ScanStage = {
  key: string;
  label: string;
  progress: number;
  state: "done" | "running" | "pending";
};

type ScanRecord = {
  id: string;
  status: string;
  progress: number;
  currentStage: string;
  createdAt: string;
  updatedAt: string;
  source: SourceSettings;
  llm: LlmSettings;
  stages: ScanStage[];
  messages: string[];
  wikiSnapshot?: WikiSnapshot | null;
};

type WikiAnswer = {
  question: string;
  snapshotId: string;
  scanId: string;
  mode: string;
  answer: string[];
  sources: Array<{ id: string; title: string; path: string; summary: string; citations: string[] }>;
  loggedAt: string;
};

type StorageStatus = {
  mode: string;
  durable: boolean;
  path: string;
  exists: boolean;
  bytes: number;
  savedAt: string | null;
  scans: number;
  snapshots: number;
  rawSources?: number;
  questions: number;
};

type RawSource = {
  id: string;
  scanId: string;
  name: string;
  type: string;
  branch: string;
  capturedAt: string;
  immutable: boolean;
  mutableByLlm: boolean;
  path: string;
  policy: string;
};

type LintFinding = {
  severity?: string;
  page?: string;
  title?: string;
  message?: string;
  detail?: string;
};

type AiAssistance = {
  intent: string;
  pageId: string;
  title: string;
  scanId: string;
  model: string;
  explanation: string[];
  suggestions: string[];
  improvedMarkdown: string;
};

const providerPresets: Record<string, { label: string; model: string; endpoint: string; authMode: string }> = {
  "prism-ai": {
    label: "Prism AI",
    model: "codex/default",
    endpoint: "https://prisim-ai.edi-it.com/v1",
    authMode: "Prism managed or API key"
  },
  openai: {
    label: "OpenAI",
    model: "gpt-5-mini",
    endpoint: "https://api.openai.com/v1",
    authMode: "API key"
  },
  anthropic: {
    label: "Claude",
    model: "claude-sonnet-4",
    endpoint: "https://api.anthropic.com/v1",
    authMode: "API key"
  },
  gemini: {
    label: "Gemini",
    model: "gemini-2.5-pro",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    authMode: "API key"
  },
  custom: {
    label: "OpenAI-compatible",
    model: "gpt-5-mini",
    endpoint: "https://example.com/v1",
    authMode: "API key"
  }
};

const fallbackPages: WikiPage[] = [
  {
    id: "seed-agents",
    title: "AGENTS.md",
    path: "AGENTS.md",
    folder: "root",
    tags: ["#schema", "#workflow"],
    summary: "Rules that keep the LLM wiki disciplined: raw sources are immutable, generated pages are maintained, answers are filed.",
    freshness: "Seeded",
    confidence: 0.99,
    links: ["index.md", "log.md"],
    relationships: ["index.md", "log.md"],
    backlinks: [],
    citations: ["karpathy:gist"],
    contextWindows: ["The schema is the operating contract for future agents."],
    markdown:
      "# AGENTS.md\n\n## Roles\n- Human owns source curation, review, and emphasis.\n- LLM owns generated Markdown wiki maintenance.\n- Raw sources are immutable and must never be edited by the LLM.\n\n## Workflow\n- Ingest immutable raw sources.\n- Update related pages, index.md, and log.md.\n- File valuable answers into queries/*.md.\n- Run lint for contradictions, stale claims, orphans, missing cross-references, and data gaps.\n\n## Conventions\n- Use [[Wiki Links]] for relationships.\n- Keep summaries, tags, provenance, confidence, and citations visible.\n- Cite raw source IDs and scan IDs rather than vague memory."
  },
  {
    id: "seed-index",
    title: "index.md",
    path: "index.md",
    folder: "root",
    tags: ["#index", "#navigation"],
    summary: "Content-oriented catalog of every generated page, grouped for both humans and agents.",
    freshness: "Seeded",
    confidence: 0.98,
    links: ["Architecture", "Deployment", "API", "Runbooks"],
    relationships: ["Architecture", "Deployment", "API", "Runbooks"],
    backlinks: ["AGENTS.md"],
    citations: ["karpathy:gist"],
    contextWindows: ["Read index.md first before answering questions."],
    markdown:
      "# index.md\n\nContent-oriented catalog for the generated LLM-owned wiki.\n\n## overview\n- [[Architecture]] - System map, service boundaries, and data flow.\n\n## operations\n- [[Deployment]] - Release path, runtime target, and rollout proof.\n- [[Runbooks]] - Operator paths and repeatable checks.\n\n## reference\n- [[API]] - Endpoint contracts and consumers."
  },
  {
    id: "seed-architecture",
    title: "Architecture",
    path: "overview/Architecture.md",
    folder: "overview",
    tags: ["#architecture", "#system-map"],
    summary: "A persistent wiki sits between raw sources and agent answers, compiling knowledge once and maintaining it over time.",
    freshness: "Seeded",
    confidence: 0.9,
    links: ["Deployment", "API", "Runbooks"],
    relationships: ["Deployment", "API", "Runbooks"],
    backlinks: ["index.md"],
    citations: ["karpathy:gist"],
    contextWindows: ["Raw sources feed generated Markdown pages, index.md, log.md, lint, and MCP retrieval."],
    markdown:
      "# Architecture\n\n**Summary**: The system turns curated sources into a persistent, interlinked Markdown wiki.\n\n## Layers\n- Raw sources are immutable evidence.\n- The wiki is generated Markdown owned by the LLM.\n- AGENTS.md is the schema that defines workflows and conventions.\n- index.md helps retrieval; log.md preserves chronology.\n\n## Flow\nRaw source -> ingest -> generated pages -> graph/index/log -> questions -> filed answers.\n\n## Related Notes\n[[Deployment]], [[API]], [[Runbooks]]"
  },
  {
    id: "seed-deployment",
    title: "Deployment",
    path: "operations/Deployment.md",
    folder: "operations",
    tags: ["#deployment", "#runtime"],
    summary: "Deployment records build inputs, image tags, routes, environment, rollout state, and verification evidence.",
    freshness: "Seeded",
    confidence: 0.86,
    links: ["Architecture", "Runbooks", "API"],
    relationships: ["Architecture", "Runbooks", "API"],
    backlinks: ["index.md", "Architecture"],
    citations: ["karpathy:gist"],
    contextWindows: ["A deployed wiki should expose docs visually and answer questions with citations."],
    markdown:
      "# Deployment\n\n**Summary**: Deployment knowledge makes production state readable to future agents.\n\n## Runtime Target\n- Container image and version.\n- Service, route, and health endpoint.\n- Environment settings for source intake and LLM provider.\n\n## Verification\n- Build passes.\n- Smoke test passes.\n- Health endpoint returns version.\n- Wiki endpoints return pages, lint, sources, and answers.\n\n## Related Notes\n[[Architecture]], [[Runbooks]], [[API]]"
  },
  {
    id: "seed-api",
    title: "API",
    path: "reference/API.md",
    folder: "reference",
    tags: ["#api", "#mcp"],
    summary: "API endpoints expose settings, scans, generated pages, graph, lint, raw sources, questions, and MCP tool descriptors.",
    freshness: "Seeded",
    confidence: 0.87,
    links: ["Architecture", "Deployment"],
    relationships: ["Architecture", "Deployment"],
    backlinks: ["index.md"],
    citations: ["karpathy:gist"],
    contextWindows: ["The UI uses the same API surface future MCP adapters can consume."],
    markdown:
      "# API\n\n## Wiki Endpoints\n- GET /api/wiki/pages\n- GET /api/wiki/pages/:id\n- GET /api/wiki/raw-sources\n- GET /api/wiki/lint\n- POST /api/wiki/ask\n- GET /api/mcp/tools\n\n## Contract\nAnswers must include cited pages and can be filed back into queries/*.md."
  },
  {
    id: "seed-runbooks",
    title: "Runbooks",
    path: "operations/Runbooks.md",
    folder: "operations",
    tags: ["#runbooks", "#ops"],
    summary: "Runbooks convert repeated maintenance into reliable operator paths, keeping fixes in the wiki instead of chat history.",
    freshness: "Seeded",
    confidence: 0.84,
    links: ["Deployment", "Architecture"],
    relationships: ["Deployment", "Architecture"],
    backlinks: ["index.md"],
    citations: ["karpathy:gist"],
    contextWindows: ["Every incident or useful answer should become durable wiki memory."],
    markdown:
      "# Runbooks\n\n## Ask and File\n- Read index.md.\n- Retrieve relevant pages.\n- Answer with citations.\n- File useful answers into queries/*.md.\n- Append log.md.\n\n## Lint\nCheck contradictions, stale claims, orphans, missing cross-links, and data gaps."
  }
];

const pipeline = [
  { title: "Raw sources", detail: "Immutable evidence layer", icon: <Archive size={18} /> },
  { title: "Generated wiki", detail: "LLM-owned Markdown pages", icon: <FileText size={18} /> },
  { title: "AGENTS.md", detail: "Schema and workflow rules", icon: <ShieldCheck size={18} /> },
  { title: "index.md", detail: "Catalog for navigation", icon: <Route size={18} /> },
  { title: "log.md", detail: "Append-only history", icon: <Clock3 size={18} /> },
  { title: "Ask + file", detail: "Answers become pages", icon: <Bot size={18} /> }
];

function formatDate(value?: string | null) {
  if (!value) return "not saved yet";
  return new Date(value).toLocaleString();
}

function compactPath(path = "") {
  return path.length > 34 ? `...${path.slice(-31)}` : path;
}

function sourceLabel(source: SourceSettings) {
  if (source.type === "git") return source.gitUrl || "No Git repository set";
  if (source.type === "local-folder") return source.localPath || "No local folder set";
  return source.archiveName || "No archive selected";
}

function renderInlineWikiLinks(text: string, onNavigate: (title: string) => void) {
  return text.split(/(\[\[[^\]]+\]\])/g).map((part, index) => {
    const match = part.match(/^\[\[([^\]]+)\]\]$/);
    if (!match) return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    return (
      <button className="wiki-link" type="button" key={`${part}-${index}`} onClick={() => onNavigate(match[1])}>
        {match[1]}
      </button>
    );
  });
}

function MarkdownView({ markdown, onNavigate }: { markdown: string; onNavigate: (title: string) => void }) {
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let inCode = false;

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineWikiLinks(item, onNavigate)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const flushCode = () => {
    if (!codeLines.length) return;
    nodes.push(<pre key={`code-${nodes.length}`}>{codeLines.join("\n")}</pre>);
    codeLines = [];
  };

  markdown.split("\n").forEach((line, index) => {
    if (line.startsWith("```")) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        flushList();
        inCode = true;
      }
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      return;
    }
    flushList();
    if (line.startsWith("# ")) nodes.push(<h1 key={index}>{renderInlineWikiLinks(line.slice(2), onNavigate)}</h1>);
    else if (line.startsWith("## ")) nodes.push(<h2 key={index}>{renderInlineWikiLinks(line.slice(3), onNavigate)}</h2>);
    else if (line.startsWith("### ")) nodes.push(<h3 key={index}>{renderInlineWikiLinks(line.slice(4), onNavigate)}</h3>);
    else if (line.trim() === "---") nodes.push(<hr key={index} />);
    else if (line.trim()) nodes.push(<p key={index}>{renderInlineWikiLinks(line, onNavigate)}</p>);
  });
  flushList();
  flushCode();

  return <div className="markdown-doc">{nodes}</div>;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="stat">
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function App() {
  const [source, setSource] = React.useState<SourceSettings>({
    type: "git",
    gitUrl: "",
    localPath: "",
    archiveName: "",
    branch: "main",
    authMode: "ssh-key"
  });
  const [llm, setLlm] = React.useState<LlmSettings>({
    provider: "prism-ai",
    label: "Prism AI",
    model: "codex/default",
    endpoint: "https://prisim-ai.edi-it.com/v1",
    apiKey: "",
    authMode: "Prism managed or API key",
    connected: false
  });
  const [gitAuth, setGitAuth] = React.useState({
    sshKeyConfigured: false,
    knownHostsConfigured: false,
    secretName: "karpati-git-ssh",
    sshKeyPath: "/app/secrets/git/id_rsa",
    knownHostsPath: "/app/secrets/git/known_hosts",
    storage: "not-configured"
  });
  const [gitSecret, setGitSecret] = React.useState({ privateKey: "", knownHosts: "" });
  const [storage, setStorage] = React.useState<StorageStatus | null>(null);
  const [scanHistory, setScanHistory] = React.useState<ScanRecord[]>([]);
  const [activeScan, setActiveScan] = React.useState<ScanRecord | null>(null);
  const [wikiSnapshot, setWikiSnapshot] = React.useState<WikiSnapshot | null>(null);
  const [selectedPageId, setSelectedPageId] = React.useState("seed-agents");
  const [selectedPage, setSelectedPage] = React.useState<WikiPage | null>(fallbackPages[0]);
  const [query, setQuery] = React.useState("");
  const [selectedFolder, setSelectedFolder] = React.useState("all");
  const [question, setQuestion] = React.useState("What should an agent read before changing deployment?");
  const [answer, setAnswer] = React.useState<WikiAnswer | null>(null);
  const [rawSources, setRawSources] = React.useState<RawSource[]>([]);
  const [lintFindings, setLintFindings] = React.useState<LintFinding[]>([]);
  const [mcpTools, setMcpTools] = React.useState<Array<{ name: string; description?: string; detail?: string }>>([]);
  const [aiAssistance, setAiAssistance] = React.useState<AiAssistance | null>(null);
  const [busy, setBusy] = React.useState("");
  const [notice, setNotice] = React.useState("Run Demo Wiki to create a complete visual vault from the Karpathy pattern.");

  const pages = wikiSnapshot?.pages?.length ? wikiSnapshot.pages : fallbackPages;
  const folders = ["all", ...Array.from(new Set(pages.map((page) => page.folder || "root"))).sort()];
  const selected = selectedPage || pages.find((page) => page.id === selectedPageId) || pages[0];
  const relationships = selected?.links || selected?.relationships || [];
  const filteredPages = pages.filter((page) => {
    const haystack = `${page.title} ${page.path || ""} ${page.summary} ${(page.tags || []).join(" ")} ${(page.links || []).join(" ")}`.toLowerCase();
    return (selectedFolder === "all" || page.folder === selectedFolder) && (!query || haystack.includes(query.toLowerCase()));
  });

  const refreshStorage = React.useCallback(async () => {
    const response = await fetch("/api/storage");
    if (!response.ok) return;
    const payload = await response.json();
    setStorage(payload.storage || null);
  }, []);

  const selectWikiPage = React.useCallback(
    async (pageOrTitle: WikiPage | string) => {
      const pageId =
        typeof pageOrTitle === "string"
          ? pages.find((page) => page.title === pageOrTitle || page.id === pageOrTitle)?.id || pageOrTitle
          : pageOrTitle.id || pageOrTitle.title;
      setSelectedPageId(pageId);
      setAiAssistance(null);
      const response = await fetch(`/api/wiki/pages/${encodeURIComponent(pageId)}`);
      if (!response.ok) {
        setSelectedPage(pages.find((page) => page.id === pageId || page.title === pageId) || null);
        return;
      }
      const payload = await response.json();
      setSelectedPage(payload.page);
    },
    [pages]
  );

  const refreshWiki = React.useCallback(async () => {
    const response = await fetch("/api/wiki/snapshots/latest");
    if (response.ok) {
      const payload = await response.json();
      if (payload.snapshot?.pages?.length) {
        setWikiSnapshot(payload.snapshot);
        const first = payload.snapshot.pages[0];
        setSelectedPageId((current) => current || first.id);
        if (!selectedPage) setSelectedPage(first);
      }
    }
    const sourcesResponse = await fetch("/api/wiki/raw-sources");
    if (sourcesResponse.ok) {
      const payload = await sourcesResponse.json();
      setRawSources(Array.isArray(payload.rawSources) ? payload.rawSources : []);
    }
    const lintResponse = await fetch("/api/wiki/lint");
    if (lintResponse.ok) {
      const payload = await lintResponse.json();
      setLintFindings(Array.isArray(payload.findings) ? payload.findings : []);
    }
    const toolsResponse = await fetch("/api/mcp/tools");
    if (toolsResponse.ok) {
      const payload = await toolsResponse.json();
      setMcpTools(Array.isArray(payload.tools) ? payload.tools : []);
    }
    await refreshStorage();
  }, [refreshStorage, selectedPage]);

  const refreshScans = React.useCallback(async () => {
    const response = await fetch("/api/scans");
    if (!response.ok) return;
    const payload = await response.json();
    const scans = Array.isArray(payload.scans) ? payload.scans : [];
    setScanHistory(scans);
    const latest = scans[0] || null;
    setActiveScan(latest);
    if (latest?.wikiSnapshot) {
      setWikiSnapshot(latest.wikiSnapshot);
      setSelectedPage(latest.wikiSnapshot.pages[0] || null);
      setSelectedPageId(latest.wikiSnapshot.pages[0]?.id || "");
    }
  }, []);

  React.useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((settings) => {
        if (settings.source) setSource(settings.source);
        if (settings.llm) setLlm((current) => ({ ...current, ...settings.llm, apiKey: "" }));
        if (settings.gitAuth) setGitAuth(settings.gitAuth);
      })
      .catch(() => setNotice("Settings API is not reachable yet."));
    refreshScans().catch(() => undefined);
    refreshWiki().catch(() => undefined);
  }, [refreshScans, refreshWiki]);

  const saveSettings = async () => {
    setBusy("settings");
    try {
      const sourceResponse = await fetch("/api/settings/source", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(source)
      });
      const sourcePayload = await sourceResponse.json();
      if (!sourceResponse.ok) {
        setNotice(sourcePayload.error || "Source settings were rejected.");
        return false;
      }
      const llmResponse = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(llm)
      });
      const llmPayload = await llmResponse.json();
      if (!llmResponse.ok) {
        setNotice(llmPayload.error || "LLM settings were rejected.");
        return false;
      }
      setLlm((current) => ({ ...current, ...llmPayload.llm, apiKey: "" }));
      setNotice("Settings saved. The next scan will use this source and model.");
      await refreshStorage();
      return true;
    } finally {
      setBusy("");
    }
  };

  const saveGitAuth = async () => {
    setBusy("git-auth");
    try {
      const response = await fetch("/api/settings/git-auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gitSecret)
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error || "Git SSH key was rejected.");
        return;
      }
      setGitAuth(payload.gitAuth);
      setGitSecret((current) => ({ ...current, privateKey: "" }));
      setNotice("Private Git SSH key saved. It will not be echoed back.");
    } finally {
      setBusy("");
    }
  };

  const runScan = async (demo = false) => {
    setBusy(demo ? "demo" : "scan");
    setNotice(demo ? "Generating a complete demo wiki vault..." : "Submitting repository scan...");
    try {
      const response = await fetch(demo ? "/api/demo/scan" : "/api/repositories/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demo ? {} : { source, llm })
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error || "Scan request failed.");
        return;
      }
      setNotice(`${payload.scanId} accepted. Wiki pages, index.md, log.md, and raw-source records are available.`);
      await refreshScans();
      await refreshWiki();
    } finally {
      setBusy("");
    }
  };

  const askWiki = async () => {
    if (!question.trim()) return;
    setBusy("ask");
    try {
      const response = await fetch("/api/wiki/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error || "Wiki question failed.");
        return;
      }
      setAnswer(payload.result);
      setNotice(`Answer filed from ${payload.result.sources.length} cited page(s).`);
      await refreshWiki();
    } finally {
      setBusy("");
    }
  };

  const askPage = async (intent: "explain" | "improve") => {
    if (!selected?.id) return;
    setBusy(intent);
    try {
      const response = await fetch(`/api/wiki/pages/${encodeURIComponent(selected.id)}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent })
      });
      const payload = await response.json();
      if (!response.ok) {
        setNotice(payload.error || "AI page action failed.");
        return;
      }
      setAiAssistance(payload.assistance);
      setNotice(`Generated ${intent} notes for ${payload.assistance.title}.`);
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Karpati LLM Wiki home">
          <span className="brand-mark">K</span>
          <span>Karpati LLM Wiki</span>
        </a>
        <nav aria-label="Primary">
          <a href="#vault">Vault</a>
          <a href="#ask">Ask</a>
          <a href="#graph">Graph</a>
          <a href="#lint">Lint</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="system-pill">
            <Sparkles size={15} /> Karpathy pattern implemented
          </span>
          <h1>Docs that compound into agent memory.</h1>
          <p>Browse generated Markdown, inspect raw evidence, ask cited questions, and file useful answers back into the wiki.</p>
          <div className="hero-actions">
            <button className="primary-action" type="button" onClick={() => runScan(true)} disabled={busy === "demo"}>
              <Sparkles size={18} /> {busy === "demo" ? "Generating" : "Run Demo Wiki"}
            </button>
            <button className="secondary-action" type="button" onClick={() => runScan(false)} disabled={busy === "scan"}>
              <Play size={18} /> {busy === "scan" ? "Scanning" : "Scan Source"}
            </button>
          </div>
        </div>
        <div className="hero-vault" aria-label="LLM wiki architecture">
          {pipeline.map((item, index) => (
            <div className="vault-step" key={item.title}>
              <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="step-icon">{item.icon}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="status-strip" aria-label="System status">
        <Stat icon={<Database size={18} />} value={String(storage?.snapshots ?? (wikiSnapshot ? 1 : 0))} label="wiki snapshots" />
        <Stat icon={<FileText size={18} />} value={String(wikiSnapshot?.pageCount ?? pages.length)} label="visible docs" />
        <Stat icon={<Archive size={18} />} value={String(rawSources.length || storage?.rawSources || 0)} label="raw sources" />
        <Stat icon={<Bot size={18} />} value={String(storage?.questions ?? 0)} label="filed answers" />
        <Stat icon={<Braces size={18} />} value={String(mcpTools.length || 0)} label="MCP tools" />
      </section>

      <section className="notice-line" aria-live="polite">
        <Activity size={17} />
        <span>{notice}</span>
      </section>

      <section className="workspace" id="vault">
        <aside className="control-panel" aria-label="Source and scan controls">
          <div className="panel-title">
            <h2>Source Intake</h2>
            <p>Raw sources stay append-only. Generated Markdown changes around them.</p>
          </div>

          <div className="segmented" role="tablist" aria-label="Source type">
            {[
              ["git", "Git"],
              ["local-folder", "Folder"],
              ["zip-upload", "ZIP"]
            ].map(([value, label]) => (
              <button
                key={value}
                className={source.type === value ? "selected" : ""}
                onClick={() => setSource((current) => ({ ...current, type: value as SourceMode }))}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {source.type === "git" && (
            <>
              <label htmlFor="repo">Repository URL</label>
              <input
                id="repo"
                className="field"
                value={source.gitUrl}
                placeholder="https://github.com/org/repo.git"
                onChange={(event) => setSource((current) => ({ ...current, gitUrl: event.target.value }))}
              />
              <label htmlFor="branch">Branch or ref</label>
              <input
                id="branch"
                className="field"
                value={source.branch}
                onChange={(event) => setSource((current) => ({ ...current, branch: event.target.value }))}
              />
              <label htmlFor="auth">Git auth</label>
              <select
                id="auth"
                className="field"
                value={source.authMode}
                onChange={(event) => setSource((current) => ({ ...current, authMode: event.target.value as SourceSettings["authMode"] }))}
              >
                <option value="ssh-key">Private SSH key</option>
                <option value="none">No private auth</option>
              </select>
            </>
          )}

          {source.type === "local-folder" && (
            <>
              <label htmlFor="folder">Local folder</label>
              <input
                id="folder"
                className="field"
                value={source.localPath}
                placeholder="/workspace/repos/project"
                onChange={(event) => setSource((current) => ({ ...current, localPath: event.target.value }))}
              />
            </>
          )}

          {source.type === "zip-upload" && (
            <>
              <label htmlFor="archive">Archive name</label>
              <input
                id="archive"
                className="field"
                value={source.archiveName}
                placeholder="project.zip"
                onChange={(event) => setSource((current) => ({ ...current, archiveName: event.target.value }))}
              />
            </>
          )}

          {source.type === "git" && source.authMode === "ssh-key" && (
            <div className="secret-card">
              <div>
                <strong>{gitAuth.sshKeyConfigured ? "SSH key configured" : "SSH key needed"}</strong>
                <span>{gitAuth.storage === "file" ? compactPath(gitAuth.sshKeyPath) : gitAuth.secretName}</span>
              </div>
              <label htmlFor="private-key">Private key</label>
              <textarea
                id="private-key"
                className="field text-area"
                value={gitSecret.privateKey}
                placeholder="Paste private key. It will not be echoed back."
                onChange={(event) => setGitSecret((current) => ({ ...current, privateKey: event.target.value }))}
              />
              <label htmlFor="known-hosts">Known hosts</label>
              <textarea
                id="known-hosts"
                className="field text-area short"
                value={gitSecret.knownHosts}
                onChange={(event) => setGitSecret((current) => ({ ...current, knownHosts: event.target.value }))}
              />
              <button className="panel-button" type="button" onClick={saveGitAuth} disabled={busy === "git-auth"}>
                <KeyRound size={17} /> Save key
              </button>
            </div>
          )}

          <div className="provider-block">
            <label htmlFor="provider">LLM provider</label>
            <select
              id="provider"
              className="field"
              value={llm.provider}
              onChange={(event) => {
                const provider = event.target.value;
                const preset = providerPresets[provider] ?? providerPresets.custom;
                setLlm((current) => ({ ...current, provider, ...preset }));
              }}
            >
              {Object.entries(providerPresets).map(([value, preset]) => (
                <option value={value} key={value}>
                  {preset.label}
                </option>
              ))}
            </select>
            <label htmlFor="model">Model</label>
            <input
              id="model"
              className="field"
              value={llm.model}
              onChange={(event) => setLlm((current) => ({ ...current, model: event.target.value }))}
            />
            <label htmlFor="endpoint">Endpoint</label>
            <input
              id="endpoint"
              className="field"
              value={llm.endpoint}
              onChange={(event) => setLlm((current) => ({ ...current, endpoint: event.target.value }))}
            />
            <label htmlFor="api-key">API key</label>
            <input
              id="api-key"
              className="field"
              type="password"
              value={llm.apiKey}
              placeholder={llm.apiKeyConfigured ? "Configured" : "Paste key or use Prism managed auth"}
              onChange={(event) => setLlm((current) => ({ ...current, apiKey: event.target.value }))}
            />
          </div>

          <div className="button-row">
            <button className="panel-button" type="button" onClick={saveSettings} disabled={busy === "settings"}>
              <Save size={17} /> Save
            </button>
            <button className="panel-button dark" type="button" onClick={() => runScan(false)} disabled={busy === "scan"}>
              <Play size={17} /> Scan
            </button>
          </div>

          <div className="console">
            <span>$ llm-wiki ingest</span>
            <span>source: {sourceLabel(source)}</span>
            <span>provider: {llm.label || llm.provider}/{llm.model}</span>
            <span>storage: {storage?.exists ? compactPath(storage.path) : "waiting for first write"}</span>
            <span>latest: {activeScan ? `${activeScan.id} · ${activeScan.currentStage}` : "no scan yet"}</span>
          </div>
        </aside>

        <section className="doc-browser" aria-label="Generated wiki documents">
          <div className="browser-head">
            <div>
              <span>Generated Markdown Vault</span>
              <h2>All docs, visibly browsable</h2>
            </div>
            <a className="export-link" href="/api/wiki/export" target="_blank" rel="noreferrer">
              Export .md
            </a>
          </div>

          <div className="filter-bar">
            <div className="search-box">
              <Search size={17} />
              <input value={query} placeholder="Search pages, tags, citations..." onChange={(event) => setQuery(event.target.value)} />
            </div>
            <select value={selectedFolder} onChange={(event) => setSelectedFolder(event.target.value)} aria-label="Filter folder">
              {folders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
          </div>

          <div className="doc-layout">
            <div className="page-list" aria-label="Wiki page list">
              {filteredPages.map((page) => (
                <button
                  type="button"
                  key={page.id || page.title}
                  className={(selected?.id || selected?.title) === (page.id || page.title) ? "page-card selected" : "page-card"}
                  onClick={() => selectWikiPage(page)}
                >
                  <span>{page.folder || "root"}</span>
                  <strong>{page.title}</strong>
                  <small>{page.summary}</small>
                  <em>{Math.round((page.confidence || 0) * 100)}% confidence</em>
                </button>
              ))}
            </div>

            <article className="reader">
              <div className="reader-title">
                <span>{selected?.path || "wiki/page.md"}</span>
                <h2>{selected?.title || "Select a page"}</h2>
                <p>{selected?.summary}</p>
              </div>
              <div className="tag-row">
                {(selected?.tags || []).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <MarkdownView markdown={selected?.markdown || selected?.summary || ""} onNavigate={selectWikiPage} />
            </article>
          </div>
        </section>

        <aside className="answer-panel" id="ask" aria-label="Ask wiki">
          <div className="panel-title">
            <h2>Ask Wiki</h2>
            <p>Answers cite generated pages and can become durable query notes.</p>
          </div>
          <textarea
            className="question-box"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            aria-label="Ask a question"
          />
          <button className="ask-button" type="button" onClick={askWiki} disabled={busy === "ask"}>
            <Bot size={18} /> {busy === "ask" ? "Reading" : "Ask and file"}
          </button>

          {answer ? (
            <div className="answer-card">
              <span>Filed answer · {formatDate(answer.loggedAt)}</span>
              <h3>{answer.question}</h3>
              {answer.answer.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <div className="citation-list">
                {answer.sources.map((source) => (
                  <button type="button" key={source.id} onClick={() => selectWikiPage(source.id)}>
                    <FileSearch size={15} />
                    <span>{source.title}</span>
                    <small>{source.path}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-answer">
              <FileSearch size={24} />
              <p>Ask how a component works, what changed, what depends on something, or what to read before editing.</p>
            </div>
          )}

          <div className="page-actions">
            <button type="button" onClick={() => askPage("explain")} disabled={!selected || busy === "explain"}>
              <Sparkles size={16} /> Explain page
            </button>
            <button type="button" onClick={() => askPage("improve")} disabled={!selected || busy === "improve"}>
              <ListChecks size={16} /> Improve doc
            </button>
          </div>

          {aiAssistance ? (
            <div className="assist-card">
              <strong>{aiAssistance.title}</strong>
              {aiAssistance.explanation.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <ul>
                {aiAssistance.suggestions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="relationships">
            <h3>Current page relationships</h3>
            {relationships.length ? (
              relationships.map((relationship) => (
                <button type="button" key={relationship} onClick={() => selectWikiPage(relationship)}>
                  <Link2 size={15} /> {relationship}
                </button>
              ))
            ) : (
              <span>No linked pages yet.</span>
            )}
          </div>
        </aside>
      </section>

      <section className="graph-section" id="graph">
        <div className="section-title">
          <h2>Visual Wiki Graph</h2>
          <p>See how generated docs connect before asking questions or changing code.</p>
        </div>
        <div className="graph-board">
          {pages.slice(0, 12).map((page, index) => (
            <button
              type="button"
              className={`graph-node node-${index % 6}`}
              key={page.id || page.title}
              onClick={() => selectWikiPage(page)}
            >
              <Network size={17} />
              <strong>{page.title}</strong>
              <span>{page.folder || "root"}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="evidence-grid" id="lint">
        <article className="evidence-card">
          <div className="card-head">
            <Archive size={19} />
            <h2>Raw Sources</h2>
          </div>
          {rawSources.length ? (
            rawSources.map((source) => (
              <div className="evidence-row" key={source.id}>
                <strong>{source.name}</strong>
                <span>{source.path}</span>
                <small>{source.immutable ? "immutable" : "mutable"} · {source.branch}</small>
              </div>
            ))
          ) : (
            <p>No raw source records yet. Run Demo Wiki or scan a source.</p>
          )}
        </article>

        <article className="evidence-card">
          <div className="card-head">
            <CircleAlert size={19} />
            <h2>Lint Health</h2>
          </div>
          {lintFindings.length ? (
            lintFindings.slice(0, 8).map((finding, index) => (
              <div className="evidence-row" key={`${finding.message}-${index}`}>
                <strong>{finding.severity || "info"} · {finding.page || finding.title || "wiki"}</strong>
                <span>{finding.message || finding.detail || "Health finding"}</span>
              </div>
            ))
          ) : (
            <div className="good-state">
              <CheckCircle2 size={22} />
              <span>No lint findings returned for the current wiki.</span>
            </div>
          )}
        </article>

        <article className="evidence-card">
          <div className="card-head">
            <Braces size={19} />
            <h2>MCP Tools</h2>
          </div>
          {mcpTools.length ? (
            mcpTools.slice(0, 10).map((tool) => (
              <div className="evidence-row" key={tool.name}>
                <strong>{tool.name}</strong>
                <span>{tool.description || tool.detail || "Agent-facing wiki capability"}</span>
              </div>
            ))
          ) : (
            <p>MCP tools will appear after the API responds.</p>
          )}
        </article>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
