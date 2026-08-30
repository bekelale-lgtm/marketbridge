import React, { useEffect, useState } from 'react';
import api from '../api/client';
import ListingCard from '../components/ListingCard.jsx';
import { Link } from 'react-router-dom';

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [filters, setFilters] = useState({ cropType: '', location: '', minQuantity: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchListings() {
    setLoading(true); setError('');
    try {
      const res = await api.get('/listings', { params: filters });
      setListings(res.data.listings || []);
    } catch (e) { setError('Could not load marketplace listings.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { fetchListings(); }, []);

  return <main className="section">
    <div className="container-wide">
      <div className="page-header">
        <div><span className="eyebrow">AGRICULTURAL MARKETPLACE</span><h1>Find produce at the source.</h1><p>Compare farm-level listings, quantities, locations and asking prices.</p></div>
        <Link to="/create-listing" className="btn btn-primary">+ List produce</Link>
      </div>
      <div className="search-panel">
        <div><label>Produce</label><input value={filters.cropType} onChange={e=>setFilters({...filters,cropType:e.target.value})} placeholder="Potatoes, wheat, barley..." /></div>
        <div><label>Location</label><input value={filters.location} onChange={e=>setFilters({...filters,location:e.target.value})} placeholder="Region, town or district" /></div>
        <div><label>Minimum quantity</label><input type="number" value={filters.minQuantity} onChange={e=>setFilters({...filters,minQuantity:e.target.value})} placeholder="e.g. 100" /></div>
        <button className="btn btn-primary" onClick={fetchListings}>Search market</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="market-toolbar"><strong>{loading ? 'Loading…' : `${listings.length} listing${listings.length===1?'':'s'}`}</strong><span className="muted">Quality can be independently inspected before purchase.</span></div>
      {loading ? <div className="loading">Loading marketplace…</div> : <div className="listing-grid">{listings.map(l=><ListingCard key={l.id} listing={l}/>)}{!listings.length && <div className="empty card"><h3>No matching produce</h3><p>Try a broader location or crop search.</p></div>}</div>}
    </div>
  </main>;
}
