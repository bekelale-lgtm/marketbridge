import React from 'react';
import { Link } from 'react-router-dom';

export default function ListingCard({ listing }) {
  return <article className="listing-card">
    <div className="listing-photo">{listing.photos?.[0] ? <img src={listing.photos[0]} alt={listing.cropType}/> : <span>{listing.cropType?.slice(0,2).toUpperCase() || 'AG'}</span>}</div>
    <div className="listing-body">
      <div className="listing-meta"><span className="tag">AGRICULTURE</span><span>{listing.status}</span></div>
      <h3>{listing.cropType}</h3>
      <p className="listing-location">⌖ {listing.location}</p>
      <div className="listing-stats"><div><span>Quantity</span><strong>{Number(listing.quantity).toLocaleString()} {listing.unit}</strong></div><div><span>Asking</span><strong>{Number(listing.askingPrice).toLocaleString()} ETB</strong></div></div>
      <div className="listing-footer"><span>Seller: {listing.seller?.name || 'Farmer'} {listing.seller?.rating ? `· ★ ${listing.seller.rating.toFixed(1)}` : ''}</span><Link className="text-link" to={`/listings/${listing.id}`}>View listing →</Link></div>
    </div>
  </article>;
}
