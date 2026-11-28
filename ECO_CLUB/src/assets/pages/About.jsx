import { navigateTo } from '../data/api'

const FOREST = '#214E34'
const IVORY = '#F8F7F2'
const OLIVE = '#8A9A5B'
const GOLD = '#C5A46D'
const headingFont = '"DM Serif Text", Georgia, serif'
const bodyFont = '"DM Sans", "Segoe UI", sans-serif'

const pillars = [
  {
    icon: '🌱',
    title: 'Campus Conservation',
    detail: 'Caring for native flora, campus green corridors, and ecological restoration drives led by students.',
  },
  {
    icon: '📊',
    title: 'Transparent Impact',
    detail: 'Every planting drive, audit, and cleanup is documented cleanly across Events, Gallery, and Achievements.',
  },
  {
    icon: '🤝',
    title: 'Community Action',
    detail: 'Workshops, awareness campaigns, and faculty-student mentorship built around measurable everyday habits.',
  },
]

export default function About({ team = [] }) {
  return (
    <div className="module-page" style={{ backgroundColor: IVORY, fontFamily: bodyFont, minHeight: '100%' }}>
      <header className="module-hero">
        <div className="max-w-3xl mx-auto relative z-10">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: GOLD }}>
            Vision · People · Stewardship
          </p>
          <h1>About the club</h1>
          <p className="hero-sub mx-auto">
            We want students to feel responsible for the green spaces around them and to learn how everyday choices affect our campus environment.
          </p>
          <span className="gold-line" aria-hidden="true" />
        </div>
      </header>

      <div className="page-content space-y-14">
        <section aria-labelledby="vision-heading">
          <h2 id="vision-heading" className="section-title">
            Our <span className="gold-accent">Vision</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {pillars.map(p => (
              <article
                key={p.title}
                className="p-6 rounded-2xl border bg-[#fffdf8] premium-card-glow"
                style={{ borderColor: '#e4ddd0' }}
              >
                <div className="text-3xl mb-3" aria-hidden="true">{p.icon}</div>
                <h3 className="text-xl mb-2" style={{ fontFamily: headingFont, color: FOREST }}>
                  {p.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#5f5a4f' }}>{p.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="team-heading">
          <h2 id="team-heading" className="section-title">
            Faculty &amp; <span className="gold-accent">Members</span>
          </h2>
          {team.length ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none p-0 m-0">
              {team.map(person => (
                <li
                  key={person.id}
                  className="p-5 rounded-xl border bg-[#fffdf8]"
                  style={{ borderColor: '#e4ddd0', borderLeft: `4px solid ${GOLD}` }}
                >
                  <strong className="text-lg block" style={{ fontFamily: headingFont, color: FOREST }}>
                    {person.name}
                  </strong>
                  <p className="text-sm mt-1" style={{ color: '#5f5a4f' }}>{person.role}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div
              className="p-8 rounded-2xl text-center"
              style={{ border: `2px dashed ${OLIVE}55`, backgroundColor: '#fffdf8' }}
            >
              <p className="text-sm mb-4" style={{ color: '#5f5a4f' }}>
                The club directory hasn’t been published yet.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigateTo('events')}
                  className="px-4 py-2 rounded-full text-xs font-semibold cursor-pointer"
                  style={{ backgroundColor: FOREST, color: IVORY }}
                >
                  Browse Events →
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('achievements')}
                  className="px-4 py-2 rounded-full text-xs font-semibold border cursor-pointer"
                  style={{ borderColor: FOREST, color: FOREST }}
                >
                  Explore Achievements →
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
