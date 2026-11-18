const mongoose = require("mongoose");
const menuCategoryService = require("../services/menuCategory.service");

exports.list = async (req, res) => {
  const categories = await menuCategoryService.list();
  res.json({ categories });
};

exports.create = async (req, res) => {
  try {
    const category = await menuCategoryService.create(req.body);
    res.status(201).json({ category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Category name already exists" });
    }
    if (err.status === 400 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await menuCategoryService.update(id, req.body);
    res.json({ category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Category name already exists" });
    }
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid category id" });
    }
    const category = await menuCategoryService.remove(id);
    res.json({ category });
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
};
