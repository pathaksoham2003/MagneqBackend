import express from "express";
import {
  createNotification,
  getNotificationsByRole,
  markAllAsRead,
} from "../controllers/notification.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getNotificationsByRole);
router.post("/", authenticate, createNotification);
router.patch("/:id/read", authenticate, markAllAsRead);
// router.delete("/clear", authenticate, clearNotifications);

export default router;
