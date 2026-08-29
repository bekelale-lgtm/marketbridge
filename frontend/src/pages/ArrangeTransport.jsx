import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function ArrangeTransport() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [method, setMethod] = useState('OWN_TRUCK');
  const [form, setForm] = useState({ pickupLocation: '', destination: '', load: '', requiredCapacity: '' });
  const [matches, setMatches] = useState([]);
  const [truckOwnerId, setTruckOwnerId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/orders/${orderId}`).then((res) => setOrder(res.data.order));
  }, [orderId]);

  async function findTrucks() {
    const res = await api.get('/transport/match', { params: { minCapacity: form.requiredCapacity } });
    setMatches(res.data.trucks);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    const arrangingParty = user.id === order.sellerId ? 'SELLER' : 'BUYER';
    try {
      await api.post('/transport', {
        orderId,
        arrangingParty,
        method,
        truckOwnerId: method === 'HIRE_TRANSPORTER' ? truckOwnerId : undefined,
        pickupLocation: form.pickupLocation,
        destination: form.destination,
        load: form.load,
        requiredCapacity: form.requiredCapacity ? Number(form.requiredCapacity) : undefined,
      });
      navigate(`/orders/${orderId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not arrange transport');
    }
  }

  if (!order) return <div className="container">Loading…</div>;

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <h2>Arrange transport</h2>
      <p style={{ color: '#5a6357' }}>
        Either the seller or the buyer may arrange transport — it is never
        automatically assigned. Using your own truck generates no
        transport-hiring commission.
      </p>
      {error && <div className="error">{error}</div>}
      <form onSubmit={submit} className="card">
        <label>Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="OWN_TRUCK">Use my own truck</option>
          <option value="HIRE_TRANSPORTER">Hire a registered transporter</option>
        </select>

        <label>Pickup location</label>
        <input required value={form.pickupLocation} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} />
        <label>Destination</label>
        <input required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
        <label>Load description</label>
        <input required value={form.load} onChange={(e) => setForm({ ...form, load: e.target.value })} />
        <label>Required capacity (tons)</label>
        <input type="number" value={form.requiredCapacity} onChange={(e) => setForm({ ...form, requiredCapacity: e.target.value })} />

        {method === 'HIRE_TRANSPORTER' && (
          <div style={{ marginBottom: 12 }}>
            <button type="button" className="secondary" onClick={findTrucks}>Find matching trucks</button>
            {matches.map((t) => (
              <div key={t.id} style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
                <p>{t.truckType} — {t.capacity}t — {t.operatingArea} — {t.owner.name} ({t.rating?.toFixed(1) || 'unrated'}★)</p>
                <button type="button" className={truckOwnerId === t.owner.id ? '' : 'secondary'} onClick={() => setTruckOwnerId(t.owner.id)}>
                  {truckOwnerId === t.owner.id ? 'Selected' : 'Select'}
                </button>
              </div>
            ))}
          </div>
        )}

        <button type="submit">Confirm transport arrangement</button>
      </form>
    </div>
  );
}
