import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import sampleAudio from './music.mp3';

const RecordingComponent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    initializeSocket();
    getAudioDevices();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const initializeSocket = () => {
    console.log('Initializing WebSocket connection...');
    socketRef.current = io('http://localhost:3001', {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      if (reason === 'io server disconnect') {
        socketRef.current.connect();
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setErrorMessage(`Connection error: ${error.message}`);
    });

    socketRef.current.on('stream_received', (data) => {
      console.log('Server acknowledged chunk receipt:', data);
    });
  };

  const getAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      setAudioDevices(audioInputDevices);
      if (audioInputDevices.length > 0) {
        setSelectedAudioDevice(audioInputDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Error getting audio devices:', error);
      setErrorMessage('Failed to get audio devices');
    }
  };

  const startRecording = async () => {
    try {
      const constraints = {
        audio: { deviceId: selectedAudioDevice ? { exact: selectedAudioDevice } : undefined },
        video: true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const micSource = audioContextRef.current.createMediaStreamSource(stream);
      const destination = audioContextRef.current.createMediaStreamDestination();

      micSource.connect(destination);

      audioSourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      audioSourceRef.current.connect(destination);
      audioSourceRef.current.connect(audioContextRef.current.destination);

      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      const response = await fetch('http://localhost:3001/start-session', { method: 'POST' });
      const { sessionId } = await response.json();
      setSessionId(sessionId);

      mediaRecorderRef.current = new MediaRecorder(combinedStream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log(`Chunk added, size: ${event.data.size} bytes`);
          socketRef.current.emit('stream', { sessionId, chunk: event.data }, (ack) => {
            if (ack && ack.status === 'received') {
              console.log('Server acknowledged chunk receipt');
            }
          });
        }
      };
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      setErrorMessage(`Failed to start recording: ${error.message}`);
    }
  };


  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setSessionId(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      console.log('Recording stopped');
      console.log(`Total chunks recorded: ${chunksRef.current.length}`);
      
      chunksRef.current = []; // Clear the chunks
    }
  };

  const toggleAudio = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      console.log('Audio playback stopped');
    } else {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        setErrorMessage(`Failed to play audio: ${error.message}`);
      });
      setIsPlaying(true);
      console.log('Audio playback started');
    }
  };
  return (
    <div>
      <h1>Recording Component</h1>
      <video ref={videoRef} autoPlay muted style={{ width: '100%', maxWidth: '500px' }} />
      <audio ref={audioRef} src={sampleAudio} style={{ display: 'none' }} />
      
      <div>
        <label htmlFor="audioDeviceSelect">Select Audio Input: </label>
        <select
          id="audioDeviceSelect"
          value={selectedAudioDevice}
          onChange={(e) => setSelectedAudioDevice(e.target.value)}
          disabled={isRecording}
        >
          {audioDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
            </option>
          ))}
        </select>
      </div>
      
      {!isRecording ? (
        <button onClick={startRecording}>Start Recording</button>
      ) : (
        <button onClick={stopRecording}>Stop Recording</button>
      )}
      <button onClick={toggleAudio} disabled={!isRecording}>
        {isPlaying ? 'Stop Music' : 'Play Music'}
      </button>
      {sessionId && <p>Session ID: {sessionId}</p>}
      {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
    </div>
  );
};

export default RecordingComponent;