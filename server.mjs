// A tiny static server for Railway: serves the game (index.html) and anything beside it (sfx/, docs/).
import { createServer } from "node:http";
import {attachMultiplayer} from "./multiplayer.mjs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ico": "image/x-icon",
};

const server=createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/" || path === "") path = "/index.html";
    const file = normalize(join(root, path));
    const rel = "/" + file.slice(root.length);
    if (!file.startsWith(root) || /\/\.|^\/(server\.mjs|multiplayer\.mjs|coop-state\.mjs|coop-persistence\.mjs|special-modes\.mjs|package\.json|railway\.toml)$/.test(rel)) throw 404;   // no dotfiles, no server files
    const st = await stat(file);
    if (!st.isFile()) throw 404;
    // Pages and game code are always checked for a newer copy (a quick "not changed" when they haven't), so a new
    // deploy reaches players at once; sounds and pictures are kept for an hour.
    const fresh = [".html", ".js", ".mjs", ".css", ".json", ".md"].includes(extname(file));
    const tag = '"' + st.size.toString(36) + "-" + Math.floor(st.mtimeMs).toString(36) + '"';
    if (fresh && req.headers["if-none-match"] === tag) { res.writeHead(304, { etag: tag, "cache-control": "no-cache" }); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": fresh ? "no-cache" : "public, max-age=3600", ...(fresh ? { etag: tag } : {}) });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
});
attachMultiplayer(server);
server.listen(port, "0.0.0.0", () => console.log(`Archives of Madness multiplayer on :${port}`));
