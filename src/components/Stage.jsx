import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { VisualizerEngine } from '../visualizers/Engine';

const Stage = forwardRef(function Stage(
  { mode, tracks, format, isLiveListening, liveStyle, liveFlow, liveLight, liveColor },
  ref,
) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  useImperativeHandle(ref, () => ({
    get canvas() {
      return canvasRef.current;
    },
    setExportResolution(width, height, frameRate) {
      engineRef.current?.setExportResolution(width, height, frameRate);
    },
    restorePreviewResolution() {
      engineRef.current?.restorePreviewResolution();
    },
    pauseRendering() {
      engineRef.current?.stop();
    },
    resumeRendering() {
      engineRef.current?.start();
    },
  }), []);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const engine = new VisualizerEngine(canvasRef.current);
    engineRef.current = engine;
    engine.resize();
    engine.start();

    const renderGameToText = () => JSON.stringify(engine.getDebugState());
    const advanceTime = milliseconds => engine.advanceTime(milliseconds);
    window.render_game_to_text = renderGameToText;
    window.advanceTime = advanceTime;

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvasRef.current.parentElement);

    return () => {
      resizeObserver.disconnect();
      engine.dispose();
      engineRef.current = null;
      if (window.render_game_to_text === renderGameToText) delete window.render_game_to_text;
      if (window.advanceTime === advanceTime) delete window.advanceTime;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.resize();
  }, [format]);

  useEffect(() => {
    engineRef.current?.updateTracks(tracks, mode, liveStyle, {
      flow: liveFlow,
      light: liveLight,
      color: liveColor,
    });
  }, [tracks, mode, isLiveListening, liveStyle, liveFlow, liveLight, liveColor]);

  return <canvas ref={canvasRef} className="w-full h-full absolute inset-0 z-10" />;
});

export default Stage;
