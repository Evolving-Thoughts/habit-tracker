import type { DataSourceOptions } from 'typeorm';
import { Baseline1793522450873 } from './migrations/1793522450873-Baseline';
import { FixedTodosNeedDate1793600000000 } from './migrations/1793600000000-FixedTodosNeedDate';
import { DayOrder1794960000000 } from './migrations/1794960000000-DayOrder';
import { Stopwatch1795000000000 } from './migrations/1795000000000-Stopwatch';
import { TodoNotes1795100000000 } from './migrations/1795100000000-TodoNotes';
import { LogbookEvents1795200000000 } from './migrations/1795200000000-LogbookEvents';
import { QuestHours1795300000000 } from './migrations/1795300000000-QuestHours';
import { WeekReviews1795400000000 } from './migrations/1795400000000-WeekReviews';
import { ProgressBelowCampaign1795500000000 } from './migrations/1795500000000-ProgressBelowCampaign';
import { CategoryColor1795600000000 } from './migrations/1795600000000-CategoryColor';
import { DailyCampaignAndRunNotes1795700000000 } from './migrations/1795700000000-DailyCampaignAndRunNotes';
import { BacklogOrder1795800000000 } from './migrations/1795800000000-BacklogOrder';
import { StopwatchBlocks1795900000000 } from './migrations/1795900000000-StopwatchBlocks';
import { WeeklyQuestTargets1796000000000 } from './migrations/1796000000000-WeeklyQuestTargets';
import { SearchUnaccent1796100000000 } from './migrations/1796100000000-SearchUnaccent';
import { AnchoredAppointments1796200000000 } from './migrations/1796200000000-AnchoredAppointments';

type PostgresOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

/** The one database configuration of the Nest app. */
export function databaseOptions(
  read: (key: string) => string | undefined,
): PostgresOptions {
  const required = (key: string): string => {
    const value = read(key);
    if (!value) throw new Error(`Missing ${key}`);
    return value;
  };
  return {
    type: 'postgres',
    uuidExtension: 'pgcrypto',
    host: required('DB_HOST'),
    port: Number(required('DB_PORT')),
    username: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
    migrations: [
      Baseline1793522450873,
      FixedTodosNeedDate1793600000000,
      DayOrder1794960000000,
      Stopwatch1795000000000,
      TodoNotes1795100000000,
      LogbookEvents1795200000000,
      QuestHours1795300000000,
      WeekReviews1795400000000,
      ProgressBelowCampaign1795500000000,
      CategoryColor1795600000000,
      DailyCampaignAndRunNotes1795700000000,
      BacklogOrder1795800000000,
      StopwatchBlocks1795900000000,
      WeeklyQuestTargets1796000000000,
      SearchUnaccent1796100000000,
      AnchoredAppointments1796200000000,
    ],
  };
}
