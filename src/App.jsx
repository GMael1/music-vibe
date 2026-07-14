import { useState, useRef, useEffect } from 'react';
import { Mic, Upload, Play, MonitorPlay, Square, Video, CheckCircle2, AlertCircle, Menu, X } from 'lucide-react';
import { globalMixer } from './audio/Mixer';
import { globalExporter } from './audio/Exporter';
import TrackItem from './components/TrackItem';
import Stage from './components/Stage';
import './App.css';

function App() {
  const [mode, setMode] = useState('multi'); // 'live' or 'multi'
  const [format, setFormat] = useState('horizontal'); // 'horizontal' or 'vertical'
  const [tracks, setTracks] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [liveStyle, setLiveStyle] = useState('serpent');
  const [isRecording, setIsRecording] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const fileInputRef = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    setDuration(globalMixer.getDuration());
  }, [tracks]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    let raf;
    const updateTime = () => {
      setCurrentTime(globalMixer.getCurrentTime());
      raf = requestAnimationFrame(updateTime);
    };
    raf = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  useEffect(() => globalMixer.subscribe(event => {
    if (event.type === 'ended') {
      setIsPlaying(false);
      setCurrentTime(event.currentTime);
      if (globalExporter.isRecording) globalExporter.stopRecording();
    }
  }), []);

  useEffect(() => {
    if (!isMobilePanelOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMobilePanelOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobilePanelOpen]);

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    globalMixer.seek(time);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Stop everything when switching modes
  useEffect(() => {
    if (mode === 'live') {
      if (globalMixer.isPlaying) {
        globalMixer.stopAll();
        setIsPlaying(false);
      }
    } else if (globalMixer.tracks.has('live')) {
      globalMixer.stopLiveMode();
      setIsLiveListening(false);
    }
  }, [mode]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    globalMixer.init();
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await globalMixer.decodeAudioData(arrayBuffer);
      
      const visualDefaults = {
        visualStyle: 'serpent',
        sceneRole: 'auto',
        position: 'background',
        opacity: 1,
        blendMode: 'normal',
      };
      const newTrack = {
        id: `track-${crypto.randomUUID?.() ?? Date.now()}`,
        name: file.name,
        ...visualDefaults,
        volume: 1.0,
        reactivity: 1.0,
        hue: 0.0,
        buffer: audioBuffer,
      };
      
      globalMixer.addTrack(newTrack.id, audioBuffer);
      setTracks(prev => [...prev, newTrack]);
    } catch (e) {
      console.error("Failed to load audio:", e);
      alert("Failed to load audio file.");
    }
    
    // reset input
    event.target.value = '';
  };

  const removeTrack = (id) => {
    globalMixer.removeTrack(id);
    setTracks(prev => prev.filter(t => t.id !== id));
    if (globalMixer.getDuration() === 0) {
      globalMixer.stopAll();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const updateTrack = (id, updates) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    if (updates.volume !== undefined) {
      globalMixer.setTrackVolume(id, updates.volume);
    }
  };

  const togglePlayback = () => {
    if (isPlaying) {
      globalMixer.stopAll();
      setIsPlaying(false);
    } else {
      globalMixer.playAll();
      setIsPlaying(true);
    }
  };

  const toggleLiveListening = async () => {
    if (isLiveListening) {
      globalMixer.stopLiveMode();
      setIsLiveListening(false);
    } else {
      const success = await globalMixer.startLiveMode();
      if (success) {
        setIsLiveListening(true);
      } else {
        alert("Microphone access denied or failed.");
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      globalExporter.stopRecording();
      setIsRecording(false);
    } else {
      const canvas = stageRef.current?.canvas;
      if (!canvas) return;

      const resolution = format === 'vertical'
        ? { width: 1080, height: 1920 }
        : { width: 1920, height: 1080 };

      try {
        setExportStatus(null);
        stageRef.current.setExportResolution(resolution.width, resolution.height);
        globalExporter.startRecording(canvas, {
          frameRate: 60,
          videoBitsPerSecond: 14_000_000,
          onComplete: () => {
            stageRef.current?.restorePreviewResolution();
            setIsRecording(false);
            setExportStatus({ type: 'success', message: '1080p video exported' });
          },
          onError: (error) => {
            stageRef.current?.restorePreviewResolution();
            setIsRecording(false);
            setExportStatus({ type: 'error', message: error.message || 'Export failed' });
          },
        });
        setIsRecording(true);

        if (mode === 'multi') {
          globalMixer.seek(0);
          globalMixer.playAll();
          setCurrentTime(0);
          setIsPlaying(true);
        }
      } catch (error) {
        stageRef.current?.restorePreviewResolution();
        setExportStatus({ type: 'error', message: error.message || 'Export failed' });
      }
    }
  };

  const canExport = tracks.length > 0 || isLiveListening;

  return (
    <div className="app-shell text-white font-sans bg-background">
      <button
        type="button"
        aria-label="Close controls"
        className={`mobile-drawer-backdrop ${isMobilePanelOpen ? 'is-visible' : ''}`}
        onClick={() => setIsMobilePanelOpen(false)}
      />

      {/* Sidebar / Track Manager */}
      <aside
        id="studio-controls"
        aria-label="Audio and visual controls"
        className={`studio-sidebar w-80 glass-panel m-4 flex flex-col z-50 shrink-0 shadow-[0_0_30px_rgba(0,0,0,0.5)] ${isMobilePanelOpen ? 'is-open' : ''}`}
      >
        <div className="p-6 border-b border-border flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold text-gradient flex items-center gap-2">
            <MonitorPlay className="text-accent" />
            AudioViz Studio
          </h1>
          <button
            type="button"
            aria-label="Close controls"
            className="mobile-close-button ml-auto text-gray-300 hover:text-white"
            onClick={() => setIsMobilePanelOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Mode Switcher */}
        <div className="p-4 border-b border-border">
          <div className="flex bg-surface rounded-lg p-1">
            <button 
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'multi' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setMode('multi')}
            >
              <Upload className="w-4 h-4 inline mr-2" /> Multi-Track
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'live' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setMode('live')}
            >
              <Mic className="w-4 h-4 inline mr-2" /> Live
            </button>
          </div>
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {mode === 'multi' ? (
             <>
               {tracks.length === 0 ? (
                 <div className="text-center text-gray-400 mt-10">
                   <p className="text-sm">No tracks added yet.</p>
                 </div>
               ) : (
                 tracks.map(t => (
                   <TrackItem 
                     key={t.id} 
                     track={t} 
                     onRemove={removeTrack} 
                     onUpdate={updateTrack} 
                   />
                 ))
               )}
               
               {tracks.length < 6 && (
                 <button 
                   className="glass-button w-full mt-2 text-sm text-accent border-accent/30 hover:bg-accent/10 hover:border-accent border-dashed"
                   onClick={() => fileInputRef.current?.click()}
                 >
                   + Add Audio Track
                 </button>
               )}
               <input 
                 type="file" 
                 accept="audio/*" 
                 ref={fileInputRef} 
                 onChange={handleFileUpload} 
                 className="hidden" 
               />
             </>
          ) : (
             <div className="text-center text-gray-400 mt-10 space-y-4">
               <p className="text-sm px-4">Visualize your microphone input in real-time. Make sure your speakers won't cause feedback loops!</p>
               
               <div className="bg-surface/50 border border-border rounded-lg p-4 text-left">
                  <label className="text-xs text-gray-400 mb-1 block">Live Visual Style</label>
                  <select 
                  value={liveStyle} 
                  onChange={(e) => setLiveStyle(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-primary"
                >
                  <option value="psychedelic">Fluid Field</option>
                  <option value="chladni">Resonance Plate</option>
                  <option value="serpent">Jungle Serpent</option>
                </select>
               </div>

               <button 
                 className={`glass-button w-full text-sm font-medium ${isLiveListening ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30' : 'text-secondary border-secondary/30 hover:bg-secondary/10 hover:border-secondary'}`}
                 onClick={toggleLiveListening}
               >
                 {isLiveListening ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
                 {isLiveListening ? 'Stop Listening' : 'Start Listening'}
               </button>
             </div>
          )}
        </div>

        {/* Global Controls */}
        {mode === 'multi' && tracks.length > 0 && (
          <div className="p-4 border-t border-border bg-surface/50 backdrop-blur-md">
            <button 
              className={`glass-button w-full py-3 font-semibold text-lg ${isPlaying ? 'bg-red-500 hover:bg-red-600 text-white border-transparent' : 'bg-primary hover:bg-primary/90 text-white border-transparent'}`}
              onClick={togglePlayback}
            >
              {isPlaying ? (
                <><Square className="w-5 h-5 fill-current" /> Stop All</>
              ) : (
                <><Play className="w-5 h-5 fill-current" /> Play All in Sync</>
              )}
            </button>
          </div>
        )}
      </aside>

      {/* Main Stage */}
      <main className="studio-main flex-1 p-4 pl-0 flex flex-col relative overflow-hidden min-w-0 min-h-0">
        <div className="mobile-app-header">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">AudioViz</p>
            <h1 className="font-display font-semibold text-base truncate">Visual Studio</h1>
          </div>
          <button
            type="button"
            className="mobile-controls-button"
            aria-controls="studio-controls"
            aria-expanded={isMobilePanelOpen}
            onClick={() => setIsMobilePanelOpen(true)}
          >
            <Menu className="w-5 h-5" />
            Controls
          </button>
        </div>

        <div className="output-toolbar flex justify-between items-center mb-4 z-10 glass-panel !rounded-xl p-4 shadow-lg bg-surface/80">
          <div className="flex gap-4 items-center">
            <div>
              <h2 className="output-title font-display font-semibold text-xl">Master Output</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {format === 'horizontal' ? '1920 × 1080' : '1080 × 1920'} · 60 FPS
              </p>
            </div>
          </div>
          <div className="output-actions flex gap-3">
             <button 
                className="format-button glass-button !py-1.5 !px-4 text-sm"
                aria-label={format === 'horizontal' ? 'Switch to vertical format' : 'Switch to horizontal format'}
                onClick={() => setFormat(f => f === 'horizontal' ? 'vertical' : 'horizontal')}
              >
               <span aria-hidden="true">{format === 'horizontal' ? '📱' : '💻'}</span>
               <span className="format-button-label">{format === 'horizontal' ? 'Vertical Format' : 'Horizontal Format'}</span>
             </button>
             <button 
               className={`export-button glass-button !py-1.5 !px-4 text-sm font-medium ${isRecording ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30' : 'bg-accent/10 text-accent border-accent/40 hover:bg-accent/20'}`}
               onClick={toggleRecording}
               disabled={!canExport}
               title={!canExport ? 'Add a track or start live listening before exporting' : undefined}
             >
               {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Video className="w-4 h-4" />}
               {isRecording ? 'Stop & Save' : 'Export 1080p'}
             </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="canvas-panel flex-1 min-h-0 glass-panel flex items-center justify-center p-8 relative overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]">
           <div 
             className={`stage-frame bg-[#050505] border border-white/5 shadow-2xl flex items-center justify-center transition-all duration-500 ease-out relative overflow-hidden ${format === 'horizontal' ? 'stage-horizontal' : 'stage-vertical'}`}
           >
              {/* Background gradient hint */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
              
              <Stage ref={stageRef} mode={mode} tracks={tracks} format={format} isLiveListening={isLiveListening} liveStyle={liveStyle} />
           </div>
        </div>

        {exportStatus && (
          <div className={`absolute right-8 top-24 z-30 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur-xl ${exportStatus.type === 'success' ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200' : 'border-red-400/30 bg-red-500/15 text-red-200'}`}>
            {exportStatus.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {exportStatus.message}
          </div>
        )}

        {/* Player Bar */}
        {mode === 'multi' && duration > 0 && (
          <div className="player-bar shrink-0 mt-4 p-4 glass-panel !rounded-xl flex items-center gap-4 z-10 shadow-lg bg-surface/80">
            <button 
              aria-label={isPlaying ? 'Stop playback' : 'Start playback'}
              className={`player-button p-2 rounded-full ${isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'} transition-colors`}
              onClick={togglePlayback}
            >
              {isPlaying ? <Square className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
            <div className="text-xs font-mono text-gray-400 w-12 text-right">
              {formatTime(currentTime)}
            </div>
            <input 
              type="range" 
              min="0" 
              max={duration} 
              step="0.01" 
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 accent-primary h-1.5 bg-black/50 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-xs font-mono text-gray-400 w-12">
              {formatTime(duration)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
