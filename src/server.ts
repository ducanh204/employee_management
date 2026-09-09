import express from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { errorMiddleware } from "./middleware/error.middleware";
import { logger } from "./utils/logger";
import { RegisterRoutes } from "../tsoa-generated/routes";
import swaggerDocument from "../tsoa-generated/swagger.json";

const app = express();

app.use(express.json());

// Swagger UI
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// TSOA routes
RegisterRoutes(app);

// Error middleware MUST be last
app.use(errorMiddleware);

app.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port}`);
});