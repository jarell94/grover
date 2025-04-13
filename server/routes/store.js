const express = require('express');
const Product = require('../models/product');
const router = express.Router();

// Add a product
router.post('/add', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).send('Product added');
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// Get all products
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

module.exports = router;
import React, { useEffect, useState } from 'react';
import { getProducts } from '../api/products';

export default function Store() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    (async () => {
      const res = await getProducts();
      setProducts(res.data);
    })();
  }, []);

  return (
    <section>
      <h2>Store</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product._id} className="border rounded p-2 shadow">
            <img src={product.image} alt={product.name} className="w-full h-40 object-cover" />
            <h3>{product.name}</h3>
            <p>${product.price}</p>
            <p>{product.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
