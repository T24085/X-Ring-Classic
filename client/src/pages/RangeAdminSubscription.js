import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { rangesAPI } from '../services/api.firebase';
import { paymentsAPI } from '../services/api';
import { loadPaypalHostedButtons } from '../utils/paypal';

const PAYPAL_BUTTON_ID = '6DVDJ58FZPUXC';

const toDate = (value) => {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : new Date(parsed);
  }
  if (value instanceof Date) return value;
  return null;
};

const RangeAdminSubscription = () => {
  const { user, updateUser } = useAuth();
  const paypalClientId = useMemo(() => process.env.REACT_APP_PAYPAL_CLIENT_ID || 'test', []);
  const [paypalError, setPaypalError] = useState(null);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const { data: rangeData, isLoading } = useQuery(
    ['range-admin-range', user?.id],
    () => rangesAPI.getByAdminId(user?.id),
    {
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000,
    }
  );

  const range = rangeData?.data?.range;
  const subscriptionStatus = range?.subscriptionStatus || user?.subscriptionStatus || 'inactive';
  const renewalDate = toDate(range?.subscriptionRenewalDate || user?.subscriptionRenewalDate);
  const lastPaymentDate = toDate(range?.subscriptionLastPaymentDate || user?.subscriptionLastPaymentDate);
  const subscriptionAmount = range?.subscriptionAmount || user?.subscriptionAmount || 20;
  const subscriptionCurrency = range?.subscriptionCurrency || user?.subscriptionCurrency || 'USD';

  const handlePaymentApproved = useCallback(async (orderId) => {
    if (!range?.id && !user?.rangeId) {
      toast.error('Range information missing. Please contact support.');
      return;
    }

    setPaypalLoading(true);
    setPaypalError(null);

    try {
      const response = await paymentsAPI.confirmRangeAdminPayment({
        paypalOrderId: orderId,
        rangeId: range?.id || user?.rangeId,
      });

      updateUser({
        subscriptionStatus: response.subscriptionStatus,
        subscriptionRenewalDate: response.renewalDate,
        subscriptionAmount: response.amount,
        subscriptionCurrency: response.currency,
      });

      setPaymentComplete(true);
      toast.success('Payment confirmed. Your range admin access is active.');
    } catch (error) {
      console.error('Payment confirmation failed:', error);
      const message = error?.response?.data?.error || 'Unable to confirm payment. Please try again.';
      setPaypalError(message);
      toast.error(message);
    } finally {
      setPaypalLoading(false);
    }
  }, [range?.id, updateUser, user?.rangeId]);

  const renderPaypalButton = useCallback(() => {
    if (paymentComplete) {
      return;
    }

    const containerId = 'paypal-range-admin-subscription';
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    container.innerHTML = '';
    setPaypalLoading(true);
    setPaypalError(null);

    loadPaypalHostedButtons(paypalClientId)
      .then((paypal) => {
        if (!paypal || !paypal.HostedButtons) {
          throw new Error('PayPal Hosted Buttons are unavailable');
        }

        return paypal.HostedButtons({
          hostedButtonId: PAYPAL_BUTTON_ID,
          onApprove: async (data) => {
            await handlePaymentApproved(data.orderID);
          },
          onError: (err) => {
            console.error('PayPal error:', err);
            setPaypalError('Payment could not be completed. Please try again.');
            setPaypalLoading(false);
          },
          onCancel: () => {
            setPaypalLoading(false);
            toast('Payment cancelled. Feel free to try again when ready.', { icon: 'ℹ️' });
          },
        }).render(`#${containerId}`);
      })
      .catch((err) => {
        console.error('Failed to load PayPal Hosted Buttons:', err);
        setPaypalError('Unable to load PayPal checkout. Please refresh and try again.');
      })
      .finally(() => {
        setPaypalLoading(false);
      });
  }, [handlePaymentApproved, paymentComplete, paypalClientId]);

  useEffect(() => {
    if (subscriptionStatus !== 'active') {
      renderPaypalButton();
    }
  }, [renderPaypalButton, subscriptionStatus]);

  const renewalLabel = renewalDate
    ? `${format(renewalDate, 'PPP')} (${formatDistanceToNow(renewalDate, { addSuffix: true })})`
    : 'Not scheduled';
  const lastPaymentLabel = lastPaymentDate ? format(lastPaymentDate, 'PPP') : 'No payments recorded';

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white/95 rounded-2xl shadow-xl p-8 md:p-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Range Admin Subscription</h1>
        {range?.name && (
          <p className="text-sm text-slate-500 mb-2">Range: <span className="font-semibold text-slate-700">{range.name}</span></p>
        )}
        <p className="text-slate-600 mb-8">
          Manage your monthly subscription and keep your range tools active. A paid subscription is required to access the
          Range Admin dashboard and create competitions.
        </p>

        {isLoading ? (
          <div className="flex items-center space-x-2 text-slate-600">
            <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading range details...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-500">Subscription Status</p>
                <p className={`text-lg font-semibold ${subscriptionStatus === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                  {subscriptionStatus.replace(/_/g, ' ') || 'inactive'}
                </p>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-500">Monthly Cost</p>
                <p className="text-lg font-semibold text-slate-900">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: subscriptionCurrency }).format(subscriptionAmount)}
                </p>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-500">Next Renewal</p>
                <p className="text-lg font-semibold text-slate-900">{renewalLabel}</p>
              </div>
              <div className="p-4 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-500">Last Payment</p>
                <p className="text-lg font-semibold text-slate-900">{lastPaymentLabel}</p>
              </div>
            </div>

            {subscriptionStatus !== 'active' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                Your range admin subscription is inactive. Complete the $20 PayPal checkout below to restore access.
              </div>
            )}

            {subscriptionStatus === 'active' && renewalDate && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                Your subscription is active. We will remind you as the next renewal approaches.
              </div>
            )}

            {subscriptionStatus !== 'active' && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Complete payment</h2>
                <p className="text-sm text-slate-600 mb-4">
                  Use the secure PayPal button to renew your subscription. Once payment is confirmed, you will regain access
                  immediately.
                </p>
                <div id="paypal-range-admin-subscription" className="min-h-[60px]"></div>
                {paypalLoading && (
                  <div className="mt-4 flex items-center space-x-2 text-slate-600">
                    <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>Preparing PayPal checkout...</span>
                  </div>
                )}
                {paypalError && <p className="mt-3 text-sm text-red-600">{paypalError}</p>}
                {paymentComplete && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700">
                    Payment received! Refreshing your subscription details...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RangeAdminSubscription;
