import { useEffect, useState, useRef, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { SearchPage } from './pages/Search'
import { AuthPage } from './pages/Auth'
import { CreateListingPage } from './pages/CreateListing'
import { ListingDetail } from './pages/ListingDetail'
import { AdminPanel } from './pages/AdminPanel'
import { Wordmark } from './components/Wordmark'
import { ProfilePage } from './pages/Profile'
import type { SearchFilters } from './lib/types'
import { DEFAULT_FILTERS } from './lib/types'
import { MyListingsPage } from './pages/MyListings'
import type { Listing } from './lib/types'
import { useLang } from './lib/lang'
import { CookieConsent } from './components/CookieConsent'
import { FeatureTour, isFirstVisit, markTourSeen } from './components/FeatureTour'
import { usePageMeta } from './lib/seo'
import { getImageUrl } from './lib/utils'

type Theme = 'light' | 'dark'
type Route = 'search' | 'auth' | 'profile' | 'my-listings' | 'favorites'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('norkuj-theme')
  if (stored === 'dark' || stored === 'light') return stored
  return 'light'
}

export default function App() {
  // ── Parse direct /listing/{id} URL on mount ──
  const listingUrlRef = useRef(false)  // true when openListing() called pushState

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const parseListingIdFromPath = (): string | null => {
    const m = window.location.pathname.match(/^\/listing\/([^/]+)$/i)
    return m && UUID_RE.test(m[1]) ? m[1] : null
  }

  const [user, setUser] = useState<User | null>(null)
  const [route, setRoute] = useState<Route>('search')
  const [authLoading, setAuthLoading] = useState(true)
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [showMap, setShowMap] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(parseListingIdFromPath)
  const [editingListing, setEditingListing] = useState<Listing | null>(null)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [favoritesIds, setFavoritesIds] = useState<Set<string>>(new Set())
  const [tourOpen, setTourOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const { t, lang, setLang } = useLang()

  // ── Theme ──
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('norkuj-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  // ── Listing URL routing ──
  const openListing = useCallback((id: string) => {
    setSelectedListingId(id)
    listingUrlRef.current = true
    window.history.pushState({ listingId: id }, '', `/listing/${id}`)
  }, [])

  const closeListing = useCallback(() => {
    if (listingUrlRef.current) {
      listingUrlRef.current = false
      // history.back() triggers popstate which clears selectedListingId
      window.history.back()
    } else {
      // Direct load or refresh at /listing/{id} — replace URL silently
      if (parseListingIdFromPath()) {
        window.history.replaceState(null, '', '/')
      }
      setSelectedListingId(null)
    }
  }, [])

  // Popstate: user pressed back/forward — sync listing modal with URL
  useEffect(() => {
    const onPop = () => {
      const id = parseListingIdFromPath()
      if (id) {
        setSelectedListingId(id)
        listingUrlRef.current = true
      } else {
        setSelectedListingId(null)
        listingUrlRef.current = false
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // If loaded directly at /listing/{id}, leave listingUrlRef false so
  // closeListing uses replaceState instead of history.back() (which would
  // navigate away entirely on a direct-load page)
  useEffect(() => {
    if (selectedListingId && parseListingIdFromPath()) {
      listingUrlRef.current = false
    }
  }, [selectedListingId])

  // ── Mobile detection ──
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // On mobile, map starts hidden
  useEffect(() => {
    if (isMobile && route === 'search') setShowMap(false)
  }, [isMobile, route])

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error && import.meta.env.DEV) console.error('[auth session]', error)
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session) setRoute('search')
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── First-visit tour check ──
  useEffect(() => {
    if (isFirstVisit()) {
      setTourOpen(true)
      markTourSeen()
    }
  }, [])

  // ── Favorites ──
  useEffect(() => {
    if (!user) { setFavoritesIds(new Set()); setIsAdmin(false); return }
    supabase.from('favorites').select('listing_id').eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error && import.meta.env.DEV) console.error('[favorites fetch]', error)
        setFavoritesIds(new Set((data ?? []).map((r: any) => r.listing_id)))
      })
  }, [user])

  // ── Admin check via profiles.is_admin ──
  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    (supabase.from('profiles') as any).select('is_admin').eq('id', user.id).maybeSingle()
      .then(({ data, error }: any) => {
        if (error && import.meta.env.DEV) console.error('[admin check]', error)
        setIsAdmin(data?.is_admin === true)
      })
  }, [user])

  const toggleFavorite = async (listingId: string) => {
    if (!user) return
    if (favoritesIds.has(listingId)) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('listing_id', listingId)
      setFavoritesIds(prev => { const n = new Set(prev); n.delete(listingId); return n })
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, listing_id: listingId })
      setFavoritesIds(prev => { const n = new Set(prev); n.add(listingId); return n })
    }
  }

  // ═══ SEO: update document head per route ═══
  usePageMeta(route, selectedListingId)

  // ── Loading spinner ──
  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--c-accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  // ── Route pages ──
  if (route === 'my-listings') {
    return (
      <MyListingsPage
        user={user}
        onBack={() => setRoute('search')}
        onEdit={(listing) => {
          setEditingListing(listing)
          setShowCreate(true)
          setRoute('search')
        }}
      />
    )
  }

  if (route === 'auth') return <AuthPage onBack={() => setRoute('search')} />
  if (route === 'profile') return <ProfilePage user={user} onBack={() => setRoute('search')} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* ═══ HEADER ═══ */}
      <header style={{
        height: 48, flexShrink: 0, background: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'space-between',
        transition: 'background 0.2s',
      }}>
        <button onClick={() => { setRoute('search'); setShowMap(true); setShowCreate(false); setSelectedListingId(null); setShowAdmin(false) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Wordmark size="md" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {user && (
            <button onClick={() => setRoute('favorites')} title={t('favorites_title')} aria-label={t('favorites_title')}
              style={{
                minWidth: 32, height: 32, padding: '0 6px', background: 'transparent',
                border: '1px solid var(--c-border)', borderRadius: 7, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                color: favoritesIds.size > 0 ? '#eab308' : 'var(--c-muted)',
                fontSize: 12, fontWeight: 500,
              }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{favoritesIds.size > 0 ? '⭐️' : '⭐️'}</span>
              {favoritesIds.size > 0 && <span style={{ fontSize: 11 }}>{favoritesIds.size}</span>}
            </button>
          )}

          <button onClick={toggleTheme}
            title={t('theme_dark')} aria-label={t('theme_dark')}
            style={{
              minWidth: 32, height: 32, padding: 0, background: 'transparent',
              border: '1px solid var(--c-border)', borderRadius: 7, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, lineHeight: 1,
            }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {isAdmin && (
            <button onClick={() => setShowAdmin(true)} style={{
              height: 32, padding: '0 10px', background: '#7c3aed', color: 'white',
              border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              🛠 Admin
            </button>
          )}

          {user ? (
            <>
              <button onClick={() => setShowCreate(true)} style={{
                height: 32, padding: '0 12px', background: 'green', color: 'white',
                border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}>
                {t('add_listing')}
              </button>
              {!isMobile && (
                <button onClick={() => setRoute('my-listings')} style={{
                  height: 32, padding: '0 10px', background: 'transparent', color: 'var(--c-muted)',
                  border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                }}>
                  {t('my_listings')}
                </button>
              )}
              <button onClick={() => setRoute('profile')} style={{
                height: 32, padding: '0 10px', background: 'transparent', color: 'var(--c-muted)',
                border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              }}>
                {isMobile ? '👤' : t('profile')}
              </button>
              <button onClick={() => supabase.auth.signOut()} style={{
                height: 32, padding: '0 10px', background: 'transparent', color: 'var(--c-muted)',
                border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              }}>
                {isMobile ? '🚪' : t('logout')}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setRoute('auth')} style={{
                height: 32, padding: '0 10px', background: 'transparent', color: 'var(--c-muted)',
                border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              }}>
                {isMobile ? '👤' : t('login')}
              </button>
              <button onClick={() => setRoute('auth')} style={{
                height: 32, padding: '0 12px', background: 'darkblue', color: 'white',
                border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                {isMobile ? '➕' : t('register')}
              </button>
            </>
          )}

          {/* Help / How it works */}
          <button onClick={() => setTourOpen(true)}
            title={t('_tour_title')} aria-label={t('_tour_title')}
            style={{
              minWidth: 32, height: 32, padding: 0, background: 'transparent',
              border: '1px solid var(--c-border)', borderRadius: 7, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, lineHeight: 1, color: 'var(--c-muted)',
            }}>
            ❓
          </button>

          {/* Lang switcher — far right */}
          <select value={lang} onChange={e => setLang(e.target.value as 'cz' | 'en')}
            aria-label={lang === 'cz' ? 'Přepnout jazyk' : 'Switch language'}
            style={{
              height: 32, padding: '0 6px', background: 'transparent',
              border: '1px solid var(--c-border)', borderRadius: 7,
              fontSize: 11, color: 'var(--c-muted)', cursor: 'pointer', outline: 'none',
            }}>
            <option value="cz">🇨🇿 CZ</option>
            <option value="en">🇬🇧 EN</option>
          </select>
        </div>
      </header>

      {/* ═══ MAIN ═══ */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative' }}>
        {route === 'favorites' ? (
          <FavoritesPage
            listingIds={Array.from(favoritesIds)}
            onSelectListing={openListing}
            onBack={() => setRoute('search')}
          />
        ) : (
          <SearchPage
            filters={filters}
            onChange={setFilters}
            showMap={showMap}
            onToggleMap={() => setShowMap(v => !v)}
            onListingClick={openListing}
            isMobile={isMobile}
            isochroneAutoShowMap={() => { if (isMobile) setShowMap(true) }}
          />
        )}
      </main>

      {/* ═══ MODALS ═══ */}
      {showCreate && (
        <CreateListingPage
          onDone={() => { setShowCreate(false); setEditingListing(null) }}
          editListing={editingListing}
        />
      )}

      {selectedListingId && (
        <ListingDetail
          listingId={selectedListingId}
          onClose={closeListing}
          onRequestAuth={() => setRoute('auth')}
          user={user}
          isFavorited={favoritesIds.has(selectedListingId)}
          onToggleFavorite={toggleFavorite}
        />
      )}

      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}

      {/* ═══ Cookie consent ═══ */}
      <CookieConsent />

      {/* ═══ Feature tour ═══ */}
      <FeatureTour open={tourOpen} onClose={() => setTourOpen(false)} />

      {/* ═══ GLOBAL STYLES ═══ */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown { from { opacity: 0; max-height: 0 } to { opacity: 1; max-height: 60vh } }
        @keyframes slideUp { from { opacity: 1; max-height: 60vh } to { opacity: 0; max-height: 0 } }
        @keyframes pulse-iso { 0%, 100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        @keyframes pulse-map { 0%, 100% { box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-accent) 30%, transparent); } 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--c-accent) 50%, transparent); } }

        :root,
        [data-theme="light"] {
          --c-bg: #f4f6f8;
          --c-surface: #ffffff;
          --c-surface-raised: #fafbfc;
          --c-border: #e2e8f0;
          --c-border-md: #cbd5e1;
          --c-text: #0f172a;
          --c-text-secondary: #334155;
          --c-muted: #64748b;
          --c-faint: #94a3b8;
          --c-accent: #2563eb;
          --c-accent-hover: #1d4ed8;
          --c-green: #16a34a;
          --c-yellow: #ca8a04;
          --c-red: #dc2626;
          --c-rk: #e2001a;
          color-scheme: light;
        }

        [data-theme="dark"] {
          --c-bg: #0f1117;
          --c-surface: #1a1d27;
          --c-surface-raised: #22252f;
          --c-border: #2a2d3a;
          --c-border-md: #3a3d4a;
          --c-text: #e8eaf0;
          --c-text-secondary: #c8cad0;
          --c-muted: #9497a5;
          --c-faint: #6a6d7a;
          --c-accent: #3b82f6;
          --c-accent-hover: #60a5fa;
          --c-green: #22c55e;
          --c-yellow: #eab308;
          --c-red: #ef4444;
          --c-rk: #ff4455;
          color-scheme: dark;
        }

        body {
          background: var(--c-bg);
          color: var(--c-text);
          transition: background 0.2s, color 0.2s;
        }

        *, *::before, *::after {
          transition: background-color 0.15s, border-color 0.15s, color 0.15s;
        }

        ::selection {
          background: var(--c-accent);
          color: white;
        }

        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
        }
        @media (min-width: 768px) {
          .mobile-only { display: none !important; }
        }

        input, select, button, textarea {
          transition: all 0.12s;
        }

        button:active {
          transform: scale(0.96);
        }
      `}</style>
    </div>
  )
}

// ═══ Favorites page ═══
function FavoritesPage({ listingIds, onSelectListing, onBack }: {
  listingIds: string[]
  onSelectListing: (id: string) => void
  onBack: () => void
}) {
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useLang()

  useEffect(() => {
    if (listingIds.length === 0) { setListings([]); setLoading(false); return }
    setLoading(true)
    supabase.from('listings').select('id, title, price_total_czk, property_type, area_sqm, address_district, available_from, image_paths')
      .in('id', listingIds)
      .then(({ data, error }) => {
        if (error && import.meta.env.DEV) console.error('[favorites listings]', error)
        setListings(data ?? [])
        setLoading(false)
      })
  }, [listingIds.join(',')])

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--c-text)' }}>
          ⭐️ {t('favorites_title')}
        </h2>
        <button onClick={onBack}
          style={{
            padding: '6px 14px', border: '1px solid var(--c-border)', borderRadius: 8,
            background: 'var(--c-surface)', color: 'var(--c-text)',
            fontSize: 12, cursor: 'pointer',
          }}>
          {t('favorites_back')}
        </button>
      </div>
      {loading && <p style={{ color: 'var(--c-muted)', fontSize: 13 }}>{t('loading')}</p>}
      {!loading && listings.length === 0 && (
        <p style={{ color: 'var(--c-faint)', fontSize: 13 }}>{t('favorites_empty')}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {listings.map((l: any) => (
          <div key={l.id} onClick={() => onSelectListing(l.id)}
            style={{
              padding: '10px 14px', background: 'var(--c-surface)', borderRadius: 10,
              border: '1px solid var(--c-border)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
            {/* Thumbnail */}
            <div style={{
              width: 52, height: 52, borderRadius: 8, flexShrink: 0,
              overflow: 'hidden', background: 'var(--c-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {l.image_paths?.[0] ? (
                <img src={getImageUrl(l.image_paths[0])} alt={l.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { (e.target as HTMLElement).style.display = 'none' }}
                />
              ) : (
                <span style={{ fontSize: 20, opacity: 0.3 }}>🏠</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
              <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                {l.address_district} · {l.area_sqm} m²
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--c-accent)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {l.price_total_czk.toLocaleString('cs-CZ')} Kč
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
