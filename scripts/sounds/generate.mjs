#!/usr/bin/env node
// Creates the focus sounds with the ElevenLabs API, from prompts.json.
//
//   node scripts/sounds/generate.mjs              all sounds that are missing
//   node scripts/sounds/generate.mjs rain cafe    just these (again)
//
// The key comes from ELEVENLABS_API_KEY or scripts/sounds/.env.local (made
// by `elevenlabs onboard`). It is never printed. Output: sounds-raw/ at the
// repository root, which git ignores: the files must not be published
// (ElevenLabs' terms). Next step: scripts/sounds/process.sh.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const outDir = join(root, 'sounds-raw');
const API = 'https://api.elevenlabs.io/v1';

const envFile = join(here, '.env.local');
if (!process.env.ELEVENLABS_API_KEY && existsSync(envFile)) {
  process.loadEnvFile(envFile);
}
const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error(
    'Kein ELEVENLABS_API_KEY gefunden (weder in der Umgebung noch in scripts/sounds/.env.local).',
  );
  process.exit(1);
}

const { musicModel, sounds } = JSON.parse(
  readFileSync(join(here, 'prompts.json'), 'utf8'),
);
// --takes=3 makes several variants (<id>.take1.mp3 …) to choose from; copy
// the one you like to <id>.mp3 before process.sh.
const args = process.argv.slice(2);
const takesArg = args.find((arg) => arg.startsWith('--takes='));
const takes = takesArg ? Number(takesArg.slice('--takes='.length)) : 0;
if (takesArg && !(Number.isInteger(takes) && takes >= 1 && takes <= 5)) {
  console.error('--takes muss 1 bis 5 sein.');
  process.exit(1);
}
const wanted = args.filter((arg) => !arg.startsWith('--'));
for (const id of wanted) {
  if (!sounds[id]) {
    console.error(`Unbekannte ID: ${id}`);
    process.exit(1);
  }
}
mkdirSync(outDir, { recursive: true });

async function request(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function generate(sound) {
  if (sound.type === 'music') {
    return request('/music?output_format=mp3_48000_192', {
      prompt: sound.prompt,
      music_length_ms: sound.lengthMs,
      model_id: musicModel,
      force_instrumental: true,
    });
  }
  return request('/sound-generation?output_format=mp3_44100_192', {
    text: sound.prompt,
    duration_seconds: sound.durationSeconds,
    loop: sound.loop,
    prompt_influence: 0.5,
  });
}

let failed = 0;
for (const [id, sound] of Object.entries(sounds)) {
  const plain = join(outDir, `${id}.mp3`);
  if (wanted.length > 0 ? !wanted.includes(id) : existsSync(plain)) continue;
  const targets = takes
    ? Array.from({ length: takes }, (_, i) => join(outDir, `${id}.take${i + 1}.mp3`))
    : [plain];
  for (const target of targets) {
    process.stdout.write(`${basename(target)} … `);
    try {
      writeFileSync(target, await generate(sound));
      console.log('fertig');
    } catch (error) {
      failed += 1;
      console.log(`Fehler: ${error.message}`);
    }
  }
}
console.log(failed ? `${failed} fehlgeschlagen.` : `Alles in ${outDir}`);
process.exit(failed ? 1 : 0);
