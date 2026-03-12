# 🤖 Claude Code Handoff: Vibecraft Hub Architecture & Connectivity

**Project Status:** Hardened Nexus & Remote Agent Connectivity Achieved
**System:** Sovereign 3D Nexus (Multi-Agent API)
**Owner:** Seeking (ETERNAL FLAME)
**Generated:** Mar 11, 2026

---

## 📋 Executive Summary

The **Vibecraft** environment serves as a centralized, Zero-Trust visual 3D grid where remote autonomous agents (like Dylan the Scout) and human-piloted avatars can connect and collaborate.

We recently encountered and solved critical infrastructure challenges regarding **remote tunnel routing** and **WebSocket Origin validation**. This document synthesizes those challenges and the exact solutions implemented, so you (Claude) understand the current state of the architecture.

---

## 🏗️ Core Architecture

- **Frontend:** Vite, React, TypeScript (`port 4002` for dev server)
- **Backend:** Node.js, Express, `ws` (WebSockets) (`port 4003` for backend Relay)
- **Communication Layer:** Raw WebSockets using a strictly enforced, neutralized JSON schema. Agents emit `agent_state` and `agent_thought` payloads to control their 3D Avatar (Hexagon) without executing code on the host machine.
- **Relay URL Format (Production/Tunnel):** `wss://<host>/vibecraft`

 *(See `MULTI_AGENT_API_STANDARD.md` in this repository for full schema details).*

---

## 🛠️ Critical Challenges Solved (March 9, 2026)

### 1. The LocalTunnel / Remote Ghosting Issue
**Problem**: Remote agents (like Dylan) could access the tunneled frontend via `https://*.loca.lt` but got infinitely stuck on the "Connecting..." screen in the 3D grid. Meanwhile, the backend terminal logged `Blocked request` errors.
**Root Cause**: 
We were dealing with two simultaneous issues:
1. **Backend Strictness**: The `server/index.ts` had a strict `isOriginAllowed` function that cross-checked the request Origin against authorized hosts. It outright rejected requests originating from `loca.lt` or `ngrok` tunnels.
2. **Frontend Hardcoding**: The frontend `src/main.ts` statically assigned `WS_URL = ws://localhost:4003/vibecraft`. When accessed remotely via a tunnel, the remote browser tried to connect to its *own* local machine's port 4003, failing silently.

**Solution Implemented**:
*   **Backend (`server/index.ts`)**: Whitelisted tunnel hosts in the `isOriginAllowed` logic.
    ```typescript
    const isTunnel = hostname.endsWith('.loca.lt') || hostname.endsWith('.ngrok-free.app');
    if (isDevelopment || isProductionUrl || isTunnel) {
       return true; 
    }
    ```
*   **Frontend (`src/main.ts`)**: Abstracted the websocket URL generator to detect tunnel environments and route relative to the browser window.
    ```typescript
    const isTunnel = window.location.host.includes('.loca.lt') || window.location.host.includes('.ngrok-free.app');
    
    export const WS_URL = (import.meta.env.DEV || isTunnel) 
      ? `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}/vibecraft`
      : `ws://localhost:${AGENT_PORT}/vibecraft`;
    ```

### 2. Vite Blocked Hosts
**Problem**: Vite's dev server blocked incoming requests from LocalTunnel, citing an Invalid Host header.
**Solution Implemented**:
*   **Configuration (`vite.config.ts`)**: Updated `server.allowedHosts` to permit `.loca.lt` and `.ngrok-free.app`.

### 3. Build Halts on Strict TypeScript
**Problem**: Attempting to rebuild the frontend (`npm run build:client`) threw a TypeScript error in `src/components/voice/VoiceHUD.tsx`, halting the delivery of the URL routing patches.
**Root Cause**: A `useRef` hook used for an animation frame `requestAnimationFrame` was initialized without a type that supported `null`.
**Solution Implemented**:
*   Modified `const animationFrameRef = useRef<number>();` to `const animationFrameRef = useRef<number | null>(null);`

---

## 🚀 Key Takeaways for Future Claude Sessions

1. **Tunneling Best Practices**: Always verify absolute URLs dynamically when serving via tunnels or proxies. Hardcoded `localhost` endpoints in frontends are the most common cause of remote WebSocket failures.
2. **Vite Development vs Backend Ports**: The Vite application runs on `4002`, but the backend Relay runs on `4003`. If ETERNAL FLAME needs to expose the Vite *development* environment remotely, they must tunnel port **4002**.
3. **Zero-Trust**: Never let an agent execute code on the Hub. Ensure they only emit `agent_state` JSON payloads. The Hub only visually interprets states.

---
*Refer to `daily_log_2026_03_09.md` for the exact timeline of the operation.* ⛩️🏺🦅
