import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { loadPaypalHostedButtons } from '../../utils/paypal';

const PAYPAL_BUTTON_ID = '6DVDJ58FZPUXC';

const RangeAdminSignup = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPayment, setShowPayment] = useState(false);
  const [formSnapshot, setFormSnapshot] = useState(null);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalError, setPaypalError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const paypalClientId = useMemo(() => process.env.REACT_APP_PAYPAL_CLIENT_ID || 'test', []);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      rangeCountry: 'US',
    },
  });

  const password = watch('password');

  const handlePaymentApproved = useCallback(async (orderId) => {
    if (!formSnapshot) {
      toast.error('Missing form details. Please restart sign-up.');
      return;
    }

    setPaypalLoading(true);
    setPaypalError(null);
    try {
      const { confirmPassword, ...formValues } = formSnapshot;
      const payload = {
        ...formValues,
        paypalOrderId: orderId,
      };

      await authAPI.rangeAdminSignup(payload);
      setPaymentSuccess(true);
      toast.success('Payment confirmed! Creating your range admin account...');

      try {
        const loginResult = await login(payload.email, payload.password);
        if (loginResult?.success) {
          toast.success('Welcome! You are now signed in.');
          navigate('/range-admin', { replace: true });
          return;
        }
      } catch (loginError) {
        console.error('Auto login after signup failed:', loginError);
      }

      toast('Account created. Please sign in to continue.', { icon: 'ℹ️' });
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Range admin signup error:', error);
      const message = error?.response?.data?.error || 'Unable to complete sign-up. Please contact support.';
      setPaypalError(message);
      toast.error(message);
    } finally {
      setPaypalLoading(false);
    }
  }, [formSnapshot, login, navigate]);

  const renderPaypalButton = useCallback(() => {
    if (!showPayment || !formSnapshot) {
      return;
    }

    const containerId = 'paypal-range-admin-signup';
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
            toast('Payment cancelled. You can try again when ready.', { icon: 'ℹ️' });
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
  }, [formSnapshot, handlePaymentApproved, paypalClientId, showPayment]);

  useEffect(() => {
    renderPaypalButton();
  }, [renderPaypalButton]);

  const onSubmit = async () => {
    const isValid = await trigger();
    if (!isValid) {
      toast.error('Please fix the highlighted fields before continuing.');
      return;
    }

    const values = getValues();
    setFormSnapshot(values);
    setShowPayment(true);
    setPaypalError(null);
    toast.success('Almost done! Complete the secure PayPal payment below.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur rounded-2xl shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-8 lg:p-10 bg-slate-900 text-white">
            <img
              src={`${process.env.PUBLIC_URL}/TheXringClassic.png`}
              alt="The X-Ring Classic"
              className="h-16 w-auto object-contain mb-6"
            />
            <h1 className="text-3xl font-bold mb-4">Range Admin Membership</h1>
            <p className="text-slate-200 mb-4">
              Join the X-Ring Classic range network to host matches, approve competitor scores, and access detailed revenue
              analytics for your facility. A monthly $20 subscription unlocks full access to range tools.
            </p>
            <ul className="space-y-3 text-slate-100">
              <li className="flex items-start">
                <span className="mr-2 text-green-400">✔</span>
                <span>Publish and manage competitions for your range</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-green-400">✔</span>
                <span>Approve competitor scores and maintain leaderboards</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-green-400">✔</span>
                <span>Track revenue, payments, and renewal reminders in one dashboard</span>
              </li>
            </ul>
          </div>

          <div className="p-8 lg:p-10">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Tell us about you and your range</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">First Name *</label>
                  <input
                    type="text"
                    className={`input-field mt-1 ${errors.firstName ? 'border-red-500' : ''}`}
                    {...register('firstName', { required: 'First name is required' })}
                  />
                  {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Last Name *</label>
                  <input
                    type="text"
                    className={`input-field mt-1 ${errors.lastName ? 'border-red-500' : ''}`}
                    {...register('lastName', { required: 'Last name is required' })}
                  />
                  {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email *</label>
                  <input
                    type="email"
                    className={`input-field mt-1 ${errors.email ? 'border-red-500' : ''}`}
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Please enter a valid email address',
                      },
                    })}
                  />
                  {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Phone</label>
                  <input
                    type="tel"
                    className={`input-field mt-1 ${errors.phone ? 'border-red-500' : ''}`}
                    placeholder="(555) 123-4567"
                    {...register('phone', {
                      pattern: {
                        value: /^[0-9+()\-\s]{7,20}$/,
                        message: 'Enter a valid phone number',
                      },
                    })}
                  />
                  {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Username *</label>
                  <input
                    type="text"
                    className={`input-field mt-1 ${errors.username ? 'border-red-500' : ''}`}
                    {...register('username', {
                      required: 'Username is required',
                      minLength: { value: 3, message: 'At least 3 characters' },
                      maxLength: { value: 30, message: 'At most 30 characters' },
                      pattern: {
                        value: /^[a-zA-Z0-9_]+$/,
                        message: 'Only letters, numbers, and underscores allowed',
                      },
                    })}
                  />
                  {errors.username && <p className="text-xs text-red-600 mt-1">{errors.username.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Password *</label>
                  <input
                    type="password"
                    className={`input-field mt-1 ${errors.password ? 'border-red-500' : ''}`}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'Minimum 6 characters' },
                    })}
                  />
                  {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Confirm Password *</label>
                <input
                  type="password"
                  className={`input-field mt-1 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) => value === password || 'Passwords do not match',
                  })}
                />
                {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Range Name *</label>
                <input
                  type="text"
                  className={`input-field mt-1 ${errors.rangeName ? 'border-red-500' : ''}`}
                  {...register('rangeName', { required: 'Range name is required' })}
                />
                {errors.rangeName && <p className="text-xs text-red-600 mt-1">{errors.rangeName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Range Website</label>
                <input
                  type="url"
                  className={`input-field mt-1 ${errors.rangeWebsite ? 'border-red-500' : ''}`}
                  placeholder="https://"
                  {...register('rangeWebsite', {
                    pattern: {
                      value: /^(https?:\/\/)?[\w.-]+(\.[\w.-]+)+[\w\-._~:/?#[\]@!$&'()*+,;=.]*$/,
                      message: 'Enter a valid URL',
                    },
                  })}
                />
                {errors.rangeWebsite && <p className="text-xs text-red-600 mt-1">{errors.rangeWebsite.message}</p>}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Address Line 1 *</label>
                  <input
                    type="text"
                    className={`input-field mt-1 ${errors.rangeAddressLine1 ? 'border-red-500' : ''}`}
                    {...register('rangeAddressLine1', { required: 'Address is required' })}
                  />
                  {errors.rangeAddressLine1 && <p className="text-xs text-red-600 mt-1">{errors.rangeAddressLine1.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Address Line 2</label>
                  <input
                    type="text"
                    className="input-field mt-1"
                    {...register('rangeAddressLine2')}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">City *</label>
                    <input
                      type="text"
                      className={`input-field mt-1 ${errors.rangeCity ? 'border-red-500' : ''}`}
                      {...register('rangeCity', { required: 'City is required' })}
                    />
                    {errors.rangeCity && <p className="text-xs text-red-600 mt-1">{errors.rangeCity.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">State / Province *</label>
                    <input
                      type="text"
                      className={`input-field mt-1 ${errors.rangeState ? 'border-red-500' : ''}`}
                      {...register('rangeState', { required: 'State or province is required' })}
                    />
                    {errors.rangeState && <p className="text-xs text-red-600 mt-1">{errors.rangeState.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Postal Code *</label>
                    <input
                      type="text"
                      className={`input-field mt-1 ${errors.rangePostalCode ? 'border-red-500' : ''}`}
                      {...register('rangePostalCode', { required: 'Postal code is required' })}
                    />
                    {errors.rangePostalCode && <p className="text-xs text-red-600 mt-1">{errors.rangePostalCode.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Country *</label>
                    <input
                      type="text"
                      className={`input-field mt-1 ${errors.rangeCountry ? 'border-red-500' : ''}`}
                      {...register('rangeCountry', { required: 'Country is required' })}
                    />
                    {errors.rangeCountry && <p className="text-xs text-red-600 mt-1">{errors.rangeCountry.message}</p>}
                  </div>
                </div>
              </div>

              {!showPayment && !paymentSuccess && (
                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue to $20 PayPal Checkout
                </button>
              )}
            </form>

            {showPayment && !paymentSuccess && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Complete your subscription payment</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Secure payment is processed via PayPal. Once the transaction completes, your range admin account will be
                  activated automatically.
                </p>
                <div id="paypal-range-admin-signup" className="min-h-[60px]"></div>
                {paypalLoading && (
                  <div className="mt-4 flex items-center space-x-2 text-slate-600">
                    <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>Preparing PayPal checkout...</span>
                  </div>
                )}
                {paypalError && <p className="mt-3 text-sm text-red-600">{paypalError}</p>}
              </div>
            )}

            {paymentSuccess && (
              <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                Payment received! Finishing account setup...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RangeAdminSignup;
