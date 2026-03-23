import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
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

/** 이벤트 파일명: YYYY-MM.yaml */
function eventFilePath(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return join(eventsDir(), `${year}-${month}.yaml`);
}

/**
 * UsageEvent를 월별 YAML 파일에 append
 */
export async function recordUsageEvent(event: UsageEvent): Promise<void> {
  await mkdir(eventsDir(), { recursive: true });

  const filePath = eventFilePath(new Date(event.timestamp));
  const existing = await loadEventsFromFile(filePath);
  existing.push(event);

  const content = yaml.dump(existing, { lineWidth: 120 });
  await writeFile(filePath, content, 'utf-8');
}

/**
 * 단일 파일에서 이벤트 로드
 */
async function loadEventsFromFile(filePath: string): Promise<UsageEvent[]> {
  if (!existsSync(filePath)) return [];

  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = yaml.load(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => UsageEventSchema.parse(item));
  } catch {
    return [];
  }
}

/**
 * 최근 N개월 이벤트 로드 (기본값: 3개월)
 */
export async function loadEvents(months = 3): Promise<UsageEvent[]> {
  const dir = eventsDir();
  if (!existsSync(dir)) return [];

  // 현재 날짜 기준 N개월 이전까지의 파일명 목록 계산
  const targetFiles = new Set<string>();
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    targetFiles.add(`${year}-${month}.yaml`);
  }

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const matchedFiles = files.filter((f) => targetFiles.has(f));

  const allEvents: UsageEvent[] = [];
  for (const file of matchedFiles) {
    const events = await loadEventsFromFile(join(dir, file));
    allEvents.push(...events);
  }

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
