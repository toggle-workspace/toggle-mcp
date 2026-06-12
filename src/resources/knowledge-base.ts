import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KbArticle } from "../loader/content.js";

export function registerResources(server: McpServer, articles: KbArticle[]) {
  for (const article of articles) {
    server.resource(
      article.slug,
      article.uri,
      { description: article.title },
      async () => ({
        contents: [{ uri: article.uri, mimeType: "text/markdown", text: article.content }],
      })
    );
  }
}
