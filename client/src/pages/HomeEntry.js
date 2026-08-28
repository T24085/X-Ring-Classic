import React from 'react';
import { useLocation } from 'react-router-dom';
import Home from './Home';
import HomeEditorial from './HomeEditorial';

const HomeEntry = () => {
  const location = useLocation();
  const showClassicHome = new URLSearchParams(location.search).get('classicHome') === '1';

  return showClassicHome ? <Home /> : <HomeEditorial />;
};

export default HomeEntry;
