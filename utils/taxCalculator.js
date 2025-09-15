import FinishedGoods from "../models/FinishedGoods.js";

export const calculateTaxes = async (finishedGoodId, amount, isInterState) => {
  const fg = await FinishedGoods.findById(finishedGoodId).lean();
  if (!fg) throw new Error("Finished good not found");

  const slab = parseFloat(fg.gst_slab.toString());
  let taxes = [];

  if (isInterState) {
    taxes.push({
      type: "IGST",
      percentage: slab,
      amount: (amount * slab) / 100,
    });
  } else {
    taxes.push({
      type: "CGST",
      percentage: slab / 2,
      amount: (amount * (slab / 2)) / 100,
    });
    taxes.push({
      type: "SGST",
      percentage: slab / 2,
      amount: (amount * (slab / 2)) / 100,
    });
  }

  return taxes;
};