/**
 * Google Cloud Run Bridge for Mojulo MCP Server
 * Exposes SSE and HTTP JSON-RPC for Vertex AI Reasoning Engine / Cloud Workflows.
 * Run: npx tsx src/mcp-server-bridge.ts
 */
import express from 'express';
import { mojulo } from './mojulo-client.js';

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mojulo-mcp-cloudrun-bridge', version: '3.0.0' });
});

// JSON-RPC endpoint for Vertex AI Reasoning Engine / HTTP Clients
app.post('/mcp/call', async (req, res) => {
  const { tool, pack, args } = req.body;

  if (!tool) {
    return res.status(400).json({ error: 'Missing tool parameter' });
  }

  try {
    const result = await mojulo.callTool(tool, args || {}, pack);
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('Error invoking Mojulo tool:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Mojulo Cloud Run Bridge listening on port ${port}`);
});