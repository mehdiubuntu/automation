import { configs } from '@infrastructure/config'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PresentationModule } from '@presentation/presentation.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      load: configs,
    }),
    PresentationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
