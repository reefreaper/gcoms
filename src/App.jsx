import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import LayoutShell from './views/LayoutShell';
import Home from './views/Home';
import About from './views/About';
import Contact from './views/Contact';
import Contracts from './views/Contracts';

function App() {
  return (
    <Router>
      <div className="min-h-screen w-full overflow-y-auto">
        <Routes>
          <Route path="/" element={<Contracts />} />
          <Route path="/home" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/dashboard" element={<LayoutShell />} />
          <Route path="/contracts" element={<LayoutShell><Contracts /></LayoutShell>} />
          <Route path="/facilities" element={<LayoutShell><div>Facilities Page</div></LayoutShell>} />
          <Route path="/calendar" element={<LayoutShell><div>Calendar Page</div></LayoutShell>} />
          <Route path="/tasks" element={<LayoutShell><div>Tasks Page</div></LayoutShell>} />
          <Route path="/referrals" element={<LayoutShell><div>Referrals Page</div></LayoutShell>} />
          <Route path="/activities" element={<LayoutShell><div>Activities Page</div></LayoutShell>} />
          <Route path="/reports" element={<LayoutShell><div>Reports Page</div></LayoutShell>} />
          <Route path="/settings" element={<LayoutShell><div>Settings Page</div></LayoutShell>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
