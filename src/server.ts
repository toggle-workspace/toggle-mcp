import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadKnowledgeBase, loadSkillPrompts, loadScriptTools } from "./loader/content.js";
import { registerResources } from "./resources/knowledge-base.js";
import { registerPrompts } from "./prompts/templates.js";
import { registerTools } from "./tools/skill-runner.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "toggle-brain",
    version: "1.0.0",
  });

  const articles = loadKnowledgeBase();
  const skills = loadSkillPrompts();
  const scripts = loadScriptTools();

  registerResources(server, articles);
  registerPrompts(server, skills);
  registerTools(server, scripts);

  return server;
}
