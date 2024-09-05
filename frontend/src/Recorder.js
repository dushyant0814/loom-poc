import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const RecordingComponent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:3001', {
      transports: ['websocket'],
      upgrade: false
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;

      // Set the video source to the stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const response = await fetch('http://localhost:3001/start-session', { method: 'POST' });
      const { sessionId } = await response.json();
      setSessionId(sessionId);

      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          socketRef.current.emit('stream', { sessionId, chunk: event.data });
        }
      };
      mediaRecorderRef.current.start(1000); // Send data every second
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setSessionId(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Clear the video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  return (
    <div>
      <h1>Recording Component</h1>
      <video ref={videoRef} autoPlay muted style={{ width: '100%', maxWidth: '500px' }} />
      {!isRecording ? (
        <button onClick={startRecording}>Start Recording</button>
      ) : (
        <button onClick={stopRecording}>Stop Recording</button>
      )}
      {sessionId && <p>Session ID: {sessionId}</p>}
    </div>
  );
};

export default RecordingComponent;