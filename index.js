import express from "express";
import mongoose from "./utils/db.js";
import cors from "cors";
import dotenv from "dotenv";
import logger, { httpLogger } from "./utils/logger.js";

import "./models/User.js";
import "./models/RawMaterials.js";
import "./models/Sales.js";
import "./models/Production.js";
import "./models/Stock.js";
import "./models/FinishedGoods.js";
import "./models/Purchase.js";
import "./models/Quality.js";
import "./models/Transaction.js";

import swaggerUI from "swagger-ui-express";
import swaggerSpec from "./swagger/swagger.js";

import userRouter from "./routes/user.js";
import rawMaterialRoutes from "./routes/rawMaterials.js";
import purchaseOrderRoutes from "./routes/purchaseOrders.js";
import qualityRoutes from "./routes/quality.js";
import finishedGoodsRoutes from "./routes/finishedGoods.js";
import salesRoutes from "./routes/sales.js";
import invoiceRoutes from "./routes/invoice.js";
import productionRoutes from "./routes/production.js";
import dashboardRoutes from "./routes/dashboard.js";
import manageRoutes from "./routes/manage.js";
import notificationRoutes from "./routes/notification.js";
import paymentRoutes from "./routes/payment.js";
import exportRoutes from "./routes/export.js";
import deliveryRoutes from "./routes/delivery.js";
import ledgerRoutes from "./routes/ledger.js";
import transactionRoutes from "./routes/transaction.js";
import historyRoutes from "./routes/history.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- Logging Middleware ---
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const userStr = req.user ? ` [User: ${req.user.name} (${req.user.email})]` : "";
    httpLogger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms${userStr}`
    );
  });
  next();
});

app.get("/", (req, res) => res.send("ERP Server Running..."));

app.use("/api", userRouter);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/raw_material", rawMaterialRoutes);
app.use("/api/purchase_order", purchaseOrderRoutes);
app.use("/api/quality", qualityRoutes);
app.use("/api/finished_goods", finishedGoodsRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/manage", manageRoutes);
app.use("/api/notification",notificationRoutes);
app.use("/api/payment",paymentRoutes);
app.use("/api/export",exportRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/history", historyRoutes);

app.use("/api/assets", express.static("assets"));

app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec));

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user: req.user ? { id: req.user.id, email: req.user.email } : "Anonymous"
  });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message
  });
});

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
