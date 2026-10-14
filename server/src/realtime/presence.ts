/**
 * Who is online right now, kept in memory.
 *
 * The old version wrote a heartbeat to the database every 10 seconds per user
 * and every client re-queried the whole list on every heartbeat, which grows
 * with the square of the number of users. Here "online" simply means "has an
 * open socket", which the server already knows for free.
 *
 * A short grace period means refreshing the page or a brief network blip
 * doesn't make you flicker offline for everyone else.
 *
 * Scaling note: this lives in one process's memory, which is right for one
 * server instance. Running several instances would need a shared store such
 * as Redis (and the Socket.IO Redis adapter).
 */
export const GRACE_MS = 30_000;

export class Presence {
  private sockets = new Map<string, number>();
  private lastSeen = new Map<string, number>();
  private always = new Set<string>();

  constructor(private now: () => number = Date.now) {}

  /** Demo bots are always online. */
  setAlwaysOnline(ids: Iterable<string>) {
    this.always = new Set(ids);
  }

  /** Returns true if this is the user's first open connection. */
  connect(userId: string): boolean {
    const n = (this.sockets.get(userId) ?? 0) + 1;
    this.sockets.set(userId, n);
    return n === 1;
  }

  /** Returns true if that was the user's last open connection. */
  disconnect(userId: string): boolean {
    const n = (this.sockets.get(userId) ?? 1) - 1;
    if (n > 0) {
      this.sockets.set(userId, n);
      return false;
    }
    this.sockets.delete(userId);
    this.lastSeen.set(userId, this.now());
    return true;
  }

  isConnected(userId: string): boolean {
    return this.always.has(userId) || (this.sockets.get(userId) ?? 0) > 0;
  }

  isLive(userId: string): boolean {
    if (this.isConnected(userId)) return true;
    const seen = this.lastSeen.get(userId);
    return seen !== undefined && this.now() - seen < GRACE_MS;
  }

  connectedCount(): number {
    return this.sockets.size;
  }
}
