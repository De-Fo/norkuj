import { useState } from 'react'
import type { SearchFilters, PropertyType } from '../lib/types'
import { DEFAULT_FILTERS, PROPERTY_TYPE_LABELS, PRAGUE_DISTRICTS } from '../lib/types'
import { lineColor, activeFilterCount } from '../lib/utils'
import { useLang } from '../lib/lang'

const METRO_LINES = ['A', 'B', 'C']
const TRAM_LINES = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','17','18','20','22','23','24','25','26']
const PRICE_OPTS = [12000, 15000, 18000, 20000, 25000, 30000, 35000, 40000]
const AREA_OPTS = [15, 25, 35, 50, 70, 100]
const TYPE_ORDER: PropertyType[] = ['pokoj','1+kk','1+1','2+kk','2+1','3+kk','3+1','4+kk','4+1','atypical']

interface Props {
  filters: SearchFilters
  onChange: (f: SearchFilters) => void
  resultCount: number
  loading: boolean
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
}

function Chip({ active, onClick, children, color }: {
  active?: boolean; onClick: () => void; children: React.ReactNode; color?: string
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
      border: active ? 'none' : '1px solid var(--c-border)',
      background: active ? (color ?? 'var(--c-text)') : 'var(--c-surface)',
      color: active ? '#fff' : 'var(--c-muted)',
      fontSize: 12, fontWeight: active ? 500 : 400,
      whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.12s',
    }}>
      {children}
    </button>
  )
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        {hint && <span style={{ fontSize: 10, color: 'var(--c-faint)' }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{children}</div>
    </div>
  )
}

export function FilterPanel({ filters, onChange, resultCount, loading }: Props) {
  const [expanded, setExpanded] = useState(false)
  const set = (p: Partial<SearchFilters>) => onChange({ ...filters, ...p })
  const activeCount = activeFilterCount(filters)

  const { t, lang } = useLang()

  const summary = [
    filters.transitLines.length > 0 ? `${filters.transitLines.length} ${filters.transitLines.length === 1 ? (t('_line') || 'linka') : (t('_lines') || 'linky')}` : null,
    filters.districts.length > 0 ? `${filters.districts.length} ${filters.districts.length === 1 ? (t('_district') || 'oblast') : (t('_districts') || 'oblasti')}` : null,
    filters.propertyTypes.length > 0 ? filters.propertyTypes.map(t => PROPERTY_TYPE_LABELS[t]).join(', ') : null,
    (filters.minPrice || filters.maxPrice) ? `${filters.minPrice ? `${(filters.minPrice/1000).toFixed(0)}k` : ''}–${filters.maxPrice ? `${(filters.maxPrice/1000).toFixed(0)}k` : ''}` : null,
    filters.filterByMapArea ? '🗺 ' + t('map_filter_label').replace('🗺 ','') : null,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)', flexShrink: 0 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ display: 'flex', gap: 3 }}>
          {filters.transitLines.slice(0, 4).map(line => (
            <span key={line} style={{ width: 8, height: 8, borderRadius: '50%', background: lineColor(line), flexShrink: 0 }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--c-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {summary || t('search_hint')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>
          {loading ? t('loading') : `${resultCount} ${t('listings_count')}`}
        </span>
        <span style={{
          fontSize: 11, color: 'var(--c-accent, #2563eb)', fontWeight: 500,
          padding: '3px 8px', borderRadius: 6,
          background: expanded ? 'rgba(37,99,235,0.08)' : 'transparent',
        }}>
          {expanded ? '▲ ' + t('hide_label') : '▼ ' + t('filters_label')}{activeCount > 0 ? ` (${activeCount})` : ''}
        </span>
      </div>

      <div style={{
        overflow: 'hidden',
        maxHeight: expanded ? '60vh' : '0',
        opacity: expanded ? 1 : 0,
        transition: 'max-height 0.35s ease, opacity 0.25s ease',
        pointerEvents: expanded ? 'auto' : 'none',
      }}>
        <div style={{ padding: expanded ? '0 12px 14px' : '0 12px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

          {/* Toggle switch for map-area filtering — always visible at top */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text)' }}>
              {t('map_filter_label')}
            </span>
            <div onClick={() => set({ filterByMapArea: !filters.filterByMapArea })}
              style={{
                width: 38, height: 22, borderRadius: 11, cursor: 'pointer',
                background: filters.filterByMapArea ? 'var(--c-accent, #2563eb)' : 'var(--c-border-md)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: 'white',
                position: 'absolute', top: 3, left: filters.filterByMapArea ? 19 : 3,
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--c-border)' }} />

          <Section label={t('metro_label')} hint={t('multi_hint')}>
            {METRO_LINES.map(line => (
              <Chip key={line} active={filters.transitLines.includes(line)} color={lineColor(line)}
                onClick={() => set({ transitLines: toggle(filters.transitLines, line) })}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: filters.transitLines.includes(line) ? 'rgba(255,255,255,0.7)' : lineColor(line) }} />
                Metro {line}
              </Chip>
            ))}
          </Section>

          <Section label={t('tram_label')} hint={t('multi_hint')}>
            {TRAM_LINES.map(t => (
              <Chip key={t} active={filters.transitLines.includes(t)}
                onClick={() => set({ transitLines: toggle(filters.transitLines, t) })}>
                {t}
              </Chip>
            ))}
          </Section>

          <Section label={t('district_label')} hint={t('multi_hint')}>
            {PRAGUE_DISTRICTS.map(d => (
              <Chip key={d} active={filters.districts.includes(d)}
                onClick={() => set({ districts: toggle(filters.districts, d) })}>
                {d}
              </Chip>
            ))}
          </Section>

          <Section label={t('_floorplan')} hint={t('multi_hint')}>
            {TYPE_ORDER.map(t => (
              <Chip key={t} active={filters.propertyTypes.includes(t)}
                onClick={() => set({ propertyTypes: toggle(filters.propertyTypes, t) })}>
                {PROPERTY_TYPE_LABELS[t]}
              </Chip>
            ))}
          </Section>

          <Section label={t('_rent')} hint={t('price_hint')}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" min={0} max={999999} placeholder={lang === 'en' ? 'from' : 'od'} value={filters.minPrice || ''}
                onChange={e => set({ minPrice: parseInt(e.target.value) || 0 })}
                style={{ width: 72, padding: '4px 7px', border: '1px solid var(--c-border)', borderRadius: 6, fontSize: 12, outline: 'none', color: 'var(--c-text)' }} />
              <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>—</span>
              <input type="number" min={0} max={999999} placeholder={lang === 'en' ? 'to' : 'do'} value={filters.maxPrice || ''}
                onChange={e => set({ maxPrice: parseInt(e.target.value) || 0 })}
                style={{ width: 72, padding: '4px 7px', border: '1px solid var(--c-border)', borderRadius: 6, fontSize: 12, outline: 'none', color: 'var(--c-text)' }} />
            </div>
          </Section>

          <Section label={t('min_area_label')} hint="m²">
            {AREA_OPTS.map(a => (
              <Chip key={a} active={filters.minArea === a} onClick={() => set({ minArea: filters.minArea === a ? 0 : a })}>
                {a}+ m²
              </Chip>
            ))}
          </Section>

          <Section label={t('amenities_label')}>
            <Chip active={filters.furnished} onClick={() => set({ furnished: !filters.furnished })}>{t('amenities_furnished')}</Chip>
            <Chip active={filters.petsAllowed} onClick={() => set({ petsAllowed: !filters.petsAllowed })}>{t('amenities_pets')}</Chip>
            <Chip active={filters.parking} onClick={() => set({ parking: !filters.parking })}>{t('amenities_parking')}</Chip>
            <Chip active={filters.balcony} onClick={() => set({ balcony: !filters.balcony })}>{t('amenities_balcony')}</Chip>
          </Section>

          {activeCount > 0 && (
            <button onClick={() => onChange(DEFAULT_FILTERS)} style={{
              alignSelf: 'flex-start', padding: '4px 10px', background: 'transparent',
              border: '1px solid var(--c-border)', borderRadius: 6, fontSize: 11,
              color: 'var(--c-muted)', cursor: 'pointer',
            }}>
              {t('reset_label')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}