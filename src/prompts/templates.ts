import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SkillPrompt } from "../loader/content.js";

export function registerPrompts(server: McpServer, skills: SkillPrompt[]) {
  for (const skill of skills) {
    server.prompt(
      skill.name,
      { description: skill.description, arguments: skill.arguments },
      async (args) => {
        let text = skill.content;
        for (const [key, value] of Object.entries(args ?? {})) {
          text = text.replaceAll(`{{${key}}}`, String(value));
        }
        return {
          messages: [{ role: "user", content: { type: "text", text } }],
        };
      }
    );
  }
}
