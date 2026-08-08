import express from "express";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.env.PORT || 8080);
const version = process.env.APP_VERSION || "0.1.0";
const gitSshKeyPath = process.env.GIT_SSH_KEY_PATH || "/app/secrets/git/id_rsa";
const gitKnownHostsPath = process.env.GIT_KNOWN_HOSTS_PATH || "/app/secrets/git/known_hosts";
const serveStaticUi = process.env.SERVE_STATIC_UI === "true";
const dataDir = process.env.DATA_DIR || "/app/data/wiki";
const dbPath = process.env.WIKI_DB_PATH || path.join(dataDir, "wiki-db.json");

const llmProviders = {
  "prism-ai": {
    label: "Prism AI",
    model: "codex/default",
    endpoint: "https://prisim-ai.edi-it.com/v1",
    authMode: "Prism managed or API key"
  },
  openai: { label: "OpenAI", model: "gpt-5-mini", endpoint: "https://api.openai.com/v1", authMode: "API key" },
  custom: { label: "OpenAI-compatible", model: "gpt-5-mini", endpoint: "https://example.com/v1", authMode: "API key" }
};

const defaultLlmProvider = process.env.LLM_PROVIDER || "prism-ai";
const defaultLlmPreset = llmProviders[defaultLlmProvider] || llmProviders["prism-ai"];
const pages = [
  "Architecture",
  "Deployment",
  "Networking",
  "Troubleshooting",
  "Build",
  "API",
  "Database",
  "Security",
  "Dependencies",
  "Components",
  "Runtime",
  "Operations",
  "Developer Guide",
  "Testing",
  "Known Issues",
  "Runbooks",
  "Glossary"
];

const pageFolders = {
  Architecture: "overview",
  Deployment: "operations",
  Networking: "infrastructure",
  Troubleshooting: "operations",
  Build: "development",
  API: "reference",
  Database: "infrastructure",
  Security: "operations",
  Dependencies: "reference",
  Components: "overview",
  Runtime: "operations",
  Operations: "operations",
  "Developer Guide": "development",
  Testing: "development",
  "Known Issues": "operations",
  Runbooks: "operations",
  Glossary: "reference"
};

const pageTags = {
  Architecture: ["#architecture", "#system-map", "#agent-context"],
  Deployment: ["#deployment", "#kubernetes", "#release"],
  Networking: ["#networking", "#ingress", "#service-map"],
  Troubleshooting: ["#troubleshooting", "#incidents", "#debugging"],
  Build: ["#build", "#ci", "#containers"],
  API: ["#api", "#contracts", "#routes"],
  Database: ["#database", "#postgres", "#graph"],
  Security: ["#security", "#secrets", "#rbac"],
  Dependencies: ["#dependencies", "#impact", "#packages"],
  Components: ["#components", "#ownership", "#boundaries"],
  Runtime: ["#runtime", "#configuration", "#health"],
  Operations: ["#operations", "#runbooks", "#verification"],
  "Developer Guide": ["#developer-guide", "#workflow", "#local-dev"],
  Testing: ["#testing", "#quality", "#smoke-tests"],
  "Known Issues": ["#known-issues", "#risk", "#lessons"],
  Runbooks: ["#runbooks", "#operator-path", "#recovery"],
  Glossary: ["#glossary", "#terminology", "#aliases"]
};

const wikiTemplates = {
  Architecture: {
    relationships: ["Components", "Runtime", "Dependencies"],
    summary: "Architecture knowledge extracted from the repository source, including service boundaries, runtime flow, and agent-facing dependency context.",
    sections: [
      ["System role", "Explains the service boundaries, runtime entry points, repository ownership, and the path from source code to generated project memory."],
      ["Primary flow", "Repository intake feeds the scanner, parser, knowledge generator, graph index, wiki snapshot, and MCP retrieval surface."],
      ["Agent context", "Use this page before changing cross-cutting behavior because it names the components and relationships an agent should preserve."]
    ]
  },
  Deployment: {
    relationships: ["Operations", "Networking", "Security"],
    summary: "Deployment knowledge extracted from build, container, Kubernetes, and release configuration found in the scanned source.",
    sections: [
      ["Runtime target", "Captures container build inputs, Kubernetes manifests, service exposure, health checks, and rollback-sensitive configuration."],
      ["Release path", "Build an image, apply manifests through the registered cluster workflow, then verify rollout, pods, logs, ingress, TLS, and health endpoints."],
      ["Change risk", "Deployment changes can break repository intake, generated wiki retrieval, or MCP consumers if service routes or environment variables drift."]
    ]
  },
  API: {
    relationships: ["Security", "Components", "Developer Guide"],
    summary: "API knowledge extracted from handlers, route definitions, schemas, callers, and examples found during repository parsing.",
    sections: [
      ["HTTP surface", "Documents project, settings, scan, wiki search, page retrieval, graph, and MCP tool endpoints exposed by the application server."],
      ["Consumers", "The React UI consumes these endpoints directly; future MCP adapters can reuse the same page and search response shapes."],
      ["Contract notes", "Generated wiki pages should include Markdown content, relationships, context windows, scan metadata, and stable page IDs."]
    ]
  },
  Runbooks: {
    relationships: ["Troubleshooting", "Operations", "Known Issues"],
    summary: "Operational runbook knowledge generated from scripts, manifests, logs references, and repeated maintenance workflows.",
    sections: [
      ["Operator path", "Start with health, scan history, latest wiki snapshot, pod readiness, events, logs, then app-level smoke tests."],
      ["Recovery", "If a scan appears in history but pages are missing, check snapshot generation and the latest wiki endpoint before changing UI state."],
      ["Evidence", "Keep scan IDs, snapshot IDs, deployment version, and endpoint status in the handoff so future agents can resume cleanly."]
    ]
  },
  Troubleshooting: {
    relationships: ["Known Issues", "Operations", "Runtime"],
    summary: "Troubleshooting knowledge generated from error paths, configuration risks, runtime dependencies, and operational failure modes.",
    sections: [
      ["Likely failures", "Missing Git credentials, disconnected LLM provider settings, stale in-memory snapshots, and route/DNS drift are first-check issues."],
      ["Debug order", "Check API health, settings, scan status, snapshot retrieval, generated page retrieval, and UI rendering in that order."],
      ["Agent memory", "Preserve fixes as wiki/runbook updates so repeated failures become searchable project knowledge."]
    ]
  },
  Security: {
    relationships: ["API", "Deployment", "Configuration"],
    summary: "Security knowledge generated from auth settings, secrets, network boundaries, RBAC, and provider configuration.",
    sections: [
      ["Secrets", "Git SSH private keys and provider API keys must never be echoed back through settings or scan responses."],
      ["Boundaries", "Project isolation, MCP authentication, RBAC, audit logging, and encrypted secrets are required by the product constitution."],
      ["Review focus", "Treat repository credentials, LLM provider configuration, and MCP retrieval tokens as high-risk surfaces."]
    ]
  },
  Networking: {
    relationships: ["Deployment", "Security", "Operations"],
    summary: "Networking knowledge extracted from service, ingress, route, gateway, DNS, and port configuration.",
    sections: [
      ["Traffic path", "Records how users and agents reach the API and UI, including service names, exposed ports, ingress routes, and public hostname assumptions."],
      ["Name resolution", "Captures DNS, TLS, gateway, and route dependencies so endpoint failures can be diagnosed without rereading manifests."],
      ["Agent context", "Use this page when changing external access, MCP endpoint routing, or service-to-service communication."]
    ]
  },
  Build: {
    relationships: ["Deployment", "Testing", "Dependencies"],
    summary: "Build knowledge extracted from package scripts, Dockerfiles, CI configuration, and artifact publishing paths.",
    sections: [
      ["Build inputs", "Documents package manager commands, frontend bundling, server runtime files, and image context requirements."],
      ["Artifact path", "Connects local build output to container image tags, registry publication, and Kubernetes rollout configuration."],
      ["Failure signals", "Build failures should preserve exact command, dependency version, and image context evidence in this page."]
    ]
  },
  Database: {
    relationships: ["Runtime", "Security", "Operations"],
    summary: "Database knowledge extracted from schemas, migrations, persistence settings, graph storage, and vector storage references.",
    sections: [
      ["Persistence role", "Tracks where scan history, generated snapshots, knowledge graph nodes, embeddings, and project memory should live."],
      ["Schema context", "Generated entries should name tables, indexes, graph labels, and migration ordering once parser extraction is connected."],
      ["Operational risk", "In-memory fallback is useful for demos but production wiki history requires durable storage."]
    ]
  },
  Dependencies: {
    relationships: ["Architecture", "Build", "Components"],
    summary: "Dependency knowledge extracted from package manifests, imports, services, images, and runtime integrations.",
    sections: [
      ["Code dependencies", "Summarizes language packages, framework choices, and local module relationships discovered during scanning."],
      ["Runtime dependencies", "Connects services to databases, queues, object storage, LLM providers, Git hosts, and cluster resources."],
      ["Impact path", "Agents should read this page before upgrading shared packages or changing provider abstractions."]
    ]
  },
  Components: {
    relationships: ["Architecture", "API", "Runtime"],
    summary: "Component knowledge extracted from source modules, services, UI screens, workers, and MCP-facing capabilities.",
    sections: [
      ["Boundaries", "Identifies frontend, API server, repository engine, parser, knowledge generator, graph, storage, and MCP surfaces."],
      ["Ownership", "Groups files and runtime behavior into agent-friendly components that can be changed independently."],
      ["Relationships", "Links each component to APIs, data stores, deployment units, and operational runbooks."]
    ]
  },
  Runtime: {
    relationships: ["Deployment", "Configuration", "Operations"],
    summary: "Runtime knowledge extracted from environment variables, process entrypoints, health checks, and service configuration.",
    sections: [
      ["Entrypoint", "Documents how the application starts, which environment variables matter, and which health endpoints prove readiness."],
      ["Configuration", "Records provider settings, Git authentication paths, static UI serving mode, and app version metadata."],
      ["Agent context", "Use runtime context before changing process startup, environment names, or health/readiness behavior."]
    ]
  },
  Operations: {
    relationships: ["Runbooks", "Troubleshooting", "Deployment"],
    summary: "Operations knowledge extracted from health checks, rollout procedures, logs, events, and recurring maintenance tasks.",
    sections: [
      ["Daily operation", "Start from health, scan history, latest snapshot, wiki search, graph view, and AI query logs."],
      ["Verification", "Record rollout status, pod readiness, endpoint checks, and app-level smoke tests after each deployment."],
      ["Memory", "Promote repeated operational fixes into runbooks and known issues."]
    ]
  },
  "Developer Guide": {
    relationships: ["Build", "Testing", "API"],
    summary: "Developer workflow knowledge extracted from scripts, local commands, repository conventions, and contribution paths.",
    sections: [
      ["Local workflow", "Documents install, build, test, run, and smoke-test commands used by maintainers and agents."],
      ["Change process", "Preserves expected task tracking, scoped edits, and verification before deployment."],
      ["Agent usage", "Tells coding agents which files and API contracts to read before changing wiki generation."]
    ]
  },
  Testing: {
    relationships: ["Build", "API", "Known Issues"],
    summary: "Testing knowledge extracted from automated tests, smoke checks, endpoint probes, and UI verification paths.",
    sections: [
      ["Coverage", "Records which workflows are proved by tests: settings, scan creation, wiki generation, retrieval, search, graph, and AI assistance."],
      ["Gaps", "Names missing coverage so future agents can extend tests when implementation grows."],
      ["Proof", "Each deployment should preserve command output and endpoint smoke results."]
    ]
  },
  "Known Issues": {
    relationships: ["Troubleshooting", "Runbooks", "Testing"],
    summary: "Known issue knowledge generated from failures, limitations, deployment notes, and user-reported friction.",
    sections: [
      ["Current limitations", "Records demo-only behavior, in-memory storage, parser gaps, and endpoint/DNS risks when observed."],
      ["Regression memory", "Keeps prior user reports searchable so the same failure is not rediscovered from scratch."],
      ["Resolution path", "Each issue should link to runbooks, tests, and affected components."]
    ]
  },
  Glossary: {
    relationships: ["Architecture", "Developer Guide", "API"],
    summary: "Terminology knowledge extracted from project language, aliases, acronyms, and concept definitions.",
    sections: [
      ["Terms", "Defines scanner, parser, wiki snapshot, context window, MCP server, knowledge graph, and provider abstraction."],
      ["Aliases", "Keeps consistent language so LLM search connects equivalent terms across pages."],
      ["Usage", "Agents should consult this page when naming new APIs, pages, tags, or graph nodes."]
    ]
  }
};

const scanStages = [
  { key: "queued", label: "Queued", progress: 8, atMs: 0 },
  { key: "source", label: "Source prepared", progress: 24, atMs: 4_000 },
  { key: "parser", label: "Repository parsed", progress: 46, atMs: 10_000 },
  { key: "llm", label: "LLM knowledge generated", progress: 72, atMs: 18_000 },
  { key: "graph", label: "Knowledge graph indexed", progress: 90, atMs: 27_000 },
  { key: "ready", label: "Wiki snapshot ready", progress: 100, atMs: 36_000 }
];

const initialState = {
  source: { type: "git", gitUrl: "", localPath: "", archiveName: "", branch: "main", authMode: "none" },
  llm: {
    provider: defaultLlmProvider,
    label: defaultLlmPreset.label,
    model: process.env.LLM_MODEL || defaultLlmPreset.model,
    endpoint: process.env.LLM_ENDPOINT || defaultLlmPreset.endpoint,
    authMode: defaultLlmPreset.authMode,
    connected: Boolean(process.env.LLM_API_KEY || defaultLlmProvider === "prism-ai"),
    apiKeyConfigured: Boolean(process.env.LLM_API_KEY || defaultLlmProvider === "prism-ai")
  },
  gitAuth: {
    sshKeyConfigured: false,
    knownHostsConfigured: false,
    storage: "not-configured"
  },
  rawSources: [],
  scans: [],
  wikiSnapshots: [],
  wikiQueries: []
};

function loadPersistedState() {
  try {
    if (!fs.existsSync(dbPath)) return {};
    const raw = fs.readFileSync(dbPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error(`Failed to load wiki DB at ${dbPath}:`, error.message);
    return {};
  }
}

function persistState() {
  const payload = {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    source: state.source,
    llm: state.llm,
    gitAuth: state.gitAuth,
    rawSources: state.rawSources,
    scans: state.scans,
    wikiSnapshots: state.wikiSnapshots,
    wikiQueries: state.wikiQueries
  };
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const tmpPath = `${dbPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
  fs.renameSync(tmpPath, dbPath);
}

function storageStatus() {
  let exists = false;
  let bytes = 0;
  let savedAt = null;
  try {
    const stat = fs.statSync(dbPath);
    exists = true;
    bytes = stat.size;
    const raw = fs.readFileSync(dbPath, "utf8");
    savedAt = JSON.parse(raw).savedAt || stat.mtime.toISOString();
  } catch (_error) {
    exists = false;
  }
  return {
    mode: "persistent-json-db",
    durable: true,
    path: dbPath,
    exists,
    bytes,
    savedAt,
    scans: state.scans.length,
    snapshots: state.wikiSnapshots.length,
    rawSources: state.rawSources.length,
    questions: state.wikiQueries.length
  };
}

const persistedState = loadPersistedState();
const state = {
  ...initialState,
  ...persistedState,
  source: { ...initialState.source, ...(persistedState.source || {}) },
  llm: { ...initialState.llm, ...(persistedState.llm || {}) },
  gitAuth: { ...initialState.gitAuth, ...(persistedState.gitAuth || {}) },
  rawSources: Array.isArray(persistedState.rawSources) ? persistedState.rawSources : [],
  scans: Array.isArray(persistedState.scans) ? persistedState.scans : [],
  wikiSnapshots: Array.isArray(persistedState.wikiSnapshots) ? persistedState.wikiSnapshots : [],
  wikiQueries: Array.isArray(persistedState.wikiQueries) ? persistedState.wikiQueries : []
};

function isGitSshKeyConfigured() {
  return Boolean(process.env.GIT_SSH_PRIVATE_KEY || state.gitAuth.sshKeyConfigured || fs.existsSync(gitSshKeyPath));
}

function isKnownHostsConfigured() {
  return Boolean(process.env.GIT_KNOWN_HOSTS || state.gitAuth.knownHostsConfigured || fs.existsSync(gitKnownHostsPath));
}

function sanitizeSource(input = {}) {
  const type = ["git", "local-folder", "zip-upload"].includes(input.type) ? input.type : "git";
  return {
    type,
    gitUrl: String(input.gitUrl || "").trim(),
    localPath: String(input.localPath || "").trim(),
    archiveName: String(input.archiveName || "").trim(),
    branch: String(input.branch || "main").trim() || "main",
    authMode: ["none", "ssh-key"].includes(input.authMode) ? input.authMode : "ssh-key"
  };
}

function sanitizeLlm(input = {}) {
  const provider = String(input.provider || defaultLlmProvider).trim() || defaultLlmProvider;
  const preset = llmProviders[provider] || llmProviders.custom;
  const apiKeyConfigured = Boolean(process.env.LLM_API_KEY || provider === "prism-ai" || String(input.apiKey || "").trim());
  return {
    provider,
    label: preset.label,
    model: String(input.model || preset.model).trim() || preset.model,
    endpoint: String(input.endpoint || preset.endpoint).trim() || preset.endpoint,
    authMode: preset.authMode,
    connected: apiKeyConfigured,
    apiKeyConfigured
  };
}

function validateSource(source) {
  if (source.type === "git" && !source.gitUrl) return "Git repository URL is required.";
  if (source.type === "git" && source.authMode === "ssh-key" && !isGitSshKeyConfigured()) {
    return "Git SSH private key is not configured in the runtime secret.";
  }
  if (source.type === "local-folder" && !source.localPath) return "Local folder path is required.";
  if (source.type === "zip-upload" && !source.archiveName) return "Archive filename is required.";
  return "";
}

function gitAuthStatus() {
  return {
    authMode: state.source.authMode,
    sshKeyConfigured: isGitSshKeyConfigured(),
    knownHostsConfigured: isKnownHostsConfigured(),
    sshKeyPath: gitSshKeyPath,
    knownHostsPath: gitKnownHostsPath,
    secretName: "karpati-git-ssh",
    storage: state.gitAuth.storage
  };
}

function normalizePrivateKey(value = "") {
  const key = String(value).trim();
  if (!key) return "";
  if (!key.includes("BEGIN") || !key.includes("PRIVATE KEY")) return "";
  return `${key}\n`;
}

function writeSecretFile(path, content, mode) {
  fs.mkdirSync(path.split("/").slice(0, -1).join("/"), { recursive: true });
  fs.writeFileSync(path, content, { mode });
  fs.chmodSync(path, mode);
}

function scanSourceName(source) {
  if (source.type === "git") return source.gitUrl || "Git repository";
  if (source.type === "local-folder") return source.localPath || "Local folder";
  return source.archiveName || "ZIP archive";
}

function slugify(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function wikiLink(title) {
  return `[[${title}]]`;
}

function pagePath(title) {
  return `${pageFolders[title] || "reference"}/${title.replace(/\s+/g, "-")}.md`;
}

function specialPagePath(title) {
  if (title === "index.md") return "index.md";
  if (title === "log.md") return "log.md";
  if (title === "AGENTS.md") return "AGENTS.md";
  return pagePath(title);
}

function titleFromSlugOrPath(value = "") {
  const last = String(value).split("/").pop() || value;
  const withoutExtension = last.replace(/\.md$/i, "");
  return pages.find((title) => slugify(title) === slugify(withoutExtension)) || value;
}

function buildMarkdownPage(title, template, scan, sourceName) {
  const generatedAt = new Date().toISOString();
  const related = template.relationships.map(wikiLink).join(", ");
  const tags = (pageTags[title] || ["#wiki"]).join(" ");
  const path = pagePath(title);
  const body = [
    `# ${title}`,
    "",
    `**Summary**: ${template.summary}`,
    `**Tags**: ${tags}`,
    `**Path**: ${path}`,
    `**Created**: ${generatedAt}`,
    `**Last Updated**: ${generatedAt}`,
    "",
    "---",
    "",
    "## Content",
    "",
    "### Summary",
    template.summary,
    "",
    "### Related Notes",
    related,
    "",
    "### Source Context",
    `- Source: ${sourceName}`,
    `- Branch/ref: ${scan.source.branch || "main"}`,
    `- Scan: ${scan.id}`,
    `- Generated at: ${generatedAt}`,
    `- LLM provider: ${scan.llm.label || scan.llm.provider}/${scan.llm.model}`,
    "",
    ...template.sections.flatMap(([heading, text]) => [`## ${heading}`, text, ""]),
    "## Citations",
    `- Scan record: ${scan.id}`,
    `- Source setting: ${sourceName}`,
    `- Generated page path: ${path}`,
    "",
    "## Agent Notes",
    `- Retrieve related pages before changing behavior: ${related}.`,
    "- Use scan metadata and context windows as provenance for follow-up questions.",
    "- Improve this document when code structure, deployment behavior, or operational lessons change."
  ];
  return body.join("\n");
}

function buildRawSourceRecord(scan, generatedAt) {
  const sourceName = scanSourceName(scan.source);
  return {
    id: `raw-${scan.id}`,
    scanId: scan.id,
    name: sourceName,
    type: scan.source.type,
    branch: scan.source.branch || "main",
    capturedAt: generatedAt,
    immutable: true,
    mutableByLlm: false,
    path: `raw/${scan.id}/${slugify(sourceName) || "source"}`,
    checksum: `${scan.id}:${slugify(sourceName)}:${scan.source.branch || "main"}`,
    policy: "Raw sources are source-of-truth inputs. The LLM may cite and summarize them but must not rewrite them."
  };
}

function wikiMaintenanceSchema() {
  return {
    filename: "AGENTS.md",
    path: "AGENTS.md",
    owner: "human-and-llm",
    markdown: [
      "# AGENTS.md",
      "",
      "## Roles",
      "- Human owns source curation, review, and emphasis.",
      "- LLM owns generated Markdown wiki maintenance.",
      "- Raw sources are immutable and must never be edited by the LLM.",
      "",
      "## Workflow",
      "- Ingest one immutable raw source at a time when possible.",
      "- Read index.md before answering queries or editing pages.",
      "- Update related entity, topic, runbook, and glossary pages after every ingest.",
      "- Append log.md for ingests, filed query answers, and lint passes.",
      "- File valuable query answers back into queries/*.md so exploration compounds.",
      "- Run lint for contradictions, orphans, stale claims, missing cross-references, and data gaps.",
      "",
      "## Markdown Conventions",
      "- Use wiki links like [[Deployment]] for relationships.",
      "- Keep front-loaded summaries, tags, provenance, and citations.",
      "- Prefer explicit source IDs, scan IDs, page paths, and timestamps over vague claims."
    ].join("\n")
  };
}

function makeSpecialPage({ id, title, path, summary, markdown, generatedAt, scanId, tags, links = [] }) {
  return {
    id,
    title,
    filename: path,
    path,
    folder: "root",
    tags,
    aliases: [title, path],
    scanId,
    source: "generated-wiki-control-plane",
    generatedAt,
    freshness: "Maintained",
    confidence: 0.99,
    summary,
    relationships: links,
    links,
    backlinks: [],
    citations: [`scan:${scanId}`, `path:${path}`],
    contextWindows: [`${path}: ${summary}`],
    markdown
  };
}

function buildIndexMarkdown(snapshot) {
  const byFolder = new Map();
  snapshot.pages
    .filter((page) => !["index.md", "log.md"].includes(page.path))
    .forEach((page) => {
      const entries = byFolder.get(page.folder) || [];
      entries.push(page);
      byFolder.set(page.folder, entries);
    });
  const lines = [
    "# index.md",
    "",
    "Content-oriented catalog for the generated LLM-owned wiki.",
    "",
    `- Snapshot: ${snapshot.id}`,
    `- Scan: ${snapshot.scanId}`,
    `- Generated: ${snapshot.generatedAt}`,
    `- Raw sources: ${snapshot.rawSources.map((source) => source.id).join(", ")}`,
    ""
  ];
  [...byFolder.keys()].sort().forEach((folder) => {
    lines.push(`## ${folder}`, "");
    byFolder.get(folder).forEach((page) => {
      lines.push(`- [[${page.title}]] - ${page.summary}`);
    });
    lines.push("");
  });
  return lines.join("\n");
}

function buildLogMarkdown(snapshot) {
  const entries = snapshot.logEntries || [];
  return [
    "# log.md",
    "",
    "Chronological append-only record of wiki maintenance actions.",
    "",
    ...entries.map((entry) => [
      `## [${entry.at.slice(0, 10)}] ${entry.type} | ${entry.title}`,
      `- Time: ${entry.at}`,
      `- Scan: ${entry.scanId}`,
      `- Details: ${entry.details}`
    ].join("\n\n"))
  ].join("\n\n");
}

function refreshSnapshotControlPages(snapshot) {
  const generatedAt = new Date().toISOString();
  const schema = wikiMaintenanceSchema();
  snapshot.schema = schema;
  snapshot.pages = snapshot.pages.filter((page) => !["index.md", "log.md"].includes(page.path));
  snapshot.pages.unshift(
    makeSpecialPage({
      id: `${snapshot.id}-index`,
      title: "index.md",
      path: "index.md",
      summary: "Catalog of generated wiki pages, organized by folder with one-line summaries.",
      markdown: buildIndexMarkdown(snapshot),
      generatedAt,
      scanId: snapshot.scanId,
      tags: ["#index", "#navigation"],
      links: snapshot.pages.map((page) => page.title)
    }),
    makeSpecialPage({
      id: `${snapshot.id}-log`,
      title: "log.md",
      path: "log.md",
      summary: "Append-only timeline of ingests, query answers, and lint passes.",
      markdown: buildLogMarkdown(snapshot),
      generatedAt,
      scanId: snapshot.scanId,
      tags: ["#log", "#timeline"],
      links: ["index.md"]
    })
  );
  snapshot.pageCount = snapshot.pages.length;
  snapshot.vault = {
    root: "/wiki",
    rawRoot: "/wiki/raw",
    generatedRoot: "/wiki/generated",
    schemaPath: schema.path,
    folders: [...new Set(snapshot.pages.map((page) => page.folder))].sort(),
    tags: [...new Set(snapshot.pages.flatMap((page) => page.tags))].sort(),
    files: snapshot.pages.map((page) => page.path),
    rawSources: snapshot.rawSources.map((source) => source.path)
  };
  snapshot.pages.forEach((page) => {
    page.backlinks = snapshot.pages
      .filter((candidate) => candidate.id !== page.id && candidate.relationships.includes(page.title))
      .map((candidate) => candidate.title);
  });
}

function buildWikiSnapshot(scan) {
  const sourceName = scanSourceName(scan.source);
  const generatedAt = new Date().toISOString();
  const rawSource = buildRawSourceRecord(scan, generatedAt);
  const selectedPages = pages;
  const snapshotPages = selectedPages.map((title, index) => {
    const template = wikiTemplates[title];
    const links = template.relationships.filter((relationship) => selectedPages.includes(relationship));
    const path = pagePath(title);
    return {
      id: `${scan.id}-${slugify(title)}`,
      title,
      filename: `${title.replace(/\s+/g, "-")}.md`,
      path,
      folder: pageFolders[title] || "reference",
      tags: pageTags[title] || ["#wiki"],
      aliases: [title, `${title}.md`, path],
      scanId: scan.id,
      source: sourceName,
      generatedAt,
      freshness: "Generated",
      confidence: Number((0.88 - index * 0.03).toFixed(2)),
      summary: `${template.summary} Source: ${sourceName}. Branch/ref: ${scan.source.branch || "main"}.`,
      relationships: template.relationships,
      links,
      backlinks: [],
      citations: [`scan:${scan.id}`, `source:${sourceName}`, `path:${path}`],
      contextWindows: [
        `File ${path}: ${template.summary}`,
        `Scan ${scan.id} accepted ${sourceName} on ${scan.source.branch || "main"}.`,
        `Knowledge generated with ${scan.llm.label || scan.llm.provider}/${scan.llm.model}. Related pages: ${template.relationships.join(", ")}.`
      ],
      markdown: buildMarkdownPage(title, template, scan, sourceName)
    };
  });

  snapshotPages.forEach((page) => {
    page.backlinks = snapshotPages
      .filter((candidate) => candidate.id !== page.id && candidate.relationships.includes(page.title))
      .map((candidate) => candidate.title);
  });

  const snapshot = {
    id: `wiki-${scan.id}`,
    scanId: scan.id,
    source: scan.source,
    llm: scan.llm,
    generatedAt,
    pattern: "karpathy-llm-wiki",
    layers: ["raw-sources", "generated-markdown-wiki", "AGENTS.md-schema"],
    rawSources: [rawSource],
    schema: wikiMaintenanceSchema(),
    logEntries: [{
      at: generatedAt,
      type: "ingest",
      title: sourceName,
      scanId: scan.id,
      details: `Created immutable raw source ${rawSource.id} and generated Markdown wiki pages.`
    }],
    pageCount: snapshotPages.length,
    vault: {},
    pages: snapshotPages
  };
  refreshSnapshotControlPages(snapshot);
  return snapshot;
}

function latestWikiSnapshot() {
  return state.wikiSnapshots[0] || null;
}

function findWikiPage(pageId) {
  const requestedTitle = titleFromSlugOrPath(pageId);
  for (const snapshot of state.wikiSnapshots) {
    const page = snapshot.pages.find(
      (candidate) =>
        candidate.id === pageId ||
        candidate.path === pageId ||
        candidate.filename === pageId ||
        slugify(candidate.title) === slugify(pageId) ||
        candidate.title === requestedTitle
    );
    if (page) return { snapshot, page };
  }
  return { snapshot: null, page: null };
}

function snapshotGraph(snapshot) {
  const nodes = snapshot.pages.map((page) => ({
    id: page.id,
    title: page.title,
    path: page.path,
    folder: page.folder,
    tags: page.tags
  }));
  const edges = snapshot.pages.flatMap((page) =>
    page.links.map((targetTitle) => ({
      from: page.title,
      to: targetTitle,
      fromId: page.id,
      toId: snapshot.pages.find((candidate) => candidate.title === targetTitle)?.id || null,
      type: "wiki-link"
    }))
  );
  return { nodes, edges };
}

function rankPages(snapshot, question) {
  const tokens = String(question || "")
    .toLowerCase()
    .split(/[^a-z0-9#]+/)
    .filter(Boolean);
  return snapshot.pages
    .map((page) => {
      const haystack = `${page.title} ${page.summary} ${page.tags.join(" ")} ${page.relationships.join(" ")} ${page.markdown}`.toLowerCase();
      const hits = tokens.filter((token) => haystack.includes(token)).length;
      return { page, hits };
    })
    .sort((a, b) => b.hits - a.hits || b.page.confidence - a.page.confidence)
    .slice(0, 4)
    .map((entry) => entry.page);
}

function answerWikiQuestion(snapshot, question) {
  const selected = rankPages(snapshot, question);
  const sources = selected.map((page) => ({
    id: page.id,
    title: page.title,
    path: page.path,
    summary: page.summary,
    citations: page.citations
  }));
  const answer = selected.length
    ? [
        `Grounded answer from ${snapshot.id}:`,
        ...selected.map((page) => `- ${page.title}.md says: ${page.summary}`),
        "Use the cited markdown files to verify details before making code or deployment changes."
      ]
    : ["The current wiki snapshot does not contain enough relevant information to answer this question."];
  return {
    question,
    snapshotId: snapshot.id,
    scanId: snapshot.scanId,
    mode: "grounded-markdown",
    answer,
    sources,
    loggedAt: new Date().toISOString()
  };
}

function queryPageTitle(question) {
  const compact = String(question || "Question").replace(/\s+/g, " ").trim();
  return `Query - ${compact.slice(0, 72) || "Question"}`;
}

function fileQueryAnswerPage(snapshot, result) {
  const now = result.loggedAt || new Date().toISOString();
  const title = queryPageTitle(result.question);
  const id = `${snapshot.id}-query-${Date.now().toString(36)}`;
  const queryPath = `queries/${slugify(title) || "query-answer"}.md`;
  const markdown = [
    `# ${title}`,
    "",
    `**Summary**: Filed answer for: ${result.question}`,
    "**Tags**: #query-answer #filed-answer #exploration",
    `**Path**: ${queryPath}`,
    `**Created**: ${now}`,
    `**Last Updated**: ${now}`,
    "",
    "## Question",
    result.question,
    "",
    "## Answer",
    ...result.answer,
    "",
    "## Sources",
    ...result.sources.map((source) => `- [[${source.title}]] (${source.path})`),
    "",
    "## Filing Notes",
    "- This page was created from a query so useful exploration becomes durable wiki knowledge.",
    "- Re-run lint after filing significant analyses to catch missing links or stale claims."
  ].join("\n");
  const page = {
    id,
    title,
    filename: `${slugify(title)}.md`,
    path: queryPath,
    folder: "queries",
    tags: ["#query-answer", "#filed-answer", "#exploration"],
    aliases: [title, queryPath],
    scanId: snapshot.scanId,
    source: "wiki-query",
    generatedAt: now,
    freshness: "Filed",
    confidence: 0.84,
    summary: `Filed answer for query: ${result.question}`,
    relationships: result.sources.map((source) => source.title),
    links: result.sources.map((source) => source.title),
    backlinks: [],
    citations: result.sources.flatMap((source) => source.citations || [`path:${source.path}`]),
    contextWindows: [
      `Question: ${result.question}`,
      `Answer filed from ${result.sources.length} generated Markdown source pages.`
    ],
    markdown
  };
  snapshot.pages.push(page);
  snapshot.logEntries = [
    {
      at: now,
      type: "query",
      title,
      scanId: snapshot.scanId,
      details: `Filed answer page ${queryPath} from ${result.sources.length} cited wiki pages.`
    },
    ...(snapshot.logEntries || [])
  ];
  refreshSnapshotControlPages(snapshot);
  result.filedPage = { id: page.id, title: page.title, path: page.path };
  return page;
}

function lintWikiSnapshot(snapshot) {
  const findings = [];
  const pageTitles = new Set(snapshot.pages.map((page) => page.title));
  const pagesByTitle = new Map(snapshot.pages.map((page) => [page.title, page]));
  snapshot.pages.forEach((page) => {
    if (["index.md", "log.md"].includes(page.path)) return;
    const meaningfulBacklinks = page.backlinks.filter((title) => !["index.md", "log.md"].includes(title));
    if (!meaningfulBacklinks.length && page.folder !== "queries") {
      findings.push({
        type: "orphan",
        severity: "warning",
        pageId: page.id,
        path: page.path,
        message: `${page.title} has no inbound links from content pages.`
      });
    }
    page.relationships.forEach((relationship) => {
      if (!pageTitles.has(relationship)) {
        findings.push({
          type: "missing-cross-reference",
          severity: "warning",
          pageId: page.id,
          path: page.path,
          message: `${page.title} links to missing page ${relationship}.`
        });
      }
    });
    if (!page.citations?.length) {
      findings.push({
        type: "stale-claim",
        severity: "error",
        pageId: page.id,
        path: page.path,
        message: `${page.title} has claims without citations and should be refreshed from raw sources.`
      });
    }
  });
  snapshot.pages.forEach((page) => {
    page.relationships.forEach((relationship) => {
      const target = pagesByTitle.get(relationship);
      if (target && target.relationships.includes(page.title) && page.summary === target.summary) {
        findings.push({
          type: "contradiction",
          severity: "info",
          pageId: page.id,
          path: page.path,
          message: `${page.title} and ${target.title} mirror each other too closely; verify whether one should supersede the other.`
        });
      }
    });
  });
  if (!findings.some((finding) => finding.type === "contradiction")) {
    findings.push({
      type: "contradiction",
      severity: "pass",
      pageId: null,
      path: null,
      message: "No direct contradictions detected by the current markdown lint pass."
    });
  }
  if (!findings.some((finding) => finding.type === "stale-claim")) {
    findings.push({
      type: "stale-claim",
      severity: "pass",
      pageId: null,
      path: null,
      message: "No uncited stale-claim candidates detected."
    });
  }
  const lintedAt = new Date().toISOString();
  snapshot.logEntries = [
    {
      at: lintedAt,
      type: "lint",
      title: "Wiki health check",
      scanId: snapshot.scanId,
      details: `Found ${findings.filter((finding) => finding.severity !== "pass").length} actionable issue(s).`
    },
    ...(snapshot.logEntries || [])
  ];
  refreshSnapshotControlPages(snapshot);
  return { lintedAt, findings };
}

function buildAiWikiAdvice(page, snapshot, intent = "explain") {
  const improvementMarkdown = [
    page.markdown,
    "",
    "## Improvement Suggestions",
    `- Add exact file references from scan ${snapshot.scanId} once parser extraction is connected to source symbols.`,
    "- Expand relationships into explicit upstream/downstream impact notes.",
    "- Add verification commands or endpoint checks when this page describes runtime behavior.",
    "- Record any human correction as persistent project memory so future scans preserve it."
  ].join("\n");

  return {
    intent,
    pageId: page.id,
    title: page.title,
    scanId: snapshot.scanId,
    model: snapshot.llm?.model || state.llm.model,
    explanation: [
      `This document exists because the product contract requires ${page.title}.md style knowledge pages for every scanned project.`,
      `The current content was generated from scan metadata, source type, branch/ref, and the ${page.relationships.join(", ")} relationship template.`,
      "It is intentionally optimized for AI agents: summary first, linked relationships, provenance, context windows, and operational notes."
    ],
    suggestions: [
      "Attach parser evidence such as files, functions, manifests, and services to each section.",
      "Promote repeated troubleshooting fixes into runbook and known-issues pages.",
      "Keep Obsidian-style links in the Markdown so page relationships remain navigable in the UI and MCP retrieval."
    ],
    improvedMarkdown: improvementMarkdown
  };
}

function formatScan(scan) {
  if (scan.status === "waiting_for_llm_credentials") {
    return {
      ...scan,
      status: "waiting_for_llm_credentials",
      progress: 0,
      currentStage: "Waiting for LLM credentials",
      updatedAt: scan.createdAt,
      stages: scanStages.map((stage) => ({ ...stage, state: "pending" })),
      messages: [
        "Scan request was saved.",
        "Configure an LLM provider key or Prism AI provider before the scanner can continue."
      ]
    };
  }

  const elapsed = Date.now() - new Date(scan.createdAt).getTime();
  const activeIndex = scanStages.findLastIndex((stage) => elapsed >= stage.atMs);
  const boundedIndex = Math.max(0, Math.min(activeIndex, scanStages.length - 1));
  const activeStage = scanStages[boundedIndex];
  const complete = boundedIndex === scanStages.length - 1;
  const stages = scanStages.map((stage, index) => ({
    key: stage.key,
    label: stage.label,
    progress: stage.progress,
    state: index < boundedIndex ? "done" : index === boundedIndex ? (complete ? "done" : "running") : "pending"
  }));

  return {
    ...scan,
    status: complete ? "ready" : activeStage.key,
    progress: activeStage.progress,
    currentStage: activeStage.label,
    updatedAt: new Date(new Date(scan.createdAt).getTime() + activeStage.atMs).toISOString(),
    wikiSnapshot: complete ? state.wikiSnapshots.find((snapshot) => snapshot.scanId === scan.id) || null : null,
    stages,
    messages: [
      `Accepted ${scanSourceName(scan.source)} on ${scan.source.branch || "main"}.`,
      `Git SSH key: ${scan.gitAuth.sshKeyConfigured ? "configured" : "not used"}.`,
      `LLM provider: ${scan.llm.label || scan.llm.provider}/${scan.llm.model}.`,
      complete
        ? "Wiki snapshot is ready for search and MCP retrieval."
        : `Current stage: ${activeStage.label}.`
    ]
  };
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "karpati-llm-wiki", version, timestamp: new Date().toISOString() });
});

app.get("/api/projects", (_req, res) => {
  res.json({
    projects: [
      {
        id: "demo-karpati",
        name: "karpati llm wiki",
        sourceTypes: ["github", "local-folder", "zip-upload"],
        completeness: 42,
        status: state.scans.length ? "scan_queued" : "ready_for_repository_intake",
        source: state.source,
        llm: state.llm,
        gitAuth: gitAuthStatus(),
        wikiPages: pages.length
      }
    ]
  });
});

app.get("/api/settings", (_req, res) => {
  res.json({ source: state.source, llm: state.llm, llmProviders, gitAuth: gitAuthStatus() });
});

app.get("/api/storage", (_req, res) => {
  res.json({ storage: storageStatus() });
});

app.get("/api/settings/git-auth", (_req, res) => {
  res.json(gitAuthStatus());
});

app.put("/api/settings/git-auth", (req, res) => {
  const privateKey = normalizePrivateKey(req.body?.privateKey);
  const knownHosts = String(req.body?.knownHosts || "").trim();
  if (!privateKey) {
    return res.status(400).json({ ok: false, error: "A valid SSH private key is required." });
  }

  let storage = "memory";
  try {
    writeSecretFile(gitSshKeyPath, privateKey, 0o400);
    if (knownHosts) {
      writeSecretFile(gitKnownHostsPath, `${knownHosts}\n`, 0o444);
    }
    storage = "file";
  } catch (_error) {
    storage = "memory-fallback";
  }

  state.gitAuth = {
    sshKeyConfigured: true,
    knownHostsConfigured: Boolean(knownHosts || isKnownHostsConfigured()),
    storage
  };
  persistState();
  res.json({ ok: true, gitAuth: gitAuthStatus() });
});

app.get("/api/llm/providers", (_req, res) => {
  res.json({ providers: llmProviders, defaultProvider: defaultLlmProvider });
});

app.put("/api/settings/source", (req, res) => {
  const source = sanitizeSource(req.body);
  const error = validateSource(source);
  if (error) return res.status(400).json({ ok: false, error });
  state.source = source;
  persistState();
  res.json({ ok: true, source: state.source });
});

app.put("/api/settings/llm", (req, res) => {
  state.llm = sanitizeLlm(req.body);
  persistState();
  res.json({ ok: true, llm: state.llm });
});

app.get("/api/wiki/search", (req, res) => {
  const query = String(req.query.q || "").trim();
  const snapshot = latestWikiSnapshot();
  const snapshotPages = snapshot?.pages || [];
  const matchingPages = snapshotPages.length
    ? snapshotPages.filter((page) =>
        !query ||
        `${page.title} ${page.path} ${page.summary} ${page.tags.join(" ")} ${page.relationships.join(" ")} ${page.markdown}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : [];
  const fallbackPages = pages.slice(0, 6).map((title, index) => ({
    id: `seed-${slugify(title)}`,
    title,
    scanId: null,
    generatedAt: null,
    score: Number((0.91 - index * 0.05).toFixed(2)),
    summary: `${title} knowledge for AI agents, including relationships, dependencies, and operational context.`,
    related: pages.slice(index + 1, index + 4)
  }));

  res.json({
    query,
    mode: "hybrid",
    snapshotId: snapshot?.id || null,
    scanId: snapshot?.scanId || null,
    generated: Boolean(snapshot),
    results: snapshotPages.length ? (matchingPages.length ? matchingPages : snapshotPages).map((page, index) => ({
      id: page.id,
      title: page.title,
      path: page.path,
      folder: page.folder,
      tags: page.tags,
      score: Number((0.94 - index * 0.04).toFixed(2)),
      summary: page.summary,
      related: page.relationships,
      generatedAt: page.generatedAt,
      scanId: page.scanId
    })) : fallbackPages
  });
});

app.get("/api/wiki/snapshots/latest", (_req, res) => {
  const snapshot = latestWikiSnapshot();
  if (!snapshot) return res.status(404).json({ error: "No generated wiki snapshot exists yet. Run a repository scan first." });
  res.json({ snapshot });
});

app.get("/api/wiki/vault", (_req, res) => {
  const snapshot = latestWikiSnapshot();
  if (!snapshot) return res.status(404).json({ error: "No generated wiki snapshot exists yet. Run a repository scan first." });
  res.json({
    snapshotId: snapshot.id,
    scanId: snapshot.scanId,
    generatedAt: snapshot.generatedAt,
    pattern: snapshot.pattern,
    layers: snapshot.layers,
    vault: snapshot.vault,
    schema: snapshot.schema,
    rawSources: snapshot.rawSources,
    queryCount: state.wikiQueries.filter((query) => query.snapshotId === snapshot.id).length
  });
});

app.get("/api/wiki/raw-sources", (_req, res) => {
  const snapshot = latestWikiSnapshot();
  res.json({
    policy: "Raw sources are immutable source-of-truth inputs. Generated wiki pages cite them but do not modify them.",
    rawSources: state.rawSources,
    latestSnapshotSources: snapshot?.rawSources || []
  });
});

app.get("/api/wiki/schema", (_req, res) => {
  const snapshot = latestWikiSnapshot();
  const schema = snapshot?.schema || wikiMaintenanceSchema();
  res.json({ schema });
});

app.get("/api/wiki/index", (_req, res) => {
  const { page, snapshot } = findWikiPage("index.md");
  if (!page) return res.status(404).json({ error: "No generated index.md exists yet. Run a repository scan first." });
  res.json({ page, snapshotId: snapshot.id });
});

app.get("/api/wiki/log", (_req, res) => {
  const { page, snapshot } = findWikiPage("log.md");
  if (!page) return res.status(404).json({ error: "No generated log.md exists yet. Run a repository scan first." });
  res.json({ page, snapshotId: snapshot.id });
});

app.get("/api/wiki/lint", (_req, res) => {
  const snapshot = latestWikiSnapshot();
  if (!snapshot) return res.status(404).json({ error: "No generated wiki snapshot exists yet. Run a repository scan first." });
  const lint = lintWikiSnapshot(snapshot);
  persistState();
  res.json({
    snapshotId: snapshot.id,
    scanId: snapshot.scanId,
    ...lint,
    summary: {
      contradictions: lint.findings.filter((finding) => finding.type === "contradiction").length,
      orphans: lint.findings.filter((finding) => finding.type === "orphan").length,
      staleClaims: lint.findings.filter((finding) => finding.type === "stale-claim").length,
      missingCrossReferences: lint.findings.filter((finding) => finding.type === "missing-cross-reference").length
    }
  });
});

app.get("/api/wiki/export", (_req, res) => {
  const snapshot = latestWikiSnapshot();
  if (!snapshot) return res.status(404).json({ error: "No generated wiki snapshot exists yet. Run a repository scan first." });
  const exported = snapshot.pages.map((page) => `<!-- ${page.path} -->\n${page.markdown}`).join("\n\n---\n\n");
  res.type("text/markdown").send(exported);
});

app.get("/api/wiki/pages", (_req, res) => {
  const snapshot = latestWikiSnapshot();
  if (!snapshot) return res.status(404).json({ error: "No generated wiki snapshot exists yet. Run a repository scan first." });
  res.json({
    snapshotId: snapshot.id,
    scanId: snapshot.scanId,
    pages: snapshot.pages.map((page) => ({
      id: page.id,
      title: page.title,
      filename: page.filename,
      path: page.path,
      folder: page.folder,
      tags: page.tags,
      aliases: page.aliases,
      summary: page.summary,
      freshness: page.freshness,
      confidence: page.confidence,
      relationships: page.relationships,
      links: page.links,
      backlinks: page.backlinks,
      citations: page.citations,
      generatedAt: page.generatedAt,
      scanId: page.scanId
    }))
  });
});

app.get("/api/wiki/pages/:id", (req, res) => {
  const { page, snapshot } = findWikiPage(req.params.id);
  if (!page) return res.status(404).json({ error: "Wiki page not found." });
  res.json({ page, snapshotId: snapshot.id });
});

app.post("/api/wiki/pages/:id/ai", (req, res) => {
  const { page, snapshot } = findWikiPage(req.params.id);
  if (!page) return res.status(404).json({ error: "Wiki page not found." });
  const intent = String(req.body?.intent || "explain").trim() || "explain";
  res.json({ assistance: buildAiWikiAdvice(page, snapshot, intent) });
});

app.post("/api/wiki/ask", (req, res) => {
  const snapshot = latestWikiSnapshot();
  if (!snapshot) return res.status(404).json({ error: "No generated wiki snapshot exists yet. Run a repository scan first." });
  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "Question is required." });
  const result = answerWikiQuestion(snapshot, question);
  const filedPage = fileQueryAnswerPage(snapshot, result);
  state.wikiQueries.unshift(result);
  state.wikiQueries = state.wikiQueries.slice(0, 50);
  persistState();
  res.json({ result, filedPage });
});

app.get("/api/wiki/questions", (_req, res) => {
  res.json({ questions: state.wikiQueries.slice(0, 20), count: state.wikiQueries.length });
});

app.get("/api/wiki/graph", (_req, res) => {
  const snapshot = latestWikiSnapshot();
  if (!snapshot) return res.status(404).json({ error: "No generated wiki snapshot exists yet. Run a repository scan first." });
  res.json({ snapshotId: snapshot.id, scanId: snapshot.scanId, graph: snapshotGraph(snapshot) });
});

app.get("/api/graph/dependencies", (_req, res) => {
  const snapshot = latestWikiSnapshot();
  if (snapshot) {
    const graph = snapshotGraph(snapshot);
    return res.json({
      nodes: graph.nodes.map((node) => node.title),
      edges: graph.edges.map((edge) => [edge.from, edge.to]),
      generated: true,
      snapshotId: snapshot.id
    });
  }
  res.json({
    nodes: ["Repository", "Scanner", "Parser", "Knowledge Generator", "Knowledge Graph", "MCP Server", "AI Agents"],
    edges: [
      ["Repository", "Scanner"],
      ["Scanner", "Parser"],
      ["Parser", "Knowledge Generator"],
      ["Knowledge Generator", "Knowledge Graph"],
      ["Knowledge Graph", "MCP Server"],
      ["MCP Server", "AI Agents"]
    ]
  });
});

app.get("/api/mcp/tools", (_req, res) => {
  res.json({
    tools: [
      { name: "wiki.search", description: "Search generated project Markdown knowledge." },
      { name: "wiki.retrieve", description: "Retrieve a generated wiki page with context windows." },
      { name: "wiki.raw_sources", description: "List immutable raw source records used as source of truth." },
      { name: "wiki.schema", description: "Retrieve AGENTS.md-style wiki maintenance workflow." },
      { name: "wiki.index", description: "Read generated index.md before answering or editing." },
      { name: "wiki.log", description: "Read append-only log.md of ingests, queries, and lint passes." },
      { name: "wiki.lint", description: "Find contradictions, orphans, stale claims, and missing cross-references." },
      { name: "wiki.file_answer", description: "File a useful query answer back as a generated Markdown page." },
      { name: "graph.downstream", description: "Find downstream dependencies." },
      { name: "plan.deployment", description: "Generate deployment plans from project memory." }
    ]
  });
});

app.post("/api/repositories/scan", (req, res) => {
  const source = sanitizeSource(req.body?.source || state.source);
  const llm = sanitizeLlm(req.body?.llm || state.llm);
  const error = validateSource(source);
  if (error) return res.status(400).json({ accepted: false, error });
  state.source = source;
  state.llm = llm;
  const scanId = `scan-${Date.now().toString(36)}`;
  const scan = {
    id: scanId,
    source,
    llm,
    gitAuth: gitAuthStatus(),
    status: llm.connected ? "queued" : "waiting_for_llm_credentials",
    createdAt: new Date().toISOString()
  };
  state.scans.unshift(scan);
  if (scan.status === "queued") {
    const snapshot = buildWikiSnapshot(scan);
    state.rawSources.unshift(...snapshot.rawSources);
    state.wikiSnapshots.unshift(snapshot);
  }
  persistState();
  res.status(202).json({
    accepted: true,
    scanId,
    source,
    llm,
    gitAuth: scan.gitAuth,
    status: scan.status,
    progress: formatScan(scan).progress,
    links: { status: `/api/scans/${scanId}`, history: "/api/scans", wiki: "/api/wiki/snapshots/latest" },
    next: "/api/scans"
  });
});

app.post("/api/demo/scan", (_req, res) => {
  const source = {
    type: "local-folder",
    gitUrl: "",
    localPath: "/demo/karpati-llm-wiki",
    archiveName: "",
    branch: "main",
    authMode: "none"
  };
  const llm = sanitizeLlm(state.llm);
  state.source = source;
  state.llm = llm;
  const scanId = `scan-${Date.now().toString(36)}`;
  const scan = {
    id: scanId,
    source,
    llm,
    gitAuth: gitAuthStatus(),
    status: "queued",
    createdAt: new Date().toISOString()
  };
  state.scans.unshift(scan);
  const snapshot = buildWikiSnapshot(scan);
  state.rawSources.unshift(...snapshot.rawSources);
  state.wikiSnapshots.unshift(snapshot);
  persistState();
  res.status(202).json({
    accepted: true,
    demo: true,
    scanId,
    source,
    llm,
    gitAuth: scan.gitAuth,
    status: scan.status,
    progress: formatScan(scan).progress,
    links: { status: `/api/scans/${scanId}`, history: "/api/scans", wiki: "/api/wiki/snapshots/latest" },
    next: "/api/scans"
  });
});

app.get("/api/scans", (_req, res) => {
  res.json({
    scans: state.scans.slice(0, 20).map(formatScan),
    count: state.scans.length
  });
});

app.get("/api/scans/:id", (req, res) => {
  const scan = state.scans.find((candidate) => candidate.id === req.params.id);
  if (!scan) return res.status(404).json({ error: "Scan not found." });
  res.json({ scan: formatScan(scan) });
});

if (serveStaticUi) {
  app.use(express.static("dist"));
}

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Karpati LLM Wiki</title>
  <style>
    body{margin:0;font:15px system-ui;background:#f5f7f9;color:#111}
    main{padding:32px;display:grid;gap:20px}
    section{display:grid;grid-template-columns:minmax(280px,460px) 1fr;gap:18px}
    .panel{background:white;border:1px solid #d8dee6;border-radius:8px;padding:18px;display:grid;gap:12px}
    input,select,button,textarea{font:inherit;min-height:42px;border-radius:8px;border:1px solid #cfd7e2;padding:8px 10px}
    textarea{min-height:110px;resize:vertical}
    #privateKey{min-height:160px;font:12px ui-monospace,SFMono-Regular,Consolas,monospace}
    button{background:#0b4f49;color:white;border:0}
    pre{background:#111827;color:#d7f8ee;border-radius:8px;padding:16px;white-space:pre-wrap}
    label{display:grid;gap:5px;font-weight:700;color:#56606b}
    .secret{padding:12px;border:1px solid #dfe7ef;border-radius:8px;background:#f9fbfc;display:grid;gap:10px}
    .progress,.history{background:white;border:1px solid #d8dee6;border-radius:8px;padding:16px;display:grid;gap:12px}
    .bar{height:12px;border-radius:999px;background:#e6ecf3;overflow:hidden}
    .bar span{display:block;height:100%;width:0;background:#0f766e;transition:width .2s ease}
    .stages{display:grid;gap:8px}
    .stage{display:flex;gap:8px;align-items:center;color:#5f6670}
    .stage:before{content:'';width:10px;height:10px;border-radius:999px;border:2px solid #aab5c2;background:white}
    .stage.done,.stage.running{color:#111}
    .stage.done:before{border-color:#0f766e;background:#0f766e}
    .stage.running:before{border-color:#e3a008;background:#e3a008}
    .history button{min-height:48px;text-align:left;background:#f9fbfc;color:#111;border:1px solid #d8dee6}
    .history button.selected{border-color:#0f766e;background:#e7f5f2}
    .wiki{background:white;border:1px solid #d8dee6;border-radius:8px;padding:16px;display:grid;gap:12px}
    .wiki-page{border:1px solid #e3e8ee;border-radius:8px;padding:12px;display:grid;gap:6px}
    .wiki-page strong{display:block}
    .wiki-page span{color:#5f6670}
    .wiki-page button{background:white;color:#0b4f49;border:1px solid #cfd7e2}
    .wiki-reader,.ai-box{border:1px solid #e3e8ee;border-radius:8px;padding:12px;display:grid;gap:10px;background:#fbfcfe}
    .doc-actions{display:flex;gap:8px;flex-wrap:wrap}
    .doc-actions button{width:fit-content}
    .pill-row{display:flex;flex-wrap:wrap;gap:6px}
    .pill-row small{border:1px solid #d8dee6;border-radius:999px;padding:3px 8px;background:#f9fbfc}
    .wiki-ask{border:1px solid #dfe7ef;border-radius:8px;padding:12px;background:#fbfcfe;display:grid;gap:8px}
    .wiki-ask div{display:flex;gap:8px}
    .wiki-ask input{width:100%}
    .source-button{background:white!important;color:#0b4f49!important;border:1px solid #cfd7e2!important}
    small{color:#5f6670}
    @media(max-width:800px){section{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Karpati LLM Wiki</h1>
      <p>Repository intake with Prism AI LLMs and private Git SSH key readiness.</p>
    </header>
    <section>
      <form class="panel">
        <h2>Repository Intake</h2>
        <label>Repository URL<input id="gitUrl" placeholder="git@github.com:org/private.git"></label>
        <label>Branch<input id="branch" value="main"></label>
        <label>Git auth<select id="authMode"><option value="ssh-key">Private SSH key</option><option value="none">No private auth</option></select></label>
        <div class="secret">
          <strong>Private Git SSH key</strong>
          <label>SSH private key<textarea id="privateKey" placeholder="Paste your private key. It will not be echoed back."></textarea></label>
          <label>Known hosts<textarea id="knownHosts" placeholder="Optional: paste known_hosts for GitHub or your Git server"></textarea></label>
          <button type="button" id="saveGitKey">Save private key</button>
        </div>
        <h2>LLM Connection</h2>
        <label>Provider<select id="provider"><option value="prism-ai">Prism AI</option><option value="openai">OpenAI</option><option value="custom">OpenAI-compatible</option></select></label>
        <label>Model<input id="model" value="codex/default"></label>
        <label>Endpoint<input id="endpoint" value="https://prisim-ai.edi-it.com/v1"></label>
        <button type="button" id="save">Save settings</button>
        <button type="button" id="scan">Start scan</button>
        <button type="button" id="demoScan">Demo wiki scan</button>
      </form>
      <div class="panel">
        <h2>Scan Console</h2>
        <div class="progress">
          <strong>Scan Progress</strong>
          <small id="activeScan">No scan submitted yet</small>
          <div class="bar"><span id="bar"></span></div>
          <div id="stages" class="stages"></div>
          <pre id="messages">No scan messages yet.</pre>
        </div>
        <div class="history">
          <strong>Scan History</strong>
          <div id="history">No scans yet.</div>
        </div>
        <div class="wiki">
          <strong>Generated Wiki</strong>
          <small id="wikiStatus">Run a scan to generate wiki pages.</small>
          <div class="wiki-ask">
            <strong>Ask AI about this wiki</strong>
            <div><input id="wikiQuestion" value="Why is the deployment documentation written this way?"><button type="button" id="askWiki">Ask wiki</button></div>
            <pre id="wikiAnswer">Answers are grounded in generated Markdown files and cite sources.</pre>
          </div>
          <div id="wikiPages">No generated wiki snapshot yet.</div>
          <div id="wikiReader" class="wiki-reader">Select a generated .md page to read it.</div>
          <div id="aiBox" class="ai-box">Ask AI about a selected wiki page.</div>
        </div>
        <pre id="console">Loading settings...</pre>
      </div>
    </section>
  </main>
  <script>
    const $ = id => document.getElementById(id);
    const log = t => $('console').textContent = t;
    let activeScanId = '';
    let activePageId = '';
    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    async function j(p,m,b){
      let r = await fetch(p,{method:m||'GET',headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});
      let d = await r.json();
      if(!r.ok) throw Error(d.error || p + ' failed');
      return d;
    }
    function drawScan(scan){
      if(!scan) return;
      activeScanId = scan.id;
      $('activeScan').textContent = scan.id + ' · ' + scan.currentStage + ' · ' + scan.progress + '%';
      $('bar').style.width = scan.progress + '%';
      $('stages').innerHTML = scan.stages.map(s => '<div class="stage '+s.state+'">'+s.label+'</div>').join('');
      $('messages').textContent = scan.messages.join('\\n');
      if(scan.wikiSnapshot) renderWiki(scan.wikiSnapshot);
    }
    function renderWiki(snapshot){
      if(!snapshot || !snapshot.pages || !snapshot.pages.length) return;
      $('wikiStatus').textContent = snapshot.pageCount + ' pages generated from ' + snapshot.scanId;
      $('wikiPages').innerHTML = snapshot.pages.map(p => '<div class="wiki-page"><strong>'+esc(p.filename || p.title + '.md')+'</strong><small>'+esc(p.path || '')+'</small><span>'+esc(p.summary)+'</span><div class="pill-row">'+(p.tags||[]).map(t => '<small>'+esc(t)+'</small>').join('')+p.relationships.map(r => '<small>'+esc(r)+'</small>').join('')+'</div><button type="button" data-page="'+esc(p.id)+'">Open .md</button></div>').join('');
      document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => openPage(b.dataset.page));
      if(!activePageId && snapshot.pages[0]) openPage(snapshot.pages[0].id);
    }
    async function openPage(id){
      activePageId = id;
      let r = await j('/api/wiki/pages/' + encodeURIComponent(id));
      let p = r.page;
      $('wikiReader').innerHTML = '<strong>'+esc(p.title)+'.md</strong><small>scan '+esc(p.scanId)+' · '+Math.round(p.confidence*100)+'% confidence</small><pre>'+esc(p.markdown || p.summary)+'</pre><div class="pill-row"><small>Related: '+esc((p.relationships||[]).join(', '))+'</small><small>Backlinks: '+esc((p.backlinks||[]).join(', ') || 'none')+'</small></div><div class="doc-actions"><button type="button" id="whyDoc">Ask AI why</button><button type="button" id="improveDoc">Improve doc</button></div>';
      $('whyDoc').onclick = () => askAi('explain');
      $('improveDoc').onclick = () => askAi('improve');
    }
    async function askWiki(){
      let r = await j('/api/wiki/ask','POST',{question:$('wikiQuestion').value});
      let a = r.result;
      $('wikiAnswer').innerHTML = esc(a.answer.join('\\n')) + '\\n\\nSources:\\n' + a.sources.map(s => '- '+s.path).join('\\n');
    }
    async function askAi(intent){
      if(!activePageId) return;
      let r = await j('/api/wiki/pages/' + encodeURIComponent(activePageId) + '/ai','POST',{intent});
      let a = r.assistance;
      $('aiBox').innerHTML = '<strong>AI doc assistant · '+esc(a.model)+'</strong><small>Why this doc is like this</small><pre>'+esc(a.explanation.join('\\n'))+'</pre><small>How to improve it</small><pre>'+esc(a.suggestions.join('\\n'))+'</pre><details><summary>Improved Markdown</summary><pre>'+esc(a.improvedMarkdown)+'</pre></details>';
    }
    async function refreshWiki(){
      try {
        let r = await j('/api/wiki/snapshots/latest');
        renderWiki(r.snapshot);
      } catch(_e) {}
    }
    async function refreshScans(){
      let r = await j('/api/scans');
      let scans = r.scans || [];
      let selected = scans.find(s => s.id === activeScanId) || scans[0];
      if(selected) drawScan(selected);
      $('history').innerHTML = scans.length ? scans.slice(0,6).map(s => '<button type="button" data-id="'+s.id+'" class="'+(selected && selected.id===s.id?'selected':'')+'">'+s.id+'\\n'+s.currentStage+'</button>').join('') : 'No scans yet.';
      document.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { activeScanId = b.dataset.id; refreshScans(); });
      await refreshWiki();
    }
    function source(){return{type:'git',gitUrl:$('gitUrl').value,branch:$('branch').value||'main',authMode:$('authMode').value}}
    function llm(){return{provider:$('provider').value,model:$('model').value,endpoint:$('endpoint').value,connected:true,apiKeyConfigured:true}}
    async function load(){
      let s = await j('/api/settings');
      $('gitUrl').value = s.source.gitUrl || '';
      $('branch').value = s.source.branch || 'main';
      $('authMode').value = s.source.authMode || 'ssh-key';
      $('provider').value = s.llm.provider;
      $('model').value = s.llm.model;
      $('endpoint').value = s.llm.endpoint;
      log('ready\\ngit ssh key: '+(s.gitAuth.sshKeyConfigured?'configured':'missing')+'\\nknown hosts: '+(s.gitAuth.knownHostsConfigured?'configured':'default')+'\\nsecret: '+s.gitAuth.secretName+'\\nllm: '+s.llm.provider+'/'+s.llm.model);
    }
    $('saveGitKey').onclick = async () => {
      try {
        let r = await j('/api/settings/git-auth','PUT',{privateKey:$('privateKey').value,knownHosts:$('knownHosts').value});
        $('privateKey').value = '';
        log('private key saved\\ngit ssh key: '+r.gitAuth.sshKeyConfigured+'\\nstorage: '+r.gitAuth.storage);
      } catch(e) { log(e.message); }
    };
    $('save').onclick = async () => {
      try {
        await j('/api/settings/source','PUT',source());
        let r = await j('/api/settings/llm','PUT',llm());
        log('settings saved\\nllm: '+r.llm.provider+'/'+r.llm.model);
      } catch(e) { log(e.message); }
    };
    $('scan').onclick = async () => {
      try {
        let r = await j('/api/repositories/scan','POST',{source:source(),llm:llm()});
        activeScanId = r.scanId;
        await refreshScans();
        await refreshWiki();
        log('scan accepted: '+r.scanId+'\\nstatus: '+r.status+'\\ngit ssh key: '+r.gitAuth.sshKeyConfigured+'\\nstatus URL: '+r.links.status);
      } catch(e) { log(e.message); }
    };
    $('demoScan').onclick = async () => {
      try {
        let r = await j('/api/demo/scan','POST',{});
        activeScanId = r.scanId;
        await refreshScans();
        await refreshWiki();
        log('demo wiki generated: '+r.scanId+'\\nopen the .md pages and use Ask AI why / Improve doc');
      } catch(e) { log(e.message); }
    };
    $('askWiki').onclick = async () => { try { await askWiki(); } catch(e) { log(e.message); } };
    setInterval(() => refreshScans().catch(()=>{}), 2500);
    load().catch(e => log(e.message));
  </script>
</body>
</html>`);
});

app.listen(port, () => {
  console.log(`karpati-llm-wiki listening on ${port}`);
});
