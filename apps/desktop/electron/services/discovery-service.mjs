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

/**
 * Discovery service now supports advertising multiple workspaces simultaneously
 * from a single host. Each workspace gets its own Bonjour publication keyed by
 * workspaceId. A single shared WebSocket port is used across all workspaces.
 */
export class DiscoveryService {
  constructor() {
    this.bonjour = new Bonjour();
    this.browser = null;
    /** @type {Map<string, any>} workspaceId -> bonjour service */
    this.advertisements = new Map();
    /** @type {Map<string, any>} workspaceId -> DiscoveryWorkspace */
    this.workspaces = new Map();
    this.pruneInterval = null;
    this.clipboardAdvertisement = null;
    this.clipboardBrowser = null;
    this.clipboardPeers = new Map();
    this.clipboardPruneInterval = null;
  }

  advertiseWorkspace({ workspaceName, hostName, workspaceId, sessionCode, port }) {
    this.stopAdvertising(workspaceId);
    const advertisement = this.bonjour.publish({
      name: `${hostName} / ${workspaceName} / ${workspaceId.slice(0, 8)}`,
      type: "pcconnect",
      protocol: "tcp",
      port,
      txt: {
        workspaceId,
        workspaceName,
        hostName,
        sessionCode,
        appVersion: "0.1.0",
        mode: "host_approval_required"
      }
    });
    this.advertisements.set(workspaceId, advertisement);
    return workspaceId;
  }

  /**
   * @param {string} [workspaceId] If provided, stop only that workspace's advertisement.
   * Otherwise stop all.
   */
  stopAdvertising(workspaceId) {
    if (workspaceId) {
      const ad = this.advertisements.get(workspaceId);
      if (ad) {
        try {
          ad.stop();
        } catch {
          /* no-op */
        }
        this.advertisements.delete(workspaceId);
      }
      return;
    }
    for (const ad of this.advertisements.values()) {
      try {
        ad.stop();
      } catch {
        /* no-op */
      }
    }
    this.advertisements.clear();
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

  advertiseClipboardPeer({ peerId, hostName, port }) {
    this.stopAdvertisingClipboardPeer();
    this.clipboardAdvertisement = this.bonjour.publish({
      name: `${hostName} / clipboard / ${peerId.slice(0, 8)}`,
      type: "pcclip",
      protocol: "tcp",
      port,
      txt: {
        peerId,
        hostName,
        appVersion: "0.1.0",
        mode: "clipboard_peer"
      }
    });
    return peerId;
  }

  stopAdvertisingClipboardPeer() {
    if (!this.clipboardAdvertisement) return;
    try {
      this.clipboardAdvertisement.stop();
    } catch {
      /* no-op */
    }
    this.clipboardAdvertisement = null;
  }

  startBrowsingClipboardPeers(onChange) {
    this.clipboardBrowser?.stop();
    this.clipboardBrowser = this.bonjour.find({ type: "pcclip", protocol: "tcp" });

    this.clipboardBrowser.on("up", (service) => {
      const peerId = service?.txt?.peerId ?? service.fqdn;
      this.clipboardPeers.set(peerId, {
        peerId,
        hostName: service?.txt?.hostName ?? service.host,
        hostAddress: service.referer?.address || service.addresses?.[0] || "0.0.0.0",
        port: service.port,
        lastSeenAt: Date.now()
      });
      onChange(Array.from(this.clipboardPeers.values()));
    });

    this.clipboardBrowser.on("down", (service) => {
      const peerId = service?.txt?.peerId ?? service.fqdn;
      this.clipboardPeers.delete(peerId);
      onChange(Array.from(this.clipboardPeers.values()));
    });

    this.clipboardPruneInterval = setInterval(() => {
      const next = new Map();
      const now = Date.now();
      for (const [id, peer] of this.clipboardPeers.entries()) {
        if (now - peer.lastSeenAt <= 20_000) next.set(id, peer);
      }
      if (next.size !== this.clipboardPeers.size) {
        this.clipboardPeers = next;
        onChange(Array.from(this.clipboardPeers.values()));
      }
    }, 10_000);
  }

  stopBrowsingClipboardPeers() {
    this.clipboardBrowser?.stop();
    this.clipboardBrowser = null;
    if (this.clipboardPruneInterval) {
      clearInterval(this.clipboardPruneInterval);
      this.clipboardPruneInterval = null;
    }
    this.clipboardPeers.clear();
  }

  destroy() {
    this.stopAdvertising();
    this.stopAdvertisingClipboardPeer();
    this.stopBrowsing();
    this.stopBrowsingClipboardPeers();
    this.bonjour.destroy();
  }
}
