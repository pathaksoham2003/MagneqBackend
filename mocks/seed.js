import mongoose from "mongoose";
import Notification from "../models/Notification.js"; // Update path if needed
import dotenv from "dotenv";
dotenv.config();

// Replace with a real ObjectId from your User collection
const sampleUserId = new mongoose.Types.ObjectId("6882a802a2d958851b13cb3c");

const seedNotifications = async () => {
  try {
    mongoose.connect("mongodb://root:root@localhost:27019/magneq?authSource=admin", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const notifications = [
      {
        type: "production",
        by: sampleUserId,
        status: "PENDING",
        payload: {
          message: "Production cycle started for order #OX1299",
          orderId: "OX1299",
          priority: "high",
        },
        isRead: false,
      },
      {
        type: "purchase",
        by: sampleUserId,
        status: "SENT",
        payload: {
          message: "New purchase request created for item SKU123",
          item: "Steel rods",
          quantity: 120,
        },
        isRead: false,
      },
      {
        type: "store",
        by: sampleUserId,
        status: "ACKNOWLEDGED",
        payload: {
          message: "Inventory updated for SKU456",
          location: "Warehouse A",
        },
        isRead: true,
      },
      {
        type: "sales",
        by: sampleUserId,
        status: "RESOLVED",
        payload: {
          message: "Client delivery completed for INV-0021",
          invoiceId: "INV-0021",
        },
        isRead: true,
      },
    ];

    await Notification.insertMany(notifications);
    console.log("🚀 Demo notifications inserted successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to insert notifications:", error);
    process.exit(1);
  }
};

seedNotifications();
