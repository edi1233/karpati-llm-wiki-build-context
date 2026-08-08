import { spawn } from "node:child_process";
import fs from "node:fs";

const port = 18080;
const testKeyPath = "/workspace/projects/f70bd8a4d62f/.test-git/id_rsa";
const testKnownHostsPath = "/workspace/projects/f70bd8a4d62f/.test-git/known_hosts";
const testDataDir = "/workspace/projects/f70bd8a4d62f/.test-data";
const testDbPath = `${testDataDir}/wiki-db.json`;

fs.rmSync("/workspace/projects/f70bd8a4d62f/.test-git", { recursive: true, force: true });
fs.rmSync(testDataDir, { recursive: true, force: true });

let child;

function startServer() {
  child = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      APP_VERSION: "test",
      GIT_SSH_KEY_PATH: testKeyPath,
      GIT_KNOWN_HOSTS_PATH: testKnownHostsPath,
      DATA_DIR: testDataDir,
      WIKI_DB_PATH: testDbPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function stopServer() {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await wait(250);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

async function fetchText(path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.text();
}

async function sendJson(path, method, body, expectedStatus = 200) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

try {
  startServer();
  await wait(700);
  const health = await fetchJson("/healthz");
  const providers = await fetchJson("/api/llm/providers");
  const settings = await fetchJson("/api/settings");
  const gitAuth = await fetchJson("/api/settings/git-auth");
  const tools = await fetchJson("/api/mcp/tools");
  const search = await fetchJson("/api/wiki/search?q=deployment");
  const source = await sendJson("/api/settings/source", "PUT", {
    type: "git",
    gitUrl: "https://github.com/example/service.git",
    branch: "main",
    authMode: "none"
  });
  const missingKeySource = await sendJson("/api/settings/source", "PUT", {
    type: "git",
    gitUrl: "git@github.com:example/private-service.git",
    branch: "main",
    authMode: "ssh-key"
  }, 400);
  const invalidGitKey = await sendJson("/api/settings/git-auth", "PUT", {
    privateKey: "not-a-private-key"
  }, 400);
  const savedGitKey = await sendJson("/api/settings/git-auth", "PUT", {
    privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key-material\n-----END OPENSSH PRIVATE KEY-----",
    knownHosts: "github.com ssh-ed25519 test-host-key"
  });
  const privateSource = await sendJson("/api/settings/source", "PUT", {
    type: "git",
    gitUrl: "git@github.com:example/private-service.git",
    branch: "main",
    authMode: "ssh-key"
  });
  const folder = await sendJson("/api/settings/source", "PUT", {
    type: "local-folder",
    localPath: "/workspace/repos/service"
  });
  const llm = await sendJson("/api/settings/llm", "PUT", {
    provider: "prism-ai",
    model: "codex/default",
    endpoint: "https://prisim-ai.edi-it.com/v1",
    apiKey: "test-key"
  });
  const scan = await sendJson("/api/repositories/scan", "POST", {
    source: {
      type: "local-folder",
      localPath: "/workspace/repos/service"
    },
    llm: {
      provider: "prism-ai",
      model: "codex/default",
      endpoint: "https://prisim-ai.edi-it.com/v1",
      connected: true,
      apiKeyConfigured: true
    }
  }, 202);
  const scanHistory = await fetchJson("/api/scans");
  const scanStatus = await fetchJson(`/api/scans/${scan.scanId}`);
  const wikiSnapshot = await fetchJson("/api/wiki/snapshots/latest");
  const wikiVault = await fetchJson("/api/wiki/vault");
  const rawSources = await fetchJson("/api/wiki/raw-sources");
  const wikiSchema = await fetchJson("/api/wiki/schema");
  const wikiIndex = await fetchJson("/api/wiki/index");
  const wikiLog = await fetchJson("/api/wiki/log");
  const wikiPages = await fetchJson("/api/wiki/pages");
  const generatedSearch = await fetchJson("/api/wiki/search?q=deployment");
  const firstGeneratedPageId = wikiSnapshot.snapshot?.pages?.find((page) => page.title === "Architecture")?.id;
  const generatedPage = await fetchJson(`/api/wiki/pages/${firstGeneratedPageId}`);
  const generatedPageByPath = await fetchJson(`/api/wiki/pages/${encodeURIComponent(generatedPage.page.path)}`);
  const wikiGraph = await fetchJson("/api/wiki/graph");
  const exportedWiki = await fetchText("/api/wiki/export");
  const wikiAnswer = await sendJson("/api/wiki/ask", "POST", {
    question: "Why is the deployment documentation written this way?"
  });
  const wikiLint = await fetchJson("/api/wiki/lint");
  const wikiQuestions = await fetchJson("/api/wiki/questions");
  const wikiPagesAfterQuestion = await fetchJson("/api/wiki/pages");
  const storageAfterWrites = await fetchJson("/api/storage");
  const aiAdvice = await sendJson(`/api/wiki/pages/${firstGeneratedPageId}/ai`, "POST", {
    intent: "improve"
  });
  const demoScan = await sendJson("/api/demo/scan", "POST", {}, 202);
  const demoSnapshot = await fetchJson("/api/wiki/snapshots/latest");
  const rootHtml = await fetchText("/");

  if (!health.ok || health.service !== "karpati-llm-wiki") {
    throw new Error("health response did not identify the service");
  }
  if (!providers.providers?.["prism-ai"] || providers.defaultProvider !== "prism-ai") {
    throw new Error("Prism AI provider was not advertised as the default");
  }
  if (settings.llm.provider !== "prism-ai" || settings.llm.model !== "codex/default") {
    throw new Error("default settings did not select Prism AI");
  }
  if (gitAuth.secretName !== "karpati-git-ssh" || gitAuth.sshKeyConfigured) {
    throw new Error("Git SSH auth status was not reported correctly without a runtime secret");
  }
  if (!Array.isArray(tools.tools) || tools.tools.length < 10 || !tools.tools.some((tool) => tool.name === "wiki.lint")) {
    throw new Error("MCP tool surface is incomplete");
  }
  if (!Array.isArray(search.results) || search.results.length === 0) {
    throw new Error("wiki search returned no results");
  }
  if (source.source.gitUrl !== "https://github.com/example/service.git") {
    throw new Error("Git repository source was not saved");
  }
  if (!missingKeySource.error?.includes("Git SSH private key")) {
    throw new Error("Git SSH source was not blocked when the runtime key was absent");
  }
  if (!invalidGitKey.error?.includes("valid SSH private key")) {
    throw new Error("invalid Git SSH key was not rejected");
  }
  if (!savedGitKey.gitAuth?.sshKeyConfigured || savedGitKey.privateKey) {
    throw new Error("Git SSH key save did not configure auth or leaked secret material");
  }
  if (privateSource.source.authMode !== "ssh-key") {
    throw new Error("private Git SSH source was not saved after key configuration");
  }
  if (folder.source.localPath !== "/workspace/repos/service") {
    throw new Error("local folder source was not saved");
  }
  if (!llm.llm.connected || llm.llm.provider !== "prism-ai" || llm.llm.model !== "codex/default") {
    throw new Error("LLM provider settings were not connected");
  }
  if (!scan.accepted || scan.source.type !== "local-folder" || scan.status !== "queued") {
    throw new Error("scan submission did not use saved source and LLM configuration");
  }
  if (!scan.links?.status?.includes(scan.scanId) || !scan.links?.history) {
    throw new Error("scan submission did not return status/history links");
  }
  if (!Array.isArray(scanHistory.scans) || scanHistory.scans[0]?.id !== scan.scanId) {
    throw new Error("scan history did not return the submitted scan");
  }
  if (scanStatus.scan.id !== scan.scanId || typeof scanStatus.scan.progress !== "number") {
    throw new Error("scan status did not include progress for the submitted scan");
  }
  if (!Array.isArray(scanStatus.scan.stages) || !Array.isArray(scanStatus.scan.messages)) {
    throw new Error("scan status did not include stages and messages");
  }
  if (
    wikiSnapshot.snapshot?.scanId !== scan.scanId ||
    wikiSnapshot.snapshot.pageCount !== 19 ||
    wikiSnapshot.snapshot.pattern !== "karpathy-llm-wiki" ||
    !wikiSnapshot.snapshot.layers?.includes("raw-sources")
  ) {
    throw new Error("scan did not create a generated wiki snapshot");
  }
  if (
    wikiVault.scanId !== scan.scanId ||
    wikiVault.vault?.files?.length !== 19 ||
    !wikiVault.vault.tags?.includes("#deployment") ||
    wikiVault.vault.schemaPath !== "AGENTS.md" ||
    !wikiVault.rawSources?.[0]?.immutable
  ) {
    throw new Error("wiki vault metadata did not include Karpathy wiki layers, files, and tags");
  }
  if (
    !rawSources.rawSources?.some((source) => source.scanId === scan.scanId && source.immutable && source.mutableByLlm === false) ||
    !rawSources.policy?.includes("immutable")
  ) {
    throw new Error("raw source registry did not expose immutable source records");
  }
  if (!wikiSchema.schema?.markdown?.includes("AGENTS.md") || !wikiSchema.schema.markdown.includes("Raw sources are immutable")) {
    throw new Error("wiki schema endpoint did not expose AGENTS-style workflow");
  }
  if (!wikiIndex.page?.markdown?.includes("# index.md") || !wikiIndex.page.markdown.includes("[[Deployment]]")) {
    throw new Error("generated index.md did not catalog wiki pages");
  }
  if (!wikiLog.page?.markdown?.includes("# log.md") || !wikiLog.page.markdown.includes("ingest")) {
    throw new Error("generated log.md did not record ingest activity");
  }
  if (wikiPages.scanId !== scan.scanId || wikiPages.pages?.[0]?.markdown || !wikiPages.pages?.[0]?.path) {
    throw new Error("wiki page list did not return scan metadata without full Markdown bodies");
  }
  if (!generatedSearch.generated || generatedSearch.scanId !== scan.scanId || !generatedSearch.results?.length || !generatedSearch.results[0].path) {
    throw new Error("wiki search did not return generated scan results");
  }
  if (
    generatedPage.page?.scanId !== scan.scanId ||
    !generatedPage.page.contextWindows?.length ||
    !generatedPage.page.markdown?.includes("# Architecture") ||
    !generatedPage.page.markdown?.includes("**Tags**") ||
    !generatedPage.page.tags?.includes("#architecture") ||
    !Array.isArray(generatedPage.page.backlinks)
  ) {
    throw new Error("generated wiki page retrieval did not include scan context");
  }
  if (generatedPageByPath.page?.id !== generatedPage.page.id) {
    throw new Error("generated wiki page could not be retrieved by vault path");
  }
  if (!wikiGraph.graph?.nodes?.length || !wikiGraph.graph?.edges?.length) {
    throw new Error("wiki graph endpoint did not expose nodes and edges");
  }
  if (!exportedWiki.includes("<!-- index.md -->") || !exportedWiki.includes("<!-- overview/Architecture.md -->") || !exportedWiki.includes("# Glossary")) {
    throw new Error("wiki markdown export did not include generated files");
  }
  if (
    wikiAnswer.result?.scanId !== scan.scanId ||
    !wikiAnswer.result.answer?.length ||
    !wikiAnswer.result.sources?.some((source) => source.path?.endsWith(".md")) ||
    !wikiAnswer.result.filedPage?.path?.startsWith("queries/") ||
    !wikiAnswer.filedPage?.path?.startsWith("queries/")
  ) {
    throw new Error("wiki ask endpoint did not return a grounded answer and filed page");
  }
  if (
    !wikiLint.findings?.some((finding) => finding.type === "orphan") ||
    !wikiLint.findings?.some((finding) => finding.type === "contradiction") ||
    !wikiLint.findings?.some((finding) => finding.type === "stale-claim") ||
    typeof wikiLint.summary?.missingCrossReferences !== "number"
  ) {
    throw new Error("wiki lint did not report contradiction/orphan/stale health categories");
  }
  if (!wikiQuestions.questions?.length || wikiQuestions.questions[0].question !== "Why is the deployment documentation written this way?") {
    throw new Error("wiki question log did not record the query");
  }
  if (!wikiPagesAfterQuestion.pages?.some((page) => page.path === wikiAnswer.filedPage.path)) {
    throw new Error("filed query answer page was not added to generated wiki pages");
  }
  if (
    !storageAfterWrites.storage?.exists ||
    !storageAfterWrites.storage.durable ||
    storageAfterWrites.storage.scans < 1 ||
    storageAfterWrites.storage.snapshots < 1 ||
    storageAfterWrites.storage.rawSources < 1 ||
    !fs.existsSync(testDbPath)
  ) {
    throw new Error("persistent wiki DB was not written after scan and question activity");
  }
  if (
    aiAdvice.assistance?.pageId !== firstGeneratedPageId ||
    !aiAdvice.assistance.explanation?.length ||
    !aiAdvice.assistance.improvedMarkdown?.includes("## Improvement Suggestions")
  ) {
    throw new Error("AI wiki advice did not return explanation and improved Markdown");
  }
  if (!demoScan.accepted || !demoScan.demo || demoSnapshot.snapshot?.scanId !== demoScan.scanId) {
    throw new Error("demo scan did not create the latest generated wiki snapshot");
  }
  if (
    !rootHtml.includes("Generated Wiki") ||
    !rootHtml.includes("Ask AI why") ||
    !rootHtml.includes("Ask wiki") ||
    !rootHtml.includes("Demo wiki scan") ||
    !rootHtml.includes("wikiReader")
  ) {
    throw new Error("root UI does not expose generated wiki reader and AI actions");
  }

  await stopServer();
  startServer();
  await wait(700);
  const reloadedStorage = await fetchJson("/api/storage");
  const reloadedScans = await fetchJson("/api/scans");
  const reloadedSnapshot = await fetchJson("/api/wiki/snapshots/latest");
  const reloadedQuestions = await fetchJson("/api/wiki/questions");

  if (
    !reloadedStorage.storage?.exists ||
    reloadedScans.scans?.[0]?.id !== demoScan.scanId ||
    reloadedSnapshot.snapshot?.scanId !== demoScan.scanId ||
    !reloadedQuestions.questions?.some((entry) => entry.question === "Why is the deployment documentation written this way?")
  ) {
    throw new Error("persistent wiki DB did not reload scans, snapshots, and questions after server restart");
  }

  console.log("smoke checks passed");
} finally {
  await stopServer();
}
