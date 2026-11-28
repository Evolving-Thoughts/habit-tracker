import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clock } from '../common/clock';
import { assertDateOnly } from '../common/date/date-only.utils';
import { saveDayText } from '../common/day-text';
import { UserUnitOfWork } from '../common/user-unit-of-work';
import { ReflectionResponse } from './reflection.dto';
import { ReflectionEntity } from './reflection.entity';

@Injectable()
export class ReflectionsService {
  constructor(
    @InjectRepository(ReflectionEntity)
    private readonly reflections: Repository<ReflectionEntity>,
    private readonly clock: Clock,
    private readonly unitOfWork: UserUnitOfWork,
  ) {}

  /** The day's text; a day without a reflection reads as empty. */
  async find(userId: string, date: string): Promise<ReflectionResponse> {
    assertDateOnly(date);
    const found = await this.reflections.findOneBy({ userId, date });
    return { date, text: found?.text ?? '' };
  }

  /**
   * One reflection per day (`saveDayText`), trimmed: saving replaces it,
   * empty text removes it, a day after today takes none.
   */
  save(
    userId: string,
    date: string,
    rawText: string,
  ): Promise<ReflectionResponse> {
    return saveDayText(this.unitOfWork, ReflectionEntity, {
      userId,
      date,
      text: rawText.trim(),
      today: this.clock.today(),
      futureMessage:
        'Reflexionen sind nur für vergangene Tage und heute möglich.',
    });
  }
}
