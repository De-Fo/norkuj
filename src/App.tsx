import { useEffect, useState } from 'react'
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

const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)

type Route = 'search' | 'auth' | 'profile' | 'my-listings'


export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [route, setRoute] = useState<Route>('search')
  const [authLoading, setAuthLoading] = useState(true)
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [showMap, setShowMap] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [editingListing, setEditingListing] = useState<Listing | null>(null)

  useEffect(() => {
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
      <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #2563eb', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (route === 'my-listings') {
  return (
    <MyListingsPage
      user={user}
      onBack={() => setRoute('search')}
      onEdit={(listing) => {
        setEditingListing(listing)
        setShowCreate(true)
        setRoute('search')   // ← added: must leave the early-return route first
      }}
    />
  )
}


  if (route === 'auth') return <AuthPage onBack={() => setRoute('search')} />
  if (route === 'profile') return <ProfilePage user={user} onBack={() => setRoute('search')} />

  const isAdmin = user ? ADMIN_UIDS.includes(user.id) : false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

      <header style={{
        height: 48, flexShrink: 0, background: 'var(--c-surface)',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'space-between',
      }}>
        <button onClick={() => setRoute('search')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Wordmark size="md" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <button onClick={() => setShowAdmin(true)} style={{
              padding: '5px 11px', background: '#7c3aed', color: 'white',
              border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>
              🛠 Admin
            </button>
          )}
          {user ? (
            <>
              <button onClick={() => setShowCreate(true)} style={{
                padding: '6px 14px', background: 'var(--c-text)', color: 'white',
                border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                + Přidat inzerát
              </button>
              <button onClick={() => setRoute('my-listings')} style={{
                padding: '6px 11px', background: 'transparent', color: 'var(--c-muted)',
                border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              }}>
                Moje inzeráty
              </button>
              <button onClick={() => setRoute('profile')} style={{
                padding: '6px 11px', background: 'transparent', color: 'var(--c-muted)',
                border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 12, cursor: 'pointer',
              }}>
                Nastavení profilu
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
              }}>Přihlásit</button>
              <button onClick={() => setRoute('auth')} style={{
                padding: '6px 14px', background: 'var(--c-text)', color: 'white',
                border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>Registrovat</button>
            </>
          )}
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <SearchPage
          filters={filters}
          onChange={setFilters}
          showMap={showMap}
          onToggleMap={() => setShowMap(v => !v)}
          onListingClick={id => setSelectedListingId(id)}        />
      </main>

      {showCreate && (
        <CreateListingPage
          onDone={() => { setShowCreate(false); setEditingListing(null) }}
          editListing={editingListing}
        />
      )}

      {selectedListingId && (
        <ListingDetail
          listingId={selectedListingId}
          onClose={() => setSelectedListingId(null)}
          onRequestAuth={() => setRoute('auth')}
        />
      )}

      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        :root {
          --c-bg: #f4f6f8;
          --c-surface: #ffffff;
          --c-border: #e2e8f0;
          --c-border-md: #cbd5e1;
          --c-text: #0f172a;
          --c-muted: #64748b;
          --c-faint: #94a3b8;
          --c-accent: #2563eb;
          --c-rk: #e2001a;
        }
      `}</style>
    </div>
  )
}