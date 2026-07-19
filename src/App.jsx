import { useState, useEffect, useRef } from 'react'
import './App.css'

// Paste your Apps Script Web App URL here after deployment
// (Deploy > New deployment > Web app > copy the /exec URL)
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbyUyZqGshX-MmaaUBvFk6dSSGlEKaxhtPc-rtRXW_m1W0uqdmgFnGcYfOUyaT5hhFhLkA/exec'

const TIERS = {
  curated: { label: 'Curated source', cls: 'tier-curated' },
  web_verified: { label: 'Web-sourced · human-verified', cls: 'tier-web' },
  pending: { label: 'Logged for review', cls: 'tier-pending' },
}

const EXAMPLES = [
  'What is the permissible fluoride limit in drinking water?',
  'How do percolation tanks recharge groundwater?',
  'भूजल पुनर्भरण क्या है?',
  'ಕುಡಿಯುವ ನೀರಿನ ಗುಣಮಟ್ಟ ಎಂದರೇನು?',
]

const LAYERS = [
  'Physical systems',
  'Observation',
  'Engineering models',
  'Information',
  'Knowledge',
  'Governance',
  'Intelligence',
]

// Default map point and quick-pick presets. Any location worldwide
// can be searched; these presets are the eight KMEA study districts
// (coordinates are district headquarters).
const DEFAULT_PLACE = {
  name: 'Bengaluru',
  region: 'Karnataka',
  country: 'India',
  lat: 12.97,
  lon: 77.59,
}

const KMEA_PRESETS = [
  { name: 'Hassan', tag: 'CNNL', region: 'Karnataka', country: 'India', lat: 13.0, lon: 76.1 },
  { name: 'Tumakuru', tag: 'CNNL', region: 'Karnataka', country: 'India', lat: 13.34, lon: 77.1 },
  { name: 'Mandya', tag: 'CNNL', region: 'Karnataka', country: 'India', lat: 12.52, lon: 76.9 },
  { name: 'Mysuru', tag: 'CNNL', region: 'Karnataka', country: 'India', lat: 12.3, lon: 76.65 },
  { name: 'Chikkamagaluru', tag: 'VJNL', region: 'Karnataka', country: 'India', lat: 13.32, lon: 75.77 },
  { name: 'Shivamogga', tag: 'KNNL', region: 'Karnataka', country: 'India', lat: 13.93, lon: 75.57 },
  { name: 'Haveri', tag: 'KNNL', region: 'Karnataka', country: 'India', lat: 14.79, lon: 75.4 },
  { name: 'Yadgir', tag: 'KBJNL', region: 'Karnataka', country: 'India', lat: 16.77, lon: 77.14 },
]

const TIER_GUIDE = [
  {
    cls: 'dot-curated',
    title: 'Curated source',
    text: 'Standards, official publications and expert-written material, reviewed before it enters the corpus. The strongest tier.',
  },
  {
    cls: 'dot-web',
    title: 'Web-sourced · human-verified',
    text: 'Gathered from the open web, then checked and approved by a domain expert before being admitted.',
  },
  {
    cls: 'dot-pending',
    title: 'Logged for review',
    text: 'The corpus cannot answer this yet. The question is recorded, reviewed by an expert, and the gap is closed.',
  },
]

const LOOP_STEPS = [
  { title: 'You ask', text: 'Any water question, in English, Hindi or Kannada.' },
  { title: 'Corpus search', text: 'Keyword and cross-language semantic search over curated documents.' },
  { title: 'Grounded answer', text: 'Composed only from retrieved passages, never invented, always labelled by tier.' },
  { title: 'Gaps close', text: 'Unanswered questions are logged, expert-reviewed, and folded back into the corpus.' },
]

function StrataMark({ size = 22 }) {
  return (
    <svg
      className="strata-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="var(--brand-deep)" />
      <g fill="none" strokeLinecap="round" strokeWidth="2">
        <path d="M8 9h16" stroke="var(--s1)" />
        <path d="M8 13h16" stroke="var(--s2)" />
        <path d="M8 17h16" stroke="var(--s3)" />
        <path d="M8 21h11" stroke="var(--s4)" />
        <path d="M8 25h7" stroke="var(--s5)" />
      </g>
    </svg>
  )
}

// ------------------------------------------------------------
// Live conditions — fetched directly from Open-Meteo in the
// browser (free, no key, CORS-enabled). No backend involved.
// ------------------------------------------------------------
function useLiveConditions(place) {
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading') // loading | ok | error
  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    setState('loading')

    const wx =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${place.lat}&longitude=${place.lon}` +
      '&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration' +
      '&hourly=soil_moisture_3_to_9cm' +
      '&past_days=7&forecast_days=7&timezone=auto'
    const fl =
      'https://flood-api.open-meteo.com/v1/flood' +
      `?latitude=${place.lat}&longitude=${place.lon}` +
      '&daily=river_discharge,river_discharge_max&past_days=7&forecast_days=30'

    Promise.all([
      fetch(wx).then((r) => r.json()),
      fetch(fl).then((r) => r.json()).catch(() => null),
    ])
      .then(([w, f]) => {
        if (id !== reqId.current) return // stale — a newer place was picked
        if (!w || !w.daily) throw new Error('no data')
        const sm = (w.hourly?.soil_moisture_3_to_9cm || []).filter(
          (v) => v !== null
        )
        const rain = w.daily.precipitation_sum.map((v) => v ?? 0)
        const fMax = f?.daily?.river_discharge_max
          ? f.daily.river_discharge_max.slice(7).filter((v) => v !== null)
          : []
        setData({
          dates: w.daily.time,
          rain,
          rainToday: rain[7] ?? 0,
          rainNext7: rain.slice(7).reduce((a, b) => a + b, 0),
          rainPast7: rain.slice(0, 7).reduce((a, b) => a + b, 0),
          tmax: w.daily.temperature_2m_max[7],
          tmin: w.daily.temperature_2m_min[7],
          et0: w.daily.et0_fao_evapotranspiration[7],
          soil: sm.length ? sm[sm.length - 1] : null,
          discharge: f?.daily?.river_discharge?.[7] ?? null,
          discharge30Max: fMax.length ? Math.max(...fMax) : null,
        })
        setState('ok')
      })
      .catch(() => {
        if (id === reqId.current) setState('error')
      })
  }, [place])

  return { data, state }
}

function fmt(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return Number(v).toFixed(digits)
}

function RainChart({ dates, rain, past7, next7 }) {
  const max = Math.max(1, ...rain)
  const W = 560
  const H = 110
  const gap = 6
  const bw = (W - gap * (rain.length - 1)) / rain.length
  return (
    <div className="rain-chart-wrap">
      <svg
        className="rain-chart"
        viewBox={`0 0 ${W} ${H + 22}`}
        role="img"
        aria-label="Daily rainfall in millimetres: past seven days and seven-day forecast"
      >
        {rain.map((v, i) => {
          const h = Math.max(2, (v / max) * H)
          const x = i * (bw + gap)
          const d = new Date(dates[i] + 'T00:00:00')
          return (
            <g key={dates[i]}>
              <rect
                x={x}
                y={H - h}
                width={bw}
                height={h}
                rx="2.5"
                className={i < 7 ? 'bar-past' : 'bar-fcst'}
              >
                <title>{`${dates[i]}: ${fmt(v)} mm`}</title>
              </rect>
              <text
                x={x + bw / 2}
                y={H + 15}
                className="bar-label"
                textAnchor="middle"
              >
                {d.getDate()}
              </text>
            </g>
          )
        })}
        <line
          x1={7 * (bw + gap) - gap / 2}
          y1="0"
          x2={7 * (bw + gap) - gap / 2}
          y2={H}
          className="today-line"
        />
      </svg>
      <div className="rain-legend">
        <span>
          <i className="swatch swatch-past" /> Past 7 days · {fmt(past7, 0)} mm
        </span>
        <span>
          <i className="swatch swatch-fcst" /> Forecast 7 days · {fmt(next7, 0)} mm
        </span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Location search — Open-Meteo geocoding (free, no key,
// worldwide). Debounced; keyboard accessible.
// ------------------------------------------------------------
function PlaceSearch({ onPick }) {
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const boxRef = useRef(null)
  const reqId = useRef(0)

  useEffect(() => {
    const q = term.trim()
    if (q.length < 2) {
      setHits([])
      setOpen(false)
      return
    }
    const id = ++reqId.current
    setBusy(true)
    const t = setTimeout(() => {
      fetch(
        'https://geocoding-api.open-meteo.com/v1/search?name=' +
          encodeURIComponent(q) +
          '&count=6&language=en&format=json'
      )
        .then((r) => r.json())
        .then((d) => {
          if (id !== reqId.current) return
          setHits(d.results || [])
          setOpen(true)
          setCursor(-1)
        })
        .catch(() => {
          if (id === reqId.current) {
            setHits([])
            setOpen(true)
          }
        })
        .finally(() => {
          if (id === reqId.current) setBusy(false)
        })
    }, 300)
    return () => clearTimeout(t)
  }, [term])

  // close on outside click
  useEffect(() => {
    function onDoc(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function choose(h) {
    onPick({
      name: h.name,
      region: h.admin1 || '',
      country: h.country || '',
      lat: h.latitude,
      lon: h.longitude,
    })
    setTerm('')
    setHits([])
    setOpen(false)
  }

  function onKeyDown(e) {
    if (!open || !hits.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (c + 1) % hits.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (c - 1 + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(hits[cursor >= 0 ? cursor : 0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="place-search" ref={boxRef}>
      <input
        type="text"
        value={term}
        placeholder="Search any town, district or city…"
        aria-label="Search for a location"
        autoComplete="off"
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => hits.length && setOpen(true)}
      />
      {open && (
        <ul className="place-results" role="listbox">
          {busy && <li className="place-msg">Searching…</li>}
          {!busy && !hits.length && (
            <li className="place-msg">No matching place. Try a different spelling.</li>
          )}
          {!busy &&
            hits.map((h, i) => (
              <li key={h.id}>
                <button
                  type="button"
                  className={i === cursor ? 'is-active' : ''}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(h)}
                >
                  <strong>{h.name}</strong>
                  <span>
                    {[h.admin1, h.country].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

function LiveConditions() {
  const [place, setPlace] = useState(DEFAULT_PLACE)
  const { data, state } = useLiveConditions(place)

  const where = [place.region, place.country].filter(Boolean).join(' · ')

  return (
    <section id="live" className="live">
      <div className="live-inner">
        <div className="live-head">
          <div>
            <p className="eyebrow eyebrow-light">Observation layer · live</p>
            <h2>Water conditions now</h2>
            <p className="live-place">
              {place.name}
              {place.tag ? ` (${place.tag})` : ''}
              {where && <span className="live-place-sub"> · {where}</span>}
            </p>
          </div>
          <PlaceSearch onPick={setPlace} />
        </div>

        <div className="presets">
          <span className="presets-label">KMEA study districts</span>
          <div className="preset-chips">
            {KMEA_PRESETS.map((d) => (
              <button
                key={d.name}
                className={`preset-chip${place.name === d.name ? ' is-on' : ''}`}
                onClick={() => setPlace(d)}
              >
                {d.name}
                <em>{d.tag}</em>
              </button>
            ))}
          </div>
        </div>

        {state === 'loading' && (
          <p className="live-status">Reading current conditions…</p>
        )}
        {state === 'error' && (
          <p className="live-status">
            Live data is unavailable for this location right now. Search
            again or retry in a moment.
          </p>
        )}

        {state === 'ok' && data && (
          <>
            <div className="metrics" aria-live="polite">
              <div className="metric">
                <span className="metric-value">
                  {fmt(data.rainToday)}
                  <em>mm</em>
                </span>
                <span className="metric-label">Rain today</span>
              </div>
              <div className="metric">
                <span className="metric-value">
                  {fmt(data.rainNext7, 0)}
                  <em>mm</em>
                </span>
                <span className="metric-label">Next 7 days</span>
              </div>
              <div className="metric">
                <span className="metric-value">
                  {data.soil !== null ? fmt(data.soil, 2) : '—'}
                  <em>m³/m³</em>
                </span>
                <span className="metric-label">Soil moisture</span>
              </div>
              <div className="metric">
                <span className="metric-value">
                  {fmt(data.et0)}
                  <em>mm</em>
                </span>
                <span className="metric-label">Evapotranspiration ET₀</span>
              </div>
              <div className="metric">
                <span className="metric-value">
                  {fmt(data.tmax, 0)}°
                  <span className="metric-sub"> / {fmt(data.tmin, 0)}°</span>
                </span>
                <span className="metric-label">Max / min today</span>
              </div>
              <div className="metric">
                <span className="metric-value">
                  {fmt(data.discharge, 2)}
                  <em>m³/s</em>
                </span>
                <span className="metric-label">
                  River discharge
                  {data.discharge30Max !== null
                    ? ` · 30-day max ${fmt(data.discharge30Max, 1)}`
                    : ''}
                </span>
              </div>
            </div>

            <RainChart
              dates={data.dates}
              rain={data.rain}
              past7={data.rainPast7}
              next7={data.rainNext7}
            />
          </>
        )}

        <p className="live-note">
          Weather and location search by{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo.com
          </a>{' '}
          (CC-BY 4.0) · river discharge from the Copernicus GloFAS model.
          Model output for orientation, not an official warning — for
          decisions, consult IMD, CWC and KSNDMC advisories.
        </p>
      </div>
    </section>
  )
}

function App() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [asked, setAsked] = useState(false)

  async function ask(q) {
    const query = (q ?? question).trim()
    if (!query || loading) return
    setQuestion(query)
    setLoading(true)
    setResult(null)
    setError(null)
    setAsked(true)
    try {
      // No Content-Type header on purpose: the body is sent as
      // text/plain, which avoids the CORS preflight that Apps Script
      // cannot answer. The backend JSON-parses the raw body.
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        body: JSON.stringify({ question: query }),
        redirect: 'follow',
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const tier = result ? TIERS[result.tier] || { label: result.tier, cls: '' } : null

  return (
    <>
      <nav className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <StrataMark />
            <span className="brand-name">WIM-Assistant</span>
          </span>
          <span className="topbar-links">
            <a className="topbar-link" href="#live">
              Live conditions
            </a>
            <a className="topbar-link" href="#about">
              About WIM
            </a>
          </span>
        </div>
      </nav>

      <main className="main">
        <section className="hero">
          <p className="eyebrow">Water Intelligence Modeling · Intelligence layer</p>
          <h1>
            Water intelligence,
            <br />
            on demand.
          </h1>
          <p className="lede">
            Ask anything about water — fundamentals, engineering, governance.
            Every answer is grounded in a curated corpus and labelled by source.
            Ask in English, <span lang="hi">हिंदी</span>, or{' '}
            <span lang="kn">ಕನ್ನಡ</span>.
          </p>

          <div className="ask-box">
            <input
              type="text"
              value={question}
              placeholder="Ask a water question…"
              aria-label="Your question"
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
            />
            <button className="ask-btn" onClick={() => ask()} disabled={loading}>
              {loading ? 'Consulting…' : 'Ask'}
            </button>
          </div>

          {!asked && (
            <div className="chips" aria-label="Example questions">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="chip" onClick={() => ask(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="response" aria-live="polite">
          {loading && (
            <div className="answer-card loading-card">
              <div className="pulse-strata">
                <span /><span /><span /><span /><span />
              </div>
              <p className="loading-text">Searching the corpus and composing an answer…</p>
            </div>
          )}

          {error && (
            <div className="answer-card error-card">
              <p className="error-title">Something went wrong</p>
              <p className="error-text">{error}</p>
            </div>
          )}

          {result && (
            <article className="answer-card">
              <div className="badges">
                <span className={`badge ${tier.cls}`}>{tier.label}</span>
                {result.category === 'governance' && (
                  <span className="badge badge-gov">
                    Policy / legal — verify against the current official source
                  </span>
                )}
              </div>
              <p className="answer-text">{result.answer}</p>
              {result.source && (
                <p className="answer-source">
                  <StrataMark size={14} /> Source: {result.source}
                </p>
              )}
            </article>
          )}
        </section>
      </main>

      <LiveConditions />

      <section className="grading">
        <div className="grading-inner">
          <p className="eyebrow">Knowledge layer · provenance</p>
          <h2>Every answer tells you where it came from</h2>
          <div className="tier-cards">
            {TIER_GUIDE.map((t) => (
              <div key={t.title} className="tier-card">
                <span className={`tier-dot ${t.cls}`} aria-hidden="true" />
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </div>
            ))}
          </div>
          <p className="gov-note">
            Answers touching policy, law or schemes additionally carry a
            standing caveat: verify against the current official source,
            because rules change and a stale answer can mislead.
          </p>
        </div>
      </section>

      <section className="loop">
        <div className="loop-inner">
          <p className="eyebrow">Intelligence layer · learning</p>
          <h2>How it learns</h2>
          <ol className="loop-steps">
            {LOOP_STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="about" className="about">
        <div className="about-inner">
          <h2>What is WIM?</h2>
          <p>
            Water Intelligence Modeling is a framework that integrates water
            data, engineering knowledge, environmental processes, and
            governance into a single evolving knowledge model — aiming to
            become for water what BIM became for buildings. WIM-Assistant is
            its intelligence layer: it explains, interprets regulations, and
            learns continuously. Questions it cannot yet answer are logged,
            reviewed by domain experts, and folded back into the corpus.
          </p>
          <ol className="layers" aria-label="The seven layers of WIM">
            {LAYERS.map((l, i) => (
              <li key={l} style={{ '--i': i }}>
                <span className="layer-bar" />
                {l}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="footer">
        <p>
          A Water Intelligence Modeling initiative · Answers are generated from
          a curated corpus and labelled by source tier. Policy and legal
          content should always be verified against current official sources.
          Live conditions: weather data by Open-Meteo.com.
        </p>
      </footer>
    </>
  )
}

export default App
