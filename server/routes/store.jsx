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
