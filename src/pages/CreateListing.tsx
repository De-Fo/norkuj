import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { PropertyType, Listing } from '../lib/types'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import { DISTRICT_GROUPS, suggestDistricts, ALL_DISTRICTS, findDistrictsForPoint } from '../lib/districts'
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
  address_districts: string[]     // 1–2 districts (e.g. ['Vinohrady', 'Praha 2'])
  lat: number | null
  lng: number | null
  images: File[]
}

const EMPTY: FormData = {
  title: '', description: '', property_type: '',
  price_czk: '', utilities_czk: '0', deposit_czk: '',
  area_sqm: '', floor: '', available_from: '', min_lease_months: '12',
  furnished: false, pets_allowed: false, parking: false, balcony: false, cellar: false,
  address_street: '', address_districts: [],
  lat: null, lng: null, images: [],
}

const PROPERTY_TYPES: PropertyType[] = ['pokoj','1+kk','1+1','2+kk','2+1','3+kk','3+1','4+kk','4+1','atypical']
const DISTRICTS = ALL_DISTRICTS

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
  editListing?: Listing | null
}

export function CreateListingPage({ onDone, editListing }: Props) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(() =>
    editListing ? {
      title: editListing.title,
      description: editListing.description,
      property_type: editListing.property_type,
      price_czk: String(editListing.price_czk),
      utilities_czk: String(editListing.utilities_czk),
      deposit_czk: editListing.deposit_czk ? String(editListing.deposit_czk) : '',
      area_sqm: String(editListing.area_sqm),
      floor: editListing.floor != null ? String(editListing.floor) : '',
      available_from: editListing.available_from,
      min_lease_months: String(editListing.min_lease_months),
      furnished: editListing.furnished,
      pets_allowed: editListing.pets_allowed,
      parking: editListing.parking,
      balcony: editListing.balcony,
      cellar: editListing.cellar,
      address_street: editListing.address_street,
      address_districts: (editListing.address_district ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
      lat: null, // re-select on map; existing geography not easily reversed client-side
      lng: null,
      images: [],
    } : EMPTY
  )
  const isEdit = !!editListing
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [districtSuggestions, setDistrictSuggestions] = useState<string[]>([])
  const mapInstance = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  const set = (p: Partial<FormData>) => setForm(f => ({ ...f, ...p }))
  const STEPS = ['Základní info', 'Cena & detaily', 'Poloha na mapě', 'Fotografie', 'Přehled']
  const isDirty = form.title.length > 0 || form.description.length > 0 || form.price_czk.length > 0

  useEffect(() => {
    if (step !== 2) return
    if (!mapContainerRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: form.lat && form.lng ? [form.lng, form.lat] : [14.4208, 50.0880],
      zoom: 12,
    })

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat
      set({ lat, lng })
      if (markerRef.current) markerRef.current.remove()
      markerRef.current = new maplibregl.Marker({ color: '#2563eb' }).setLngLat([lng, lat]).addTo(map)
      // Auto-detect districts from map click (max 2)
      const detected = findDistrictsForPoint(lat, lng)
      if (detected.length > 0) {
        let newDists: string[] = []
        for (let i = 0; i < Math.min(detected.length, 2); i++) {
          const d = detected[i]
          if (!newDists.includes(d)) newDists.push(d)
          // Also add parent group if not included
          const parent = DISTRICT_GROUPS.find(g => g.children.includes(d) && !newDists.includes(g.group))
          if (parent && newDists.length < 2) newDists.push(parent.group)
        }
        set({ address_districts: newDists.slice(0, 2) })
      }
    })

    if (form.lat && form.lng) {
      markerRef.current = new maplibregl.Marker({ color: '#2563eb' }).setLngLat([form.lng, form.lat]).addTo(map)
    }

    mapInstance.current = map

    return () => {
      map.remove()
      mapInstance.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

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

      const imagePaths: string[] = isEdit ? [...(editListing!.image_paths ?? [])] : []
      for (const file of form.images) {
        const path = `${user.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        const { error: upErr } = await supabase.storage.from('listing-images').upload(path, file)
        if (upErr) throw new Error('Nahrávání fotky selhalo: ' + upErr.message)
        imagePaths.push(path)
      }

      const payload = {
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
        address_district: form.address_districts.join(', '),
        address_district_group: (() => {
          for (const d of form.address_districts) {
            const g = DISTRICT_GROUPS.find(g => g.group === d)
            if (g) return d
          }
          return null
        })(),
        location: `POINT(${form.lng} ${form.lat})`,
        image_paths: imagePaths,
      }

      if (isEdit) {
        const { error: updErr } = await (supabase.from('listings') as any)
          .update({
            ...payload,
            status: 'pending_review',
            rejection_reason: null,
          })
          .eq('id', editListing!.id)
          .eq('owner_id', user.id)
        if (updErr) throw updErr
      } else {
        const { error: insErr } = await (supabase.from('listings') as any)
          .insert([{ ...payload, owner_id: user.id, status: 'pending_review' }])
        if (insErr) throw insErr
      }

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

        <button onClick={requestClose} style={{
          position: 'absolute', top: 14, right: 14, zIndex: 5,
          width: 28, height: 28, borderRadius: '50%', border: 'none',
          background: 'var(--c-bg)', color: 'var(--c-muted)', fontSize: 14,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

        {success ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontSize: 48 }}>✅</span>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>
              {isEdit ? 'Úprava odeslána ke kontrole' : 'Inzerát odeslán ke kontrole'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--c-muted)', textAlign: 'center', maxWidth: 320 }}>
              {isEdit
                ? 'Zkontrolujeme změny a brzy je znovu zveřejníme. Dostaneš email s potvrzením.'
                : 'Zkontrolujeme ho a brzy zveřejníme. Dostaneš email s potvrzením.'}
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
                      <input style={inp} placeholder="Mánesova 12, Vinohrady" value={form.address_street}
                        onChange={e => {
                          const val = e.target.value
                          set({ address_street: val })
                          if (val.length >= 3) {
                            setDistrictSuggestions(suggestDistricts(val))
                          } else {
                            setDistrictSuggestions([])
                          }
                        }} />
                      {districtSuggestions.length > 0 && (
                        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, color: 'var(--c-faint)' }}>Našli jsme:</span>
                          {districtSuggestions.map(s => (
                            <button key={s} onClick={() => {
                              const newDists = [...form.address_districts]
                              // Only add if not already selected and under limit
                              if (!newDists.includes(s) && newDists.length < 2) {
                                newDists.push(s)
                                // If s is a child district, try to add its parent too (if room)
                                const parents = DISTRICT_GROUPS.filter(g => g.children.includes(s)).map(g => g.group)
                                for (const p of parents) {
                                  if (newDists.length >= 2) break
                                  if (!newDists.includes(p)) newDists.push(p)
                                }
                              }
                              set({ address_districts: newDists })
                              setDistrictSuggestions([])
                            }} style={{
                              padding: '2px 8px', borderRadius: 10, cursor: 'pointer',
                              border: '1px solid var(--c-border)', background: '#f0f9ff',
                              color: '#0369a1', fontSize: 10, fontWeight: 500,
                            }}>
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={label}>Přesná poloha — klikni na mapu *</label>
                      <div ref={mapContainerRef} style={{ height: 280, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--c-border)' }} />
                      {form.lat
                        ? <p style={{ fontSize: 11, color: '#15803d', marginTop: 6 }}>✓ Poloha označena ({form.lat.toFixed(5)}, {form.lng?.toFixed(5)})</p>
                        : <p style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 6 }}>Klikni na mapu pro označení polohy</p>}
                    </div>
                    <div>
                      <label style={label}>Čtvrť / Část Prahy * <span style={{fontWeight:400,color:'var(--c-faint)'}}>lze vybrat 1–2</span></label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {DISTRICTS.map(d => {
                          const active = form.address_districts.includes(d)
                          return (
                            <button key={d} onClick={() => {
                              let newDists = [...form.address_districts]
                              if (active) {
                                newDists = newDists.filter(x => x !== d)
                              } else if (newDists.length < 2) {
                                newDists.push(d)
                              }
                              set({ address_districts: newDists })
                            }} style={{
                              padding: '4px 10px', borderRadius: 14, cursor: 'pointer',
                              border: active ? 'none' : '1px solid var(--c-border)',
                              background: active ? '#2563eb' : 'var(--c-surface)',
                              color: active ? '#fff' : 'var(--c-muted)',
                              fontSize: 11, fontWeight: 500, transition: 'all 0.12s',
                            }}>
                              {d}
                              {active && <span style={{ marginLeft: 4 }}>✕</span>}
                            </button>
                          )
                        })}
                      </div>
                      {form.address_districts.length === 0 && (
                        <p style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 4 }}>Vyber alespoň 1 oblast</p>
                      )}
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
                    {isEdit && (
                      <div style={{ padding: '10px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 12, color: '#9a3412' }}>
                        ⚠️ Úprava inzerátu vyžaduje opětovné schválení administrátorem. Inzerát dočasně zmizí z vyhledávání, dokud ho znovu neschválíme.
                      </div>
                    )}
                    {[
                      ['Název', form.title],
                      ['Typ', PROPERTY_TYPE_LABELS[form.property_type as PropertyType] ?? '—'],
                      ['Plocha', `${form.area_sqm} m²`],
                      ['Nájemné', `${parseInt(form.price_czk||'0').toLocaleString('cs-CZ')} Kč/měs`],
                      ['Zálohy', `${parseInt(form.utilities_czk||'0').toLocaleString('cs-CZ')} Kč/měs`],
                      ['Adresa', `${form.address_street}, ${form.address_districts.join(', ')}`],
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
                  }}>{uploading ? 'Odesílám...' : isEdit ? 'Uložit a poslat ke kontrole' : 'Odeslat ke kontrole'}
                </button>
              }
            </div>
          </>
        )}
      </div>
    </div>
  )
} 