import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

const PublicHeader = () => (
  <header className="editorial-header">
    <Link to="/home" className="editorial-wordmark" aria-label="SOLIVAGANT home">
      SOLIVAGANT
    </Link>
    <nav className="editorial-nav" aria-label="Public storefront navigation">
      <Link to="/catalog">Collection</Link>
      <Link to="/bespoke">Bespoke ritual</Link>
      <Link to="/materials">Raw material archive</Link>
      <Link to="/journal">Journal</Link>
      <Link to="/track-order">Track Order</Link>
    </nav>
    <Link to="/cart" className="editorial-cart-button">
      <ShoppingBag className="h-4 w-4" />
      Cart
    </Link>
  </header>
);

export default PublicHeader;
