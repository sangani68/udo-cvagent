// server.js
// Simple custom Next.js server for Azure App Service (ESM)

import http from "http";
import next from "next";

const port = process.env.PORT || 3000;
const hostname = "0.0.0.0";

// dev = false because this is for production (after `next build`)
const dev = false;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    server.listen(port, (err) => {
      if (err) {
        console.error("Error starting server", err);
        process.exit(1);
      }
      console.log(`> Ready on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Error preparing Next app", err);
    process.exit(1);
  });
