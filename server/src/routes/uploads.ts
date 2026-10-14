import { createReadStream } from "node:fs";
import { mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { newToken } from "../lib/crypto.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";

const ALLOWED: Record<string, (b: Buffer) => boolean> = {
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => b.subarray(0, 4).toString("ascii") === "GIF8",
  "image/webp": (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  "application/pdf": (b) => b.subarray(0, 5).toString("ascii") === "%PDF-",
};

/** Read the first bytes of the file and confirm it really is what its type claims. */
async function sniff(file: string, mime: string): Promise<boolean> {
  const handle = await open(file, "r");
  try {
    const buf = Buffer.alloc(16);
    await handle.read(buf, 0, 16, 0);
    return ALLOWED[mime]?.(buf) ?? false;
  } finally {
    await handle.close();
  }
}

export function uploadRoutes(ctx: AppContext) {
  const router = Router();
  const dir = path.resolve(ctx.config.UPLOAD_DIR);

  const upload = multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, cb) => {
        await mkdir(dir, { recursive: true });
        cb(null, dir);
      },
      // Never trust the user's filename on disk: random name, original kept in the DB.
      filename: (_req, _file, cb) => cb(null, newToken()),
    }),
    limits: { fileSize: ctx.config.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, file.mimetype in ALLOWED),
  });

  router.post("/", (req, _res, next) => {
    if (req.user!.is_demo) return next(forbidden("File sharing is turned off in the demo."));
    next();
  }, upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest(`Only images (PNG, JPG, GIF, WebP) and PDFs up to ${ctx.config.MAX_UPLOAD_MB} MB.`);
    if (!(await sniff(file.path, file.mimetype))) {
      await unlink(file.path).catch(() => {});
      throw badRequest("That file doesn't look like the type it claims to be.");
    }
    const fileName = path.basename(file.originalname).replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "file";
    const row = await ctx.db.one<{ id: string }>(
      `insert into attachments (uploader_id, file_name, mime_type, size_bytes, storage_key)
       values ($1, $2, $3, $4, $5) returning id`,
      [req.user!.id, fileName, file.mimetype, file.size, file.filename],
    );
    res.status(201).json({
      attachment: { id: row!.id, fileName, mimeType: file.mimetype, size: file.size, url: `/api/uploads/${row!.id}` },
    });
  });

  // Only the uploader and the person they sent it to can open a file.
  router.get("/:id", async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) throw notFound();
    const me = req.user!.id;
    const row = await ctx.db.one<{ file_name: string; mime_type: string; storage_key: string }>(
      `select a.file_name, a.mime_type, a.storage_key from attachments a
        where a.id = $1 and (a.uploader_id = $2 or exists (
          select 1 from direct_messages m where m.attachment_id = a.id and (m.sender_id = $2 or m.recipient_id = $2)))`,
      [id.data, me],
    );
    if (!row) throw notFound("File not found.");
    const download = req.query.download === "1";
    res.setHeader("Content-Type", row.mime_type);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
    );
    // Stops a malicious image from ever being run as a page in our origin. (PDFs are left
    // out because Chrome's built-in viewer refuses to render a sandboxed PDF.)
    if (row.mime_type !== "application/pdf") {
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    }
    const stream = createReadStream(path.join(dir, row.storage_key));
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).end();
      else res.destroy();
    });
    stream.pipe(res);
  });

  return router;
}
