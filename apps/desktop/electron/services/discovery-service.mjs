import { Bonjour } from "bonjour-service";

export const pruneStaleWorkspaces = (workspaces, now, ttlMs) => {
  const next = new Map();
  for (const [id, workspace] of workspaces.entries()) {
    if (now - workspace.lastSeenAt <= ttlMs) {
      next.set(id, workspace);
    }
  }
  return next;
};

export class DiscoveryService {
  constructor() {
    this.bonjour = new Bonjour();
    this.browser = null;
    this.advertisement = null;
    this.workspaces = new Map();
    this.pruneInterval = null;
  }

  advertiseWorkspace({ workspaceName, hostName, workspaceId, sessionCode, port }) {
    this.stopAdvertising();
    this.advertisement = this.bonjour.publish({
      name: `${hostName} / ${workspaceName}`,
      type: "pcconnect",
      protocol: "tcp",
      port,
      txt: {
        workspaceId,
        workspaceName,
        hostName,
        sessionCode,
        appVersion: "0.1.0",
        mode: "open_with_host_approval"
      }
    });

    return workspaceId;
  }

  stopAdvertising() {
    if (this.advertisement) {
      this.advertisement.stop();
      this.advertisement = null;
    }
  }

  startBrowsing(onChange) {
    this.browser?.stop();
    this.browser = this.bonjour.find({ type: "pcconnect", protocol: "tcp" });

    this.browser.on("up", (service) => {
      const workspaceId = service?.txt?.workspaceId ?? service.fqdn;
      this.workspaces.set(workspaceId, {
        workspaceId,
        workspaceName: service?.txt?.workspaceName ?? service.name,
        hostName: service?.txt?.hostName ?? service.host,
        hostAddress: service.referer?.address || service.addresses?.[0] || "0.0.0.0",
        port: service.port,
        sessionCode: service?.txt?.sessionCode ?? "",
        lastSeenAt: Date.now()
      });
      onChange(Array.from(this.workspaces.values()));
    });

    this.browser.on("down", (service) => {
      const workspaceId = service?.txt?.workspaceId ?? service.fqdn;
      this.workspaces.delete(workspaceId);
      onChange(Array.from(this.workspaces.values()));
    });

    this.pruneInterval = setInterval(() => {
      const pruned = pruneStaleWorkspaces(this.workspaces, Date.now(), 20_000);
      if (pruned.size !== this.workspaces.size) {
        this.workspaces = pruned;
        onChange(Array.from(this.workspaces.values()));
      }
    }, 10_000);
  }

  stopBrowsing() {
    this.browser?.stop();
    this.browser = null;
    if (this.pruneInterval) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
    this.workspaces.clear();
  }

  destroy() {
    this.stopAdvertising();
    this.stopBrowsing();
    this.bonjour.destroy();
  }
}
