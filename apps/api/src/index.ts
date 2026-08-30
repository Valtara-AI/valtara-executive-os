import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { logger } from "./logger.js";

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, "NYXOR API listening");
});
