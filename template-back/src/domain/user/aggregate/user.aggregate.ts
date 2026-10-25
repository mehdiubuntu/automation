import { UserRole, UserStatus } from '@domain/user/enum/user.enum'

export class User {
  constructor(
    public id?: string,
    public email?: string,
    public password?: string,
    public role?: UserRole,
    public status?: UserStatus,
    public emailVerifiedAt?: Date | null,
    public failedLoginAttempts?: number,
    public lockedUntil?: Date | null,
    public lastLoginAt?: Date | null,
    public createdAt?: Date
  ) {}

  static create(props: { id?: string; email?: string; password?: string; role?: UserRole; status?: UserStatus; emailVerifiedAt?: Date | null }): User {
    return new User(props.id, props.email, props.password, props.role, props.status, props.emailVerifiedAt)
  }

  static restore(
    id: string,
    email: string,
    password: string | undefined,
    role: UserRole,
    status: UserStatus,
    emailVerifiedAt: Date | null,
    failedLoginAttempts: number,
    lockedUntil: Date | null,
    lastLoginAt: Date | null,
    createdAt: Date
  ): User {
    return new User(id, email, password, role, status, emailVerifiedAt, failedLoginAttempts, lockedUntil, lastLoginAt, createdAt)
  }

  isSuperAdmin(): boolean {
    return this.role === UserRole.SUPERADMIN
  }

  isLocked(now: Date): boolean {
    return !!this.lockedUntil && this.lockedUntil.getTime() > now.getTime()
  }

  /** Where a user lands once the email is proven: straight to ACTIVE only when approval is switched off. */
  statusAfterEmailVerification(requireApproval: boolean): UserStatus {
    return requireApproval ? UserStatus.PENDING_APPROVAL : UserStatus.ACTIVE
  }

  /** Admin-facing projection - never carries the password hash. */
  toPrimitives() {
    return {
      id: this.id,
      email: this.email,
      role: this.role,
      status: this.status,
      emailVerifiedAt: this.emailVerifiedAt ?? null,
      createdAt: this.createdAt,
    }
  }
}
