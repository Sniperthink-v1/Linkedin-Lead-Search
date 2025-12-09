# Email Verification Setup Guide

## Overview

The application now includes email verification functionality for new user signups. Users must verify their email address to unlock all features.

## Features Implemented

### 1. **Email Verification Flow**

- New users receive a verification email upon signup
- Verification link redirects to `/verify-email` page
- Automatic verification on link click
- Welcome email sent after successful verification

### 2. **Resend Verification Email**

- Interactive banner shown to unverified users
- One-click resend verification email button
- Dismissible banner for better UX

### 3. **Email Templates**

- Professional HTML email templates
- Verification email with clickable link
- Welcome email after verification
- Password reset email (already implemented)

## Email Configuration

### Required Environment Variables

Add these to your `server/.env` file:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your_sendgrid_api_key_here
EMAIL_FROM=Lead Generation Tool <noreply@yourdomain.com>

# Frontend URL (for verification links)
FRONTEND_URL=http://localhost:5173
```

### Gmail Setup (Recommended for Development)

1. **Enable 2-Factor Authentication**

   - Go to Google Account settings
   - Security → 2-Step Verification
   - Enable it if not already enabled

2. **Generate App Password**

   - Go to Security → 2-Step Verification
   - Scroll to "App passwords"
   - Select "Mail" and "Other (Custom name)"
   - Enter "LinkedIn Lead Search"
   - Copy the generated 16-character password
   - Use this as `EMAIL_PASSWORD` in .env

3. **Update .env file**
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # App password from step 2
   EMAIL_FROM=LinkedIn Lead Search <noreply@yourdomain.com>
   ```

### Production Setup (SendGrid, AWS SES, etc.)

#### SendGrid

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=LinkedIn Lead Search <noreply@yourdomain.com>
```

#### AWS SES

```env
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_USER=your-ses-smtp-username
EMAIL_PASSWORD=your-ses-smtp-password
EMAIL_FROM=LinkedIn Lead Search <noreply@yourdomain.com>
```

## API Endpoints

### 1. POST `/api/auth/signup`

Creates new user and sends verification email

```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Account created successfully. Please check your email to verify your account.",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false
  },
  "token": "jwt-token"
}
```

### 2. GET `/api/auth/verify-email?token=xxx`

Verifies user email with token from verification link

**Response:**

```json
{
  "success": true,
  "message": "Email verified successfully! You can now use all features."
}
```

### 3. POST `/api/auth/resend-verification`

Resends verification email (requires authentication)

**Headers:**

```
Authorization: Bearer jwt-token
```

**Response:**

```json
{
  "success": true,
  "message": "Verification email sent successfully"
}
```

## Frontend Pages

### 1. Email Verification Page (`/verify-email`)

- Automatically verifies email from link
- Shows success/error status
- Auto-redirects to homepage after 3 seconds
- Manual "Go to Homepage" button

### 2. Email Verification Banner (Main App)

- Shown to unverified users on homepage
- "Resend Verification Email" button
- Dismissible banner
- Success/error feedback messages

## Database Schema

The `User` model includes:

```prisma
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  password          String?
  name              String
  emailVerified     Boolean   @default(false)
  verificationToken String?   @unique
  // ... other fields
}
```

## Testing the Feature

### Local Testing

1. **Start the servers:**

   ```bash
   # Backend
   cd server
   npm start

   # Frontend
   cd client
   npm run dev
   ```

2. **Configure email (for real emails):**

   - Update `server/.env` with your email credentials
   - Or check console logs for verification links

3. **Test signup:**

   - Go to http://localhost:5173
   - Click "Sign Up"
   - Fill in the form and submit
   - Check email for verification link (or console logs)

4. **Test verification:**

   - Click verification link in email
   - Should redirect to `/verify-email` page
   - Should show success message
   - Auto-redirects to homepage

5. **Test resend:**
   - Login with unverified account
   - See verification banner
   - Click "Resend Verification Email"
   - Check email for new verification link

### Console Logs (Development)

If email credentials are not configured, verification links are logged to console:

```
Verification email sent to user@example.com
Verification link: http://localhost:5173/verify-email?token=xxx
```

## Email Templates Customization

Email templates are in `server/utils/email.js`. Customize:

- Colors and branding
- Email content and copy
- Links and CTAs
- Company information

## Security Considerations

1. **Token Expiration**: Verification tokens should expire (currently no expiration set)
2. **Rate Limiting**: Add rate limiting to resend endpoint
3. **Email Validation**: Email format validation is implemented
4. **Password Requirements**: Strong password validation enforced
5. **HTTPS in Production**: Use HTTPS for verification links in production

## Production Deployment

1. **Update FRONTEND_URL:**

   ```env
   FRONTEND_URL=https://your-domain.com
   ```

2. **Use production email service:**

   - SendGrid, AWS SES, or Mailgun recommended
   - Gmail not recommended for production scale

3. **Add token expiration:**

   - Implement 24-hour token expiry
   - Clean up expired tokens regularly

4. **Monitor email delivery:**
   - Set up email delivery monitoring
   - Track bounce rates and spam complaints

## Troubleshooting

### Emails not sending

1. Check .env configuration
2. Verify SMTP credentials
3. Check firewall/port access (587)
4. Review server console logs

### Verification link not working

1. Check FRONTEND_URL in .env
2. Verify token in database
3. Check browser network tab
4. Review server logs for errors

### Gmail "Less secure app" error

- Use App Password instead of regular password
- Enable 2-Factor Authentication first
- Generate new App Password from Google Account settings

## Future Enhancements

- [ ] Add token expiration (24 hours)
- [ ] Email template editor in admin panel
- [ ] Email delivery tracking and analytics
- [ ] Bulk email operations
- [ ] Email preferences management
- [ ] Multi-language email templates
- [ ] Email verification reminders
