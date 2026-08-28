import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebaseClient';

const SERIES_ID = 'x-ring-first-third-wednesday';
const MONTHS_AHEAD = 12;
const DEFAULT_START_TIME = '09:00';
const DEFAULT_END_TIME = '17:00';

const pad = (value) => String(value).padStart(2, '0');

const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const ordinal = (day) => {
  const suffix = day % 10 === 1 && day % 100 !== 11
    ? 'st'
    : day % 10 === 2 && day % 100 !== 12
      ? 'nd'
      : day % 10 === 3 && day % 100 !== 13
        ? 'rd'
        : 'th';
  return `${day}${suffix}`;
};

const titleForDate = (date) => (
  `X-Ring ${date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).replace(/(\d+)(,)/, (_, day, comma) => `${ordinal(Number(day))}${comma}`)}`
);

const firstAndThirdWednesdays = (year, monthIndex) => {
  const wednesdays = [];
  for (let day = 1; day <= 31; day += 1) {
    const candidate = new Date(year, monthIndex, day, 9, 0, 0, 0);
    if (candidate.getMonth() !== monthIndex) break;
    if (candidate.getDay() === 3) wednesdays.push(candidate);
  }
  return [wednesdays[0], wednesdays[2]].filter(Boolean);
};

const futureCompetitionDates = (now = new Date()) => {
  const dates = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let offset = 0; offset <= MONTHS_AHEAD; offset += 1) {
    const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    firstAndThirdWednesdays(month.getFullYear(), month.getMonth()).forEach((date) => {
      if (date >= today) dates.push(date);
    });
  }

  return dates;
};

const compactRange = (range, fallbackName = 'Gun Guys II') => {
  const location = [range?.address, range?.city, range?.state, range?.zipCode]
    .filter(Boolean)
    .join(', ');
  const name = range?.name || fallbackName;
  return {
    id: range?.id || null,
    name,
    address: range?.address || location || name,
    location: range?.location || location || name,
  };
};

const resolveRange = async (user) => {
  const rangesSnapshot = await getDocs(collection(db, 'ranges'));
  const ranges = rangesSnapshot.docs
    .map((rangeDoc) => ({ id: rangeDoc.id, ...rangeDoc.data() }))
    .filter((range) => range.isActive !== false);

  const preferred = ranges.find((range) => (
    (user?.rangeId && range.id === user.rangeId)
    || (user?.rangeName && range.name?.toLowerCase() === user.rangeName.toLowerCase())
    || range.name?.toLowerCase() === 'gun guys ii'
  )) || ranges[0];

  // Gun Guys II is the existing competition default in this project. Keep the
  // fallback usable if the range collection is temporarily unavailable.
  return compactRange(preferred, user?.rangeName || 'Gun Guys II');
};

const createCompetitionPayload = (date, range, user) => {
  const registrationDeadline = new Date(date);
  registrationDeadline.setDate(registrationDeadline.getDate() - 1);
  registrationDeadline.setHours(23, 59, 59, 999);

  return {
    title: titleForDate(date),
    description: 'Monthly X-Ring precision .22 rifle competition. Four 25-shot targets for 100 shots total.',
    type: 'indoor',
    competitionType: 'indoor',
    format: 'benchrest',
    distance: '25 yards',
    maxDistance: 25,
    duration: '4 hours',
    shotsPerTarget: 25,
    targetCount: 4,
    totalShots: 100,
    targets: [1, 2, 3, 4].map((targetNumber) => ({ targetNumber, shots: 25 })),
    schedule: {
      competitionDate: date.toISOString(),
      startTime: DEFAULT_START_TIME,
      endTime: DEFAULT_END_TIME,
      registrationDeadline: registrationDeadline.toISOString(),
    },
    range,
    rangeId: range.id,
    maxParticipants: 50,
    prizePool: 0,
    status: 'published',
    visibility: 'public',
    recurrence: {
      seriesId: SERIES_ID,
      rule: 'First and third Wednesday of every month',
      timezone: 'America/Chicago',
    },
    recurrenceKey: `${SERIES_ID}-${dateKey(date)}`,
    organizerId: user?.id || null,
    registeredCount: 0,
    participants: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
};

export const ensureRecurringCompetitions = async (user) => {
  if (!['admin', 'range_admin'].includes(user?.role)) return { created: 0, skipped: true };

  const range = await resolveRange(user);
  const existingSnapshot = await getDocs(query(
    collection(db, 'competitions'),
    where('recurrence.seriesId', '==', SERIES_ID)
  ));
  const existingKeys = new Set(existingSnapshot.docs.map((competitionDoc) => competitionDoc.data()?.recurrenceKey));
  const dates = futureCompetitionDates();
  let created = 0;

  await Promise.all(dates.map(async (date) => {
    const key = `${SERIES_ID}-${dateKey(date)}`;
    if (existingKeys.has(key)) return;

    // Deterministic IDs make concurrent admin sessions safe and prevent a
    // second browser from creating a duplicate monthly event.
    await setDoc(doc(db, 'competitions', key), createCompetitionPayload(date, range, user));
    created += 1;
  }));

  return { created, scheduled: dates.length };
};
