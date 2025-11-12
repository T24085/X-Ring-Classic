import React, { useMemo, useState } from 'react';

// Map classification to the exact PNG filenames in /public/
const filenameForClass = (classification) => {
  if (!classification) return null;
  const c = String(classification).trim().toLowerCase();
  if (c === 'gm' || c.includes('grand')) return 'GM.png';
  if (c.includes('master')) return 'Master.png';
  if (c.includes('diamond')) return 'Diamond.png';
  if (c.includes('platinum')) return 'Platinum.png';
  if (c.includes('gold')) return 'Gold.png';
  if (c.includes('bronze')) return 'Bronze.png';
  return null;
};

const RankLogo = ({ classification, size = 24, className = '' }) => {
  const [imageError, setImageError] = useState(false);
  const src = useMemo(() => {
    const file = filenameForClass(classification);
    if (!file) return null;
    const publicUrl = process.env.PUBLIC_URL || '';
    // Images are in the public root: /GM.png, /Master.png, etc.
    return `${publicUrl}/${file}`;
  }, [classification]);

  if (!src || imageError) return null;
  
  const style = { width: size, height: size };
  return (
    <img
      src={src}
      alt={`${classification} logo`}
      title={classification}
      style={style}
      className={`inline-block object-contain ${className}`}
      onError={(e) => {
        // Silently hide image on error to prevent console spam
        e.currentTarget.style.display = 'none';
        setImageError(true);
      }}
    />
  );
};

export default RankLogo;
