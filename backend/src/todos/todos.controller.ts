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
  Put,
} from '@nestjs/common';
import { DeleteTodoDto } from './dto/delete-todo.dto';
import {
  DeletionPreviewResponse,
  HierarchyTodoResponse,
} from './dto/todo-hierarchy-response.dto';
import { CreateTodoDto } from './dto/create-todo.dto';
import { RescheduleTodoDto } from './dto/reschedule-todo.dto';
import { NotesResponse, SetNotesDto } from './dto/todo-notes.dto';
import { TodoResponseDto } from './dto/todo-response.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoEntity } from './entities/todo.entity';
import { BurnupPoint, GoalSnapshotsService } from './goal-snapshots.service';
import { TodoMapper } from './mappers/todo.mapper';
import { TodosService } from './todos.service';

@Controller('todos')
export class TodosController {
  constructor(
    private readonly todosService: TodosService,
    private readonly goalSnapshots: GoalSnapshotsService,
  ) {}

  /** Responses carry what each todo inherits, read once per request. */
  private async respond(
    userId: string,
    todos: TodoEntity[],
  ): Promise<TodoResponseDto[]> {
    const ancestry = await this.todosService.ancestry(userId);
    return todos.map((todo) => TodoMapper.toResponseDto(todo, ancestry));
  }

  @Get()
  async findAll(@CurrentUser() user: AuthUser): Promise<TodoResponseDto[]> {
    const todos = await this.todosService.findAll(user.id);

    return this.respond(user.id, todos);
  }

  @Get('backlog')
  async backlog(@CurrentUser() user: AuthUser): Promise<TodoResponseDto[]> {
    const todos = await this.todosService.backlog(user.id);

    return this.respond(user.id, todos);
  }

  @Get('hierarchy')
  hierarchy(@CurrentUser() user: AuthUser): Promise<HierarchyTodoResponse[]> {
    return this.todosService.hierarchy(user.id);
  }

  @Get(':id/burnup')
  burnup(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BurnupPoint[]> {
    return this.goalSnapshots.burnup(user.id, id);
  }

  @Get(':id/deletion-preview')
  deletionPreview(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DeletionPreviewResponse> {
    return this.todosService.deletionPreview(user.id, id);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TodoResponseDto> {
    const todo = await this.todosService.findOne(user.id, id);

    return (await this.respond(user.id, [todo]))[0];
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() createTodoDto: CreateTodoDto,
  ): Promise<TodoResponseDto> {
    const todo = await this.todosService.create(user.id, createTodoDto);

    return (await this.respond(user.id, [todo]))[0];
  }

  @Get(':id/notes')
  async notes(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<NotesResponse> {
    return { notes: await this.todosService.notes(user.id, id) };
  }

  @Put(':id/notes')
  async setNotes(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetNotesDto,
  ): Promise<NotesResponse> {
    return {
      notes: await this.todosService.setNotes(user.id, id, dto.notes ?? null),
    };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTodoDto: UpdateTodoDto,
  ): Promise<TodoResponseDto> {
    const todo = await this.todosService.update(user.id, id, updateTodoDto);

    return (await this.respond(user.id, [todo]))[0];
  }

  @Post(':id/reschedule')
  @HttpCode(HttpStatus.OK)
  async reschedule(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RescheduleTodoDto,
  ): Promise<TodoResponseDto> {
    const todo = await this.todosService.reschedule(user.id, id, dto);

    return (await this.respond(user.id, [todo]))[0];
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeleteTodoDto,
  ): Promise<void> {
    await this.todosService.remove(user.id, id, dto.confirmationToken);
  }
}
