import React from 'react';
import { CheckCircleIcon, ShieldCheckIcon, ClockIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const placements = [
  {
    name: 'Homepage Left Rail Banner',
    price: '$100',
    duration: '30-day placement',
    description: 'Prominent placement that loads above the fold on desktop with persistent visibility as users scroll.',
    deliverables: [
      '300x600 static JPG/PNG or animated GIF (under 1MB)',
      'Destination URL for click-through tracking',
      'Optional UTM parameters for analytics hand-off'
    ],
    paypalKey: 'leftRight100',
  },
  {
    name: 'Homepage Right Rail Banner',
    price: '$100',
    duration: '30-day placement',
    description: 'Pairs with the left rail unit to flank core content and follow the visitor journey through competition pages.',
    deliverables: [
      '300x250 static JPG/PNG or animated GIF (under 750KB)',
      'Destination URL for click-through tracking',
      'Optional back-up image for dark mode'
    ],
    paypalKey: 'leftRight100',
  },
  {
    name: 'Footer Marquee Banner',
    price: '$50',
    duration: '30-day placement',
    description: 'Full-width placement at the bottom of every public page—ideal for reminders, promos, or discount codes.',
    deliverables: [
      '728x90 static JPG/PNG (under 500KB)',
      'Destination URL for click-through tracking',
      'Headline (45 characters) & supporting copy (90 characters)'
    ],
    paypalKey: 'bottom50',
  },
];

const paypalButtonSnippets = {
  leftRight100: `
    <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top">
      <input type="hidden" name="cmd" value="_s-xclick" />
      <input type="hidden" name="hosted_button_id" value="LEFT_RIGHT_100_PLACEMENT" />
      <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_buynowCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!" />
      <img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1" />
    </form>
  `,
  bottom50: `
    <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top">
      <input type="hidden" name="cmd" value="_s-xclick" />
      <input type="hidden" name="hosted_button_id" value="BOTTOM_RIBBON_50_PLACEMENT" />
      <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_buynowCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!" />
      <img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1" />
    </form>
  `,
};

const ActivationNotice = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white text-center px-4 rounded-lg">
    <ShieldCheckIcon className="w-8 h-8 mb-2" />
    <p className="font-semibold">Sponsor confirmation required</p>
    <p className="text-sm text-gray-200 mt-1">
      PayPal checkout is locked until creative is approved and placement dates are confirmed by our partnerships team.
    </p>
  </div>
);

const Sponsorship = () => {
  return (
    <div className="space-y-12">
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center" />
        <div className="relative px-6 py-12 sm:px-12 sm:py-16 lg:px-16">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-600/10 text-red-300 px-4 py-1 text-sm font-semibold tracking-wide uppercase">
              <ShieldCheckIcon className="w-4 h-4" /> Official Sponsorship Opportunities
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
              Reach precision rimfire shooters with curated banner placements
            </h1>
            <p className="text-lg text-gray-200">
              Reserve a 30-day banner placement and connect with a high-intent community of competitive marksmen, ranges, and gear enthusiasts. Each package includes creative QA, transparent reporting, and concierge onboarding.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-gray-200">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4" /> 30-day flight per booking
              </div>
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="w-4 h-4" /> Campaign brief + creative checklist
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4" /> Impression & click analytics dashboard
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-gray-100">Placement menu</h2>
          <span className="text-sm text-gray-400">30-day billing • Creative swap allowed 1x per term</span>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {placements.map((placement) => (
            <div key={placement.name} className="relative bg-gray-900/70 border border-gray-800 rounded-xl p-6 shadow-lg hover:border-red-700/60 transition-colors">
              <div className="space-y-3">
                <div>
                  <h3 className="text-xl font-semibold text-white">{placement.name}</h3>
                  <p className="text-sm text-gray-400">{placement.duration}</p>
                </div>
                <p className="text-3xl font-bold text-red-400">{placement.price}</p>
                <p className="text-sm text-gray-300 leading-relaxed">{placement.description}</p>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Creative deliverables</p>
                  <ul className="space-y-2">
                    {placement.deliverables.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-200">
                        <CheckCircleIcon className="w-4 h-4 mt-0.5 text-red-400 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative mt-6">
                  <div className="rounded-lg border border-dashed border-red-600/50 bg-gray-950/60 p-4">
                    <p className="text-xs text-gray-400 mb-2">
                      Hosted PayPal checkout snippet (disabled until sponsor confirmation):
                    </p>
                    <div className="relative">
                      <div className="opacity-40 pointer-events-none" dangerouslySetInnerHTML={{ __html: paypalButtonSnippets[placement.paypalKey] }} />
                      <ActivationNotice />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 shadow-lg space-y-4">
          <h2 className="text-xl font-semibold text-white">Activation workflow</h2>
          <ol className="space-y-3 text-sm text-gray-300">
            <li>
              <span className="font-semibold text-gray-100">1. Submit interest:</span> Email <a href="mailto:sponsorships@thexringclassic.com" className="text-red-400 underline">sponsorships@thexringclassic.com</a> with placement preference and requested flight dates.
            </li>
            <li>
              <span className="font-semibold text-gray-100">2. Creative delivery:</span> Upload banner assets and click-through URL via the secure sponsor portal or share using your preferred file transfer service. Our team reviews specs within one business day.
            </li>
            <li>
              <span className="font-semibold text-gray-100">3. Contract & invoice:</span> Once approved, we countersign the sponsorship agreement, enable the corresponding PayPal button, and send confirmation with launch timeline.
            </li>
            <li>
              <span className="font-semibold text-gray-100">4. Launch & reporting:</span> Creative goes live on the confirmed start date. Sponsors receive automated analytics and mid-flight optimization tips from the dashboard.
            </li>
          </ol>
        </div>
        <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 shadow-lg space-y-4">
          <h2 className="text-xl font-semibold text-white">Sponsorship terms</h2>
          <ul className="space-y-3 text-sm text-gray-300">
            <li>Placements are reserved on a first-confirmed basis. Payment links remain locked until agreements are executed.</li>
            <li>Creatives must align with our firearms community guidelines. The X-Ring Classic reserves the right to decline or request revisions.</li>
            <li>One complimentary creative swap per 30-day flight; additional swaps incur a $25 trafficking fee.</li>
            <li>Performance metrics (impressions, clicks, CTR) are accessible in the Sponsor Dashboard. Exportable reports are available upon request.</li>
            <li>Cancellation requires seven-day notice prior to the go-live date for a full refund. After launch, refunds are prorated based on delivered impressions.</li>
          </ul>
        </div>
      </section>

      <section className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 shadow-lg">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Ready to co-create a custom activation?</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              Looking for seasonal takeovers, competition sponsorships, or bundled media packages? Our partnerships team can craft a bespoke plan that matches your goals and budget. Submit your creative files along with targeting notes and we will coordinate testing, go-live dates, and measurement KPIs.
            </p>
            <p className="text-sm text-gray-400">
              Send creative assets (ZIP or cloud link), approved copy, and click-through URLs to <a href="mailto:sponsorships@thexringclassic.com" className="text-red-400 underline">sponsorships@thexringclassic.com</a>. We will respond within one business day with next steps and activation timing.
            </p>
          </div>
          <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">What sponsors receive</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-3">
                <CheckCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" /> Dedicated account manager and creative QA checklist
              </li>
              <li className="flex gap-3">
                <CheckCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" /> Weekly performance snapshot emailed to your team
              </li>
              <li className="flex gap-3">
                <CheckCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" /> End-of-flight recap with optimization recommendations
              </li>
              <li className="flex gap-3">
                <CheckCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" /> Optional co-branded social spotlights during major matches
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Sponsorship;
