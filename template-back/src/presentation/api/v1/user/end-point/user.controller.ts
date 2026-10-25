import { UserAdminUseCase } from '@application/user/use-case/user-admin.use-case'
import type { AuthUser } from '@domain/auth/type/auth-user.type'
import { UserRole } from '@domain/user/enum/user.enum'
import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { GetAuthEventsPaginateDto } from '@presentation/api/v1/user/dto/get-auth-events-paginate.dto'
import { GetUsersPaginateDto } from '@presentation/api/v1/user/dto/get-users-paginate.dto'
import { UserIdDto } from '@presentation/api/v1/user/dto/user-id.dto'
import { CurrentUser } from '@presentation/common/decorators/current-user.decorator'
import { Roles } from '@presentation/common/decorators/roles.decorator'
import { IdDto } from '@presentation/common/dto/id.dto'
import { AuthGuard } from '@presentation/common/guards/auth.guard'
import { RolesGuard } from '@presentation/common/guards/roles.guard'
import { deviceContextOf } from '@presentation/common/utils/device-context.util'
import type { FastifyRequest } from 'fastify'

@ApiTags('User')
@Controller('v1/user')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class UserEndPoint {
  constructor(private readonly userAdminUseCase: UserAdminUseCase) {}

  @ApiOperation({ summary: 'List users (paginated)' })
  @Get('get-users')
  async getUsers(@Query() dto: GetUsersPaginateDto) {
    return await this.userAdminUseCase.getUsers(dto)
  }

  @ApiOperation({ summary: 'Approve a user waiting for approval (-> ACTIVE)' })
  @Post('approve-user/:id')
  @HttpCode(HttpStatus.OK)
  async approveUser(@Param() params: IdDto, @CurrentUser() actor: AuthUser, @Req() req: FastifyRequest) {
    return await this.userAdminUseCase.approveUser(actor, params.id, deviceContextOf(req))
  }

  @ApiOperation({ summary: 'Reject a user waiting for approval (-> BLOCKED)' })
  @Post('reject-user/:id')
  @HttpCode(HttpStatus.OK)
  async rejectUser(@Param() params: IdDto, @CurrentUser() actor: AuthUser, @Req() req: FastifyRequest) {
    return await this.userAdminUseCase.rejectUser(actor, params.id, deviceContextOf(req))
  }

  @ApiOperation({ summary: 'Block a user (-> BLOCKED, all sessions revoked at once)' })
  @Post('block-user/:id')
  @HttpCode(HttpStatus.OK)
  async blockUser(@Param() params: IdDto, @CurrentUser() actor: AuthUser, @Req() req: FastifyRequest) {
    return await this.userAdminUseCase.blockUser(actor, params.id, deviceContextOf(req))
  }

  @ApiOperation({ summary: 'Unblock a user (-> ACTIVE)' })
  @Post('unblock-user/:id')
  @HttpCode(HttpStatus.OK)
  async unblockUser(@Param() params: IdDto, @CurrentUser() actor: AuthUser, @Req() req: FastifyRequest) {
    return await this.userAdminUseCase.unblockUser(actor, params.id, deviceContextOf(req))
  }

  @ApiOperation({ summary: 'List the active sessions of a user' })
  @Get('get-user-sessions/:userId')
  async getUserSessions(@Param() params: UserIdDto) {
    return await this.userAdminUseCase.getUserSessions(params.userId)
  }

  @ApiOperation({ summary: 'Revoke every session of a user' })
  @Post('revoke-user-sessions/:userId')
  @HttpCode(HttpStatus.OK)
  async revokeUserSessions(@Param() params: UserIdDto, @CurrentUser() actor: AuthUser, @Req() req: FastifyRequest) {
    return await this.userAdminUseCase.revokeUserSessions(actor, params.userId, deviceContextOf(req))
  }

  @ApiOperation({ summary: 'Auth audit trail (paginated, newest first)' })
  @Get('get-auth-events')
  async getAuthEvents(@Query() dto: GetAuthEventsPaginateDto) {
    return await this.userAdminUseCase.getAuthEvents(dto)
  }
}
