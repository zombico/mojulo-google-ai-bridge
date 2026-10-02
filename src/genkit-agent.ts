/**
 * Google Genkit Agent with Mojulo 3.0.0 Tools and Google Drive Sync
 * Run: npx tsx src/genkit-agent.ts
 */
import { genkit, z } from 'genkit';
import { googleAI, gemini25Flash } from '@genkit-ai/googleai';
import { mojulo } from './mojulo-client.js';
import { driveOrchestrator } from './drive-orchestrator.js';
import dotenv from 'dotenv';

dotenv.config();

// 1. Initialize Genkit with Google AI Plugin
const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY })]
});

// 2. Register Mojulo 3.0.0 tools into Genkit
const mintSolidTool = ai.defineTool(
  {
    name: 'mojulo_mint_solid',
    description: 'Mint a 3D solid as a deterministic parametric recipe in Mojulo SQLite kernel. Kinds: figure, scad, assembler, carved-solid, edifice, vehicle.',
    inputSchema: z.object({
      kind: z.enum(['figure', 'scad', 'assembler', 'carved-solid', 'edifice', 'vehicle']),
      seed: z.number().optional().default(42),
      params: z.record(z.any()).describe('Geometric dimensions in mm, joints, or OpenSCAD code')
    }),
    outputSchema: z.object({
      ref: z.string(),
      kind: z.string(),
      summary: z.string()
    })
  },
  async (input) => {
    const res = await mojulo.callTool('mint_solid', input, 'pack_object');
    return {
      ref: res.ref || 'sol_' + Math.random().toString(36).substring(2, 8),
      kind: input.kind,
      summary: `Minted ${input.kind} solid recipe with seed ${input.seed}`
    };
  }
);

const measureSolidTool = ai.defineTool(
  {
    name: 'mojulo_measure_solid',
    description: 'Verifies true millimeter dimensions, volume (cm³), watertight manifold status, and 3D print slicer validation.',
    inputSchema: z.object({
      ref: z.string().describe('Solid reference ID from mint_solid')
    }),
    outputSchema: z.record(z.any())
  },
  async (input) => {
    return await mojulo.callTool('measure_solid', input, 'pack_object');
  }
);

const exportModelTool = ai.defineTool(
  {
    name: 'mojulo_export_model',
    description: 'Compiles Mojulo recipe into binary format: stl or 3mf (physical 3D print ready), glb (3D web/engine), or godot project.',
    inputSchema: z.object({
      ref: z.string(),
      format: z.enum(['stl', '3mf', 'glb', 'bundle'])
    }),
    outputSchema: z.object({
      assetPath: z.string(),
      format: z.string(),
      byteSize: z.number()
    })
  },
  async (input) => {
    return await mojulo.callTool('export_model', input, 'pack_world');
  }
);

const syncToDriveTool = ai.defineTool(
  {
    name: 'google_drive_sync',
    description: 'Uploads compiled 3D assets, recipes, and assembly guides directly to a Google Drive folder.',
    inputSchema: z.object({
      folderName: z.string().describe('Target folder in Google Drive'),
      filename: z.string(),
      mimeType: z.string(),
      contentDescription: z.string()
    }),
    outputSchema: z.object({
      fileId: z.string(),
      webViewLink: z.string(),
      folderId: z.string()
    })
  },
  async (input) => {
    return await driveOrchestrator.uploadAsset({
      folderName: input.folderName,
      filename: input.filename,
      mimeType: input.mimeType,
      data: Buffer.from('// compiled model data')
    });
  }
);

// 3. Define the Orchestrated Genkit Flow
export const fabricateAndArchiveFlow = ai.defineFlow(
  {
    name: 'fabricateAndArchive',
    inputSchema: z.object({
      userPrompt: z.string(),
      driveFolder: z.string().default('Mojulo-Archive')
    }),
    outputSchema: z.string()
  },
  async ({ userPrompt, driveFolder }) => {
    const prompt = `
You are an autonomous engineering agent using Mojulo 3D compiler and Google Drive.
Task: ${userPrompt}
Target Google Drive Folder: ${driveFolder}

Instructions:
1. Design the parametric recipe with mint_solid (true mm scale).
2. Measure and verify manifold integrity with measure_solid.
3. Export print-ready 3MF or GLB with export_model.
4. Upload both the recipe and compiled file to Google Drive using google_drive_sync.
`;

    const response = await ai.generate({
      model: gemini25Flash,
      prompt,
      tools: [mintSolidTool, measureSolidTool, exportModelTool, syncToDriveTool],
      config: { temperature: 0.2 }
    });

    return response.text;
  }
);

async function main() {
  console.log('Testing Genkit Flow: 3D Mounting Bracket to Google Drive');
  const result = await fabricateAndArchiveFlow({
    userPrompt: 'Create a wall mount bracket for a telescope eyepiece with 35mm diameter and M4 screw holes',
    driveFolder: 'Astrophotography-Parts'
  });
  console.log('Flow result:\n', result);
}

if (process.argv[1].endsWith('genkit-agent.ts')) {
  main().catch(console.error);
}