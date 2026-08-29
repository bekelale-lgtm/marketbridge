import React from 'react';
import { Link } from 'react-router-dom';

export default function ListingCard({ listing }) {
  return (
    <div className="card">
      <h3>{listing.cropType} <span className="badge">{listing.status}</span></h3>
      <p>{listing.quantity} {listing.unit} — {listing.location}</p>
      <p><strong>{listing.askingPrice.toLocaleString()} ETB</strong> asking</p>
      <p style={{ fontSize: 13, color: '#5a6357' }}>Seller: {listing.seller?.name}</p>
      <Link to={`/listings/${listing.id}`}><button>View</button></Link>
    </div>
  );
}
