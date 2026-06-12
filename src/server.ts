import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadKnowledgeBase, loadSkillPrompts, loadScriptTools } from "./loader/content.js";
import { registerResources } from "./resources/knowledge-base.js";
import { registerPrompts } from "./prompts/templates.js";
import { registerTools } from "./tools/skill-runner.js";

export async function createServer(): Promise<McpServer> {
  const server = new McpServer({
    name: "toggle-brain",
    version: "1.0.0",
  });

  process.stderr.write("Fetching content from toggle-brain...\n");
  const [articles, skills, scripts] = await Promise.all([
    loadKnowledgeBase(),
    loadSkillPrompts(),
    loadScriptTools(),
  ]);
  process.stderr.write(
    `Loaded: ${articles.length} resources, ${skills.length} prompts, ${scripts.length} tools\n`
  );

  registerResources(server, articles);
  registerPrompts(server, skills);
  registerTools(server, scripts);

  return server;
}
