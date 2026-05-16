## Project description  
AI Terminal is an Electron-based desktop application featuring an AI-powered terminal interface with tabs, themes, Git integration, music controls, and file operations. It uses React for the frontend, TypeScript for type safety, and Electron for native desktop capabilities. The AI component integrates with Ollama for local LLM interactions.  

## Folder structure  
- `electron/`: Electron main process files (e.g., `main.ts`, `persistence.ts`, `gitSessionOps.ts`).  
- `src/`: TypeScript/React frontend code:  
  - `src/ai/`: AI-related code (e.g., `ollamaClient.ts` for LLM interactions).  
  - `src/renderer/components/`: UI components (e.g., `GitBranchBadge.tsx`, `AiPanel.tsx`, `TerminalPane.tsx`).  
  - `src/shared/`: Shared types and utilities (e.g., `projectAiContext.ts`, `ipcChannels.ts`).  
- `build/`: Configuration files (e.g., `icon.png` for app icons).  
- `out/`: Built output for Electron main/preload processes.  

## Commands to run the project  
1. **Development mode**:  
   ```bash  
   npm run dev  
   ```  
   Starts Electron app with hot-reload for frontend changes.  

2. **Build for macOS**:  
   ```bash  
   npm run dist  
   ```  
   Packages the app into a distributable `.dmg` or `.app` bundle (currently configured for macOS arm64/x64).  

3. **Rebuild native modules**:  
   ```bash  
   npm run rebuild:native  
   ```  
   Ensures native dependencies (e.g., `node-pty`) are compatible with the current Electron version.