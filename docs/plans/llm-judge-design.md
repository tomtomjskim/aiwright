# LLM-as-Judge 실제 API 연동 아키텍처 설계

**Status**: Draft
**Author**: Architect Agent
**Date**: 2026-03-24
**Scope**: `src/intelligence/llm-judge.ts` heuristic simulation → 실제 LLM API 연동

---

## 1. 아키텍처 다이어그램

### 1.1 현재 (Before)

```
apply.ts
  └─ computeAutoScore()          [auto-score.ts]
       ├─ computeHeuristics()    [scoring/heuristic.ts]  → MetricValue[]
       └─ judgePrompt()          [llm-judge.ts]          → JudgeResult
            ├─ parseSections()           (내부)
            ├─ extractPromptMetrics()    [extract-metrics.ts]
            └─ lintComposed()            [linter.ts]
                 └─ 점수 계산 (heuristic simulation, LLM 호출 없음)
```

### 1.2 변경 후 (After)

```
apply.ts
  └─ computeAutoScore(config)         [auto-score.ts]      ← config 인자 추가
       ├─ computeHeuristics()         [scoring/heuristic.ts]
       └─ judgePrompt(fullText, opts) [llm-judge.ts]       ← opts 확장
            │
            ├─ [mode: heuristic] ──────────────────────────► heuristicJudge()
            │     (기존 로직 그대로, 변경 없음)                 └─ JudgeResult
            │
            ├─ [mode: llm] ───► resolveProvider(config) ──► LlmProvider
            │                        │                          │
            │                        ├─ AnthropicProvider ─────►│
            │                        └─ OpenAIProvider ────────►│
            │                        │                          │
            │                   checkCache(promptHash) ◄───── cache-store.ts
            │                        │ (miss)                   │
            │                   checkBudget(dailyLimit) ◄──── budget.ts
            │                        │ (ok)                     │
            │                   provider.judge(prompt) ─────► HTTP fetch()
            │                        │                          │
            │                   parseStructuredOutput() ◄──── response JSON
            │                        │                          │
            │                   writeCache(hash, result) ───► cache-store.ts
            │                        │
            │                        └─ JudgeResult
            │
            └─ [mode: hybrid] ─► llmJudge() → heuristicJudge()
                                  └─ blend(llm=0.7, heuristic=0.3)
                                       └─ JudgeResult

폴백 경로 (점선):
  llm 호출 실패 ···► 경고 메시지 출력 ···► heuristicJudge() (자동 폴백)
  API 키 미설정 ···► heuristicJudge() (무조건 폴백, 경고 없음)
```

### 1.3 모듈 의존 관계 (신규/변경 파일)

```
schema/config.ts ─────────┐
  └─ JudgeConfigSchema    │
                          ▼
intelligence/
  ├─ llm-judge.ts ◄──── 진입점 (judgePrompt 확장)
  │    ├─ heuristicJudge()       기존 로직 추출
  │    ├─ llmJudge()             신규: LLM 호출 오케스트레이션
  │    └─ hybridJudge()          신규: 블렌딩
  │
  ├─ providers/
  │    ├─ types.ts               LlmProvider 인터페이스
  │    ├─ anthropic.ts           Anthropic Claude HTTP 호출
  │    ├─ openai.ts              OpenAI HTTP 호출
  │    └─ index.ts               resolveProvider() 팩토리
  │
  ├─ judge-prompt-template.ts    LLM 평가 프롬프트 빌더
  ├─ judge-cache.ts              SHA-256 기반 결과 캐시
  └─ judge-budget.ts             일일/월별 호출 한도 추적
```

---

## 2. 인터페이스 설계

### 2.1 기존 인터페이스 (변경 최소화)

```typescript
// llm-judge.ts — JudgeResult는 변경 없음
export interface JudgeResult {
  score: number;           // 0.0 ~ 1.0
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  model: string;           // 'heuristic-sim-v1' | 'claude-haiku-4-5-20251001' | ...
}
```

**결정**: `JudgeResult`에 필드를 추가하지 않는다. 기존 `auto-score.ts`가 `score`, `model`, `weaknesses`만 사용하므로 호환성 유지. 단, 내부적으로 확장 메타데이터는 캐시와 로그에 별도 저장한다.

### 2.2 신규 인터페이스

```typescript
// providers/types.ts
export interface LlmProvider {
  readonly name: string;   // 'anthropic' | 'openai'
  
  judge(request: LlmJudgeRequest): Promise<LlmJudgeResponse>;
}

export interface LlmJudgeRequest {
  prompt: string;          // 평가 대상 프롬프트 전문
  systemPrompt: string;    // 평가 시스템 프롬프트
  model: string;           // 'claude-haiku-4-5-20251001' 등
  timeoutMs: number;       // 기본 30000
}

export interface LlmJudgeResponse {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  raw_response?: string;   // 디버깅용 원본 응답 (캐시 저장)
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

```typescript
// judge-cache.ts
export interface CacheEntry {
  hash: string;            // SHA-256(prompt + model)
  result: JudgeResult;
  created_at: string;      // ISO 8601
  ttl_hours: number;       // 기본 168 (7일)
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

```typescript
// judge-budget.ts
export interface BudgetState {
  daily_count: number;
  daily_date: string;       // YYYY-MM-DD
  monthly_count: number;
  monthly_key: string;      // YYYY-MM
  total_estimated_cost_usd: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;          // 'daily_limit_exceeded' | 'monthly_limit_exceeded'
  remaining_daily: number;
  remaining_monthly: number;
}
```

### 2.3 judgePrompt 시그니처 변경

```typescript
// llm-judge.ts — 기존 시그니처 유지 + options 확장
export interface JudgeOptions {
  model?: string;                          // 기존 필드 유지
  // 신규 필드 (모두 optional, 미지정 시 heuristic 모드)
  mode?: 'heuristic' | 'llm' | 'hybrid';
  provider?: 'anthropic' | 'openai';
  apiKey?: string;                         // 직접 전달 (환경변수보다 우선)
  apiKeyEnv?: string;                      // 환경변수명
  cache?: boolean;
  timeoutMs?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
}

export async function judgePrompt(
  fullText: string,
  options?: JudgeOptions,
): Promise<JudgeResult>
```

**호환성**: `options`가 `undefined`이거나 `mode`가 `'heuristic'`(또는 미지정)이면 기존과 동일하게 동작한다. 기존 호출 코드(`auto-score.ts`의 `judgePrompt(fullText)`)는 수정 불필요.

---

## 3. 설정 스키마 확장

### 3.1 config.ts Zod 스키마 변경안

```typescript
// schema/config.ts — 추가 부분만 표시

const JudgeConfigSchema = z.object({
  mode: z.enum(['heuristic', 'llm', 'hybrid']).default('heuristic'),
  provider: z.enum(['anthropic', 'openai']).default('anthropic'),
  model: z.string().default('claude-haiku-4-5-20251001'),
  api_key_env: z.string().default('ANTHROPIC_API_KEY'),
  cache: z.boolean().default(true),
  cache_ttl_hours: z.number().int().min(1).default(168),   // 7일
  timeout_ms: z.number().int().min(1000).max(120000).default(30000),
  daily_limit: z.number().int().min(0).default(50),
  monthly_limit: z.number().int().min(0).default(500),
}).default({});

export type JudgeConfig = z.infer<typeof JudgeConfigSchema>;

// ProjectConfigSchema에 judge 필드 추가
export const ProjectConfigSchema = z.object({
  version: z.literal('1'),
  adapter: z.string().default('claude-code'),
  vars: z.record(z.string(), z.unknown()).default({}),
  paths: z.object({
    local: z.string().default('.aiwright/fragments'),
  }).default({}),
  recipes: z.record(z.string(), RecipeSchema.omit({ name: true })).default({}),
  hooks: z.object({
    auto_score: z.boolean().default(true),
    auto_profile: z.boolean().default(true),
    git_note: z.boolean().default(true),
  }).default({}),
  judge: JudgeConfigSchema,   // ← 신규 (default로 heuristic)
});
```

### 3.2 사용자 설정 예시 (aiwright.config.yaml)

```yaml
# 기본값 — LLM 호출 없음, 기존과 동일
version: '1'
adapter: claude-code
# judge 키 없음 → mode: heuristic (자동)

---

# LLM 모드 활성화 예시
version: '1'
adapter: claude-code
judge:
  mode: llm
  provider: anthropic
  model: claude-haiku-4-5-20251001
  api_key_env: ANTHROPIC_API_KEY
  cache: true
  timeout_ms: 30000
  daily_limit: 50
  monthly_limit: 500

---

# Hybrid 모드 (heuristic + LLM 블렌딩)
version: '1'
adapter: claude-code
judge:
  mode: hybrid
  provider: openai
  model: gpt-4o-mini
  api_key_env: OPENAI_API_KEY
```

---

## 4. 파일별 변경 계획

### 4.1 신규 파일

| 파일 | 목적 | 예상 라인 수 |
|------|------|-------------|
| `src/intelligence/providers/types.ts` | LlmProvider 인터페이스, 요청/응답 타입 | ~40 |
| `src/intelligence/providers/anthropic.ts` | Anthropic Messages API 호출 (fetch) | ~120 |
| `src/intelligence/providers/openai.ts` | OpenAI Chat Completions API 호출 (fetch) | ~110 |
| `src/intelligence/providers/index.ts` | resolveProvider() 팩토리, API 키 해석 | ~40 |
| `src/intelligence/judge-prompt-template.ts` | 평가 프롬프트 빌더 (system + user) | ~80 |
| `src/intelligence/judge-cache.ts` | SHA-256 해시 기반 YAML 캐시 (파일시스템) | ~90 |
| `src/intelligence/judge-budget.ts` | 일일/월별 호출 카운트 + 비용 추정 | ~80 |
| `tests/intelligence/llm-judge.test.ts` | 단위 테스트 (모든 모드 + 폴백) | ~200 |
| `tests/intelligence/providers/anthropic.test.ts` | Anthropic provider mock 테스트 | ~120 |
| `tests/intelligence/judge-cache.test.ts` | 캐시 히트/미스/만료 테스트 | ~80 |
| `tests/intelligence/judge-budget.test.ts` | 한도 초과/리셋 테스트 | ~60 |

### 4.2 수정 파일

| 파일 | 변경 내용 | 영향도 |
|------|----------|--------|
| `src/schema/config.ts` | `JudgeConfigSchema` 추가, `ProjectConfigSchema`에 `judge` 필드 추가 | **Low** — `.default({})` 사용으로 기존 config 무파괴 |
| `src/intelligence/llm-judge.ts` | 기존 heuristic 로직을 `heuristicJudge()`로 추출, `judgePrompt()` 라우팅 로직 추가, `llmJudge()`/`hybridJudge()` 추가 | **Medium** — 함수 시그니처 호환 유지, 내부 리팩토링 |
| `src/intelligence/auto-score.ts` | `judgePrompt()` 호출 시 config에서 judge 옵션 전달 | **Low** — 함수 인자 1개 추가 |
| `src/commands/apply.ts` | `computeAutoScore()`에 config.judge 전달 | **Low** — 이미 config 객체 보유 |
| `src/intelligence/index.ts` | 신규 모듈 re-export 추가 | **Trivial** |
| `package.json` | (변경 없음 — fetch는 Node 18+ 내장) | **None** |

### 4.3 변경하지 않는 파일

| 파일 | 이유 |
|------|------|
| `src/schema/score.ts` | `MetricValue.source`에 이미 `'llm-judge'` 값 존재, 변경 불필요 |
| `src/scoring/heuristic.ts` | heuristic 메트릭 계산은 독립적, 변경 불필요 |
| `src/intelligence/linter.ts` | lint 로직은 heuristicJudge 내부에서만 사용, 변경 불필요 |
| `src/intelligence/extract-metrics.ts` | 정적 분석은 독립적, 변경 불필요 |

---

## 5. 프롬프트 템플릿

### 5.1 시스템 프롬프트 (system)

```
You are an expert prompt engineer evaluating the quality of AI prompts.

Your task is to analyze a given prompt and produce a structured quality assessment.

Evaluation criteria (weighted equally):
1. Structural Completeness — Does the prompt have clear role, instruction, constraint, and example sections?
2. Clarity — Are instructions unambiguous? Are imperative statements used effectively?
3. Consistency — Are there contradictions between sections? Is the tone uniform?
4. Hallucination Prevention — Are constraints, grounding, and output format specifications present?
5. Efficiency — Is the prompt concise without unnecessary repetition or filler?

Scoring scale: 0.0 (unusable) to 1.0 (excellent).

IMPORTANT: Respond ONLY with a valid JSON object. No markdown, no explanation outside the JSON.

JSON schema:
{
  "score": <number 0.0-1.0>,
  "feedback": "<1-2 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...]
}

Rules:
- strengths and weaknesses arrays: 1-5 items each
- feedback: concise, actionable, max 200 characters
- score must be consistent with the number and severity of weaknesses
```

### 5.2 사용자 프롬프트 (user)

```
Evaluate the following AI prompt:

---BEGIN PROMPT---
{{PROMPT_TEXT}}
---END PROMPT---

Prompt metadata:
- Total characters: {{TOTAL_CHARS}}
- Number of sections: {{SLOT_COUNT}}
- Has constraint section: {{HAS_CONSTRAINT}}
- Has example section: {{HAS_EXAMPLE}}
- Imperative ratio: {{IMPERATIVE_RATIO}}

Produce your evaluation as a JSON object.
```

### 5.3 프롬프트 설계 근거

| 설계 결정 | 근거 |
|----------|------|
| 메타데이터 포함 | LLM이 구조적 특성을 사전에 인지하여 평가 일관성 향상 |
| JSON-only 응답 강제 | 파싱 실패 최소화, Anthropic/OpenAI 모두 JSON mode 지원 |
| 5개 평가 기준 명시 | 기존 heuristic의 lint 규칙과 일치시켜 hybrid 모드 블렌딩 시 차이 최소화 |
| 강점/약점 1-5개 제한 | 토큰 절약 + 유의미한 피드백 집중 |
| 점수 일관성 규칙 | "score must be consistent with weaknesses" — LLM의 점수 인플레이션 방지 |
| `---BEGIN/END---` 경계 | 프롬프트 인젝션 방어: 평가 대상 텍스트를 명확히 분리 |

### 5.4 프롬프트 크기 추정

- 시스템 프롬프트: ~350 tokens
- 사용자 프롬프트 (메타데이터): ~80 tokens (고정)
- 평가 대상 프롬프트: 가변 (보통 200~4000자 = 50~1000 tokens)
- **총 입력**: ~480~1,430 tokens
- **출력**: ~150~300 tokens (JSON 구조)

---

## 6. 비용 추정

### 6.1 모델별 호출당 비용

| Provider | Model | Input $/1M tokens | Output $/1M tokens | 호출당 예상 비용 (입력 800tk + 출력 250tk) |
|----------|-------|--------------------|---------------------|------------------------------------------|
| Anthropic | claude-haiku-4-5-20251001 | $0.80 | $4.00 | **$0.0016** |
| Anthropic | claude-sonnet-4-5-20250514 | $3.00 | $15.00 | **$0.0062** |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 | **$0.00027** |
| OpenAI | gpt-4o | $2.50 | $10.00 | **$0.0045** |

### 6.2 월별 비용 시나리오

| 시나리오 | 일일 호출 | 월 호출 | 모델 | 월 비용 |
|---------|----------|--------|------|---------|
| 경량 사용 | 5회 | ~150회 | claude-haiku-4-5 | $0.24 |
| 보통 사용 | 20회 | ~600회 | claude-haiku-4-5 | $0.96 |
| 집중 사용 | 50회 | ~1500회 | claude-haiku-4-5 | $2.40 |
| 최저 비용 | 50회 | ~1500회 | gpt-4o-mini | $0.41 |
| 최고 품질 | 10회 | ~300회 | claude-sonnet-4-5 | $1.86 |

### 6.3 비용 표시 전략

```
✓ Applied recipe "my-recipe" → 3 fragments → .claude/CLAUDE.md
  Score: 0.82 (heuristic 0.75 × 0.4 + judge 0.87 × 0.6)
  Model: claude-haiku-4-5-20251001
  Cost: ~$0.0016 (input: 823 tokens, output: 241 tokens)
  Budget: 12/50 daily, 89/500 monthly
```

캐시 히트 시:
```
  Score: 0.82 (cached, model: claude-haiku-4-5-20251001)
  Cost: $0 (cache hit)
```

---

## 7. 구현 단계

### Phase 1: 내부 리팩토링 (기능 변경 없음)

**목표**: 기존 heuristic 로직을 분리하여 새 모드 진입점 준비

**작업**:
1. `llm-judge.ts`의 기존 `judgePrompt()` 본문을 `heuristicJudge()` 내부 함수로 추출
2. `judgePrompt()`를 mode 기반 라우터로 변경 (현재는 항상 `heuristicJudge()` 호출)
3. `JudgeOptions` 인터페이스에 `mode` 필드 추가 (optional, 기본값 `'heuristic'`)

**테스트 가능성**: 기존 동작 100% 유지 확인 — `judgePrompt(fullText)` 호출 결과가 이전과 동일

**예상 소요**: 1시간

---

### Phase 2: 설정 스키마 확장

**목표**: config.yaml에서 judge 설정을 읽을 수 있도록 스키마 추가

**작업**:
1. `schema/config.ts`에 `JudgeConfigSchema` 추가
2. `ProjectConfigSchema`에 `judge` 필드 추가 (`.default({})`)
3. `auto-score.ts`의 `computeAutoScore()`에 `judgeConfig` 파라미터 추가
4. `apply.ts`에서 `config.judge`를 `computeAutoScore()`에 전달

**테스트 가능성**: 
- `JudgeConfigSchema.parse({})` → 기본값 생성 확인
- 기존 config YAML (judge 키 없음) → 정상 파싱 확인
- 잘못된 mode 값 → Zod 에러 확인

**예상 소요**: 30분

---

### Phase 3: Provider 추상화 + Anthropic 구현

**목표**: Anthropic Claude API를 fetch로 호출하는 provider 구현

**작업**:
1. `providers/types.ts` — `LlmProvider`, `LlmJudgeRequest`, `LlmJudgeResponse` 인터페이스
2. `providers/anthropic.ts` — `AnthropicProvider` 구현
   - `POST https://api.anthropic.com/v1/messages`
   - Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
   - Body: `{ model, max_tokens: 1024, system, messages: [{ role: "user", content }] }`
   - 응답 파싱: `content[0].text` → JSON.parse
   - 타임아웃: `AbortController` + `setTimeout`
   - 에러 처리: HTTP 상태 코드별 분기 (429 rate limit, 401 auth, 500+ server)
3. `providers/index.ts` — `resolveProvider(config)` 팩토리

**테스트 가능성**:
- Mock fetch로 정상 응답 → `LlmJudgeResponse` 파싱 확인
- Mock fetch로 429 → rate limit 에러 throw 확인
- Mock fetch로 타임아웃 → AbortError 확인
- 잘못된 JSON 응답 → 파싱 에러 확인

**예상 소요**: 2시간

---

### Phase 4: 캐시 + 예산 관리

**목표**: 동일 프롬프트 재평가 방지, 호출 한도 관리

**작업**:
1. `judge-cache.ts`
   - 캐시 경로: `~/.aiwright/judge-cache/`
   - 파일명: `{hash}.yaml` (SHA-256 of `prompt + model`)
   - TTL 확인: `created_at + ttl_hours > now`
   - 읽기/쓰기: YAML 형식 (기존 storage.ts 패턴 답습)
2. `judge-budget.ts`
   - 예산 파일: `~/.aiwright/judge-budget.yaml`
   - 일자 변경 시 daily_count 리셋
   - 월 변경 시 monthly_count 리셋
   - `checkBudget(config) → BudgetCheckResult`
   - `recordCall(inputTokens, outputTokens, model) → void`

**테스트 가능성**:
- 캐시 write → read → 히트 확인
- TTL 만료 → 미스 확인
- 일일 한도 50 설정 → 50회째 allowed, 51회째 denied
- 날짜 변경 시 카운트 리셋 확인

**예상 소요**: 2시간

---

### Phase 5: LLM Judge 통합 + 폴백

**목표**: `judgePrompt()`에서 LLM 호출 전체 파이프라인 연결

**작업**:
1. `judge-prompt-template.ts` — 시스템/사용자 프롬프트 빌더
2. `llm-judge.ts` 내 `llmJudge()` 구현
   ```
   resolveApiKey → checkBudget → checkCache → (miss) → provider.judge → 
   parseResponse → writeCache → recordBudget → JudgeResult
   ```
3. `hybridJudge()` 구현
   ```
   llmResult = llmJudge() (실패 시 heuristicJudge)
   heuristicResult = heuristicJudge()
   score = llm * 0.7 + heuristic * 0.3
   strengths/weaknesses = merge + deduplicate
   ```
4. 폴백 체인:
   - API 키 미설정 → `heuristicJudge()` (무경고)
   - 예산 초과 → `heuristicJudge()` + WARN 로그
   - 네트워크/API 에러 → `heuristicJudge()` + WARN 로그
   - JSON 파싱 실패 → `heuristicJudge()` + WARN 로그

**테스트 가능성**:
- mode='llm' + mock provider → LLM 결과 반환 확인
- mode='llm' + 키 미설정 → heuristic 폴백 확인
- mode='llm' + provider 에러 → heuristic 폴백 + 경고 확인
- mode='hybrid' → 블렌딩 점수 계산 정확성 확인
- 캐시 히트 → provider 미호출 확인

**예상 소요**: 2시간

---

### Phase 6: OpenAI Provider 추가

**목표**: OpenAI API 지원

**작업**:
1. `providers/openai.ts` — `OpenAIProvider` 구현
   - `POST https://api.openai.com/v1/chat/completions`
   - Headers: `Authorization: Bearer {key}`, `content-type: application/json`
   - Body: `{ model, messages, response_format: { type: "json_object" } }`
   - 응답 파싱: `choices[0].message.content` → JSON.parse
2. `providers/index.ts`에 OpenAI 라우팅 추가

**테스트 가능성**: Phase 3과 동일 패턴의 mock 테스트

**예상 소요**: 1시간

---

### Phase 7: CLI 비용 표시 + 문서화

**목표**: 사용자에게 비용/캐시/예산 정보 투명하게 표시

**작업**:
1. `compact-summary.ts` 수정: score 출력에 비용/캐시 정보 추가
2. README.md에 judge 설정 섹션 추가
3. CHANGELOG.md 갱신

**테스트 가능성**: 
- compact-summary 출력 문자열에 "Cost:", "Budget:", "cached" 포함 확인

**예상 소요**: 1시간

---

### 전체 소요 추정

| Phase | 작업 | 소요 |
|-------|------|------|
| 1 | 내부 리팩토링 | 1h |
| 2 | 설정 스키마 | 0.5h |
| 3 | Anthropic Provider | 2h |
| 4 | 캐시 + 예산 | 2h |
| 5 | 통합 + 폴백 | 2h |
| 6 | OpenAI Provider | 1h |
| 7 | CLI 표시 + 문서 | 1h |
| **합계** | | **~9.5h** |

---

## 부록

### A. 의존성 정책 상세

**결정: 직접 fetch 호출 (외부 SDK 없음)**

근거:
1. Node 18+ 내장 `fetch`로 충분 — `package.json` engines가 `>=18.0.0` 요구
2. Anthropic/OpenAI SDK는 각각 ~200KB+ 의존성 트리 추가
3. CLI 도구 특성상 번들 크기 최소화 중요
4. API 호출은 단일 엔드포인트(messages/completions)만 사용 — SDK 기능의 2%
5. `AbortController`로 타임아웃 구현 가능 (SDK 의존 불필요)

트레이드오프:
- SDK 자동 재시도/rate limit 핸들링 포기 → 직접 구현 (단순 1회 재시도면 충분)
- SDK 타입 정의 포기 → 자체 인터페이스 정의 (이미 설계에 포함)
- SDK 버전 업그레이드 시 API 변경 자동 대응 포기 → API 버전 헤더로 고정

### B. 캐시 키 설계

```
hash = SHA-256(
  normalize(promptText) +   // 공백 정규화
  model +                   // 모델명
  "v1"                      // 캐시 버전 (프롬프트 템플릿 변경 시 bump)
)
```

- `normalize()`: 연속 공백 → 단일 공백, trim, 줄바꿈 정규화 (\r\n → \n)
- 캐시 버전 포함 이유: 평가 프롬프트 자체가 변경되면 기존 캐시 무효화
- 저장 위치: `~/.aiwright/judge-cache/{hash[0:2]}/{hash}.yaml` (2-char prefix로 디렉토리 분산)

### C. 폴백 우선순위 매트릭스

| 조건 | 동작 | 경고 표시 |
|------|------|----------|
| mode=heuristic | heuristicJudge() | 없음 |
| mode=llm, 키 미설정 | heuristicJudge() | 없음 (의도적 미설정으로 간주) |
| mode=llm, 캐시 히트 | 캐시 결과 반환 | 없음 |
| mode=llm, 예산 초과 | heuristicJudge() | WARN: "Daily/monthly judge limit reached" |
| mode=llm, 네트워크 에러 | heuristicJudge() | WARN: "LLM judge failed: {error}, falling back to heuristic" |
| mode=llm, 타임아웃 | heuristicJudge() | WARN: "LLM judge timed out after {ms}ms" |
| mode=llm, JSON 파싱 실패 | heuristicJudge() | WARN: "LLM response parse failed" |
| mode=llm, 401 Unauthorized | heuristicJudge() | ERROR: "Invalid API key for {provider}" |
| mode=hybrid, LLM 부분 실패 | heuristic 단독 (blend 없음) | WARN (위와 동일) |

### D. Hybrid 모드 블렌딩 상세

```
finalScore = llmScore * 0.7 + heuristicScore * 0.3
```

근거:
- LLM은 의미론적 평가 우수 (명확성, 일관성 판단)
- Heuristic은 구조적 평가 우수 (슬롯 존재, 길이, 변수 커버리지)
- 0.7:0.3은 LLM 신뢰도를 반영하되, heuristic의 확정적 판단으로 극단값 보정

Hybrid 모드의 strengths/weaknesses 병합:
1. LLM의 것을 우선 배치
2. Heuristic의 것 중 LLM과 중복되지 않는 것만 추가
3. 중복 판단: Jaccard similarity > 0.5인 문자열 쌍은 중복으로 간주
4. 최대 5개 strengths, 5개 weaknesses로 cap

### E. 보안 고려사항

1. **API 키 노출 방지**: 키는 환경변수로만 참조, config.yaml에 직접 기입 불가. `api_key_env` 필드는 환경변수 *이름*만 저장.
2. **프롬프트 데이터 전송**: 평가 대상 프롬프트가 외부 API로 전송됨 → config에 `judge.mode: 'llm'` 명시적 opt-in 필수.
3. **캐시 파일 보안**: `~/.aiwright/judge-cache/`는 사용자 홈 디렉토리 하위 → 파일 퍼미션은 OS 기본값 의존.
4. **프롬프트 인젝션**: 평가 대상 프롬프트 내에 `---END PROMPT---` 등의 탈출 시퀀스가 있을 수 있음 → 경계 마커를 고유 UUID로 대체하는 것을 Phase 5에서 고려.

### F. auto-score.ts 블렌딩과의 관계

현재 `auto-score.ts`는:
```
final = heuristic * 0.4 + judge * 0.6
```

이 관계는 변경하지 않는다. `judge`가 반환하는 값이 heuristic-sim 점수에서 LLM 점수로 바뀔 뿐이다.

Hybrid 모드에서는 `judge` 자체가 이미 LLM+heuristic 블렌딩(0.7:0.3)이므로:
```
auto-score.final = heuristic_metric * 0.4 + (llm*0.7 + heuristic_judge*0.3) * 0.6
```

이 이중 블렌딩은 의도적이다. `auto-score`의 heuristic은 fragment-level 구조 메트릭(completeness, length, variable coverage)이고, judge의 heuristic은 prompt-level lint/smell 분석이므로 관점이 다르다.
