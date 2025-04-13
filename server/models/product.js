const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String, // store file path or external URL
  description: String,
  category: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // seller
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
