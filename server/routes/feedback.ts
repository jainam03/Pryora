/**
 * PRYORA Direct Platform Feedback API
 *
 * Flow:
 * 1. User submits Email, Subject, and Feedback message from any screen in PRYORA.
 * 2. Backend validates inputs, rate-limits per IP, and saves to SQLite.
 * 3. Backend dispatches an email directly to the platform owner's inbox (jbchheda03@gmail.com):
 *    - Primary: Resend API (via server-side RESEND_API_KEY, with automatic fallback to
 *      onboarding@resend.dev if FEEDBACK_FROM_EMAIL uses an unverified or webmail domain)
 *    - Secondary fallback: FormSubmit AJAX relay to jbchheda03@gmail.com if Resend is unavailable
 */

import crypto from 'crypto';
import { Router, Response } from 'express';
import { query, run } from '../db/database.js';
import { AuthenticatedRequest, requireAuth, validateSession } from '../auth.js';
import { createRateLimiter } from '../middleware/security.js';

export const feedbackRouter = Router();

const DEFAULT_RECIPIENT_EMAIL = 'jbchheda03@gmail.com';
const DEFAULT_RESEND_FROM = 'PRYORA Feedback <onboarding@resend.dev>';
const SIMPLE_EMAIL_REGEX = /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"']+\.[^\s@<>()[\]\\,;:"']{2,}$/;
const UNVERIFIABLE_WEBMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'protonmail.com',
]);

const feedbackRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'feedback_submit',
  message: 'Too many feedback messages sent recently. Please wait a few minutes and try again.',
});

export function getFeedbackRecipientEmail(): string {
  const configured = (process.env.FEEDBACK_RECIPIENT_EMAIL || '').trim();
  if (configured && SIMPLE_EMAIL_REGEX.test(configured)) {
    return configured;
  }
  return DEFAULT_RECIPIENT_EMAIL;
}

function stripControlChars(value: string): string {
  return value.replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolveResendFromAddress(): string {
  const raw = (process.env.FEEDBACK_FROM_EMAIL || '').trim();
  if (!raw) return DEFAULT_RESEND_FROM;

  // Extract address inside <...> or plain email
  const angleMatch = raw.match(/<([^>]+)>/);
  const emailPart = (angleMatch ? angleMatch[1] : raw).trim().toLowerCase();
  if (!SIMPLE_EMAIL_REGEX.test(emailPart)) {
    return DEFAULT_RESEND_FROM;
  }

  const domain = emailPart.split('@')[1] || '';
  if (UNVERIFIABLE_WEBMAIL_DOMAINS.has(domain)) {
    // Resend rejects free webmail domains as "from"; safely fall back to Resend's verified onboarding sender
    return DEFAULT_RESEND_FROM;
  }

  return raw;
}

interface DispatchParams {
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  message: string;
  pageContext: string | null;
  submittedAt: string;
  submissionId: string;
}

interface DispatchResult {
  delivered: boolean;
  provider: 'resend' | 'formsubmit' | 'test-skip' | null;
}

async function sendViaResend(params: DispatchParams): Promise<boolean> {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return false;

  const primaryFrom = resolveResendFromAddress();
  const emailSubject = `[PRYORA Feedback] ${params.subject}`;
  const textBody = [
    'You have received new feedback about PRYORA from the PRYORA platform.',
    '',
    `From: ${params.senderEmail}`,
    `Subject: ${params.subject}`,
    `Screen: ${params.pageContext || 'PRYORA Platform'}`,
    `Submitted At: ${params.submittedAt}`,
    `Reference ID: ${params.submissionId}`,
    '',
    'Feedback:',
    params.message,
  ].join('\n');

  const attemptSend = async (fromAddr: string): Promise<{ ok: boolean; status: number }> => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [params.recipientEmail],
        reply_to: params.senderEmail,
        subject: emailSubject,
        text: textBody,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(`Resend feedback dispatch (${fromAddr}) failed [${response.status}]: ${errText.slice(0, 200)}`);
    }
    return { ok: response.ok, status: response.status };
  };

  try {
    const first = await attemptSend(primaryFrom);
    if (first.ok) return true;

    // If a custom FEEDBACK_FROM_EMAIL domain is not yet verified in Resend, retry with Resend's default sender
    if (primaryFrom !== DEFAULT_RESEND_FROM && first.status >= 400 && first.status < 500) {
      const retry = await attemptSend(DEFAULT_RESEND_FROM);
      return retry.ok;
    }

    return false;
  } catch (err) {
    console.warn('Resend dispatch network error:', err instanceof Error ? err.message : err);
    return false;
  }
}

async function sendViaFormSubmit(params: DispatchParams): Promise<boolean> {
  try {
    const appOrigin = (process.env.APP_URL || 'https://pryora.app').trim();
    const response = await fetch(
      `https://formsubmit.co/ajax/${encodeURIComponent(params.recipientEmail)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Origin: appOrigin,
          Referer: `${appOrigin}/`,
        },
        body: JSON.stringify({
          _subject: `[PRYORA Feedback] ${params.subject}`,
          _replyto: params.senderEmail,
          _template: 'table',
          _captcha: 'false',
          Platform: 'PRYORA — Personal Finance Platform',
          Notice: 'You have received new feedback about PRYORA from the PRYORA platform.',
          From_Email: params.senderEmail,
          Subject: params.subject,
          Screen: params.pageContext || 'PRYORA Platform',
          Feedback: params.message,
        }),
      }
    );

    if (!response.ok) {
      console.warn(`FormSubmit fallback dispatch failed [${response.status}]`);
      return false;
    }

    const data = (await response.json().catch(() => ({}))) as { success?: string | boolean };
    return data.success === 'true' || data.success === true || response.ok;
  } catch (err) {
    console.warn('FormSubmit fallback dispatch error:', err instanceof Error ? err.message : err);
    return false;
  }
}

async function dispatchFeedbackEmail(params: DispatchParams): Promise<DispatchResult> {
  // Never fire real external emails during automated unit/integration tests
  if (process.env.NODE_ENV === 'test' || process.env.PRYORA_DISABLE_EXTERNAL_EMAIL === '1') {
    return { delivered: false, provider: 'test-skip' };
  }

  // 1. Primary: Resend API
  const resendOk = await sendViaResend(params);
  if (resendOk) {
    return { delivered: true, provider: 'resend' };
  }

  // 2. Fallback: FormSubmit AJAX delivery directly to recipient inbox
  const formSubmitOk = await sendViaFormSubmit(params);
  if (formSubmitOk) {
    return { delivered: true, provider: 'formsubmit' };
  }

  return { delivered: false, provider: null };
}

/**
 * POST /api/feedback
 * Validates Email, Subject, and Feedback, saves to SQLite, and emails the platform owner directly.
 */
feedbackRouter.post('/', feedbackRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, replyEmail, subject, message, pageContext } = req.body || {};

    // Optionally resolve authenticated user if Bearer session token is present
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const sessionUser = validateSession(token);
      if (sessionUser) {
        authenticatedUserId = sessionUser.id;
      }
    }

    // 1. Validate required sender Email ID
    const rawEmail = typeof email === 'string' ? email : typeof replyEmail === 'string' ? replyEmail : '';
    if (!rawEmail.trim()) {
      res.status(400).json({ error: 'Please enter your email address.' });
      return;
    }
    if (/[\r\n\x00-\x1F\x7F]/.test(rawEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    const cleanEmail = rawEmail.trim().toLowerCase();
    if (cleanEmail.length > 254 || !SIMPLE_EMAIL_REGEX.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    // 2. Validate required Subject
    if (typeof subject !== 'string' || !subject.trim()) {
      res.status(400).json({ error: 'Please enter a subject for your feedback.' });
      return;
    }
    const cleanSubject = stripControlChars(subject);
    if (cleanSubject.length < 2) {
      res.status(400).json({ error: 'Subject must be at least 2 characters long.' });
      return;
    }
    if (cleanSubject.length > 160) {
      res.status(400).json({ error: 'Subject must be 160 characters or fewer.' });
      return;
    }

    // 3. Validate required Feedback message
    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Please enter your feedback message.' });
      return;
    }
    const cleanMessage = message.replace(/\r\n/g, '\n').trim();
    if (cleanMessage.length < 5) {
      res.status(400).json({ error: 'Please enter at least 5 characters of feedback.' });
      return;
    }
    if (cleanMessage.length > 3000) {
      res.status(400).json({ error: 'Feedback message must be 3,000 characters or fewer.' });
      return;
    }

    // Sanitize optional screen context
    const cleanPageContext =
      typeof pageContext === 'string' && pageContext.trim()
        ? stripControlChars(pageContext).slice(0, 80)
        : null;

    const submissionId = `fb_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const recipientEmail = getFeedbackRecipientEmail();

    // Persist immediately in SQLite with parameterized query
    run(
      `INSERT INTO feedback_submissions
       (id, user_id, reply_email, category, subject, rating, message, page_context, email_delivered, created_at)
       VALUES (?, ?, ?, 'general', ?, NULL, ?, ?, 0, ?)`,
      [
        submissionId,
        authenticatedUserId,
        cleanEmail,
        cleanSubject,
        cleanMessage,
        cleanPageContext,
        now,
      ]
    );

    // Directly dispatch email to platform owner inbox
    const dispatch = await dispatchFeedbackEmail({
      recipientEmail,
      senderEmail: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      pageContext: cleanPageContext,
      submittedAt: now,
      submissionId,
    });

    if (dispatch.delivered) {
      run(`UPDATE feedback_submissions SET email_delivered = 1 WHERE id = ?`, [submissionId]);
    }

    if (!dispatch.delivered && dispatch.provider !== 'test-skip') {
      res.status(503).json({
        error:
          'We saved your feedback, but our email service could not deliver it right now. Please try again in a moment.',
        id: submissionId,
      });
      return;
    }

    res.status(201).json({
      ok: true,
      id: submissionId,
      emailDelivered: dispatch.delivered,
      createdAt: now,
    });
  } catch (err) {
    console.error('Feedback submission error:', err);
    res.status(500).json({ error: 'Could not send feedback right now. Please try again.' });
  }
});

/**
 * GET /api/feedback
 * Restricted to the platform owner account matching FEEDBACK_RECIPIENT_EMAIL.
 */
feedbackRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const recipientEmail = getFeedbackRecipientEmail().toLowerCase();
  if (!req.user || req.user.email.toLowerCase() !== recipientEmail) {
    res.status(403).json({ error: 'Access restricted to the platform administrator.' });
    return;
  }

  const submissions = query(
    `SELECT id, user_id, reply_email, subject, message, page_context, email_delivered, created_at
     FROM feedback_submissions
     ORDER BY created_at DESC
     LIMIT 100`
  );

  res.json({ submissions });
});
