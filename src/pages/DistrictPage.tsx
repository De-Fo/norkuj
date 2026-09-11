/**
 * /bydleni/<slug> - district landing page.
 * Resolves the slug to a district, fetches published listings, filters to the
 * district (and its parent group), and renders an H1 + intro + live listing
 * grid. Reuses the same RPC and ListingCard as the search page.
 */
import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ListingSearchResult } from '../lib/types'
import { ListingCard } from '../components/ListingCard'
import { getParentGroups, slugForDistrict } from '../lib/districts'
import { getDistrictContent } from '../lib/districtContent'

const SITE = 'https://norkuj.cz'

interface Props {
  district: string        // canonical district name (resolved from slug)
  onGoHome: () => void
  onListingClick: (id: string) => void
}

export function DistrictPage({ district, onGoHome, onListingClick }: Props) {
  const [listings, setListings] = useState<ListingSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const content = getDistrictContent(district)
  const parents = getParentGroups(district)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      const { data, error } = await (supabase.rpc as any)('get_published_listings_with_coords')
      if (error) { console.error('[district]', error); if (alive) setLoading(false); return }
      const base = (data ?? []) as ListingSearchResult[]
      // match the district or any of its child quarters (parents recomputed here
      // so the effect deps stay a stable [district] - getParentGroups returns a
      // fresh array identity every render and would otherwise loop the fetch)
      const target = new Set([district, ...getParentGroups(district)])
      const filtered = base.filter(l => {
        if (!l.address_district) return false
        const dists = l.address_district.split(',').map(s => s.trim())
        return dists.some(d => target.has(d))
      })
      if (alive) { setListings(filtered); setLoading(false) }
    })()
    return () => { alive = false }
  }, [district])

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '24px 16px', background: 'var(--c-bg)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 12, color: 'var(--c-faint)', marginBottom: 16 }}>
          <a href={SITE + '/'} onClick={(e) => { e.preventDefault(); onGoHome() }}
            style={{ color: 'var(--c-accent)', textDecoration: 'none' }}>Norkuj</a>
          <span style={{ margin: '0 6px' }}>/</span>
          <span>{district}</span>
        </div>

        {/* H1 */}
        <h1 style={{
          fontSize: 26, fontWeight: 700, margin: '0 0 12px',
          color: 'var(--c-text)', lineHeight: 1.2,
        }}>
          {content.title}
        </h1>

        {/* Intro paragraphs */}
        {content.intro.map((p, i) => (
          <p key={i} style={{
            fontSize: 14, lineHeight: 1.7, color: 'var(--c-muted)', margin: '0 0 12px',
          }}>
            {p}
          </p>
        ))}

        {/* Parent groups */}
        {parents.length > 0 && (
          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--c-muted)', margin: '0 0 24px' }}>
            Součást: {parents.map((p, i) => {
              const slug = slugForDistrict(p)
              if (!slug) return null
              return (
                <Fragment key={p}>
                  {i > 0 && ', '}
                  <a href={'/bydleni/' + slug}
                    style={{ color: 'var(--c-accent)', textDecoration: 'none' }}>{p}</a>
                </Fragment>
              )
            })}
          </p>
        )}

        {/* Nearby quarters */}
        {content.nearby.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {content.nearby.map(n => {
              const slug = slugForDistrict(n)
              if (!slug) return null
              return (
                <a key={n} href={'/bydleni/' + slug}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12,
                    background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                    color: 'var(--c-accent)', textDecoration: 'none',
                  }}>
                  {n}
                </a>
              )
            })}
          </div>
        )}

        {/* Listing grid */}
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px', color: 'var(--c-text)' }}>
          Inzeráty ve čtvrti {district}
        </h2>
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>Načítám...</p>
        ) : listings.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>
            Zatím zde nejsou žádné inzeráty. Podívej se na {parents[0] ?? 'jiné čtvrti'}.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {listings.map(l => (
              <ListingCard key={l.listing_id} listing={l} onClick={() => onListingClick(l.listing_id)} />
            ))}
          </div>
        )}

        {/* CTA */}
        <button onClick={onGoHome} style={{
          display: 'block', width: '100%', maxWidth: 320, margin: '32px auto 0',
          padding: '14px 24px', border: 'none', borderRadius: 10,
          background: 'var(--c-accent)', color: 'white',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          Prohledat všechny inzeráty
        </button>
      </div>
    </div>
  )
}