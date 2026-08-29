import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="container">
      <h1>MarketBridge</h1>
      <p style={{ maxWidth: 640 }}>
        Connecting farmers, buyers, independent inspectors and transporters across
        Ethiopia. Verified quality, transparent negotiation, and transport arranged
        by whichever party the deal favors — MarketBridge never owns the goods or
        the truck.
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <Link to="/listings"><button>Browse the agricultural marketplace</button></Link>
        <Link to="/digital"><button className="secondary">Browse the digital marketplace</button></Link>
      </div>
    </div>
  );
}
