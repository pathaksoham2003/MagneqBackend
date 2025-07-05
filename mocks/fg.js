import mongoose from "../utils/db.js";
import XLSX from "xlsx";
import FinishedGoods from "../models/FinishedGoods.js";
import RawMaterial from "../models/RawMaterials.js";

// Load CSV
const workbook = XLSX.readFile("./mocks/data/FG.csv");
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

export const insertFinishedGoods = async () => {
  try {
    // Get 1 raw material of each class
    const classA = await RawMaterial.findOne({ class_type: "A" });
    const classB = await RawMaterial.findOne({ class_type: "B", type: "PROCESSED" });
    const classC = await RawMaterial.findOne({ class_type: "C" });

    if (!classA || !classB || !classC) {
      throw new Error("Missing one or more required raw materials (A, processed B, C)");
    }

    await FinishedGoods.deleteMany({});

    const finishedGoodsToInsert = [];

    rows.forEach((row) => {
      const { model, power, ratio, type , MODEL_NUMBER,...others } = row;

      ["B", "V"].forEach((typeVal) => {
        const finishedGood = {
          model: model.toString().trim(),
          power: mongoose.Types.Decimal128.fromString(power.toString().trim()),
          ratio: ratio.toString().trim(),
          type: typeVal,
          other_specification: others,
          raw_materials: [
            { raw_material_id: classA._id, quantity: 1 },
            { raw_material_id: classB._id, quantity: 1 },
            { raw_material_id: classC._id, quantity: 1 },
          ],
          rate_per_unit: mongoose.Types.Decimal128.fromString("0"),
          base_price: mongoose.Types.Decimal128.fromString("0"),
          units: 0,
        };

        finishedGoodsToInsert.push(finishedGood);
      });
    });

    const inserted = await FinishedGoods.insertMany(finishedGoodsToInsert);
    const len = inserted.len;
    console.log(`✅ Inserted ${len} finished goods into DB.`);
  } catch (error) {
    console.error("❌ Error inserting finished goods:", error);
    await mongoose.connection.close();
  }
};
