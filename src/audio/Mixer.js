export class Mixer {
  constructor() {
    // We defer context creation until user interaction to comply with browser policies
    this.context = null;
    this.masterGain = null;
    
    // Store tracks: id -> { source, gain, analyser, buffer }
    this.tracks = new Map();
    this.isPlaying = false;
    this.startTime = 0;
    this.pausedAt = 0;
    this.liveStream = null;
  }

  init() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  async decodeAudioData(arrayBuffer) {
    this.init();
    return await this.context.decodeAudioData(arrayBuffer);
  }

  // Add a track to the mixer
  addTrack(id, audioBuffer) {
    this.init();
    const gainNode = this.context.createGain();
    const analyserNode = this.context.createAnalyser();
    
    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0.8;
    
    gainNode.connect(this.masterGain);
    analyserNode.connect(gainNode);

    this.tracks.set(id, {
      buffer: audioBuffer,
      gain: gainNode,
      analyser: analyserNode,
      source: null
    });
    
    // Reset pause time if it's the first track
    if (this.tracks.size === 1) {
       this.pausedAt = 0;
    }
  }

  removeTrack(id) {
    const track = this.tracks.get(id);
    if (track) {
      if (track.source) {
        try { track.source.stop(); } catch (e) {}
        track.source.disconnect();
      }
      track.analyser.disconnect();
      track.gain.disconnect();
      this.tracks.delete(id);
    }
  }

  setTrackVolume(id, volume) {
    const track = this.tracks.get(id);
    if (track) {
      track.gain.gain.value = volume;
    }
  }

  playAll() {
    this.init();
    if (this.isPlaying) return;

    this.startTime = this.context.currentTime;

    this.tracks.forEach(track => {
      if (track.buffer) {
        const source = this.context.createBufferSource();
        source.buffer = track.buffer;
        source.connect(track.analyser);
        
        const offset = Math.min(this.pausedAt, track.buffer.duration);
        source.start(0, offset);
        track.source = source;
      }
    });
    this.isPlaying = true;
  }

  stopAll() {
    if (!this.isPlaying) return;
    this.pausedAt += (this.context.currentTime - this.startTime);
    this.tracks.forEach(track => {
      if (track.source) {
        try { track.source.stop(); } catch (e) {}
        track.source.disconnect();
        track.source = null;
      }
    });
    this.isPlaying = false;
  }

  getDuration() {
    let maxDur = 0;
    this.tracks.forEach(t => {
       if (t.buffer && t.buffer.duration > maxDur) maxDur = t.buffer.duration;
    });
    return maxDur;
  }

  getCurrentTime() {
    if (!this.isPlaying) return this.pausedAt;
    return this.pausedAt + (this.context.currentTime - this.startTime);
  }

  seek(time) {
    const wasPlaying = this.isPlaying;
    if (this.isPlaying) {
       this.stopAll();
    }
    this.pausedAt = Math.max(0, Math.min(time, this.getDuration()));
    if (wasPlaying) {
       this.playAll();
    }
  }

  // Get frequency data for a specific track (0-255 array)
  getTrackFrequencyData(id, dataArray) {
    const track = this.tracks.get(id);
    if (track && track.analyser) {
      track.analyser.getByteFrequencyData(dataArray);
    }
  }

  // LIVE MODE
  async startLiveMode() {
    this.init();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.liveStream = stream;
      
      const source = this.context.createMediaStreamSource(stream);
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      // Do NOT connect live mic to masterGain/destination to avoid feedback!
      
      this.tracks.set('live', {
        analyser,
        source,
        stream
      });
      return true;
    } catch (err) {
      console.error("Error accessing microphone:", err);
      return false;
    }
  }

  stopLiveMode() {
    const live = this.tracks.get('live');
    if (live) {
      live.source.disconnect();
      live.analyser.disconnect();
      live.stream.getTracks().forEach(t => t.stop());
      this.tracks.delete('live');
    }
  }
}

// Export a singleton instance
export const globalMixer = new Mixer();
