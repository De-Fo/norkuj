import { useState } from 'react'
import type { SearchFilters, PropertyType } from '../lib/types'
import { DEFAULT_FILTERS } from '../lib/types'
import { METRO_LINE_COLORS } from '../lib/utils'

const METRO_LINES = ['A', 'B', 'C']
const TRAM_LINES = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','17','18','20','22','23','24','25','26']
const PRICE_OPTS = [
  { label: 'do 15k', val: 15000 },
  { label: 'do 20k', val: 20000 },
  { label: 'do 25k', val: 25000 },
  { label: 'do 30k', val: 30000 },
  { label: 'do 40k', val: 40000 },
]
const TYPES: { label: string; val: PropertyType }[] = [
  { label: '1+kk', val: '1+kk' }, { label: '1+1', val: '1+1' },
  { label: '2+kk', val: '2+kk' }, { label: '2+1', val: '2+1' },
  { label: '3+kk', val: '3+kk' }, { label: '3+1', val: '3+1' },
  { label: '4+kk', val: '4+kk' }, { label: '4+1', val: '4+1' },
]

interface Props {
  filters: SearchFilters
  onChange: (f: SearchFilters) => void
  resultCount: number
  loading: boolean
}

function toggleLine(lines: string[], line: string): string[] {
  return lines.includes(line) ? lines.filter(l => l !== line) : [...lines, line]
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
      whiteSpace: 'nowrap', flexShrink: 0,
      transition: 'all 0.12s',
    }}>
      {children}
    </button>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {children}
      </div>
    </div>
  )
}

export function FilterPanel({ filters, onChange, resultCount, loading }: Props) {
  const [expanded, setExpanded] = useState(false)
  const set = (p: Partial<SearchFilters>) => onChange({ ...filters, ...p })
  const activeCount = filters.transitLines.length
    + (filters.maxPrice ? 1 : 0)
    + (filters.propertyType ? 1 : 0)
    + (filters.furnished ? 1 : 0)
    + (filters.petsAllowed ? 1 : 0)
    + (filters.parking ? 1 : 0)

  return (
    <div style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)', flexShrink: 0 }}>

      {/* Collapsed header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', cursor: 'pointer',
      }} onClick={() => setExpanded(v => !v)}>

        {/* Active line dots */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {filters.transitLines.map(line => (
            <span key={line} style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: METRO_LINE_COLORS[line] ?? '#64748b',
            }} />
          ))}
        </div>

        <span style={{ fontSize: 12, color: 'var(--c-muted)', flex: 1 }}>
          {activeCount === 0
            ? 'Vyber linku nebo oblast...'
            : `${filters.transitLines.length > 0 ? `Linka ${filters.transitLines.join(', ')}` : ''}${filters.maxPrice ? ` · do ${(filters.maxPrice/1000).toFixed(0)}k` : ''}${filters.propertyType ? ` · ${filters.propertyType}` : ''}`
          }
        </span>

        <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>
          {loading ? 'Hledám...' : `${resultCount} inzerátů`}
        </span>

        <span style={{
          fontSize: 11, color: 'var(--c-accent)', fontWeight: 500,
          padding: '3px 8px', borderRadius: 6,
          background: expanded ? 'rgba(37,99,235,0.08)' : 'transparent',
        }}>
          {expanded ? '▲ Skrýt' : '▼ Filtry'}{activeCount > 0 ? ` (${activeCount})` : ''}
        </span>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ padding: '0 12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          <Section label="Metro">
            {METRO_LINES.map(line => (
              <Chip
                key={line}
                active={filters.transitLines.includes(line)}
                color={METRO_LINE_COLORS[line]}
                onClick={() => set({ transitLines: toggleLine(filters.transitLines, line) })}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: filters.transitLines.includes(line) ? 'rgba(255,255,255,0.7)' : METRO_LINE_COLORS[line],
                  flexShrink: 0,
                }} />
                Metro {line}
              </Chip>
            ))}
          </Section>

          <Section label="Tram">
            {TRAM_LINES.map(t => (
              <Chip
                key={t}
                active={filters.transitLines.includes(t)}
                onClick={() => set({ transitLines: toggleLine(filters.transitLines, t) })}
              >
                {t}
              </Chip>
            ))}
          </Section>

          <Section label="Max. nájem">
            {PRICE_OPTS.map(({ label, val }) => (
              <Chip
                key={val}
                active={filters.maxPrice === val}
                onClick={() => set({ maxPrice: filters.maxPrice === val ? 0 : val })}
              >
                {label}
              </Chip>
            ))}
          </Section>

          <Section label="Dispozice">
            {TYPES.map(({ label, val }) => (
              <Chip
                key={val}
                active={filters.propertyType === val}
                onClick={() => set({ propertyType: filters.propertyType === val ? null : val })}
              >
                {label}
              </Chip>
            ))}
          </Section>

          <Section label="Vybavení">
            <Chip active={!!filters.furnished} onClick={() => set({ furnished: filters.furnished ? null : true })}>🛋 Zařízený</Chip>
            <Chip active={!!filters.petsAllowed} onClick={() => set({ petsAllowed: filters.petsAllowed ? null : true })}>🐾 Zvířata</Chip>
            <Chip active={!!filters.parking} onClick={() => set({ parking: filters.parking ? null : true })}>🅿 Parking</Chip>
          </Section>

          {activeCount > 0 && (
            <button onClick={() => onChange(DEFAULT_FILTERS)} style={{
              alignSelf: 'flex-start', padding: '4px 10px',
              background: 'transparent', border: '1px solid var(--c-border)',
              borderRadius: 6, fontSize: 11, color: 'var(--c-muted)', cursor: 'pointer',
            }}>
              ✕ Resetovat vše
            </button>
          )}
        </div>
      )}
    </div>
  )
}