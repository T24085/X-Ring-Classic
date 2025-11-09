import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  StopIcon
} from '@heroicons/react/24/outline';
import { sponsorshipAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const SummaryCard = ({ title, value, icon: Icon, description }) => (
  <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-5 flex items-start gap-4 shadow-lg">
    <div className="bg-red-600/10 text-red-300 rounded-lg p-3">
      <Icon className="w-6 h-6" />
    </div>
    <div className="flex-1">
      <p className="text-sm text-gray-400 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
    </div>
  </div>
);

const SponsorDashboard = () => {
  const { user } = useAuth();
  const [sponsorships, setSponsorships] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [sponsorshipRes, analyticsRes, paymentsRes] = await Promise.all([
          sponsorshipAPI.getSponsorships(),
          sponsorshipAPI.getAnalytics(),
          sponsorshipAPI.getPayments(),
        ]);

        setSponsorships(sponsorshipRes?.sponsorships ?? []);
        setAnalytics(analyticsRes?.analytics ?? analyticsRes ?? null);
        setPayments(paymentsRes?.payments ?? []);
      } catch (err) {
        console.error('Failed to load sponsorship dashboard data', err);
        setError('Unable to load sponsorship insights. Please refresh or contact partnerships@thexringclassic.com.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const { activeCount, upcomingCount, impressions, clicks } = useMemo(() => {
    const now = new Date();
    const active = sponsorships.filter((item) => {
      const start = item.startDate ? new Date(item.startDate) : null;
      const end = item.endDate ? new Date(item.endDate) : null;
      return start && end ? start <= now && end >= now : item.status === 'active';
    }).length;

    const upcoming = sponsorships.filter((item) => {
      const start = item.startDate ? new Date(item.startDate) : null;
      return start ? start > now : item.status === 'upcoming';
    }).length;

    const totals = analytics?.totals ?? {};

    return {
      activeCount: active,
      upcomingCount: upcoming,
      impressions: totals.impressions ?? 0,
      clicks: totals.clicks ?? 0,
    };
  }, [analytics, sponsorships]);

  const renderStatusBadge = (status) => {
    const normalized = status?.toLowerCase();
    const statusStyles = {
      active: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40',
      upcoming: 'bg-blue-500/10 text-blue-300 border border-blue-500/40',
      completed: 'bg-gray-500/10 text-gray-300 border border-gray-500/40',
      pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/40',
      cancelled: 'bg-red-500/10 text-red-300 border border-red-500/40',
    };

    return (
      <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[normalized] ?? 'bg-gray-600/20 text-gray-200'}`}>
        {normalized === 'active' ? <PlayIcon className="w-3.5 h-3.5" /> : null}
        {normalized === 'completed' ? <StopIcon className="w-3.5 h-3.5" /> : null}
        {normalized === 'pending' ? <ClockIcon className="w-3.5 h-3.5" /> : null}
        {normalized && !['active', 'completed', 'pending'].includes(normalized) ? <ChartBarIcon className="w-3.5 h-3.5" /> : null}
        <span className="capitalize">{status ?? 'Unknown'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Sponsor Dashboard</h1>
          <p className="text-sm text-gray-400 mt-2">
            {user?.organization || user?.company || user?.profile?.company || user?.profile?.firstName ? (
              <span>Campaign performance overview for <span className="text-gray-200 font-medium">{user.organization || user.company || user.profile?.company || user.profile?.firstName}</span>.</span>
            ) : (
              'Campaign performance overview and asset management hub.'
            )}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white px-4 py-2 border border-gray-700 rounded-lg bg-gray-900/70"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh data
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4 text-gray-300">
            <ArrowPathIcon className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading sponsorship performance…</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/40 text-red-200 rounded-xl p-6 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-6 h-6" />
          <div>
            <p className="font-semibold">{error}</p>
            <p className="text-sm text-red-100 mt-1">If the issue persists, email sponsorships@thexringclassic.com for support.</p>
          </div>
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Active placements"
              value={activeCount}
              icon={PlayIcon}
              description="Currently live on site"
            />
            <SummaryCard
              title="Upcoming flights"
              value={upcomingCount}
              icon={ClockIcon}
              description="Scheduled to launch"
            />
            <SummaryCard
              title="30-day impressions"
              value={impressions.toLocaleString()}
              icon={ChartBarIcon}
              description={analytics?.timeframe ? `Reporting window: ${analytics.timeframe}` : 'Rolling 30-day view'}
            />
            <SummaryCard
              title="30-day clicks"
              value={clicks.toLocaleString()}
              icon={CheckCircleIcon}
              description="Unique click-through totals"
            />
          </section>

          <section className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Sponsorship placements</h2>
                <p className="text-sm text-gray-400">Active, upcoming, and historical bookings with payment status.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-2 text-left">Placement</th>
                    <th className="px-4 py-2 text-left">Flight window</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Payment</th>
                    <th className="px-4 py-2 text-left">Latest metrics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-sm text-gray-200">
                  {sponsorships.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-800/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{item.placement}</p>
                        <p className="text-xs text-gray-400">{item.campaignName || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-300">
                          <p>{item.startDate ? new Date(item.startDate).toLocaleDateString() : 'TBD'} → {item.endDate ? new Date(item.endDate).toLocaleDateString() : 'TBD'}</p>
                          <p className="text-gray-500">{item.duration || '30-day flight'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{renderStatusBadge(item.status)}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-300">{item.paymentStatus || 'Pending enablement'}</p>
                        <p className="text-xs text-gray-500">Invoice: {item.invoiceId || 'N/A'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-300 space-y-1">
                          <p>Impressions: {item.metrics?.impressions?.toLocaleString?.() ?? '—'}</p>
                          <p>Clicks: {item.metrics?.clicks?.toLocaleString?.() ?? '—'}</p>
                          <p>CTR: {item.metrics?.ctr ? `${item.metrics.ctr}%` : '—'}</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sponsorships.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                        No sponsorships found. Once your first placement is confirmed it will appear here with live metrics.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 shadow-lg space-y-4 lg:col-span-2">
              <h2 className="text-lg font-semibold text-white">Visitor analytics</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {analytics?.placements ? (
                  Object.entries(analytics.placements).map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-2">
                      <p className="text-sm text-gray-400 uppercase tracking-wide">{key.replace(/-/g, ' ')}</p>
                      <p className="text-2xl font-semibold text-white">{value.impressions?.toLocaleString?.() ?? '—'} impressions</p>
                      <p className="text-sm text-gray-400">Clicks: {value.clicks?.toLocaleString?.() ?? '—'}</p>
                      <p className="text-sm text-gray-500">CTR: {value.ctr ? `${value.ctr}%` : '—'}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">Analytics will populate once your campaign delivers impressions.</p>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-3 text-sm text-gray-300">
                <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
                  <p className="text-xs uppercase text-gray-500">Conversion rate</p>
                  <p className="text-lg font-semibold text-white">{analytics?.placeholders?.conversionRate ?? '—'}%</p>
                  <p className="text-xs text-gray-500">Placeholder metric — integrate CRM attribution feed to activate.</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
                  <p className="text-xs uppercase text-gray-500">Average CTR</p>
                  <p className="text-lg font-semibold text-white">{analytics?.placeholders?.averageCtr ?? '—'}%</p>
                  <p className="text-xs text-gray-500">Automatic once click + impression tracking fully enabled.</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
                  <p className="text-xs uppercase text-gray-500">Post-click conversions</p>
                  <p className="text-lg font-semibold text-white">{analytics?.conversions?.reported ?? 0}</p>
                  <p className="text-xs text-gray-500">Placeholder for future ecommerce or CRM integrations.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 shadow-lg space-y-4">
              <h2 className="text-lg font-semibold text-white">Payments & invoices</h2>
              <ul className="space-y-3 text-sm text-gray-200">
                {payments.map((payment) => (
                  <li key={payment.id} className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{payment.label}</p>
                        <p className="text-xs text-gray-400">Due: {payment.dueDate ? new Date(payment.dueDate).toLocaleDateString() : 'TBD'}</p>
                      </div>
                      <span className={`text-xs font-semibold uppercase ${payment.status === 'paid' ? 'text-emerald-300' : payment.status === 'pending' ? 'text-amber-300' : 'text-red-300'}`}>
                        {payment.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Amount: {payment.amount}</p>
                  </li>
                ))}
                {payments.length === 0 && (
                  <li className="text-sm text-gray-400">Invoices will appear once a sponsorship is confirmed.</li>
                )}
              </ul>

              <div className="bg-gray-950/60 border border-dashed border-gray-800 rounded-lg p-4 text-center text-sm text-gray-400">
                <DocumentArrowUpIcon className="w-6 h-6 mx-auto text-gray-500" />
                <p className="mt-2 font-medium text-gray-200">Asset management</p>
                <p className="text-xs text-gray-500 mt-1">
                  Upload and version banner creatives directly from this dashboard. Asset library integration is in development.
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default SponsorDashboard;
