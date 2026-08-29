import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';

export default function OrderDetail() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    api.get(`/orders/${orderId}`).then((res) => setOrder(res.data.order));
  }, [orderId]);

  if (!order) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <h1>Order {order.id.slice(0, 8)} <span className="badge">{order.status}</span></h1>
      <div className="card">
        <p>{order.listing?.cropType} — {order.finalPrice.toLocaleString()} ETB</p>
        <p>Buyer: {order.buyer?.name} · Seller: {order.seller?.name}</p>
      </div>

      {order.transportJob && (
        <div className="card">
          <h3>Transport</h3>
          <p>Arranged by: {order.transportJob.arrangingParty} — Method: {order.transportJob.method}</p>
          <p>Status: <span className="badge">{order.transportJob.status}</span></p>
          <p>{order.transportJob.pickupLocation} → {order.transportJob.destination}</p>
        </div>
      )}

      {order.payments?.length > 0 && (
        <div className="card">
          <h3>Payments</h3>
          {order.payments.map((p) => (
            <p key={p.id}>{p.type} — {p.amount.toLocaleString()} ETB via {p.method} — <span className="badge">{p.status}</span></p>
          ))}
        </div>
      )}
    </div>
  );
}
