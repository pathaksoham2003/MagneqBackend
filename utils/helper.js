export const validateFieldsByClass = (class_type, data) => {
  const requiredFields = {
    A: ['other_specification', 'quantity', 'casting_product'],
    B: ['product', 'quantity', 'status'],
    C: ['other_specification', 'quantity', 'select_items', 'expiry_date'],
  };

  const missingFields = requiredFields[class_type]?.filter(
    (field) => data[field] === undefined || data[field] === null
  );

  return missingFields;
};

export const filterFieldsByClass = (class_type, data) => {
  const allowedFields = {
    A: ['_id', 'class_type', 'other_specification', 'quantity', 'casting_product'],
    B: ['_id', 'class_type', 'product', 'quantity', 'status'],
    C: ['_id', 'class_type', 'other_specification', 'quantity', 'select_items', 'expiry_date'],
  };

  const keepFields = allowedFields[class_type] || [];

  const filtered = {};
  for (const key of keepFields) {
    if (data[key] !== undefined) {
      filtered[key] = data[key];
    }
  }

  return filtered;
};


export function formatPower(value) {
  if (value === null || value === undefined) return "$";
  const str = value.toString();
  return str.replace(".", "") + "'";
}


export const getFgModelNumber = (fg) => {
  if (!fg || typeof fg !== "object") return "InvalidFG";

  const model = fg.model || "$";
  const type = fg.type || "$";
  const ratio = formatPower(fg.ratio || "$");
  const otherSpec = fg.other_specification || {};
  const shaft = otherSpec.motor_shaft_diameter || "$";
  const frame = otherSpec.motor_frame_size || "$";

  return `MA${type}${model}${ratio}${shaft}${frame}`;
};

export const getModelNumber = (model_id) => `MA${model_id}`;