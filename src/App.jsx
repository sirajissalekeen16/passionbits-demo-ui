import { useState } from 'react'
import EmailGate from './components/EmailGate'
import AdAccount from './components/AdAccount'
import ContentPublishing from './components/ContentPublishing'
import BrollStudio from './components/BrollStudio'
import SlideshowStudio from './components/SlideshowStudio'
import './App.css'

export default function App() {
  const [email, setEmail] = useState('')
  const [tab, setTab] = useState('ads')

  if (!email) return <EmailGate onSubmit={setEmail} />

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">Passionbits Dev UI</div>
        <div className="app-user">
          <span className="user-email">{email}</span>
          <button className="btn-ghost" onClick={() => setEmail('')}>Switch</button>
        </div>
      </header>

      <nav className="app-nav">
        <button className={`nav-tab ${tab === 'ads' ? 'active' : ''}`} onClick={() => setTab('ads')}>
          Meta Ads Account
        </button>
        <button className={`nav-tab ${tab === 'publish' ? 'active' : ''}`} onClick={() => setTab('publish')}>
          Content Publishing
        </button>
        <button className={`nav-tab ${tab === 'broll' ? 'active' : ''}`} onClick={() => setTab('broll')}>
          B-Roll Studio
        </button>
        <button className={`nav-tab ${tab === 'slideshow' ? 'active' : ''}`} onClick={() => setTab('slideshow')}>
          Slideshow
        </button>
      </nav>

      <main className="app-main">
        {tab === 'ads'       && <AdAccount email={email} />}
        {tab === 'publish'   && <ContentPublishing email={email} />}
        {tab === 'broll'     && <BrollStudio email={email} />}
        {tab === 'slideshow' && <SlideshowStudio email={email} />}
      </main>
    </div>
  )
}
