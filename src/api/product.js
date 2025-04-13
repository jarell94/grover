import API from './auth';

export const createProduct = (productData) => API.post('/products', productData);
export const getProducts = () => API.get('/products');
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
