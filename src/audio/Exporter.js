import { globalMixer } from './Mixer';

export class VideoExporter {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.audioDestination = null;
    this.combinedStream = null;
    this.onComplete = null;
    this.onError = null;
  }

  startRecording(canvas, options = {}) {
    if (this.isRecording) return false;
    if (!canvas?.captureStream || typeof MediaRecorder === 'undefined') {
      throw new Error('Video recording is not supported by this browser.');
    }
    this.recordedChunks = [];
    this.onComplete = options.onComplete ?? null;
    this.onError = options.onError ?? null;

    // Capture video stream from canvas
    const canvasStream = canvas.captureStream(options.frameRate ?? 60);

    // Merge audio from the global mixer
    let audioStream;
    if (globalMixer.context) {
       // Disconnect previous if any
       if (this.audioDestination) {
           globalMixer.masterGain.disconnect(this.audioDestination);
       }
       
       this.audioDestination = globalMixer.context.createMediaStreamDestination();
       globalMixer.masterGain.connect(this.audioDestination);
       
       // If in live mode, we shouldn't route mic directly to destination usually, 
       // but for recording we need it in the destination or directly get the mic stream.
       // Actually, the live mode has `globalMixer.tracks.get('live').stream`.
       // Let's just use the destination, but ensure live mode connects to it if we want to record live.
       const liveTrack = globalMixer.tracks.get('live');
       if (liveTrack && liveTrack.source) {
          liveTrack.source.connect(this.audioDestination);
       }

       audioStream = this.audioDestination.stream;
    }

    const tracks = [...canvasStream.getVideoTracks()];
    if (audioStream) {
       tracks.push(...audioStream.getAudioTracks());
    }

    const combinedStream = new MediaStream(tracks);

    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4;codecs=avc1',
      'video/mp4',
    ];
    
    let selectedMimeType = '';
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) {
        selectedMimeType = mt;
        break;
      }
    }

    this.recordedMimeType = selectedMimeType;
    this.combinedStream = combinedStream;
    const recorderOptions = {
      videoBitsPerSecond: options.videoBitsPerSecond ?? 14_000_000,
      audioBitsPerSecond: options.audioBitsPerSecond ?? 192_000,
    };
    if (selectedMimeType) recorderOptions.mimeType = selectedMimeType;
    this.mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      if (this.recordedChunks.length > 0) this.downloadVideo();
      
      // Cleanup
      if (this.audioDestination) {
         try { globalMixer.masterGain.disconnect(this.audioDestination); } catch {}
         const liveTrack = globalMixer.tracks.get('live');
         if (liveTrack && liveTrack.source) {
             try { liveTrack.source.disconnect(this.audioDestination); } catch {}
         }
      }
      this.combinedStream?.getTracks().forEach(track => track.stop());
      this.combinedStream = null;
      this.onComplete?.({ mimeType: this.recordedMimeType });
    };

    this.mediaRecorder.onerror = (event) => {
      this.isRecording = false;
      this.onError?.(event.error ?? new Error('Recording failed.'));
    };

    this.mediaRecorder.start(100);
    this.isRecording = true;
    return true;
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  downloadVideo() {
    const extension = this.recordedMimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(this.recordedChunks, { type: this.recordedMimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style = 'display: none';
    a.href = url;
    a.download = `AudioViz_Export_${Date.now()}.${extension}`;
    a.click();
    a.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    this.recordedChunks = [];
  }
}

export const globalExporter = new VideoExporter();
