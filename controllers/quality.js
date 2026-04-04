import Quality from "../models/Quality.js";
import logger from "../utils/logger.js";

export const createQuality = async (req, res, next) => {
  try {
    const {issue_type, items = [], description} = req.body;
    if(!description || !issue_type ||!items){
      res.status(400).json({message:"All the fields are required"})
    }
    if (issue_type === "Material") {
      const finishedGoodsIds = [];

      for (const item of items) {
        const {model, type, ratio, power} = item;
        const finishedGood = await FinishedGoods.findOne({
          model: model,
          type: type,
          ratio: ratio,
          power: power.toString(),
        });

        if (!finishedGood) {
          return res.status(404).json({
            error: `Finished good not found for model: ${model}, type: ${type}, ratio: ${ratio}, power: ${power}`,
          });
        }

        finishedGoodsIds.push(finishedGood._id);
      }

      const issueDoc = await Quality.create({
        finished_good: finishedGoodsIds,
        issue: description,
        action_taken: false,
        issue_type: issue_type,
        created_by: `${req.user.name}(${req.user.user_name})`,
      });

      return res.status(201).json(issueDoc);
    }

    const issueDoc = await Quality.create({
      issue_type: issue_type,
      issue: description,
      created_by: `${req.user.name}(${req.user.user_name})`,
      action_taken: false,
    });

    logger.info(`Quality issue created types: ${issue_type} by ${req.user.user_name}`);
    return res.status(201).json(issueDoc);
  } catch (err) {
    next(err);
  }
};

export const getAllQualities = async (req, res, next) => {
  try {
    const {page = 1, limit = 10, search = "", issue_type = ""} = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (issue_type) {
      query.issue_type = issue_type;
    }

    if (req.user?.role === "CUSTOMER") {
      query.created_by = `${req.user.name}(${req.user.user_name})`;
    }

    if (search) {
      query.$or = [
        {vendor: {$regex: search, $options: "i"}},
        {"items.order_number": {$regex: search, $options: "i"}},
      ];
    }

    const totalItems = await Quality.countDocuments(query);
    const qualityIssues = await Quality.find(query)
      .populate("finished_good")
      .sort({createdAt: -1})
      .skip(skip)
      .limit(parseInt(limit));

    const response = {
      header: ["Ticket ID", "Created By", "Date", "Issue", "Action Taken"],
      item: qualityIssues.map((issue) => ({
        id: issue._id,
        data: [
          issue._id.toString().slice(-4).toUpperCase(),
          issue.created_by || "N/A",
          new Date(issue.created_at).toLocaleDateString("en-GB"),
          issue.issue_type,
          issue.action_taken ? "YES" : "NO",
        ],
        issue: issue.issue,
        issue_type: issue.issue_type,
      })),
      page_no: parseInt(page),
      total_pages: Math.ceil(totalItems / limit),
      total_items: totalItems,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
};

export const getSpecificQualityIssue = async (req, res, next) => {
  try {
    const {id} = req.params;

    const qualityIssue = await Quality.findById(id)
      .populate("finished_good")
      .populate("created_by");

    if (!qualityIssue) {
      return res.status(404).json({error: "Quality issue not found"});
    }

    res.json(qualityIssue);
  } catch (err) {
    next(err);
  }
};

export const updateQuality = async (req, res, next) => {
  try {
    const {id} = req.params;
    const updated = await Quality.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({error: "Quality issue not found"});
    }

    logger.info(`Quality issue updated: ${id} by ${req.user.user_name}`);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

export const deleteQuality = async (req, res, next) => {
  try {
    const {id} = req.params;
    const deleted = await Quality.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({error: "Quality issue not found"});
    }

    logger.warn(`Quality issue deleted: ${id} by ${req.user.user_name}`);
    res.json({message: "Quality issue deleted successfully"});
  } catch (err) {
    next(err);
  }
};
