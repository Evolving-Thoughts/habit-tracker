import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  FOCUS_BLOCK_MODES,
  FOCUS_ENTRY_KINDS,
  FOCUS_LIST_MODES,
  FOCUS_LISTS,
  FOCUS_TRIGGERS,
  MAX_THRESHOLD_MINUTES,
  type FocusBlockMode,
  type FocusEntryKind,
  type FocusList,
  type FocusListMode,
  type FocusTriggerKind,
} from './focus-block-rules';

/** PUT /focus-block/settings: any of these; what is left out stays. */
export class SaveFocusSettingsDto {
  @IsOptional()
  @IsBoolean()
  readonly enabled?: boolean;

  @IsOptional()
  @IsIn(FOCUS_TRIGGERS)
  readonly trigger?: FocusTriggerKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_THRESHOLD_MINUTES)
  readonly thresholdMinutes?: number;

  @IsOptional()
  @IsIn(FOCUS_BLOCK_MODES)
  readonly mode?: FocusBlockMode;

  @IsOptional()
  @IsIn(FOCUS_LIST_MODES)
  readonly listMode?: FocusListMode;
}

/**
 * POST /focus-block/entries: an app (package name, with the label the
 * phone shows) or a website ("youtube.com", covers its subdomains).
 */
export class AddFocusEntryDto {
  @IsIn(FOCUS_LISTS)
  readonly list!: FocusList;

  @IsIn(FOCUS_ENTRY_KINDS)
  readonly kind!: FocusEntryKind;

  @IsString()
  @MaxLength(300)
  readonly value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly label?: string;
}

/**
 * Soft or Hardcore, picked on the Fokus screen; without it the default
 * from Einstellungen. Rides along on POST /timers and POST
 * /timers/:id/resume from the Fokus-Modus, and on POST /focus-block. The
 * rule whether a block starts does not depend on it.
 */
export class FocusBlockRequestDto {
  @IsOptional()
  @IsIn(FOCUS_BLOCK_MODES)
  readonly mode?: FocusBlockMode;
}

export type FocusEntryResponse = {
  id: number;
  kind: FocusEntryKind;
  value: string;
  label: string | null;
};

export type FocusBlockSessionResponse = {
  id: string;
  title: string;
  todoId: number | null;
  occurrenceId: number | null;
  mode: FocusBlockMode;
  listMode: FocusListMode;
  startedAt: string;
  /**
   * Hardcore with the threshold trigger: when the Soll is reached and the
   * block ends. Null for Soft and for Hardcore that ends with its stopwatch.
   */
  endsAt: string | null;
};

/**
 * GET /focus-block and the answer of every change: the settings, the open
 * block and the lists a device needs to enforce it. `version` changes
 * whenever anything but `serverNow` does; it is also the ETag, so a device
 * polling with If-None-Match gets a bodiless 304 while nothing changed.
 */
export type FocusBlockStateResponse = {
  version: string;
  serverNow: string;
  settings: {
    enabled: boolean;
    trigger: FocusTriggerKind;
    thresholdMinutes: number;
    mode: FocusBlockMode;
    listMode: FocusListMode;
  };
  block: FocusBlockSessionResponse | null;
  lists: { block: FocusEntryResponse[]; allow: FocusEntryResponse[] };
  /** Hosts the app itself needs; a block never stops them. */
  fixedDomains: string[];
};
