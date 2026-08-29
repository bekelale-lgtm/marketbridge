import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function DigitalMarketplace() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ title: '', productType: 'ebook', price: '', fileUrl: '', description: '' });
  const [error, setError] = useState('');

  function load() {
    api.get('/digital-products').then((res) => setProducts(res.data.products));
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/digital-products', { ...form, price: Number(form.price) });
      setForm({ title: '', productType: 'ebook', price: '', fileUrl: '', description: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not publish product');
    }
  }

  return (
    <div className="container">
      <h1>Digital Marketplace</h1>
      <p style={{ color: '#5a6357' }}>eBooks, templates, graphics, photos, software licenses, courses. Independent sellers keep ownership.</p>

      {user?.roles.includes('SELLER') && (
        <div className="card">
          <h3>Publish a digital product</h3>
          {error && <div className="error">{error}</div>}
          <form onSubmit={submit}>
            <label>Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <label>Type</label>
            <select value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}>
              <option value="ebook">eBook</option>
              <option value="template">Template</option>
              <option value="graphic">Graphic</option>
              <option value="photo">Photo</option>
              <option value="software_license">Software license</option>
              <option value="course">Online course</option>
              <option value="document">Document</option>
            </select>
            <label>Price (ETB)</label>
            <input required type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <label>File URL</label>
            <input required value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} />
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button type="submit">Publish</button>
          </form>
        </div>
      )}

      <div className="grid">
        {products.map((p) => (
          <div className="card" key={p.id}>
            <h4>{p.title}</h4>
            <p className="badge">{p.productType}</p>
            <p><strong>{p.price.toLocaleString()} ETB</strong></p>
            <p style={{ fontSize: 13, color: '#5a6357' }}>By {p.seller?.name}</p>
          </div>
        ))}
        {products.length === 0 && <p>No products yet.</p>}
      </div>
    </div>
  );
}
