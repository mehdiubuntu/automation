import { ExampleItemUseCase } from '@application/example-item/use-case/example-item.use-case'
import { UserRole } from '@domain/user/enum/user.enum'
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CreateExampleItemDto } from '@presentation/api/v1/example-item/dto/create-example-item.dto'
import { GetExampleItemsPaginateDto } from '@presentation/api/v1/example-item/dto/get-example-items-paginate.dto'
import { UpdateExampleItemDto } from '@presentation/api/v1/example-item/dto/update-example-item.dto'
import { Roles } from '@presentation/common/decorators/roles.decorator'
import { IdDto } from '@presentation/common/dto/id.dto'
import { AuthGuard } from '@presentation/common/guards/auth.guard'
import { RolesGuard } from '@presentation/common/guards/roles.guard'

/** The project-scoped reference controller: all work endpoints are open to SPARTAN and SUPERADMIN. */
@ApiTags('ExampleItem')
@Controller('v1/example-item')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.SPARTAN, UserRole.SUPERADMIN)
export class ExampleItemEndPoint {
  constructor(private readonly exampleItemUseCase: ExampleItemUseCase) {}

  @ApiOperation({ summary: 'Create an example item in a project' })
  @Post('create-example-item')
  async createExampleItem(@Body() dto: CreateExampleItemDto) {
    return await this.exampleItemUseCase.createExampleItem(dto)
  }

  @ApiOperation({ summary: 'Get paginated example items of a project' })
  @Get('get-example-items')
  async getExampleItems(@Query() dto: GetExampleItemsPaginateDto) {
    return await this.exampleItemUseCase.getExampleItems(dto)
  }

  @ApiOperation({ summary: 'Get an example item by id' })
  @Get('get-example-item/:id')
  async getExampleItem(@Param() params: IdDto) {
    return await this.exampleItemUseCase.getExampleItemById(params.id)
  }

  @ApiOperation({ summary: 'Update an example item' })
  @Put('update-example-item/:id')
  async updateExampleItem(@Param() params: IdDto, @Body() dto: UpdateExampleItemDto) {
    return await this.exampleItemUseCase.updateExampleItem(params.id, dto)
  }

  @ApiOperation({ summary: 'Delete an example item', description: 'Soft delete: the row is kept with deletedAt set.' })
  @Delete('delete-example-item/:id')
  async deleteExampleItem(@Param() params: IdDto) {
    return await this.exampleItemUseCase.deleteExampleItem(params.id)
  }
}
