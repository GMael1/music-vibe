import { useEffect, useRef } from 'react';
import { VisualizerEngine } from '../visualizers/Engine';

export default function Stage({ mode, tracks, format, isLiveListening, liveStyle }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    if (!engineRef.current) {
      engineRef.current = new VisualizerEngine(canvasRef.current);
      engineRef.current.start();
    }
    
    return () => {
      // Keep running
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.resize(format);
    }
  }, [format]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateTracks(tracks, mode, liveStyle);
    }
  }, [tracks, mode, isLiveListening, liveStyle]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full absolute inset-0 z-10"
    />
  );
}
