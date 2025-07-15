import FinishedGoods from "../models/FinishedGoods.js";
import Quality from "../models/Quality.js";

export const createQuality = async (req, res) => {
  try {
    const { issue_type, items = [], description } = req.body;

    if (issue_type === "Material") {
      const finishedGoodsIds = [];

      for (const item of items) {
        const { model, type, ratio, power } = item;

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

        finishedGoodsIds.push(finishedGood._id);
      }

      const issueDoc = await Quality.create({
        finished_good: finishedGoodsIds,
        vendor: "Mohan Kumar",
        issue: description,
        action_taken: false,
        issue_type: issue_type,
      });

      return res.status(201).json(issueDoc);
    }

    const issueDoc = await Quality.create({
      concern_type: issue_type,
      issue: description,
      vendor: "Mohan Kumar",
      action_taken: false,
    });

    return res.status(201).json(issueDoc);
  } catch (err) {
    console.error("Error in createQuality:", err);
    res.status(500).json({ error: "Failed to create quality issue", details: err.message });
  }
};


export const getAllQualities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      issue_type = '',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (issue_type) {
      query.issue_type = issue_type;
    }

    if (search) {
      query.$or = [
        { vendor: { $regex: search, $options: 'i' } },
        { 'items.order_number': { $regex: search, $options: 'i' } },
      ];
    }

    const totalItems = await Quality.countDocuments(query);
    const qualityIssues = await Quality.find(query)
      .populate('finished_good')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const response = {
      header: ['Ticket ID', 'Vendor name', 'Date', 'Issue', 'Action Taken'],
      item: qualityIssues.map((issue) => {
        return {
          id: issue._id,
          data: [
            issue._id.toString().slice(-4).toUpperCase(),
            issue.vendor || 'N/A',
            new Date(issue.created_at).toLocaleDateString("en-GB"),
            issue.issue_type,
            issue.action_taken ? 'YES' : 'NO',
          ],
        };
      }),
      page_no: parseInt(page),
      total_pages: Math.ceil(totalItems / limit),
      total_items: totalItems,
    };

    res.json(response);
  } catch (err) {
    console.error('Error fetching quality issues:', err);
    res.status(500).json({ error: 'Failed to fetch quality issues' });
  }
};

export const getSpecificQualityIssue = async (req, res) => {
  try {
    const { id } = req.params;

    const qualityIssue = await Quality.findById(id).populate("finished_good");

    if (!qualityIssue) {
      return res.status(404).json({ error: "Quality issue not found" });
    }

    res.json(qualityIssue);
  } catch (err) {
    console.error("Error in getSpecificQualityIssue:", err);
    res.status(500).json({ error: "Failed to fetch quality issue" });
  }
};


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
