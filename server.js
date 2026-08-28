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

http
  .createServer((req, res) => {
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
    const hasGz = fs.existsSync(gzPath);
    const hasRaw = fs.existsSync(filePath);
    const ext = path.extname(filePath);
    const contentType = types[ext] || "application/octet-stream";

    if (!hasGz && !hasRaw) {
      res.writeHead(404);
      res.end("Not found: " + p);
      return;
    }

    // Serve the compressed variant whenever it exists (only the .gz is kept
    // for the large network file, to stay well under GitHub's file-size
    // limits) — decompress on the fly for the rare client without gzip support.
    if (hasGz && acceptsGzip) {
      res.writeHead(200, { "Content-Type": contentType, "Content-Encoding": "gzip" });
      fs.createReadStream(gzPath).pipe(res);
      return;
    }

    if (hasGz && !hasRaw) {
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(gzPath).pipe(zlib.createGunzip()).pipe(res);
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found: " + p);
        return;
      }
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  })
  .listen(port, host, () => console.log("App running on http://" + host + ":" + port));
