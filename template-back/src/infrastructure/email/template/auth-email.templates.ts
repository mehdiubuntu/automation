export interface EmailContent {
  subject: string
  text: string
  html: string
}

const layout = (title: string, body: string): string => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; background-color: #f9f9f9; border: 1px solid #eee; border-radius: 10px; color: #333; line-height: 1.8;">
  <h2 style="color: #1a73e8; margin-top: 0;">${title}</h2>
  ${body}
  <p style="font-size: 0.8em; color: #777; text-align: center; margin-top: 24px;">
    This is an automated message; please do not reply to this email.
  </p>
</div>`

const codeBox = (value: string): string =>
  `<p style="text-align: center; margin: 24px 0;"><span style="display: inline-block; background-color: #eef3ff; padding: 10px 24px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 6px;">${value}</span></p>`

export function emailVerificationOtpTemplate(input: { code: string; expiresInMinutes: number }): EmailContent {
  return {
    subject: 'Verify your email address',
    text: `Your verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes. If you did not create an account, ignore this email.`,
    html: layout(
      'Verify your email address',
      `<p>Enter the code below to confirm your email address. It expires in ${input.expiresInMinutes} minutes.</p>
       ${codeBox(input.code)}
       <p style="color: #555;">If you did not create an account, you can safely ignore this email.</p>`
    ),
  }
}

export function passwordResetOtpTemplate(input: { code: string; expiresInMinutes: number }): EmailContent {
  return {
    subject: 'Your password reset code',
    text: `Your password reset code is ${input.code}. It expires in ${input.expiresInMinutes} minutes. If you did not request this, ignore this email - your password is unchanged.`,
    html: layout(
      'Reset your password',
      `<p>A password reset was requested for your account. Enter the code below to choose a new password. It expires in ${input.expiresInMinutes} minutes.</p>
       ${codeBox(input.code)}
       <p style="color: #555;">If you did not request this, ignore this email - your password is unchanged.</p>`
    ),
  }
}

export function passwordChangedNoticeTemplate(): EmailContent {
  return {
    subject: 'Your password was changed',
    text: 'The password of your account was just changed and your other devices were signed out. If this was not you, reset your password immediately and contact an administrator.',
    html: layout(
      'Your password was changed',
      `<p>The password of your account was just changed and your other devices were signed out.</p>
       <p style="color: #555;">If this was not you, reset your password immediately and contact an administrator.</p>`
    ),
  }
}

export function passwordResetCompletedNoticeTemplate(): EmailContent {
  return {
    subject: 'Your password was reset',
    text: 'The password of your account was just reset and every device was signed out. If this was not you, contact an administrator immediately.',
    html: layout(
      'Your password was reset',
      `<p>The password of your account was just reset and every device was signed out.</p>
       <p style="color: #555;">If this was not you, contact an administrator immediately.</p>`
    ),
  }
}
