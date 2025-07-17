import mongoose from "../utils/db.js";
import fs from "fs";
import bcrypt from "bcrypt";

import RawMaterial from "../models/RawMaterials.js";
import User from "../models/User.js";
import FinishedGoods from "../models/FinishedGoods.js";
import RoutePermission from "../models/RoutePermission.js";
import {insertFinishedGoods} from "./fg.js";
import Production from "../models/Production.js";
import Quality from "../models/Quality.js";
import Sales from "../models/Sales.js";

const mockData = JSON.parse(
  fs.readFileSync(new URL("./rawMaterialA.json", import.meta.url), "utf-8")
);

import XLSX from "xlsx";

const generateRawMaterialsB = async () => {
  const workbook = XLSX.readFile("./mocks/data/rawMaterialB.csv");
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {defval: ""});

  const records = [];

  rows.forEach((row) => {
    for (const [column, value] of Object.entries(row)) {
      if (value && value.toString().trim()) {
        records.push({
          class_type: "B",
          name: value.toString().trim(),
          type: column.trim(),
          quantity: {
            unprocessed: 0,
            hobbing: 0,
            ht: 0,
            processed: 0,
          },
        });
      }
    }
  });

  await RawMaterial.insertMany(records);
  console.log(`✅ Inserted ${records.length} class B raw materials from Excel`);
};

const generateRawMaterialsC = async () => {
  try {
    const workbook = XLSX.readFile("./mocks/data/rawMaterialC.csv");
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {defval: ""});

    const records = [];

    rows.forEach((row) => {
      Object.entries(row).forEach(([type, value]) => {
        if (value && value.toString().trim()) {
          const rawMaterial = {
            class_type: "C",
            name: type.trim(),
            type: value.toString().trim(),
            quantity: {processed: 0},
            expiry_date: new Date("2026-12-31"), // default/fixed expiry
            other_specification: {
              set_type: "Standard Kit",
              description: "Auto-generated from CSV",
            },
          };
          records.push(rawMaterial);
        }
      });
    });

    await RawMaterial.insertMany(records);
    console.log(`✅ Inserted ${records.length} class C raw materials from CSV`);
    return records;
  } catch (err) {
    console.error("❌ Error inserting Class C raw materials:", err.message);
  }
};

const generateRawMaterials = async () => {
  await generateRawMaterialsB();
  await generateRawMaterialsC();

  const rawMaterials = await RawMaterial.insertMany(mockData.data);
  console.log("✅ Raw materials seeded successfully");
  return rawMaterials;
};

const seedUsers = async () => {
  try {
    const users = JSON.parse(
      fs.readFileSync(new URL("./users.json", import.meta.url), "utf-8")
    );

    const routePermissionsMap = {};

    for (let user of users) {
      if (!user.password.startsWith("$2b$")) {
        user.password = await bcrypt.hash(user.password, 10);
      }

      const {permissions, role} = user;

      if (permissions && role) {
        if (!routePermissionsMap[role]) {
          routePermissionsMap[role] = permissions;
        }
      }

      delete user.permissions;
    }

    await User.insertMany(users);
    console.log("✅ Users seeded successfully");

    const permissionsToInsert = Object.entries(routePermissionsMap).map(
      ([role, perms]) => ({
        role,
        sidebar: perms.sidebar || [],
        support: perms.support || [],
        allowed_routes: perms.allowed_routes || [],
      })
    );

    await RoutePermission.insertMany(permissionsToInsert);
    console.log("✅ Route permissions seeded successfully");
  } catch (err) {
    console.error("❌ Error seeding users and permissions:", err.message);
  }
};

const flushAll = async () => {
  await RawMaterial.deleteMany({});
  await FinishedGoods.deleteMany({});
  await Production.deleteMany({});
  await Quality.deleteMany({});
  await Sales.deleteMany({});
  await RoutePermission.deleteMany({});
  await User.deleteMany({});
};

const runSeeder = async () => {
  try {
    await flushAll();
    const rawMaterials = await generateRawMaterials();
    await insertFinishedGoods();
    await seedUsers();
  } catch (err) {
    console.error("❌ Seeder failed:", err.message);
  } finally {
    mongoose.connection.close();
  }
};

runSeeder();
