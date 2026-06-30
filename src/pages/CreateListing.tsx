import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { PropertyType } from '../lib/types'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY

interface FormData {
  title: string
  description: string
  property_type: PropertyType | ''
  price_czk: string
  utilities_czk: string
  deposit_czk: string
  area_sqm: string
  floor: string
  available_from: string
  min_lease_months: string
  furnished: boolean
  pets_allowed: boolean
  parking: boolean
  balcony: boolean
  cellar: boolean
  address_street: string
  address_district: string
  lat: number | null
  lng: number | null
  images: File[]
}

const EMPTY: FormData = {
  title: '', description: '', property_type: '',
  price_czk: '', utilities_czk: '0', deposit_czk: '',
  area_sqm: '', floor: '', available_from: '', min_lease_months: '12',
  furnished: false, pets_allowed: false, parking: false, balcony: false, cellar: false,
  address_street: '', address_district: '',
  lat: null, lng: null, images: [],
}

const PROPERTY_TYPES: PropertyType[] = ['pokoj','1+kk','1+1','2+kk','2+1','3+kk','3+1','4+kk','4+1','atypical']
const DISTRICTS = ['Praha 1','Praha 2','Praha 3','Praha 4','Praha 5','Praha 6','Praha 7','Praha 8','Praha 9','Praha 10','Vinohrady','Žižkov','Holešovice','Smíchov','Dejvice','Bubeneč','Nusle','Vršovice','Košíře','Letňany','Chodov','Modřany']

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 11px', border: '1px solid var(--c-border)',
  borderRadius: 8, fontSize: 13, color: 'var(--c-text)', background: 'white', outline: 'none',
}
const label: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--c-muted)', marginBottom: 4, display: 'block' }

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!checked)} style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? '#2563eb' : 'var(--c-border-md)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 3, left: checked ? 19 : 3,
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--c-text)' }}>{children}</span>
    </label>
  )
}

interface Props {
  onDone: () => void          // close modal entirely (after success or explicit cancel)
  onMinimize?: () => void     // hide but keep state (X button while editing)
}

export function CreateListingPage({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const mapInstance = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  const set = (p: Partial<FormData>) => setForm(f => ({ ...f, ...p }))
  const STEPS = ['Základní info', 'Cena & detaily', 'Poloha na mapě', 'Fotografie', 'Přehled']
  const isDirty = form.title.length > 0 || form.description.length > 0 || form.price_czk.length > 0

  const initMap = (el: HTMLDivElement | null) => {
    if (!el || mapInstance.current) return
    const map = new maplibregl.Map({
      container: el,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: [14.4208, 50.0880], zoom: 12,
    })
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat
      set({ lat, lng })
      if (markerRef.current) markerRef.current.remove()
      markerRef.current = new maplibregl.Marker({ color: '#2563eb' }).setLngLat([lng, lat]).addTo(map)
    })
    mapInstance.current = map
  }

  const handleImages = (files: FileList | null) => {
    if (!files) return
    set({ images: [...form.images, ...Array.from(files)].slice(0, 20) })
  }

  const handleSubmit = async () => {
    setUploading(true); setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nejsi přihlášen')
      if (!form.lat || !form.lng) throw new Error('Vyber polohu na mapě')

      const imagePaths: string[] = []
      for (const file of form.images) {
        const path = `${user.id}/${Date.now()}_${file.name.replace(/\s/g, '_')}`
        const { error: upErr } = await supabase.storage.from('listing-images').upload(path, file)
        if (upErr) throw new Error(`Nahrávání fotky selhalo: ${upErr.message}`)
        imagePaths.push(path)
      }

      const { error: insErr } = await supabase.from('listings').insert([{
        owner_id: user.id,
        title: form.title,
        description: form.description,
        property_type: form.property_type as PropertyType,
        price_czk: parseInt(form.price_czk),
        utilities_czk: parseInt(form.utilities_czk) || 0,
        deposit_czk: form.deposit_czk ? parseInt(form.deposit_czk) : null,
        area_sqm: parseInt(form.area_sqm),
        floor: form.floor ? parseInt(form.floor) : null,
        available_from: form.available_from,
        min_lease_months: parseInt(form.min_lease_months),
        furnished: form.furnished,
        pets_allowed: form.pets_allowed,
        parking: form.parking,
        balcony: form.balcony,
        cellar: form.cellar,
        address_street: form.address_street,
        address_city: 'Praha',
        address_district: form.address_district,
        location: `POINT(${form.lng} ${form.lat})`,
        image_paths: imagePaths,
        status: 'pending_review',
      }] as any)

      if (insErr) throw insErr
      setSuccess(true)
    } catch (e: any) {
      setError(e.message ?? 'Chyba při ukládání')
    }
    setUploading(false)
  }

  const requestClose = () => {
    if (isDirty && !success) setConfirmClose(true)
    else onDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: 20,
    }} onClick={(e) => { if (e.target === e.currentTarget) requestClose() }}>

      <div style={{
        width: '80%', height: '80%', maxWidth: 900,
        background: 'var(--c-surface)', borderRadius: 16,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative',
      }}>

        {/* Close button */}
        <button onClick={requestClose} style={{
          position: 'absolute', top: 14, right: 14, zIndex: 5,
          width: 28, height: 28, borderRadius: '50%', border: 'none',
          background: 'var(--c-bg)', color: 'var(--c-muted)', fontSize: 14,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

        {success ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontSize: 48 }}>✅</span>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Inzerát odeslán ke kontrole</h2>
            <p style={{ fontSize: 13, color: 'var(--c-muted)', textAlign: 'center', maxWidth: 320 }}>
              Zkontrolujeme ho a brzy zveřejníme. Dostaneš email s potvrzením.
            </p>
            <button onClick={onDone} style={{
              marginTop: 8, padding: '10px 24px', background: 'var(--c-text)', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              Zpět na hlavní stránku
            </button>
          </div>
        ) : confirmClose ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <span style={{ fontSize: 36 }}>⚠️</span>
            <p style={{ fontSize: 14, color: 'var(--c-text)', textAlign: 'center', maxWidth: 280 }}>
              Rozpracovaný inzerát se neuloží. Opravdu chceš zavřít?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmClose(false)} style={{
                padding: '8px 16px', border: '1px solid var(--c-border)', borderRadius: 8,
                background: 'white', fontSize: 13, cursor: 'pointer',
              }}>Pokračovat v editaci</button>
              <button onClick={onDone} style={{
                padding: '8px 16px', border: 'none', borderRadius: 8,
                background: '#dc2626', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}>Zahodit a zavřít</button>
            </div>
          </div>
        ) : (
          <>
            {/* Step indicator */}
            <div style={{
              background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)',
              padding: '14px 24px', display: 'flex', alignItems: 'center', flexShrink: 0,
            }}>
              {STEPS.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
                      background: i < step ? '#dcfce7' : i === step ? '#2563eb' : 'var(--c-bg)',
                      color: i < step ? '#15803d' : i === step ? 'white' : 'var(--c-faint)',
                      border: i === step ? 'none' : '1px solid var(--c-border)', flexShrink: 0,
                    }}>{i < step ? '✓' : i + 1}</div>
                    <span style={{ fontSize: 12, color: i === step ? 'var(--c-text)' : 'var(--c-faint)', fontWeight: i === step ? 500 : 400 }}>
                      {s}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && <div style={{ width: 24, height: 1, background: 'var(--c-border)', margin: '0 8px' }} />}
                </div>
              ))}
            </div>

            {/* Step content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              <div style={{ maxWidth: 540, margin: '0 auto' }}>

                {step === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={label}>Název inzerátu *</label>
                      <input style={inp} placeholder="Světlý byt 2+kk v centru Prahy" value={form.title} onChange={e => set({ title: e.target.value })} />
                    </div>
                    <div>
                      <label style={label}>Popis *</label>
                      <textarea style={{ ...inp, minHeight: 120, resize: 'vertical' }} placeholder="Popište byt, lokalitu, dostupnost MHD..." value={form.description} onChange={e => set({ description: e.target.value })} />
                    </div>
                    <div>
                      <label style={label}>Typ nabídky *</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {PROPERTY_TYPES.map(t => (
                          <button key={t} onClick={() => set({ property_type: t })} style={{
                            padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                            border: form.property_type === t ? 'none' : '1px solid var(--c-border)',
                            background: form.property_type === t ? 'var(--c-text)' : 'white',
                            color: form.property_type === t ? 'white' : 'var(--c-text)',
                          }}>{PROPERTY_TYPE_LABELS[t]}</button>
                        ))}
                      </div>
                      {form.property_type === 'pokoj' && (
                        <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 6 }}>
                          Pokoj ve sdíleném bytě — vhodné pro spolubydlení.
                        </p>
                      )}
                    </div>
                    <div>
                      <label style={label}>Plocha (m²) *</label>
                      <input style={inp} type="number" placeholder="55" value={form.area_sqm} onChange={e => set({ area_sqm: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={label}>Patro</label>
                        <input style={inp} type="number" placeholder="2" value={form.floor} onChange={e => set({ floor: e.target.value })} />
                      </div>
                      <div>
                        <label style={label}>Dostupné od *</label>
                        <input style={inp} type="date" value={form.available_from} onChange={e => set({ available_from: e.target.value })} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Toggle checked={form.furnished} onChange={v => set({ furnished: v })}>Zařízený</Toggle>
                      <Toggle checked={form.pets_allowed} onChange={v => set({ pets_allowed: v })}>Zvířata OK</Toggle>
                      <Toggle checked={form.parking} onChange={v => set({ parking: v })}>Parkování</Toggle>
                      <Toggle checked={form.balcony} onChange={v => set({ balcony: v })}>Balkon</Toggle>
                      <Toggle checked={form.cellar} onChange={v => set({ cellar: v })}>Sklep</Toggle>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={label}>Nájemné (Kč/měs) *</label>
                      <input style={inp} type="number" placeholder="18000" value={form.price_czk} onChange={e => set({ price_czk: e.target.value })} />
                    </div>
                    <div>
                      <label style={label}>Zálohy / služby (Kč/měs)</label>
                      <input style={inp} type="number" placeholder="3000" value={form.utilities_czk} onChange={e => set({ utilities_czk: e.target.value })} />
                    </div>
                    <div>
                      <label style={label}>Kauce (Kč)</label>
                      <input style={inp} type="number" placeholder="36000" value={form.deposit_czk} onChange={e => set({ deposit_czk: e.target.value })} />
                    </div>
                    <div>
                      <label style={label}>Min. délka nájmu (měsíce)</label>
                      <input style={inp} type="number" placeholder="12" value={form.min_lease_months} onChange={e => set({ min_lease_months: e.target.value })} />
                    </div>
                    {form.price_czk && (
                      <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                        <span style={{ fontSize: 12, color: '#0369a1' }}>
                          Celkem: <strong>{(parseInt(form.price_czk || '0') + parseInt(form.utilities_czk || '0')).toLocaleString('cs-CZ')} Kč/měs</strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={label}>Ulice a číslo *</label>
                      <input style={inp} placeholder="Mánesova 12" value={form.address_street} onChange={e => set({ address_street: e.target.value })} />
                    </div>
                    <div>
                      <label style={label}>Čtvrť / Část Prahy *</label>
                      <select style={inp} value={form.address_district} onChange={e => set({ address_district: e.target.value })}>
                        <option value="">Vyber část Prahy</option>
                        {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={label}>Přesná poloha — klikni na mapu *</label>
                      <div ref={initMap} style={{ height: 280, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--c-border)' }} />
                      {form.lat
                        ? <p style={{ fontSize: 11, color: '#15803d', marginTop: 6 }}>✓ Poloha označena ({form.lat.toFixed(5)}, {form.lng?.toFixed(5)})</p>
                        : <p style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 6 }}>Klikni na mapu pro označení polohy</p>}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={label}>Fotografie (max 20)</label>
                      <label style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        height: 120, border: '2px dashed var(--c-border)', borderRadius: 10,
                        cursor: 'pointer', color: 'var(--c-muted)', fontSize: 13, gap: 6,
                      }}>
                        <span style={{ fontSize: 28 }}>📷</span>
                        Klikni nebo přetáhni fotky
                        <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleImages(e.target.files)} />
                      </label>
                    </div>
                    {form.images.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {form.images.map((f, i) => (
                          <div key={i} style={{ position: 'relative' }}>
                            <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} />
                            <button onClick={() => set({ images: form.images.filter((_, j) => j !== i) })} style={{
                              position: 'absolute', top: 3, right: 3, width: 18, height: 18,
                              borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                              color: 'white', fontSize: 10, cursor: 'pointer',
                            }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {step === 4 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>Přehled inzerátu</h3>
                    {[
                      ['Název', form.title],
                      ['Typ', PROPERTY_TYPE_LABELS[form.property_type as PropertyType] ?? '—'],
                      ['Plocha', `${form.area_sqm} m²`],
                      ['Nájemné', `${parseInt(form.price_czk||'0').toLocaleString('cs-CZ')} Kč/měs`],
                      ['Zálohy', `${parseInt(form.utilities_czk||'0').toLocaleString('cs-CZ')} Kč/měs`],
                      ['Adresa', `${form.address_street}, ${form.address_district}`],
                      ['Poloha', form.lat ? '✓ Označena' : '✗ Chybí'],
                      ['Fotky', `${form.images.length} fotografií`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--c-border)', fontSize: 13 }}>
                        <span style={{ color: 'var(--c-muted)' }}>{k}</span>
                        <span style={{ fontWeight: 500 }}>{v}</span>
                      </div>
                    ))}
                    {error && (
                      <div style={{ padding: '10px 12px', background: '#fee2e2', borderRadius: 8, color: '#b91c1c', fontSize: 12 }}>
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div style={{
              padding: '12px 24px', borderTop: '1px solid var(--c-border)',
              background: 'var(--c-surface)', display: 'flex', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <button onClick={step === 0 ? requestClose : () => setStep(s => s - 1)} style={{
                padding: '9px 18px', border: '1px solid var(--c-border)', borderRadius: 8,
                background: 'white', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer',
              }}>
                {step === 0 ? 'Zrušit' : '← Zpět'}
              </button>
              {step < 4
                ? <button onClick={() => setStep(s => s + 1)} style={{
                    padding: '9px 18px', border: 'none', borderRadius: 8,
                    background: 'var(--c-text)', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}>Pokračovat →</button>
                : <button onClick={handleSubmit} disabled={uploading} style={{
                    padding: '9px 18px', border: 'none', borderRadius: 8,
                    background: uploading ? 'var(--c-border-md)' : '#16a34a',
                    color: 'white', fontSize: 13, fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer',
                  }}>{uploading ? 'Odesílám...' : '✓ Odeslat ke kontrole'}</button>
              }
            </div>
          </>
        )}
      </div>
    </div>
  )
}