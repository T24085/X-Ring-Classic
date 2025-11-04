import React, { useMemo, useState } from 'react';

// Map various labels to a canonical filename in /public/ranks
const toKey = (classification) => {
  if (!classification) return null;
  const c = String(classification).trim().toLowerCase();
  if (c === 'gm' || c.includes('grand')) return 'gm';
  if (c.includes('master')) return c.includes('grand') ? 'gm' : 'master';
  if (c.includes('diamond')) return 'diamond';
  if (c.includes('platinum')) return 'platinum';
  if (c.includes('gold')) return 'gold';
  if (c.includes('bronze')) return 'bronze';
  return null;
};

const buildCandidates = (classification) => {
  const key = toKey(classification);
  const publicUrl = process.env.PUBLIC_URL || '';
  const list = [];
  const add = (name) => {
    if (!name) return;
    const bases = [
      `${publicUrl}/ranks`,
      `${publicUrl}/images/ranks`,
      `${publicUrl}/img/ranks`,
      `${publicUrl}/assets/ranks`
    ];
    ["png","svg","jpg","jpeg","webp"].forEach(ext => {
      bases.forEach(base => list.push(`${base}/${name}.${ext}`));
      // also try the public root (e.g., /GM.png or /X-Ring-Classic/GM.png)
      list.push(`${publicUrl}/${name}.${ext}`);
    });
  };
  // canonical
  add(key);

  // common synonyms and capitalizations
  if (key === 'gm') {
    ['GM','grandmaster','GrandMaster','grand-master','grand_master','Grand Master','grand master'].forEach(add);
  } else if (key === 'master') {
    ['Master','masters','Masters'].forEach(add);
  } else if (key === 'diamond') {
    ['Diamond'].forEach(add);
  } else if (key === 'platinum') {
    ['Platinum'].forEach(add);
  } else if (key === 'gold') {
    ['Gold'].forEach(add);
  } else if (key === 'bronze') {
    ['Bronze'].forEach(add);
  }
  // de-duplicate while keeping order
  return Array.from(new Set(list));
};

const RankLogo = ({ classification, size = 24, className = '' }) => {
  const candidates = useMemo(() => buildCandidates(classification), [classification]);
  const [idx, setIdx] = useState(0);
  if (!candidates.length || idx >= candidates.length) return null;
  const style = { width: size, height: size };
  return (
    <img
      src={candidates[idx]}
      alt={`${classification} logo`}
      title={classification}
      style={style}
      className={`inline-block object-contain ${className}`}
      onError={() => setIdx(i => i + 1)}
    />
  );
};

export default RankLogo;
