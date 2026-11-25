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
import {
  CategoryInputDto,
  CategoryResponse,
  UpdateCategoryDto,
} from './category.dto';
import { CategoryEntity } from './category.entity';
import { shownCategoryColors } from './category-colors';

/** Each category with the colour it shows, which depends on the others. */
function responses(categories: CategoryEntity[]): CategoryResponse[] {
  const shown = shownCategoryColors(categories);
  return categories.map(({ id, name, weeklyTarget, color }) => ({
    id,
    name,
    weeklyTarget,
    color: shown.get(id)!,
    colorChosen: color !== null,
  }));
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<CategoryResponse[]> {
    return responses(await this.categories.findAll(user.id));
  }

  /** One category as `findAll` shows it, after a write. */
  private async one(userId: string, id: number): Promise<CategoryResponse> {
    return responses(await this.categories.findAll(userId)).find(
      (category) => category.id === id,
    )!;
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CategoryInputDto,
  ): Promise<CategoryResponse> {
    const created = await this.categories.create(
      user.id,
      dto.name,
      dto.color ?? null,
    );
    return this.one(user.id, created.id);
  }

  @Patch(':id')
  async rename(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    const updated = await this.categories.update(user.id, id, dto);
    return this.one(user.id, updated.id);
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
