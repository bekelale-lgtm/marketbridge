import React from 'react';
import { Link } from 'react-router-dom';

const pillars = [
  ['01', 'Farm-level market access', 'Expose large or perishable lots directly to buyers beyond your local market.'],
  ['02', 'Independent verification', 'Request seller, buyer or joint inspections with evidence before purchase.'],
  ['03', 'Party-controlled transport', 'The seller or buyer decides: own truck or hire a registered transporter.'],
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="container-wide hero-grid">
          <div>
            <div className="eyebrow">ETHIOPIAN AGRICULTURAL & DIGITAL MARKETPLACE</div>
            <h1>Move produce from <em>farm to market</em> with confidence.</h1>
            <p className="hero-copy">MarketBridge connects farmers, buyers, independent inspectors and transporters. Compare offers, verify quality, keep the farmer in control of price, and choose how transport is arranged.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to="/listings">Explore agricultural market →</Link>
              <Link className="btn btn-light btn-lg" to="/digital">Browse digital products</Link>
            </div>
            <div className="trust-row">
              <span>✓ Farmer price authority</span><span>✓ Quality-before-payment workflow</span><span>✓ No product ownership by MarketBridge</span>
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-card-top"><span className="live-dot"></span> MARKETPLACE WORKFLOW</div>
            <div className="flow">
              {['Farmer lists produce','Buyer discovers','Inspection & evidence','Negotiate & accept','Own truck or hire','Pickup → Delivery'].map((x,i) =>
                <div className="flow-step" key={x}><span>{String(i+1).padStart(2,'0')}</span>{x}</div>
              )}
            </div>
            <p className="small muted">MarketBridge facilitates matching, communication, records and approved marketplace services.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <div className="section-heading"><div><span className="eyebrow">WHY MARKETBRIDGE</span><h2>Built around the transaction, not around owning it.</h2></div></div>
          <div className="three-grid">{pillars.map(([n,t,d]) => <article className="feature-card" key={n}><span className="feature-no">{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container-wide split">
          <div><span className="eyebrow">AGRICULTURAL MARKETPLACE</span><h2>For potatoes, wheat, barley, vegetables, fruits and more.</h2><p>Support bulk lots, readiness dates, farm locations, offers, inspection evidence and delivery records — including time-sensitive harvest windows.</p><Link className="text-link" to="/listings">Browse produce →</Link></div>
          <div className="mini-panel"><strong>500 qtl</strong><span>Designed for large farm lots</span><hr/><strong>Own truck</strong><span>or hire through MarketBridge</span><hr/><strong>Verified evidence</strong><span>quantity, grade, photos and more</span></div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide split reverse-mobile">
          <div className="mini-panel digital-panel"><strong>eBooks</strong><span>Templates · Graphics · Photos</span><hr/><strong>Courses</strong><span>Documents · Software licenses</span><hr/><strong>Seller-owned</strong><span>Independent digital sellers retain ownership</span></div>
          <div><span className="eyebrow">DIGITAL MARKETPLACE</span><h2>Sell and discover useful digital products.</h2><p>MarketBridge also facilitates digital products while independent sellers retain ownership and supply their own products.</p><Link className="text-link" to="/digital">Explore digital marketplace →</Link></div>
        </div>
      </section>
    </main>
  );
}
