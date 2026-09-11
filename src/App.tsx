import { useEffect, useLayoutEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { SearchPage } from './pages/Search'
import { districtForSlug } from './lib/districts'
import { Wordmark } from './components/Wordmark'
import type { SearchFilters } from './lib/types'
import { DEFAULT_FILTERS } from './lib/types'
import type { Listing } from './lib/types'
import { useLang } from './lib/lang'
import { registerPushWorker } from './lib/push'
import { CookieConsent } from './components/CookieConsent'
import { FeatureTour, isFirstVisit, markTourSeen } from './components/FeatureTour'
import { usePageMeta } from './lib/seo'
import { getImageUrl } from './lib/utils'

const DistrictPage = lazy(() => import('./pages/DistrictPage').then(m => ({ default: m.DistrictPage })))

// Secondary pages load on demand — keeps the map-heavy home view lean on first paint.
const AuthPage = lazy(() => import('./pages/Auth').then(m => ({ default: m.AuthPage })))
const CreateListingPage = lazy(() => import('./pages/CreateListing').then(m => ({ default: m.CreateListingPage })))
const ListingDetail = lazy(() => import('./pages/ListingDetail').then(m => ({ default: m.ListingDetail })))
const AdminPanel = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })))
const CompareBezrealitkyPage = lazy(() => import('./pages/CompareBezrealitky').then(m => ({ default: m.CompareBezrealitkyPage })))
const CompareUlovdomovPage = lazy(() => import('./pages/CompareUlovdomov').then(m => ({ default: m.CompareUlovdomovPage })))
const WatchCatPage = lazy(() => import('./pages/WatchCatPage').then(m => ({ default: m.WatchCatPage })))
const ProfilePage = lazy(() => import('./pages/Profile').then(m => ({ default: m.ProfilePage })))
const MyListingsPage = lazy(() => import('./pages/MyListings').then(m => ({ default: m.MyListingsPage })))

type Theme = 'light' | 'dark'
type Route = 'search' | 'auth' | 'profile' | 'my-listings' | 'favorites' | 'watchcats' | 'compare-bezrealitky' | 'compare-ulovdomov' | 'district'

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

  const parseComparePath = (): Route | null => {
    const path = window.location.pathname
    if (path === '/compare/bezrealitky-alternativa') return 'compare-bezrealitky'
    if (path === '/compare/ulovdomov-alternativa') return 'compare-ulovdomov'
    return null
  }

  const parseDistrictSlug = (): string | null => {
    const m = window.location.pathname.match(/^\/bydleni\/([a-z0-9-]+)\/?$/i)
    if (!m) return null
    return districtForSlug(m[1])
  }

  const [user, setUser] = useState<User | null>(null)
  const [route, setRoute] = useState<Route>(() => parseComparePath() ?? (parseDistrictSlug() ? 'district' : 'search'))
  const [districtSlug, setDistrictSlug] = useState<string | null>(() => parseDistrictSlug())
  const goHome = () => { setRoute('search'); setDistrictSlug(null); window.history.replaceState(null, '', '/') }
  const [authLoading, setAuthLoading] = useState(true)
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [showMap, setShowMap] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(parseListingIdFromPath)
  const [editingListing, setEditingListing] = useState<Listing | null>(null)
  const [relistFrom, setRelistFrom] = useState<Listing | null>(null)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [favoritesIds, setFavoritesIds] = useState<Set<string>>(new Set())
  const [tourOpen, setTourOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [watchcatsOpenComposer, setWatchcatsOpenComposer] = useState(false)
  const { t, lang, setLang } = useLang()

  // #root is hidden in the prerendered HTML (SEO text) until the SPA commits.
  useLayoutEffect(() => {
    document.getElementById('root')!.style.display = ''
  }, [])

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
      // direct-load/refresh at /listing/{id}: drop the path, keep modal open state
      if (parseListingIdFromPath()) {
        window.history.replaceState(null, '', '/')
      }
      setSelectedListingId(null)
    }
  }, [])

  // Popstate: user pressed back/forward - sync listing modal with URL
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

  // Direct /listing/{id} load: close replaces URL instead of history.back()
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

  // Register the push service worker at startup (no-op when unsupported).
  useEffect(() => {
    registerPushWorker().catch(() => {})
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
  usePageMeta(route, selectedListingId, districtSlug)

  // ── Loading spinner ──
  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--c-accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  // ── Route pages ──
  const routeFallback = (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-faint)', fontSize: 13 }}>
      {t('loading')}
    </div>
  )

  if (route === 'my-listings') {
    return (
      <Suspense fallback={routeFallback}><MyListingsPage
        user={user}
        onBack={() => setRoute('search')}
        onEdit={(listing) => {
          setEditingListing(listing)
          setRelistFrom(null)
          setShowCreate(true)
          setRoute('search')
        }}
        onRelist={(listing) => {
          setRelistFrom(listing)
          setEditingListing(null)
          setShowCreate(true)
          setRoute('search')
        }}
      /></Suspense>
    )
  }

  if (route === 'watchcats') {
    if (!user) {
      return (
        <div style={{ flex: 1, overflow: 'auto', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🐱</div>
          <h2 style={{ fontSize: 18, margin: 0, color: 'var(--c-text)' }}>{t('watchcats_title')}</h2>
          <p style={{ color: 'var(--c-muted)', fontSize: 14, maxWidth: 320, margin: 0 }}>{t('watchcats_login_hint')}</p>
          <button onClick={() => setRoute('auth')} style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: 'var(--c-accent, #2563eb)', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
            {t('login')}
          </button>
        </div>
      )
    }
    return (
      <Suspense fallback={routeFallback}><WatchCatPage
        user={user}
        currentFilters={filters}
        openComposer={watchcatsOpenComposer}
        onComposerConsumed={() => setWatchcatsOpenComposer(false)}
        onGoHome={goHome}
        onApply={(f) => { setFilters(f); setRoute('search') }}
        onListingClick={(id) => { setSelectedListingId(id); setRoute('search') }}
        isMobile={isMobile}
        isAdmin={isAdmin}
      /></Suspense>
    )
  }
  if (route === 'auth') return <Suspense fallback={routeFallback}><AuthPage onBack={() => setRoute('search')} /></Suspense>
  if (route === 'profile') return <Suspense fallback={routeFallback}><ProfilePage user={user} onBack={() => setRoute('search')} /></Suspense>
  if (route === 'compare-bezrealitky') return <Suspense fallback={routeFallback}><CompareBezrealitkyPage onGoHome={goHome} /></Suspense>
  if (route === 'compare-ulovdomov') return <Suspense fallback={routeFallback}><CompareUlovdomovPage onGoHome={goHome} /></Suspense>

  if (route === 'district' && districtSlug) {
    return <Suspense fallback={routeFallback}><DistrictPage
      district={districtSlug}
      onGoHome={goHome}
      onListingClick={(id) => { setSelectedListingId(id); setRoute('search') }}
    /></Suspense>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* ═══ HEADER ═══ */}
      <header style={{
        height: 48, flexShrink: 0, background: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', padding: `0 ${isMobile ? 8 : 16}px`, justifyContent: 'space-between',
        transition: 'background 0.2s',
        gap: isMobile ? 4 : 0,
      }}>
        <button onClick={() => { setRoute('search'); setShowMap(true); setShowCreate(false); setSelectedListingId(null); setShowAdmin(false) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Wordmark size="md" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 3 : 5 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => { if (user) setRoute('watchcats'); else setRoute('auth') }}
              aria-label={t('watchcats_title')}
              className="wc-btn"
              title={t('watchcats_title')}
              style={{
                height: 32, padding: isMobile ? 0 : '0 10px', background: 'transparent',
                border: '1px solid var(--c-border)', borderRadius: 7, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                color: 'var(--c-muted)', fontSize: 14, flexShrink: 0,
              }}>
              🐱
              {!isMobile && <span style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--c-text)' }}>{t('watchcats_header')}</span>}
            </button>
          </div>
          {user && (
            <button onClick={() => setRoute('favorites')} title={t('favorites_title')} aria-label={t('favorites_title')}
              style={{
                width: 32, height: 32, padding: 0, background: 'transparent',
                border: '1px solid var(--c-border)', borderRadius: 7, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: favoritesIds.size > 0 ? '#eab308' : 'var(--c-muted)',
                fontSize: 14, flexShrink: 0,
              }}>
              {favoritesIds.size > 0 ? '⭐️' : '☆'}
            </button>
          )}

          {/* On desktop: full action row. On mobile: overflow menu. */}
          {isMobile ? (
            <>
              {/* Visible mobile actions */}
              {user && (
                <button onClick={() => setShowCreate(true)} title={t('add_listing')} aria-label={t('add_listing')}
                  style={{
                    width: 32, height: 32, padding: 0, border: 'none', borderRadius: 7,
                    background: 'green', color: 'white', fontSize: 16, cursor: 'pointer', flexShrink: 0,
                  }}>
                  ＋
                </button>
              )}
              {!user && (
                <button onClick={() => setRoute('auth')} style={{
                  height: 32, padding: '0 10px', border: 'none', borderRadius: 7,
                  background: 'darkblue', color: 'white', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}>
                  {t('register')}
                </button>
              )}

              {/* Lang compact */}
              <button onClick={() => setLang(lang === 'cz' ? 'en' : 'cz')}
                aria-label={lang === 'cz' ? 'Přepnout jazyk' : 'Switch language'}
                style={{
                  width: 32, height: 32, padding: 0, background: 'transparent',
                  border: '1px solid var(--c-border)', borderRadius: 7, cursor: 'pointer', flexShrink: 0,
                  fontSize: 14, lineHeight: 1,
                }}>
                {lang === 'cz' ? '🇨🇿' : '🇬🇧'}
              </button>

              {/* ⋯ Overflow menu */}
              <MoreMenu>
                {isAdmin && (
                  <MoreItem onClick={() => setShowAdmin(true)}>🛠 {t('_admin_panel').replace('🛠 ','')}</MoreItem>
                )}
                {user && (
                  <MoreItem onClick={() => setRoute('my-listings')}>{t('my_listings')}</MoreItem>
                )}
                <MoreItem onClick={toggleTheme}>
                  {theme === 'light' ? '🌙' : '☀️'} {theme === 'light' ? t('theme_dark') : t('theme_light')}
                </MoreItem>
                <MoreItem onClick={() => setTourOpen(true)}>❓ {t('_tour_title')}</MoreItem>
                {user ? (
                  <>
                    <MoreItem onClick={() => setRoute('profile')}>👤 {t('profile')}</MoreItem>
                    <MoreItem onClick={() => supabase.auth.signOut()}>🚪 {t('logout')}</MoreItem>
                  </>
                ) : (
                  <MoreItem onClick={() => setRoute('auth')}>👤 {t('login')}</MoreItem>
                )}
              </MoreMenu>
            </>
          ) : (
            /* ── Desktop actions ── */
            <>
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
                  <button onClick={() => setRoute('my-listings')} style={{
                    height: 32, padding: '0 10px', background: 'transparent', color: 'var(--c-muted)',
                    border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  }}>
                    {t('my_listings')}
                  </button>
                  <button onClick={() => setRoute('profile')} style={{
                    height: 32, padding: '0 10px', background: 'transparent', color: 'var(--c-muted)',
                    border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  }}>
                    {t('profile')}
                  </button>
                  <button onClick={() => supabase.auth.signOut()} style={{
                    height: 32, padding: '0 10px', background: 'transparent', color: 'var(--c-muted)',
                    border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  }}>
                    {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setRoute('auth')} style={{
                    height: 32, padding: '0 10px', background: 'transparent', color: 'var(--c-muted)',
                    border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  }}>
                    {t('login')}
                  </button>
                  <button onClick={() => setRoute('auth')} style={{
                    height: 32, padding: '0 12px', background: 'darkblue', color: 'white',
                    border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  }}>
                    {t('register')}
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

              {/* Lang switcher */}
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
            </>
          )}
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
            onSaveFilters={() => {
              if (user) { setWatchcatsOpenComposer(true); setRoute('watchcats') }
              else setRoute('auth')
            }}
          />
        )}
      </main>

      {/* ═══ MODALS ═══ */}
      {showCreate && (
        <Suspense fallback={null}>
          <CreateListingPage
            onDone={() => { setShowCreate(false); setEditingListing(null); setRelistFrom(null) }}
            editListing={editingListing}
            relistFrom={relistFrom}
          />
        </Suspense>
      )}

      {selectedListingId && (
        <Suspense fallback={null}>
          <ListingDetail
            listingId={selectedListingId}
            onClose={closeListing}
            onRequestAuth={() => setRoute('auth')}
            user={user}
            isFavorited={favoritesIds.has(selectedListingId)}
            onToggleFavorite={toggleFavorite}
          />
        </Suspense>
      )}

      {showAdmin && (
        <Suspense fallback={null}>
          <AdminPanel onClose={() => setShowAdmin(false)} />
        </Suspense>
      )}

      {/* ═══ Cookie consent ═══ */}
      <CookieConsent />

      {/* ═══ Feature tour ═══ */}
      <FeatureTour open={tourOpen} onClose={() => setTourOpen(false)} />

      {/* ═══ GLOBAL STYLES - scoped micro-interactions only ═══ */}
      <style>{`
        input, select, button, textarea { transition: all 0.12s; }
        button:active { transform: scale(0.96); }
        *, *::before, *::after { transition: background-color 0.15s, border-color 0.15s, color 0.15s; }
      `}</style>
    </div>
  )
}

// ── Mobile overflow menu ──────────────────────────────────────
function MoreMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    // Delay listener so the toggle click doesn't immediately close
    requestAnimationFrame(() => document.addEventListener('click', handler))
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('click', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)}
        aria-label="More"
        style={{
          width: 32, height: 32, padding: 0, background: 'transparent',
          border: '1px solid var(--c-border)', borderRadius: 7, cursor: 'pointer', flexShrink: 0,
          fontSize: 16, lineHeight: 1, color: 'var(--c-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        ⋯
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 100,
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          minWidth: 180, overflow: 'hidden', padding: 4,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

function MoreItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
      border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer',
      fontSize: 13, color: 'var(--c-text)', whiteSpace: 'nowrap',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
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
      .eq('status', 'published')   // deleted/rented vanish from favorites for everyone (incl. admin RLS bypass)
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
