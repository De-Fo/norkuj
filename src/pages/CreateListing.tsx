import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { PropertyType } from '../lib/types'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import { validateStep, mapServerError } from '../lib/validation'
import type { FormData } from '../lib/validation'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY

const EMPTY: FormData = {
  title: '', description: '', property_type: '',
  price_czk: '', utilities_czk: '0', deposit_czk: '',
  area_sqm: '', floor: '', available_from: '', min_lease_months: '12',
  furnished: false, pets_allowed: false, parking: false, balcony: false, cellar: false,
  address_street: '', address_district: '',
  lat: null, lng: null, images: [],
}

const PROPERTY_TYPES: PropertyType[] = ['pokoj','1+kk','1+1','2+kk','2+1','3+kk','3+1','4+kk','4+1','atypical']
const DISTRICTS = ['Praha 1','Praha 2','Praha 3','Praha 4','Praha 5','Praha 6','Praha 7','Praha 8','Praha 9','Praha 10','Vinohrady','Žižkov','Holešovice','Smíchov','Dejvice','Bubeneč','Nusle','Vršovice','Košíře','Karlín','Letňany','Chodov','Modřany','Braník','Prosek','Střešovice','Řepy','Zbraslav']

// ── Styles ──────────────────────────────────────────────────
const inp = (hasError?: boolean): React.CSSProperties => ({
  width: '100%', padding: '9px 11px',
  border: `1px solid ${hasError ? '#dc2626' : 'var(--c-border)'}`,
  borderRadius: 8, fontSize: 13, color: 'var(--c-text)',
  background: hasError ? '#fff5f5' : 'white', outline: 'none',
  transition: 'border-color 0.15s',
})

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: 'var(--c-muted)',
  marginBottom: 4, display: 'block',
}

const errorMsg: React.CSSProperties = {
  fontSize: 11, color: '#dc2626', marginTop: 4,
}

// ── Sub-components ───────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <p style={errorMsg}>⚠ {error}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!checked)} style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? '#2563eb' : 'var(--c-border-md, #cbd5e1)',
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

function ProgressBar({ step, total }: { step: number; total: number }) {
  const STEPS = ['Základní info', 'Cena', 'Poloha', 'Fotky', 'Přehled']
  return (
    <div style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)', padding: '14px 24px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 10 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, flexShrink: 0,
                background: i < step ? '#dcfce7' : i === step ? '#2563eb' : 'var(--c-bg)',
                color: i < step ? '#15803d' : i === step ? 'white' : 'var(--c-faint)',
                border: i >= step ? '1px solid var(--c-border)' : 'none',
              }}>{i < step ? '✓' : i + 1}</div>
              <span style={{ fontSize: 10, color: i === step ? 'var(--c-text)' : 'var(--c-faint)', fontWeight: i === step ? 500 : 400, whiteSpace: 'nowrap' }}>
                {s}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: i < step ? '#86efac' : 'var(--c-border)', margin: '0 6px', marginBottom: 14 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────
interface Props { onDone: () => void }

export function CreateListingPage({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [success, setSuccess] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const mapInstance = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  const set = (p: Partial<FormData>) => {
    setForm(f => ({ ...f, ...p }))
    // Clear errors for changed fields
    const keys = Object.keys(p)
    setFieldErrors(prev => {
      const next = { ...prev }
      keys.forEach(k => delete next[k])
      return next
    })
  }

  const err = (field: string) => fieldErrors[field]

  const goNext = () => {
    const errors = validateStep(step, form)
    if (errors.length > 0) {
      const map: Record<string, string> = {}
      errors.forEach(e => { map[e.field] = e.message })
      setFieldErrors(map)
      // Scroll to first error
      setTimeout(() => {
        document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }
    setFieldErrors({})
    setStep(s => s + 1)
  }

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
    const valid = Array.from(files).filter(f => {
      if (f.size > 10 * 1024 * 1024) return false // 10MB hard limit
      if (!f.type.startsWith('image/')) return false
      return true
    })
    const rejected = Array.from(files).length - valid.length
    if (rejected > 0) setFieldErrors(p => ({ ...p, images: `${rejected} souborů bylo přeskočeno (max 10 MB, pouze obrázky)` }))
    set({ images: [...form.images, ...valid].slice(0, 20) })
  }

  const handleSubmit = async () => {
    setUploading(true)
    setSubmitError(null)
    setUploadProgress(0)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('JWT expired')

      // Upload images with progress
      const imagePaths: string[] = []
      for (let i = 0; i < form.images.length; i++) {
        const file = form.images[i]
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${user.id}/${Date.now()}_${i}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('listing-images')
          .upload(path, file, { contentType: file.type })
        if (upErr) throw upErr
        imagePaths.push(path)
        setUploadProgress(Math.round(((i + 1) / form.images.length) * 80))
      }

      setUploadProgress(85)

      const { error: insErr } = await supabase.from('listings').insert([{
        owner_id: user.id,
        title: form.title.trim(),
        description: form.description.trim(),
        property_type: form.property_type as PropertyType,
        price_czk: parseInt(form.price_czk),
        utilities_czk: parseInt(form.utilities_czk) || 0,
        deposit_czk: form.deposit_czk ? parseInt(form.deposit_czk) : null,
        area_sqm: parseInt(form.area_sqm),
        floor: form.floor ? parseInt(form.floor) : null,
        available_from: form.available_from,
        min_lease_months: parseInt(form.min_lease_months) || 12,
        furnished: form.furnished,
        pets_allowed: form.pets_allowed,
        parking: form.parking,
        balcony: form.balcony,
        cellar: form.cellar,
        address_street: form.address_street.trim(),
        address_city: 'Praha',
        address_district: form.address_district,
        location: `POINT(${form.lng} ${form.lat})`,
        image_paths: imagePaths,
        status: 'pending_review',
      }] as any)

      if (insErr) throw insErr

      setUploadProgress(100)
      setSuccess(true)

    } catch (e: any) {
      setSubmitError(mapServerError(e))
    }

    setUploading(false)
  }

  const isDirty = form.title.length > 0 || form.description.length > 0

  const requestClose = () => {
    if (isDirty && !success) { setConfirmClose(true); return }
    onDone()
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) requestClose() }}
    >
      <div style={{ width: '80%', maxWidth: 860, height: '85vh', background: 'var(--c-surface)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative' }}>

        {/* Close */}
        <button onClick={requestClose} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--c-bg)', color: 'var(--c-muted)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

        {/* ── Success screen ── */}
        {success && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
            <div style={{ fontSize: 56 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--c-text)' }}>Inzerát odeslán!</h2>
            <p style={{ fontSize: 14, color: 'var(--c-muted)', textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
              Zkontrolujeme ho a zveřejníme co nejdříve. Dostaneš potvrzení na email.
            </p>
            <button onClick={onDone} style={{ marginTop: 8, padding: '10px 28px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              Zpět na hledání
            </button>
          </div>
        )}

        {/* ── Confirm close ── */}
        {!success && confirmClose && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <p style={{ fontSize: 15, color: 'var(--c-text)', textAlign: 'center', maxWidth: 300 }}>
              Rozpracovaný inzerát se neuloží. Opravdu chceš zavřít?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmClose(false)} style={{ padding: '9px 18px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>
                Pokračovat
              </button>
              <button onClick={onDone} style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: '#dc2626', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Zahodit a zavřít
              </button>
            </div>
          </div>
        )}

        {/* ── Form ── */}
        {!success && !confirmClose && (
          <>
            <ProgressBar step={step} total={5} />

            <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
              <div style={{ maxWidth: 540, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Step 0 — Basic info */}
                {step === 0 && <>
                  <Field label="Název inzerátu *" error={err('title')}>
                    <input
                      data-error={err('title') ? '' : undefined}
                      style={inp(!!err('title'))}
                      placeholder="Světlý byt 2+kk, Vinohrady, k dispozici ihned"
                      value={form.title}
                      onChange={e => set({ title: e.target.value })}
                    />
                    <div style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 3, textAlign: 'right' }}>
                      {form.title.length}/120
                    </div>
                  </Field>

                  <Field label="Popis *" error={err('description')}>
                    <textarea
                      data-error={err('description') ? '' : undefined}
                      style={{ ...inp(!!err('description')), minHeight: 120, resize: 'vertical' }}
                      placeholder="Popište byt — co je v okolí, jak je vybavený, podmínky pronájmu..."
                      value={form.description}
                      onChange={e => set({ description: e.target.value })}
                    />
                    <div style={{ fontSize: 11, color: form.description.length < 20 ? '#dc2626' : 'var(--c-faint)', marginTop: 3, textAlign: 'right' }}>
                      {form.description.trim().length}/5000 {form.description.trim().length < 20 && `(min. 20)`}
                    </div>
                  </Field>

                  <Field label="Typ nabídky *" error={err('property_type')}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {PROPERTY_TYPES.map(t => (
                        <button key={t} onClick={() => set({ property_type: t })} style={{
                          padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                          border: form.property_type === t ? 'none' : `1px solid ${err('property_type') ? '#fca5a5' : 'var(--c-border)'}`,
                          background: form.property_type === t ? 'var(--c-text)' : 'white',
                          color: form.property_type === t ? 'white' : 'var(--c-text)',
                        }}>{PROPERTY_TYPE_LABELS[t]}</button>
                      ))}
                    </div>
                    {err('property_type') && <p style={errorMsg}>⚠ {err('property_type')}</p>}
                  </Field>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Plocha (m²) *" error={err('area_sqm')}>
                      <input style={inp(!!err('area_sqm'))} type="number" placeholder="55" value={form.area_sqm} onChange={e => set({ area_sqm: e.target.value })} />
                    </Field>
                    <Field label="Patro">
                      <input style={inp()} type="number" placeholder="2" value={form.floor} onChange={e => set({ floor: e.target.value })} />
                    </Field>
                  </div>

                  <Field label="Dostupné od *" error={err('available_from')}>
                    <input style={inp(!!err('available_from'))} type="date" value={form.available_from} onChange={e => set({ available_from: e.target.value })} />
                  </Field>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 4 }}>
                    <Toggle checked={form.furnished} onChange={v => set({ furnished: v })}>Zařízený</Toggle>
                    <Toggle checked={form.pets_allowed} onChange={v => set({ pets_allowed: v })}>Zvířata OK</Toggle>
                    <Toggle checked={form.parking} onChange={v => set({ parking: v })}>Parkování</Toggle>
                    <Toggle checked={form.balcony} onChange={v => set({ balcony: v })}>Balkon</Toggle>
                    <Toggle checked={form.cellar} onChange={v => set({ cellar: v })}>Sklep</Toggle>
                  </div>
                </>}

                {/* Step 1 — Price */}
                {step === 1 && <>
                  <Field label="Nájemné (Kč/měs) *" error={err('price_czk')}>
                    <input style={inp(!!err('price_czk'))} type="number" placeholder="18 000" value={form.price_czk} onChange={e => set({ price_czk: e.target.value })} />
                  </Field>

                  <Field label="Zálohy / energie (Kč/měs)">
                    <input style={inp()} type="number" placeholder="3 000" value={form.utilities_czk} onChange={e => set({ utilities_czk: e.target.value })} />
                  </Field>

                  {form.price_czk && (
                    <div style={{ padding: '10px 14px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 13 }}>
                      Celkem: <strong>{(parseInt(form.price_czk || '0') + parseInt(form.utilities_czk || '0')).toLocaleString('cs-CZ')} Kč/měs</strong>
                    </div>
                  )}

                  <Field label="Kauce (Kč)">
                    <input style={inp()} type="number" placeholder="36 000" value={form.deposit_czk} onChange={e => set({ deposit_czk: e.target.value })} />
                  </Field>

                  <Field label="Minimální délka nájmu (měsíce)">
                    <input style={inp()} type="number" placeholder="12" value={form.min_lease_months} onChange={e => set({ min_lease_months: e.target.value })} />
                  </Field>
                </>}

                {/* Step 2 — Location */}
                {step === 2 && <>
                  <Field label="Ulice a číslo popisné *" error={err('address_street')}>
                    <input style={inp(!!err('address_street'))} placeholder="Mánesova 12" value={form.address_street} onChange={e => set({ address_street: e.target.value })} />
                  </Field>

                  <Field label="Část Prahy *" error={err('address_district')}>
                    <select style={inp(!!err('address_district'))} value={form.address_district} onChange={e => set({ address_district: e.target.value })}>
                      <option value="">— Vyber —</option>
                      {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>

                  <Field label="Přesná poloha na mapě *" error={err('location')}>
                    <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 6 }}>
                      Klikni na mapu pro umístění špendlíku. Adresa bude zobrazena v inzerátu. Špendlík ukazuje přibližnou polohu..
                    </div>
                    <div ref={initMap} style={{ height: 280, borderRadius: 10, overflow: 'hidden', border: `1px solid ${err('location') ? '#dc2626' : 'var(--c-border)'}` }} />
                    {form.lat
                      ? <p style={{ fontSize: 11, color: '#15803d', marginTop: 6 }}>✓ Poloha označena</p>
                      : <p style={{ fontSize: 11, color: 'var(--c-faint)', marginTop: 6 }}>Klikni na mapu</p>
                    }
                  </Field>
                </>}

                {/* Step 3 — Photos */}
                {step === 3 && <>
                  <div style={{ fontSize: 13, color: 'var(--c-muted)', lineHeight: 1.5 }}>
                    Přidej fotky bytu. První fotka bude hlavní. Max 20 fotek, každá do 10 MB.
                  </div>

                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, border: `2px dashed ${err('images') ? '#dc2626' : 'var(--c-border)'}`, borderRadius: 10, cursor: 'pointer', color: 'var(--c-muted)', fontSize: 13, gap: 6 }}>
                    <span style={{ fontSize: 28 }}>📷</span>
                    Klikni nebo přetáhni fotky
                    <span style={{ fontSize: 11 }}>{form.images.length}/20 nahráno</span>
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleImages(e.target.files)} />
                  </label>

                  {err('images') && <p style={errorMsg}>⚠ {err('images')}</p>}

                  {form.images.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {form.images.map((f, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 8, border: i === 0 ? '2px solid #2563eb' : '1px solid var(--c-border)' }} />
                          {i === 0 && <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, background: '#2563eb', color: 'white', padding: '1px 5px', borderRadius: 4 }}>Hlavní</span>}
                          <button onClick={() => set({ images: form.images.filter((_, j) => j !== i) })} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>}

                {/* Step 4 — Review */}
                {step === 4 && <>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Zkontroluj a odešli</div>

                  {[
                    ['Název', form.title],
                    ['Typ', PROPERTY_TYPE_LABELS[form.property_type as PropertyType] ?? '—'],
                    ['Plocha', `${form.area_sqm} m²`],
                    ['Nájemné', `${parseInt(form.price_czk||'0').toLocaleString('cs-CZ')} Kč + ${parseInt(form.utilities_czk||'0').toLocaleString('cs-CZ')} Kč zálohy`],
                    ['Kauce', form.deposit_czk ? `${parseInt(form.deposit_czk).toLocaleString('cs-CZ')} Kč` : '—'],
                    ['Adresa', `${form.address_street}, ${form.address_district}`],
                    ['Poloha', form.lat ? '✓ Označena na mapě' : '✗ Chybí — vrať se na krok 3'],
                    ['Fotky', form.images.length > 0 ? `${form.images.length} fotografií` : 'Žádné — byt bez fotek se hůř pronajímá'],
                    ['Min. nájem', `${form.min_lease_months} měsíců`],
                    ['Vybavení', [form.furnished && 'Zařízený', form.pets_allowed && 'Zvířata OK', form.parking && 'Parking', form.balcony && 'Balkon', form.cellar && 'Sklep'].filter(Boolean).join(', ') || '—'],
                  ].map(([k, v]) => (
                    <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--c-border)', fontSize: 13, gap: 12 }}>
                      <span style={{ color: 'var(--c-muted)', flexShrink: 0 }}>{k}</span>
                      <span style={{ fontWeight: 500, textAlign: 'right', color: (k === 'Poloha' && !form.lat) ? '#dc2626' : 'var(--c-text)' }}>{v}</span>
                    </div>
                  ))}

                  <div style={{ padding: '12px 14px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 12, color: '#0369a1', lineHeight: 1.6 }}>
                    Po odeslání inzerát projde rychlou kontrolou a bude zveřejněn. Přesná adresa není zobrazena — pouze čtvrť.
                  </div>

                  {submitError && (
                    <div style={{ padding: '12px 14px', background: '#fee2e2', borderRadius: 8, border: '1px solid #fca5a5', fontSize: 13, color: '#b91c1c' }}>
                      ⚠ {submitError}
                    </div>
                  )}

                  {uploading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ height: 6, background: 'var(--c-bg)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#2563eb', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>
                        {uploadProgress < 80 ? `Nahrávám fotky... ${uploadProgress}%` : uploadProgress < 100 ? 'Ukládám inzerát...' : 'Hotovo!'}
                      </span>
                    </div>
                  )}
                </>}

              </div>
            </div>

            {/* Navigation */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--c-border)', background: 'var(--c-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <button onClick={step === 0 ? requestClose : () => setStep(s => s - 1)} style={{ padding: '9px 18px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'white', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer' }}>
                {step === 0 ? 'Zrušit' : '← Zpět'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {Object.keys(fieldErrors).length > 0 && (
                  <span style={{ fontSize: 11, color: '#dc2626' }}>
                    Oprav {Object.keys(fieldErrors).length} {Object.keys(fieldErrors).length === 1 ? 'chybu' : 'chyby'}
                  </span>
                )}
                {step < 4
                  ? <button onClick={goNext} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: 'var(--c-text)', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                      Pokračovat →
                    </button>
                  : <button onClick={handleSubmit} disabled={uploading || !form.lat} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: uploading || !form.lat ? 'var(--c-border-md)' : '#16a34a', color: 'white', fontSize: 13, fontWeight: 500, cursor: uploading ? 'not-allowed' : 'pointer' }}>
                      {uploading ? 'Odesílám...' : '✓ Odeslat inzerát'}
                    </button>
                }
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}