import { GENERIC_ACCEPTED_MESSAGE } from '@application/auth/error/auth.errors'
import { IRefreshResult } from '@application/auth/interface/auth-result.interface'
import { EmailVerificationUseCase } from '@application/auth/use-case/email-verification.use-case'
import { LoginUseCase } from '@application/auth/use-case/login.use-case'
import { PasswordUseCase } from '@application/auth/use-case/password.use-case'
import { RegistrationUseCase } from '@application/auth/use-case/registration.use-case'
import { SessionUseCase } from '@application/auth/use-case/session.use-case'
import { type AuthUser, toAuthUserView } from '@domain/auth/type/auth-user.type'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ChangePasswordDto } from '@presentation/api/v1/auth/dto/change-password.dto'
import { EmailDto } from '@presentation/api/v1/auth/dto/email.dto'
import { LoginDto } from '@presentation/api/v1/auth/dto/login.dto'
import { RegisterDto } from '@presentation/api/v1/auth/dto/register.dto'
import { ResetPasswordDto } from '@presentation/api/v1/auth/dto/reset-password.dto'
import { SessionIdDto } from '@presentation/api/v1/auth/dto/session-id.dto'
import { VerifyEmailDto } from '@presentation/api/v1/auth/dto/verify-email.dto'
import { CurrentUser } from '@presentation/common/decorators/current-user.decorator'
import { RateLimit } from '@presentation/common/decorators/rate-limit.decorator'
import { AUTH_COOKIES, AuthGuard } from '@presentation/common/guards/auth.guard'
import { deviceContextOf } from '@presentation/common/utils/device-context.util'
import type { FastifyReply, FastifyRequest } from 'fastify'

interface AuthCookieOptions {
  path: string
  sameSite: 'lax'
  httpOnly: boolean
  secure: boolean
  domain?: string
}

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthEndPoint {
  private readonly cookieOptions: AuthCookieOptions
  private readonly accessExpiresSeconds: number
  private readonly refreshExpiresSeconds: number

  constructor(
    private readonly registrationUseCase: RegistrationUseCase,
    private readonly emailVerificationUseCase: EmailVerificationUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly passwordUseCase: PasswordUseCase,
    private readonly sessionUseCase: SessionUseCase,
    configService: ConfigService
  ) {
    this.cookieOptions = configService.get<AuthCookieOptions>('AuthConfig.cookie')!
    this.accessExpiresSeconds = configService.get<number>('AuthConfig.accessTokenExpiresSeconds')!
    this.refreshExpiresSeconds = configService.get<number>('AuthConfig.refreshTokenExpiresSeconds')!
  }

  @ApiOperation({ summary: 'Register', description: 'Always answers 202 with the same body, whether or not the email is already registered.' })
  @RateLimit('register')
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  async register(@Body() dto: RegisterDto, @Req() req: FastifyRequest) {
    await this.registrationUseCase.register(dto, deviceContextOf(req))
    return { message: GENERIC_ACCEPTED_MESSAGE }
  }

  @ApiOperation({ summary: 'Verify the email address with the 6-digit code', description: 'Returns the new account status (PENDING_APPROVAL or ACTIVE).' })
  @RateLimit('verifyOtp')
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: FastifyRequest) {
    return await this.emailVerificationUseCase.verifyEmail(dto, deviceContextOf(req))
  }

  @ApiOperation({ summary: 'Send a new verification code', description: 'Always answers 202 with the same body (60 s cooldown and an hourly cap apply silently).' })
  @RateLimit('resend')
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@Body() dto: EmailDto) {
    await this.emailVerificationUseCase.resendVerification(dto)
    return { message: GENERIC_ACCEPTED_MESSAGE }
  }

  @ApiOperation({ summary: 'Login', description: 'Sets the HttpOnly session cookies; the body carries the user only.' })
  @RateLimit('login')
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.loginUseCase.login(dto, deviceContextOf(req))
    this.setAuthCookies(res, result)
    return { user: result.user }
  }

  @ApiOperation({ summary: 'Rotate the session cookies', description: 'Presenting an already-rotated refresh token revokes all of the user sessions.' })
  @RateLimit('refresh')
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.sessionUseCase.refresh(req.cookies?.[AUTH_COOKIES.REFRESH], deviceContextOf(req))
    this.setAuthCookies(res, result)
    return { refreshed: true }
  }

  @ApiOperation({ summary: 'Logout the current session' })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    await this.sessionUseCase.logout({ accessToken: req.cookies?.[AUTH_COOKIES.ACCESS], refreshToken: req.cookies?.[AUTH_COOKIES.REFRESH] }, deviceContextOf(req))
    this.clearAuthCookies(res)
    return { loggedOut: true }
  }

  @ApiOperation({ summary: 'Logout every session of the current user' })
  @UseGuards(AuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: AuthUser, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.sessionUseCase.logoutAll(user, deviceContextOf(req))
    this.clearAuthCookies(res)
    return result
  }

  @ApiOperation({ summary: 'The signed-in user' })
  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return toAuthUserView(user)
  }

  @ApiOperation({ summary: 'Request a password reset code', description: 'Always answers 202 with the same body.' })
  @RateLimit('resend')
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: EmailDto) {
    await this.passwordUseCase.forgotPassword(dto)
    return { message: GENERIC_ACCEPTED_MESSAGE }
  }

  @ApiOperation({ summary: 'Reset the password with the emailed code', description: 'Every session of the account is signed out.' })
  @RateLimit('verifyOtp')
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: FastifyRequest) {
    await this.passwordUseCase.resetPassword(dto, deviceContextOf(req))
    return { reset: true }
  }

  @ApiOperation({ summary: 'Change the password', description: 'Revokes every OTHER session; this one stays signed in.' })
  @RateLimit('sensitive')
  @UseGuards(AuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUser, @Req() req: FastifyRequest) {
    await this.passwordUseCase.changePassword(user, dto, deviceContextOf(req))
    return { changed: true }
  }

  @ApiOperation({ summary: 'List my active sessions' })
  @UseGuards(AuthGuard)
  @Get('sessions')
  async listSessions(@CurrentUser() user: AuthUser) {
    return await this.sessionUseCase.listOwnSessions(user)
  }

  @ApiOperation({ summary: 'Revoke all my other sessions' })
  @UseGuards(AuthGuard)
  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(@CurrentUser() user: AuthUser, @Req() req: FastifyRequest) {
    return await this.sessionUseCase.revokeOtherSessions(user, deviceContextOf(req))
  }

  @ApiOperation({ summary: 'Revoke one of my sessions', description: 'Another user session is 404, never 403.' })
  @UseGuards(AuthGuard)
  @Delete('sessions/:id')
  async revokeSession(@Param() params: SessionIdDto, @CurrentUser() user: AuthUser, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    await this.sessionUseCase.revokeOwnSession(user, params.id, deviceContextOf(req))
    if (params.id === user.sessionId) this.clearAuthCookies(res)
    return { revoked: true }
  }

  /** Tokens travel only in HttpOnly cookies. A missing refresh token means the browser already holds the current one. */
  private setAuthCookies(res: FastifyReply, tokens: Pick<IRefreshResult, 'accessToken' | 'refreshToken'>): void {
    res.setCookie(AUTH_COOKIES.ACCESS, tokens.accessToken, { ...this.cookieOptions, maxAge: this.accessExpiresSeconds })
    if (tokens.refreshToken) {
      res.setCookie(AUTH_COOKIES.REFRESH, tokens.refreshToken, { ...this.cookieOptions, maxAge: this.refreshExpiresSeconds })
    }
  }

  private clearAuthCookies(res: FastifyReply): void {
    const options = { path: this.cookieOptions.path, domain: this.cookieOptions.domain }
    res.clearCookie(AUTH_COOKIES.ACCESS, options)
    res.clearCookie(AUTH_COOKIES.REFRESH, options)
  }
}
