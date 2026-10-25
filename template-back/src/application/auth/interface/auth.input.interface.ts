export interface IRegisterInput {
  email: string
  password: string
}

export interface ILoginInput {
  email: string
  password: string
}

export interface IVerifyEmailInput {
  email: string
  code: string
}

export interface IEmailOnlyInput {
  email: string
}

export interface IResetPasswordInput {
  email: string
  code: string
  newPassword: string
}

export interface IChangePasswordInput {
  currentPassword: string
  newPassword: string
}
