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
    if (!file.startsWith(root) || /\/\.|^\/(server\.mjs|multiplayer\.mjs|package\.json|railway\.toml)$/.test(rel)) throw 404;   // no dotfiles, no server files
    if (!(await stat(file)).isFile()) throw 404;
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": path === "/index.html" ? "no-cache" : "public, max-age=3600" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
});
attachMultiplayer(server);
server.listen(port, "0.0.0.0", () => console.log(`Archives of Madness multiplayer on :${port}`));
