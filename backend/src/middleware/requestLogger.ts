import type { RequestHandler } from "express";
import { logger } from "../utils/logger.js";

export const requestLogger: RequestHandler = (req, _res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);

  next();
};