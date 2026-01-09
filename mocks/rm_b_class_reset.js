import mongoose from "../utils/db.js";
import RawMaterial from "../models/RawMaterials.js";

const resetRawMaterialsQuantity = async () => {
  try {
    const rawMaterials = await RawMaterial.find({ class_type: "B" });

    for (const rm of rawMaterials) {
      let quantity = { ...(rm.quantity || {}) };

      quantity.processed ??= 0;
      quantity.rejected ??= 0;
      quantity.hobbing ??= 0;
      quantity.unprocessed ??= 0;
      quantity.ht ??= 0;

      await RawMaterial.updateOne(
        { _id: rm._id },
        { $set: { quantity } }
      );
    }
  } catch (err) {
    console.error("Error resetting raw material quantity:", err.message);
  } finally {
    mongoose.connection.close();
  }
};

resetRawMaterialsQuantity();
