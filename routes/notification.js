import express from "express";
import {
  createNotification,
  getNotificationsByRole,
  markAsRead,
  clearNotifications,
} from "../controllers/notification.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getNotificationsByRole);
router.post("/", authenticate, createNotification);
router.patch("/:id/read", authenticate, markAsRead);
router.delete("/clear", authenticate, clearNotifications);

export default router;
