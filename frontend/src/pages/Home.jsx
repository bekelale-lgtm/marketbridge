// frontend/src/pages/Home.jsx

import React from 'react';
import { Link } from 'react-router-dom';

const agriculturalCategories = [
  {
    title: 'Farm Produce',
    description:
      'Farmers and agricultural sellers can list available produce directly for buyers.',
    items: ['Potatoes', 'Wheat', 'Barley', 'Onion', 'Vegetables', 'Fruits'],
    link: '/listings',
  },
  {
    title: 'Farmers & Sellers',
    description:
      'Independent farmers, agricultural producers and sellers can reach buyers beyond their local markets.',
    items: ['Farmers', 'Producer groups', 'Agricultural sellers', 'Bulk suppliers'],
    link: '/listings',
  },
  {
    title: 'Investors & Agricultural Sellers',
    description:
      'Connect agricultural investors and commercial sellers with buyers and market opportunities.',
    items: ['Investors', 'Commercial farms', 'Agribusiness sellers', 'Bulk lots'],
    link: '/listings',
  },
];

const marketplaceCategories = [
  {
    number: '01',
    title: 'Agricultural Products',
    description:
      'The core MarketBridge marketplace for farm produce, agricultural sellers and buyers.',
    link: '/listings',
  },
  {
    number: '02',
    title: 'Other Goods',
    description:
      'A wider marketplace for useful physical goods and services connected to everyday and agricultural needs.',
    link: '/marketplace',
  },
  {
    number: '03',
    title: 'Digital Products',
    description:
      'Independent sellers can offer eBooks, courses, documents, graphics and other digital products.',
    link: '/digital',
  },
];

const workflow = [
  ['01', 'Seller lists', 'A farmer or seller publishes the product, quantity, location and availability.'],
  ['02', 'Buyer discovers', 'Buyers search agricultural products and other marketplace goods.'],
  ['03', 'Inspect & verify', 'Independent inspection and evidence can be requested before purchase.'],
  ['04', 'Offer & negotiate', 'Buyers submit offers while the seller remains the price authority.'],
  ['05', 'Arrange transport', 'The buyer or seller chooses an own truck or hires a registered transporter.'],
  ['06', 'Pickup → delivery', 'Transport status is tracked through pickup, transit and delivery.'],
];

export default function Home() {
  return (
    <main>

      {/* ============================================================
          HERO
      ============================================================ */}

      <section className="hero">
        <div className="container-wide hero-grid">

          <div>
            <div className="eyebrow">
              MARKETBRIDGE — ETHIOPIAN MARKETPLACE PLATFORM
            </div>

            <h1>
              Connecting the
              <em> farm</em> to the
              <em> market.</em>
            </h1>

            <p className="hero-copy">
              MarketBridge is a multi-vendor marketplace designed around
              agricultural producers, farmers, buyers, inspectors,
              transporters, investors and independent sellers.
            </p>

            <p className="hero-copy">
              Our primary focus is helping farmers and agricultural sellers
              find suitable buyers, negotiate confidently, verify products
              and arrange delivery without MarketBridge taking ownership
              of the products.
            </p>

            <div className="hero-actions">

              <Link
                className="btn btn-primary btn-lg"
                to="/listings"
              >
                Explore agricultural market →
              </Link>

              <Link
                className="btn btn-light btn-lg"
                to="/digital"
              >
                Browse digital products
              </Link>

            </div>

            <div className="trust-row">
              <span>✓ Farmer price authority</span>
              <span>✓ Independent inspection</span>
              <span>✓ Buyer/seller-controlled transport</span>
              <span>✓ Seller-owned products</span>
            </div>
          </div>


          {/* PLATFORM STRUCTURE CARD */}

          <div className="hero-card">

            <div className="hero-card-top">
              <span className="live-dot"></span>
              MARKETBRIDGE PLATFORM
            </div>

            <div className="flow">

              <div className="flow-step">
                <span>01</span>
                Agricultural producers
              </div>

              <div className="flow-step">
                <span>02</span>
                Farmers / sellers
              </div>

              <div className="flow-step">
                <span>03</span>
                Buyers & investors
              </div>

              <div className="flow-step">
                <span>04</span>
                Inspect & negotiate
              </div>

              <div className="flow-step">
                <span>05</span>
                Transport
              </div>

              <div className="flow-step">
                <span>06</span>
                Delivery & completion
              </div>

            </div>

            <p className="small muted">
              MarketBridge facilitates marketplace connections,
              communication, inspection workflows, offers, records
              and approved marketplace services.
            </p>

          </div>

        </div>
      </section>


      {/* ============================================================
          MARKETPLACE STRUCTURE
      ============================================================ */}

      <section className="section">

        <div className="container-wide">

          <div className="section-heading">

            <div>
              <span className="eyebrow">
                GENERAL PLATFORM STRUCTURE
              </span>

              <h2>
                One marketplace, with agriculture at its center.
              </h2>
            </div>

          </div>


          <div className="three-grid">

            {marketplaceCategories.map((category) => (

              <article
                className="feature-card"
                key={category.number}
              >

                <span className="feature-no">
                  {category.number}
                </span>

                <h3>
                  {category.title}
                </h3>

                <p>
                  {category.description}
                </p>

                <Link
                  className="text-link"
                  to={category.link}
                >
                  Explore →
                </Link>

              </article>

            ))}

          </div>

        </div>

      </section>


      {/* ============================================================
          AGRICULTURAL PRODUCERS
      ============================================================ */}

      <section className="section section-alt">

        <div className="container-wide">

          <div className="section-heading">

            <div>
              <span className="eyebrow">
                AGRICULTURAL PRODUCERS
              </span>

              <h2>
                Built first around farmers and agricultural sellers.
              </h2>

              <p>
                MarketBridge gives agricultural producers a structured
                way to present their products, reach buyers and manage
                transactions from listing through delivery.
              </p>
            </div>

          </div>


          <div className="three-grid">

            {agriculturalCategories.map((category) => (

              <article
                className="feature-card"
                key={category.title}
              >

                <h3>
                  {category.title}
                </h3>

                <p>
                  {category.description}
                </p>

                <ul className="category-list">

                  {category.items.map((item) => (
                    <li key={item}>
                      ✓ {item}
                    </li>
                  ))}

                </ul>

                <Link
                  className="text-link"
                  to={category.link}
                >
                  Explore agricultural market →
                </Link>

              </article>

            ))}

          </div>

        </div>

      </section>


      {/* ============================================================
          AGRICULTURAL MARKET FOCUS
      ============================================================ */}

      <section className="section">

        <div className="container-wide split">

          <div>

            <span className="eyebrow">
              AGRICULTURAL MARKET FOCUS
            </span>

            <h2>
              Help farmers find suitable buyers before
              perishable produce loses value.
            </h2>

            <p>
              Agricultural products can be time-sensitive. MarketBridge
              is designed to make the process from farm listing to buyer,
              inspection, negotiation, transport and delivery more
              organized.
            </p>

            <p>
              Sellers retain ownership and control of their products.
              MarketBridge facilitates the marketplace rather than
              purchasing or owning the produce.
            </p>

            <Link
              className="text-link"
              to="/listings"
            >
              Browse agricultural listings →
            </Link>

          </div>


          <div className="mini-panel">

            <strong>
              Farm → Buyer
            </strong>

            <span>
              Direct marketplace connection
            </span>

            <hr />

            <strong>
              Quality evidence
            </strong>

            <span>
              Quantity, grade, photos and inspection records
            </span>

            <hr />

            <strong>
              Seller price authority
            </strong>

            <span>
              Buyers make offers; sellers decide what to accept
            </span>

            <hr />

            <strong>
              Transport choice
            </strong>

            <span>
              Own truck or hire a registered transporter
            </span>

          </div>

        </div>

      </section>


      {/* ============================================================
          OTHER GOODS
      ============================================================ */}

      <section className="section section-alt">

        <div className="container-wide split">

          <div>

            <span className="eyebrow">
              OTHER GOODS
            </span>

            <h2>
              More than agricultural produce.
            </h2>

            <p>
              The general MarketBridge marketplace can also accommodate
              other useful physical goods and services outside the
              agricultural produce marketplace.
            </p>

            <p>
              Examples include electronics, houses and property-related
              listings, farm equipment, machines and other products
              relevant to buyers and sellers.
            </p>

            <Link
              className="text-link"
              to="/marketplace"
            >
              Explore general marketplace →
            </Link>

          </div>


          <div className="mini-panel">

            <strong>
              Electronics
            </strong>

            <span>
              Devices and useful electronic goods
            </span>

            <hr />

            <strong>
              Houses & property
            </strong>

            <span>
              Property listings and related opportunities
            </span>

            <hr />

            <strong>
              Farm equipment
            </strong>

            <span>
              Agricultural tools and equipment
            </span>

            <hr />

            <strong>
              Machines & other goods
            </strong>

            <span>
              Machinery, pest-related products and other marketplace goods
            </span>

          </div>

        </div>

      </section>


      {/* ============================================================
          DIGITAL MARKETPLACE
      ============================================================ */}

      <section className="section">

        <div className="container-wide split reverse-mobile">

          <div className="mini-panel digital-panel">

            <strong>
              eBooks
            </strong>

            <span>
              Guides, books and useful digital publications
            </span>

            <hr />

            <strong>
              Courses
            </strong>

            <span>
              Learning materials and educational products
            </span>

            <hr />

            <strong>
              Documents & templates
            </strong>

            <span>
              Business, agricultural and professional resources
            </span>

            <hr />

            <strong>
              Graphics & digital files
            </strong>

            <span>
              Independent digital products from sellers
            </span>

          </div>


          <div>

            <span className="eyebrow">
              DIGITAL MARKETPLACE
            </span>

            <h2>
              Sell and discover useful digital products.
            </h2>

            <p>
              MarketBridge also supports independent digital sellers.
              Sellers retain ownership of their digital products and
              supply them through the marketplace.
            </p>

            <Link
              className="text-link"
              to="/digital"
            >
              Explore digital marketplace →
            </Link>

          </div>

        </div>

      </section>


      {/* ============================================================
          TRANSACTION WORKFLOW
      ============================================================ */}

      <section className="section section-alt">

        <div className="container-wide">

          <div className="section-heading">

            <div>
              <span className="eyebrow">
                HOW MARKETBRIDGE WORKS
              </span>

              <h2>
                From listing to completed delivery.
              </h2>

              <p>
                The platform is organized around the actual transaction,
                while keeping the buyer, seller and service providers
                in control of their respective decisions.
              </p>
            </div>

          </div>


          <div className="three-grid">

            {workflow.map(([number, title, description]) => (

              <article
                className="feature-card"
                key={number}
              >

                <span className="feature-no">
                  {number}
                </span>

                <h3>
                  {title}
                </h3>

                <p>
                  {description}
                </p>

              </article>

            ))}

          </div>

        </div>

      </section>


      {/* ============================================================
          TRANSPORT PRINCIPLE
      ============================================================ */}

      <section className="section">

        <div className="container-wide split">

          <div>

            <span className="eyebrow">
              TRANSPORT
            </span>

            <h2>
              Transport is controlled by the transaction parties.
            </h2>

            <p>
              Buyers and sellers can arrange transportation according
              to their transaction. They can use their own truck or
              hire a registered transporter through MarketBridge.
            </p>

            <p>
              MarketBridge does not automatically assign a truck to a
              seller. When transport is hired, registered truck owners
              can respond to open transport requests and accept jobs.
            </p>

          </div>


          <div className="mini-panel">

            <strong>
              OWN TRUCK
            </strong>

            <span>
              Buyer or seller uses a truck they own
            </span>

            <hr />

            <strong>
              HIRE TRANSPORTER
            </strong>

            <span>
              Buyer or seller requests a registered transporter
            </span>

            <hr />

            <strong>
              TRANSPORT TRACKING
            </strong>

            <span>
              Requested → Accepted → Pickup → In Transit → Delivered
            </span>

          </div>

        </div>

      </section>


      {/* ============================================================
          FINAL CTA
      ============================================================ */}

      <section className="section section-alt">

        <div className="container-wide">

          <div className="section-heading">

            <div>

              <span className="eyebrow">
                MARKETBRIDGE
              </span>

              <h2>
                Start with agriculture. Grow into a complete marketplace.
              </h2>

              <p>
                Whether you are a farmer, buyer, seller, investor,
                inspector, transporter or digital-product seller,
                MarketBridge is designed to connect the right parties
                around real transactions.
              </p>

            </div>

          </div>


          <div className="hero-actions">

            <Link
              className="btn btn-primary btn-lg"
              to="/listings"
            >
              Explore agricultural market →
            </Link>

            <Link
              className="btn btn-light btn-lg"
              to="/marketplace"
            >
              Explore marketplace
            </Link>

            <Link
              className="btn btn-light btn-lg"
              to="/digital"
            >
              Digital products
            </Link>

          </div>

        </div>

      </section>

    </main>
  );
}
