import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { logger } from "./logger";

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, "VEX-OS API listening");
});
