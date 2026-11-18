const mongoose = require("mongoose");
const menuService = require("../services/menu.service");
const { uploadMenuImage } = require("../services/s3Upload.service");

function readListFilters(req) {
  return {
    category: req.query.category,
    categoryId: req.query.categoryId,
    availability: req.query.availability,
    search: req.query.search,
  };
}

exports.catalog = async (req, res) => {
  const menu = await menuService.listAll({ availability: "available" });
  res.json({ menu });
};

exports.guestPortal = async (req, res) => {
  const data = await menuService.guestPortalBundle();
  res.json(data);
};

exports.adminBootstrap = async (req, res) => {
  const data = await menuService.adminBootstrap({
    limit: req.query.limit,
    search: req.query.search,
  });
  res.json(data);
};

exports.list = async (req, res) => {
  const hasPagination = req.query.page != null || req.query.limit != null;
  const filters = readListFilters(req);

  if (hasPagination) {
    const result = await menuService.listPaginated(req.query.page, req.query.limit, filters);
    return res.json(result);
  }

  const menu = await menuService.listAll(filters);
  res.json({ menu });
};

exports.getById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid menu item id" });
  }
  const item = await menuService.getById(id);
  if (!item) {
    return res.status(404).json({ error: "Menu item not found" });
  }
  res.json({ item });
};

exports.create = async (req, res) => {
  try {
    const item = await menuService.create(req.body);
    res.status(201).json({ item });
  } catch (err) {
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await menuService.update(id, req.body);
    res.json({ item });
  } catch (err) {
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await menuService.remove(id);
    res.json({ item });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.uploadImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No image file provided. Use form field 'image'." });
    }
    const result = await uploadMenuImage(file);
    res.json(result);
  } catch (err) {
    if (err.status === 400 || err.status === 503) {
      return res.status(err.status).json({
        error: err.message,
        code: err.code,
      });
    }
    throw err;
  }
};
