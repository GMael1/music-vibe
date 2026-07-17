import { Trash2 } from 'lucide-react';

export default function TrackItem({ track, onRemove, onUpdate, t }) {
  const trackName = track.nameKey ? t(track.nameKey) : track.name;

  return (
    <div className="bg-surface/50 border border-border rounded-lg p-3 backdrop-blur-sm transition-all hover:bg-surface">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-sm truncate flex-1" title={trackName}>{trackName}</span>
        <button aria-label={t('track.remove', { name: trackName })} onClick={() => onRemove(track.id)} className="text-gray-400 hover:text-red-400 p-1 rounded-md transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-3">
        {/* Visual Style Selector */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">{t('track.visualStyle')}</label>
          <select 
            value={track.visualStyle}
            onChange={(e) => onUpdate(track.id, { visualStyle: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none"
          >
          <option value="livingMandala">{t('style.livingMandala')}</option>
          <option value="psychedelic">{t('style.psychedelic')}</option>
          <option value="chladni">{t('style.chladni')}</option>
        </select>
        </div>

        {track.visualStyle === 'serpent' ? (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{t('track.sceneInfluence')}</label>
            <select
              value={track.sceneRole ?? 'auto'}
              onChange={(e) => onUpdate(track.id, { sceneRole: e.target.value })}
              className="w-full bg-black/30 border border-white/10 rounded-md text-xs p-1.5 outline-none"
            >
              <option value="auto">{t('role.auto')}</option>
              <option value="motion">{t('role.motion')}</option>
              <option value="skin">{t('role.skin')}</option>
              <option value="energy">{t('role.energy')}</option>
              <option value="light">{t('role.light')}</option>
              <option value="atmosphere">{t('role.atmosphere')}</option>
              <option value="accent">{t('role.accent')}</option>
            </select>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
              {t('track.sceneHelp')}
            </p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">{t('track.blend')}</label>
            <select
              value={track.blendMode ?? 'normal'}
              onChange={(e) => onUpdate(track.id, { blendMode: e.target.value })}
              className="w-full bg-black/30 border border-white/10 rounded-md text-xs p-1.5 outline-none"
            >
              <option value="normal">{t('blend.normal')}</option>
              <option value="additive">{t('blend.additive')}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 flex justify-between">
              <span>{t('track.opacity')}</span>
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
          <label className="text-xs text-gray-400 mb-1 block">{t('track.position')}</label>
          <select 
            value={track.position}
            onChange={(e) => onUpdate(track.id, { position: e.target.value })}
            className="w-full bg-black/30 border border-white/10 rounded-md text-xs p-1.5 focus:border-primary outline-none"
          >
            <option value="background">{t('position.background')}</option>
            <option value="center">{t('position.center')}</option>
            <option value="top-left">{t('position.topLeft')}</option>
            <option value="top-right">{t('position.topRight')}</option>
            <option value="bottom-left">{t('position.bottomLeft')}</option>
            <option value="bottom-right">{t('position.bottomRight')}</option>
          </select>
        </div>
          </>
        )}

        {/* Volume Slider */}
        <div>
          <label className="text-xs text-gray-400 mb-1 flex justify-between">
            <span>{t('track.volume')}</span>
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
        {/* Motion direction */}
        <div>
          <label className="text-xs text-gray-400 mb-1 flex justify-between">
            <span>{t('track.flow')}</span>
            <span className="text-gray-500">
              {(track.flow ?? track.trance ?? 0.5) < 0.34
                ? t('value.still')
                : ((track.flow ?? track.trance ?? 0.5) > 0.67 ? t('value.intense') : t('value.fluid'))}
            </span>
          </label>
          <input
            type="range"
            aria-label={t('track.flowLabel')}
            min="0" max="1" step="0.01"
            value={track.flow ?? track.trance ?? 0.5}
            onChange={(e) => onUpdate(track.id, { flow: parseFloat(e.target.value) })}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #28302d, #517d70, #ef6a8f)'
            }}
          />
          <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-gray-600">
            <span>{t('value.still')}</span><span>{t('value.intense')}</span>
          </div>
        </div>

        {/* Lighting direction */}
        <div>
          <label className="text-xs text-gray-400 mb-1 flex justify-between">
            <span>{t('track.light')}</span>
            <span className="text-gray-500">
              {(track.light ?? 0.62) < 0.34
                ? t('value.shadow')
                : ((track.light ?? 0.62) > 0.67 ? t('value.radiant') : t('value.luminous'))}
            </span>
          </label>
          <input
            type="range"
            aria-label={t('track.lightLabel')}
            min="0" max="1" step="0.01"
            value={track.light ?? 0.62}
            onChange={(e) => onUpdate(track.id, { light: parseFloat(e.target.value) })}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #050505, #625c50, #f4ead2)'
            }}
          />
          <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-gray-600">
            <span>{t('value.shadow')}</span><span>{t('value.radiant')}</span>
          </div>
        </div>

        {/* Palette direction */}
        <div>
          <label className="text-xs text-gray-400 mb-1 flex justify-between">
            <span>{t('track.colour')}</span>
            <span className="text-gray-500">
              {(track.color ?? track.cosmic ?? 0.2) < 0.34
                ? t('value.earthy')
                : ((track.color ?? track.cosmic ?? 0.2) > 0.67 ? t('value.cosmic') : t('value.mineral'))}
            </span>
          </label>
          <input
            type="range"
            aria-label={t('track.colourLabel')}
            min="0" max="1" step="0.01"
            value={track.color ?? track.cosmic ?? 0.2}
            onChange={(e) => onUpdate(track.id, { color: parseFloat(e.target.value) })}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #2d1709, #b16a25, #00a99a, #7757ff, #ff3e98)'
            }}
          />
          <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-gray-600">
            <span>{t('value.earthy')}</span><span>{t('value.cosmic')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
