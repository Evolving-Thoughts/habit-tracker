import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline1793522450873 implements MigrationInterface {
  name = 'Baseline1793522450873';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Databases from before migrations already have exactly this schema.
    if (await queryRunner.hasTable('users')) return;
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "email" character varying(254) NOT NULL,
                "passwordHash" text NOT NULL,
                "verifiedAt" TIMESTAMP WITH TIME ZONE,
                "dayEndMinutes" integer NOT NULL DEFAULT '1320',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "auth_sessions" (
                "hash" character varying(64) NOT NULL,
                "userId" uuid NOT NULL,
                "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_ec9f8a53c0990df82fa67d10c29" PRIMARY KEY ("hash")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_925b24d7fc2f9324ce972aee02" ON "auth_sessions" ("userId")
        `);
    await queryRunner.query(`
            CREATE TABLE "auth_tokens" (
                "hash" character varying(64) NOT NULL,
                "userId" uuid NOT NULL,
                "kind" character varying(16) NOT NULL,
                "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_89e764c43415251cf7877c39b0c" PRIMARY KEY ("hash")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_f9cc80264f0fa2d42dd2b1c5c2" ON "auth_tokens" ("userId", "kind")
        `);
    await queryRunner.query(`
            CREATE TABLE "auth_rate_limits" (
                "key" character varying(64) NOT NULL,
                "count" integer NOT NULL,
                "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_757a482934f0e4bbacfe58d9dad" PRIMARY KEY ("key")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "calendar_connections" (
                "userId" uuid NOT NULL,
                "refreshToken" text NOT NULL,
                "calendarId" character varying(300) NOT NULL,
                "revoked" boolean NOT NULL DEFAULT false,
                "lastSyncedAt" TIMESTAMP WITH TIME ZONE,
                "lastError" character varying(200),
                "needsConsent" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_cd1622c543fece00b3e1212b581" PRIMARY KEY ("userId")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "external_calendars" (
                "userId" uuid NOT NULL,
                "calendarId" character varying(300) NOT NULL,
                "title" character varying(300) NOT NULL,
                "primary" boolean NOT NULL DEFAULT false,
                "blocksPlanning" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_19c75a8c2f03a274f0ddf45ddf7" PRIMARY KEY ("userId", "calendarId")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "calendar_oauth_states" (
                "tokenHash" character varying(64) NOT NULL,
                "userId" uuid NOT NULL,
                "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_3b87e3edebd790c2147dca31b78" PRIMARY KEY ("tokenHash")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "calendar_links" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "todoId" integer,
                "occurrenceId" integer,
                "eventId" character varying(1100) NOT NULL,
                "remoteUpdatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "syncedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "suppressed" boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_a01cdd1bb80468b37810f29f6da" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_6a55352962bb130b53b093b322" ON "calendar_links" ("userId", "eventId")
        `);
    await queryRunner.query(`
            CREATE TABLE "external_events" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "calendarId" character varying(300) NOT NULL DEFAULT '',
                "title" character varying(500) NOT NULL,
                "start" TIMESTAMP WITH TIME ZONE NOT NULL,
                "end" TIMESTAMP WITH TIME ZONE NOT NULL,
                "busy" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_61dcaaccca72630fa0299467ccf" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_28f80ed3eb038ca358c4d41463" ON "external_events" ("userId", "start")
        `);
    await queryRunner.query(`
            CREATE TABLE "categories" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "name" character varying(60) NOT NULL,
                "weeklyTarget" integer,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_13e8b2a21988bec6fdcbb1fa74" ON "categories" ("userId")
        `);
    await queryRunner.query(`
            CREATE TABLE "todos" (
                "userId" uuid NOT NULL,
                "id" SERIAL NOT NULL,
                "parentId" integer,
                "categoryId" integer,
                "periodStart" date,
                "periodEnd" date,
                "goalHabitId" integer,
                "goalTarget" integer,
                "why" character varying(1000),
                "title" character varying(200) NOT NULL,
                "completed" boolean NOT NULL DEFAULT false,
                "completedAt" TIMESTAMP WITH TIME ZONE,
                "scheduledAt" TIMESTAMP WITH TIME ZONE,
                "plannedDurationMinutes" integer,
                "isFixed" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_ca8cafd59ca6faaf67995344225" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_4583be7753873b4ead956f040e" ON "todos" ("userId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_todos_parent" ON "todos" ("parentId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_b875cb9ebf0be6ff05ff017492" ON "todos" ("categoryId")
        `);
    await queryRunner.query(`
            CREATE TABLE "habits" (
                "userId" uuid NOT NULL,
                "plannedDurationMinutes" integer,
                "timeOfDay" character varying(5),
                "id" SERIAL NOT NULL,
                "categoryId" integer,
                "why" character varying(1000),
                "title" character varying(200) NOT NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_b3ec33c2d7af69d09fcf4af7e39" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_356d1f144ceadad6942fa17af6" ON "habits" ("userId")
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_6c6aa72a781a037f1b31fe078e" ON "habits" ("categoryId")
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."habit_schedule_versions_type_enum" AS ENUM('interval', 'fixed_weekdays', 'weekly_target')
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."habit_schedule_versions_weekdays_enum" AS ENUM(
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
                'saturday',
                'sunday'
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."habit_schedule_versions_missedoccurrencepolicy_enum" AS ENUM('carry_over', 'skip')
        `);
    await queryRunner.query(`
            CREATE TABLE "habit_schedule_versions" (
                "id" SERIAL NOT NULL,
                "habitId" integer NOT NULL,
                "type" "public"."habit_schedule_versions_type_enum" NOT NULL,
                "effectiveAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "endsAt" TIMESTAMP WITH TIME ZONE,
                "cancelledAt" TIMESTAMP WITH TIME ZONE,
                "firstDueDate" date,
                "intervalDays" integer,
                "weekdays" "public"."habit_schedule_versions_weekdays_enum" array,
                "weeklyTarget" integer,
                "missedOccurrencePolicy" "public"."habit_schedule_versions_missedoccurrencepolicy_enum" NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_habit_schedule_version_range" CHECK (
                    "endsAt" IS NULL
                    OR "endsAt" >= "effectiveAt"
                ),
                CONSTRAINT "PK_c91b86bc738d561b6851a340657" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_habit_schedule_versions_open" ON "habit_schedule_versions" ("habitId")
            WHERE "endsAt" IS NULL
                AND "cancelledAt" IS NULL
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_c041024b4e3c0db319ce6d7e48" ON "habit_schedule_versions" ("habitId", "effectiveAt")
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."habit_occurrences_status_enum" AS ENUM('pending', 'completed', 'skipped', 'cancelled')
        `);
    await queryRunner.query(`
            CREATE TABLE "habit_occurrences" (
                "plannedDurationMinutes" integer,
                "id" SERIAL NOT NULL,
                "habitId" integer NOT NULL,
                "scheduleVersionId" integer NOT NULL,
                "scheduledDate" date NOT NULL,
                "movedToDate" date,
                "status" "public"."habit_occurrences_status_enum" NOT NULL DEFAULT 'pending',
                "resolvedAt" TIMESTAMP WITH TIME ZONE,
                "resolvedDate" date,
                "cancellationReason" character varying(40),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_9ef812514f4a7203824b54f34f8" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_habit_occurrences_pending" ON "habit_occurrences" ("habitId")
            WHERE "status" = 'pending'
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_8291e05508a80ca27809e9594d" ON "habit_occurrences" ("scheduleVersionId", "scheduledDate")
        `);
    await queryRunner.query(`
            CREATE TABLE "timers" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "userId" uuid NOT NULL,
                "todoId" integer,
                "occurrenceId" integer,
                "title" character varying(200) NOT NULL,
                "state" character varying(16) NOT NULL,
                "durationMinutes" integer NOT NULL,
                "remainingMilliseconds" integer NOT NULL,
                "endsAt" TIMESTAMP WITH TIME ZONE,
                "segmentStartedAt" TIMESTAMP WITH TIME ZONE,
                "finishedAt" TIMESTAMP WITH TIME ZONE,
                "pushHandledAt" TIMESTAMP WITH TIME ZONE,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_timer_target" CHECK (("todoId" IS NULL) <> ("occurrenceId" IS NULL)),
                CONSTRAINT "CHK_timer_deadline" CHECK (("state" = 'running') = ("endsAt" IS NOT NULL)),
                CONSTRAINT "CHK_timer_remaining" CHECK (
                    "remainingMilliseconds" BETWEEN 0 AND "durationMinutes" * 60000
                ),
                CONSTRAINT "CHK_timer_duration" CHECK (
                    "durationMinutes" BETWEEN 1 AND 10080
                ),
                CONSTRAINT "CHK_timer_state" CHECK (
                    "state" IN ('running', 'paused', 'finished', 'stopped')
                ),
                CONSTRAINT "PK_d13ea0d2fe75274ca5a9576aae6" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_462356a1cbaef07bab0bf3627d" ON "timers" ("userId")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_timer_active_user" ON "timers" ("userId")
            WHERE "state" IN ('running', 'paused')
        `);
    await queryRunner.query(`
            CREATE TABLE "push_subscriptions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "userId" uuid NOT NULL,
                "sessionHash" character varying(64) NOT NULL,
                "endpointHash" character varying(64) NOT NULL,
                "endpoint" text NOT NULL,
                "p256dh" text NOT NULL,
                "auth" text NOT NULL,
                CONSTRAINT "PK_757fc8f00c34f66832668dc2e53" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_0c6f734aadee4deb6b7868e08d" ON "push_subscriptions" ("endpointHash")
        `);
    await queryRunner.query(`
            CREATE TABLE "push_deliveries" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "userId" uuid NOT NULL,
                "timerId" uuid NOT NULL,
                "subscriptionId" uuid NOT NULL,
                "state" character varying(16) NOT NULL,
                "attempts" integer NOT NULL DEFAULT '0',
                "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "retryAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "CHK_push_delivery_attempts" CHECK (
                    "attempts" BETWEEN 0 AND 3
                ),
                CONSTRAINT "CHK_push_delivery_state" CHECK (
                    "state" IN ('pending', 'sent', 'cancelled', 'failed')
                ),
                CONSTRAINT "PK_5ce22daf7289b2e540fbe06f38e" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_a15fbf80cb914bc5654837f6dd" ON "push_deliveries" ("retryAt")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_2fe2385016a7b76a57ae1eebf3" ON "push_deliveries" ("timerId", "subscriptionId")
        `);
    await queryRunner.query(`
            CREATE TABLE "reflections" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "date" date NOT NULL,
                "text" character varying(10000) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_reflections_user_date" UNIQUE ("userId", "date"),
                CONSTRAINT "PK_4154d824fef84e88b13fbe26b06" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "goal_snapshots" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "rootTodoId" integer NOT NULL,
                "date" date NOT NULL,
                "doneCount" integer NOT NULL,
                "totalCount" integer NOT NULL,
                "doneMinutes" integer NOT NULL,
                "totalMinutes" integer NOT NULL,
                CONSTRAINT "UQ_goal_snapshot_root_date" UNIQUE ("rootTodoId", "date"),
                CONSTRAINT "PK_ae3cc7e20423bfdb9c41706767a" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "work_logs" (
                "id" SERIAL NOT NULL,
                "userId" uuid NOT NULL,
                "todoId" integer,
                "occurrenceId" integer,
                "title" character varying(200) NOT NULL,
                "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "endedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                "source" character varying(16) NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "CHK_work_log_range" CHECK ("endedAt" > "startedAt"),
                CONSTRAINT "CHK_work_log_target" CHECK (("todoId" IS NULL) <> ("occurrenceId" IS NULL)),
                CONSTRAINT "PK_f4f3234af57451baa20576887be" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_de0f629163a65ab217206c989c" ON "work_logs" ("userId", "startedAt")
        `);
    await queryRunner.query(`
            ALTER TABLE "auth_sessions"
            ADD CONSTRAINT "FK_925b24d7fc2f9324ce972aee025" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "auth_tokens"
            ADD CONSTRAINT "FK_c25fb956ebada4b256501585cca" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "calendar_connections"
            ADD CONSTRAINT "FK_cd1622c543fece00b3e1212b581" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "external_calendars"
            ADD CONSTRAINT "FK_48d446644ba4a2d784bfbe2b2c5" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "calendar_oauth_states"
            ADD CONSTRAINT "FK_8330855cc0322f0f57c9aa3af21" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "calendar_links"
            ADD CONSTRAINT "FK_89038df12d8ba1b3a257f63f833" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "external_events"
            ADD CONSTRAINT "FK_029b5134d8937c1091689e5f905" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "categories"
            ADD CONSTRAINT "FK_13e8b2a21988bec6fdcbb1fa741" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD CONSTRAINT "FK_4583be7753873b4ead956f040e3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD CONSTRAINT "FK_todos_parent" FOREIGN KEY ("parentId") REFERENCES "todos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "todos"
            ADD CONSTRAINT "FK_b875cb9ebf0be6ff05ff0174926" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "habits"
            ADD CONSTRAINT "FK_356d1f144ceadad6942fa17af64" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "habits"
            ADD CONSTRAINT "FK_6c6aa72a781a037f1b31fe078e1" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "habit_schedule_versions"
            ADD CONSTRAINT "FK_7c2fbd7ecadacdbbe7315f23a1b" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "habit_occurrences"
            ADD CONSTRAINT "FK_9b0c99f60cb8f854bfd4bdaa4df" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "habit_occurrences"
            ADD CONSTRAINT "FK_e7916ab3cb0a46b6292852fbbd5" FOREIGN KEY ("scheduleVersionId") REFERENCES "habit_schedule_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "timers"
            ADD CONSTRAINT "FK_462356a1cbaef07bab0bf3627d2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "timers"
            ADD CONSTRAINT "FK_db64216a21f67b8a52540a28349" FOREIGN KEY ("todoId") REFERENCES "todos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "timers"
            ADD CONSTRAINT "FK_c8f5ed4cdc9e47f904327df6b82" FOREIGN KEY ("occurrenceId") REFERENCES "habit_occurrences"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "push_subscriptions"
            ADD CONSTRAINT "FK_4cc061875e9eecc311a94b3e431" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "push_subscriptions"
            ADD CONSTRAINT "FK_461907495a9cca7c73c9b2a9035" FOREIGN KEY ("sessionHash") REFERENCES "auth_sessions"("hash") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "push_deliveries"
            ADD CONSTRAINT "FK_68cd1ddd15be2d9fbec20b11be6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "push_deliveries"
            ADD CONSTRAINT "FK_863153e18c0720c482cce010bcd" FOREIGN KEY ("timerId") REFERENCES "timers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "push_deliveries"
            ADD CONSTRAINT "FK_76d2c560be5c56eeb1e02155a59" FOREIGN KEY ("subscriptionId") REFERENCES "push_subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "reflections"
            ADD CONSTRAINT "FK_99aa8a291d45c98a274cb3ee38d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "goal_snapshots"
            ADD CONSTRAINT "FK_a2c3de4db7a1e4a1e3ed51d1783" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "work_logs"
            ADD CONSTRAINT "FK_699ea8c6b5b4acc9eebbdb9058d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "work_logs" DROP CONSTRAINT "FK_699ea8c6b5b4acc9eebbdb9058d"
        `);
    await queryRunner.query(`
            ALTER TABLE "goal_snapshots" DROP CONSTRAINT "FK_a2c3de4db7a1e4a1e3ed51d1783"
        `);
    await queryRunner.query(`
            ALTER TABLE "reflections" DROP CONSTRAINT "FK_99aa8a291d45c98a274cb3ee38d"
        `);
    await queryRunner.query(`
            ALTER TABLE "push_deliveries" DROP CONSTRAINT "FK_76d2c560be5c56eeb1e02155a59"
        `);
    await queryRunner.query(`
            ALTER TABLE "push_deliveries" DROP CONSTRAINT "FK_863153e18c0720c482cce010bcd"
        `);
    await queryRunner.query(`
            ALTER TABLE "push_deliveries" DROP CONSTRAINT "FK_68cd1ddd15be2d9fbec20b11be6"
        `);
    await queryRunner.query(`
            ALTER TABLE "push_subscriptions" DROP CONSTRAINT "FK_461907495a9cca7c73c9b2a9035"
        `);
    await queryRunner.query(`
            ALTER TABLE "push_subscriptions" DROP CONSTRAINT "FK_4cc061875e9eecc311a94b3e431"
        `);
    await queryRunner.query(`
            ALTER TABLE "timers" DROP CONSTRAINT "FK_c8f5ed4cdc9e47f904327df6b82"
        `);
    await queryRunner.query(`
            ALTER TABLE "timers" DROP CONSTRAINT "FK_db64216a21f67b8a52540a28349"
        `);
    await queryRunner.query(`
            ALTER TABLE "timers" DROP CONSTRAINT "FK_462356a1cbaef07bab0bf3627d2"
        `);
    await queryRunner.query(`
            ALTER TABLE "habit_occurrences" DROP CONSTRAINT "FK_e7916ab3cb0a46b6292852fbbd5"
        `);
    await queryRunner.query(`
            ALTER TABLE "habit_occurrences" DROP CONSTRAINT "FK_9b0c99f60cb8f854bfd4bdaa4df"
        `);
    await queryRunner.query(`
            ALTER TABLE "habit_schedule_versions" DROP CONSTRAINT "FK_7c2fbd7ecadacdbbe7315f23a1b"
        `);
    await queryRunner.query(`
            ALTER TABLE "habits" DROP CONSTRAINT "FK_6c6aa72a781a037f1b31fe078e1"
        `);
    await queryRunner.query(`
            ALTER TABLE "habits" DROP CONSTRAINT "FK_356d1f144ceadad6942fa17af64"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos" DROP CONSTRAINT "FK_b875cb9ebf0be6ff05ff0174926"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos" DROP CONSTRAINT "FK_todos_parent"
        `);
    await queryRunner.query(`
            ALTER TABLE "todos" DROP CONSTRAINT "FK_4583be7753873b4ead956f040e3"
        `);
    await queryRunner.query(`
            ALTER TABLE "categories" DROP CONSTRAINT "FK_13e8b2a21988bec6fdcbb1fa741"
        `);
    await queryRunner.query(`
            ALTER TABLE "external_events" DROP CONSTRAINT "FK_029b5134d8937c1091689e5f905"
        `);
    await queryRunner.query(`
            ALTER TABLE "calendar_links" DROP CONSTRAINT "FK_89038df12d8ba1b3a257f63f833"
        `);
    await queryRunner.query(`
            ALTER TABLE "calendar_oauth_states" DROP CONSTRAINT "FK_8330855cc0322f0f57c9aa3af21"
        `);
    await queryRunner.query(`
            ALTER TABLE "external_calendars" DROP CONSTRAINT "FK_48d446644ba4a2d784bfbe2b2c5"
        `);
    await queryRunner.query(`
            ALTER TABLE "calendar_connections" DROP CONSTRAINT "FK_cd1622c543fece00b3e1212b581"
        `);
    await queryRunner.query(`
            ALTER TABLE "auth_tokens" DROP CONSTRAINT "FK_c25fb956ebada4b256501585cca"
        `);
    await queryRunner.query(`
            ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_925b24d7fc2f9324ce972aee025"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_de0f629163a65ab217206c989c"
        `);
    await queryRunner.query(`
            DROP TABLE "work_logs"
        `);
    await queryRunner.query(`
            DROP TABLE "goal_snapshots"
        `);
    await queryRunner.query(`
            DROP TABLE "reflections"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_2fe2385016a7b76a57ae1eebf3"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_a15fbf80cb914bc5654837f6dd"
        `);
    await queryRunner.query(`
            DROP TABLE "push_deliveries"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_0c6f734aadee4deb6b7868e08d"
        `);
    await queryRunner.query(`
            DROP TABLE "push_subscriptions"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_timer_active_user"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_462356a1cbaef07bab0bf3627d"
        `);
    await queryRunner.query(`
            DROP TABLE "timers"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_8291e05508a80ca27809e9594d"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_habit_occurrences_pending"
        `);
    await queryRunner.query(`
            DROP TABLE "habit_occurrences"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."habit_occurrences_status_enum"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_c041024b4e3c0db319ce6d7e48"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."UQ_habit_schedule_versions_open"
        `);
    await queryRunner.query(`
            DROP TABLE "habit_schedule_versions"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."habit_schedule_versions_missedoccurrencepolicy_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."habit_schedule_versions_weekdays_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."habit_schedule_versions_type_enum"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_6c6aa72a781a037f1b31fe078e"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_356d1f144ceadad6942fa17af6"
        `);
    await queryRunner.query(`
            DROP TABLE "habits"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_b875cb9ebf0be6ff05ff017492"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_todos_parent"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_4583be7753873b4ead956f040e"
        `);
    await queryRunner.query(`
            DROP TABLE "todos"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_13e8b2a21988bec6fdcbb1fa74"
        `);
    await queryRunner.query(`
            DROP TABLE "categories"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_28f80ed3eb038ca358c4d41463"
        `);
    await queryRunner.query(`
            DROP TABLE "external_events"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_6a55352962bb130b53b093b322"
        `);
    await queryRunner.query(`
            DROP TABLE "calendar_links"
        `);
    await queryRunner.query(`
            DROP TABLE "calendar_oauth_states"
        `);
    await queryRunner.query(`
            DROP TABLE "external_calendars"
        `);
    await queryRunner.query(`
            DROP TABLE "calendar_connections"
        `);
    await queryRunner.query(`
            DROP TABLE "auth_rate_limits"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_f9cc80264f0fa2d42dd2b1c5c2"
        `);
    await queryRunner.query(`
            DROP TABLE "auth_tokens"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_925b24d7fc2f9324ce972aee02"
        `);
    await queryRunner.query(`
            DROP TABLE "auth_sessions"
        `);
    await queryRunner.query(`
            DROP TABLE "users"
        `);
  }
}
