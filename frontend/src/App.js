import React from 'react';
import { BrowserRouter as Router, Route, Link, Routes } from 'react-router-dom';
import RecordingComponent from './Recorder';
import RecordingsList from './Recordings';

const App = () => {
  return (
    <Router>
      <div className="app">
        <nav>
          <ul>
            <li><Link to="/">Record</Link></li>
            <li><Link to="/recordings">View Recordings</Link></li>
          </ul>
        </nav>

        <Routes>
          <Route path="/" element={<RecordingComponent />} />
          <Route path="/recordings" element={<RecordingsList />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;