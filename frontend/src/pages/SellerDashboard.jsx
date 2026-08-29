import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function SellerDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get('/listings', { params: { status: 'ACTIVE' } }).then((res) =>
      setListings(res.data.listings.filter((l) => l.sellerId === user.id))
    );
    api.get('/orders').then((res) => setOrders(res.data.orders.filter((o) => o.sellerId === user.id)));
  }, [user.id]);

  return (
    <div className="container">
      <h1>Seller dashboard</h1>
      <Link to="/create-listing"><button>+ New listing</button></Link>

      <h3 style={{ marginTop: 24 }}>My listings</h3>
      <div className="grid">
        {listings.map((l) => (
          <div className="card" key={l.id}>
            <h4>{l.cropType} <span className="badge">{l.status}</span></h4>
            <p>{l.quantity} {l.unit} — {l.askingPrice.toLocaleString()} ETB</p>
            <Link to={`/listings/${l.id}`}><button className="secondary">Manage</button></Link>
          </div>
        ))}
        {listings.length === 0 && <p>No active listings yet.</p>}
      </div>

      <h3 style={{ marginTop: 24 }}>My orders</h3>
      {orders.map((o) => (
        <div className="card" key={o.id}>
          <p>Order {o.id.slice(0, 8)} — <span className="badge">{o.status}</span></p>
          <p>{o.finalPrice.toLocaleString()} ETB</p>
          {!o.transportJob && o.status !== 'CANCELLED' && (
            <Link to={`/orders/${o.id}/transport`}><button>Arrange transport</button></Link>
          )}
        </div>
      ))}
      {orders.length === 0 && <p>No orders yet.</p>}
    </div>
  );
}
