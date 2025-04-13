import React, { useEffect, useState } from 'react';
import axios from 'axios';

function Store() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/store/products');
        setProducts(response.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProducts();
  }, []);

  return (
    <div>
      <h2>Online Store</h2>
      <div className="product-list">
        {products.map(product => (
          <div key={product._id} className="product">
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <p>${product.price}</p>
            {product.imageUrl && <img src={product.imageUrl} alt={product.name} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Store;
