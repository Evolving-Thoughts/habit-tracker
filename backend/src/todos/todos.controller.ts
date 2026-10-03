import { CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.dto';
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
import { CreateTodoDto } from './dto/create-todo.dto';
import { TodoResponseDto } from './dto/todo-response.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoMapper } from './mappers/todo.mapper';
import { TodosService } from './todos.service';

@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<TodoResponseDto[]> {
    const todos = await this.todosService.findAll(user.id);

    return todos.map((todo) => TodoMapper.toResponseDto(todo));
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TodoResponseDto> {
    const todo = await this.todosService.findOne(user.id, id);

    return TodoMapper.toResponseDto(todo);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() createTodoDto: CreateTodoDto,
  ): Promise<TodoResponseDto> {
    const todo = await this.todosService.create(user.id, createTodoDto);

    return TodoMapper.toResponseDto(todo);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTodoDto: UpdateTodoDto,
  ): Promise<TodoResponseDto> {
    const todo = await this.todosService.update(user.id, id, updateTodoDto);

    return TodoMapper.toResponseDto(todo);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.todosService.remove(user.id, id);
  }
}
