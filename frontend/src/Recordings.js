import React, { useState, useEffect } from 'react';

const RecordingsList = () => {
  const [recordings, setRecordings] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    try {
      const response = await fetch('http://localhost:3001/recordings');
      const data = await response.json();
      setRecordings(Object.keys(data));
    } catch (error) {
      console.error('Error fetching recordings:', error);
    }
  };

  const playRecording = (sessionId) => {
    setSelectedSession(sessionId);
    setVideoUrl(`http://localhost:3001/stream/${sessionId}`);
  };

  return (
    <div className="recordings-list">
      <h2>Recordings</h2>
      <ul>
        {recordings.map(sessionId => (
          <li key={sessionId} onClick={() => playRecording(sessionId)}>
            Session: {sessionId}
          </li>
        ))}
      </ul>
      {selectedSession && (
        <div className="video-player">
          <h3>Playing Session: {selectedSession}</h3>
          <video src={videoUrl} controls autoPlay>
            Your browser does not support the video tag.
          </video>
        </div>
      )}
    </div>
  );
};

export default RecordingsList;