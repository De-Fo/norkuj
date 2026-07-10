
import type { SearchFilters } from '../lib/types'
import type { PropertyType } from '../lib/types'
import { DEFAULT_FILTERS, PROPERTY_TYPE_LABELS } from '../lib/types'

const METRO_LINES = ['A', 'B', 'C']
const TRAM_LINES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '17', '18', '20', '22', '23', '24', '25', '26']
const PRICE_PRESETS = [15000, 20000, 25000, 30000, 35000, 40000]

// Updated to match the props SearchPage passes down
interface SearchFiltersProps {
  filters: SearchFilters
  onChange: (f: SearchFilters) => void
  resultCount: number
  loading: boolean
}

// Named "FilterPanel" to match SearchPage's import statement
export function FilterPanel({ filters, onChange, resultCount, loading }: SearchFiltersProps) {
  const set = (partial: Partial<SearchFilters>) => onChange({ ...filters, ...partial })

  // Helper to handle adding/removing lines in the array
  const toggleTransitLine = (line: string) => {
    const currentLines = filters.transitLines || []
    const nextLines = currentLines.includes(line)
      ? currentLines.filter(l => l !== line)
      : [...currentLines, line]
    set({ transitLines: nextLines })
  }

  return (
    <div className="flex flex-col gap-5 p-4 bg-white rounded-xl shadow-sm border border-gray-100 h-full overflow-y-auto">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-bold text-gray-800 text-base mb-1">Norkuj 🏠</h2>
          <p className="text-xs text-gray-400">Pronájem bez realitky</p>
        </div>
        {/* Subtle result counter / loader badge */}
        <div className="text-xs font-semibold px-2 py-1 bg-gray-50 rounded-md text-gray-500 border border-gray-100">
          {loading ? '🔄 Načítání...' : `${resultCount} inzerátů`}
        </div>
      </div>

      {/* Transit lines (Metro) */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Metro</label>
        <div className="flex gap-2 flex-wrap">
          {METRO_LINES.map(line => {
            const isActive = filters.transitLines?.includes(line)
            return (
              <button
                key={line}
                onClick={() => toggleTransitLine(line)}
                className={`
                  w-9 h-9 rounded-full text-white font-bold text-sm transition-all
                  ${isActive ? 'ring-2 ring-offset-2 ring-blue-500 scale-110 opacity-100' : 'opacity-60 hover:opacity-90'}
                  ${line === 'A' ? 'bg-[#00a562]' : line === 'B' ? 'bg-[#f5a623]' : 'bg-[#e2001a]'}
                `}
              >
                {line}
              </button>
            )
          })}
        </div>

        {/* Transit lines (Tram) */}
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 mt-4">Tramvaj</label>
        <div className="flex gap-1.5 flex-wrap">
          {TRAM_LINES.map(line => {
            const isActive = filters.transitLines?.includes(line)
            return (
              <button
                key={line}
                onClick={() => toggleTransitLine(line)}
                className={`
                  px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
                  ${isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'}
                `}
              >
                {line}
              </button>
            )
          })}
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
              onClick={() => set({ propertyTypes: filters.propertyTypes?.includes(key as PropertyType) ? filters.propertyTypes.filter(t => t !== key) : [...(filters.propertyTypes || []), key as PropertyType] })}
              className={`
                px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                ${filters.propertyTypes?.includes(key as PropertyType)
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
            { key: 'furnished', label: 'Zařízený' },
            { key: 'petsAllowed', label: 'Zvířata povolena' },
            { key: 'parking', label: 'Parkování' },
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