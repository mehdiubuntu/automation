import { OrderDirectionEnum } from '@domain/shared/pagination/enum/order-direction.enum'
import { IPaginatedResponse } from '@domain/shared/pagination/interface/paginated.response.interface'
import { User } from '@domain/user/aggregate/user.aggregate'
import { UserRole, UserStatus } from '@domain/user/enum/user.enum'

export const USER_REPOSITORY_TOKEN = Symbol('USER_REPOSITORY_TOKEN')

export interface IUserRepository {
  insertOne(entity: User): Promise<User>
  findById(id: string): Promise<User | null>
  /** Never carries the password hash. */
  findByEmail(email: string): Promise<User | null>
  /** Includes the password hash (excluded from every other read path). */
  findByEmailWithPassword(email: string): Promise<User | null>
  findByIdWithPassword(id: string): Promise<User | null>
  findUsers(query: { limit?: number; page?: number; order?: OrderDirectionEnum; status?: UserStatus; search?: string }): Promise<IPaginatedResponse<User>>
  updateStatus(id: string, status: UserStatus): Promise<void>
  /** Email proven: stamps emailVerifiedAt and moves the user to `status`. */
  markEmailVerified(id: string, status: UserStatus, at: Date): Promise<void>
  /** Sets a new hash and clears the failed-login counter and any lock. */
  updatePassword(id: string, passwordHash: string): Promise<void>
  /** Atomic increment (parallel guesses must all count). Returns the new counter. */
  incrementFailedLogins(id: string): Promise<number>
  /** Locks the account until `until` and resets the failed counter. */
  lock(id: string, until: Date): Promise<void>
  recordSuccessfulLogin(id: string, at: Date): Promise<void>
  /** Env-driven account sync: role, status and verified flag are forced; the hash only when given. */
  syncSuperAdmin(id: string, passwordHash: string | undefined, at: Date): Promise<void>
  /** Every SUPERADMIN whose email is not `email`: demoted when the env email changes. */
  findSuperAdminsExcept(email: string): Promise<User[]>
  updateRole(id: string, role: UserRole): Promise<void>
}
