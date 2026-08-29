import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function BuyerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get('/orders').then((res) => setOrders(res.data.orders.filter((o) => o.buyerId === user.id)));
  }, [user.id]);

  async function confirmReceipt(orderId) {
    await api.patch(`/orders/${orderId}/confirm-receipt`);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'COMPLETED' } : o)));
  }

  return (
    <div className="container">
      <h1>Buyer dashboard</h1>
      <Link to="/listings"><button>Browse listings</button></Link>

      <h3 style={{ marginTop: 24 }}>My orders</h3>
      {orders.map((o) => (
        <div className="card" key={o.id}>
          <p>Order {o.id.slice(0, 8)} — <span className="badge">{o.status}</span></p>
          <p>{o.finalPrice.toLocaleString()} ETB</p>
          {!o.transportJob && <Link to={`/orders/${o.id}/transport`}><button>Arrange transport</button></Link>}
          {o.status === 'DELIVERED' && <button onClick={() => confirmReceipt(o.id)}>Confirm receipt</button>}
        </div>
      ))}
      {orders.length === 0 && <p>No orders yet.</p>}
    </div>
  );
}
