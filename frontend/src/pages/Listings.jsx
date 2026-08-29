import React, { useEffect, useState } from 'react';
import api from '../api/client';
import ListingCard from '../components/ListingCard.jsx';

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [filters, setFilters] = useState({ cropType: '', location: '' });
  const [loading, setLoading] = useState(true);

  async function fetchListings() {
    setLoading(true);
    const res = await api.get('/listings', { params: filters });
    setListings(res.data.listings);
    setLoading(false);
  }

  useEffect(() => { fetchListings(); }, []); // eslint-disable-line

  return (
    <div className="container">
      <h1>Agricultural Marketplace</h1>
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
        <div style={{ flex: 1 }}>
          <label>Crop type</label>
          <input value={filters.cropType} onChange={(e) => setFilters({ ...filters, cropType: e.target.value })} placeholder="e.g. Potatoes" />
        </div>
        <div style={{ flex: 1 }}>
          <label>Location</label>
          <input value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} placeholder="e.g. Bahir Dar" />
        </div>
        <button onClick={fetchListings} style={{ marginBottom: 10 }}>Search</button>
      </div>

      {loading ? <p>Loading…</p> : (
        <div className="grid">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          {listings.length === 0 && <p>No listings match your search.</p>}
        </div>
      )}
    </div>
  );
}
