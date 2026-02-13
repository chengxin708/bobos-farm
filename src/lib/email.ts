// Email utilities using nodemailer
import nodemailer from 'nodemailer';
import { db } from './db';

// Environment variables
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@bobosfarm.com';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Create transporter - prefer Mailgun if configured, otherwise use Gmail SMTP
function createTransporter() {
  if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
    // Use Mailgun SMTP
    return nodemailer.createTransport({
      host: 'smtp.mailgun.org',
      port: 587,
      auth: {
        user: MAILGUN_API_KEY,
        pass: MAILGUN_API_KEY,
      },
    });
  }
  
  // Fallback to Gmail SMTP
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn('Email credentials not configured. Email sending will be simulated.');
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
}

const transporter = createTransporter();

// Email templates in English and Chinese

function getBookingConfirmationTemplate(
  userName: string,
  bookingDetails: {
    id: string;
    yurtName: string;
    date: string;
    time: string;
    status: string;
  }
): { subject: string; html: string; text: string } {
  const { id, yurtName, date, time, status } = bookingDetails;
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const timeDisplay = time === 'afternoon' ? 'Afternoon (2PM - 6PM)' : 'Evening (6PM - 10PM)';
  const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1);

  const subject = `🎉 Booking Confirmed! - Bobos Farm ${yurtName}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🏕️ Bobos Farm</h1>
      <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">Your Mongolian Yurt Experience</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <h2 style="color: #333333; margin: 0 0 20px 0;">Hi ${userName || 'Guest'}!</h2>
      
      <p style="color: #666666; line-height: 1.6;">Thank you for your booking! We're excited to welcome you to Bobos Farm.</p>
      
      <!-- Booking Details Card -->
      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 18px;">📋 Booking Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666666;">Booking ID</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600; text-align: right;">${id.slice(0, 8)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666;">Yurt</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600; text-align: right;">${yurtName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666;">Date</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600; text-align: right;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666;">Time</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600; text-align: right;">${timeDisplay}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666;">Status</td>
            <td style="padding: 8px 0; font-weight: 600; text-align: right;">
              <span style="background-color: ${status === 'confirmed' ? '#28a745' : '#ffc107'}; color: ${status === 'confirmed' ? '#ffffff' : '#000000'}; padding: 4px 12px; border-radius: 20px; font-size: 14px;">${statusDisplay}</span>
            </td>
          </tr>
        </table>
      </div>
      
      <p style="color: #666666; line-height: 1.6;">If you have any questions, feel free to contact us. We look forward to seeing you!</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
        <p style="color: #999999; font-size: 14px; margin: 0;">Best regards,<br>The Bobos Farm Team</p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
      <p style="color: #999999; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} Bobos Farm. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
🏕️ Bobos Farm - Booking Confirmed!

Hi ${userName || 'Guest'}!

Thank you for your booking! We're excited to welcome you to Bobos Farm.

📋 BOOKING DETAILS
==================
Booking ID: ${id.slice(0, 8)}
Yurt: ${yurtName}
Date: ${formattedDate}
Time: ${timeDisplay}
Status: ${statusDisplay}

If you have any questions, feel free to contact us. We look forward to seeing you!

Best regards,
The Bobos Farm Team

© ${new Date().getFullYear()} Bobos Farm. All rights reserved.
`;

  return { subject, html, text };
}

function getBookingReminderTemplate(
  userName: string,
  bookingDetails: {
    id: string;
    yurtName: string;
    date: string;
    time: string;
  }
): { subject: string; html: string; text: string } {
  const { id, yurtName, date, time } = bookingDetails;
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const timeDisplay = time === 'afternoon' ? 'Afternoon (2PM - 6PM)' : 'Evening (6PM - 10PM)';

  const subject = `⏰ Reminder: Your Bobos Farm Visit Tomorrow!`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">⏰ Reminder</h1>
      <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9;">Your Bobos Farm adventure awaits!</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <h2 style="color: #333333; margin: 0 0 20px 0;">Hi ${userName || 'Guest'}!</h2>
      
      <p style="color: #666666; line-height: 1.6;">This is a friendly reminder about your upcoming visit to Bobos Farm tomorrow!</p>
      
      <!-- Booking Details Card -->
      <div style="background-color: #fff3cd; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ffc107;">
        <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 18px;">📅 Your Tomorrow's Schedule</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666666;">🏕️ Yurt</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600; text-align: right;">${yurtName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666;">📆 Date</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600; text-align: right;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666;">🕐 Time</td>
            <td style="padding: 8px 0; color: #333333; font-weight: 600; text-align: right;">${timeDisplay}</td>
          </tr>
        </table>
      </div>
      
      <p style="color: #666666; line-height: 1.6;">We can't wait to see you! If you need to reschedule, please contact us as soon as possible.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
        <p style="color: #999999; font-size: 14px; margin: 0;">See you soon!<br>The Bobos Farm Team</p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
      <p style="color: #999999; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} Bobos Farm. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
⏰ Reminder: Your Bobos Farm Visit Tomorrow!

Hi ${userName || 'Guest'}!

This is a friendly reminder about your upcoming visit to Bobos Farm tomorrow!

📅 YOUR TOMORROW'S SCHEDULE
===========================
🏕️ Yurt: ${yurtName}
📆 Date: ${formattedDate}
🕐 Time: ${timeDisplay}

We can't wait to see you! If you need to reschedule, please contact us as soon as possible.

See you soon!
The Bobos Farm Team

© ${new Date().getFullYear()} Bobos Farm. All rights reserved.
`;

  return { subject, html, text };
}

// Send email function
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  // If no transporter configured, log and simulate success
  if (!transporter) {
    console.log('=== SIMULATING EMAIL ===');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text.slice(0, 200)}...`);
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    });
    
    console.log(`Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// ============================================
// Public API Functions
// ============================================

/**
 * Send booking confirmation email
 * @param userId - User ID
 * @param bookingId - Booking ID
 * @returns Success status
 */
export async function sendBookingConfirmation(
  userId: string,
  bookingId: string
): Promise<boolean> {
  try {
    // Get user and booking details
    const userResult = await db`
      SELECT email, name FROM users WHERE id = ${userId}
    `;
    
    if (userResult.rows.length === 0) {
      console.error(`User not found: ${userId}`);
      return false;
    }
    
    const user = userResult.rows[0];
    
    const bookingResult = await db`
      SELECT b.id, b.booking_date, b.time_slot, b.status, y.name as yurt_name
      FROM bookings b
      JOIN yurts y ON y.id = b.yurt_id
      WHERE b.id = ${bookingId} AND b.user_id = ${userId}
    `;
    
    if (bookingResult.rows.length === 0) {
      console.error(`Booking not found: ${bookingId}`);
      return false;
    }
    
    const booking = bookingResult.rows[0];
    
    const { subject, html, text } = getBookingConfirmationTemplate(
      user.name || '',
      {
        id: booking.id,
        yurtName: booking.yurt_name,
        date: booking.booking_date,
        time: booking.time_slot,
        status: booking.status,
      }
    );
    
    return sendEmail(user.email, subject, html, text);
  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
    return false;
  }
}

/**
 * Send booking reminder email for tomorrow's bookings
 * @param bookingId - Booking ID
 * @returns Success status
 */
export async function sendBookingReminder(bookingId: string): Promise<boolean> {
  try {
    // Get user and booking details
    const bookingResult = await db`
      SELECT b.id, b.booking_date, b.time_slot, b.status, y.name as yurt_name,
             u.email, u.name
      FROM bookings b
      JOIN yurts y ON y.id = b.yurt_id
      JOIN users u ON u.id = b.user_id
      WHERE b.id = ${bookingId}
    `;
    
    if (bookingResult.rows.length === 0) {
      console.error(`Booking not found: ${bookingId}`);
      return false;
    }
    
    const booking = bookingResult.rows[0];
    
    const { subject, html, text } = getBookingReminderTemplate(
      booking.name || '',
      {
        id: booking.id,
        yurtName: booking.yurt_name,
        date: booking.booking_date,
        time: booking.time_slot,
      }
    );
    
    return sendEmail(booking.email, subject, html, text);
  } catch (error) {
    console.error('Error sending booking reminder email:', error);
    return false;
  }
}

/**
 * Send verification email (existing function)
 */
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const VERIFICATION_BASE_URL = process.env.VERIFICATION_BASE_URL || APP_URL;
  const verifyLink = `${VERIFICATION_BASE_URL}/api/auth/verify?token=${token}`;

  const subject = 'Verify your email - Bobos Farm';
  const html = `
    <h2>Welcome to Bobos Farm!</h2>
    <p>Please verify your email by clicking the link below:</p>
    <a href="${verifyLink}" style="display: inline-block; padding: 12px 24px; background-color: #667eea; color: white; text-decoration: none; border-radius: 6px;">Verify Email</a>
    <p>Or copy this link: ${verifyLink}</p>
    <p>This link expires in 24 hours.</p>
  `;
  const text = `Welcome to Bobos Farm! Please verify your email: ${verifyLink}`;

  return sendEmail(email, subject, html, text);
}

export function generateVerificationToken(): string {
  return crypto.randomUUID() + '-' + Date.now();
}

export function getVerificationExpiry(): Date {
  // Token expires in 24 hours
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

/**
 * Get tomorrow's date in YYYY-MM-DD format
 */
export function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Get all bookings for tomorrow (for cron job)
 */
export async function getTomorrowBookings() {
  const tomorrow = getTomorrowDate();
  
  const result = await db`
    SELECT b.id, b.user_id, b.yurt_id, b.booking_date, b.time_slot, b.status,
           y.name as yurt_name, u.email, u.name as user_name
    FROM bookings b
    JOIN yurts y ON y.id = b.yurt_id
    JOIN users u ON u.id = b.user_id
    WHERE b.booking_date = ${tomorrow}
      AND b.status IN ('pending', 'confirmed')
    ORDER BY b.time_slot, y.name
  `;
  
  return result.rows;
}
