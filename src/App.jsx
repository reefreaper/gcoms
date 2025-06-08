import './App.css'
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import LayoutShell from './views/LayoutShell';
import Home from './views/Home';
import About from './views/About';
import Contact from './views/Contact';
import Contracts from './views/Contracts';
import CreateAsset from './views/CreateAsset';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes without the layout shell */}
        <Route path="/home" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        
        {/* Routes with LayoutShell wrapper */}
        <Route path="/" element={<LayoutShell />}>
          {/* Default route */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          {/* Dashboard routes */}
          <Route path="dashboard" element={<div>Dashboard Content</div>} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="facilities" element={<div>Facilities Page</div>} />
          <Route path="calendar" element={<div>Calendar Page</div>} />
          <Route path="tasks" element={<div>Tasks Page</div>} />
          <Route path="referrals" element={<div>Referrals Page</div>} />
          <Route path="activities" element={<div>Activities Page</div>} />
          <Route path="reports" element={<div>Reports Page</div>} />
          <Route path="create-asset" element={<CreateAsset />} />
          <Route path="settings" element={<div>Settings Page</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
