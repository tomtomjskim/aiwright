import { readFile, writeFile, appendFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';
import { UsageEventSchema, type UsageEvent } from '../schema/usage-event.js';
import { UserProfileSchema, type UserProfile } from '../schema/user-profile.js';

/** ~/.aiwright 루트 경로 */
function aiwrightDir(): string {
  return join(os.homedir(), '.aiwright');
}

function eventsDir(): string {
  return join(aiwrightDir(), 'events');
}

function profilePath(): string {
  return join(aiwrightDir(), 'profile.yaml');
}

/** 이벤트 파일명: YYYY-MM.ndjson */
function eventFilePath(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return join(eventsDir(), `${year}-${month}.ndjson`);
}


/**
 * UsageEvent를 월별 NDJSON 파일에 append (O(1) I/O)
 */
export async function recordUsageEvent(event: UsageEvent): Promise<void> {
  await mkdir(eventsDir(), { recursive: true });

  const filePath = eventFilePath(new Date(event.timestamp));
  const line = JSON.stringify(event) + '\n';
  await appendFile(filePath, line, 'utf-8');
}

/**
 * 단일 파일에서 이벤트 로드
 * - .ndjson: 줄 단위 JSON.parse
 * - .yaml: 하위호환 yaml.load 로직
 */
async function loadEventsFromFile(filePath: string): Promise<UsageEvent[]> {
  if (!existsSync(filePath)) return [];

  try {
    const raw = await readFile(filePath, 'utf-8');

    if (filePath.endsWith('.ndjson')) {
      const events: UsageEvent[] = [];
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          events.push(UsageEventSchema.parse(parsed));
        } catch {
          // 손상된 줄은 스킵
        }
      }
      return events;
    }

    // .yaml 하위호환
    const parsed = yaml.load(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => UsageEventSchema.parse(item));
  } catch {
    return [];
  }
}

/**
 * 최근 N개월 이벤트 로드 (기본값: 3개월)
 * - .ndjson 우선 탐색, fallback으로 .yaml
 * - Promise.all로 병렬 로드
 */
export async function loadEvents(months = 3): Promise<UsageEvent[]> {
  const dir = eventsDir();
  if (!existsSync(dir)) return [];

  // 현재 날짜 기준 N개월 이전까지의 월키(YYYY-MM) 목록 계산
  const monthKeys = new Set<string>();
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    monthKeys.add(`${year}-${month}`);
  }

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  // 월키별 .ndjson 우선, 없으면 .yaml fallback 경로 결정
  const matchedPaths: string[] = [];
  for (const key of monthKeys) {
    const ndjsonFile = `${key}.ndjson`;
    const yamlFile = `${key}.yaml`;
    if (files.includes(ndjsonFile)) {
      matchedPaths.push(join(dir, ndjsonFile));
    } else if (files.includes(yamlFile)) {
      matchedPaths.push(join(dir, yamlFile));
    }
  }

  // 병렬 로드
  const results = await Promise.all(matchedPaths.map((p) => loadEventsFromFile(p)));
  const allEvents: UsageEvent[] = results.flat();

  // 시간순 정렬
  allEvents.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return allEvents;
}

/**
 * UserProfile 저장
 */
export async function saveProfile(profile: UserProfile): Promise<void> {
  await mkdir(aiwrightDir(), { recursive: true });
  const content = yaml.dump(profile, { lineWidth: 120 });
  await writeFile(profilePath(), content, 'utf-8');
}

/**
 * UserProfile 로드 (없으면 null)
 */
export async function loadProfile(): Promise<UserProfile | null> {
  const path = profilePath();
  if (!existsSync(path)) return null;

  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = yaml.load(raw);
    return UserProfileSchema.parse(parsed);
  } catch {
    return null;
  }
}
