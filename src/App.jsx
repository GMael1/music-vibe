import { useState, useRef, useEffect } from 'react';
import { Mic, Upload, Play, MonitorPlay, Square, Video, CheckCircle2, AlertCircle, Menu, X, Sparkles, LoaderCircle } from 'lucide-react';
import { globalMixer } from './audio/Mixer';
import { DEFAULT_EXPORT_PROFILE, globalExporter } from './audio/Exporter';
import { detectLocale, translate } from './i18n';
import LanguagePicker from './components/LanguagePicker';
import TrackItem from './components/TrackItem';
import Stage from './components/Stage';
import './App.css';

function getInitialLocale() {
  if (typeof window === 'undefined') return 'en';

  let storedLocale;
  try {
    storedLocale = window.localStorage.getItem('audioviz-language');
  } catch {
    // The app still follows the browser language when storage is unavailable.
  }

  return detectLocale(storedLocale, window.navigator.languages ?? [window.navigator.language]);
}

function App() {
  const [locale, setLocale] = useState(getInitialLocale);
  const [mode, setMode] = useState('multi'); // 'live' or 'multi'
  const [format, setFormat] = useState('horizontal'); // 'horizontal' or 'vertical'
  const [tracks, setTracks] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [liveStyle, setLiveStyle] = useState('ritualCurrent');
  const [liveTrance, setLiveTrance] = useState(0.5);
  const [liveCosmic, setLiveCosmic] = useState(0.2);
  const [isRecording, setIsRecording] = useState(false);
  const [isOfflineExporting, setIsOfflineExporting] = useState(false);
  const [offlineExportProgress, setOfflineExportProgress] = useState(0);
  const [offlineExportPhase, setOfflineExportPhase] = useState('');
  const [exportStatus, setExportStatus] = useState(null);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [isLoadingExample, setIsLoadingExample] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const fileInputRef = useRef(null);
  const stageRef = useRef(null);
  const offlineAbortRef = useRef(null);
  const offlineProgressPercentRef = useRef(-1);
  const t = (key, variables) => translate(locale, key, variables);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem('audioviz-language', locale);
    } catch {
      // Language selection remains active for this session without storage.
    }
  }, [locale]);

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

  useEffect(() => () => offlineAbortRef.current?.abort(), []);

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

  const addAudioTrack = async (name, arrayBuffer, { nameKey } = {}) => {
    globalMixer.init();
    const audioBuffer = await globalMixer.decodeAudioData(arrayBuffer);
    const visualDefaults = {
      visualStyle: 'ritualCurrent',
      sceneRole: 'auto',
      position: 'background',
      opacity: 1,
      blendMode: 'normal',
    };
    const newTrack = {
      id: `track-${crypto.randomUUID?.() ?? Date.now()}`,
      name,
      nameKey,
      ...visualDefaults,
      volume: 1.0,
      trance: 0.5,
      cosmic: 0.2,
      buffer: audioBuffer,
    };

    globalMixer.addTrack(newTrack.id, audioBuffer);
    setTracks(prev => [...prev, newTrack]);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      await addAudioTrack(file.name, await file.arrayBuffer());
    } catch (e) {
      console.error("Failed to load audio:", e);
      alert(t('app.audioLoadError'));
    }
    
    // reset input
    event.target.value = '';
  };

  const handleLoadExample = async () => {
    if (isLoadingExample || tracks.length >= 6) return;
    setIsLoadingExample(true);

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}examples/audioviz-reactivity-test.wav`);
      if (!response.ok) throw new Error(`Example audio request failed (${response.status})`);
      await addAudioTrack(t('app.exampleTrackName'), await response.arrayBuffer(), {
        nameKey: 'app.exampleTrackName',
      });
    } catch (error) {
      console.error('Failed to load example audio:', error);
      alert(t('app.exampleLoadError'));
    } finally {
      setIsLoadingExample(false);
    }
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
        alert(t('app.microphoneError'));
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
        stageRef.current.setExportResolution(
          resolution.width,
          resolution.height,
          DEFAULT_EXPORT_PROFILE.frameRate,
        );
        globalExporter.startRecording(canvas, {
          ...DEFAULT_EXPORT_PROFILE,
          onComplete: () => {
            stageRef.current?.restorePreviewResolution();
            setIsRecording(false);
            setExportStatus({ type: 'success', message: t('app.exportSuccess') });
          },
          onError: (error) => {
            stageRef.current?.restorePreviewResolution();
            setIsRecording(false);
            setExportStatus({ type: 'error', message: error.message || t('app.exportFailed') });
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
        setExportStatus({ type: 'error', message: error.message || t('app.exportFailed') });
      }
    }
  };

  const toggleOfflineExport = async () => {
    if (isOfflineExporting) {
      offlineAbortRef.current?.abort();
      return;
    }
    if (mode !== 'multi' || tracks.length === 0) return;

    const resolution = format === 'vertical'
      ? { width: 1080, height: 1920 }
      : { width: 1920, height: 1080 };
    const controller = new AbortController();
    offlineAbortRef.current = controller;
    offlineProgressPercentRef.current = -1;
    setIsOfflineExporting(true);
    setOfflineExportProgress(0);
    setOfflineExportPhase(t('app.offlinePreparing'));
    setExportStatus(null);

    if (globalMixer.isPlaying) {
      globalMixer.stopAll();
      setIsPlaying(false);
    }
    stageRef.current?.pauseRendering();

    try {
      const { globalOfflineExporter } = await import('./audio/OfflineExporter.js');
      const result = await globalOfflineExporter.export({
        tracks,
        ...resolution,
        signal: controller.signal,
        onProgress: (progress, phase) => {
          const percent = Math.round(progress * 100);
          if (percent !== offlineProgressPercentRef.current) {
            offlineProgressPercentRef.current = percent;
            setOfflineExportProgress(percent);
          }
          setOfflineExportPhase(t(`app.offlinePhase.${phase}`));
        },
      });
      setExportStatus({
        type: 'success',
        message: t('app.offlineExportSuccess', { format: result.extension.toUpperCase() }),
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        setExportStatus({ type: 'error', message: error.message || t('app.offlineExportFailed') });
      }
    } finally {
      stageRef.current?.resumeRendering();
      offlineAbortRef.current = null;
      setIsOfflineExporting(false);
      setOfflineExportProgress(0);
      setOfflineExportPhase('');
    }
  };

  const canQuickExport = tracks.length > 0 || isLiveListening;
  const canOfflineExport = mode === 'multi' && tracks.length > 0;

  return (
    <div className="app-shell text-white font-sans bg-background">
      <button
        type="button"
        aria-label={t('app.closeControls')}
        className={`mobile-drawer-backdrop ${isMobilePanelOpen ? 'is-visible' : ''}`}
        onClick={() => setIsMobilePanelOpen(false)}
      />

      {/* Sidebar / Track Manager */}
      <aside
        id="studio-controls"
        aria-label={t('app.audioVisualControls')}
        className={`studio-sidebar w-80 glass-panel m-4 flex flex-col z-50 shrink-0 shadow-[0_0_30px_rgba(0,0,0,0.5)] ${isMobilePanelOpen ? 'is-open' : ''}`}
      >
        <div className="p-6 border-b border-border flex items-center gap-3">
          <h1 className="min-w-0 flex-1 text-xl font-display font-bold text-gradient flex items-center gap-2">
            <MonitorPlay className="h-5 w-5 flex-none text-accent" />
            <span className="truncate">AudioViz Studio</span>
          </h1>
          <LanguagePicker locale={locale} onChange={setLocale} t={t} />
          <button
            type="button"
            aria-label={t('app.closeControls')}
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
              <Upload className="w-4 h-4 inline mr-2" /> {t('app.multiTrack')}
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'live' ? 'bg-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setMode('live')}
            >
              <Mic className="w-4 h-4 inline mr-2" /> {t('app.live')}
            </button>
          </div>
        </div>

        {/* Track List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {mode === 'multi' ? (
             <>
               {tracks.length === 0 ? (
                 <div className="text-center text-gray-400 mt-10">
                   <p className="text-sm">{t('app.noTracks')}</p>
                 </div>
               ) : (
                 tracks.map(track => (
                   <TrackItem
                     key={track.id}
                     track={track}
                     onRemove={removeTrack}
                     onUpdate={updateTrack}
                     t={t}
                   />
                 ))
               )}
               
               {tracks.length < 6 && (
                 <div className="grid grid-cols-2 gap-2 mt-2">
                   <button
                     className="glass-button min-h-11 w-full text-sm text-secondary border-secondary/30 hover:bg-secondary/10 hover:border-secondary"
                     onClick={handleLoadExample}
                     disabled={isLoadingExample}
                   >
                     {isLoadingExample ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                     {isLoadingExample ? t('app.loading') : t('app.loadExample')}
                   </button>
                   <button
                     className="glass-button min-h-11 w-full text-sm text-accent border-accent/30 hover:bg-accent/10 hover:border-accent border-dashed"
                     onClick={() => fileInputRef.current?.click()}
                   >
                     <Upload className="w-4 h-4" />
                     {t('app.uploadAudio')}
                   </button>
                 </div>
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
               <p className="text-sm px-4">{t('app.liveDescription')}</p>
               
               <div className="bg-surface/50 border border-border rounded-lg p-4 text-left">
                  <label className="text-xs text-gray-400 mb-1 block">{t('app.liveVisualStyle')}</label>
                  <select 
                  value={liveStyle} 
                  onChange={(e) => setLiveStyle(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-primary"
                >
                  <option value="ritualCurrent">{t('style.ritualCurrent')}</option>
                  <option value="livingMandala">{t('style.livingMandala')}</option>
                  <option value="obsidianOrganism">{t('style.obsidianOrganism')}</option>
                  <option value="psychedelic">{t('style.psychedelic')}</option>
                  <option value="chladni">{t('style.chladni')}</option>
                  <option value="serpent">{t('style.serpent')}</option>
                </select>

                <div className="mt-4">
                  <label className="text-xs text-gray-400 mb-1 flex justify-between">
                    <span>{t('track.journey')}</span>
                    <span className="text-gray-500">
                      {liveTrance < 0.45 ? t('value.meditative') : (liveTrance > 0.55 ? t('value.ecstatic') : t('value.balanced'))}
                    </span>
                  </label>
                  <input
                    type="range"
                    aria-label={t('track.liveJourneyLabel')}
                    min="0" max="1" step="0.01"
                    value={liveTrance}
                    onChange={(event) => setLiveTrance(parseFloat(event.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                    style={{ background: 'linear-gradient(to right, #30372f, #92704a, #ff5e8b)' }}
                  />
                  <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-gray-600">
                    <span>{t('value.meditative')}</span><span>{t('value.ecstatic')}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs text-gray-400 mb-1 flex justify-between">
                    <span>{t('track.world')}</span>
                    <span className="text-gray-500">
                      {liveCosmic < 0.45 ? t('value.darkEarthy') : (liveCosmic > 0.55 ? t('value.fullSpectrum') : t('value.transition'))}
                    </span>
                  </label>
                  <input
                    type="range"
                    aria-label={t('track.liveWorldLabel')}
                    min="0" max="1" step="0.01"
                    value={liveCosmic}
                    onChange={(event) => setLiveCosmic(parseFloat(event.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                    style={{ background: 'linear-gradient(to right, #070604, #5d3b16, #b16a25, #00b7a8, #7757ff, #ff3e98)' }}
                  />
                  <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-gray-600">
                    <span>{t('value.earthy')}</span><span>{t('value.cosmic')}</span>
                  </div>
                </div>
               </div>

               <button 
                 className={`glass-button w-full text-sm font-medium ${isLiveListening ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30' : 'text-secondary border-secondary/30 hover:bg-secondary/10 hover:border-secondary'}`}
                 onClick={toggleLiveListening}
               >
                 {isLiveListening ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
                 {isLiveListening ? t('app.stopListening') : t('app.startListening')}
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
                <><Square className="w-5 h-5 fill-current" /> {t('app.stopAll')}</>
              ) : (
                <><Play className="w-5 h-5 fill-current" /> {t('app.playAll')}</>
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
            <h1 className="font-display font-semibold text-base truncate">{t('app.visualStudio')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguagePicker locale={locale} onChange={setLocale} t={t} />
            <button
              type="button"
              className="mobile-controls-button"
              aria-controls="studio-controls"
              aria-expanded={isMobilePanelOpen}
              onClick={() => setIsMobilePanelOpen(true)}
            >
              <Menu className="w-5 h-5" />
              {t('app.controls')}
            </button>
          </div>
        </div>

        <div className="output-toolbar flex justify-between items-center mb-4 z-10 glass-panel !rounded-xl p-4 shadow-lg bg-surface/80">
          <div className="flex gap-4 items-center">
            <div>
              <h2 className="output-title font-display font-semibold text-xl">{t('app.masterOutput')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {format === 'horizontal' ? '1920 × 1080' : '1080 × 1920'} · 30 FPS
              </p>
            </div>
          </div>
          <div className="output-actions flex gap-3">
             <button 
                className="format-button glass-button !py-1.5 !px-4 text-sm"
                aria-label={format === 'horizontal' ? t('app.switchVertical') : t('app.switchHorizontal')}
                onClick={() => setFormat(f => f === 'horizontal' ? 'vertical' : 'horizontal')}
                disabled={isRecording || isOfflineExporting}
              >
               <span aria-hidden="true">{format === 'horizontal' ? '📱' : '💻'}</span>
               <span className="format-button-label">{format === 'horizontal' ? t('app.verticalFormat') : t('app.horizontalFormat')}</span>
             </button>
             <button 
               className={`export-button glass-button !py-1.5 !px-4 text-sm font-medium ${isRecording ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30' : 'bg-accent/10 text-accent border-accent/40 hover:bg-accent/20'}`}
               onClick={toggleRecording}
               disabled={!canQuickExport || isOfflineExporting}
               title={!canQuickExport ? t('app.exportDisabled') : t('app.quickExportHelp')}
             >
               {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Video className="w-4 h-4" />}
               {isRecording ? t('app.stopAndSave') : t('app.quickExport')}
             </button>
             <button
               className={`export-button glass-button !py-1.5 !px-4 text-sm font-medium ${isOfflineExporting ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30' : 'bg-secondary/10 text-secondary border-secondary/40 hover:bg-secondary/20'}`}
               onClick={toggleOfflineExport}
               disabled={(!canOfflineExport && !isOfflineExporting) || isRecording}
               title={mode === 'live'
                 ? t('app.offlineLiveDisabled')
                 : (isOfflineExporting ? t('app.offlineCancelHelp', { phase: offlineExportPhase }) : t('app.offlineExportHelp'))}
             >
               {isOfflineExporting
                 ? <Square className="w-4 h-4 fill-current" />
                 : <Sparkles className="w-4 h-4" />}
               {isOfflineExporting
                 ? t('app.cancelExportProgress', { progress: offlineExportProgress })
                 : t('app.highQualityExport')}
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
              
              <Stage
                ref={stageRef}
                mode={mode}
                tracks={tracks}
                format={format}
                isLiveListening={isLiveListening}
                liveStyle={liveStyle}
                liveTrance={liveTrance}
                liveCosmic={liveCosmic}
              />
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
              aria-label={isPlaying ? t('app.stopPlayback') : t('app.startPlayback')}
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
