import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const port = Number(process.env.PORT || 8080);
const version = process.env.APP_VERSION || "0.1.0";

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

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    service: "karpati-llm-wiki",
    version,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/projects", (_req, res) => {
  res.json({
    projects: [
      {
        id: "demo-karpati",
        name: "karpati llm wiki",
        sourceTypes: ["github", "local-folder", "zip-upload"],
        completeness: 42,
        status: "ready_for_repository_intake",
        wikiPages: pages.length
      }
    ]
  });
});

app.get("/api/wiki/search", (req, res) => {
  const query = String(req.query.q || "").trim();
  res.json({
    query,
    mode: "hybrid",
    results: pages.slice(0, 6).map((title, index) => ({
      title,
      score: Number((0.91 - index * 0.05).toFixed(2)),
      summary: `${title} knowledge for AI agents, including relationships, dependencies, and operational context.`,
      related: pages.slice(index + 1, index + 4)
    }))
  });
});

app.get("/api/graph/dependencies", (_req, res) => {
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
      { name: "wiki.search", description: "Search generated project knowledge." },
      { name: "wiki.retrieve", description: "Retrieve a wiki page with context windows." },
      { name: "graph.downstream", description: "Find downstream dependencies." },
      { name: "plan.deployment", description: "Generate deployment plans from project memory." }
    ]
  });
});

app.post("/api/repositories/scan", (req, res) => {
  const source = req.body?.source || "repository";
  res.status(202).json({
    accepted: true,
    scanId: "scan-demo-001",
    source,
    next: "/api/wiki/search?q=deployment"
  });
});

app.use(express.static(distDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, () => {
  console.log(`karpati-llm-wiki listening on ${port}`);
});
