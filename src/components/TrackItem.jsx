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
          <option value="ritualCurrent">Experiment · Ritual Current</option>
          <option value="livingMandala">Experiment · Living Mandala</option>
          <option value="obsidianOrganism">Experiment · Obsidian Organism</option>
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
        {/* Artistic energy slider */}
        <div>
          <label className="text-xs text-gray-400 mb-1 flex justify-between">
            <span>Journey</span>
            <span className="text-gray-500">
              {(track.trance ?? 0.5) < 0.45
                ? 'Meditative'
                : ((track.trance ?? 0.5) > 0.55 ? 'Ecstatic' : 'Balanced')}
            </span>
          </label>
          <input
            type="range"
            aria-label="Journey from meditative to ecstatic"
            min="0" max="1" step="0.01"
            value={track.trance ?? 0.5}
            onChange={(e) => onUpdate(track.id, { trance: parseFloat(e.target.value) })}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #30372f, #92704a, #ff5e8b)'
            }}
          />
          <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-gray-600">
            <span>Meditative</span><span>Ecstatic</span>
          </div>
        </div>
        
        {/* Artistic palette slider */}
        <div>
          <label className="text-xs text-gray-400 mb-1 flex justify-between">
            <span>World</span>
            <span className="text-gray-500">
              {(track.cosmic ?? 0.2) < 0.45
                ? 'Dark & Earthy'
                : ((track.cosmic ?? 0.2) > 0.55 ? 'Full Spectrum' : 'Transition')}
            </span>
          </label>
          <input 
            type="range" 
            aria-label="World from dark and earthy to full spectrum cosmic"
            min="0" max="1" step="0.01" 
            value={track.cosmic ?? 0.2}
            onChange={(e) => onUpdate(track.id, { cosmic: parseFloat(e.target.value) })}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #070604, #5d3b16, #b16a25, #00b7a8, #7757ff, #ff3e98)'
            }}
          />
          <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-gray-600">
            <span>Earthy</span><span>Cosmic</span>
          </div>
        </div>
      </div>
    </div>
  );
}
