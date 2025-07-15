import Quality from "../models/Quality.js";

export const createQuality = async (req, res) => {
  try {
    const {model, type, ratio, power, vendor, issue, action_taken} = req.body;

    // Step 1: Find the corresponding finished good
    const finishedGood = await FinishedGoods.findOne({
      model,
      type,
      ratio,
      power,
    });

    if (!finishedGood) {
      return res.status(404).json({
        error: `Finished good not found for model: ${model}, type: ${type}, ratio: ${ratio}, power: ${power}`,
      });
    }

    // Step 2: Create quality issue with finished_good ID
    const qualityIssue = await Quality.create({
      finished_good: finishedGood._id,
      vendor,
      issue,
      action_taken,
    });

    res.status(201).json(qualityIssue);
  } catch (err) {
    console.error("Error in createQuality:", err);
    res
      .status(500)
      .json({error: "Failed to create quality issue", details: err.message});
  }
};

/** Get All Quality Issues */
export const getAllQualities = async (req, res) => {
  try {
    const qualityList = await Quality.find();
    res.json(qualityList);
  } catch (err) {
    res.status(500).json({error: "Failed to fetch quality issues"});
  }
};

/** Update Quality Issue by _id */
export const updateQuality = async (req, res) => {
  try {
    const {id} = req.params;
    const updated = await Quality.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({error: "Quality issue not found"});
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({error: "Failed to update quality issue"});
  }
};

/** Delete Quality Issue by _id */
export const deleteQuality = async (req, res) => {
  try {
    const {id} = req.params;
    const deleted = await Quality.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({error: "Quality issue not found"});
    }

    res.json({message: "Quality issue deleted successfully"});
  } catch (err) {
    res.status(500).json({error: "Failed to delete quality issue"});
  }
};
