import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  { id: 'offers', label: 'My Offers' },
  { id: 'orders', label: 'My Orders' },
  { id: 'transport', label: 'Transport' },
];

export default function BuyerDashboard() {
  const { user } = useAuth();
  const [offers, setOffers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('offers');
  const [toastMsg, setToastMsg] = useState('');
  const [transportTarget, setTransportTarget] = useState(null);
  const transportModalRef = useRef(null);

  function toast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  }

  async function loadAll() {
    const [offersRes, ordersRes] = await Promise.all([
      api.get('/offers/mine'),
      api.get('/orders'),
    ]);
    setOffers(offersRes.data.offers);
    setOrders(ordersRes.data.orders.filter((o) => o.buyerId === user.id));
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  const pendingOffers = offers.filter((o) => o.status === 'PENDING' || o.status === 'COUNTERED');
  const acceptedOffers = offers.filter((o) => o.status === 'ACCEPTED');
  const activeOrders = orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
  const totalSpend = orders.filter((o) => o.status === 'COMPLETED').reduce((sum, o) => sum + o.finalPrice, 0);

  function openTransportModal(order, method) {
    setTransportTarget({ order, method });
    transportModalRef.current.showModal();
  }

  async function submitTransport(e) {
    e.preventDefault();
    if (!transportTarget) return;
    const d = new FormData(e.target);
    const partyMap = { Buyer: 'BUYER', Seller: 'SELLER', 'Joint-agreed': 'JOINT' };
    const method = transportTarget.method === 'hire' ? 'HIRE_TRANSPORTER' : 'OWN_TRUCK';
    try {
      await api.post('/transport', {
        orderId: transportTarget.order.id,
        arrangingParty: partyMap[d.get('party')] || 'BUYER',
        method,
        pickupLocation: transportTarget.order.listing?.location || 'Farm location',
        destination: d.get('destination'),
        load: transportTarget.order.listing?.cropType || 'Produce',
        specialRequirements: d.get('requirements') || undefined,
      });
      transportModalRef.current.close();
      toast('Transport record saved.');
      loadAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not save transport record');
    }
  }

  async function confirmReceipt(orderId) {
    try {
      await api.patch(`/orders/${orderId}/confirm-receipt`);
      toast('Receipt confirmed. Order completed.');
      loadAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Could not confirm receipt');
    }
  }

  return (
    <div className="sd-dashboard">
      <section>
        <span className="sd-eyebrow">BUYER DASHBOARD</span>
        <h1>Your offers, orders and deliveries in one place.</h1>
        <p className="sd-muted" style={{ maxWidth: 780 }}>
          Track negotiations, confirm receipt of delivered produce, and arrange transport when you choose to handle it yourself.
        </p>
        <div className="sd-actions">
          <Link to="/listings"><button className="sd-btn sd-btn-primary">Browse listings</button></Link>
          <Link to="/digital"><button className="sd-btn sd-btn-outline">Browse digital</button></Link>
        </div>
        <div className="sd-stat-grid">
          <div className="sd-stat"><span>PENDING OFFERS</span><b>{pendingOffers.length}</b></div>
          <div className="sd-stat"><span>ACCEPTED OFFERS</span><b>{acceptedOffers.length}</b></div>
          <div className="sd-stat"><span>ACTIVE ORDERS</span><b>{activeOrders.length}</b></div>
          <div className="sd-stat"><span>TOTAL SPEND (ETB)</span><b>{totalSpend.toLocaleString()}</b></div>
        </div>
      </section>

      <section>
        <div className="sd-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`sd-tab ${activeTab === t.id ? 'sd-active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {activeTab === 'offers' && (
          <div>
            <div className="sd-toolbar"><div><span className="sd-eyebrow">NEGOTIATIONS</span><h2>Offers I've made</h2></div></div>
            <div className="sd-panel sd-table-wrap">
              <table className="sd-table">
                <thead><tr><th>Produce</th><th>My offer</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.id}>
                      <td>{o.listing?.cropType}</td>
                      <td>{o.amount.toLocaleString()} ETB{o.counterAmount ? ` (countered: ${o.counterAmount.toLocaleString()})` : ''}</td>
                      <td><span className={`sd-badge ${o.status === 'ACCEPTED' ? '' : o.status === 'REJECTED' ? 'sd-warn' : 'sd-blue'}`}>{o.status}</span></td>
                      <td><Link to={`/listings/${o.listingId}`}><button className="sd-btn sd-btn-outline">View listing</button></Link></td>
                    </tr>
                  ))}
                  {offers.length === 0 && <tr><td colSpan="4">No offers yet. <Link to="/listings">Browse listings</Link> to make one.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div className="sd-toolbar"><div><span className="sd-eyebrow">ORDERS</span><h2>My purchases</h2></div></div>
            <div className="sd-panel sd-table-wrap">
              <table className="sd-table">
                <thead><tr><th>Order</th><th>Produce</th><th>Seller</th><th>Value</th><th>Transport</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.id.slice(0, 8)}</td>
                      <td>{o.listing?.cropType}</td>
                      <td>{o.seller?.name || '—'}</td>
                      <td>{o.finalPrice.toLocaleString()} ETB</td>
                      <td>{o.transportJob ? `${o.transportJob.arrangingParty} — ${o.transportJob.method === 'OWN_TRUCK' ? 'Own Truck' : 'Hire Transport'}` : '—'}</td>
                      <td><span className="sd-badge sd-blue">{o.status}</span></td>
                      <td>
                        {!o.transportJob && <button className="sd-btn sd-btn-outline" onClick={() => openTransportModal(o, 'hire')}>Arrange transport</button>}
                        {o.status === 'DELIVERED' && <button className="sd-btn sd-btn-primary" style={{ marginLeft: 6 }} onClick={() => confirmReceipt(o.id)}>Confirm receipt</button>}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan="7">No orders yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'transport' && (
          <div>
            <div className="sd-toolbar"><div><span className="sd-eyebrow">TRANSPORT</span><h2>Buyer-controlled transport options</h2></div></div>
            <div className="sd-flow">
              <div className="sd-panel">
                <h3>🚛 Use My Own Truck</h3>
                <p className="sd-muted">Record your own vehicle for an order without transport arranged yet.</p>
                {orders.filter((o) => !o.transportJob).map((o) => (
                  <button key={o.id} className="sd-btn sd-btn-outline" style={{ marginTop: 8, display: 'block' }} onClick={() => openTransportModal(o, 'own')}>{o.listing?.cropType} — {o.id.slice(0, 8)}</button>
                ))}
              </div>
              <div className="sd-panel">
                <h3>🚚 Hire Transport</h3>
                <p className="sd-muted">Create a request and select a registered truck owner.</p>
                {orders.filter((o) => !o.transportJob).map((o) => (
                  <button key={o.id} className="sd-btn sd-btn-primary" style={{ marginTop: 8, display: 'block' }} onClick={() => openTransportModal(o, 'hire')}>{o.listing?.cropType} — {o.id.slice(0, 8)}</button>
                ))}
              </div>
              <div className="sd-panel">
                <h3>🤝 Seller Arranges</h3>
                <p className="sd-muted">Record that the seller will handle transportation.</p>
                {orders.filter((o) => !o.transportJob).map((o) => (
                  <button key={o.id} className="sd-btn sd-btn-outline" style={{ marginTop: 8, display: 'block' }} onClick={() => openTransportModal(o, 'seller')}>{o.listing?.cropType} — {o.id.slice(0, 8)}</button>
                ))}
              </div>
            </div>
            <div className="sd-panel" style={{ marginTop: 20 }}>
              {orders.filter((o) => o.transportJob).map((o) => (
                <div className="sd-notice" key={o.id} style={{ marginBottom: 10 }}>
                  <b>Order {o.id.slice(0, 8)}:</b> {o.transportJob.arrangingParty} arranging via {o.transportJob.method === 'OWN_TRUCK' ? 'own truck' : 'hired transporter'}. Status: {o.transportJob.status}.
                </div>
              ))}
              {orders.filter((o) => o.transportJob).length === 0 && <p>No transport records yet.</p>}
            </div>
          </div>
        )}
      </section>

      <dialog ref={transportModalRef} className="sd-dialog">
        <div className="sd-modal">
          <button className="sd-close" onClick={() => transportModalRef.current.close()}>×</button>
          <span className="sd-eyebrow">TRANSPORT</span>
          <h2>{transportTarget?.method === 'hire' ? 'Hire Transporter' : transportTarget?.method === 'own' ? 'Use My Own Truck' : 'Seller Arranges'}</h2>
          <form onSubmit={submitTransport}>
            <div className="sd-form-grid">
              <div><label>Order</label><input value={transportTarget?.order?.id?.slice(0, 8) || ''} disabled /></div>
              <div><label>Arranging party</label>
                <select name="party" defaultValue="Buyer">
                  <option>Buyer</option><option>Seller</option><option>Joint-agreed</option>
                </select>
              </div>
              <div><label>Destination</label><input name="destination" required placeholder="Your delivery destination" /></div>
              <div><label>Capacity / truck type</label><input name="capacity" placeholder="e.g. 20t flatbed" /></div>
              <div className="sd-full"><label>Access / special requirements</label><textarea name="requirements" rows="3"></textarea></div>
            </div>
            <div className="sd-modal-actions" style={{ marginTop: 20 }}>
              <button className="sd-btn sd-btn-primary">Save Transport Record</button>
            </div>
          </form>
        </div>
      </dialog>

      {toastMsg && <div className="sd-toast">{toastMsg}</div>}
    </div>
  );
}
