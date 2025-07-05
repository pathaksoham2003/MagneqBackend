import XLSX from "xlsx";
import fs from "fs";

const excelFilePath = "./data/FG.csv";

// Read file
const workbook = XLSX.readFile(excelFilePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

// Step 1: Group rows by model|power|type|ratio
const groupMap = new Map();

data.forEach((row) => {
  const model = (row["model"] || "").toString().trim();
  const power = (row["power"] || "").toString().trim();
  const type = (row["type"] || "").toString().trim();
  const ratio = (row["ratio"] || "").toString().trim();
  const modelNumber = (row["MODEL_NUMBER"] || "").toString().trim();

  const groupKey = `${model}|${power}|${type}|${ratio}`;

  if (!groupMap.has(groupKey)) {
    groupMap.set(groupKey, new Set());
  }

  const modelNumbersSet = groupMap.get(groupKey);
  if (modelNumbersSet.has(modelNumber)) {
    modelNumbersSet.add(`DUPLICATE:${modelNumber}`);
  } else {
    modelNumbersSet.add(modelNumber);
  }
});

// Step 2: Report duplicate model numbers in each group
let hasDuplicates = false;

for (const [key, modelNumbers] of groupMap.entries()) {
  const modelNumArray = Array.from(modelNumbers);
  const duplicates = modelNumArray.filter((m) => m.startsWith("DUPLICATE:"));

  if (duplicates.length > 0) {
    hasDuplicates = true;
    console.log(`🔁 Duplicate MODEL_NUMBERs for combination: ${key}`);
    duplicates.forEach((dup) => {
      console.log(` - ${dup.replace("DUPLICATE:", "")}`);
    });
    console.log();
  }
}

if (!hasDuplicates) {
  console.log("✅ All MODEL_NUMBERs are unique within each MODEL|POWER|TYPE|RATIO group.");
}
