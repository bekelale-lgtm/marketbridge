import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function CreateListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    sellerId: user?.roles.includes('SELLER') ? user.id : '',
    cropType: '', quantity: '', unit: 'quintal', askingPrice: '', minAcceptablePrice: '',
    location: user?.location || '', readinessDate: '',
  });
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/listings', {
        ...form,
        quantity: Number(form.quantity),
        askingPrice: Number(form.askingPrice),
        minAcceptablePrice: form.minAcceptablePrice ? Number(form.minAcceptablePrice) : undefined,
      });
      navigate(`/listings/${res.data.listing.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create listing');
    }
  }

  const isInspectorHelping = user?.roles.includes('INSPECTOR') && !user?.roles.includes('SELLER');

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <h2>{isInspectorHelping ? 'Create listing on behalf of a farmer' : 'Create a listing'}</h2>
      <form onSubmit={handleSubmit} className="card">
        {error && <div className="error">{error}</div>}
        {isInspectorHelping && (
          <>
            <label>Farmer's user ID (the farmer keeps price authority)</label>
            <input required value={form.sellerId} onChange={(e) => setForm({ ...form, sellerId: e.target.value })} />
          </>
        )}
        <label>Crop type</label>
        <input required value={form.cropType} onChange={(e) => setForm({ ...form, cropType: e.target.value })} />
        <label>Quantity</label>
        <input required type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        <label>Unit</label>
        <input required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        <label>Asking price (ETB)</label>
        <input required type="number" value={form.askingPrice} onChange={(e) => setForm({ ...form, askingPrice: e.target.value })} />
        <label>Minimum acceptable price (private, optional)</label>
        <input type="number" value={form.minAcceptablePrice} onChange={(e) => setForm({ ...form, minAcceptablePrice: e.target.value })} />
        <label>Location</label>
        <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <label>Best pickup window / readiness date</label>
        <input type="date" value={form.readinessDate} onChange={(e) => setForm({ ...form, readinessDate: e.target.value })} />
        <button type="submit">Publish listing</button>
      </form>
    </div>
  );
}
