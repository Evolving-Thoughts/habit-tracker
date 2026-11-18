import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QuestTargetDto } from '../quest-hours/quest-hours.dto';
import { assertCampaignFields, NO_CAMPAIGN_FIELDS } from './campaign-style';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

const problems = async (
  type: new () => object,
  body: object,
): Promise<string[]> =>
  (await validate(plainToInstance(type, body))).map((error) => error.property);

describe('campaign fields', () => {
  it.each([CreateTodoDto, UpdateTodoDto])(
    'accept known keys and an empty value on %p',
    async (type) => {
      for (const body of [
        { color: 'moss', icon: 'book', weeklyTargetMinutes: 90 },
        { color: 'ochre', icon: 'flag', weeklyTargetMinutes: 6000 },
        { color: null, icon: null, weeklyTargetMinutes: null },
      ])
        expect(await problems(type, { title: 'Buch', ...body })).toEqual([]);
    },
  );

  it.each([CreateTodoDto, UpdateTodoDto])(
    'reject unknown keys and goals out of range on %p',
    async (type) => {
      for (const [body, property] of [
        [{ color: 'orange' }, 'color'],
        [{ color: 'Moss' }, 'color'],
        [{ icon: 'rocket' }, 'icon'],
        [{ icon: 3 }, 'icon'],
        [{ weeklyTargetMinutes: 0 }, 'weeklyTargetMinutes'],
        [{ weeklyTargetMinutes: 6001 }, 'weeklyTargetMinutes'],
        [{ weeklyTargetMinutes: 30.5 }, 'weeklyTargetMinutes'],
      ] as const)
        expect(await problems(type, { title: 'Buch', ...body })).toEqual([
          property,
        ]);
    },
  );

  it('only lets a todo without parent carry them', () => {
    expect(() =>
      assertCampaignFields({ parentId: null, ...NO_CAMPAIGN_FIELDS }),
    ).not.toThrow();
    expect(() =>
      assertCampaignFields({ parentId: 4, ...NO_CAMPAIGN_FIELDS }),
    ).not.toThrow();
    expect(() =>
      assertCampaignFields({
        parentId: null,
        weeklyTargetMinutes: 60,
        color: 'pine',
        icon: 'leaf',
      }),
    ).not.toThrow();
    for (const field of [
      { weeklyTargetMinutes: 60 },
      { color: 'pine' as const },
      { icon: 'leaf' as const },
    ])
      expect(() =>
        assertCampaignFields({ parentId: 4, ...NO_CAMPAIGN_FIELDS, ...field }),
      ).toThrow('nur für eine Kampagne');
  });
});

describe('overall weekly goal', () => {
  it('takes whole minutes up to 100 hours, or null', async () => {
    for (const weeklyTargetMinutes of [1, 1200, 6000, null])
      expect(await problems(QuestTargetDto, { weeklyTargetMinutes })).toEqual(
        [],
      );
    for (const body of [
      {},
      { weeklyTargetMinutes: 0 },
      { weeklyTargetMinutes: 6001 },
      { weeklyTargetMinutes: 90.5 },
      { weeklyTargetMinutes: '600' },
    ])
      expect(await problems(QuestTargetDto, body)).toEqual([
        'weeklyTargetMinutes',
      ]);
  });
});
