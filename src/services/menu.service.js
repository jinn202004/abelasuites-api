const mongoose = require("mongoose");
const { MenuItem } = require("../models/MenuItem");
const menuCategoryService = require("./menuCategory.service");

function toPublicMenuItem(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const availability = String(o.availability ?? o.status ?? "available").toLowerCase();
  return {
    id: o._id,
    name: o.name,
    itemName: o.name,
    description: o.description ?? "",
    price: o.price,
    category: o.category ?? "",
    categoryId: o.categoryId ?? undefined,
    categoryRef: o.categoryId ? String(o.categoryId) : undefined,
    imageUrl: o.imageUrl ?? "",
    availability,
    status: availability,
    dietaryTags: Array.isArray(o.dietaryTags) ? o.dietaryTags : [],
    spiceLevel: Number(o.spiceLevel) || 0,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function parsePrice(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value).replace(/[₱,\s]/g, "").trim());
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error("price must be a non-negative number");
    err.status = 400;
    throw err;
  }
  return n;
}

function normalizeAvailability(value) {
  const v = String(value ?? "available").trim().toLowerCase();
  if (v === "available" || v === "unavailable") return v;
  const err = new Error("availability must be available or unavailable");
  err.status = 400;
  throw err;
}

function buildMenuQuery(filters = {}) {
  const query = {};
  const categoryId = String(filters.categoryId || "").trim();
  const categoryName = String(filters.category || "").trim();
  const search = String(filters.search || "").trim();
  const availability = String(filters.availability || "").trim().toLowerCase();

  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    query.categoryId = categoryId;
  } else if (categoryName) {
    query.category = categoryName;
  }

  if (availability === "available" || availability === "unavailable") {
    query.availability = availability;
  }

  if (search) {
    query.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  return query;
}

async function resolveCategory(body = {}) {
  const categoryId = String(body.categoryId || body.categoryRef || "").trim();
  const categoryName = String(body.category || "").trim();

  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    const cat = await menuCategoryService.getById(categoryId);
    if (!cat) {
      const err = new Error("Category not found");
      err.status = 400;
      throw err;
    }
    return cat;
  }

  if (categoryName) {
    let cat = await menuCategoryService.findByName(categoryName);
    if (!cat) {
      const cats = await menuCategoryService.ensureDefaultCategories();
      const match = cats.find((c) => String(c.name).trim().toLowerCase() === categoryName.toLowerCase());
      if (match) {
        cat = menuCategoryService.toPublicCategory(match);
      }
    }
    if (!cat) {
      const err = new Error("Category not found");
      err.status = 400;
      throw err;
    }
    return cat;
  }

  const err = new Error("category is required");
  err.status = 400;
  throw err;
}

async function listPaginated(page = 1, limit = 10, filters = {}) {
  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10));
  const query = buildMenuQuery(filters);
  const totalItems = await MenuItem.countDocuments(query);
  const totalPages = Math.max(1, Math.ceil(totalItems / limitNum));
  const currentPage = Math.min(pageNum, totalPages);
  const skip = (currentPage - 1) * limitNum;

  const rows = await MenuItem.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  return {
    currentPage,
    totalPages,
    totalItems,
    data: rows.map((r) => toPublicMenuItem(r)),
  };
}

async function listAll(filters = {}) {
  const query = buildMenuQuery(filters);
  const rows = await MenuItem.find(query).sort({ createdAt: -1 }).lean();
  return rows.map((r) => toPublicMenuItem(r));
}

async function getById(menuItemId) {
  if (!mongoose.isValidObjectId(menuItemId)) return null;
  const doc = await MenuItem.findById(menuItemId).lean();
  return toPublicMenuItem(doc);
}

async function create(body) {
  const name = String(body?.name || body?.itemName || "").trim();
  if (!name) {
    const err = new Error("name is required");
    err.status = 400;
    throw err;
  }

  const price = parsePrice(body?.price);
  if (price === undefined) {
    const err = new Error("price is required");
    err.status = 400;
    throw err;
  }

  const category = await resolveCategory(body);
  const availability = normalizeAvailability(body?.availability ?? body?.status);

  const dietaryTags = Array.isArray(body?.dietaryTags)
    ? body.dietaryTags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : [];
  const spiceLevel = body?.spiceLevel != null ? Math.max(0, Math.min(3, parseInt(String(body.spiceLevel), 10) || 0)) : 0;

  const doc = await MenuItem.create({
    name,
    description: String(body?.description || "").trim(),
    price,
    categoryId: category.id,
    category: category.name,
    imageUrl: String(body?.imageUrl || "").trim(),
    availability,
    status: availability,
    dietaryTags,
    spiceLevel,
  });

  return toPublicMenuItem(doc);
}

async function update(menuItemId, body) {
  if (!mongoose.isValidObjectId(menuItemId)) {
    const err = new Error("Invalid menu item id");
    err.status = 400;
    throw err;
  }

  const patch = {};
  if (body?.name != null || body?.itemName != null) {
    const name = String(body?.name ?? body?.itemName ?? "").trim();
    if (!name) {
      const err = new Error("name cannot be empty");
      err.status = 400;
      throw err;
    }
    patch.name = name;
  }
  if (body?.description != null) {
    patch.description = String(body.description).trim();
  }
  if (body?.price != null) {
    patch.price = parsePrice(body.price);
  }
  if (body?.imageUrl != null) {
    patch.imageUrl = String(body.imageUrl).trim();
  }
  if (body?.availability != null || body?.status != null) {
    const availability = normalizeAvailability(body?.availability ?? body?.status);
    patch.availability = availability;
    patch.status = availability;
  }
  if (body?.category != null || body?.categoryId != null || body?.categoryRef != null) {
    const category = await resolveCategory(body);
    patch.categoryId = category.id;
    patch.category = category.name;
  }
  if (body?.dietaryTags != null) {
    patch.dietaryTags = Array.isArray(body.dietaryTags)
      ? body.dietaryTags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : [];
  }
  if (body?.spiceLevel != null) {
    patch.spiceLevel = Math.max(0, Math.min(3, parseInt(String(body.spiceLevel), 10) || 0));
  }

  const doc = await MenuItem.findByIdAndUpdate(menuItemId, patch, {
    new: true,
    runValidators: true,
  }).lean();

  if (!doc) {
    const err = new Error("Menu item not found");
    err.status = 404;
    throw err;
  }

  return toPublicMenuItem(doc);
}

async function remove(menuItemId) {
  if (!mongoose.isValidObjectId(menuItemId)) {
    const err = new Error("Invalid menu item id");
    err.status = 400;
    throw err;
  }
  const doc = await MenuItem.findByIdAndDelete(menuItemId).lean();
  if (!doc) {
    const err = new Error("Menu item not found");
    err.status = 404;
    throw err;
  }
  return toPublicMenuItem(doc);
}

async function guestPortalBundle() {
  const menuCategoryService = require("./menuCategory.service");
  const categories = await menuCategoryService.list();
  const menu = await listAll({});
  return { categories, menu };
}

async function adminBootstrap(params = {}) {
  const categories = await menuCategoryService.list();
  const orderedNames = categories.map((c) => c.name);
  const selectedCategoryName = orderedNames[0] || "";
  const selectedCategory = categories[0] || null;
  const limit = params.limit != null ? params.limit : 10;

  const menuPage = await listPaginated(1, limit, {
    category: selectedCategoryName,
    categoryId: selectedCategory?.id,
    search: params.search,
  });

  return {
    categories,
    selectedCategoryId: selectedCategory?.id,
    selectedCategoryName,
    menuPage,
  };
}

module.exports = {
  listPaginated,
  listAll,
  getById,
  create,
  update,
  remove,
  adminBootstrap,
  guestPortalBundle,
  toPublicMenuItem,
};
