import { type SearchFilters, type PropertyType, DEFAULT_FILTERS } from '../lib/types'
import { PROPERTY_TYPE_LABELS } from '../lib/utils'

const METRO_LINES = ['A', 'B', 'C']
const TRAM_LINES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '17', '18', '20', '22', '23', '24', '25', '26']
const PRICE_PRESETS = [15000, 20000, 25000, 30000, 35000, 40000]

interface SearchFiltersProps {
  filters: SearchFilters
  onChange: (f: SearchFilters) => void
}

export function SearchFiltersPanel({ filters, onChange }: SearchFiltersProps) {
  const set = (partial: Partial<SearchFilters>) => onChange({ ...filters, ...partial })

  return (
    <div className="flex flex-col gap-5 p-4 bg-white rounded-xl shadow-sm border border-gray-100 h-full overflow-y-auto">
      <div>
        <h2 className="font-bold text-gray-800 text-base mb-1">Norkuj 🏠</h2>
        <p className="text-xs text-gray-400">Pronájem bez realitky</p>
      </div>

      {/* Transit line */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Metro</label>
        <div className="flex gap-2 flex-wrap">
          {METRO_LINES.map(line => (
            <button
              key={line}
              onClick={() => set({ transitLine: filters.transitLine === line ? null : line })}
              className={`
                w-9 h-9 rounded-full text-white font-bold text-sm transition-all
                ${filters.transitLine === line ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'}
                ${line === 'A' ? 'bg-[#00a562]' : line === 'B' ? 'bg-[#f5a623]' : 'bg-[#e2001a]'}
              `}
            >
              {line}
            </button>
          ))}
        </div>

        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 mt-4">Tramvaj</label>
        <div className="flex gap-1.5 flex-wrap">
          {TRAM_LINES.map(line => (
            <button
              key={line}
              onClick={() => set({ transitLine: filters.transitLine === line ? null : line })}
              className={`
                px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
                ${filters.transitLine === line
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'}
              `}
            >
              {line}
            </button>
          ))}
        </div>
      </div>

      {/* Max price */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
          Max. nájem {filters.maxPrice > 0 ? `${filters.maxPrice.toLocaleString('cs-CZ')} Kč` : '— bez limitu'}
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {PRICE_PRESETS.map(p => (
            <button
              key={p}
              onClick={() => set({ maxPrice: filters.maxPrice === p ? 0 : p })}
              className={`
                px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                ${filters.maxPrice === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'}
              `}
            >
              {(p / 1000).toFixed(0)}k
            </button>
          ))}
        </div>
      </div>

      {/* Property type */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Dispozice</label>
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(PROPERTY_TYPE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => set({ propertyType: filters.propertyType === key ? null : key as PropertyType })}
              className={`
                px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                ${filters.propertyType === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'}
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Vybavení</label>
        <div className="flex flex-col gap-2">
          {[
            { key: 'furnished', label: '🛋️ Zařízený' },
            { key: 'petsAllowed', label: '🐾 Zvířata povolena' },
            { key: 'parking', label: '🅿️ Parkování' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters[key as keyof SearchFilters] === true}
                onChange={e => set({ [key]: e.target.checked ? true : null })}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={() => onChange(DEFAULT_FILTERS)}
        className="mt-auto text-xs text-gray-400 hover:text-red-500 underline text-left transition-colors"
      >
        Resetovat filtry
      </button>
    </div>
  )
}