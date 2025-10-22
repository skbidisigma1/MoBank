# Song Creator Audio Components

This directory contains TypeScript source files for the Song Creator tool's audio processing functionality.

## Files

- **pitch-worklet.ts** - AudioWorklet processor for real-time pitch detection using YIN algorithm
- **song-creator-pitch.ts** - PitchDetector class that manages the AudioWorklet and provides pitch events
- **song-creator-recorder.ts** - SongRecorder class for capturing, quantizing, and playing back melodies
- **song-creator-ui.ts** - Main UI controller that wires up the pitch detector and recorder
- **audioworklet.d.ts** - TypeScript type definitions for AudioWorklet API

## Build Process

The TypeScript files are compiled to JavaScript using the TypeScript compiler.

### Build Commands

```bash
# Build once
npm run build:song-creator

# Watch for changes and rebuild automatically
npm run watch:song-creator
```

### Output

Compiled JavaScript files are generated in the same directory:
- `pitch-worklet.js`
- `song-creator-pitch.js`
- `song-creator-recorder.js`
- `song-creator-ui.js`

These compiled files are excluded from git (see `.gitignore`) and must be built before deploying.

## Development Workflow

1. Make changes to `.ts` files
2. Run `npm run build:song-creator` or use watch mode
3. Refresh the browser to see changes

## Architecture

```
song-creator.html
    ↓ loads
song-creator-ui.js (module)
    ↓ imports
    ├── song-creator-pitch.js (PitchDetector)
    │       ↓ loads worklet
    │   pitch-worklet.js (AudioWorkletProcessor)
    │
    └── song-creator-recorder.js (SongRecorder)
```

### Data Flow

1. **Microphone** → AudioContext → MediaStreamSource
2. **MediaStreamSource** → PitchWorkletNode (real-time YIN analysis)
3. **PitchWorkletNode** → MessagePort → PitchDetector events
4. **PitchDetector** → UI (visual feedback) + SongRecorder (capture)
5. **SongRecorder** → Note segmentation → Quantization → Playback
