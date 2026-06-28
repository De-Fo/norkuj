import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { SearchPage } from './pages/Search'
import { AuthPage } from './pages/Auth'
import { CreateListingPage } from './pages/CreateListing'
import { Wordmark } from './components/Wordmark'
import type { SearchFilters } from './lib/types'
import { DEFAULT_FILTERS } from './lib/types'

type Route = 'search' | 'auth' | 'create'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [route, setRoute] = useState<Route>('search')
  const [authLoading, setAuthLoading] = useState(true)
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [showMap, setShowMap] = useState(true)

  useEffect(() => {
    // On mobile default to list view
    if (window.innerWidth < 768) setShowMap(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session) setRoute('search')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '2px solid #2563eb', borderTopColor: 'transparent',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )

  if (route === 'auth') return <AuthPage />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

      {/* Topbar */}
      <header style={{
        height: 48, flexShrink: 0,
        background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', padding: '0 16px',
        justifyContent: 'space-between',
      }}>
        <button onClick={() => setRoute('search')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Wordmark size="md" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user ? (
            <>
              <button onClick={() => setRoute('create')} style={{
                padding: '6px 14px', background: 'var(--c-text)', color: 'white',
                border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                + Přidat inzerát
              </button>
              <button onClick={() => supabase.auth.signOut()} style={{
                padding: '6px 11px', background: 'transparent', color: 'var(--c-muted)',
                border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              }}>
                Odhlásit
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setRoute('auth')} style={{
                padding: '6px 11px', background: 'transparent', color: 'var(--c-muted)',
                border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              }}>
                Přihlásit
              </button>
              <button onClick={() => setRoute('auth')} style={{
                padding: '6px 14px', background: 'var(--c-text)', color: 'white',
                border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                Registrovat
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {route === 'search' && (
          <SearchPage
            filters={filters}
            onChange={setFilters}
            showMap={showMap}
            onToggleMap={() => setShowMap(v => !v)}
          />
        )}
        {route === 'create' && (
          <CreateListingPage onDone={() => setRoute('search')} />
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}