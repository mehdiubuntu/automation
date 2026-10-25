import { ProjectUseCase } from '@application/project/use-case/project.use-case'
import { UserRole } from '@domain/user/enum/user.enum'
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CreateProjectDto } from '@presentation/api/v1/project/dto/create-project.dto'
import { GetProjectsPaginateDto } from '@presentation/api/v1/project/dto/get-projects-paginate.dto'
import { UpdateProjectDto } from '@presentation/api/v1/project/dto/update-project.dto'
import { Roles } from '@presentation/common/decorators/roles.decorator'
import { IdDto } from '@presentation/common/dto/id.dto'
import { AuthGuard } from '@presentation/common/guards/auth.guard'
import { RolesGuard } from '@presentation/common/guards/roles.guard'

@ApiTags('Project')
@Controller('v1/project')
@UseGuards(AuthGuard, RolesGuard)
export class ProjectEndPoint {
  constructor(private readonly projectUseCase: ProjectUseCase) {}

  @ApiOperation({ summary: 'Create a project (super admin)' })
  @Roles(UserRole.SUPERADMIN)
  @Post('create-project')
  async createProject(@Body() dto: CreateProjectDto) {
    return await this.projectUseCase.createProject(dto)
  }

  @ApiOperation({ summary: 'List projects (paginated)' })
  @Roles(UserRole.SUPERADMIN, UserRole.SPARTAN)
  @Get('get-projects')
  async getProjects(@Query() dto: GetProjectsPaginateDto) {
    return await this.projectUseCase.getProjects(dto)
  }

  @ApiOperation({ summary: 'Get a project by id' })
  @Roles(UserRole.SUPERADMIN, UserRole.SPARTAN)
  @Get('get-project/:id')
  async getProject(@Param() params: IdDto) {
    return await this.projectUseCase.getProjectById(params.id)
  }

  @ApiOperation({ summary: 'Update a project (super admin)' })
  @Roles(UserRole.SUPERADMIN)
  @Put('update-project/:id')
  async updateProject(@Param() params: IdDto, @Body() dto: UpdateProjectDto) {
    return await this.projectUseCase.updateProject(params.id, dto)
  }

  @ApiOperation({ summary: 'Delete a project (super admin)', description: 'Soft delete: the row is kept with deletedAt set.' })
  @Roles(UserRole.SUPERADMIN)
  @Delete('delete-project/:id')
  async deleteProject(@Param() params: IdDto) {
    return await this.projectUseCase.deleteProject(params.id)
  }
}
