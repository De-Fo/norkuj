import { useState } from 'react'
import type { Listing } from '../lib/types'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import { useLang } from '../lib/lang'

interface Props {
  listing: Listing
  onClose: () => void
}

// Free, client-side rental-agreement generator.
export function ContractModal({ listing, onClose }: Props) {
  const { t, lang } = useLang()
  const cs = lang !== 'en'

  // Fact-of-the-listing prefills only — negotiated values stay empty.
  const [owner, setOwner] = useState('')
  const [tenant, setTenant] = useState('')
  const [address, setAddress] = useState(
    [listing.address_street, listing.address_district].filter(Boolean).join(', ')
  )
  const [rent, setRent] = useState(listing.price_total_czk ? String(listing.price_total_czk) : '')
  const [utilities, setUtilities] = useState(listing.utilities_czk ? String(listing.utilities_czk) : '')
  const [energies, setEnergies] = useState('')
  const [duration, setDuration] = useState('')
  const [extra1, setExtra1] = useState('')
  const [extra2, setExtra2] = useState('')

  const today = new Date().toLocaleDateString(cs ? 'cs-CZ' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' })

  const field = (label: string, value: string, set: (v: string) => void, multiline = false, flex = '1 1 auto') => (
    <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex }}>
      <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>{label}</span>
      <textarea
        value={value}
        onChange={e => set(e.target.value)}
        rows={multiline ? 4 : 1}
        placeholder="…"
        style={{
          width: '100%', resize: 'vertical', padding: '7px 9px',
          border: '1px solid var(--c-border)', borderRadius: 8,
          background: 'var(--c-bg)', color: 'var(--c-text)', fontSize: 13, outline: 'none',
        }}
      />
    </div>
  )

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 80, padding: window.innerWidth < 768 ? 0 : 16,
      }}>
      <div style={{
        background: 'var(--c-surface)', borderRadius: window.innerWidth < 768 ? 0 : 16,
        maxWidth: 560, width: '100%',
        maxHeight: window.innerWidth < 768 ? '100dvh' : '90dvh',
        height: window.innerWidth < 768 ? '100dvh' : undefined,
        display: 'flex', flexDirection: 'column',
        boxShadow: window.innerWidth < 768 ? 'none' : '0 24px 64px rgba(0,0,0,0.35)',
        overflow: 'hidden',
      }}>
        {/* Header — thin accent band + title */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: 3, background: 'var(--c-accent, #2563eb)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--c-border)' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>{t('_mylistings_contract_title')}</div>
              <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>{t('_mylistings_contract_for')} {listing.title}</div>
            </div>
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: 'var(--c-bg)', cursor: 'pointer', fontSize: 14,
              color: 'var(--c-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>✕</button>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {field(t('_mylistings_contract_owner'), owner, setOwner)}
          {field(t('_mylistings_contract_tenant'), tenant, setTenant)}
          {field(t('_mylistings_contract_address'), address, setAddress)}
          <div style={{ display: 'flex', gap: 8 }}>
            {field(t('_mylistings_contract_rent'), rent, setRent, false, '1 1 0')}
            {field(t('_mylistings_contract_utilities'), utilities, setUtilities, false, '1 1 0')}
          </div>
          {field(t('_mylistings_contract_energies'), energies, setEnergies)}
          {field(t('_mylistings_contract_duration'), duration, setDuration)}
          {field(t('_mylistings_contract_extra1'), extra1, setExtra1, true)}
          {field(t('_mylistings_contract_extra2'), extra2, setExtra2, true)}

          {/* Print-only contract sheet (hidden on screen via CSS, printed via @media print) */}
          <div className="norkuj-contract-sheet">
            {/* Top accent band — bleeds to the page edges */}
            <div style={{ height: 5, background: '#2563eb', margin: '-34px -46px 28px' }} />

            {/* ═══ Title block ═══ */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em', color: '#0f172a' }}>
                {cs ? 'NÁJEMNÍ SMLOUVA' : 'RENTAL AGREEMENT'}
              </div>
              <div style={{ marginTop: 4, fontSize: 10.5, color: '#64748b', letterSpacing: '0.05em' }}>
                {cs
                  ? 'Smlouva o nájmu bytu dle § 2235 a násl. zákona č. 89/2012 Sb., občanského zákoníku'
                  : 'Apartment lease under § 2235 et seq. of Act No. 89/2012 Sb., Civil Code'}
              </div>
            </div>

            {/* ═══ Parties ═══ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
              {[
                { eyebrow: cs ? 'PRONAJÍMATEL' : 'LANDLORD', value: owner || '–' },
                { eyebrow: cs ? 'NÁJEMCE' : 'TENANT', value: tenant || '–' },
              ].map(party => (
                <div key={party.eyebrow} style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#2563eb', letterSpacing: '0.14em' }}>{party.eyebrow}</div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: '#0f172a', minHeight: 18 }}>{party.value}</div>
                </div>
              ))}
            </div>

            {/* ═══ Subject ═══ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 8px' }}>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: '#2563eb', whiteSpace: 'nowrap' }}>
                {cs ? 'PŘEDMĚT NÁJMU' : 'SUBJECT OF LEASE'}
              </span>
              <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>
            <div style={{ fontSize: 12.5, color: '#0f172a', lineHeight: 1.7 }}>
              {cs ? 'Byt' : 'Apartment'} <strong>{PROPERTY_TYPE_LABELS[listing.property_type]}</strong>, {listing.area_sqm} m²
              <span style={{ color: '#64748b' }}>
                {address ? ` — ${address}` : (listing.address_street ? ` — ${listing.address_street}` : '')}
              </span>
            </div>

            {/* ═══ Payments ═══ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 8px' }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: '#2563eb', whiteSpace: 'nowrap' }}>
                {cs ? 'NÁJEMNÉ A ÚHRADY' : 'RENT AND CHARGES'}
              </span>
              <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9.5, color: '#64748b' }}>{cs ? 'Nájemné' : 'Rent'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{rent ? `${rent} Kč` : '–'} <span style={{ fontWeight: 400, color: '#64748b' }}>{cs ? 'měsíčně' : '/month'}</span></div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9.5, color: '#64748b' }}>{cs ? 'Služby a poplatky' : 'Utilities & services'}</div>
                <div style={{ fontSize: 13, color: '#0f172a' }}>{utilities ? `${utilities} Kč` : '–'}</div>
              </div>
            </div>
            {energies && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9.5, color: '#64748b' }}>{cs ? 'Energie (hradí)' : 'Energy (paid by)'}</div>
                <div style={{ fontSize: 13, color: '#0f172a' }}>{energies}</div>
              </div>
            )}

            {/* ═══ Other terms ═══ */}
            {(duration || extra1 || extra2) && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 8px' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: '#2563eb', whiteSpace: 'nowrap' }}>
                    {cs ? 'DALŠÍ UJEDNÁNÍ' : 'OTHER TERMS'}
                  </span>
                  <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>
                {duration && <div style={{ fontSize: 12.5, color: '#0f172a', marginTop: 4 }}>{cs ? 'Doba nájmu:' : 'Lease period:'} <strong>{duration}</strong></div>}
                {extra1 && <div style={{ fontSize: 12, color: '#334155', marginTop: 8, whiteSpace: 'pre-wrap' }}>{extra1}</div>}
                {extra2 && <div style={{ fontSize: 12, color: '#334155', marginTop: 6, whiteSpace: 'pre-wrap' }}>{extra2}</div>}
              </>
            )}

            {/* ═══ Signature block ═══ */}
            <div style={{ fontSize: 11, color: '#334155', marginTop: 30 }}>
              {cs ? `V Praze dne ${today}` : `Prague, ${today}`}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
              {[{ title: cs ? 'Pronajímatel' : 'Landlord', name: owner }, { title: cs ? 'Nájemce' : 'Tenant', name: tenant }].map(box => (
                <div key={box.title} style={{
                  flex: 1, border: '1px solid #cbd5e1', borderRadius: 6, padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 26, minHeight: 92,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>{box.title}</div>
                  <div style={{ fontSize: 13, color: '#0f172a', minHeight: 18 }}>{box.name || '…'}</div>
                  <div style={{ borderTop: '1px solid #94a3b8', fontSize: 9, color: '#64748b', paddingTop: 4, textAlign: 'center' }}>
                    {cs ? 'podpis' : 'signature'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid var(--c-border)',
          display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>
            {cs ? 'Návrh — zkontroluj u advokáta' : 'Draft — check with a lawyer'}
          </span>
          <button onClick={() => window.print()}
            style={{ padding: '9px 16px', fontSize: 12, border: 'none', borderRadius: 7, background: 'var(--c-accent, #2563eb)', color: '#fff', cursor: 'pointer' }}>
            {t('_mylistings_contract_generate')}
          </button>
        </div>
      </div>
    </div>
  )
}