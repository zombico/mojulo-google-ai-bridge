/**
 * Vertex AI / Google GenAI Integration for Mojulo 3.0.0
 * Uses official @google/genai SDK with native Function Calling.
 * Run: npx tsx src/vertex-agent.ts
 */
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { mojulo } from './mojulo-client.js';
import dotenv from 'dotenv';

dotenv.config();

// 1. Initialize GoogleGenAI client (Vertex AI or Gemini API)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
  // For Vertex AI enterprise credentials:
  // vertexAI: true,
  // project: process.env.GOOGLE_CLOUD_PROJECT,
  // location: process.env.GOOGLE_CLOUD_REGION || 'us-central1'
});

// 2. Declare Function Calling schemas matching Mojulo tools
const mintSolidDecl: FunctionDeclaration = {
  name: 'mojulo_mint_solid',
  description: 'Mints a 3D solid recipe into Mojulo SQLite database. Kinds: figure, scad, assembler, carved-solid, edifice, vehicle.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      kind: { type: Type.STRING, description: 'Solid kind (e.g. figure, scad, assembler)' },
      seed: { type: Type.INTEGER, description: 'Deterministic seed integer' },
      params: { type: Type.OBJECT, description: 'Key-value geometric parameters in mm scale' }
    },
    required: ['kind']
  }
};

const measureSolidDecl: FunctionDeclaration = {
  name: 'mojulo_measure_solid',
  description: 'Measures solid bounding box (mm), volume (cm³), and validates watertight manifold geometry.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      ref: { type: Type.STRING, description: 'Solid reference ID' }
    },
    required: ['ref']
  }
};

const exportModelDecl: FunctionDeclaration = {
  name: 'mojulo_export_model',
  description: 'Compiles solid into STL, 3MF, or GLB binary.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      ref: { type: Type.STRING, description: 'Solid reference ID' },
      format: { type: Type.STRING, description: 'Format: stl | 3mf | glb' }
    },
    required: ['ref', 'format']
  }
};

// 3. Multi-turn Agent Loop with Gemini 2.5
export async function runVertexAgent(promptText: string) {
  const tools = [{ functionDeclarations: [mintSolidDecl, measureSolidDecl, exportModelDecl] }];

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: 'You are an expert CAD engineer and 3D compiler agent. You use Mojulo tools to model exact parametric geometry.',
      tools
    }
  });

  console.log('User Prompt:', promptText);
  let response = await chat.sendMessage({ message: promptText });

  // Handle function calls loop
  while (response.functionCalls && response.functionCalls.length > 0) {
    for (const call of response.functionCalls) {
      console.log(`[Tool Call] ${call.name}(`, call.args, ')');
      let toolOutput: any;

      if (call.name === 'mojulo_mint_solid') {
        toolOutput = await mojulo.callTool('mint_solid', call.args as any, 'pack_object');
      } else if (call.name === 'mojulo_measure_solid') {
        toolOutput = await mojulo.callTool('measure_solid', call.args as any, 'pack_object');
      } else if (call.name === 'mojulo_export_model') {
        toolOutput = await mojulo.callTool('export_model', call.args as any, 'pack_world');
      } else {
        toolOutput = { error: 'Unknown tool' };
      }

      // Send function response back to Gemini
      response = await chat.sendMessage({
        message: [
          {
            functionResponse: {
              name: call.name,
              response: { result: toolOutput }
            }
          }
        ]
      });
    }
  }

  console.log('\nFinal Agent Reasoning:\n', response.text);
  return response.text;
}

if (process.argv[1].endsWith('vertex-agent.ts')) {
  runVertexAgent('Design an articulated robot arm joint in OpenSCAD with 20mm outer ring and 8mm pin').catch(console.error);
}