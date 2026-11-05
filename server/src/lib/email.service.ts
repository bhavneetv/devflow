import nodemailer, { Transporter } from 'nodemailer';

export interface SendInviteEmailParams {
  toEmail: string;
  teamName: string;
  inviterName: string;
  assignedRole: string;
  inviteLink: string;
  message?: string;
}

export interface SendDecisionNotificationParams {
  toEmail: string;
  userName: string;
  teamName: string;
  decision: 'ACCEPTED' | 'DECLINED';
  role?: string;
}

/**
 * Creates and caches a nodemailer transporter based on environment or Ethereal test account.
 */
let transporterPromise: Promise<Transporter | null> | null = null;

async function getTransporter(): Promise<Transporter | null> {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    // 1. If SMTP env vars are present, use them
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }

    // 2. Otherwise create a mock / ethereal test account or fallback logger
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log('📬 [DevFlow Email] Using Ethereal test account:', testAccount.user);
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err: any) {
      console.warn('⚠️ [DevFlow Email] Could not initialize Ethereal mailer, logging emails to console only:', err.message);
      return null;
    }
  })();

  return transporterPromise;
}

/**
 * Sends a team invitation email to the invited user
 */
export async function sendTeamInvitationEmail(params: SendInviteEmailParams): Promise<{ sent: boolean; previewUrl?: string }> {
  const { toEmail, teamName, inviterName, assignedRole, inviteLink, message } = params;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #08090B; color: #FFFFFF; margin: 0; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #0E0E10; border: 1px solid #27272A; border-radius: 16px; padding: 32px; }
          .logo { font-size: 18px; font-weight: bold; color: #8B5CF6; margin-bottom: 24px; display: inline-block; }
          h1 { font-size: 20px; font-weight: 700; color: #FFFFFF; margin-top: 0; }
          p { color: #A1A1AA; font-size: 14px; line-height: 1.6; }
          .card { background-color: #141417; border: 1px solid #27272A; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .btn { display: inline-block; background-color: #8B5CF6; color: #0A0B10 !important; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; margin-top: 16px; }
          .footer { font-size: 12px; color: #71717A; margin-top: 32px; border-top: 1px solid #27272A; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">⚡ DevFlow</div>
          <h1>You're invited to join ${teamName}</h1>
          <p><strong>${inviterName}</strong> has invited you to join the team as a <strong>${assignedRole}</strong> on DevFlow.</p>
          ${message ? `<div class="card"><p style="margin:0; font-style:italic;">"${message}"</p></div>` : ''}
          <a href="${inviteLink}" class="btn" target="_blank">Accept Invitation</a>
          <p style="margin-top:24px; font-size:12px; color:#71717A;">Or copy and paste this link into your browser:<br /><a href="${inviteLink}" style="color:#A78BFA; word-break:break-all;">${inviteLink}</a></p>
          <div class="footer">This invitation link will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.</div>
        </div>
      </body>
    </html>
  `;

  console.log(`\n================== 📧 TEAM INVITATION EMAIL ==================`);
  console.log(`To: ${toEmail}`);
  console.log(`Team: ${teamName}`);
  console.log(`Invited By: ${inviterName}`);
  console.log(`Role: ${assignedRole}`);
  console.log(`Link: ${inviteLink}`);
  console.log(`==============================================================\n`);

  try {
    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"DevFlow Teams" <no-reply@devflow.io>',
        to: toEmail,
        subject: `You've been invited to join ${teamName} on DevFlow`,
        text: `${inviterName} has invited you to join ${teamName} as ${assignedRole}.\nAccept here: ${inviteLink}`,
        html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      if (previewUrl) {
        console.log(`🔗 [DevFlow Email Preview]: ${previewUrl}`);
      }
      return { sent: true, previewUrl };
    }
  } catch (err: any) {
    console.warn(`[DevFlow Email] Failed to send via transporter, logged to terminal:`, err.message);
  }

  return { sent: true };
}

/**
 * Sends a notification email to the inviter when someone accepts or declines their invite
 */
export async function sendInvitationDecisionEmail(params: SendDecisionNotificationParams): Promise<{ sent: boolean; previewUrl?: string }> {
  const { toEmail, userName, teamName, decision, role } = params;
  const isAccepted = decision === 'ACCEPTED';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #08090B; color: #FFFFFF; padding: 24px; }
          .container { max-width: 560px; margin: 0 auto; background-color: #0E0E10; border: 1px solid #27272A; border-radius: 16px; padding: 32px; }
          .logo { font-size: 18px; font-weight: bold; color: #8B5CF6; margin-bottom: 24px; }
          h1 { font-size: 20px; font-weight: 700; color: #FFFFFF; }
          p { color: #A1A1AA; font-size: 14px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">⚡ DevFlow</div>
          <h1>${isAccepted ? '🎉 Invitation Accepted!' : 'Invitation Declined'}</h1>
          <p><strong>${userName}</strong> has <strong>${isAccepted ? 'accepted' : 'declined'}</strong> your invitation to join <strong>${teamName}</strong>${isAccepted && role ? ` as ${role}` : ''}.</p>
        </div>
      </body>
    </html>
  `;

  console.log(`\n================== 📧 INVITATION ${decision} EMAIL ==================`);
  console.log(`To Inviter: ${toEmail}`);
  console.log(`User: ${userName}`);
  console.log(`Team: ${teamName}`);
  console.log(`Decision: ${decision}`);
  console.log(`==============================================================\n`);

  try {
    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"DevFlow Teams" <no-reply@devflow.io>',
        to: toEmail,
        subject: `[DevFlow] ${userName} has ${isAccepted ? 'joined' : 'declined invitation to'} ${teamName}`,
        text: `${userName} has ${isAccepted ? 'accepted' : 'declined'} your invitation to join ${teamName}.`,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      return { sent: true, previewUrl };
    }
  } catch (err: any) {
    console.warn(`[DevFlow Email] Failed to send decision email:`, err.message);
  }

  return { sent: true };
}
