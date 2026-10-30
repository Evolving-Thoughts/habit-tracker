import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.dto';
import { CurrentUser } from '../auth/auth.guard';
import { CategoriesService } from './categories.service';
import { CategoryInputDto, CategoryResponse } from './category.dto';
import { CategoryEntity } from './category.entity';

const response = ({ id, name }: CategoryEntity): CategoryResponse => ({
  id,
  name,
});

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<CategoryResponse[]> {
    return (await this.categories.findAll(user.id)).map(response);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CategoryInputDto,
  ): Promise<CategoryResponse> {
    return response(await this.categories.create(user.id, dto.name));
  }

  @Patch(':id')
  async rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CategoryInputDto,
  ): Promise<CategoryResponse> {
    return response(await this.categories.rename(user.id, id, dto.name));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.categories.remove(user.id, id);
  }
}
