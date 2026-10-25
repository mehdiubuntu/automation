import { IPasswordHasher } from '@domain/auth/contract/password-hasher.contract'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcrypt'

@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly saltRounds: number

  /** Cost is validated (>= 12) when AuthConfig loads. */
  constructor(private readonly configService: ConfigService) {
    this.saltRounds = this.configService.get<number>('AuthConfig.passwordSaltRounds')!
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds)
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash)
  }
}
