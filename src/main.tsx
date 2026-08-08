import React from "react";
import ReactDOM from "react-dom/client";
import {
  Archive,
  Activity,
  Bot,
  BookOpenCheck,
  Braces,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  FileCheck2,
  FileCode,
  FileText,
  FolderOpen,
  FileSearch,
  GitBranch,
  Link2,
  ListChecks,
  Network,
  NotebookText,
  Play,
  Route,
  Save,
  Search,
  Server,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Wand2
} from "lucide-react";
import "./styles.css";

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
  vault?: {
    root: string;
    folders: string[];
    tags: string[];
    files: string[];
  };
  pages: WikiPage[];
};

type Project = {
  name: string;
  source: string;
  status: string;
  completeness: number;
  lastScan: string;
};

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

type LlmProviderPreset = {
  label: string;
  model: string;
  endpoint: string;
  authMode: string;
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
  questions: number;
};

const providerPresets: Record<string, LlmProviderPreset> = {
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
  "azure-openai": {
    label: "Azure OpenAI",
    model: "gpt-5-mini",
    endpoint: "https://example-resource.openai.azure.com/openai/deployments/example",
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
  openrouter: {
    label: "OpenRouter",
    model: "openai/gpt-5-mini",
    endpoint: "https://openrouter.ai/api/v1",
    authMode: "API key"
  },
  ollama: {
    label: "Ollama",
    model: "llama3.1",
    endpoint: "http://ollama:11434/v1",
    authMode: "Optional API key"
  },
  custom: {
    label: "OpenAI-compatible",
    model: "gpt-5-mini",
    endpoint: "https://example.com/v1",
    authMode: "API key"
  }
};

const project: Project = {
  name: "karpati llm wiki",
  source: "GitHub / local folder / ZIP",
  status: "Ready for repository intake",
  completeness: 42,
  lastScan: "No production scan yet"
};

const wikiPages: WikiPage[] = [
  {
    title: "Architecture",
    summary: "Maps repositories into services, APIs, deployment units, data stores, and agent-facing relationships.",
    freshness: "Seeded",
    confidence: 0.82,
    links: ["Components", "Runtime", "Dependencies"]
  },
  {
    title: "Deployment",
    summary: "Captures build targets, Kubernetes topology, environment variables, release history, and rollback routes.",
    freshness: "Seeded",
    confidence: 0.78,
    links: ["Operations", "Networking", "Security"]
  },
  {
    title: "Troubleshooting",
    summary: "Preserves known failure modes, log pointers, mitigations, and historical fixes for future agents.",
    freshness: "Seeded",
    confidence: 0.74,
    links: ["Known Issues", "Runbooks", "Monitoring"]
  },
  {
    title: "API Reference",
    summary: "Indexes handlers, schemas, callers, examples, auth requirements, and downstream dependencies.",
    freshness: "Seeded",
    confidence: 0.8,
    links: ["Security", "Business Logic", "External Integrations"]
  }
];

const graphNodes = [
  ["Raw sources", "Immutable intake"],
  ["Schema rules", "Markdown pages"],
  ["index.md", "Navigation graph"],
  ["log.md", "Workflow memory"],
  ["Wiki health", "MCP context"],
  ["MCP context", "Agent answers"]
];

const mcpTools = [
  { name: "wiki.search", detail: "Route a natural-language query to filed Markdown pages with citations" },
  { name: "wiki.retrieve", detail: "Return page, version, backlinks, schema fields, and context windows" },
  { name: "wiki.health", detail: "Expose lint results for stale pages, broken links, missing sources, and drift" },
  { name: "graph.downstream", detail: "Find systems affected by a component, API, or runtime dependency" },
  { name: "plan.deployment", detail: "Generate release and rollback steps from index.md and log.md memory" }
];

const workflowCards = [
  {
    title: "Immutable raw sources",
    detail: "Repository, ZIP, and folder inputs are preserved as source evidence. Generated pages cite them instead of overwriting them.",
    icon: <Archive size={19} />,
    meta: "raw/ stays append-only"
  },
  {
    title: "Generated Markdown wiki",
    detail: "The scanner files architecture, API, deployment, runbook, and decision notes as Markdown pages built for Obsidian and git diffs.",
    icon: <NotebookText size={19} />,
    meta: "wiki/**/*.md"
  },
  {
    title: "Schema and workflow rules",
    detail: "Required headings, tags, aliases, citations, freshness, and relationships keep pages consistent enough for agents to consume.",
    icon: <ClipboardCheck size={19} />,
    meta: "rules/schema.yml"
  },
  {
    title: "Index and log navigation",
    detail: "index.md is the table of contents; log.md records scan decisions, generation notes, and query trails for auditability.",
    icon: <Route size={19} />,
    meta: "index.md + log.md"
  }
];

const healthChecks = [
  { label: "Raw source citations", value: "Required", status: "pass" },
  { label: "Broken wiki links", value: "0 tolerated", status: "warn" },
  { label: "Missing frontmatter", value: "Linted", status: "pass" },
  { label: "Stale generated pages", value: "Flagged", status: "warn" },
  { label: "index.md coverage", value: "Enforced", status: "pass" },
  { label: "log.md audit trail", value: "Recorded", status: "pass" }
];

const workflowFiles = [
  { name: "raw/sources.lock", detail: "Immutable source manifest with scan IDs and commit refs" },
  { name: "wiki/index.md", detail: "Human and agent navigation entry point" },
  { name: "wiki/log.md", detail: "Generated change journal and query history" },
  { name: "wiki/rules/schema.md", detail: "Page contract, lint rules, and workflow policy" }
];

function WorkflowCard({ item }: { item: (typeof workflowCards)[number] }) {
  return (
    <article className="workflow-card">
      <div className="workflow-icon">{item.icon}</div>
      <div>
        <strong>{item.title}</strong>
        <p>{item.detail}</p>
        <span>{item.meta}</span>
      </div>
    </article>
  );
}

function HealthItem({ item }: { item: (typeof healthChecks)[number] }) {
  return (
    <div className={`health-item ${item.status}`}>
      <span>{item.label}</span>
      <strong>{item.value}</strong>
    </div>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return <span className="status-pill">{children}</span>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <div className="metric-value">{value}</div>
        <div className="metric-label">{label}</div>
      </div>
    </div>
  );
}

function WikiRow({ page }: { page: WikiPage }) {
  const links = page.links ?? page.relationships ?? [];
  return (
    <article className="wiki-row">
      <div>
        <div className="row-title">{page.title}</div>
        <p>{page.summary}</p>
      </div>
      <div className="row-meta">
        <span>{page.freshness}</span>
        <span>{Math.round(page.confidence * 100)}% confidence</span>
      </div>
      <div className="link-strip">
        {links.map((link) => (
          <span key={link}>{link}</span>
        ))}
      </div>
    </article>
  );
}

function renderInlineWikiLinks(text: string, onNavigate: (title: string) => void) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return parts.map((part, index) => {
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

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {listItems.map((item) => (
          <li key={item}>{renderInlineWikiLinks(item, onNavigate)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  markdown.split("\n").forEach((line, index) => {
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      return;
    }
    flushList();
    if (line.startsWith("# ")) {
      nodes.push(<h1 key={index}>{renderInlineWikiLinks(line.slice(2), onNavigate)}</h1>);
    } else if (line.startsWith("## ")) {
      nodes.push(<h2 key={index}>{renderInlineWikiLinks(line.slice(3), onNavigate)}</h2>);
    } else if (line.trim()) {
      nodes.push(<p key={index}>{renderInlineWikiLinks(line, onNavigate)}</p>);
    }
  });
  flushList();

  return <div className="markdown-doc">{nodes}</div>;
}

function App() {
  const [query, setQuery] = React.useState("How does deployment work?");
  const [wikiQuestion, setWikiQuestion] = React.useState("Why is the deployment documentation written this way?");
  const [wikiAnswer, setWikiAnswer] = React.useState<WikiAnswer | null>(null);
  const [storage, setStorage] = React.useState<StorageStatus | null>(null);
  const [wikiAskBusy, setWikiAskBusy] = React.useState(false);
  const [scanState, setScanState] = React.useState<"idle" | "running" | "done">("idle");
  const [activeScanId, setActiveScanId] = React.useState("");
  const [activeScan, setActiveScan] = React.useState<ScanRecord | null>(null);
  const [scanHistory, setScanHistory] = React.useState<ScanRecord[]>([]);
  const [wikiSnapshot, setWikiSnapshot] = React.useState<WikiSnapshot | null>(null);
  const [selectedPageId, setSelectedPageId] = React.useState("");
  const [selectedFolder, setSelectedFolder] = React.useState("all");
  const [selectedPage, setSelectedPage] = React.useState<WikiPage | null>(null);
  const [aiAssistance, setAiAssistance] = React.useState<AiAssistance | null>(null);
  const [aiBusy, setAiBusy] = React.useState(false);
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
    authMode: "Prism managed or API key",
    apiKey: "",
    connected: false
  });
  const [message, setMessage] = React.useState("Choose a source and configure an LLM provider before scanning.");
  const [gitAuth, setGitAuth] = React.useState({
    sshKeyConfigured: false,
    knownHostsConfigured: false,
    secretName: "karpati-git-ssh",
    sshKeyPath: "/app/secrets/git/id_rsa",
    knownHostsPath: "/app/secrets/git/known_hosts",
    storage: "not-configured"
  });
  const [gitSecret, setGitSecret] = React.useState({
    privateKey: "",
    knownHosts: ""
  });
  const activeWikiPages = wikiSnapshot?.pages?.length ? wikiSnapshot.pages : wikiPages;
  const selectedSummaryPage =
    activeWikiPages.find((page) => page.id === selectedPageId || page.title === selectedPage?.title) || activeWikiPages[0];
  const activeDocument = selectedPage?.id === selectedSummaryPage?.id ? selectedPage : selectedSummaryPage;
  const vaultFolders = [...new Set(activeWikiPages.map((page) => page.folder).filter(Boolean) as string[])].sort();
  const queryToken = query.toLowerCase().trim();
  const visiblePages = activeWikiPages.filter((page) =>
    (selectedFolder === "all" || page.folder === selectedFolder) &&
    (!queryToken ||
      `${page.title} ${page.path ?? ""} ${page.summary} ${(page.tags ?? []).join(" ")} ${(page.links ?? page.relationships ?? []).join(" ")} ${(page.backlinks ?? []).join(" ")}`
        .toLowerCase()
        .includes(queryToken))
  );

  React.useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((settings) => {
        if (settings.source) {
          setSource(settings.source);
        }
        if (settings.llm) {
          setLlm((current) => ({ ...current, ...settings.llm, apiKey: "" }));
        }
        if (settings.gitAuth) {
          setGitAuth(settings.gitAuth);
        }
      })
      .catch(() => setMessage("Settings API is not reachable yet."));
  }, []);

  const refreshStorage = React.useCallback(async () => {
    const response = await fetch("/api/storage");
    if (!response.ok) return;
    const payload = await response.json();
    setStorage(payload.storage || null);
  }, []);

  const refreshScans = React.useCallback(async (scanId = activeScanId) => {
    const response = await fetch("/api/scans");
    if (!response.ok) return;
    const payload = await response.json();
    const scans = Array.isArray(payload.scans) ? payload.scans : [];
    setScanHistory(scans);
    const selected = scans.find((scan: ScanRecord) => scan.id === scanId) || scans[0] || null;
    setActiveScan(selected);
    if (selected) {
      setScanState(selected.status === "ready" ? "done" : selected.status === "waiting_for_llm_credentials" ? "idle" : "running");
      setMessage(`${selected.id}: ${selected.currentStage}`);
      if (selected.wikiSnapshot) {
        setWikiSnapshot(selected.wikiSnapshot);
        setSelectedPageId((current) => current || selected.wikiSnapshot?.pages?.[0]?.id || "");
      }
    }
    await refreshStorage();
  }, [activeScanId, refreshStorage]);

  const selectWikiPage = React.useCallback(
    async (page: WikiPage | string) => {
      const pageId =
        typeof page === "string"
          ? activeWikiPages.find((candidate) => candidate.title === page || candidate.id === page)?.id || page
          : page.id || page.title;
      if (!pageId) return;
      setSelectedPageId(pageId);
      setAiAssistance(null);
      const response = await fetch(`/api/wiki/pages/${encodeURIComponent(pageId)}`);
      if (!response.ok) {
        const fallback = activeWikiPages.find((candidate) => candidate.id === pageId || candidate.title === pageId) || null;
        setSelectedPage(fallback);
        return;
      }
      const payload = await response.json();
      setSelectedPage(payload.page);
    },
    [activeWikiPages]
  );

  const askAiAboutPage = async (intent: "explain" | "improve") => {
    const pageId = activeDocument?.id || selectedPageId;
    if (!pageId) return;
    setAiBusy(true);
    try {
      const response = await fetch(`/api/wiki/pages/${encodeURIComponent(pageId)}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent })
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "AI wiki assistant failed.");
        return;
      }
      setAiAssistance(payload.assistance);
      setMessage(`AI generated ${intent} guidance for ${payload.assistance.title}.`);
    } finally {
      setAiBusy(false);
    }
  };

  const askWiki = async () => {
    if (!wikiQuestion.trim()) return;
    setWikiAskBusy(true);
    try {
      const response = await fetch("/api/wiki/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: wikiQuestion })
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Wiki question failed.");
        return;
      }
      setWikiAnswer(payload.result);
      setMessage(`Wiki answered from ${payload.result.sources.length} cited Markdown files.`);
    } finally {
      setWikiAskBusy(false);
    }
  };

  const refreshWikiSnapshot = React.useCallback(async () => {
    const response = await fetch("/api/wiki/snapshots/latest");
    if (!response.ok) return;
    const payload = await response.json();
    if (payload.snapshot?.pages?.length) {
      setWikiSnapshot(payload.snapshot);
      setSelectedPageId((current) => current || payload.snapshot.pages[0].id || "");
    }
    await refreshStorage();
  }, [refreshStorage]);

  React.useEffect(() => {
    refreshScans().catch(() => undefined);
    refreshWikiSnapshot().catch(() => undefined);
  }, [refreshScans, refreshWikiSnapshot]);

  React.useEffect(() => {
    if (!activeScanId) return;
    const interval = window.setInterval(() => {
      refreshScans(activeScanId).catch(() => undefined);
    }, 2_500);
    return () => window.clearInterval(interval);
  }, [activeScanId, refreshScans]);

  React.useEffect(() => {
    if (!wikiSnapshot?.pages?.length) return;
    const page = wikiSnapshot.pages.find((candidate) => candidate.id === selectedPageId) || wikiSnapshot.pages[0];
    if (page?.id && page.id !== selectedPage?.id) {
      selectWikiPage(page).catch(() => undefined);
    }
  }, [wikiSnapshot, selectedPageId, selectedPage?.id, selectWikiPage]);

  const saveSettings = async () => {
    setMessage("Saving source and LLM settings...");
    const sourceResponse = await fetch("/api/settings/source", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source)
    });
    const sourcePayload = await sourceResponse.json();
    if (!sourceResponse.ok) {
      setMessage(sourcePayload.error || "Source settings were rejected.");
      return false;
    }

    const llmResponse = await fetch("/api/settings/llm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(llm)
    });
    const llmPayload = await llmResponse.json();
    if (!llmResponse.ok) {
      setMessage(llmPayload.error || "LLM settings were rejected.");
      return false;
    }

    setLlm((current) => ({ ...current, ...llmPayload.llm, apiKey: "" }));
    setMessage("Settings saved. Ready to run a repository scan.");
    await refreshStorage();
    return true;
  };

  const saveGitAuth = async () => {
    setMessage("Saving private Git SSH key...");
    const response = await fetch("/api/settings/git-auth", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gitSecret)
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Git SSH key was rejected.");
      return false;
    }

    setGitAuth(payload.gitAuth);
    setGitSecret((current) => ({ ...current, privateKey: "" }));
    setMessage("Private Git SSH key saved. SSH repository scans can now be queued.");
    await refreshStorage();
    return true;
  };

  const runScan = async () => {
    setScanState("running");
    setMessage("Submitting scan request...");
    const response = await fetch("/api/repositories/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, llm })
    });
    const payload = await response.json();
    if (!response.ok) {
      setScanState("idle");
      setMessage(payload.error || "Scan request failed.");
      return;
    }

    setScanState("done");
    setActiveScanId(payload.scanId);
    setMessage(
      `${payload.scanId} ${payload.status === "queued" ? "queued with LLM provider" : "saved and waiting for LLM credentials"}`
    );
    await refreshScans(payload.scanId);
    await refreshStorage();
  };

  const runDemoScan = async () => {
    setScanState("running");
    setMessage("Generating demo wiki snapshot...");
    const response = await fetch("/api/demo/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const payload = await response.json();
    if (!response.ok) {
      setScanState("idle");
      setMessage(payload.error || "Demo scan failed.");
      return;
    }

    setScanState("done");
    setActiveScanId(payload.scanId);
    setMessage(`${payload.scanId} generated. Open the .md pages and use the AI doc actions.`);
    await refreshScans(payload.scanId);
    await refreshWikiSnapshot();
    await refreshStorage();
  };

  const sourceLabel =
    source.type === "git"
      ? source.gitUrl || "No Git repository set"
      : source.type === "local-folder"
        ? source.localPath || "No local folder set"
        : source.archiveName || "No archive selected";

  return (
    <main className="shell">
      <nav className="topbar" aria-label="Primary">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span>Karpati LLM Wiki</span>
        </div>
        <div className="nav-links">
          <a href="#dashboard">Dashboard</a>
          <a href="#workflow">Workflow</a>
          <a href="#wiki">Wiki</a>
          <a href="#health">Health</a>
          <a href="#mcp">MCP</a>
        </div>
      </nav>

      <section className="hero" id="dashboard">
        <div className="hero-copy">
          <StatusPill>
            <Activity size={14} /> {storage?.durable ? "Persistent wiki vault" : "Production vertical slice"}
          </StatusPill>
          <h1>LLM wiki workflow for source-grounded agents.</h1>
          <p>
            Preserve raw project sources, generate filed Markdown pages, lint the wiki contract, and expose exact context through MCP.
          </p>
          <div className="hero-actions">
            <button className="primary-action" onClick={runScan}>
              <Play size={17} /> {scanState === "running" ? "Scanning" : scanState === "done" ? "Scan ready" : "Run scan"}
            </button>
            <button className="secondary-action" type="button" onClick={runDemoScan}>
              <Sparkles size={17} /> Demo wiki
            </button>
            <a className="secondary-action" href="/api/mcp/tools">
              <Braces size={17} /> MCP tools
            </a>
          </div>
        </div>

        <div className="ops-panel" aria-label="Repository knowledge pipeline">
          <div className="panel-head">
            <span>Wiki workflow</span>
            <span>{storage?.savedAt ? `DB saved ${new Date(storage.savedAt).toLocaleTimeString()}` : project.lastScan}</span>
          </div>
          <div className="pipeline">
            {["Raw sources", "Markdown pages", "Schema lint", "index.md", "log.md", "MCP context"].map((step, index) => (
              <div className="pipe-step" key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="metrics" aria-label="Project status">
        <Metric label="Saved scans" value={String(storage?.scans ?? scanHistory.length)} icon={<Database size={21} />} />
        <Metric label="Wiki snapshots" value={String(storage?.snapshots ?? (wikiSnapshot ? 1 : 0))} icon={<CheckCircle2 size={21} />} />
        <Metric label="Markdown pages" value={wikiSnapshot ? `${wikiSnapshot.pageCount} saved` : "17 planned"} icon={<FileSearch size={21} />} />
        <Metric label="Provider model" value={llm.connected ? llm.model : "Needs key"} icon={<Sparkles size={21} />} />
      </section>

      <section className="workflow-section" id="workflow" aria-label="Karpati wiki workflow">
        <div className="section-heading compact">
          <h2>Karpati Workflow</h2>
          <p>Raw evidence, generated Markdown, rule checks, and navigation files stay separate so humans can review changes and agents can trust retrieval.</p>
        </div>
        <div className="workflow-grid">
          {workflowCards.map((item) => (
            <WorkflowCard item={item} key={item.title} />
          ))}
        </div>
      </section>

      <section className="workbench" id="wiki">
        <aside className="scan-console">
          <div className="section-heading">
            <h2>Repository Intake</h2>
            <p>Seed immutable raw sources from Git, a local folder, or an archive; every generated page is tied to a scan and model.</p>
          </div>
          <div className="segmented" role="tablist" aria-label="Source type">
            {[
              ["git", "Git repo"],
              ["local-folder", "Local folder"],
              ["zip-upload", "ZIP upload"]
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
                placeholder="https://github.com/org/service.git"
                value={source.gitUrl}
                onChange={(event) => setSource((current) => ({ ...current, gitUrl: event.target.value }))}
              />
              <label htmlFor="branch">Branch or ref</label>
              <input
                id="branch"
                className="field"
                value={source.branch}
                onChange={(event) => setSource((current) => ({ ...current, branch: event.target.value }))}
              />
              <label htmlFor="git-auth">Git authentication</label>
              <select
                id="git-auth"
                className="field"
                value={source.authMode}
                onChange={(event) =>
                  setSource((current) => ({ ...current, authMode: event.target.value as SourceSettings["authMode"] }))
                }
              >
                <option value="ssh-key">Private SSH key</option>
                <option value="none">No private auth</option>
              </select>
              {source.authMode === "ssh-key" && (
                <div className="secret-box">
                  <div className="secret-status">
                    <span>{gitAuth.sshKeyConfigured ? "Private key configured" : "Private key required"}</span>
                    <small>{gitAuth.storage === "file" ? gitAuth.sshKeyPath : gitAuth.secretName}</small>
                  </div>
                  <label htmlFor="privateKey">SSH private key</label>
                  <textarea
                    id="privateKey"
                    className="field text-area secret-input"
                    placeholder="Paste your private key. It will not be echoed back."
                    spellCheck={false}
                    value={gitSecret.privateKey}
                    onChange={(event) => setGitSecret((current) => ({ ...current, privateKey: event.target.value }))}
                  />
                  <label htmlFor="knownHosts">Known hosts</label>
                  <textarea
                    id="knownHosts"
                    className="field text-area"
                    spellCheck={false}
                    value={gitSecret.knownHosts}
                    onChange={(event) => setGitSecret((current) => ({ ...current, knownHosts: event.target.value }))}
                  />
                  <button className="full-action" onClick={saveGitAuth} type="button">
                    <KeyRound size={17} /> Save private key
                  </button>
                </div>
              )}
            </>
          )}

          {source.type === "local-folder" && (
            <>
              <label htmlFor="folder">Local folder path</label>
              <div className="input-line">
                <FolderOpen size={18} />
                <input
                  id="folder"
                  placeholder="/workspace/repos/service"
                  value={source.localPath}
                  onChange={(event) => setSource((current) => ({ ...current, localPath: event.target.value }))}
                />
              </div>
            </>
          )}

          {source.type === "zip-upload" && (
            <>
              <label htmlFor="archive">Archive filename</label>
              <input
                id="archive"
                className="field"
                placeholder="service-source.zip"
                value={source.archiveName}
                onChange={(event) => setSource((current) => ({ ...current, archiveName: event.target.value }))}
              />
            </>
          )}

          <label htmlFor="provider">LLM provider</label>
          <select
            id="provider"
            className="field"
            value={llm.provider}
            onChange={(event) => {
              const provider = event.target.value;
              const preset = providerPresets[provider] ?? providerPresets.custom;
              setLlm((current) => ({
                ...current,
                provider,
                label: preset.label,
                model: preset.model,
                endpoint: preset.endpoint,
                authMode: preset.authMode
              }));
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
          <label htmlFor="apiKey">API key</label>
          <div className="input-line">
            <input
              id="apiKey"
              type="password"
              placeholder={llm.apiKeyConfigured ? "Configured" : llm.provider === "prism-ai" ? "Managed by Prism or paste key" : "Paste provider key"}
              value={llm.apiKey}
              onChange={(event) => setLlm((current) => ({ ...current, apiKey: event.target.value }))}
            />
            <button title="Save settings" onClick={saveSettings}>
              <Save size={18} />
            </button>
          </div>
          <button className="full-action" onClick={runScan}>
            <Play size={17} /> Start scan
          </button>
          <button className="full-action alt-action" type="button" onClick={runDemoScan}>
            <Sparkles size={17} /> Demo wiki scan
          </button>
          <div className="progress-panel" aria-live="polite">
            <div className="progress-head">
              <div>
                <strong>Scan Progress</strong>
                <span>{activeScan ? activeScan.id : "No scan submitted yet"}</span>
              </div>
              <strong>{activeScan ? `${activeScan.progress}%` : "0%"}</strong>
            </div>
            <div className="progress-track" aria-label="Scan progress">
              <span style={{ width: `${activeScan?.progress ?? 0}%` }} />
            </div>
            <div className="stage-list">
              {(activeScan?.stages ?? [
                { key: "queued", label: "Queued", progress: 8, state: "pending" },
                { key: "source", label: "Source prepared", progress: 24, state: "pending" },
                { key: "parser", label: "Repository parsed", progress: 46, state: "pending" },
                { key: "llm", label: "LLM knowledge generated", progress: 72, state: "pending" },
                { key: "ready", label: "Wiki snapshot ready", progress: 100, state: "pending" }
              ]).map((stage) => (
                <div className={`stage-item ${stage.state}`} key={stage.key}>
                  <i />
                  <span>{stage.label}</span>
                </div>
              ))}
            </div>
            {activeScan?.messages?.length ? (
              <div className="scan-messages">
                {activeScan.messages.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="history-panel">
            <div className="history-head">
              <strong>Scan History</strong>
              <button type="button" onClick={() => refreshScans().catch(() => undefined)}>
                Refresh
              </button>
            </div>
            <div className="history-list">
              {scanHistory.length ? (
                scanHistory.slice(0, 6).map((scan) => (
                  <button
                    type="button"
                    className={activeScan?.id === scan.id ? "selected" : ""}
                    key={scan.id}
                    onClick={() => {
                      setActiveScanId(scan.id);
                      setActiveScan(scan);
                      if (scan.wikiSnapshot) {
                        setWikiSnapshot(scan.wikiSnapshot);
                        const firstPage = scan.wikiSnapshot.pages[0];
                        setSelectedPageId(firstPage?.id || "");
                        setSelectedPage(firstPage || null);
                        setAiAssistance(null);
                      }
                    }}
                  >
                    <span>{scan.id}</span>
                    <small>{scan.currentStage}</small>
                  </button>
                ))
              ) : (
                <span className="empty-history">No scans yet</span>
              )}
            </div>
          </div>
          <div className="console-lines" aria-live="polite">
            <span>$ karpati scan --source {source.type}</span>
            <span>source: {sourceLabel}</span>
            <span>raw: immutable source manifest</span>
            <span>rules: schema headings, citations, backlinks, freshness</span>
            <span>
              git ssh: {gitAuth.sshKeyConfigured ? `configured in ${gitAuth.secretName}` : "missing runtime secret"}
            </span>
            <span>llm: {llm.label || llm.provider}/{llm.model} {llm.connected ? "connected" : "not connected"}</span>
            <span>endpoint: {llm.endpoint}</span>
            <span>auth: {llm.authMode || "API key"}</span>
            <span>db: {storage?.exists ? `${storage.mode} saved at ${storage.path}` : "waiting for first persisted write"}</span>
            <span>generated: index.md, log.md, Architecture, API, Deployment, Runbooks</span>
            <span>{activeScan?.status === "ready" ? "snapshot: v0.1.0 ready for MCP" : `status: ${message}`}</span>
          </div>
        </aside>

        <div className="wiki-panel">
          <div className="wiki-panel-head">
            <div>
              <span>Generated Markdown Wiki</span>
              <strong>Query to filed page flow</strong>
            </div>
            <BookOpenCheck size={22} />
          </div>
          <div className="search-line">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search wiki" />
          </div>
          <div className="snapshot-line">
            <span>{wikiSnapshot ? `Generated from ${wikiSnapshot.scanId}` : "Seeded wiki preview"}</span>
            <small>{wikiSnapshot ? `${wikiSnapshot.pageCount} pages · ${new Date(wikiSnapshot.generatedAt).toLocaleString()}` : "Run a scan to generate a project snapshot"}</small>
          </div>
          <div className="storage-card" aria-label="Persistent storage status">
            <Database size={18} />
            <div>
              <strong>{storage?.durable ? "Saved in persistent DB file" : "Storage status loading"}</strong>
              <span>
                {storage?.exists
                  ? `${storage.scans} scans, ${storage.snapshots} snapshots, ${Math.round(storage.bytes / 1024)} KB`
                  : "The first scan will create the database file"}
              </span>
            </div>
            <button type="button" onClick={() => refreshStorage().catch(() => undefined)}>
              Refresh
            </button>
          </div>
          {wikiSnapshot?.vault ? (
            <div className="vault-line" aria-label="Markdown vault metadata">
              <span>{wikiSnapshot.vault.root}</span>
              <span>{wikiSnapshot.vault.files.length} .md files</span>
              <span>{wikiSnapshot.vault.folders.length} folders</span>
              <span>{wikiSnapshot.vault.tags.length} tags</span>
              <a href="/api/wiki/export" target="_blank" rel="noreferrer">Export Markdown</a>
            </div>
          ) : null}
          <section className="wiki-ask" aria-label="Ask the generated wiki">
            <div className="ask-head">
              <FileSearch size={17} />
              <strong>Ask a question, then open the cited .md pages</strong>
            </div>
            <div className="input-line">
              <Bot size={18} />
              <input
                value={wikiQuestion}
                onChange={(event) => setWikiQuestion(event.target.value)}
                aria-label="Ask AI about the wiki"
              />
              <button type="button" title="Ask wiki" onClick={askWiki} disabled={wikiAskBusy || !wikiSnapshot}>
                <Sparkles size={18} />
              </button>
            </div>
            {wikiAnswer ? (
              <div className="wiki-answer">
                <div>
                  <strong>Grounded answer</strong>
                  <small>{wikiAnswer.mode} · {wikiAnswer.sources.length} sources</small>
                </div>
                {wikiAnswer.answer.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <div className="source-strip">
                  {wikiAnswer.sources.map((source) => (
                    <button type="button" key={source.id} onClick={() => selectWikiPage(source.id).catch(() => undefined)}>
                      {source.path}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
          <div className="file-flow" aria-label="Core wiki files">
            {workflowFiles.map((file) => (
              <div className="file-flow-item" key={file.name}>
                <FileCode size={16} />
                <div>
                  <strong>{file.name}</strong>
                  <span>{file.detail}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="wiki-workspace">
            <aside className="wiki-index" aria-label="Wiki pages">
              <div className="folder-rail" aria-label="Wiki folders">
                <button
                  className={selectedFolder === "all" ? "selected" : ""}
                  type="button"
                  onClick={() => setSelectedFolder("all")}
                >
                  <FolderOpen size={15} />
                  <span>All notes</span>
                  <small>{activeWikiPages.length}</small>
                </button>
                {vaultFolders.map((folder) => (
                  <button
                    className={selectedFolder === folder ? "selected" : ""}
                    type="button"
                    key={folder}
                    onClick={() => setSelectedFolder(folder)}
                  >
                    <FolderOpen size={15} />
                    <span>{folder}</span>
                    <small>{activeWikiPages.filter((page) => page.folder === folder).length}</small>
                  </button>
                ))}
              </div>
              {(visiblePages.length ? visiblePages : activeWikiPages).map((page) => (
                <button
                  className={activeDocument?.title === page.title ? "selected" : ""}
                  type="button"
                  key={page.id || page.title}
                  onClick={() => selectWikiPage(page).catch(() => undefined)}
                >
                  <FileText size={16} />
                  <span>{page.filename || `${page.title}.md`}</span>
                  <small>{Math.round(page.confidence * 100)}%</small>
                  {page.folder ? <em>{page.folder}</em> : null}
                </button>
              ))}
            </aside>
            <article className="wiki-reader">
              {activeDocument ? (
                <>
                  <div className="doc-toolbar">
                    <div>
                      <span>{activeDocument.path || activeDocument.freshness}</span>
                      <strong>{activeDocument.filename || `${activeDocument.title}.md`}</strong>
                    </div>
                    <div className="doc-actions">
                      <button type="button" onClick={() => askAiAboutPage("explain")} disabled={!activeDocument.id || aiBusy}>
                        <Bot size={16} /> Why
                      </button>
                      <button type="button" onClick={() => askAiAboutPage("improve")} disabled={!activeDocument.id || aiBusy}>
                        <Wand2 size={16} /> Improve
                      </button>
                    </div>
                  </div>
                  <MarkdownView
                    markdown={
                      activeDocument.markdown ||
                      `# ${activeDocument.title}\n\n## Summary\n${activeDocument.summary}\n\n## Relationships\n${(activeDocument.relationships ?? activeDocument.links ?? []).map((link) => `[[${link}]]`).join(", ")}`
                    }
                    onNavigate={(title) => selectWikiPage(title).catch(() => undefined)}
                  />
                  <div className="tag-strip" aria-label="Tags and citations">
                    {(activeDocument.tags ?? []).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                    {(activeDocument.citations ?? []).map((citation) => (
                      <small key={citation}>{citation}</small>
                    ))}
                  </div>
                  <div className="obsidian-panel">
                    <div>
                      <Link2 size={16} />
                      <strong>Related</strong>
                    </div>
                    <div className="link-strip">
                      {(activeDocument.relationships ?? activeDocument.links ?? []).map((link) => (
                        <button type="button" key={link} onClick={() => selectWikiPage(link).catch(() => undefined)}>
                          {link}
                        </button>
                      ))}
                    </div>
                    <div>
                      <Link2 size={16} />
                      <strong>Backlinks</strong>
                    </div>
                    <div className="link-strip">
                      {(activeDocument.backlinks?.length ? activeDocument.backlinks : ["No backlinks yet"]).map((link) => (
                        <button
                          type="button"
                          key={link}
                          disabled={link === "No backlinks yet"}
                          onClick={() => selectWikiPage(link).catch(() => undefined)}
                        >
                          {link}
                        </button>
                      ))}
                    </div>
                  </div>
                  {aiAssistance ? (
                    <section className="ai-panel" aria-label="AI wiki assistant">
                      <div className="ai-head">
                        <Bot size={17} />
                        <strong>AI doc assistant · {aiAssistance.model}</strong>
                      </div>
                      <div className="ai-columns">
                        <div>
                          <span>Why this doc is like this</span>
                          {aiAssistance.explanation.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                        </div>
                        <div>
                          <span>How to improve it</span>
                          <ul>
                            {aiAssistance.suggestions.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <details>
                        <summary>Improved Markdown</summary>
                        <pre>{aiAssistance.improvedMarkdown}</pre>
                      </details>
                    </section>
                  ) : null}
                </>
              ) : (
                <div className="empty-doc">Run a scan to generate wiki Markdown pages.</div>
              )}
            </article>
          </div>
        </div>
      </section>

      <section className="health-section" id="health" aria-label="Wiki health checks">
        <div className="section-heading compact">
          <h2>Wiki Health</h2>
          <p>Generated documentation is useful only when lint, provenance, and navigation stay visible before agents consume it.</p>
        </div>
        <div className="health-board">
          <div className="health-panel">
            <div className="health-head">
              <ListChecks size={19} />
              <strong>Lint and contract checks</strong>
            </div>
            <div className="health-list">
              {healthChecks.map((item) => (
                <HealthItem item={item} key={item.label} />
              ))}
            </div>
          </div>
          <div className="workflow-panel">
            <div className="health-head">
              <GitBranch size={19} />
              <strong>Obsidian, Markdown, git</strong>
            </div>
            <p>
              The vault is deliberately plain Markdown: Obsidian backlinks for humans, frontmatter and citations for machines, and git-friendly diffs for reviewing generated changes.
            </p>
            <div className="review-steps">
              <span><FileCheck2 size={15} /> Review generated diff</span>
              <span><Link2 size={15} /> Fix missing citations or backlinks</span>
              <span><GitBranch size={15} /> Commit accepted wiki snapshot</span>
              <span><Bot size={15} /> Let MCP agents consume approved files</span>
            </div>
          </div>
        </div>
      </section>

      <section className="graph-section">
        <div className="section-heading compact">
          <h2>Navigation Graph</h2>
          <p>index.md, log.md, backlinks, and citations create a file-level map from raw sources to agent-ready answers.</p>
        </div>
        <div className="graph-board">
          {graphNodes.map(([from, to], index) => (
            <div className="edge" key={`${from}-${to}`}>
              <span>{from}</span>
              <i />
              <span>{to}</span>
              <small>{index % 2 === 0 ? "depends on" : "produces"}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="mcp-section" id="mcp">
        <div>
          <div className="section-heading compact">
            <h2>MCP Surface</h2>
            <p>Agents retrieve exact context instead of re-reading the whole repository.</p>
          </div>
          <div className="tool-list">
            {mcpTools.map((tool) => (
              <div className="tool-row" key={tool.name}>
                <Bot size={19} />
                <div>
                  <strong>{tool.name}</strong>
                  <span>{tool.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="runtime">
          <Metric label="Runtime" value="Node API" icon={<Server size={21} />} />
          <Metric label="Git auth" value={gitAuth.sshKeyConfigured ? "SSH key" : "Not set"} icon={<KeyRound size={21} />} />
          <Metric label="Storage model" value={storage?.exists ? "Persistent DB file" : "PVC ready"} icon={<Database size={21} />} />
          <Metric label="Isolation" value="Project RBAC" icon={<ShieldCheck size={21} />} />
          <Metric label="Updates" value="Snapshot queue" icon={<Clock3 size={21} />} />
          <Metric label="Topology" value="Kubernetes" icon={<Network size={21} />} />
          <Metric label="Deploy target" value="pxinf" icon={<Boxes size={21} />} />
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
