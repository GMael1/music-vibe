# AudioViz Studio

AudioViz Studio is a local-first browser performance tool for creating modern, sound-reactive visuals from synchronized audio tracks or a live microphone. It runs entirely in the browser and can export portrait or landscape 1080p video for social publishing.

## Features

- Up to six synchronized audio tracks, all starting at zero
- Live microphone visualization without routing the mic to the speakers
- Living Mandala, Fluid Field, and Resonance Plate visual systems
- Per-track volume, Flow, Light, and Colour art direction, plus scene role, opacity, position, and blend controls
- Whole-track spectral profiling plus adaptive live musical analysis
- Deterministic frequency-mapped Resonance Plate modes with track-relative dB response
- Smoothed multi-band analysis with pitch, timbre, beat, and onset detection
- Quick real-time export plus deterministic high-quality WebCodecs export at 1920×1080 or 1080×1920 and 30 FPS
- Local processing with no uploads or account required

## Development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test
npm run lint
npm run build
```

The GitHub Pages build is deployed from `main` under `/music-vibe/`.
