export default function Footer({ links }) {
  return (
    <footer className="club-footer">
      <div className="shell flex flex-wrap items-center justify-between gap-6">
        <div>
          <a className="brand" href="#home"><span className="leaf" aria-hidden="true" />Eco Club</a>
          <p className="text-xs mt-2 max-w-xs" style={{ color: 'rgba(247, 241, 230, 0.68)' }}>
            Student-led campus conservation, documented restoration drives, and verifiable environmental impact.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {links.map(link => <a key={link.url} href={link.url}>{link.label}</a>)}
          <a href="#events">Events</a>
          <a href="#gallery">Gallery</a>
          <a href="#achievements">Achievements</a>
          <a href="#about">About the club ↗</a>
          <a href="#admin">Admin Portal ↗</a>
        </div>
      </div>
    </footer>
  )
}
