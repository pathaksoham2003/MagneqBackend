import mongoose from "../utils/db.js";

// Models
import Sales from "../models/Sales.js";
import Ledger from "../models/Ledger.js";
import Invoice from "../models/Invoice.js";
import PaymentRecieval from "../models/PaymentRecieval.js";
import Purchase from "../models/Purchase.js";
import Notification from "../models/Notification.js";
import FinishedGoods from "../models/FinishedGoods.js";
import RawMaterial from "../models/RawMaterials.js";

const resetData = async () => {
  try {
    console.log("🚨 Starting database reset...");

    /* -------------------- DELETE COLLECTION DATA -------------------- */
    await Promise.all([
      Sales.deleteMany({}),
      Ledger.deleteMany({}),
      Invoice.deleteMany({}),
      PaymentRecieval.deleteMany({}),
      Purchase.deleteMany({}),
      Notification.deleteMany({})
    ]);

    console.log("✅ Cleared Sales, Ledger, Invoice, PaymentRecieval, Purchase, Notification");

    /* -------------------- RESET FINISHED GOODS -------------------- */
    const fgResult = await FinishedGoods.updateMany(
      {},
      { $set: { units: 0 } }
    );

    console.log(`✅ FinishedGoods reset: ${fgResult.modifiedCount} records updated`);

    /* -------------------- RESET RAW MATERIALS -------------------- */
    const rmResult = await RawMaterial.updateMany(
      {},
      {
        $set: {
          quantity: {
            processed: 0,
            rejected: 0
          }
        }
      }
    );

    console.log(`✅ RawMaterials reset: ${rmResult.modifiedCount} records updated`);

    console.log("🎉 Database reset completed successfully");
  } catch (error) {
    console.error("❌ Error during database reset:", error.message);
  } finally {
    mongoose.connection.close();
    console.log("🔒 MongoDB connection closed");
  }
};

resetData();
