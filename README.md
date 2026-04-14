# PC Connector

LAN workspace sharing desktop app for Windows and macOS.

## Quick start

```bash
pnpm install
pnpm dev
```

## Host + Client flow (Phase 1-4)

1. **Host** clicks "Share a Workspace" and selects a local folder.
2. Host advertises session on LAN via mDNS and starts WebSocket server.
3. **Client** opens Join flow, discovers hosts (or uses session code), and sends join request.
4. Host approves/rejects pending join.
5. After approval, client receives workspace snapshot and opens files by chunked stream.
6. Text edits are saved back to host via session-scoped tokenized requests.

## Scripts

- `pnpm dev` - start renderer + Electron main process
- `pnpm lint` - lint all workspace packages
- `pnpm test` - run tests
- `pnpm build` - build all packages
- `pnpm --filter @pcconnector/desktop dist:win` - build Windows installer
- `pnpm --filter @pcconnector/desktop dist:mac` - build macOS dmg

## Manual verification checklist

- Create host workspace and verify host status changes to advertising.
- Start discovery on another instance and verify host appears in list.
- Join from client and approve on host.
- Open text/image/pdf files and verify in-app preview only.
- Edit a text file, save, and verify host workspace file updates.
