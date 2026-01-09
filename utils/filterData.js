export const filterPower = (power) => {

  power.toLowerCase().replace("hp", "").trim();
};

export const filterType = (type) => {
  if (
    type.toLowerCase().containe === "base" ||
    type.toLowerCase().contains("foot")
  ) {
    return "B";
  } else if (
    type.toLowerCase().contains("vertical") ||
    type.toLowerCase().contains("flange")
  ) {
    return "V";
  }
};
