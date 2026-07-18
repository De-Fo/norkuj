import { useState, useEffect, useRef } from 'react'
import { useLang } from '../lib/lang'

const STORAGE_KEY = 'norkuj_tour_seen'

interface FeatureSlide {
  title: string
  description: string
  mediaUrl: string
  mediaType: 'video' | 'iframe'
}

const FEATURE_SLIDES: FeatureSlide[] = [
  {
    title: '_tour_slide2_title',
    description: '_tour_slide2_desc',
    mediaUrl: 'https://norkuj.cz/vids/export1.mp4',
    mediaType: 'video',
  },
  {
    title: '_tour_slide3_title',
    description: '_tour_slide3_desc',
    mediaUrl: 'https://norkuj.cz/vids/export2.mp4',
    mediaType: 'video',
  },
  {
    title: '_tour_slide5_title',
    description: '_tour_slide5_desc',
    mediaUrl: 'https://norkuj.cz/vids/export3.mp4',
    mediaType: 'video',
  },
  {
    title: '_tour_slide6_title',
    description: '_tour_slide6_desc',
    mediaUrl: 'https://norkuj.cz/vids/export4.mp4',
    mediaType: 'video',
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function FeatureTour({ open, onClose }: Props) {
  const { t } = useLang()
  const [slideIdx, setSlideIdx] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const slide = FEATURE_SLIDES[slideIdx]
  const total = FEATURE_SLIDES.length

  // Reset to first slide each time modal opens
  useEffect(() => {
    if (open) setSlideIdx(0)
  }, [open])

  // Autoplay/pause video on slide change
  useEffect(() => {
    if (!open || !videoRef.current || slide.mediaType !== 'video') return
    if (slide.mediaUrl) {
      videoRef.current.src = slide.mediaUrl
      videoRef.current.play().catch(() => {})
    }
    return () => {
      if (videoRef.current && slide.mediaUrl) {
        videoRef.current.pause()
        videoRef.current.removeAttribute('src')
        videoRef.current.load()
      }
    }
  }, [slideIdx, open, slide.mediaUrl, slide.mediaType])

  if (!open) return null

  const prev = () => setSlideIdx(i => (i - 1 + total) % total)
  const next = () => setSlideIdx(i => (i + 1) % total)

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: 'rgba(15,23,42,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
      <div style={{
        width: window.innerWidth < 768 ? '100%' : 'min(90%, 720px)',
        maxHeight: window.innerWidth < 768 ? '100dvh' : '90vh',
        height: window.innerWidth < 768 ? '100dvh' : undefined,
        background: 'var(--c-surface)',
        borderRadius: window.innerWidth < 768 ? 0 : 16,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: window.innerWidth < 768 ? 'none' : '0 24px 80px rgba(0,0,0,0.4)',
        position: 'relative',
      }}>
        {/* Close button */}
        <button onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 5,
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'rgba(0,0,0,0.1)', color: 'var(--c-muted)',
            fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          ✕
        </button>

        {/* Media area */}
        <div style={{
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#0f172a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
        }}>
          {slide.mediaUrl ? (
            slide.mediaType === 'video' ? (
              <video
                ref={videoRef}
                muted
                playsInline
                loop
                preload='auto'
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <iframe
                src={slide.mediaUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            )
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              color: 'rgba(255,255,255,0.35)',
            }}>
              <span style={{ fontSize: 48 }}>🎬</span>
              <span style={{ fontSize: 13 }}>{t('_tour_placeholder')}</span>
            </div>
          )}

          {/* Prev/next arrows on media */}
          {total > 1 && (
            <>
              <button onClick={prev}
                style={{
                  position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 20,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>‹</button>
              <button onClick={next}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 20,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>›</button>
            </>
          )}
        </div>

        {/* Slide counter + dots */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '16px 24px 0',
        }}>
          <div style={{
            background: 'var(--c-bg)', color: 'var(--c-faint)',
            fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
          }}>
            {slideIdx + 1} / {total}
          </div>
        </div>

        {/* Dots */}
        {total > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 6,
            padding: '8px 24px 0',
          }}>
            {FEATURE_SLIDES.map((_, i) => (
              <button key={i} onClick={() => setSlideIdx(i)}
                style={{
                  width: i === slideIdx ? 20 : 7, height: 7, borderRadius: 4, border: 'none',
                  background: i === slideIdx ? 'var(--c-accent)' : 'var(--c-border-md)',
                  cursor: 'pointer', padding: 0, transition: 'all 0.2s',
                }} />
            ))}
          </div>
        )}

        {/* Text area */}
        <div style={{ padding: '16px 24px 24px' }}>
          <h3 style={{
            fontSize: 16, fontWeight: 700, color: 'var(--c-text)',
            margin: '0 0 8px',
          }}>
            {t(slide.title)}
          </h3>
          <p style={{
            fontSize: 13, color: 'var(--c-muted)', lineHeight: 1.6,
            margin: 0,
          }}>
            {t(slide.description)}
          </p>

          {/* Bottom nav */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 20, gap: 10,
          }}>
            <button onClick={prev}
              style={{
                padding: '8px 16px', border: '1px solid var(--c-border)', borderRadius: 8,
                background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 12,
                cursor: 'pointer', opacity: total > 1 ? 1 : 0.3, pointerEvents: total > 1 ? 'auto' : 'none',
              }}>
              ← {t('_tour_prev')}
            </button>
            {slideIdx < total - 1 ? (
              <button onClick={next}
                style={{
                  padding: '8px 20px', border: 'none', borderRadius: 8,
                  background: 'var(--c-accent)', color: 'white', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer',
                }}>
                {t('_tour_next')} →
              </button>
            ) : (
              <button onClick={onClose}
                style={{
                  padding: '8px 20px', border: 'none', borderRadius: 8,
                  background: 'var(--c-green)', color: 'white', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer',
                }}>
                {t('_tour_done')} ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Check localStorage for first-visit; returns true if tour should auto-open
export function isFirstVisit(): boolean {
  if (typeof window === 'undefined') return false
  return !localStorage.getItem(STORAGE_KEY)
}

// Mark tour as seen (call immediately once auto-shown)
export function markTourSeen(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, 'true')
}
