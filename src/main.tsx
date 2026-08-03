import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Bot,
  Braces,
  Boxes,
  CheckCircle2,
  Clock3,
  Database,
  FileSearch,
  GitBranch,
  Network,
  Play,
  Search,
  Server,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import "./styles.css";

type WikiPage = {
  title: string;
  summary: string;
  freshness: string;
  confidence: number;
  links: string[];
};

type Project = {
  name: string;
  source: string;
  status: string;
  completeness: number;
  lastScan: string;
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
  ["Repository", "Scanner"],
  ["Scanner", "Parser"],
  ["Parser", "Knowledge"],
  ["Knowledge", "Graph"],
  ["Graph", "MCP"],
  ["MCP", "Agents"]
];

const mcpTools = [
  { name: "wiki.search", detail: "Hybrid keyword/vector lookup across generated pages" },
  { name: "wiki.retrieve", detail: "Return page, version, relationships, and context windows" },
  { name: "graph.downstream", detail: "Find systems affected by a component or runtime dependency" },
  { name: "plan.deployment", detail: "Generate release and rollback steps from project memory" }
];

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
        {page.links.map((link) => (
          <span key={link}>{link}</span>
        ))}
      </div>
    </article>
  );
}

function App() {
  const [query, setQuery] = React.useState("How does deployment work?");
  const [scanState, setScanState] = React.useState<"idle" | "running" | "done">("idle");
  const visiblePages = wikiPages.filter((page) =>
    `${page.title} ${page.summary} ${page.links.join(" ")}`.toLowerCase().includes(query.toLowerCase().split(" ")[0] ?? "")
  );

  const runScan = () => {
    setScanState("running");
    window.setTimeout(() => setScanState("done"), 850);
  };

  return (
    <main className="shell">
      <nav className="topbar" aria-label="Primary">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span>Karpati LLM Wiki</span>
        </div>
        <div className="nav-links">
          <a href="#dashboard">Dashboard</a>
          <a href="#wiki">Wiki</a>
          <a href="#mcp">MCP</a>
        </div>
      </nav>

      <section className="hero" id="dashboard">
        <div className="hero-copy">
          <StatusPill>
            <Activity size={14} /> Production vertical slice
          </StatusPill>
          <h1>Project memory that agents can query.</h1>
          <p>
            Convert repositories into searchable architecture, deployment, and operations knowledge for AI engineering agents.
          </p>
          <div className="hero-actions">
            <button className="primary-action" onClick={runScan}>
              <Play size={17} /> {scanState === "running" ? "Scanning" : scanState === "done" ? "Scan ready" : "Run scan"}
            </button>
            <a className="secondary-action" href="/api/mcp/tools">
              <Braces size={17} /> MCP tools
            </a>
          </div>
        </div>

        <div className="ops-panel" aria-label="Repository knowledge pipeline">
          <div className="panel-head">
            <span>Pipeline</span>
            <span>{scanState === "done" ? "Updated now" : project.lastScan}</span>
          </div>
          <div className="pipeline">
            {["Repository", "Scanner", "Parser", "Wiki", "Graph", "MCP"].map((step, index) => (
              <div className="pipe-step" key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="metrics" aria-label="Project status">
        <Metric label="Completeness" value={`${project.completeness}%`} icon={<CheckCircle2 size={21} />} />
        <Metric label="Indexed sources" value="3 modes" icon={<GitBranch size={21} />} />
        <Metric label="Wiki pages" value="17 planned" icon={<FileSearch size={21} />} />
        <Metric label="Provider model" value="OpenAI-ready" icon={<Sparkles size={21} />} />
      </section>

      <section className="workbench" id="wiki">
        <aside className="scan-console">
          <div className="section-heading">
            <h2>Repository Intake</h2>
            <p>Seed a project from Git, a local folder, or an archive; changes create versioned wiki snapshots.</p>
          </div>
          <label htmlFor="repo">Repository URL</label>
          <div className="input-line">
            <input id="repo" value="https://github.com/org/service.git" readOnly />
            <button title="Start scan" onClick={runScan}>
              <Play size={18} />
            </button>
          </div>
          <div className="console-lines" aria-live="polite">
            <span>$ karpati scan --source repository</span>
            <span>detected: TypeScript, YAML, Docker, Kubernetes</span>
            <span>generated: Architecture, API, Deployment, Runbooks</span>
            <span>{scanState === "done" ? "snapshot: v0.1.0 ready for MCP" : "status: waiting for source"}</span>
          </div>
        </aside>

        <div className="wiki-panel">
          <div className="search-line">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search wiki" />
          </div>
          <div className="wiki-list">
            {(visiblePages.length ? visiblePages : wikiPages).map((page) => (
              <WikiRow page={page} key={page.title} />
            ))}
          </div>
        </div>
      </section>

      <section className="graph-section">
        <div className="section-heading compact">
          <h2>Knowledge Graph</h2>
          <p>Every artifact becomes a node with queryable upstream and downstream relationships.</p>
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
          <Metric label="Storage model" value="Postgres + graph" icon={<Database size={21} />} />
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
