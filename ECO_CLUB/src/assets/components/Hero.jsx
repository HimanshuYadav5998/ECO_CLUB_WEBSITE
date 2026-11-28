import landscape from '../hero.png'

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="home-title">
      <img className="cover-photo" src={landscape} alt="Clouds lifting over an alpine lake and a wooden boathouse" fetchPriority="high" />
      <div className="shell hero-copy">
        <p className="eyebrow">Student environment club</p>
        <h1 id="home-title">Closer to<br /><em>the wild.</em></h1>
        <p className="intro">Meet the students caring for the natural spaces on our campus and beyond.</p>
        <div className="hero-links">
          <a className="button" href="#events">Explore events <span aria-hidden="true">→</span></a>
          <a className="text-link" href="#about">Meet the club</a>
        </div>
      </div>
    </section>
  )
}
