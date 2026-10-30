import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { HabitEntity } from '../habits/entities/habit.entity';
import { TodoEntity } from '../todos/entities/todo.entity';
import { CategoryEntity } from './category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categories: Repository<CategoryEntity>,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  findAll(userId: string): Promise<CategoryEntity[]> {
    return this.categories.find({
      where: { userId },
      order: { name: 'ASC', id: 'ASC' },
    });
  }

  create(userId: string, rawName: string): Promise<CategoryEntity> {
    const name = this.validName(rawName);
    return this.unitOfWork.run(userId, async (manager) => {
      await this.assertNameFree(manager, userId, name, null);
      const repository = manager.getRepository(CategoryEntity);
      return repository.save(repository.create({ userId, name }));
    });
  }

  rename(userId: string, id: number, rawName: string): Promise<CategoryEntity> {
    const name = this.validName(rawName);
    return this.unitOfWork.run(userId, async (manager) => {
      const category = await this.owned(manager, userId, id);
      await this.assertNameFree(manager, userId, name, id);
      category.name = name;
      return manager.getRepository(CategoryEntity).save(category);
    });
  }

  /** Soft delete; its entries stay and simply lose the category. */
  async remove(userId: string, id: number): Promise<void> {
    await this.unitOfWork.run(userId, async (manager) => {
      await this.owned(manager, userId, id);
      for (const entity of [TodoEntity, HabitEntity])
        await manager
          .createQueryBuilder()
          .update(entity)
          .set({ categoryId: null })
          .where('"userId" = :userId AND "categoryId" = :id', { userId, id })
          .execute();
      await manager.getRepository(CategoryEntity).softDelete({ id, userId });
    });
  }

  private validName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Invalid category name');
    return trimmed;
  }

  private async owned(
    manager: EntityManager,
    userId: string,
    id: number,
  ): Promise<CategoryEntity> {
    const category = await manager
      .getRepository(CategoryEntity)
      .findOneBy({ id, userId });
    if (!category)
      throw new NotFoundException(`Category with ID ${id} was not found`);
    return category;
  }

  private async assertNameFree(
    manager: EntityManager,
    userId: string,
    name: string,
    ownId: number | null,
  ): Promise<void> {
    const existing = await manager
      .getRepository(CategoryEntity)
      .createQueryBuilder('category')
      .where('"category"."userId" = :userId', { userId })
      .andWhere('lower("category"."name") = lower(:name)', { name })
      .getOne();
    if (existing && existing.id !== ownId)
      throw new ConflictException('Diese Kategorie gibt es bereits.');
  }
}
