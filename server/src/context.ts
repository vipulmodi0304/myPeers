import type { Config } from "./config.js";
import type { Db } from "./db/pool.js";
import type { Mailer } from "./lib/email.js";

/**
 * How the REST layer talks to the realtime layer. Routes call these after a
 * successful write (for example "a new message was saved") and the socket
 * server pushes it to the right people. In tests this is a no-op recorder.
 */
export type Realtime = {
  toUser(userId: string, event: string, payload: unknown): void;
  toRoom(roomId: string, event: string, payload: unknown): void;
  /** Re-broadcast a user's check-in to everyone who can see it. */
  checkInChanged(userId: string): Promise<void>;
  isLive(userId: string): boolean;
};

export type User = {
  id: string;
  email: string;
  name: string;
  is_demo: boolean;
  email_verified_at: Date | null;
};

export type AppContext = {
  config: Config;
  db: Db;
  mailer: Mailer;
  realtime: Realtime;
};

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}
