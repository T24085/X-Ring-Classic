const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Temporary in-memory fixtures until sponsorship collections are persisted
const SAMPLE_SPONSORSHIPS = [
  {
    id: 'left-rail-q1',
    placement: 'Homepage Left Rail Banner',
    campaignName: 'Acme Optics Q1 Awareness',
    startDate: '2024-02-01T00:00:00.000Z',
    endDate: '2024-03-01T00:00:00.000Z',
    duration: '30-day placement',
    status: 'active',
    invoiceId: 'INV-2024-021',
    paymentStatus: 'Paid',
    amount: '$100.00',
    metrics: {
      impressions: 12840,
      clicks: 312,
      ctr: 2.43,
    },
  },
  {
    id: 'right-rail-spring',
    placement: 'Homepage Right Rail Banner',
    campaignName: 'Precision Ammo Spring Promo',
    startDate: '2024-03-10T00:00:00.000Z',
    endDate: '2024-04-09T00:00:00.000Z',
    duration: '30-day placement',
    status: 'upcoming',
    invoiceId: 'INV-2024-034',
    paymentStatus: 'Pending',
    amount: '$100.00',
    metrics: {
      impressions: 0,
      clicks: 0,
      ctr: null,
    },
  },
  {
    id: 'footer-year-end',
    placement: 'Footer Marquee Banner',
    campaignName: 'Range Gear Holiday Gift Guide',
    startDate: '2023-12-01T00:00:00.000Z',
    endDate: '2023-12-30T00:00:00.000Z',
    duration: '30-day placement',
    status: 'completed',
    invoiceId: 'INV-2023-198',
    paymentStatus: 'Paid',
    amount: '$50.00',
    metrics: {
      impressions: 8450,
      clicks: 141,
      ctr: 1.67,
    },
  },
];

const SAMPLE_ANALYTICS = {
  timeframe: 'Last 30 days',
  totals: {
    impressions: 18450,
    clicks: 453,
  },
  placements: {
    'homepage-left-rail': {
      impressions: 12840,
      clicks: 312,
      ctr: 2.43,
    },
    'homepage-right-rail': {
      impressions: 4110,
      clicks: 101,
      ctr: 2.46,
    },
    'footer-marquee': {
      impressions: 1500,
      clicks: 40,
      ctr: 2.66,
    },
  },
  conversions: {
    reported: 7,
    pendingAttribution: 3,
  },
  placeholders: {
    conversionRate: '—',
    averageCtr: '2.45',
  },
};

const SAMPLE_PAYMENTS = [
  {
    id: 'INV-2024-034',
    label: 'Right Rail Banner – April 2024',
    amount: '$100.00',
    status: 'pending',
    dueDate: '2024-03-07T00:00:00.000Z',
  },
  {
    id: 'INV-2024-021',
    label: 'Left Rail Banner – February 2024',
    amount: '$100.00',
    status: 'paid',
    dueDate: '2024-01-28T00:00:00.000Z',
  },
];

// Ensure only sponsor profiles (and admins for support) can access sponsorship data
const requireSponsorRole = [authenticateToken, requireRole(['sponsor', 'admin'])];

router.get('/', requireSponsorRole, (req, res) => {
  res.json({ sponsorships: SAMPLE_SPONSORSHIPS });
});

router.get('/analytics', requireSponsorRole, (req, res) => {
  res.json({ analytics: SAMPLE_ANALYTICS });
});

router.get('/payments', requireSponsorRole, (req, res) => {
  res.json({ payments: SAMPLE_PAYMENTS });
});

router.get('/dashboard', requireSponsorRole, (req, res) => {
  res.json({
    sponsorships: SAMPLE_SPONSORSHIPS,
    analytics: SAMPLE_ANALYTICS,
    payments: SAMPLE_PAYMENTS,
    lastUpdated: new Date().toISOString(),
    account: {
      organization: req.user?.organization || req.user?.profile?.company || req.user?.username,
      contactEmail: req.user?.email,
      pointOfContact: req.user?.profile?.firstName
        ? `${req.user.profile.firstName} ${req.user.profile.lastName || ''}`.trim()
        : req.user?.username,
    },
  });
});

module.exports = router;
