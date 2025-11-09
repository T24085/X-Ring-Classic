import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  ChartPieIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  UsersIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';

const PitchDeckLanding = () => {
  const slides = useMemo(() => [
    {
      id: 'mission',
      title: 'Showcase Your Range with the X-Ring Classic',
      description:
        'Turn your facility into a destination for precision rifle competitors. Showcase your amenities and grow participation with a national match experience tailored to modern shooters.',
      icon: ShieldCheckIcon,
      highlights: [
        'Bring national visibility to your local range',
        'Access branded marketing kits and launch templates',
        'Leverage proven match operations and scoring tools',
      ],
      cta: {
        href: '/ranges',
        label: 'Explore Participating Ranges',
      },
    },
    {
      id: 'experience',
      title: 'Deliver a Premium Match-Day Experience',
      description:
        'Our event blueprint covers registration through awards. Tap into standardized courses of fire, scoring workflows, and communication templates that keep shooters engaged from arrival to results.',
      icon: CalendarDaysIcon,
      highlights: [
        'Streamlined registration and waivers',
        'Automated squadding and scorecards',
        'Trophy and merch playbooks for every skill tier',
      ],
      cta: {
        href: '/rulebook',
        label: 'Review Event Blueprint',
      },
    },
    {
      id: 'technology',
      title: 'Score with Confidence in Real Time',
      description:
        'Digitize every relay with our range-ready score submission app. Real-time dashboards keep staff aligned, verify accuracy, and publish final standings instantly.',
      icon: ChartPieIcon,
      highlights: [
        'Mobile-friendly score entry for ROs',
        'Built-in verification and audit trails',
        'Live leaderboard embeds for clubhouse displays',
      ],
      cta: {
        href: '/leaderboard',
        label: 'See Live Leaderboards',
      },
    },
    {
      id: 'revenue',
      title: 'Unlock New Revenue Streams',
      description:
        'Pair memberships, clinics, and pro shop bundles with the X-Ring Classic brand. Our pricing calculators and sponsor outreach kits help you capture premium value for every relay.',
      icon: ArrowTrendingUpIcon,
      highlights: [
        'Revenue modeling tools for every bay count',
        'Partner playbooks for sponsors and vendors',
        'Automated payouts and reconciliation reporting',
      ],
      cta: {
        href: '/competitions',
        label: 'Plan Your Event Calendar',
      },
    },
    {
      id: 'community',
      title: 'Grow a Loyal Shooter Community',
      description:
        'Segmented communications keep new shooters, veterans, and junior athletes coming back. Activate mentorship programs, badges, and year-long leaderboards to deepen loyalty.',
      icon: UsersIcon,
      highlights: [
        'Pre-built email journeys and social media assets',
        'Range staff onboarding and training content',
        'Retention dashboards with key engagement metrics',
      ],
      cta: {
        href: '/shooting-classes',
        label: 'Explore Shooter Pathways',
      },
    },
    {
      id: 'support',
      title: 'Launch with Dedicated Concierge Support',
      description:
        'From your first interest call to match day, our concierge team keeps your rollout on track. Weekly office hours, on-demand tutorials, and live event coverage are included.',
      icon: PlayCircleIcon,
      highlights: [
        'White-glove onboarding with checklists and deadlines',
        'Resource library packed with how-to videos and guides',
        'Live weekend hotline for last-mile troubleshooting',
      ],
      cta: {
        href: '/login',
        label: 'Preview the Admin Portal',
      },
    },
  ], []);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex];
  const ActiveIcon = activeSlide.icon;

  return (
    <div className="relative min-h-screen py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-16">
          <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-red-800/20 text-red-300 border border-red-700/50">
            Built for Range Leadership
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            The Marketing Deck for Prospective X-Ring Classic Ranges
          </h1>
          <p className="mt-6 text-lg text-gray-300 max-w-3xl mx-auto">
            Give your shooters a premier competition powered by a unified ruleset, real-time scoring, and concierge support. Navigate the slides below to see how the X-Ring Classic platform accelerates every part of your rollout.
          </p>
        </header>

        <div className="flex flex-col lg:flex-row gap-10">
          <nav className="lg:w-1/4 flex lg:flex-col gap-3 overflow-x-auto pb-2 lg:pb-0">
            {slides.map((slide, index) => {
              const Icon = slide.icon;
              const isActive = index === activeIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`flex-1 lg:flex-none lg:w-full rounded-2xl border transition-all duration-200 px-5 py-4 text-left shadow-lg ${
                    isActive
                      ? 'bg-gray-900/90 border-red-700 shadow-red-900/40 text-white'
                      : 'bg-gray-900/40 border-gray-800 text-gray-300 hover:border-red-700/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                      isActive ? 'border-red-500 bg-red-500/10 text-red-300' : 'border-gray-700 bg-gray-800 text-gray-400'
                    }`}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-red-300">
                        Slide {index + 1}
                      </p>
                      <h2 className="text-lg font-semibold leading-tight">
                        {slide.title}
                      </h2>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          <section className="lg:w-3/4 bg-gray-950/70 border border-red-900/60 rounded-3xl shadow-2xl shadow-black/30 p-8 sm:p-12 backdrop-blur">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <p className="text-sm uppercase tracking-widest text-red-400">
                  Slide {activeIndex + 1} of {slides.length}
                </p>
                <h3 className="mt-2 text-3xl font-bold text-white">{activeSlide.title}</h3>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
                  className="px-4 py-2 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-red-600 transition"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1))}
                  className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold transition"
                >
                  Next
                </button>
              </div>
            </header>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
              <div>
                <p className="text-lg text-gray-300 leading-relaxed">
                  {activeSlide.description}
                </p>
                <ul className="mt-8 space-y-4">
                  {activeSlide.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-700/30 text-red-300 border border-red-800/50">
                        <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="text-base text-gray-200">{highlight}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-10">
                  <Link
                    to={activeSlide.cta.href}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg shadow-red-900/40 transition"
                  >
                    {activeSlide.cta.label}
                  </Link>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-950 to-black p-8">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.15),_transparent_60%)]" />
                <div className="relative">
                  <div className="flex items-center gap-3 text-red-300">
                    <ActiveIcon className="h-10 w-10" aria-hidden="true" />
                    <span className="text-sm font-semibold uppercase tracking-widest">
                      Key Outcome
                    </span>
                  </div>
                  <p className="mt-6 text-xl font-semibold text-white">
                    {activeSlide.highlights[0]}
                  </p>
                  <p className="mt-3 text-sm text-gray-400">
                    Each slide unlocks turnkey assets and support so your team can focus on delivering a legendary match weekend without reinventing the wheel.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-center gap-3">
              {slides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    index === activeIndex ? 'w-10 bg-red-500' : 'w-4 bg-gray-600 hover:bg-red-400'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6">
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
                className="w-full sm:w-auto px-5 py-3 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-red-600 transition"
              >
                Previous Slide
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1))}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-semibold transition"
              >
                Next Slide
              </button>
            </div>
          </section>
        </div>

        <section className="mt-20 bg-gradient-to-r from-red-800 via-red-600 to-red-500 rounded-3xl shadow-2xl shadow-red-900/50 p-10 sm:p-14 text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Host the Next X-Ring Classic Weekend?
          </h2>
          <p className="mt-4 text-lg max-w-3xl mx-auto text-red-100">
            Apply for Range Admin access to unlock the full planning workspace, onboarding concierge, and paywall-protected launch resources.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register?intent=range-admin"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-black/90 hover:bg-black text-red-200 font-semibold uppercase tracking-wide shadow-lg shadow-black/40 transition"
            >
              Apply for Range Admin Access
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl border-2 border-white/80 bg-transparent hover:bg-white/10 text-white font-semibold transition"
            >
              Preview Admin Demo
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PitchDeckLanding;
