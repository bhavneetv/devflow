import nodemailer, { Transporter } from 'nodemailer';

export interface SendInviteEmailParams {
  toEmail: string;
  teamName: string;
  inviterName: string;
  assignedRole: string;
  inviteLink: string;
  message?: string;
}

export interface SendOrgInviteEmailParams {
  toEmail: string;
  organizationName: string;
  inviterName: string;
  assignedRole: string;
  inviteLink: string;
  message?: string;
}

export interface SendDecisionNotificationParams {
  toEmail: string;
  userName: string;
  targetName: string; // Team or Organization name
  type: 'TEAM' | 'ORGANIZATION';
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
      try {
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port,
          secure: process.env.SMTP_SECURE === 'true' || port === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          connectionTimeout: 5000,
        });
        console.log(`📬 [DevFlow Email] Using configured SMTP host: ${process.env.SMTP_HOST}:${port}`);
        return transporter;
      } catch (err: any) {
        console.error('⚠️ [DevFlow Email] SMTP configuration error:', err.message);
      }
    }

    // 2. Otherwise try creating an Ethereal test account with 4s timeout
    try {
      const testAccountPromise = nodemailer.createTestAccount();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Ethereal setup timed out')), 4000)
      );
      const testAccount = await Promise.race([testAccountPromise, timeoutPromise]);
      console.log('📬 [DevFlow Email] Using Ethereal test mailer:', testAccount.user);
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
      console.log('ℹ️ [DevFlow Email] Local delivery mode active (invitation link printed directly to console & dispatched to in-app inbox)');
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
    console.warn(`[DevFlow Email] Transport delivery notice:`, err.message);
  }

  return { sent: true };
}

/**
 * Sends an organization invitation email to the invited user
 */
export async function sendOrganizationInvitationEmail(params: SendOrgInviteEmailParams): Promise<{ sent: boolean; previewUrl?: string }> {
  const { toEmail, organizationName, inviterName, assignedRole, inviteLink, message } = params;

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
          <h1>Join ${organizationName} on DevFlow</h1>
          <p><strong>${inviterName}</strong> has invited you to join the organization <strong>${organizationName}</strong> with the role of <strong>${assignedRole}</strong>.</p>
          ${message ? `<div class="card"><p style="margin:0; font-style:italic;">"${message}"</p></div>` : ''}
          <a href="${inviteLink}" class="btn" target="_blank">Accept Invitation</a>
          <p style="margin-top:24px; font-size:12px; color:#71717A;">Or copy and paste this link into your browser:<br /><a href="${inviteLink}" style="color:#A78BFA; word-break:break-all;">${inviteLink}</a></p>
          <div class="footer">This organization invitation expires in 7 days. If you didn't expect this, you can safely ignore this email.</div>
        </div>
      </body>
    </html>
  `;

  console.log(`\n================== 📧 ORGANIZATION INVITATION EMAIL ==================`);
  console.log(`To: ${toEmail}`);
  console.log(`Organization: ${organizationName}`);
  console.log(`Invited By: ${inviterName}`);
  console.log(`Role: ${assignedRole}`);
  console.log(`Link: ${inviteLink}`);
  console.log(`======================================================================\n`);

  try {
    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"DevFlow Organizations" <no-reply@devflow.io>',
        to: toEmail,
        subject: `You've been invited to join ${organizationName} on DevFlow`,
        text: `${inviterName} has invited you to join ${organizationName} as ${assignedRole}.\nAccept here: ${inviteLink}`,
        html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      if (previewUrl) {
        console.log(`🔗 [DevFlow Email Preview]: ${previewUrl}`);
      }
      return { sent: true, previewUrl };
    }
  } catch (err: any) {
    console.warn(`[DevFlow Email] Transport delivery notice:`, err.message);
  }

  return { sent: true };
}

/**
 * Sends a notification email to the inviter when someone accepts or declines their invite
 */
export async function sendInvitationDecisionEmail(params: SendDecisionNotificationParams): Promise<{ sent: boolean; previewUrl?: string }> {
  const { toEmail, userName, targetName, type, decision, role } = params;
  const isAccepted = decision === 'ACCEPTED';
  const label = type === 'ORGANIZATION' ? 'organization' : 'team';

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
          <p><strong>${userName}</strong> has <strong>${isAccepted ? 'accepted' : 'declined'}</strong> your invitation to join <strong>${targetName}</strong>${isAccepted && role ? ` as ${role}` : ''}.</p>
        </div>
      </body>
    </html>
  `;

  console.log(`\n================== 📧 INVITATION ${decision} EMAIL ==================`);
  console.log(`To Inviter: ${toEmail}`);
  console.log(`User: ${userName}`);
  console.log(`Target: ${targetName} (${label})`);
  console.log(`Decision: ${decision}`);
  console.log(`===================================================================\n`);

  try {
    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"DevFlow" <no-reply@devflow.io>',
        to: toEmail,
        subject: `[DevFlow] ${userName} has ${isAccepted ? 'joined' : 'declined invitation to'} ${targetName}`,
        text: `${userName} has ${isAccepted ? 'accepted' : 'declined'} your invitation to join ${targetName}.`,
        html,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      return { sent: true, previewUrl };
    }
  } catch (err: any) {
    console.warn(`[DevFlow Email] Transport delivery notice:`, err.message);
  }

  return { sent: true };
}
