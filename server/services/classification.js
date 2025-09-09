// Classification rules based on per-card averages (25-shot card max 250)
// Reference tiers (average per card and X-count average):
// - Grand Master: 249.0 – 250.0 and 15+ X average
// - Master:      247.0 – 248.9 and 10+ X average
// - Diamond:     245.0 – 246.9 and 8+  X average
// - Platinum:    242.0 – 244.9 and 6+  X average
// - Gold:        238.0 – 241.9 and 4+  X average
// - Bronze:      below 238.0

// Helper converts an average to a 250-point scale from an arbitrary max
function to250(avgPoints, perCardMaxPoints = 250) {
  if (!avgPoints || !perCardMaxPoints) return null;
  return (avgPoints / perCardMaxPoints) * 250;
}

// Preferred: classify using average card score (normalized to 250) and avg X count
function getClassificationFromCard(avgCardPoints250, avgXCount = 0) {
  if (avgCardPoints250 == null || isNaN(avgCardPoints250)) return 'Unclassified';
  const score = avgCardPoints250;
  const xAvg = Number.isFinite(avgXCount) ? avgXCount : 0;

  if (score >= 249.0 && xAvg >= 15) return 'Grand Master';
  if (score >= 247.0 && xAvg >= 10) return 'Master';
  if (score >= 245.0 && xAvg >= 8)  return 'Diamond';
  if (score >= 242.0 && xAvg >= 6)  return 'Platinum';
  if (score >= 238.0 && xAvg >= 4)  return 'Gold';
  return 'Bronze';
}

// Backward-compat: classification from percent [0..100]
function getClassificationFromAverage(percent) {
  if (percent == null || isNaN(percent)) return 'Unclassified';
  if (percent >= (249/250)*100) return 'Grand Master';
  if (percent >= (247/250)*100) return 'Master';
  if (percent >= (245/250)*100) return 'Diamond';
  if (percent >= (242/250)*100) return 'Platinum';
  if (percent >= (238/250)*100) return 'Gold';
  return 'Bronze';
}

// New: classification from raw score records with provisional logic
// scores: [{ score:number, tiebreakerData?:{xCount:number}, shots?:[{isX:boolean,value:number}], createdAt?:date-like }]
// opts: { windowDays?: number, considerN?: number, bestK?: number, minFull?: number }
function getClassificationFromScores(scores, opts = {}) {
  const windowDays = opts.windowDays ?? 365; // look back up to a year by default
  const considerN = opts.considerN ?? 10;   // consider last N cards
  const bestK = opts.bestK ?? 6;            // best K of those
  const minFull = opts.minFull ?? 6;        // need at least this many for a non-provisional

  const now = Date.now();
  const toMs = (d) => {
    try {
      if (!d) return 0;
      if (typeof d === 'object') {
        if (typeof d.toMillis === 'function') return d.toMillis();
        if (typeof d.toDate === 'function') return d.toDate().getTime();
        if (typeof d._seconds === 'number') return d._seconds * 1000;
        if (typeof d.seconds === 'number') return d.seconds * 1000;
      }
      const t = Date.parse(d);
      return Number.isFinite(t) ? t : 0;
    } catch (_) { return 0; }
  };

  const normalize = (s) => {
    const pts = typeof s?.score === 'number' ? s.score : parseInt(s?.score, 10) || 0;
    const x = Number.isFinite(s?.tiebreakerData?.xCount)
      ? s.tiebreakerData.xCount
      : Array.isArray(s?.shots) ? s.shots.filter(sh => sh?.isX === true).length : 0;
    const ts = toMs(s?.submittedAt || s?.createdAt || s?.updatedAt);
    return { pts, x, ts };
  };

  const all = (Array.isArray(scores) ? scores : []).map(normalize);
  if (all.length === 0) {
    return { tier: 'Rookie', classificationLabel: 'Rookie', provisional: true, sampleCount: 0 };
  }

  // Filter by time window and take most recent N
  const minTs = now - windowDays * 24 * 60 * 60 * 1000;
  const recent = all.filter(r => r.ts === 0 || r.ts >= minTs) // keep undated too
                    .sort((a, b) => (b.ts - a.ts));
  const lastN = recent.slice(0, considerN);

  const useForAvg = lastN.length >= minFull ? bestK : Math.min(lastN.length, bestK);
  const top = lastN
    .slice()
    .sort((a, b) => (b.pts - a.pts) || (b.x - a.x))
    .slice(0, useForAvg);

  const avgPts = top.reduce((sum, r) => sum + r.pts, 0) / top.length;
  const avgX = top.reduce((sum, r) => sum + r.x, 0) / top.length;
  const tier = getClassificationFromCard(avgPts, avgX);
  const provisional = lastN.length < minFull;

  return {
    tier,
    classificationLabel: provisional ? `Provisional ${tier}` : tier,
    provisional,
    sampleCount: lastN.length,
    avgCard: avgPts,
    avgX
  };
}

module.exports = { getClassificationFromAverage, getClassificationFromCard, getClassificationFromScores, to250 };
