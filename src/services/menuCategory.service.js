const mongoose = require("mongoose");
const { MenuCategory } = require("../models/MenuCategory");

const DEFAULT_CATEGORY_NAMES = ["Main Course", "Side Dish", "Beverages", "Soup", "Fruits"];

function toPublicCategory(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: o._id,
    name: o.name,
    sortOrder: o.sortOrder ?? 0,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function orderCategoryDocs(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byName = new Map(list.map((c) => [String(c.name || "").trim(), c]));
  const ordered = [];
  const seen = new Set();

  for (const name of DEFAULT_CATEGORY_NAMES) {
    const row = byName.get(name);
    if (row && !seen.has(name)) {
      seen.add(name);
      ordered.push(row);
    }
  }

  const rest = [...list]
    .filter((c) => !seen.has(String(c.name || "").trim()))
    .sort((a, b) => {
      const ao = Number(a.sortOrder) || 0;
      const bo = Number(b.sortOrder) || 0;
      if (ao !== bo) return ao - bo;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  return [...ordered, ...rest];
}

async function ensureDefaultCategories() {
  const existing = await MenuCategory.find().lean();
  if (existing.length > 0) {
    return orderCategoryDocs(existing);
  }

  const docs = DEFAULT_CATEGORY_NAMES.map((name, index) => ({
    name,
    sortOrder: index,
  }));
  await MenuCategory.insertMany(docs, { ordered: true });
  const seeded = await MenuCategory.find().lean();
  return orderCategoryDocs(seeded);
}

async function list() {
  const rows = await ensureDefaultCategories();
  return rows.map((r) => toPublicCategory(r));
}

async function getById(categoryId) {
  if (!mongoose.isValidObjectId(categoryId)) return null;
  const doc = await MenuCategory.findById(categoryId).lean();
  return toPublicCategory(doc);
}

async function findByName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;
  const doc = await MenuCategory.findOne({ name: trimmed }).lean();
  return toPublicCategory(doc);
}

async function create(body) {
  const name = String(body?.name || "").trim();
  if (!name) {
    const err = new Error("name is required");
    err.status = 400;
    throw err;
  }
  const doc = await MenuCategory.create({
    name,
    sortOrder: Number(body?.sortOrder) || 0,
  });
  return toPublicCategory(doc);
}

async function update(categoryId, body) {
  if (!mongoose.isValidObjectId(categoryId)) {
    const err = new Error("Invalid category id");
    err.status = 400;
    throw err;
  }
  const patch = {};
  if (body?.name != null) {
    const name = String(body.name).trim();
    if (!name) {
      const err = new Error("name cannot be empty");
      err.status = 400;
      throw err;
    }
    patch.name = name;
  }
  if (body?.sortOrder != null) {
    patch.sortOrder = Number(body.sortOrder) || 0;
  }
  const doc = await MenuCategory.findByIdAndUpdate(categoryId, patch, {
    new: true,
    runValidators: true,
  }).lean();
  if (!doc) {
    const err = new Error("Category not found");
    err.status = 404;
    throw err;
  }
  return toPublicCategory(doc);
}

async function remove(categoryId) {
  if (!mongoose.isValidObjectId(categoryId)) {
    const err = new Error("Invalid category id");
    err.status = 400;
    throw err;
  }
  const doc = await MenuCategory.findByIdAndDelete(categoryId).lean();
  if (!doc) {
    const err = new Error("Category not found");
    err.status = 404;
    throw err;
  }
  return toPublicCategory(doc);
}

module.exports = {
  DEFAULT_CATEGORY_NAMES,
  ensureDefaultCategories,
  list,
  getById,
  findByName,
  create,
  update,
  remove,
  toPublicCategory,
  orderCategoryDocs,
};
