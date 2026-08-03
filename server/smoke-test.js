import { spawn } from "node:child_process";

const port = 18080;
const child = spawn(process.execPath, ["server/index.js"], {
  env: { ...process.env, PORT: String(port), APP_VERSION: "test" },
  stdio: ["ignore", "pipe", "pipe"]
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

try {
  await wait(700);
  const health = await fetchJson("/healthz");
  const tools = await fetchJson("/api/mcp/tools");
  const search = await fetchJson("/api/wiki/search?q=deployment");

  if (!health.ok || health.service !== "karpati-llm-wiki") {
    throw new Error("health response did not identify the service");
  }
  if (!Array.isArray(tools.tools) || tools.tools.length < 4) {
    throw new Error("MCP tool surface is incomplete");
  }
  if (!Array.isArray(search.results) || search.results.length === 0) {
    throw new Error("wiki search returned no results");
  }

  console.log("smoke checks passed");
} finally {
  child.kill("SIGTERM");
}
