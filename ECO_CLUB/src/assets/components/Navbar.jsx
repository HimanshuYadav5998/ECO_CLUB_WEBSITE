import { useState } from 'react'

export default function Navbar({ names, page, currentUser }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isHome = page === 'Home'

  return (
    <header className={isHome ? 'cover-header' : 'site-header-bar'}>
      <div className="shell nav-row">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <a className="brand" href="#home" onClick={() => setMenuOpen(false)}>
            <span className="leaf" aria-hidden="true" />
            Eco Club
          </a>
          <button
            type="button"
            className="nav-mobile-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-nav-links"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMenuOpen(o => !o)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        <nav
          id="main-nav-links"
          aria-label="Main navigation"
          data-open={menuOpen ? 'true' : 'false'}
          className="nav-links-panel flex flex-wrap items-center gap-x-2 gap-y-2"
        >
          {names.map(name => {
            const active = page === name
            return (
              <a
                key={name}
                href={'#' + name.toLowerCase()}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={isHome ? '' : 'nav-link-pill'}
              >
                {name === 'Admin' && currentUser ? `Admin (${currentUser.role})` : name}
              </a>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
