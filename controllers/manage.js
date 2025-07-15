import FinishedGoods from "../models/FinishedGoods.js";
import RawMaterials from "../models/RawMaterials.js";
import User from "../models/User.js";
import mongoose from "../utils/db.js";
import { getFgModelNumber } from "../utils/helper.js";

const formatPaginatedResponse = (docs, fields, page = 1, pageSize = 20) => {
  const totalItems = docs.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const pagedDocs = docs.slice((page - 1) * pageSize, page * pageSize);

  return {
    header: fields,
    item: pagedDocs.map((doc) => ({
      id: doc._id,
      data: fields.map((field) => {
        const value = doc[field];
        if (
          value &&
          typeof value === "object" &&
          value._bsontype === "Decimal128"
        ) {
          return value.toString();
        }
        return value;
      }),
    })),
    page_no: page,
    total_pages: totalPages,
    total_items: totalItems,
  };
};

export const getUsers = async (req, res) => {
  try {
    const {page = 1, limit = 20} = req.query;
    const data = await User.find();
    const fields = ["name", "user_name", "role"];
    res
      .status(200)
      .json(formatPaginatedResponse(data, fields, Number(page), Number(limit)));
  } catch (e) {
    res.status(400).json(e);
  }
};

export const createUser = async (req, res) => {
  try {
    const {name, role, user_name, password} = req.body;

    if (!name || !role || !user_name || !password) {
      return res.status(400).json({message: "Missing required fields"});
    }

    const user = new User({
      name,
      role,
      user_name,
      password,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const savedUser = await user.save();
    res.status(201).json(savedUser);
  } catch (e) {
    res.status(400).json(e);
  }
};

export const getFinishedGoods = async (req, res) => {
  try {
    const { model, type, ratio, power, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (model) filter.model = model;
    if (type) filter.type = type;
    if (ratio) filter.ratio = ratio;
    if (power) filter.power = mongoose.Types.Decimal128.fromString(power);

    const data = await FinishedGoods.find(filter).lean();

    // Inject model number into each item
    const enhancedData = data.map((item) => ({
      ...item,
      model_number: getFgModelNumber(item),
    }));

    const fields = ["model_number", "model", "power", "ratio", "type"];

    res.status(200).json(
      formatPaginatedResponse(enhancedData, fields, Number(page), Number(limit))
    );
  } catch (e) {
    console.error("Error fetching finished goods:", e);
    res.status(400).json(e);
  }
};

export const getRawMaterialsByClass = async (req, res) => {
  try {
    const {class_type} = req.params;
    const {page = 1, limit = 20} = req.query;

    const data = await RawMaterials.find({
      class_type: class_type.toUpperCase(),
    });

    const fields = ["class_type", "name", "quantity"];
    res
      .status(200)
      .json(formatPaginatedResponse(data, fields, Number(page), Number(limit)));
  } catch (e) {
    res.status(400).json(e);
  }
};
