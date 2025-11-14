export const validateFieldsByClass = (class_type, data) => {
  const requiredFields = {
    A: ["quantity", "name"],
    B: ["name", "quantity", "status"],
    C: ["quantity", "select_items", "expiry_date"],
  };

  const missingFields = requiredFields[class_type]?.filter(
    (field) => data[field] === undefined || data[field] === null
  );

  return missingFields;
};

export const validateFieldsForUpdate = (class_type, data) => {
  const requiredFields = {
    A: ["name","type"],
    B: ["name","type"],
    C: ["name","type"],
  };

  const missingFields = requiredFields[class_type]?.filter(
    (field) => data[field] === undefined || data[field] === null
  );

  return missingFields;
};

export const classHeaders = {
  A: ["Class", "Other Specification", "Quantity", "Casting Product"],
  B: ["Class", "Product", "Quantity", "Status"],
  C: [
    "Class",
    "Other Specification",
    "Quantity",
    "Select Items",
    "Expiry Date",
  ],
};

export const filterFieldsByClass = (classType, data) => {
  const quantityStr =
    typeof data.quantity === "object"
      ? Object.entries(data.quantity || {})
          .map(([key, val]) => `${key}: ${val}`)
          .join(", ")
      : String(data.quantity || "0");
  switch (classType) {
    case "A":
      return {
        _id:data._id,
        class_type: data.class_type,
        type:data.type,
        other_specification: {
          value: Object.entries(data.other_specification || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(", "),
        },
        quantity: quantityStr,
        name: data.name,
      };
    case "B":
      return {
        _id:data._id,
        class_type: data.class_type,
        type:data.type,
        name: data.name,
        quantity: quantityStr,
        status: data.type,
      };
    case "C":
      return {
        _id:data._id,
        class_type: data.class_type,
        name:data.name,
        type:data.type,
        other_specification: {
          value: Object.entries(data.other_specification || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(", "),
        },
        quantity: quantityStr,
        select_items: (data.select_items || []).map((i) =>
          Object.values(i).join(" ")
        ),
        expiry_date: data.expiry_date,
      };
    default:
      return {};
  }
};

export function formatPower(value) {
  if (value === null || value === undefined) return "$";
  const str = value.toString();
  return str.replace(".", "") + "'";
}

export const getFgModelNumber = (fg) => {
  if (!fg || typeof fg !== "object") return "InvalidFG";

  const model = fg.model || "$";
  let type = "";
  if(fg.type === "Base (Foot)"){
    type = "B";
  }else if (fg.type === "Vertical (Flange)"){
    type = "V";
  }
  const ratio = formatPower(fg.ratio || "$");
  const otherSpec = fg.other_specification || {};
  const shaft = otherSpec.motor_shaft_diameter || "$";
  const frame = otherSpec.motor_frame_size || "$";

  // return `MA${type}${model}${ratio}${shaft}${frame}`;
  return `MA${type}${model}${ratio}${frame}`;
};

export const getModelNumber = (model_id) => `MA${model_id}`;

export const formatDateTime = (date) => {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
};