import React, { useEffect, useState } from 'react';
import api from '../api/client';

const TABS = [
  { id: 'trucks', label: 'My Trucks' },
  { id: 'available', label: 'Available Jobs' },
  { id: 'jobs', label: 'My Jobs' },
];

export default function TruckOwnerDashboard() {
  const [trucks, setTrucks] = useState([]);
  const [openJobs, setOpenJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [activeTab, setActiveTab] = useState('trucks');
  const [toastMsg, setToastMsg] = useState('');
  const [truckForm, setTruckForm] = useState({ registration: '', truckType: '', capacity: '', operatingArea: '' });

  function toast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  }

  async function loadAll() {
    const [trucksRes, openRes, mineRes] = await Promise.all([
      api.get('/transport/trucks/mine'),
      api.get('/transport/open'),
      api.get('/transport/mine'),
    ]);
    setTrucks(trucksRes.data.trucks);
    setOpenJobs(openRes.data.jobs);
    setMyJobs(mineRes.data.jobs);
  }

  useEffect(() => { loadAll(); }, []);

  const activeJobs = myJobs.filter((j) => !['DELIVERED', 'CANCELLED'].includes(j.status));
  const completedJobs = myJobs.filter((j) => j.status === 'DELIVERED');

  async function registerTruck(e) {
    e.preventDefault();
    try {
      await api.post('/transport/trucks', { ...truckForm, capacity: Number(truckForm.capacity) });
      setTruckForm({ registration: '', truckType: '', capacity: '', operatingArea: '' });
      toast('Truck registered.');
      loadAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not register truck');
    }
  }

  async function setAvailability(truckId, availability) {
    try {
      await api.patch(`/transport/trucks/${truckId}/availability`, { availability });
      toast('Availability updated.');
      loadAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not update availability');
    }
  }

  async function acceptJob(jobId, action) {
    try {
      await api.patch(`/transport/${jobId}/respond`, { action });
      toast(action === 'QUOTE' ? 'Quote sent.' : 'Job accepted.');
      loadAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not respond to job');
    }
  }

  async function updateStatus(jobId, status) {
    try {
      await api.patch(`/transport/${jobId}/status`, { status });
      toast(`Status updated to ${status}.`);
      loadAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not update status');
    }
  }

  return (
    <div className="sd-dashboard">
      <section>
        <span className="sd-eyebrow">TRANSPORT DASHBOARD</span>
        <h1>Your trucks, your jobs, your routes.</h1>
        <p className="sd-muted" style={{ maxWidth: 780 }}>
          Register trucks, claim open hire requests, and move produce from pickup through delivery.
        </p>
        <div className="sd-stat-grid">
          <div className="sd-stat"><span>REGISTERED TRUCKS</span><b>{trucks.length}</b></div>
          <div className="sd-stat"><span>AVAILABLE JOBS</span><b>{openJobs.length}</b></div>
          <div className="sd-stat"><span>ACTIVE JOBS</span><b>{activeJobs.length}</b></div>
          <div className="sd-stat"><span>COMPLETED TRIPS</span><b>{completedJobs.length}</b></div>
        </div>
      </section>

      <section>
        <div className="sd-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`sd-tab ${activeTab === t.id ? 'sd-active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {activeTab === 'trucks' && (
          <div>
            <div className="sd-toolbar"><div><span className="sd-eyebrow">FLEET</span><h2>Register a truck</h2></div></div>
            <div className="sd-panel" style={{ marginBottom: 20 }}>
              <form onSubmit={registerTruck}>
                <div className="sd-form-grid">
                  <div><label>Registration plate</label><input required value={truckForm.registration} onChange={(e) => setTruckForm({ ...truckForm, registration: e.target.value })} /></div>
                  <div><label>Truck type</label><input required placeholder="e.g. Flatbed" value={truckForm.truckType} onChange={(e) => setTruckForm({ ...truckForm, truckType: e.target.value })} /></div>
                  <div><label>Capacity (tons)</label><input required type="number" value={truckForm.capacity} onChange={(e) => setTruckForm({ ...truckForm, capacity: e.target.value })} /></div>
                  <div><label>Operating area / routes</label><input value={truckForm.operatingArea} onChange={(e) => setTruckForm({ ...truckForm, operatingArea: e.target.value })} /></div>
                </div>
                <div className="sd-modal-actions" style={{ marginTop: 20 }}>
                  <button className="sd-btn sd-btn-primary">Register truck</button>
                </div>
              </form>
            </div>

            <div className="sd-toolbar"><div><span className="sd-eyebrow">FLEET</span><h2>My trucks</h2></div></div>
            <div className="sd-cards">
              {trucks.map((t) => (
                <div className="sd-card" key={t.id}>
                  <h3>{t.truckType}</h3>
                  <p className="sd-muted">{t.registration} · {t.capacity}t · {t.operatingArea || 'No area set'}</p>
                  <span className={`sd-badge ${t.availability === 'AVAILABLE' ? '' : 'sd-warn'}`}>{t.availability}</span>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="sd-btn sd-btn-outline" onClick={() => setAvailability(t.id, 'AVAILABLE')}>Available</button>
                    <button className="sd-btn sd-btn-outline" onClick={() => setAvailability(t.id, 'BUSY')}>Busy</button>
                    <button className="sd-btn sd-btn-outline" onClick={() => setAvailability(t.id, 'OFFLINE')}>Offline</button>
                  </div>
                </div>
              ))}
              {trucks.length === 0 && <p>No trucks registered yet.</p>}
            </div>
          </div>
        )}

        {activeTab === 'available' && (
          <div>
            <div className="sd-toolbar"><div><span className="sd-eyebrow">MARKETPLACE</span><h2>Open hire requests</h2></div></div>
            <div className="sd-cards">
              {openJobs.map((j) => (
                <div className="sd-card" key={j.id}>
                  <h3>{j.load}</h3>
                  <p className="sd-muted">{j.pickupLocation} → {j.destination}</p>
                  {j.requiredCapacity && <p className="sd-muted">Requires {j.requiredCapacity}t+</p>}
                  <span className="sd-badge sd-warn">{j.arrangingParty} arranging</span>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button className="sd-btn sd-btn-primary" onClick={() => acceptJob(j.id, 'ACCEPT')}>Accept</button>
                    <button className="sd-btn sd-btn-outline" onClick={() => acceptJob(j.id, 'QUOTE')}>Send quote</button>
                  </div>
                </div>
              ))}
              {openJobs.length === 0 && <p>No open hire requests right now.</p>}
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div>
            <div className="sd-toolbar"><div><span className="sd-eyebrow">MY JOBS</span><h2>Active and completed trips</h2></div></div>
            <div className="sd-panel sd-table-wrap">
              <table className="sd-table">
                <thead><tr><th>Load</th><th>Route</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {myJobs.map((j) => (
                    <tr key={j.id}>
                      <td>{j.load}</td>
                      <td>{j.pickupLocation} → {j.destination}</td>
                      <td><span className="sd-badge sd-blue">{j.status}</span></td>
                      <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {j.status === 'ACCEPTED' && <button className="sd-btn sd-btn-outline" onClick={() => updateStatus(j.id, 'PICKUP')}>Mark picked up</button>}
                        {j.status === 'PICKUP' && <button className="sd-btn sd-btn-outline" onClick={() => updateStatus(j.id, 'IN_TRANSIT')}>Mark in transit</button>}
                        {j.status === 'IN_TRANSIT' && <button className="sd-btn sd-btn-primary" onClick={() => updateStatus(j.id, 'DELIVERED')}>Mark delivered</button>}
                      </td>
                    </tr>
                  ))}
                  {myJobs.length === 0 && <tr><td colSpan="4">No jobs yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {toastMsg && <div className="sd-toast">{toastMsg}</div>}
    </div>
  );
}
