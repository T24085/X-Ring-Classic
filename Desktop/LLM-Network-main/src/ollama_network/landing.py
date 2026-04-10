from __future__ import annotations

import json
from typing import Optional

from .branding import load_logo_data_url


_DEFAULT_FIREBASE_CONFIG = {
    "apiKey": "",
    "authDomain": "",
    "projectId": "",
    "storageBucket": "",
    "messagingSenderId": "",
    "appId": "",
}


HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LLM Network</title>
  <meta name="description" content="Public landing page and dashboard entry for the LLM Network.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root{--bg:#071018;--panel:#102634;--line:rgba(255,255,255,.1);--text:#edf4ef;--muted:#a7bcc2;--aqua:#63dbc9;--gold:#f2c772;--shadow:0 24px 70px rgba(0,0,0,.28)}
    *{box-sizing:border-box} html{scroll-behavior:smooth}
    body{margin:0;background:radial-gradient(circle at top left,rgba(99,219,201,.13),transparent 28%),linear-gradient(180deg,#071018,#0b141d);color:var(--text);font-family:"Instrument Sans","Segoe UI",sans-serif}
    a{color:inherit;text-decoration:none} button{font:inherit} .container{max-width:1360px;margin:0 auto}
    .hero{min-height:100svh;padding:24px;display:grid;align-items:start}
    .topbar,.metric-grid,.story,.pricing,.faq,.final{display:grid;gap:16px}
    .topbar{grid-template-columns:1fr auto;align-items:center}
    .brand{display:flex;align-items:center;gap:14px}
    .brand-link{display:inline-flex;align-items:center;gap:14px}
    .brand-logo{width:58px;height:58px;object-fit:contain;display:block;filter:drop-shadow(0 10px 18px rgba(0,0,0,.18))}
    .brand-link:hover .brand-logo{transform:translateY(-1px)}
    .brand strong,.section h2,.price,.display{font-family:"Space Grotesk","Segoe UI",sans-serif}
    .brand span,.nav a,.lede,.fine,.faq p,.plan p,.story p,.feature-list li,.section p{color:var(--muted)}
    .brand span{display:block;font-size:.82rem;letter-spacing:.1em;text-transform:uppercase}
    .nav{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:12px 18px}
    .nav a{font-size:.95rem}
    .hero-grid{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(540px,.98fr);gap:48px;align-items:center;min-height:calc(100svh - 88px)}
    .hero-grid > *,.two-col > *{min-width:0}
    .eyebrow{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.04);font-size:.82rem;letter-spacing:.11em;text-transform:uppercase;color:var(--muted)}
    .eyebrow::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--aqua);box-shadow:0 0 14px rgba(99,219,201,.5)}
    .display{margin:18px 0 16px;max-width:9ch;font-size:clamp(3.4rem,8vw,6.2rem);line-height:.93;letter-spacing:-.05em}
    .lede{max-width:34rem;font-size:1.06rem;line-height:1.7}
    .cta-row,.signal-row{display:flex;flex-wrap:wrap;gap:16px;align-items:center}
    .cta-row{justify-content:flex-start;margin:28px 0 16px}
    .button{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 20px;border-radius:999px;border:1px solid transparent;cursor:pointer;transition:transform .18s ease}
    .button:hover{transform:translateY(-1px)}
    .button-primary{background:linear-gradient(135deg,var(--aqua),#28abb6);color:#071018;font-weight:700}
    .button-secondary{background:rgba(255,255,255,.03);border-color:var(--line);color:var(--text)}
    .pill{display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.04)}
    .pill::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--gold)}
    .poster{position:relative;min-height:660px;padding:24px;border:1px solid var(--line);border-radius:32px;background:radial-gradient(circle at 18% 16%,rgba(242,199,114,.18),transparent 24%),radial-gradient(circle at 82% 12%,rgba(99,219,201,.14),transparent 24%),linear-gradient(160deg,rgba(12,29,40,.96),rgba(7,16,24,.88));box-shadow:var(--shadow);overflow:hidden;display:grid;gap:18px}
    .poster::before,.poster::after{content:"";position:absolute;border:1px solid rgba(255,255,255,.08);border-radius:50%;pointer-events:none}
    .poster::before{width:420px;height:420px;right:-120px;top:-120px}
    .poster::after{width:300px;height:300px;left:-90px;bottom:-90px}
    .poster-head{position:relative;z-index:1;display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
    .poster-kicker{display:grid;gap:8px}
    .poster-kicker strong{font-family:"Space Grotesk","Segoe UI",sans-serif;font-size:1.2rem}
    .poster-kicker span,.poster-refresh{color:var(--muted);font-size:.84rem}
    .poster-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);font-size:.76rem;letter-spacing:.12em;text-transform:uppercase;color:#dff7f3}
    .poster-badge::before{content:"";width:8px;height:8px;border-radius:999px;background:#55f1d7;box-shadow:0 0 14px rgba(85,241,215,.45)}
    .poster-stats{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .poster-stat{padding:14px 16px;border-radius:22px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.03))}
    .poster-stat strong{display:block;font-family:"Space Grotesk","Segoe UI",sans-serif;font-size:1.55rem;line-height:1}
    .poster-stat span{display:block;margin-top:6px;color:var(--muted);font-size:.78rem;letter-spacing:.08em;text-transform:uppercase}
    .poster-visual{position:relative;z-index:1;padding:16px 16px 8px;border-radius:28px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(9,24,33,.78),rgba(5,14,21,.86))}
    .poster-visual-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}
    .poster-visual-head strong{font-size:1rem}
    .poster-visual-head span{display:block;color:var(--muted);font-size:.84rem;max-width:30rem}
    .poster-legend{display:flex;flex-wrap:wrap;gap:8px}
    .poster-legend-chip{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.05);font-size:.76rem;color:#deece9}
    .poster-legend-dot{width:8px;height:8px;border-radius:999px;display:inline-block}
    .poster-legend-dot.working{background:#ff925e}
    .poster-legend-dot.ready{background:#4ce9d2}
    .poster-legend-dot.offline{background:#70838b}
    .hero-map{width:100%;height:auto;display:block;min-height:320px}
    .hero-map .ring{fill:none;stroke:rgba(78,227,210,.18);stroke-width:1.2}
    .hero-map .backbone{fill:none;stroke:rgba(89,224,211,.14);stroke-width:1.3}
    .hero-map .queue-edge{fill:none;stroke:rgba(255,184,127,.34);stroke-width:1.6;stroke-dasharray:5 7;animation:heroFlow 8s linear infinite}
    .hero-map .worker-edge{fill:none;stroke:rgba(94,234,219,.18);stroke-width:1.4}
    .hero-map .worker-edge.working{stroke:rgba(255,153,97,.68);stroke-width:2.2;stroke-dasharray:6 8;animation:heroFlow 3.4s linear infinite}
    .hero-map .worker-edge.ready{stroke:rgba(76,233,210,.42);stroke-width:1.8}
    .hero-map .worker-edge.offline{stroke:rgba(112,131,139,.22)}
    .hero-map .queue-node{fill:url(#heroQueueFill);stroke:rgba(255,222,187,.84);stroke-width:1}
    .hero-map .worker-node{stroke-width:1.3;filter:url(#heroGlow)}
    .hero-map .worker-node.working{fill:#ff925e;stroke:#ffe0cf}
    .hero-map .worker-node.ready{fill:#4ce9d2;stroke:#bafff5}
    .hero-map .worker-node.offline{fill:#637982;stroke:#93a9b1}
    .hero-map .worker-halo{opacity:.2}
    .hero-map .worker-halo.working{fill:#ff925e;animation:heroPulse 2.3s ease-in-out infinite}
    .hero-map .worker-halo.ready{fill:#4ce9d2;animation:heroPulse 3.1s ease-in-out infinite}
    .hero-map .worker-halo.offline{fill:#637982}
    .hero-map .queue-label,.hero-map .worker-sub{fill:rgba(219,232,234,.66);font-size:9px}
    .hero-map .worker-label{fill:#edf8f6;font-size:10px;font-weight:700}
    .hero-map .core-halo{fill:url(#heroCoreGlow)}
    .hero-map .core-node{fill:url(#heroCoreFill);filter:url(#heroGlow)}
    .hero-map .core-label{fill:#f4fffd;font-size:15px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
    .hero-map .core-sub{fill:rgba(225,239,240,.72);font-size:10px}
    .hero-feed{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(220px,.9fr);gap:14px}
    .terminal,.summary,.panel,.plan,.faq-item,.story-item{border:1px solid var(--line);background:rgba(255,255,255,.03);box-shadow:var(--shadow)}
    .poster-floor{position:relative;left:auto;right:auto;bottom:auto;z-index:1;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(220px,.85fr);gap:14px;align-items:stretch}
    .terminal,.summary{min-width:0;padding:16px 18px;border-radius:22px}
    .terminal code,.summary code{display:block;white-space:pre-wrap;overflow-wrap:anywhere;color:#c9f0eb;font:inherit;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.78rem;line-height:1.55}
    @keyframes heroFlow{from{stroke-dashoffset:0}to{stroke-dashoffset:-52}}
    @keyframes heroPulse{0%,100%{transform:scale(1);transform-origin:center;opacity:.16}50%{transform:scale(1.22);transform-origin:center;opacity:.32}}
    main{padding:0 24px 84px}
    .section{padding:92px 0;border-top:1px solid var(--line)}
    .section-head{max-width:760px;margin-bottom:32px}
    .label{color:var(--gold);font-size:.82rem;letter-spacing:.14em;text-transform:uppercase}
    .section h2{margin:10px 0 12px;font-size:clamp(2rem,4vw,3.5rem);line-height:1.02;letter-spacing:-.04em}
    .section p{margin:0;line-height:1.7}
    .panel{border-radius:28px;overflow:hidden}
    .two-col{display:grid;grid-template-columns:1.05fr .95fr}
    .feature-copy,.dashboard-preview{padding:32px}
    .feature-list{margin:0;padding:0;list-style:none;display:grid;gap:16px}
    .feature-list li{padding-bottom:16px;border-bottom:1px solid var(--line);line-height:1.6}
    .metric-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin:18px 0}
    .metric{padding:15px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.03)}
    .metric strong{display:block;font-size:1.5rem}
    .rail{display:grid;gap:10px;padding-top:14px;border-top:1px solid var(--line)}
    .rail div{display:flex;justify-content:space-between;gap:12px}
    .pricing,.story,.faq{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
    .pricing{align-items:start}
    .plan,.story-item,.faq-item{padding:26px;border-radius:28px}
    .plan.featured{background:linear-gradient(180deg,rgba(99,219,201,.14),rgba(255,255,255,.03));transform:translateY(-8px)}
    .plan-kicker{color:var(--gold);font-size:.78rem;letter-spacing:.12em;text-transform:uppercase}
    .plan h3,.story-item h3,.faq-item h3{margin:10px 0 10px;font-size:1.14rem}
    .price{margin:0 0 12px;font-size:clamp(2.4rem,4vw,3.2rem);letter-spacing:-.04em}
    .price span{font-size:1rem;font-family:"Instrument Sans","Segoe UI",sans-serif;color:var(--muted)}
    .plan ul{margin:0 0 22px;padding:0;list-style:none;display:grid;gap:10px}
    .plan li{position:relative;padding-left:18px;line-height:1.5}
    .plan li::before{content:"";position:absolute;left:0;top:.55em;width:8px;height:8px;border-radius:50%;background:var(--aqua)}
    .story-item strong{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:rgba(242,199,114,.14);color:var(--gold);font-family:"Space Grotesk","Segoe UI",sans-serif}
    .final{grid-template-columns:1fr auto;align-items:end;padding:34px;border:1px solid var(--line);border-radius:34px;background:linear-gradient(135deg,rgba(99,219,201,.16),rgba(255,255,255,.03))}
    footer{padding:20px 24px 36px;color:var(--muted)} .footer-row{max-width:1180px;margin:0 auto;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:18px}
    @media (max-width:1240px){.hero-grid{grid-template-columns:1fr}.poster{max-width:860px;width:100%;justify-self:center}}
    @media (max-width:1040px){.two-col,.final,.poster-stats,.poster-floor{grid-template-columns:1fr}.plan.featured{transform:none}}
    @media (max-width:720px){.hero,main,footer{padding-inline:18px}.topbar{grid-template-columns:1fr}.nav{justify-content:flex-start}.display{font-size:clamp(3rem,18vw,4.3rem)}.poster{min-height:560px;padding:18px}.poster-head,.poster-visual-head{flex-direction:column}.metric-grid{grid-template-columns:1fr}.button{width:100%}.hero-map{min-height:260px}}
  </style>
</head>
<body>
  <section class="hero">
    <div class="container">
      <header class="topbar">
        <div class="brand">
          <a href="./" class="brand-link" aria-label="Go to the LLM Network landing page">
            <img src="__LOGO_DATA_URL__" alt="LLM Network logo" class="brand-logo">
            <div>
              <strong>LLM Network</strong>
              <span>Local inference exchange</span>
            </div>
          </a>
        </div>
        <nav class="nav" aria-label="Primary">
          <a href="#why">Why it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <a data-dashboard-link href="./dashboard">Dashboard</a>
        </nav>
      </header>

      <div class="hero-grid">
        <div>
          <div class="eyebrow">Verified workers. Shared credits. Google login.</div>
          <h1 class="display">Run the network from one front door.</h1>
          <p class="lede">Everything for the LLM Network lives here: the product story, pricing, credit economics, and the direct path into the main dashboard where users sign in, submit jobs, and operate local workers.</p>
          <div class="cta-row">
            <button id="hero-sign-in" class="button button-primary" type="button">Sign in with Google</button>
            <a class="button button-secondary" data-dashboard-link href="./dashboard">Open dashboard</a>
            <a class="button button-secondary" href="#pricing">See pricing</a>
          </div>
          <div class="signal-row">
            <div id="session-pill" class="pill">Checking session status</div>
            <div id="auth-status" class="fine">First sign-in can bootstrap a stable network identity with launch credits.</div>
          </div>
        </div>

        <div class="poster">
          <div class="poster-head">
            <div class="poster-kicker">
              <span class="poster-badge">Live network preview</span>
              <strong>Watch the mesh route work in real time.</strong>
              <span id="hero-network-note">Connecting to the local coordinator for a live snapshot.</span>
            </div>
            <div id="poster-refresh" class="poster-refresh">Waiting for first sync</div>
          </div>
          <div class="poster-stats">
            <div class="poster-stat"><strong id="hero-metric-workers">0</strong><span>Workers online</span></div>
            <div class="poster-stat"><strong id="hero-metric-active">0</strong><span>Jobs in flight</span></div>
            <div class="poster-stat"><strong id="hero-metric-queued">0</strong><span>Queued prompts</span></div>
            <div class="poster-stat"><strong id="hero-metric-users">0</strong><span>Connected users</span></div>
          </div>
          <div class="poster-visual">
            <div class="poster-visual-head">
              <div>
                <strong>Hero mesh telemetry</strong>
                <span>Public visitors can immediately see workers, queue pressure, and active routing instead of a static mockup.</span>
              </div>
              <div class="poster-legend">
                <span class="poster-legend-chip"><span class="poster-legend-dot working"></span>Working</span>
                <span class="poster-legend-chip"><span class="poster-legend-dot ready"></span>Ready</span>
                <span class="poster-legend-chip"><span class="poster-legend-dot offline"></span>Offline</span>
              </div>
            </div>
            <svg id="hero-network-map" class="hero-map" viewBox="0 0 620 380" role="img" aria-label="Live hero preview of the network mesh"></svg>
          </div>
          <div class="poster-floor">
            <div class="terminal"><code id="hero-activity-log">Connecting to /network ...
Waiting for the first live snapshot from the coordinator.</code></div>
            <div class="summary"><code id="hero-summary-panel">Queue depth: --
Connected workers: --
Users online: --
Credit exchange: $1 = 100 credits</code></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <main>
    <div class="container">
      <section id="why" class="section">
        <div class="section-head">
          <div class="label">Find Everything Fast</div>
          <h2>A public front page for discovery, with the real operator surface one click away.</h2>
          <p>The landing page explains the network clearly, anchors pricing to credits, and sends users straight into the authenticated dashboard instead of making them hunt for the product surface.</p>
        </div>
        <div class="panel two-col">
          <div class="feature-copy">
            <ul class="feature-list">
              <li><strong>Google login opens the same network identity every time.</strong><br>The dashboard binds one stable user id to the Google account on first sign-in and reuses it later.</li>
              <li><strong>Approved local Ollama models are visible in one place.</strong><br>Users can inspect models, queue work, and see how jobs move across the network.</li>
              <li><strong>Worker operations stay inside the same control room.</strong><br>Operators can start a local worker loop, review hardware detection, and export CLI commands without leaving the UI.</li>
              <li><strong>Pricing is expressed in credits, not vague tiers.</strong><br>The page makes launch credits and wallet top-ups obvious before the user signs in.</li>
            </ul>
          </div>
          <div class="dashboard-preview">
            <div class="pill">Main control room</div>
            <div class="metric-grid">
              <div class="metric"><strong>5.0</strong><span>Bootstrap credits at first sign-in</span></div>
              <div class="metric"><strong>4s</strong><span>Auto refresh rhythm for network state</span></div>
              <div class="metric"><strong>1</strong><span>Stable user identity per Google account</span></div>
              <div class="metric"><strong>0</strong><span>Cloud fallback in the worker runtime</span></div>
            </div>
            <div class="rail">
              <div><span>Sign in</span><strong>Google popup</strong></div>
              <div><span>Wallet</span><strong>Credits, pending, earned, spent</strong></div>
              <div><span>Workers</span><strong>Detected GPU + approved models</strong></div>
              <div><span>CLI pack</span><strong>Copy exact commands from the UI</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" class="section">
        <div class="section-head">
          <div class="label">Pricing</div>
          <h2>Start free, buy credits directly, or bring a full worker fleet.</h2>
          <p>The credit model is intentionally simple. New users can launch without paying first, power users can top up linearly, and labs can roll in multiple verified workers under custom operations.</p>
        </div>
        <div class="pricing">
          <article class="plan">
            <div class="plan-kicker">Launch</div>
            <h3>Explorer</h3>
            <div class="price">$0 <span>to start</span></div>
            <p>For first-time users who want to sign in, inspect the network, and submit initial jobs from the dashboard.</p>
            <ul>
              <li>5 bootstrap credits on first authenticated session</li>
              <li>Google sign-in and stable network user id</li>
              <li>Dashboard access, model browser, and queue visibility</li>
              <li>Best for evaluation, demos, and first prompts</li>
            </ul>
            <button class="button button-secondary" type="button" data-sign-in>Launch free</button>
          </article>

          <article class="plan featured">
            <div class="plan-kicker">Most direct</div>
            <h3>Operator Credits</h3>
            <div class="price">$1 <span>= 100 credits</span></div>
            <p>Top up only what you need, then spend credits on jobs or earn them back by serving work from your own local node.</p>
            <ul>
              <li>Linear top-up model with no forced subscription</li>
              <li>Ideal for recurring prompting and worker payouts</li>
              <li>Uses the same wallet and ledger already exposed by the service</li>
              <li>Keeps product pricing grounded in the existing backend</li>
            </ul>
            <a class="button button-primary" data-dashboard-link href="./dashboard">Open wallet in dashboard</a>
          </article>

          <article class="plan">
            <div class="plan-kicker">Scale</div>
            <h3>Fleet</h3>
            <div class="price">Custom <span>lab rollout</span></div>
            <p>For teams that want coordinated worker onboarding, curated model approvals, and a tighter operating loop around local-only inference.</p>
            <ul>
              <li>Multi-worker operations and benchmark baselining</li>
              <li>Policy tuning around approved models and routing</li>
              <li>Useful when one machine is no longer enough</li>
              <li>Leaves room for a future enterprise layer without changing the core ledger</li>
            </ul>
            <a class="button button-secondary" href="#faq">Review rollout notes</a>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <div class="label">Workflow</div>
          <h2>From sign-in to worker revenue in three moves.</h2>
          <p>The page explains the whole operating loop without burying the actual action surface behind docs or scattered links.</p>
        </div>
        <div class="story">
          <article class="story-item"><strong>1</strong><h3>Enter through the landing page</h3><p>Review what the network does, see how credits work, and authenticate directly from the hero without guessing where the dashboard lives.</p></article>
          <article class="story-item"><strong>2</strong><h3>Use the dashboard as the source of truth</h3><p>Submit jobs, inspect balances, load approved models, and copy the exact CLI pack needed to automate the same actions outside the browser.</p></article>
          <article class="story-item"><strong>3</strong><h3>Turn local hardware into network supply</h3><p>Start a same-machine local worker loop, publish verified throughput, and earn credits when public jobs land on your node.</p></article>
        </div>
      </section>

      <section id="faq" class="section">
        <div class="section-head">
          <div class="label">FAQ</div>
          <h2>Clear answers before users hit the control room.</h2>
          <p>The landing page now covers the questions people usually ask before they commit to a workflow or spend credits.</p>
        </div>
        <div class="faq">
          <article class="faq-item"><h3>Do I have to pay before I can see the dashboard?</h3><p>No. The page routes users into the dashboard with Google sign-in, and new authenticated sessions can receive bootstrap credits so they can start without a purchase.</p></article>
          <article class="faq-item"><h3>How are credits priced?</h3><p>The current exchange is straight-line pricing: one US dollar adds one hundred credits to the wallet. That maps directly to the existing purchase flow in the service layer.</p></article>
          <article class="faq-item"><h3>Is this tied to cloud inference?</h3><p>No. The product position and the worker tooling stay local-only. The dashboard and copy both reinforce that the network is built around approved Ollama workers without cloud fallback.</p></article>
          <article class="faq-item"><h3>Where do I manage workers and CLI commands?</h3><p>Inside the main dashboard. The landing page is now the public discovery surface, while `/dashboard` remains the operator surface for authenticated usage, worker control, and CLI generation.</p></article>
        </div>
      </section>

      <section class="section">
        <div class="final">
          <div>
            <div class="label">Open The Network</div>
            <h2>Start here, then move straight into the main control room.</h2>
            <p>Review pricing, sign in with Google, and continue into the dashboard to submit work and run local nodes.</p>
          </div>
          <div class="cta-row" style="margin:0">
            <button class="button button-primary" type="button" data-sign-in>Sign in and continue</button>
            <a class="button button-secondary" data-dashboard-link href="./dashboard">Go to dashboard</a>
          </div>
        </div>
      </section>
    </div>
  </main>

  <footer>
    <div class="footer-row">
      <span>LLM Network homepage and dashboard entry</span>
      <span>Local-only Ollama inference coordination</span>
    </div>
  </footer>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
    import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";

    const FIREBASE_CONFIG = __FIREBASE_CONFIG__;
    const authReady = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
    const dashboardUrl = new URL("./dashboard", window.location.href).toString();
    const sessionPill = document.getElementById("session-pill");
    const authStatus = document.getElementById("auth-status");
    const signInButtons = [...document.querySelectorAll("[data-sign-in]"), document.getElementById("hero-sign-in")].filter(Boolean);
    const dashboardLinks = [...document.querySelectorAll("[data-dashboard-link]")];
    const heroNetworkMap = document.getElementById("hero-network-map");
    const heroNetworkNote = document.getElementById("hero-network-note");
    const heroActivityLog = document.getElementById("hero-activity-log");
    const heroSummaryPanel = document.getElementById("hero-summary-panel");
    const posterRefresh = document.getElementById("poster-refresh");
    let auth = null;
    let provider = null;
    let networkPollHandle = null;

    function setAuthMessage(pill, message) {
      sessionPill.textContent = pill;
      authStatus.textContent = message;
    }

    function toggleButtons(disabled, label) {
      signInButtons.forEach((button) => {
        button.disabled = disabled;
        if (label) button.textContent = label;
      });
    }

    async function handleSignIn() {
      if (!auth || !provider) {
        setAuthMessage("Firebase not configured", "Add Firebase web keys to enable browser sign-in, or open /dashboard after configuration.");
        return;
      }
      try {
        toggleButtons(true, "Opening Google...");
        setAuthMessage("Opening sign-in", "Completing Google authentication.");
        await signInWithPopup(auth, provider);
        setAuthMessage("Signed in", "Redirecting to the main dashboard.");
        window.location.href = dashboardUrl;
      } catch (error) {
        const message = error?.message || String(error);
        setAuthMessage("Sign-in failed", message);
        toggleButtons(false, "Sign in with Google");
      }
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>\"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
      }[character]));
    }

    function compactId(value) {
      const text = String(value || "").trim().replace(/^worker-/, "").replace(/^usr_/, "").replace(/^job-/, "");
      if (!text) return "unknown";
      return text.length > 12 ? `${text.slice(0, 5)}...${text.slice(-4)}` : text;
    }

    function pluralize(count, noun) {
      return `${count} ${noun}${count === 1 ? "" : "s"}`;
    }

    function formatRefreshTime() {
      return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
    }

    function orbitPoints(items, centerX, centerY, radiusX, radiusY, startDeg, endDeg) {
      if (!items.length) return [];
      const singleAngle = (startDeg + endDeg) / 2;
      return items.map((item, index) => {
        const angle = items.length === 1 ? singleAngle : startDeg + ((endDeg - startDeg) * index) / (items.length - 1);
        const radians = (angle * Math.PI) / 180;
        return {
          ...item,
          x: centerX + Math.cos(radians) * radiusX,
          y: centerY + Math.sin(radians) * radiusY,
        };
      });
    }
    function layeredOrbitPoints(items, centerX, centerY, layers) {
      if (!items.length) return [];
      let offset = 0;
      const points = [];
      layers.forEach((layer) => {
        if (offset >= items.length) return;
        const count = Math.min(Number(layer.limit || 0), items.length - offset);
        if (count <= 0) return;
        points.push(
          ...orbitPoints(
            items.slice(offset, offset + count),
            centerX,
            centerY,
            Number(layer.radiusX || 0),
            Number(layer.radiusY || 0),
            Number(layer.startDeg || 0),
            Number(layer.endDeg || 0),
          ),
        );
        offset += count;
      });
      if (offset < items.length && layers.length) {
        const spill = layers[layers.length - 1];
        points.push(
          ...orbitPoints(
            items.slice(offset),
            centerX,
            centerY,
            Number(spill.radiusX || 0) + 16,
            Number(spill.radiusY || 0) + 10,
            Number(spill.startDeg || 0),
            Number(spill.endDeg || 0),
          ),
        );
      }
      return points;
    }

    function linkPath(fromX, fromY, toX, toY, curveBias = 0) {
      const controlX = (fromX + toX) / 2 + curveBias;
      const controlY = (fromY + toY) / 2;
      return `M ${fromX.toFixed(1)} ${fromY.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${toX.toFixed(1)} ${toY.toFixed(1)}`;
    }

    function renderHeroNetwork(payload) {
      const workers = Object.values(payload?.workers || {});
      const queuedJobs = Array.isArray(payload?.queued_jobs) ? payload.queued_jobs : [];
      const activeJobsByWorker = payload?.active_jobs || {};
      const workerNodes = workers.map((worker) => {
        const activeJobs = Number(activeJobsByWorker[worker.worker_id] ?? worker.active_jobs ?? 0);
        const state = !worker.online ? "offline" : activeJobs > 0 ? "working" : "ready";
        return { ...worker, active_jobs: activeJobs, state };
      });
      const onlineWorkers = workerNodes.filter((worker) => worker.online);
      const workingWorkers = workerNodes.filter((worker) => worker.state === "working");
      const readyWorkers = workerNodes.filter((worker) => worker.state === "ready");
      const offlineWorkers = workerNodes.filter((worker) => worker.state === "offline");

      document.getElementById("hero-metric-workers").textContent = String(onlineWorkers.length);
      document.getElementById("hero-metric-active").textContent = String(workingWorkers.length);
      document.getElementById("hero-metric-queued").textContent = String(queuedJobs.length);
      document.getElementById("hero-metric-users").textContent = String(Number(payload?.user_count || 0));
      heroNetworkNote.textContent = `${pluralize(onlineWorkers.length, "worker")} online, ${pluralize(workingWorkers.length, "job")} in flight, ${pluralize(queuedJobs.length, "queued prompt")} waiting for routing.`;
      posterRefresh.textContent = `Last sync ${formatRefreshTime()}`;

      const activityLines = [
        `mesh snapshot @ ${formatRefreshTime()}`,
        `${pluralize(onlineWorkers.length, "worker")} online`,
        `${pluralize(workingWorkers.length, "job")} currently executing`,
        `${pluralize(queuedJobs.length, "queued prompt")} awaiting a matching node`,
        "",
      ];
      workingWorkers.slice(0, 5).forEach((worker) => {
        activityLines.push(`${compactId(worker.worker_id)}  ${worker.gpu_name}  ${worker.active_jobs} active`);
      });
      if (!workingWorkers.length) {
        activityLines.push("No workers are currently executing jobs.");
      }
      heroActivityLog.textContent = activityLines.join("\n");

      const summaryLines = [
        `Queue depth: ${queuedJobs.length}`,
        `Connected workers: ${onlineWorkers.length} online / ${workerNodes.length} total`,
        `Registered users: ${Number(payload?.user_count || 0)}`,
        `Working nodes: ${workingWorkers.map((worker) => compactId(worker.worker_id)).slice(0, 4).join(", ") || "none"}`,
      ];
      heroSummaryPanel.textContent = summaryLines.join("\n");

      const centerX = 310;
      const centerY = 194;
      const queueNodes = layeredOrbitPoints(queuedJobs.slice(0, 12).map((jobId) => ({ jobId })), centerX, centerY, [
        { limit: 6, radiusX: 218, radiusY: 118, startDeg: 150, endDeg: 210 },
        { limit: 6, radiusX: 252, radiusY: 138, startDeg: 154, endDeg: 206 },
      ]);
      const workingNodes = layeredOrbitPoints(workingWorkers, centerX, centerY, [
        { limit: 10, radiusX: 152, radiusY: 108, startDeg: -55, endDeg: 55 },
        { limit: 14, radiusX: 188, radiusY: 132, startDeg: -68, endDeg: 68 },
        { limit: 18, radiusX: 224, radiusY: 154, startDeg: -80, endDeg: 80 },
      ]);
      const readyNodes = layeredOrbitPoints(readyWorkers, centerX, centerY, [
        { limit: 14, radiusX: 224, radiusY: 150, startDeg: -78, endDeg: 78 },
        { limit: 20, radiusX: 254, radiusY: 170, startDeg: -92, endDeg: 92 },
        { limit: 26, radiusX: 284, radiusY: 188, startDeg: -106, endDeg: 106 },
      ]);
      const offlineNodes = layeredOrbitPoints(offlineWorkers, centerX, centerY, [
        { limit: 10, radiusX: 178, radiusY: 118, startDeg: 118, endDeg: 242 },
        { limit: 14, radiusX: 218, radiusY: 138, startDeg: 114, endDeg: 246 },
        { limit: 18, radiusX: 254, radiusY: 156, startDeg: 110, endDeg: 250 },
      ]);
      const renderableWorkers = [...workingNodes, ...readyNodes, ...offlineNodes];
      const labelAllWorkers = renderableWorkers.length <= 16;
      const labeledWorkerIds = new Set([
        ...workingWorkers.slice(0, 4),
        ...readyWorkers.slice(0, 3),
        ...offlineWorkers.slice(0, 2),
      ].map((worker) => worker.worker_id));
      const labelAllQueueNodes = queueNodes.length <= 6;

      const queueEdges = queueNodes.map((node) => `<path class="queue-edge" d="${linkPath(node.x, node.y, centerX, centerY, -70)}"></path>`).join("");
      const workerEdges = renderableWorkers.map((node) => {
        const bias = node.x >= centerX ? 64 : -64;
        return `<path class="worker-edge ${node.state}" d="${linkPath(centerX, centerY, node.x, node.y, bias)}"></path>`;
      }).join("");
      const queueMarkup = queueNodes.map((node) => `
        <g>
          <circle class="queue-node" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="8"></circle>
          ${labelAllQueueNodes ? `<text class="queue-label" x="${(node.x - 12).toFixed(1)}" y="${(node.y - 14).toFixed(1)}">${escapeHtml(compactId(node.jobId))}</text>` : ""}
        </g>
      `).join("");
      const workerMarkup = renderableWorkers.map((node) => {
        const denseMesh = renderableWorkers.length >= 36;
        const radius = node.state === "working" ? (denseMesh ? 7.5 : 11) : (denseMesh ? 6 : 9);
        const labelX = node.x >= centerX ? node.x + 14 : node.x - 14;
        const anchor = node.x >= centerX ? "start" : "end";
        const shouldLabel = labelAllWorkers || labeledWorkerIds.has(node.worker_id);
        return `
          <g>
            <circle class="worker-halo ${node.state}" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${(radius + 8).toFixed(1)}"></circle>
            <circle class="worker-node ${node.state}" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${radius}"></circle>
            ${shouldLabel ? `<text class="worker-label" x="${labelX.toFixed(1)}" y="${(node.y - 2).toFixed(1)}" text-anchor="${anchor}">${escapeHtml(compactId(node.worker_id))}</text>` : ""}
            ${shouldLabel ? `<text class="worker-sub" x="${labelX.toFixed(1)}" y="${(node.y + 11).toFixed(1)}" text-anchor="${anchor}">${escapeHtml(node.state)}</text>` : ""}
          </g>
        `;
      }).join("");

      heroNetworkMap.innerHTML = `
        <defs>
          <radialGradient id="heroCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#4ff4de" stop-opacity=".48"></stop>
            <stop offset="100%" stop-color="#4ff4de" stop-opacity="0"></stop>
          </radialGradient>
          <radialGradient id="heroCoreFill" cx="50%" cy="45%" r="58%">
            <stop offset="0%" stop-color="#8ffff4"></stop>
            <stop offset="100%" stop-color="#1ab7a7"></stop>
          </radialGradient>
          <linearGradient id="heroQueueFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffd0a8"></stop>
            <stop offset="100%" stop-color="#ff8f59"></stop>
          </linearGradient>
          <filter id="heroGlow">
            <feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur>
            <feMerge>
              <feMergeNode in="blur"></feMergeNode>
              <feMergeNode in="SourceGraphic"></feMergeNode>
            </feMerge>
          </filter>
        </defs>
        <path class="backbone" d="M 78 192 Q 198 110 310 194 Q 422 278 540 192"></path>
        <path class="backbone" d="M 102 110 Q 206 88 310 194 Q 414 300 518 278"></path>
        <path class="backbone" d="M 102 278 Q 206 300 310 194 Q 414 88 518 110"></path>
        <circle class="core-halo" cx="${centerX}" cy="${centerY}" r="64"></circle>
        <circle class="ring" cx="${centerX}" cy="${centerY}" r="84"></circle>
        <circle class="ring" cx="${centerX}" cy="${centerY}" r="126"></circle>
        ${queueEdges}
        ${workerEdges}
        ${queueMarkup}
        <g>
          <circle class="core-node" cx="${centerX}" cy="${centerY}" r="30"></circle>
          <text class="core-label" x="${centerX}" y="${centerY - 2}" text-anchor="middle">Mesh</text>
          <text class="core-sub" x="${centerX}" y="${centerY + 15}" text-anchor="middle">live scheduler core</text>
        </g>
        ${workerMarkup}
      `;
    }

    function renderNetworkError(message) {
      heroNetworkNote.textContent = message;
      posterRefresh.textContent = "Unable to sync";
      heroActivityLog.textContent = `landing hero preview\n${message}`;
      heroSummaryPanel.textContent = "Queue depth: --\nConnected workers: --\nRegistered users: --\nCredit exchange: $1 = 100 credits";
      heroNetworkMap.innerHTML = `
        <text x="310" y="172" text-anchor="middle" fill="#f3f8f7" font-size="24" font-family="Space Grotesk, Segoe UI, sans-serif">Live preview unavailable</text>
        <text x="310" y="202" text-anchor="middle" fill="rgba(219,232,234,.72)" font-size="13" font-family="Instrument Sans, Segoe UI, sans-serif">${escapeHtml(message)}</text>
      `;
    }

    async function refreshNetworkPreview() {
      try {
        const response = await fetch("./network", { headers: { "Accept": "application/json" } });
        if (!response.ok) throw new Error(`Network preview failed: ${response.status}`);
        const payload = await response.json();
        renderHeroNetwork(payload);
      } catch (error) {
        renderNetworkError(error?.message || String(error));
      }
    }

    function bootNetworkPreview() {
      refreshNetworkPreview();
      if (networkPollHandle) clearInterval(networkPollHandle);
      networkPollHandle = window.setInterval(refreshNetworkPreview, 5000);
    }

    function bind() {
      signInButtons.forEach((button) => button.addEventListener("click", handleSignIn));
      dashboardLinks.forEach((link) => { link.href = dashboardUrl; });
    }

    function bootAuth() {
      if (!authReady) {
        setAuthMessage("Firebase not configured", "Sign-in is disabled until the Firebase client config is present.");
        toggleButtons(true, "Login unavailable");
        return;
      }

      const app = initializeApp(FIREBASE_CONFIG);
      auth = getAuth(app);
      provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      onAuthStateChanged(auth, (user) => {
        if (!user) {
          setAuthMessage("Ready for sign-in", "Open the dashboard or sign in here to continue with your bound network account.");
          toggleButtons(false, "Sign in with Google");
          return;
        }
        const name = user.displayName || user.email || "Signed-in user";
        setAuthMessage("Session detected", `Continue to the dashboard as ${name}.`);
        signInButtons.forEach((button) => { button.textContent = "Continue to dashboard"; });
      });
    }

    bind();
    bootAuth();
    bootNetworkPreview();
  </script>
</body>
</html>
"""


def render_landing_html(firebase_client_config: Optional[dict[str, str]] = None) -> str:
    config = dict(_DEFAULT_FIREBASE_CONFIG)
    if firebase_client_config:
        config.update(firebase_client_config)
    html = HTML.replace("__FIREBASE_CONFIG__", json.dumps(config))
    return html.replace("__LOGO_DATA_URL__", load_logo_data_url())
