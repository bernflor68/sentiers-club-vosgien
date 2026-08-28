const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = __dirname;
const port = process.env.PORT || 5173;
const host = "0.0.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};

function stat(p) {
  return new Promise((resolve) => {
    fs.stat(p, (err, s) => resolve(err ? null : s));
  });
}

http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p === "/") p = "/index.html";
      let filePath = path.join(root, p);
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      const acceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");
      const gzPath = filePath + ".gz";
      const ext = path.extname(filePath);
      const contentType = types[ext] || "application/octet-stream";

      const [gzStat, rawStat] = await Promise.all([stat(gzPath), stat(filePath)]);

      if (!gzStat && !rawStat) {
        res.writeHead(404);
        res.end("Not found: " + p);
        return;
      }

      // Serve the compressed variant whenever it exists (only the .gz is kept
      // for the large network file, to stay well under GitHub's file-size
      // limits) — decompress on the fly for the rare client without gzip support.
      if (gzStat && acceptsGzip) {
        res.writeHead(200, { "Content-Type": contentType, "Content-Encoding": "gzip", "Content-Length": gzStat.size });
        fs.createReadStream(gzPath).pipe(res);
        return;
      }

      if (gzStat && !rawStat) {
        res.writeHead(200, { "Content-Type": contentType });
        fs.createReadStream(gzPath).pipe(zlib.createGunzip()).pipe(res);
        return;
      }

      res.writeHead(200, { "Content-Type": contentType, "Content-Length": rawStat.size });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end("Server error: " + err.message);
    }
  })
  .listen(port, host, () => console.log("App running on http://" + host + ":" + port));
