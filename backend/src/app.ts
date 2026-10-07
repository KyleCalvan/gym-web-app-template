import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use(express.json());

app.use(requestLogger);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Vinathletics API is running",
  });
});

app.use(errorHandler);

export default app;