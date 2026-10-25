import { INestApplication } from '@nestjs/common'
import { registerAs } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

function setupSwagger(app: INestApplication, url: string) {
  const config = new DocumentBuilder().setTitle('Template API').setDescription('Template API').addServer(url, 'Local server').setVersion('1.0').build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // keep the auth header across reloads
    },
    customSiteTitle: 'Template API | Docs', // browser tab title
  })
}

export const swaggerConfig = registerAs('SwaggerConfig', () => {
  return {
    setupSwagger,
    urls: process.env.SWAGGER_URLS,
    enabled: process.env.SWAGGER_ENABLED === 'true',
  }
})
