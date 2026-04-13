const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

function validateContact(data) {
  const errors = [];
  if (!data.firstName || data.firstName.trim().length < 1) errors.push('First name is required');
  if (!data.lastName || data.lastName.trim().length < 1) errors.push('Last name is required');
  if (!data.phone || data.phone.trim().length < 7) errors.push('Valid phone number is required');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Invalid email address');
  if (data.message && data.message.length > 2000) errors.push('Message is too long');
  return errors;
}

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendNotificationEmail(submission) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('Email not configured — skipping notification email.');
    return;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a1628;color:#fff;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#8b5e44,#a3745b);padding:24px 32px;">
        <h2 style="margin:0;color:#fff;font-size:20px;">New Appointment Request</h2>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Clinique Dentaire D'Urgence et Familiale Angus-Maisonneuve</p>
      </div>
      <div style="padding:32px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:10px 0;color:rgba(255,255,255,0.5);width:130px;">Name</td><td style="padding:10px 0;color:#fff;font-weight:600;">${submission.firstName} ${submission.lastName}</td></tr>
          <tr style="border-top:1px solid rgba(255,255,255,0.08)"><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Phone</td><td style="padding:10px 0;color:#a3745b;font-weight:600;">${submission.phone}</td></tr>
          <tr style="border-top:1px solid rgba(255,255,255,0.08)"><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Email</td><td style="padding:10px 0;color:#fff;">${submission.email || '—'}</td></tr>
          <tr style="border-top:1px solid rgba(255,255,255,0.08)"><td style="padding:10px 0;color:rgba(255,255,255,0.5);">Service</td><td style="padding:10px 0;color:#a3745b;">${submission.service || '—'}</td></tr>
          <tr style="border-top:1px solid rgba(255,255,255,0.08)"><td style="padding:10px 0;color:rgba(255,255,255,0.5);vertical-align:top;">Message</td><td style="padding:10px 0;color:rgba(255,255,255,0.85);line-height:1.6;">${(submission.message || '—').replace(/\n/g,'<br>')}</td></tr>
        </table>
        <div style="margin-top:24px;padding:16px;background:rgba(255,255,255,0.05);border-radius:8px;font-size:12px;color:rgba(255,255,255,0.4);">
          Received: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })} EST
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Clinique Dentaire D'Urgence et Familiale Angus-Maisonneuve" <${process.env.FROM_EMAIL}>`,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `New Appointment Request — ${submission.firstName} ${submission.lastName}`,
    html
  });
}

async function sendConfirmationEmail(submission) {
  const transporter = getTransporter();
  if (!transporter || !submission.email) return;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#8b5e44,#a3745b);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;">Thank You, ${submission.firstName}!</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);">Your message has been received</p>
      </div>
      <div style="background:#f8f4ee;padding:32px;border-radius:0 0 12px 12px;">
        <p style="color:#2c3e50;line-height:1.7;">We've received your appointment request and will contact you shortly at <strong>${submission.phone}</strong>.</p>
        <p style="color:#2c3e50;line-height:1.7;">For dental emergencies requiring immediate attention, please call us directly:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="tel:5144371299" style="display:inline-block;background:linear-gradient(135deg,#8b5e44,#a3745b);color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:18px;">(514)-437-1299</a>
        </div>
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">Clinique Dentaire D'Urgence et Familiale Angus-Maisonneuve<br/>2933 Sherbrooke est, Montreal, Quebec H1W1B2</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Clinique Dentaire D'Urgence et Familiale Angus-Maisonneuve" <${process.env.FROM_EMAIL}>`,
    to: submission.email,
    subject: 'We received your appointment request — Clinique Dentaire D\'Urgence et Familiale Angus-Maisonneuve',
    html
  });
}

// POST /api/contact
router.post('/', async (req, res) => {
  const { firstName, lastName, phone, email, service, message } = req.body;

  const errors = validateContact({ firstName, lastName, phone, email, message });
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }

  const submission = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone.trim(),
    email: email ? email.trim() : null,
    service: service ? service.trim() : null,
    message: message ? message.trim() : null
  };

  try {
    Promise.all([
      sendNotificationEmail(submission).catch(err => console.error('Notification email error:', err)),
      sendConfirmationEmail(submission).catch(err => console.error('Confirmation email error:', err))
    ]);

    res.status(200).json({
      success: true,
      message: 'Your request has been received. We will contact you shortly.'
    });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Failed to process your request. Please call us directly at (514)-437-1299.' });
  }
});

module.exports = router;
