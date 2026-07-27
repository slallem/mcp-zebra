import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createMcpServer } from "./mcpServer.js";

const PORT = Number(process.env.PORT ?? 3000);
const PATH = "/mcp";

const server = createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");

  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type,mcp-protocol-version,mcp-session-id");
    res.writeHead(204).end();
    return;
  }

  if (req.url !== PATH) {
    res.writeHead(404).end("Not found. MCP endpoint is at " + PATH);
    return;
  }

  const mcpServer = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    void transport.close();
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`mcp-zebra listening locally at http://localhost:${PORT}${PATH}`);
});
