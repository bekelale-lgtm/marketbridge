import React, { useState } from 'react';
import api from '../api/client';

export default function TruckOwnerDashboard() {
  const [truck, setTruck] = useState({ registration: '', truckType: '', capacity: '', operatingArea: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState('');

  async function registerTruck(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/transport/trucks', { ...truck, capacity: Number(truck.capacity) });
      setMsg('Truck registered.');
      setTruck({ registration: '', truckType: '', capacity: '', operatingArea: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not register truck');
    }
  }

  async function respondToJob(action) {
    setError('');
    try {
      await api.patch(`/transport/${jobId}/respond`, { action });
      setMsg(`Job ${action.toLowerCase()}ed.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    }
  }

  async function updateStatus(status) {
    setError('');
    try {
      await api.patch(`/transport/${jobId}/status`, { status });
      setMsg(`Status updated to ${status}.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    }
  }

  return (
    <div className="container">
      <h1>Transport dashboard</h1>

      <div className="card">
        <h3>Register a truck</h3>
        <form onSubmit={registerTruck}>
          <label>Registration plate</label>
          <input required value={truck.registration} onChange={(e) => setTruck({ ...truck, registration: e.target.value })} />
          <label>Truck type</label>
          <input required value={truck.truckType} onChange={(e) => setTruck({ ...truck, truckType: e.target.value })} placeholder="e.g. Flatbed" />
          <label>Capacity (tons)</label>
          <input required type="number" value={truck.capacity} onChange={(e) => setTruck({ ...truck, capacity: e.target.value })} />
          <label>Operating area / routes</label>
          <input value={truck.operatingArea} onChange={(e) => setTruck({ ...truck, operatingArea: e.target.value })} />
          <button type="submit">Register truck</button>
        </form>
      </div>

      <div className="card">
        <h3>Manage a transport job</h3>
        <label>Transport job ID</label>
        <input value={jobId} onChange={(e) => setJobId(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button onClick={() => respondToJob('ACCEPT')}>Accept job</button>
          <button className="secondary" onClick={() => respondToJob('QUOTE')}>Send quote</button>
          <button onClick={() => updateStatus('PICKUP')}>Mark picked up</button>
          <button onClick={() => updateStatus('IN_TRANSIT')}>Mark in transit</button>
          <button onClick={() => updateStatus('DELIVERED')}>Mark delivered</button>
        </div>
      </div>

      {msg && <p style={{ color: '#22532e' }}>{msg}</p>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
