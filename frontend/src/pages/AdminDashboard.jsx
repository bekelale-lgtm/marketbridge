import React, { useEffect, useState } from 'react';
import api from '../api/client';

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [disputes, setDisputes] = useState([]);

  useEffect(() => {
    api.get('/admin/overview').then((res) => setOverview(res.data));
    api.get('/disputes').then((res) => setDisputes(res.data.disputes));
  }, []);

  async function resolve(id, status) {
    await api.patch(`/disputes/${id}/resolve`, { status, resolution: `Marked ${status} by admin` });
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
  }

  if (!overview) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <h1>Admin dashboard</h1>
      <div className="grid">
        <div className="card"><h3>{overview.users}</h3><p>Users</p></div>
        <div className="card"><h3>{overview.listings}</h3><p>Listings</p></div>
        <div className="card"><h3>{overview.orders}</h3><p>Orders</p></div>
        <div className="card"><h3>{overview.openDisputes}</h3><p>Open disputes</p></div>
        <div className="card"><h3>{overview.activeAds}</h3><p>Active ads</p></div>
        <div className="card"><h3>{overview.totalPaidVolume.toLocaleString()} ETB</h3><p>Paid volume</p></div>
      </div>

      <h3 style={{ marginTop: 24 }}>Open disputes</h3>
      {disputes.filter((d) => d.status === 'OPEN').map((d) => (
        <div className="card" key={d.id}>
          <p>{d.disputeType}: {d.raisedBy?.name} vs {d.against?.name}</p>
          <p>{d.description}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => resolve(d.id, 'RESOLVED')}>Resolve</button>
            <button className="secondary" onClick={() => resolve(d.id, 'REJECTED')}>Reject</button>
          </div>
        </div>
      ))}
      {disputes.filter((d) => d.status === 'OPEN').length === 0 && <p>No open disputes.</p>}
    </div>
  );
}
