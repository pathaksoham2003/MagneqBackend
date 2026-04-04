import Notification from "../models/Notification.js";
import logger from "../utils/logger.js";

// Create a new notification
export const createNotification = async (req, res, next) => {
  try {
    const { type, payload } = req.body;
    const senderId = req.user.id;

    if (!type || !payload) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const notification = await Notification.create({
      type,
      payload,
      by: senderId,
    });

    logger.info(`Notification created type: ${type} by ${req.user.user_name}`);
    return res.status(201).json({ message: "Notification created", notification });
  } catch (error) {
    next(error);
  }
};

// Get notifications based on user role
export const getNotificationsByRole = async (req, res, next) => {
  try {
    const userRole = req.user.role;

    let filter = { isRead: false }; 

    if (userRole === "SALES_EXEC") {
      filter.type = "sales";
    } else if (userRole === "PRODUCTION_EXEC") {
      filter.type = "production";
    }

    const now = new Date();
    const startToday = new Date(now.setHours(0, 0, 0, 0));

    const startTomorrow = new Date(startToday);
    startTomorrow.setDate(startTomorrow.getDate() + 1);

    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);

    filter.createdAt = {
      $gte: startYesterday,
      $lt: startTomorrow
    };

    const notifications = await Notification.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({ notifications });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    let filter = { isRead: false }; 

    if (userRole === "SALES_EXEC") {
      filter.type = "sales";
    } else if (userRole === "PRODUCTION_EXEC") {
      filter.type = "production";
    }

    const result = await Notification.updateMany(filter, { isRead: true });

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "No unread notifications found" });
    }

    return res.status(200).json({ message: "All notifications marked as read", result });
  } catch (error) {
    next(error);
  }
};
