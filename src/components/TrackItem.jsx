import { Trash2 } from 'lucide-react';

export default function TrackItem({ track, onRemove, onUpdate }) {
  return (
    <div className="bg-surface/50 border border-border rounded-lg p-3 backdrop-blur-sm transition-all hover:bg-surface">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-sm truncate flex-1" title={track.name}>{track.name}</span>
        <button aria-label={`Remove ${track.name}`} onClick={() => onRemove(track.id)} className="text-gray-400 hover:text-red-400 p-1 rounded-md transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-3">
        {/* Visual Style Selector */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Visual Style</label>
          <select 
            value={track.visualStyle}
            onChange={(e) => onUpdate(track.id, { visualStyle: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none"
          >
          <option value="psychedelic">Fluid Field</option>
          <option value="chladni">Resonance Plate</option>
          <option value="serpent">Jungle Serpent</option>
        </select>
        </div>

        {track.visualStyle === 'serpent' ? (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Scene Influence</label>
            <select
              value={track.sceneRole ?? 'auto'}
              onChange={(e) => onUpdate(track.id, { sceneRole: e.target.value })}
              className="w-full bg-black/30 border border-white/10 rounded-md text-xs p-1.5 outline-none"
            >
              <option value="auto">Auto — balanced role</option>
              <option value="motion">Body motion</option>
              <option value="skin">Skin patterns</option>
              <option value="energy">Emissive energy</option>
              <option value="light">Lighting</option>
              <option value="atmosphere">Atmosphere</option>
              <option value="accent">Transient accents</option>
            </select>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
              Shared smoothly along a stable section of the serpent.
            </p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Blend</label>
            <select
              value={track.blendMode ?? 'normal'}
              onChange={(e) => onUpdate(track.id, { blendMode: e.target.value })}
              className="w-full bg-black/30 border border-white/10 rounded-md text-xs p-1.5 outline-none"
            >
              <option value="normal">Normal</option>
              <option value="additive">Glow</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 flex justify-between">
              <span>Opacity</span>
              <span>{Math.round((track.opacity ?? 1) * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.1" max="1" step="0.01"
              value={track.opacity ?? 1}
              onChange={(e) => onUpdate(track.id, { opacity: parseFloat(e.target.value) })}
              className="w-full accent-accent h-1 bg-black/50 rounded-lg appearance-none cursor-pointer mt-2"
            />
          </div>
        </div>

        {/* Position Selector */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Position</label>
          <select 
            value={track.position}
            onChange={(e) => onUpdate(track.id, { position: e.target.value })}
            className="w-full bg-black/30 border border-white/10 rounded-md text-xs p-1.5 focus:border-primary outline-none"
          >
            <option value="background">Background (Full)</option>
            <option value="center">Center</option>
            <option value="top-left">Top Left</option>
            <option value="top-right">Top Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="bottom-right">Bottom Right</option>
          </select>
        </div>
          </>
        )}

        {/* Volume Slider */}
        <div>
          <label className="text-xs text-gray-400 mb-1 flex justify-between">
            <span>Volume</span>
            <span>{Math.round(track.volume * 100)}%</span>
          </label>
          <input 
            type="range" 
            min="0" max="1" step="0.01" 
            value={track.volume}
            onChange={(e) => onUpdate(track.id, { volume: parseFloat(e.target.value) })}
            className="w-full accent-primary h-1 bg-black/50 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        {/* Reactivity Slider */}
        <div>
          <label className="text-xs text-gray-400 mb-1 flex justify-between">
            <span>Reactivity</span>
            <span>{Math.round((track.reactivity ?? 1.0) * 100)}%</span>
          </label>
          <input 
            type="range" 
            min="0" max="3" step="0.1" 
            value={track.reactivity ?? 1.0}
            onChange={(e) => onUpdate(track.id, { reactivity: parseFloat(e.target.value) })}
            className="w-full accent-secondary h-1 bg-black/50 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        {/* Color Shift Slider */}
        <div>
          <label className="text-xs text-gray-400 mb-1 flex justify-between">
            <span>Color Tone</span>
            <span>{Math.round((track.hue ?? 0.0) * 360)}°</span>
          </label>
          <input 
            type="range" 
            min="0" max="1" step="0.01" 
            value={track.hue ?? 0.0}
            onChange={(e) => onUpdate(track.id, { hue: parseFloat(e.target.value) })}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
            }}
          />
        </div>
      </div>
    </div>
  );
}
