const express = require('express');
const auth = require('../middleware/auth');
const Product = require('../models/product');

const router = express.Router();

// Create a product
router.post('/', auth, async (req, res) => {
  try {
    const { name, price, image, description, category } = req.body;
    const product = await Product.create({
      name,
      price,
      image,
      description,
      category,
      user: req.user.id
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: 'Product creation failed.' });
  }
});

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().populate('user', 'name');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Fetching products failed.' });
  }
});

// Get products by user (for their store tab)
router.get('/user/:userId', async (req, res) => {
  try {
    const products = await Product.find({ user: req.params.userId });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch user products.' });
  }
});

module.exports = router;
const upload = require('../middleware/upload');

// Create product with image
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { name, price, description, category } = req.body;
    const image = req.file ? `/uploads/products/${req.file.filename}` : '';

    const product = await Product.create({
      name,
      price,
      description,
      category,
      image,
      user: req.user.id
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: 'Product creation failed.' });
  }
});
app.use('/uploads', express.static('uploads'));

// Edit product
router.put('/:id', auth, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Could not update product' });
  }
});

// Delete product
router.delete('/:id', auth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete product' });
  }
});
// Edit product
router.put('/:id', auth, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Could not update product' });
  }
});

// Delete product
router.delete('/:id', auth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete product' });
  }
});
