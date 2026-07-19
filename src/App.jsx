import { useState } from 'react'
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
          <a className="topbar-link" href="#about">
            About WIM
          </a>
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
        </p>
      </footer>
    </>
  )
}

export default App
