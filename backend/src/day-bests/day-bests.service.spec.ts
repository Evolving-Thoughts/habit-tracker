import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Clock } from '../common/clock';
import type { UserUnitOfWork } from '../common/user-unit-of-work';
import { DayBestEntity, DayBestSettingsEntity } from './day-best.entities';
import { DayBestsService } from './day-bests.service';

const USER = '11111111-1111-4111-8111-111111111111';

describe('DayBestsService', () => {
  let entries: {
    findOneBy: jest.Mock;
    find: jest.Mock;
    upsert: jest.Mock;
    delete: jest.Mock;
    query: jest.Mock;
  };
  let settings: { findOneBy: jest.Mock; upsert: jest.Mock };
  let service: DayBestsService;
  const clock = { today: () => '2026-11-23' } as Clock;

  beforeEach(() => {
    entries = {
      findOneBy: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    };
    settings = {
      findOneBy: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    // Writes run in the unit of work, on the same repositories here.
    const manager = {
      getRepository: (target: unknown) =>
        target === DayBestEntity ? entries : settings,
    };
    const unitOfWork = {
      run: (_userId: string, work: (m: typeof manager) => Promise<unknown>) =>
        work(manager),
    };
    service = new DayBestsService(
      entries as unknown as Repository<DayBestEntity>,
      settings as unknown as Repository<DayBestSettingsEntity>,
      clock,
      unitOfWork as unknown as UserUnitOfWork,
    );
  });

  it('reads a day without a line as empty', async () => {
    await expect(service.find(USER, '2026-11-20')).resolves.toEqual({
      date: '2026-11-20',
      text: '',
    });
    await expect(service.find(USER, 'gestern')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('upserts one trimmed line per day', async () => {
    await expect(
      service.save(USER, '2026-11-23', '  Schnee \n im Garten '),
    ).resolves.toEqual({ date: '2026-11-23', text: 'Schnee im Garten' });
    expect(entries.upsert).toHaveBeenCalledWith(
      { userId: USER, date: '2026-11-23', text: 'Schnee im Garten' },
      ['userId', 'date'],
    );
    expect(entries.delete).not.toHaveBeenCalled();
  });

  it('removes the line when it is emptied', async () => {
    await expect(service.save(USER, '2026-11-01', '   ')).resolves.toEqual({
      date: '2026-11-01',
      text: '',
    });
    expect(entries.delete).toHaveBeenCalledWith({
      userId: USER,
      date: '2026-11-01',
    });
    expect(entries.upsert).not.toHaveBeenCalled();
  });

  it('refuses tomorrow, but takes any past day', async () => {
    await expect(service.save(USER, '2026-11-24', 'Zu früh')).rejects.toThrow(
      'Das Beste des Tages gibt es nur für heute und vergangene Tage.',
    );
    await expect(
      service.save(USER, '2020-01-01', 'Lange her'),
    ).resolves.toEqual({ date: '2020-01-01', text: 'Lange her' });
  });

  it('reads a range newest first and only within its limits', async () => {
    entries.find.mockResolvedValue([
      { date: '2026-11-20', text: 'B', id: 2, userId: USER },
      { date: '2026-11-02', text: 'A', id: 1, userId: USER },
    ]);
    await expect(
      service.range(USER, '2026-11-01', '2026-11-30'),
    ).resolves.toEqual({
      entries: [
        { date: '2026-11-20', text: 'B' },
        { date: '2026-11-02', text: 'A' },
      ],
    });
    expect(entries.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { date: 'DESC' } }),
    );
    await expect(
      service.range(USER, '2026-11-30', '2026-11-01'),
    ).rejects.toThrow(BadRequestException);
  });

  it('counts the months with the server day', async () => {
    entries.query.mockResolvedValue([
      { month: '2026-11', count: 3 },
      { month: '2026-09', count: '1' },
    ]);
    await expect(service.months(USER)).resolves.toEqual({
      today: '2026-11-23',
      months: [
        { month: '2026-11', count: 3 },
        { month: '2026-09', count: 1 },
      ],
    });
  });

  it('has defaults without a settings row and changes only what is given', async () => {
    await expect(service.settings(USER)).resolves.toEqual({
      cardTime: '20:00',
      reminderEnabled: true,
    });
    settings.findOneBy.mockResolvedValue({
      userId: USER,
      cardMinutes: 21 * 60 + 30,
      reminderEnabled: true,
      remindedOn: null,
    });
    await expect(
      service.saveSettings(USER, { reminderEnabled: false }),
    ).resolves.toEqual({ cardTime: '21:30', reminderEnabled: false });
    expect(settings.upsert).toHaveBeenCalledWith(
      { userId: USER, cardMinutes: 1290, reminderEnabled: false },
      ['userId'],
    );
  });
});
