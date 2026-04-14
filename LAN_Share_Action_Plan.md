# LAN Share — Complete Action Plan
> A real-time, zero-storage LAN file sharing desktop app for Windows & Mac

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Phase 1 — Project Setup](#phase-1--project-setup)
5. [Phase 2 — Core Networking](#phase-2--core-networking)
6. [Phase 3 — File Streaming](#phase-3--file-streaming)
7. [Phase 4 — React UI](#phase-4--react-ui)
8. [Phase 5 — Real-Time Editing (CRDT)](#phase-5--real-time-editing-crdt)
9. [Phase 6 — File Viewers](#phase-6--file-viewers)
10. [Phase 7 — Security & Permissions](#phase-7--security--permissions)
11. [Phase 8 — Packaging & Distribution](#phase-8--packaging--distribution)
12. [Phase 9 — Testing](#phase-9--testing)
13. [Phase 10 — Future Enhancements](#phase-10--future-enhancements)
14. [Folder Structure](#folder-structure)
15. [Key Rules & Constraints](#key-rules--constraints)
16. [Timeline Estimate](#timeline-estimate)

---

## Project Overview

**What it does:**
- User 1 (Host) selects a file/folder on their PC — no upload, no cloud
- User 2 (Client) on the same LAN/WiFi connects via a short share code
- User 2 can view and edit the file in real-time
- All changes sync back to User 1's disk instantly
- User 2's disk is never touched — zero bytes stored

**Core constraints:**
- No internet required — pure LAN only
- No cloud server — no AWS, no Firebase, nothing
- No temp files on client — RAM only
- Works on both Windows and Mac from a single codebase

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Desktop app framework | Electron | One codebase → Windows + Mac |
| UI | React + Tailwind CSS | Fast, modern UI |
| LAN discovery | mDNS / Bonjour (`bonjour-service` npm) | Auto-discover PCs, no manual IP |
| File server | Node.js `ws` (WebSocket) | Bidirectional, persistent pipe |
| File streaming | `fs.createReadStream` + chunked Buffer | RAM-only, handles large files |
| Real-time edit sync | Yjs (CRDT library) | Conflict-free collaborative editing |
| Code editor (in-app) | Monaco Editor | VS Code quality editor |
| PDF viewer (in-app) | `pdfjs-dist` | Render PDFs in app, no disk write |
| Image viewer (in-app) | Native `<img>` + Canvas API | Annotations support |
| IPC (Main ↔ Renderer) | Electron `ipcMain` / `ipcRenderer` | Secure bridge between processes |
| Build / packaging | `electron-builder` | Produces `.exe` and `.dmg` |
| Dev tooling | Vite + ESLint + Prettier | Fast dev server, clean code |

---

## Architecture Overview

```
USER 1 — HOST PC                         USER 2 — CLIENT PC
┌──────────────────────────┐             ┌──────────────────────────┐
│  Renderer (React UI)     │             │  Renderer (React UI)     │
│  - Share screen          │             │  - Join screen           │
│  - Connected users list  │             │  - File viewer/editor    │
│  - Stop share button     │             │  - Edit toolbar          │
└────────────┬─────────────┘             └────────────┬─────────────┘
             │ IPC                                     │ IPC
┌────────────▼─────────────┐             ┌────────────▼─────────────┐
│  Main Process (Node.js)  │             │  Main Process (Node.js)  │
│  - mDNS broadcast        │             │  - mDNS listener         │
│  - WebSocket SERVER      │             │  - WebSocket CLIENT      │
│  - File ReadStream       │             │  - RAM buffer (chunks)   │
│  - Yjs doc (source)      │             │  - Yjs doc (replica)     │
│  - chokidar file watcher │             │                          │
└────────────┬─────────────┘             └────────────┬─────────────┘
             │                                        │
             └──────────── LAN / WiFi ────────────────┘
                      WebSocket on port 7777
                      mDNS on 224.0.0.251
```

---

## Phase 1 — Project Setup

### 1.1 Initialize the project

```bash
mkdir lan-share && cd lan-share
npm init -y
npm install --save-dev electron vite @vitejs/plugin-react electron-builder
npm install react react-dom tailwindcss
npm install ws bonjour-service yjs y-websocket chokidar
npm install monaco-editor pdfjs-dist
```

### 1.2 Folder structure (see full structure at end of doc)

### 1.3 Configure `package.json`

```json
{
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite & electron .",
    "build": "vite build && electron-builder",
    "dist:win": "electron-builder --win",
    "dist:mac": "electron-builder --mac"
  }
}
```

### 1.4 Configure `electron-builder`

```json
{
  "build": {
    "appId": "com.yourname.lanshare",
    "productName": "LAN Share",
    "mac": { "target": "dmg" },
    "win": { "target": "nsis" }
  }
}
```

### Deliverable
- App opens a blank window on both Windows and Mac
- Dev server runs with hot reload

---

## Phase 2 — Core Networking

### 2.1 mDNS Discovery

**Goal:** Every PC on the LAN automatically sees other PCs running the app.

**Host side — broadcast presence:**
```javascript
// electron/main.js
const Bonjour = require('bonjour-service')
const bonjour = new Bonjour()

function startAdvertising(port, sessionCode) {
  bonjour.publish({
    name: `LAN-Share-${os.hostname()}`,
    type: 'lanshare',
    port: port,
    txt: { code: sessionCode }
  })
}
```

**Client side — listen for hosts:**
```javascript
const browser = bonjour.find({ type: 'lanshare' })
browser.on('up', (service) => {
  // Send to Renderer: new host discovered
  mainWindow.webContents.send('host-found', {
    name: service.name,
    host: service.host,
    port: service.port,
    code: service.txt.code
  })
})
browser.on('down', (service) => {
  mainWindow.webContents.send('host-lost', { name: service.name })
})
```

### 2.2 Share Code Generation

```javascript
function generateCode() {
  const words = ['TIGER','BLUE','IRON','SWIFT','NOVA','FLAME']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(Math.random() * 90) + 10
  return `${word}-${num}`  // e.g. TIGER-42
}
```

### 2.3 WebSocket Server (Host)

```javascript
const { WebSocketServer } = require('ws')

let wss = null

function startServer(port) {
  wss = new WebSocketServer({ port })
  wss.on('connection', (socket, req) => {
    // Authenticate by share code
    socket.on('message', (data) => {
      const msg = JSON.parse(data)
      if (msg.type === 'join' && msg.code === currentCode) {
        socket.authenticated = true
        socket.send(JSON.stringify({ type: 'joined' }))
        streamFile(socket, currentFilePath)
      }
    })
  })
}
```

### 2.4 WebSocket Client (Client)

```javascript
function joinSession(host, port, code) {
  const ws = new WebSocket(`ws://${host}:${port}`)
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'join', code }))
  })
  return ws
}
```

### Deliverable
- Host PC broadcasts on LAN
- Client PC sees host in discovered list
- Code entry connects the two PCs via WebSocket

---

## Phase 3 — File Streaming

### 3.1 Host streams file in chunks

```javascript
const fs = require('fs')

function streamFile(socket, filePath) {
  const stat = fs.statSync(filePath)

  // Send file metadata first
  socket.send(JSON.stringify({
    type: 'file-meta',
    name: path.basename(filePath),
    size: stat.size,
    mimeType: getMimeType(filePath)
  }))

  // Stream raw bytes in 64KB chunks
  const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 })

  stream.on('data', (chunk) => {
    socket.send(chunk)  // Raw Buffer — no disk write on receiver
  })

  stream.on('end', () => {
    socket.send(JSON.stringify({ type: 'EOF' }))
  })
}
```

### 3.2 Client receives chunks into RAM only

```javascript
let fileChunks = []
let fileMeta = null

ws.on('message', (data) => {
  // Try JSON first (control messages)
  try {
    const msg = JSON.parse(data)
    if (msg.type === 'file-meta') { fileMeta = msg; return }
    if (msg.type === 'EOF') {
      const fileBuffer = Buffer.concat(fileChunks)
      // Send to Renderer for display — never write to disk
      mainWindow.webContents.send('file-ready', {
        meta: fileMeta,
        buffer: fileBuffer
      })
      fileChunks = []  // Clear RAM after passing to renderer
      return
    }
  } catch (_) {}

  // Raw chunk — push to RAM
  fileChunks.push(Buffer.from(data))
})
```

### 3.3 File watcher (Host — detect external changes)

```javascript
const chokidar = require('chokidar')

function watchFile(filePath) {
  const watcher = chokidar.watch(filePath)
  watcher.on('change', () => {
    // Re-stream file to all connected clients
    wss.clients.forEach(client => {
      if (client.authenticated) streamFile(client, filePath)
    })
  })
}
```

### Deliverable
- File appears on client screen without any disk write
- Large files (1GB+) handled without memory crash
- External changes to the file on host are pushed to clients

---

## Phase 4 — React UI

### 4.1 Screens to build

**Screen 1 — Home**
```
[ LAN Share Logo ]

[ Share a File ]     [ Join a Session ]

Nearby devices:
🟢 Rahul-Laptop
🟢 Priya-PC
```

**Screen 2 — Share Flow (Host)**
```
Step 1: Drag & drop file or click Browse
Step 2: Set permission (View only / View + Edit)
Step 3: Click "Start Sharing"
→ Shows code: TIGER-42
→ Shows connected users list
→ "Stop Sharing" button
```

**Screen 3 — Join Flow (Client)**
```
Enter code: [ TIGER-42  ]
[ Join ]
→ Loading spinner
→ File opens in viewer
```

**Screen 4 — File Viewer/Editor (Client)**
```
[ filename.pdf ]  🔴 LIVE   [ Disconnect ]
─────────────────────────────────
[ file content renders here ]
─────────────────────────────────
Status: Viewing / Editing
```

### 4.2 IPC bridge (Renderer ↔ Main)

```javascript
// preload.js — expose safe APIs to React
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lanShare', {
  shareFile: (filePath, permission) =>
    ipcRenderer.invoke('share-file', { filePath, permission }),
  joinSession: (code) =>
    ipcRenderer.invoke('join-session', { code }),
  stopSharing: () => ipcRenderer.invoke('stop-sharing'),
  onHostFound: (cb) => ipcRenderer.on('host-found', (_, data) => cb(data)),
  onFileReady: (cb) => ipcRenderer.on('file-ready', (_, data) => cb(data)),
  onEditUpdate: (cb) => ipcRenderer.on('edit-update', (_, data) => cb(data)),
})
```

### Deliverable
- Full UI flow from home → share/join → viewer
- Smooth transitions, loading states, error handling

---

## Phase 5 — Real-Time Editing (CRDT)

### 5.1 Setup Yjs on both sides

```javascript
const * as Y = require('yjs')

// Both host and client create the same doc type
const ydoc = new Y.Doc()
const ytext = ydoc.getText('content')  // For text files
```

### 5.2 Host — apply edits to actual file

```javascript
ytext.observe(() => {
  const content = ytext.toString()
  fs.writeFileSync(currentFilePath, content, 'utf8')
})
```

### 5.3 Client — send edit deltas over WebSocket

```javascript
ydoc.on('update', (update) => {
  // Send only the delta (not full file) — very small payload
  ws.send(JSON.stringify({
    type: 'crdt-update',
    update: Buffer.from(update).toString('base64')
  }))
})
```

### 5.4 Host — receive and apply delta

```javascript
if (msg.type === 'crdt-update') {
  const update = Buffer.from(msg.update, 'base64')
  Y.applyUpdate(ydoc, update)  // Merges client edit into host doc
}
```

### Deliverable
- Two users can type simultaneously in a text file
- No conflicts, no data loss (CRDT guarantees this mathematically)
- Only deltas are sent over network — very efficient

---

## Phase 6 — File Viewers

### 6.1 Text / Code files → Monaco Editor

```jsx
import Editor from '@monaco-editor/react'

function CodeViewer({ content, language, readOnly, onChange }) {
  return (
    <Editor
      value={content}
      language={language}
      options={{ readOnly, minimap: { enabled: false } }}
      onChange={onChange}
    />
  )
}
```

### 6.2 PDF files → PDF.js

```jsx
import { getDocument } from 'pdfjs-dist'

async function renderPDF(arrayBuffer, canvasRef) {
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1.5 })
  const ctx = canvasRef.current.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  // arrayBuffer stays in RAM — never written to disk
}
```

### 6.3 Image files → Canvas with annotation support

```jsx
function ImageViewer({ buffer, readOnly }) {
  const blob = new Blob([buffer])
  const url = URL.createObjectURL(blob)  // RAM-only object URL
  return <img src={url} style={{ maxWidth: '100%' }} />
  // URL.revokeObjectURL(url) on unmount — frees RAM
}
```

### 6.4 File type routing

```javascript
function getViewer(mimeType) {
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return 'code'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  return 'unsupported'
}
```

### Deliverable
- Text, code, PDF, image files all render in-app
- No external app opens, no temp files written

---

## Phase 7 — Security & Permissions

### 7.1 Share code validation

```javascript
// Code is only valid for active session on same LAN
// Reject connection if code doesn't match
if (msg.code !== currentSessionCode) {
  socket.send(JSON.stringify({ type: 'error', reason: 'invalid-code' }))
  socket.close()
  return
}
```

### 7.2 Permission enforcement

```javascript
// Host sets permission per session
const SESSION_PERMISSIONS = {
  'VIEW_ONLY': ['read'],
  'VIEW_EDIT': ['read', 'write']
}

// Reject write attempts if client has VIEW_ONLY
if (msg.type === 'crdt-update' && sessionPermission === 'VIEW_ONLY') {
  socket.send(JSON.stringify({ type: 'error', reason: 'permission-denied' }))
  return
}
```

### 7.3 Host kick control

```javascript
function kickClient(socketId) {
  wss.clients.forEach(client => {
    if (client.id === socketId) {
      client.send(JSON.stringify({ type: 'kicked' }))
      client.close()
    }
  })
}
```

### 7.4 Session cleanup on disconnect

```javascript
wss.on('close', () => {
  bonjour.unpublishAll()  // Remove from mDNS discovery
  currentSessionCode = null
  currentFilePath = null
})
```

### Deliverable
- Only code-holder can connect
- View-only clients cannot edit
- Host can kick any client at any time
- Session ends cleanly on app close

---

## Phase 8 — Packaging & Distribution

### 8.1 electron-builder config

```json
{
  "build": {
    "appId": "com.yourname.lanshare",
    "productName": "LAN Share",
    "files": ["dist/**/*", "electron/**/*"],
    "mac": {
      "target": [{ "target": "dmg", "arch": ["x64", "arm64"] }],
      "category": "public.app-category.utilities"
    },
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### 8.2 Build commands

```bash
# Build for Mac (dmg)
npm run dist:mac

# Build for Windows (exe installer)
npm run dist:win

# Output:
# dist/LAN Share-1.0.0.dmg
# dist/LAN Share Setup 1.0.0.exe
```

### 8.3 Code signing (required for Mac)
- Get Apple Developer account ($99/year)
- Sign the `.dmg` with your certificate
- Notarize with Apple for Gatekeeper approval

### Deliverable
- Single `.dmg` for Mac (Intel + Apple Silicon)
- Single `.exe` installer for Windows

---

## Phase 9 — Testing

### 9.1 Unit tests

| Test | What to test |
|---|---|
| `generateCode()` | Returns correct format (WORD-NN) |
| `streamFile()` | All chunks arrive, EOF fires |
| `applyUpdate()` | CRDT merges edits correctly |
| `getViewer()` | Correct viewer for each MIME type |

### 9.2 Integration tests

| Scenario | Expected |
|---|---|
| Host shares, client joins same LAN | File appears on client |
| Client edits text file | Change reflects on host disk |
| Host stops sharing | Client gets "session ended" |
| Client closes app | Host session stays active |
| Wrong code entered | Connection rejected |
| View-only client tries to edit | Permission denied |

### 9.3 Network edge cases

| Scenario | Expected |
|---|---|
| Client drops WiFi mid-session | Host notified, session cleaned |
| Host machine sleeps | Client shows "host disconnected" |
| Two clients same code | Both can view simultaneously |
| 1GB file share | Chunks stream without crash |

### Deliverable
- All critical paths covered by tests
- App stable across both platforms

---

## Phase 10 — Future Enhancements

### Post-MVP features (in priority order)

1. **Multi-file session** — Share multiple files under one code
2. **Folder share** — Share entire folder, browse in-app tree
3. **Multi-user cursors** — Show each user's cursor position (Google Docs style)
4. **Chat sidebar** — In-session text chat between connected users
5. **Session history** — Host sees log of who connected, what was edited
6. **Drag & drop** — Drag file directly onto app window to share
7. **Password-protected sessions** — Extra layer beyond share code
8. **Dark mode** — System-aware dark/light theme
9. **Connection QR code** — Scan instead of typing code
10. **Auto-reconnect** — Client auto-rejoins if connection drops briefly

---

## Folder Structure

```
lan-share/
├── electron/
│   ├── main.js            ← Electron entry, IPC handlers
│   ├── preload.js         ← Safe API bridge to Renderer
│   ├── server/
│   │   ├── wsServer.js    ← WebSocket server (host)
│   │   ├── wsClient.js    ← WebSocket client (joiner)
│   │   ├── mdns.js        ← mDNS broadcast + discovery
│   │   ├── streaming.js   ← File ReadStream + chunking
│   │   └── crdt.js        ← Yjs doc setup + sync logic
│   └── utils/
│       ├── codeGen.js     ← Share code generator
│       ├── mimeType.js    ← File type detection
│       └── session.js     ← Session state management
│
├── src/                   ← React UI (Vite)
│   ├── App.jsx            ← Router / screen manager
│   ├── screens/
│   │   ├── Home.jsx       ← Landing screen
│   │   ├── ShareFlow.jsx  ← Host: file select → code show
│   │   ├── JoinFlow.jsx   ← Client: code entry
│   │   └── Viewer.jsx     ← File display + edit UI
│   ├── components/
│   │   ├── CodeDisplay.jsx     ← Big code box (TIGER-42)
│   │   ├── DeviceList.jsx      ← Nearby devices list
│   │   ├── viewers/
│   │   │   ├── CodeEditor.jsx  ← Monaco wrapper
│   │   │   ├── PDFViewer.jsx   ← PDF.js wrapper
│   │   │   └── ImageViewer.jsx ← Canvas + annotations
│   │   └── PermissionToggle.jsx
│   └── index.jsx
│
├── package.json
├── vite.config.js
└── electron-builder.json
```

---

## Key Rules & Constraints

| Rule | Reason |
|---|---|
| Never write to client disk | Core privacy guarantee |
| No internet calls anywhere | Pure LAN — air-gapped friendly |
| Always destroy RAM buffer on disconnect | Clean memory, no leaks |
| Code is session-scoped, not file-scoped | One code covers the whole session |
| CRDT updates are delta-only | Efficient — not full file retransmit |
| mDNS unpublish on session end | Disappear from discovery immediately |
| IPC via contextBridge only | Electron security best practice |

---

## Timeline Estimate

| Phase | Estimated Time |
|---|---|
| Phase 1 — Setup | 1 day |
| Phase 2 — Networking (mDNS + WS) | 3–4 days |
| Phase 3 — File streaming | 2–3 days |
| Phase 4 — React UI | 4–5 days |
| Phase 5 — CRDT editing | 3–4 days |
| Phase 6 — Viewers | 3–4 days |
| Phase 7 — Security | 1–2 days |
| Phase 8 — Packaging | 1–2 days |
| Phase 9 — Testing | 3–4 days |
| **Total MVP** | **~3–4 weeks** |

---

*Generated action plan for LAN Share — a zero-storage, peer-to-peer LAN file sharing desktop application.*
