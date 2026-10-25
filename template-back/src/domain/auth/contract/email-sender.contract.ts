export const EMAIL_SENDER_TOKEN = Symbol('EMAIL_SENDER_TOKEN')

export interface IEmailSender {
  sendEmailVerificationOtp(input: { email: string; code: string; expiresInMinutes: number }): Promise<void>
  sendPasswordResetOtp(input: { email: string; code: string; expiresInMinutes: number }): Promise<void>
  sendPasswordChangedNotice(input: { email: string }): Promise<void>
  sendPasswordResetCompletedNotice(input: { email: string }): Promise<void>
}
