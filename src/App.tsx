import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { SearchPage } from './pages/Search'
import { AuthPage } from './pages/Auth'

type Route = 'search' | 'auth' | 'create'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [route, setRoute] = useState<Route>('search')
  const [authLoading, setAuthLoading] = useState(true)

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (route === 'auth') return <AuthPage />

  return (
    <div className="flex flex-col h-screen">
      {/* Topbar */}
      <header className="h-11 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-10">
        <button onClick={() => setRoute('search')} className="font-bold text-blue-700 text-base">
          Norkuj 🏠
        </button>
        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <button
                onClick={() => setRoute('create')}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Přidat inzerát
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                Odhlásit
              </button>
            </>
          ) : (
            <button
              onClick={() => setRoute('auth')}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Přihlásit se
            </button>
          )}
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-hidden">
        {route === 'search' && <SearchPage />}
        {route === 'create' && (
          <div className="flex items-center justify-center h-full text-gray-400">
            Formulář pro přidání inzerátu — bude doplněn (Phase 2)
          </div>
        )}
      </main>
    </div>
  )
}