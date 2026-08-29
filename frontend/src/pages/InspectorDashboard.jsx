import React, { useState } from 'react';
import api from '../api/client';

export default function InspectorDashboard() {
  const [listingId, setListingId] = useState('');
  const [listing, setListing] = useState(null);
  const [requestId, setRequestId] = useState('');
  const [report, setReport] = useState({ quantity: '', grade: '', moisture: '', visibleDefects: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function lookupListing() {
    setError('');
    try {
      const res = await api.get(`/listings/${listingId}`);
      setListing(res.data.listing);
    } catch (err) {
      setError('Listing not found');
    }
  }

  async function acceptRequest(id) {
    await api.patch(`/inspections/${id}/accept`);
    setRequestId(id);
    setMsg('Request accepted — submit your report below.');
  }

  async function submitReport(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/inspections/${requestId}/report`, {
        ...report,
        quantity: Number(report.quantity),
        moisture: report.moisture ? Number(report.moisture) : undefined,
      });
      setMsg('Report submitted.');
      setRequestId('');
      setReport({ quantity: '', grade: '', moisture: '', visibleDefects: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit report');
    }
  }

  return (
    <div className="container">
      <h1>Inspector dashboard</h1>
      <p style={{ color: '#5a6357' }}>Inspectors verify quantity and quality. Transport is arranged by the buyer or seller, never by the inspector.</p>

      <div className="card">
        <h3>Look up a listing's pending inspection requests</h3>
        <label>Listing ID</label>
        <input value={listingId} onChange={(e) => setListingId(e.target.value)} />
        <button onClick={lookupListing}>Look up</button>

        {listing && (
          <div style={{ marginTop: 14 }}>
            <h4>{listing.cropType} — {listing.quantity} {listing.unit}</h4>
            {listing.inspectionRequests?.filter((r) => r.status === 'REQUESTED').map((r) => (
              <div key={r.id} style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
                <p>Mode: {r.mode}</p>
                <button onClick={() => acceptRequest(r.id)}>Accept this inspection</button>
              </div>
            ))}
            {listing.inspectionRequests?.filter((r) => r.status === 'REQUESTED').length === 0 && (
              <p>No pending requests on this listing.</p>
            )}
          </div>
        )}
      </div>

      {requestId && (
        <div className="card">
          <h3>Submit inspection report</h3>
          <form onSubmit={submitReport}>
            <label>Verified quantity</label>
            <input required type="number" value={report.quantity} onChange={(e) => setReport({ ...report, quantity: e.target.value })} />
            <label>Grade</label>
            <input value={report.grade} onChange={(e) => setReport({ ...report, grade: e.target.value })} />
            <label>Moisture (%)</label>
            <input type="number" value={report.moisture} onChange={(e) => setReport({ ...report, moisture: e.target.value })} />
            <label>Visible defects</label>
            <textarea value={report.visibleDefects} onChange={(e) => setReport({ ...report, visibleDefects: e.target.value })} />
            <button type="submit">Submit report</button>
          </form>
        </div>
      )}

      {msg && <p style={{ color: '#22532e' }}>{msg}</p>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
