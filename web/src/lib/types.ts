// Shapes returned by the API. Kept in one place so components agree on them.

export type Me = {
  id: string;
  name: string;
  email: string | null;
  isDemo: boolean;
  emailVerified: boolean;
};

export type Status = "studying" | "break";

export type Peer = {
  userId: string;
  name: string;
  courseCode: string;
  topic: string;
  location: string;
  status: Status;
  startedAt: string;
};

export type Attachment = { id: string; fileName: string; mimeType: string; size: number; url: string };

export type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  attachment: Attachment | null;
};

export type Conversation = {
  user: { id: string; name: string; live: boolean };
  lastMessage: { preview: string; fromMe: boolean; createdAt: string };
  unread: number;
};

export type Thread = {
  user: {
    id: string;
    name: string;
    live: boolean;
    checkIn: { courseCode: string; topic: string; location: string; status: Status } | null;
  };
  messages: Message[];
  hasMore: boolean;
};

export type RoomSummary = {
  id: string;
  code: string;
  name: string;
  courseCode: string | null;
  memberCount: number;
  createdBy: string;
  createdAt: string;
  lastActivity?: string | null;
};

export type RoomMember = { id: string; name: string; live: boolean };

export type RoomMessage = { id: string; senderId: string; senderName: string; body: string; createdAt: string };

export type TimerState = { mode: "focus" | "break"; durationSec: number; endsAt: number | null; remainingSec: number };

export type Stroke = {
  id: string;
  userId?: string;
  tool: "pen" | "eraser";
  color: string;
  size: number;
  points: [number, number][];
};
