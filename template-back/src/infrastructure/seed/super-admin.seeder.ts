import { SuperAdminBootstrapUseCase } from '@application/user/use-case/super-admin-bootstrap.use-case'
import { Injectable, OnApplicationBootstrap } from '@nestjs/common'

/** Runs the env-driven super administrator sync at boot; a failure aborts startup on purpose. */
@Injectable()
export class SuperAdminSeeder implements OnApplicationBootstrap {
  constructor(private readonly bootstrap: SuperAdminBootstrapUseCase) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bootstrap.run()
  }
}
