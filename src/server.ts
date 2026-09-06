import express from "express";
import { env } from "./config/env";
import { errorMiddleware } from "./middleware/error.middleware";
import { logger } from "./utils/logger";
import { RegisterRoutes } from "../tsoa-generated/routes"; // auto-generated, run `npm run tsoa:gen`

const app = express();

app.use(express.json());

RegisterRoutes(app);

// The error middleware MUST always be placed last — Express only recognizes
// a middleware with 4 parameters (err, req, res, next) as an error handler
// when it is registered after all other routes and middleware.
app.use(errorMiddleware);

app.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port}`);
});