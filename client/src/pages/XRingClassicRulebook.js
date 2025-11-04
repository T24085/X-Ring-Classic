import React from 'react';

const sections = [
  {
    id: 'purpose',
    title: '1. Purpose & Scope',
    body: `The X‑Ring Classic is a precision .22LR rifle program designed to be easy to run at any range while producing nationally comparable results. This rulebook defines safety, eligibility, equipment, course of fire, scoring, classifications, and match administration. Where a local range policy is stricter than these rules, the local policy prevails.`
  },
  {
    id: 'safety',
    title: '2. Safety',
    bullets: [
      'All local range rules and commands are mandatory.',
      'Actions open, chamber flags inserted, and muzzle down‑range unless actively firing.',
      'Eye protection is required for all persons on the line; hearing protection is strongly recommended.',
      'Cease‑fire: Any person may call “Cease Fire”. On a cease‑fire, make safe immediately.',
      'Handling firearms behind the line or during a cease‑fire is prohibited.'
    ]
  },
  {
    id: 'eligibility',
    title: '3. Eligibility & Divisions',
    bullets: [
      'Open to all shooters in good standing with the host range.',
      'Age groups (optional by match): Junior (under 18), Adult, Senior (60+).',
      'Divisions: Indoor (25‑yard), Outdoor (50‑yard). Formats: Benchrest, Prone, Standing.',
      'Competitors may enter multiple divisions if separate cards are fired.'
    ]
  },
  {
    id: 'equipment',
    title: '4. Equipment',
    bullets: [
      '.22LR rifle only. Any safe trigger and sighting system.',
      'Supports: As allowed by the chosen format (e.g., benchrest front/rear rest; prone sling or bipod; standing no artificial support).',
      'No muzzle brakes that direct blast laterally toward other shooters.',
      'Ammunition must be commercially manufactured .22 Long Rifle.'
    ]
  },
  {
    id: 'course',
    title: '5. Course of Fire',
    bullets: [
      'Competitors fire four 25-bull target sheets (cards), one shot per bull, for 100 scoring rounds total.',
      'Standard card: 25 scoring shots, one per bull, within the allotted time (typ. 15–20 minutes).',
      'Sighters: At the match director’s option; sighters are not scored.',
      'Alibis: Malfunctions may be cleared; no refires for ammunition or equipment issues.'
    ]
  },
  {
    id: 'targets',
    title: '6. Targets & Distances',
    body: 'Indoor cards are fired at 25 yards; outdoor at 50 yards. Targets must have a clearly marked 10‑ring and X‑ring. Clubs may use equivalent commercially available targets.'
  },
  {
    id: 'scoring',
    title: '7. Scoring',
    bullets: [
      'Per‑shot value 0–10. An X counts as 10 with X credit.',
      'A shot that clearly touches a higher ring (line‑breaker) receives the higher value.',
      'One hole per bull is scored; excessive hits use the lowest value(s) that can be attributed to the bull.',
      'Visible cross‑fire on another target is recorded as a miss on the shooter’s own target.',
      'Card total: sum of 25 shots. X‑count is recorded for tiebreaks.'
    ]
  },
  {
    id: 'verification',
    title: '8. Submission & Verification',
    bullets: [
      'Competitors may self‑report scores in the app and attach optional photo/video evidence.',
      'A Range Admin verifies cards. Admin‑entered cards are auto‑approved but must reflect the physical target.',
      'Suspected errors or rule violations may be flagged for review.'
    ]
  },
  {
    id: 'classifications',
    title: '9. Classifications',
    body: 'Class tracks consistent performance and provides fair peer groups. Provisional classes apply until enough cards are recorded.',
    bullets: [
      'Computation window: last 12 months.',
      'Qualifying set: best 6 of last 10 approved cards (per 25‑shot card).',
      'Provisional: if fewer than 6 cards exist, a provisional tier is issued from available cards.',
      'Tiers (average card / X‑avg): Grand Master ≥ 249.0 and ≥ 15 X; Master ≥ 247.0 and ≥ 10 X; Diamond ≥ 245.0 and ≥ 8 X; Platinum ≥ 242.0 and ≥ 6 X; Gold ≥ 238.0; otherwise Bronze.'
    ]
  },
  {
    id: 'tiebreaks',
    title: '10. Ties & Records',
    bullets: [
      'Ties are broken by X‑count, then by earliest submission time, then coin toss if required.',
      'Match records require Range Admin verification and retained target or image.'
    ]
  },
  {
    id: 'conduct',
    title: '11. Conduct & Penalties',
    bullets: [
      'Unsportsmanlike conduct, unsafe gun handling, or falsifying scores may result in disqualification and removal from the platform.',
      'Match directors may impose local penalties consistent with these rules.'
    ]
  },
  {
    id: 'md',
    title: '12. Match Administration',
    bullets: [
      'Range Admins create competitions, publish results, and verify scores.',
      'Protests must be filed the day of the match or within 48 hours for remote verification matches.',
      'Rules updates are published in‑app; the most recent in‑app version governs.'
    ]
  }
];

const XRingClassicRulebook = () => {
  const pdfPath = '/The_X_Ring_Classic_Rulebook_Updated.pdf';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">The X-Ring Classic Rulebook</h1>
        <p className="text-white drop-shadow-md">Official rules, scoring, and classifications</p>
      </div>

      {/* Table of contents */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <h2 className="text-lg font-semibold mb-2">Table of Contents</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className="text-blue-600 hover:text-blue-800">{s.title}</a>
          ))}
        </div>
      </div>

      {/* Rules content */}
      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-8">
        {sections.map(s => (
          <section key={s.id} id={s.id}>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{s.title}</h3>
            {s.body && <p className="text-gray-700 mb-3">{s.body}</p>}
            {Array.isArray(s.bullets) && (
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                {s.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
          </section>
        ))}
        <div className="text-sm text-gray-700 pt-2 border-t">Version 1.0 • Effective {new Date().toLocaleDateString()}</div>
      </div>

      {/* Legacy PDF link for reference */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">Looking for the previous PDF?</div>
          <a href={pdfPath} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-900 text-sm">Open Previous PDF</a>
        </div>
      </div>
    </div>
  );
};

export default XRingClassicRulebook;
