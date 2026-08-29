import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const res = await api.get(`/listings/${id}`);
    setListing(res.data.listing);
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function submitOffer(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/offers', { listingId: id, amount: Number(offerAmount) });
      setMsg('Offer submitted.');
      setOfferAmount('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit offer');
    }
  }

  async function requestInspection(mode) {
    setError('');
    try {
      await api.post('/inspections', { listingId: id, mode });
      setMsg('Inspection requested.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not request inspection');
    }
  }

  async function respondToOffer(offerId, action) {
    setError('');
    try {
      await api.patch(`/offers/${offerId}`, { action });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    }
  }

  if (!listing) return <div className="container">Loading…</div>;

  const isOwner = user && listing.sellerId === user.id;
  const isBuyer = user && user.roles.includes('BUYER') && !isOwner;

  return (
    <div className="container">
      <h1>{listing.cropType} <span className="badge">{listing.status}</span></h1>
      <div className="card">
        <p>{listing.quantity} {listing.unit} available in {listing.location}</p>
        <p><strong>{listing.askingPrice.toLocaleString()} ETB</strong> asking price</p>
        {listing.harvestedDate && <p>Harvested: {new Date(listing.harvestedDate).toLocaleDateString()}</p>}
        {listing.readinessDate && <p>Ready for pickup: {new Date(listing.readinessDate).toLocaleDateString()}</p>}
        <p style={{ fontSize: 13, color: '#5a6357' }}>Seller: {listing.seller?.name} ({listing.seller?.rating?.toFixed(1) || 'unrated'}★)</p>
      </div>

      {msg && <p style={{ color: '#22532e' }}>{msg}</p>}
      {error && <div className="error">{error}</div>}

      {isBuyer && (
        <div className="card">
          <h3>Make an offer</h3>
          <form onSubmit={submitOffer}>
            <label>Offer amount (ETB)</label>
            <input type="number" required value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} />
            <button type="submit">Submit offer</button>
          </form>
          <div style={{ marginTop: 10 }}>
            <button className="secondary" onClick={() => requestInspection('BUYER_REQUESTED')}>Request inspection</button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="card">
          <h3>Offers received</h3>
          {listing.offers?.length === 0 && <p>No offers yet.</p>}
          {listing.offers?.map((o) => (
            <div key={o.id} style={{ borderTop: '1px solid #eee', padding: '10px 0' }}>
              <p><strong>{o.amount.toLocaleString()} ETB</strong> — <span className="badge">{o.status}</span></p>
              {(o.status === 'PENDING' || o.status === 'COUNTERED') && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => respondToOffer(o.id, 'ACCEPT')}>Accept</button>
                  <button className="secondary" onClick={() => respondToOffer(o.id, 'REJECT')}>Reject</button>
                </div>
              )}
            </div>
          ))}
          <div style={{ marginTop: 10 }}>
            <button className="secondary" onClick={() => requestInspection('SELLER_REQUESTED')}>Request inspection</button>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Inspection reports</h3>
        {(!listing.inspectionRequests || listing.inspectionRequests.length === 0) && <p>No inspections yet.</p>}
        {listing.inspectionRequests?.map((req) => (
          <div key={req.id} style={{ borderTop: '1px solid #eee', padding: '10px 0' }}>
            <p>Mode: {req.mode} — <span className="badge">{req.status}</span> {req.inspector && `— ${req.inspector.name}`}</p>
            {req.report && (
              <ul>
                <li>Quantity verified: {req.report.quantity}</li>
                {req.report.grade && <li>Grade: {req.report.grade}</li>}
                {req.report.moisture != null && <li>Moisture: {req.report.moisture}%</li>}
                {req.report.visibleDefects && <li>Defects: {req.report.visibleDefects}</li>}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
