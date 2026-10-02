# Mojulo 3.0.0 x Google AI Ecosystem Bridge

A production blueprint and starter repository for integrating **Mojulo 3.0.0** (the 3D compiler for coding agents) with the **Google AI Ecosystem**:
- **Google Genkit**: Build multi-turn autonomous agents that reason and design 3D objects.
- **Vertex AI & Gemini 2.5**: Native Function Calling with `@google/genai`.
- **Google Drive MCP**: Automatically sequence 3D fabrication, recipe archiving, and documentation uploads to Google Drive folders.

---

## 🚀 Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Set GEMINI_API_KEY="your-key"

# 3. Run Google Genkit agent
npm run dev:genkit

# 4. Run Vertex AI Gemini function-calling agent
npm run dev:vertex

# 5. Run Cloud Run HTTP MCP Bridge
npm run dev:bridge
```

---

## 🏛 Architecture Overview

Mojulo is a **3D compiler for coding agents**, not a black-box 3D generator. 
- Everything is stored as a **small deterministic recipe** in a local SQLite kernel (`~/.mojulo/`).
- Compiles geometry identically on every read.
- Handoffs to **Godot**, **Blender Cycles**, **Unity**, and **print-ready STL / 3MF** at true millimeter scale with slicer gates.
- Operates under a **Spine + 17 Tool Packs** drawerization model.

---

## 📂 Repository Structure

- `src/mojulo-client.ts`: MCP stdio transport client managing sub-process communication with `npx mojulo`.
- `src/genkit-agent.ts`: Genkit agent defining custom flows, Zod validation schemas, and tool execution.
- `src/vertex-agent.ts`: Direct Gemini 2.5 Flash / Pro function declarations and multi-turn reasoning loops.
- `src/drive-orchestrator.ts`: Google Drive API orchestration for folders, 3D meshes, and technical manuals.
- `src/mcp-server-bridge.ts`: Cloud Run microservice exposing Mojulo MCP over HTTP/SSE.
- `Dockerfile`: Optimized container for deployment on Google Cloud Run.
