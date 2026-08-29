import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="navbar">
      <Link to="/" className="brand">MarketBridge</Link>
      <div className="role-nav" style={{ display: 'flex', alignItems: 'center' }}>
        <Link to="/listings">Browse</Link>
        <Link to="/digital">Digital</Link>
        {user?.roles.includes('SELLER') && <Link to="/dashboard/seller">Seller</Link>}
        {user?.roles.includes('BUYER') && <Link to="/dashboard/buyer">Buyer</Link>}
        {user?.roles.includes('INSPECTOR') && <Link to="/dashboard/inspector">Inspector</Link>}
        {user?.roles.includes('TRUCK_OWNER') && <Link to="/dashboard/truck-owner">Transport</Link>}
        {user?.roles.includes('ADMIN') && <Link to="/dashboard/admin">Admin</Link>}
        {user ? (
          <>
            <span style={{ marginLeft: 14, fontSize: 13 }}>{user.name}</span>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); logout(); navigate('/'); }}
              style={{ marginLeft: 14 }}
            >
              Logout
            </a>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </div>
  );
}
