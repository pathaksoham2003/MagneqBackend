import Notification from "../models/Notification.js";

// Create a new notification
export const createNotification = async (req, res) => {
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

    return res.status(201).json({ message: "Notification created", notification });
  } catch (error) {
    console.error("Create Notification Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get notifications based on user role
export const getNotificationsByRole = async (req, res) => {
  try {
    const userRole = req.user.role;
    let filter = {};

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

    // Get combined notifications
    const notifications = await Notification.find({
      ...filter,
      createdAt: { $gte: startYesterday, $lt: startTomorrow }
    }).sort({ createdAt: -1 });

    return res.status(200).json({ notifications });

  } catch (error) {
    console.error("Fetch Notifications Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Mark a notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({ message: "Marked as read", notification: updated });
  } catch (error) {
    console.error("Mark As Read Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Clear notifications by role
export const clearNotifications = async (req, res) => {
  try {
    const userRole = req.user.role;
    let filter = {};

    if (userRole === "SALES_EXEC") {
      filter.type = "sales";
    } else if (userRole === "PRODUCTION_EXEC") {
      filter.type = "production";
    }
    // All others delete all notifications

    await Notification.deleteMany(filter);

    return res.status(200).json({ message: "All notifications cleared" });
  } catch (error) {
    console.error("Clear Notifications Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
