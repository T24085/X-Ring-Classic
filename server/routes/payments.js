const express = require('express');
const { body, validationResult } = require('express-validator');
const firebaseService = require('../services/firebase');
const paypalService = require('../services/paypal');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/payments/range-admin/confirm
// @desc    Confirm PayPal payment for an existing range admin subscription
// @access  Private (Range Admins or Admins)
router.post('/range-admin/confirm', [
  authenticateToken,
  body('paypalOrderId')
    .trim()
    .notEmpty()
    .withMessage('PayPal order ID is required'),
  body('rangeId')
    .optional()
    .isString()
    .withMessage('Range ID must be a string'),
  body('userId')
    .optional()
    .isString()
    .withMessage('User ID must be a string'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paypalOrderId, rangeId: providedRangeId, userId: providedUserId } = req.body;

    const requesterRole = req.user.role;
    if (requesterRole !== 'range_admin' && requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Only range admins or admins may confirm payments' });
    }

    const targetUserId = requesterRole === 'admin' && providedUserId ? providedUserId : (req.user.userId || req.user.id);
    const userProfile = await firebaseService.getById('users', targetUserId);
    if (!userProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userProfile.role !== 'range_admin') {
      return res.status(400).json({ error: 'Selected user is not a range admin' });
    }

    const paymentDetails = await paypalService.verifyHostedButtonOrder({
      orderId: paypalOrderId,
      expectedAmount: 20,
      expectedCurrency: 'USD',
    });

    const now = new Date();
    const renewalDate = new Date(now);
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const rangeId = providedRangeId || userProfile.rangeId;
    if (!rangeId) {
      return res.status(400).json({ error: 'Range identifier missing for subscription update' });
    }

    await firebaseService.mergeDocument('users', targetUserId, {
      subscriptionStatus: 'active',
      subscriptionPlan: userProfile.subscriptionPlan || 'range_admin_monthly',
      subscriptionAmount: paymentDetails.amount,
      subscriptionCurrency: paymentDetails.currency,
      subscriptionLastPaymentDate: now,
      subscriptionRenewalDate: renewalDate,
      subscriptionProvider: 'paypal',
      subscriptionOrderId: paymentDetails.id,
      isActive: true,
    });

    await firebaseService.mergeDocument('ranges', rangeId, {
      subscriptionStatus: 'active',
      subscriptionAmount: paymentDetails.amount,
      subscriptionCurrency: paymentDetails.currency,
      subscriptionLastPaymentDate: now,
      subscriptionRenewalDate: renewalDate,
      paymentProvider: 'paypal',
      lastPaymentOrderId: paymentDetails.id,
    });

    res.json({
      message: 'Subscription payment confirmed',
      subscriptionStatus: 'active',
      renewalDate: renewalDate.toISOString(),
      amount: paymentDetails.amount,
      currency: paymentDetails.currency,
      rangeId,
    });
  } catch (error) {
    console.error('Range admin payment confirmation error:', error);
    const status = error.status || 500;
    const response = { error: error.message || 'Failed to confirm payment' };
    if (error.paypalStatus) {
      response.paypalStatus = error.paypalStatus;
    }
    if (typeof error.amount !== 'undefined') {
      response.amount = error.amount;
    }
    if (error.currency) {
      response.currency = error.currency;
    }
    res.status(status).json(response);
  }
});

module.exports = router;
