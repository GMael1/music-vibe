import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { VisualizerEngine } from '../visualizers/Engine';

const Stage = forwardRef(function Stage(
  { mode, tracks, format, isLiveListening, liveStyle },
  ref,
) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  useImperativeHandle(ref, () => ({
    get canvas() {
      return canvasRef.current;
    },
    setExportResolution(width, height) {
      engineRef.current?.setExportResolution(width, height);
    },
    restorePreviewResolution() {
      engineRef.current?.restorePreviewResolution();
    },
  }), []);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const engine = new VisualizerEngine(canvasRef.current);
    engineRef.current = engine;
    engine.resize();
    engine.start();

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvasRef.current.parentElement);

    return () => {
      resizeObserver.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.resize();
  }, [format]);

  useEffect(() => {
    engineRef.current?.updateTracks(tracks, mode, liveStyle);
  }, [tracks, mode, isLiveListening, liveStyle]);

  return <canvas ref={canvasRef} className="w-full h-full absolute inset-0 z-10" />;
});

export default Stage;
