import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MojuloCallResult {
  content: Array<{ type: string; text?: string; data?: string }>;
  isError?: boolean;
}

/**
 * Universal client for Mojulo 3.0.0.
 * Can connect via MCP stdio protocol or directly dispatch via CLI.
 */
export class MojuloClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private availableTools: Set<string> = new Set();

  async connect(): Promise<void> {
    if (this.client) return;

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'mojulo'],
      env: {
        ...process.env,
        MOJULO_HOST: 'google-ai-bridge',
        MOJULO_TOOL_PACKS: 'on' // Enable drawerized packs mode
      }
    });

    this.client = new Client(
      { name: 'google-ai-bridge', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    await this.client.connect(this.transport);
    try {
      const toolList = await this.client.listTools();
      this.availableTools = new Set((toolList.tools || []).map((t: any) => t.name));
      console.log(`Connected to Mojulo 3.0.0 MCP server (${this.availableTools.size} tools detected)`);
    } catch {
      console.log('Connected to Mojulo 3.0.0 MCP server over stdio');
    }
  }

  /**
   * Invokes a tool either directly (flat mode) or through its parent pack (drawerized mode).
   */
  async callTool(name: string, args: Record<string, any> = {}, packId?: string): Promise<any> {
    await this.connect();
    if (!this.client) throw new Error('Client not initialized');

    // 1. If packId is supported by server (drawerized mode, e.g. pack_object)
    if (packId && packId !== 'spine' && this.availableTools.has(packId)) {
      const result = await this.client.callTool({
        name: packId,
        arguments: {
          tool: name,
          args
        }
      });
      return this.parseResult(result);
    }

    // 2. If the tool is directly exposed (flat mode, e.g. mint_solid)
    if (this.availableTools.has(name)) {
      const result = await this.client.callTool({
        name,
        arguments: args
      });
      return this.parseResult(result);
    }

    // 3. Fallback: try direct call, then pack call
    try {
      const result = await this.client.callTool({
        name,
        arguments: args
      });
      return this.parseResult(result);
    } catch (err: any) {
      if (packId) {
        try {
          const result = await this.client.callTool({
            name: packId,
            arguments: { tool: name, args }
          });
          return this.parseResult(result);
        } catch {
          // If neither worked, rethrow original
        }
      }
      throw err;
    }
  }

  private parseResult(result: any): any {
    if (result.content && result.content[0]?.text) {
      try {
        return JSON.parse(result.content[0].text);
      } catch {
        return result.content[0].text;
      }
    }
    return result;
  }

  async close(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.client = null;
      this.transport = null;
    }
  }
}

export const mojulo = new MojuloClient();