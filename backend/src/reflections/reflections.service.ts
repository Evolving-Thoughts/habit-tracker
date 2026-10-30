import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clock } from '../common/clock';
import { assertDateOnly } from '../common/date/date-only.utils';
import { ReflectionResponse } from './reflection.dto';
import { ReflectionEntity } from './reflection.entity';

@Injectable()
export class ReflectionsService {
  constructor(
    @InjectRepository(ReflectionEntity)
    private readonly reflections: Repository<ReflectionEntity>,
    private readonly clock: Clock,
  ) {}

  /** The day's text; a day without a reflection reads as empty. */
  async find(userId: string, date: string): Promise<ReflectionResponse> {
    assertDateOnly(date);
    const found = await this.reflections.findOneBy({ userId, date });
    return { date, text: found?.text ?? '' };
  }

  /** One reflection per day: saving replaces it, empty text removes it. */
  async save(
    userId: string,
    date: string,
    rawText: string,
  ): Promise<ReflectionResponse> {
    assertDateOnly(date);
    if (date > this.clock.today())
      throw new BadRequestException(
        'Reflexionen sind nur für vergangene Tage und heute möglich.',
      );
    const text = rawText.trim();
    if (text)
      await this.reflections.upsert({ userId, date, text }, ['userId', 'date']);
    else await this.reflections.delete({ userId, date });
    return { date, text };
  }
}
