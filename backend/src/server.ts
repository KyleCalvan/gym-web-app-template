import "dotenv/config";
import { logger } from "./utils/logger.js";
import app from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
