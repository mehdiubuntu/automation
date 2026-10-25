import { CORE_SCHEMA } from '@infrastructure/config/database/database.config'
import { CustomNamingStrategy } from '@infrastructure/config/database/naming.strategy'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { join } from 'path'

export default () => ({
  useFactory: async (configService: ConfigService): Promise<TypeOrmModuleOptions> => {
    const databaseConfig = configService.get<ConfigService>('DatabaseConfig', {
      infer: true,
    })
    return {
      type: 'postgres',
      host: databaseConfig?.host || 'localhost',
      port: databaseConfig?.port || 5432,
      username: databaseConfig?.username,
      password: databaseConfig?.password,
      database: databaseConfig?.database,
      entities: [join(__dirname, '..', '..', '**', '*.entity.{ts,js}')],
      logging: databaseConfig?.logging || false,
      autoLoadEntities: true,
      retryAttempts: 20,
      retryDelay: 4000,
      schema: CORE_SCHEMA,
      // The schema only ever changes through migrations (see Migrator) - never let TypeORM alter it.
      synchronize: false,
      namingStrategy: new CustomNamingStrategy(),
    }
  },
})
