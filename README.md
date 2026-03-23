<p align="center">
  <h1 align="center">aiwright</h1>
  <p align="center">
    AI 프롬프트를 구조화하고, 측정하고, 공유하는 TypeScript 프레임워크
  </p>
  <p align="center">
    <a href="#quick-start">Quick Start</a> |
    <a href="#concepts">Concepts</a> |
    <a href="#cli-reference">CLI Reference</a> |
    <a href="#adapters">Adapters</a> |
    <a href="#scoring">Scoring</a> |
    <a href="#contributing">Contributing</a>
  </p>
</p>

---

## Why aiwright?

AI 코딩 어시스턴트(Claude Code, Cursor, Copilot)의 동작 품질은 프롬프트에 달려 있습니다.
그런데 프롬프트는 프로젝트마다 복붙되고, 효과를 측정할 수 없고, 체계적으로 공유할 수 없습니다.

**aiwright**는 이 문제를 해결합니다:

- **Composable** — 프롬프트를 모듈처럼 가져오고, 조합하고, 타입 검증
- **Measurable** — 내장 벤치마크로 프롬프트 품질을 정량 측정
- **Shareable** — npm 패키지로 우수 프롬프트를 커뮤니티와 공유
- **Tool-agnostic** — Claude Code, Cursor, Copilot 등 어떤 도구든 어댑터로 연동

```
기존 도구들은 프롬프트의 한 측면만 다룹니다.
LangGPT는 구조만, Promptfoo는 테스팅만, Langfuse는 서버가 필요합니다.

aiwright는 구조화 + 측정 + 공유를 하나의 CLI 도구로 통합합니다.
```

|  | LangGPT | Promptfoo | Prompty | **aiwright** |
|---|:---:|:---:|:---:|:---:|
| 구조화된 프롬프트 조합 | O | - | - | **O** |
| 품질 측정 & 벤치마크 | - | O | - | **O** |
| npm 패키지로 공유 | - | - | - | **O** |
| TypeScript 네이티브 | - | O | - | **O** |
| Tool-agnostic | - | O | X | **O** |
| 적용 추적 (manifest) | - | - | - | **O** |

---

## Quick Start

```bash
# 설치
npm install -g @jsnetworkcorp/aiwright

# 프로젝트 초기화
cd your-project
aiwright init --adapter claude-code --with-builtins

# 기본 Recipe 적용 (CLAUDE.md에 자동 주입)
aiwright apply default

# 품질 점수 기록
aiwright score default --set 0.85 --note "works well"
```

**30초 만에 체계적인 AI 프롬프트가 CLAUDE.md에 적용됩니다.**

---

## Concepts

aiwright는 3계층 데이터 모델로 프롬프트를 관리합니다:

```
+------------------+     +------------------+     +------------------+
|    Fragment      |     |      Recipe      |     |     Profile      |
| (atomic prompt)  | --> |  (composition)   | --> |   (persona)      |
|                  |     |                  |     |                  |
| "한국어 응답"     |     | "TDD 개발자"     |     | "시니어 풀스택"   |
| "OWASP 체크"     |     | "보안 리뷰어"    |     | "보안 전문가"     |
| "Markdown 출력"  |     |                  |     |                  |
+--------+---------+     +--------+---------+     +------------------+
         |                        |                   (Phase 2)
         v                        v
+------------------------------------------------------------------+
|                        Core Engine                                |
|  resolve -> load -> validate -> compose -> render -> apply       |
+------------------------------------------------------------------+
         |                                                 |
         v                                                 v
+------------------+                              +------------------+
|     Scoring      |                              |    Adapter       |
| user signal      |                              | claude-code      |
| heuristic        |                              | cursor (soon)    |
| llm-judge (v2)   |                              | generic          |
+------------------+                              +------------------+
```

### Fragment

프롬프트의 **최소 재사용 단위**. YAML frontmatter + Markdown body 형식입니다.

```markdown
---
name: constraint-no-hallucination
description: 확인되지 않은 정보 생성 방지
slot: constraint
priority: 50
tags: [safety, reliability]
---

확인되지 않은 정보를 생성하지 마세요.
불확실한 경우 "모르겠다"고 답하세요.
추측이 필요한 경우, 반드시 "추측입니다"라고 명시하세요.
```

**slot**은 프롬프트 내 삽입 위치를 결정합니다:

| Slot | 용도 | 예시 |
|------|------|------|
| `system` | 시스템 역할 정의 | "당신은 시니어 개발자입니다" |
| `context` | 배경 정보, 도메인 지식 | "이 프로젝트는 Next.js 15 기반..." |
| `instruction` | 핵심 지시사항 | "코드 리뷰 시 보안을 우선 확인" |
| `constraint` | 제약 조건, 금지 사항 | "확인되지 않은 정보 생성 금지" |
| `output` | 출력 형식 지정 | "Markdown 형식으로 응답" |
| `example` | Few-shot 예시 | "입력: X → 출력: Y" |

**priority**는 같은 slot 내 순서를 결정합니다 (낮을수록 먼저).

### Recipe

Fragment를 조합하여 특정 목적의 프롬프트를 만듭니다. `aiwright.config.yaml`에 정의합니다:

```yaml
recipes:
  tdd-developer:
    description: TDD 기반 개발 프롬프트
    fragments:
      - fragment: system-role-engineer
        vars: { role: "TDD-focused developer" }
      - fragment: constraint-no-hallucination
      - fragment: constraint-test-first
      - fragment: output-markdown
```

### Adapter

합성된 프롬프트를 특정 AI 도구에 적용하는 브릿지입니다:

| Adapter | 대상 파일 | 상태 |
|---------|----------|------|
| `claude-code` | `CLAUDE.md` | Available |
| `generic` | stdout | Available |
| `cursor` | `.cursorrules` | Coming soon |
| `copilot` | `.github/copilot-instructions.md` | Coming soon |

---

## Installation

```bash
# 전역 설치 (권장)
npm install -g @jsnetworkcorp/aiwright

# 또는 npx로 바로 사용
npx @jsnetworkcorp/aiwright init

# 또는 프로젝트 로컬 설치
npm install -D @jsnetworkcorp/aiwright
```

**요구사항**: Node.js >= 18.0.0

---

## CLI Reference

### `aiwright init`

프로젝트에 aiwright를 초기화합니다.

```bash
# 대화형 (도구 선택, 내장 Fragment 추가 여부 질문)
aiwright init

# 비대화형 (Claude Code + 내장 Fragment 포함)
aiwright init --adapter claude-code --with-builtins
```

생성되는 파일:
```
aiwright.config.yaml          # 프로젝트 설정 + Recipe 정의
.aiwright/
  fragments/                  # Fragment 저장소
  scores/                     # 점수 이력
  manifest.yaml               # 적용 추적
```

init 직후 출력 예시:
```
aiwright initialized!

  Detected: Claude Code (.claude/ directory found)
  Recommended: constraint-no-hallucination, system-role-engineer

  Next steps:
    aiwright apply default        Apply the default recipe
    aiwright list                 Browse available fragments
    aiwright create --name my-frag  Create a custom fragment
```

### `aiwright create`

새 Fragment를 생성합니다.

```bash
# 플래그 방식
aiwright create \
  --name code-review-expert \
  --slot system \
  --priority 30 \
  --tags "review,quality" \
  --body "당신은 코드 리뷰 전문가입니다..."

# 파일에서 본문 읽기
aiwright create \
  --name code-review-expert \
  --slot system \
  --body-file ./my-prompt.txt
```

결과: `.aiwright/fragments/code-review-expert.md` 생성

### `aiwright add`

기존 Fragment를 프로젝트에 추가합니다.

```bash
# 내장 Fragment 추가
aiwright add constraint-no-hallucination

# 로컬 파일 추가
aiwright add ./my-team-fragment.md

# npm 패키지에서 추가 (Phase 2)
aiwright add @someuser/react-conventions
```

### `aiwright apply`

Recipe를 실행하여 AI 도구에 적용합니다.

```bash
# 기본 Recipe 적용
aiwright apply default

# 특정 Recipe 적용
aiwright apply tdd-developer

# 적용 전 미리보기 (실제 파일 변경 없음)
aiwright apply default --dry-run

# 현재 적용 vs 새 적용 비교
aiwright apply default --diff
```

적용 결과 예시:
```
Applied recipe "tdd-developer" via claude-code adapter
  Fragments: system-role-engineer(system:30), constraint-test-first(constraint:40),
             constraint-no-hallucination(constraint:50), output-markdown(output:50)
  Output: CLAUDE.md (section: ## AI Prompt Configuration)
  Manifest: .aiwright/manifest.yaml updated
```

CLAUDE.md에 `<!-- aiwright:start -->` / `<!-- aiwright:end -->` 마커로 관리됩니다.
기존 CLAUDE.md 내용은 마커 밖에 그대로 보존됩니다.

### `aiwright list`

사용 가능한 Fragment와 Recipe를 조회합니다.

```bash
# 전체 목록
aiwright list

# 검색
aiwright list --search "review"

# JSON 출력 (스크립트 연동용)
aiwright list --format json
```

출력 예시:
```
Fragments (local: 3, built-in: 5)
  NAME                            SLOT         PRI  TAGS
  code-review-expert              system        30  review, quality
  constraint-no-hallucination     constraint    50  safety
  constraint-test-first           constraint    40  tdd
  system-role-engineer            system        50  general
  output-markdown                 output        50  format
  ...

Recipes (2)
  NAME            ADAPTER       FRAGMENTS
  default         claude-code   3 fragments
  tdd-developer   claude-code   4 fragments
```

### `aiwright bench`

Recipe의 품질을 벤치마크 케이스로 검증합니다.

```bash
# 벤치마크 실행
aiwright bench tdd-developer --cases ./bench/cases.yaml

# 결과 저장
aiwright bench tdd-developer --cases ./bench/cases.yaml --save
```

`cases.yaml` 예시:
```yaml
cases:
  - name: "TDD 지시 확인"
    input: "새 기능을 구현해줘"
    assertions:
      - type: contains
        value: "테스트"
      - type: contains
        value: "먼저"

  - name: "한국어 응답 확인"
    input: "이 코드를 설명해줘"
    assertions:
      - type: not_contains
        value: "function"
      - type: format
        value: markdown
```

지원 assertion 타입: `contains`, `not_contains`, `format`, `length_gt`, `length_lt`, `regex`

출력 예시:
```
Benchmark: tdd-developer (2 cases)
  Case 1 "TDD 지시 확인":  PASS (contains: 2/2)
  Case 2 "한국어 응답 확인": PASS (not_contains: 1/1, format: OK)
Overall: 2/2 passed (100%)
```

### `aiwright score`

프롬프트 품질 점수를 기록하고 추적합니다.

```bash
# 점수 입력
aiwright score tdd-developer --set 0.88 --note "TDD 지시가 명확해짐"

# 이력 조회
aiwright score tdd-developer

# 추이 차트
aiwright score tdd-developer --trend
```

추이 출력 예시:
```
tdd-developer score trend:
1.0 |
0.8 |    *  *     *  *
0.6 |  *        *
0.4 |
    +--+--+--+--+--+--
      3/15 3/17 3/19 3/21 3/23
```

---

## Usage Examples

### Example 1: Claude Code 프로젝트에 프롬프트 표준화

```bash
# 1. 초기화
cd my-nextjs-project
aiwright init --adapter claude-code --with-builtins

# 2. 프로젝트 맞춤 Fragment 생성
aiwright create \
  --name nextjs-conventions \
  --slot context \
  --priority 20 \
  --body "이 프로젝트는 Next.js 15 App Router를 사용합니다.
Server Components를 기본으로, Client Components는 'use client' 명시.
Data fetching은 Server Components에서 직접 수행합니다."

# 3. Recipe 정의 (aiwright.config.yaml 편집)
```

```yaml
# aiwright.config.yaml
version: "1"
adapter: claude-code
vars:
  language: TypeScript

recipes:
  default:
    description: Next.js 개발 표준 프롬프트
    fragments:
      - fragment: system-role-engineer
        vars: { role: "Next.js 15 specialist" }
      - fragment: nextjs-conventions
      - fragment: constraint-no-hallucination
      - fragment: output-markdown
```

```bash
# 4. 적용
aiwright apply default
# → CLAUDE.md에 4개 Fragment가 slot 순서대로 합성·주입됨

# 5. 품질 확인
aiwright score default --set 0.9 --note "Next.js 규칙을 잘 따름"
```

### Example 2: 팀 공통 프롬프트를 글로벌로 공유

```bash
# 1. 글로벌 Fragment 생성
mkdir -p ~/.aiwright/fragments
aiwright create \
  --name team-korean-conventions \
  --slot constraint \
  --priority 10 \
  --body "응답은 항상 한국어로 작성하세요.
기술 용어는 원어 유지하되 한국어로 설명을 병기하세요.
커밋 메시지는 한국어로 작성합니다."

# 글로벌로 이동
mv .aiwright/fragments/team-korean-conventions.md ~/.aiwright/fragments/

# 2. 모든 프로젝트에서 자동으로 사용 가능
cd any-project
aiwright list
# → team-korean-conventions이 global에서 보임

aiwright apply default
# → global Fragment도 Recipe에 포함 가능
```

### Example 3: Fragment 간 충돌 관리

```bash
# verbose-output과 concise-output은 동시에 사용 불가
aiwright create \
  --name verbose-output \
  --slot output \
  --body "가능한 한 상세하게, 예시를 포함하여 설명하세요."

aiwright create \
  --name concise-output \
  --slot output \
  --body "간결하게, 핵심만 답변하세요."
```

Fragment 파일에서 `conflicts_with`를 설정:
```yaml
# verbose-output.md frontmatter
---
name: verbose-output
slot: output
conflicts_with: [concise-output]
---
```

```bash
# Recipe에 둘 다 포함하면 에러:
# Error [E003]: Fragments "verbose-output" and "concise-output" conflict
#   These fragments are mutually exclusive (conflicts_with).
#   Remove one from the recipe.
```

### Example 4: 벤치마크로 프롬프트 품질 비교

```bash
# 두 Recipe의 성능 비교
aiwright bench default --cases ./bench/review-cases.yaml --save
aiwright bench review-strict --cases ./bench/review-cases.yaml --save

# 점수 추이 비교
aiwright score default --trend
aiwright score review-strict --trend

# 더 높은 점수의 Recipe를 채택
aiwright apply review-strict
```

### Example 5: 적용 추적과 롤백

```bash
# 현재 어떤 Recipe가 적용되어 있는지 확인
cat .aiwright/manifest.yaml

# 적용 제거 (CLAUDE.md에서 aiwright 섹션만 제거, 나머지 보존)
aiwright apply default --remove

# 다른 Recipe로 교체
aiwright apply review-strict
```

---

## File Structure

aiwright 초기화 후 프로젝트 구조:

```
your-project/
├── aiwright.config.yaml          # Recipe 정의 + 설정
├── .aiwright/
│   ├── fragments/                # Fragment 파일 (.md)
│   │   ├── nextjs-conventions.md
│   │   └── team-rules.md
│   ├── scores/                   # 점수 이력
│   │   ├── default.yaml
│   │   └── review-strict.yaml
│   ├── manifest.yaml             # 적용 추적
│   └── bench/                    # 벤치마크 케이스
│       └── cases.yaml
├── CLAUDE.md                     # ← aiwright가 관리하는 섹션 포함
└── ...
```

글로벌 Fragment (모든 프로젝트에서 사용):
```
~/.aiwright/
└── fragments/
    ├── team-korean-conventions.md
    └── personal-style.md
```

---

## Hierarchical Override

Fragment는 3단계 계층으로 해결됩니다:

```
우선순위 (높은 것이 우선):
┌──────────────────────────────────────┐
│ 3. Project-local   .aiwright/        │  이 프로젝트만의 Fragment
├──────────────────────────────────────┤
│ 2. User-global     ~/.aiwright/      │  모든 프로젝트 공통
├──────────────────────────────────────┤
│ 1. Built-in        (패키지 내장)      │  aiwright 기본 제공
└──────────────────────────────────────┘
```

같은 이름의 Fragment가 여러 계층에 있으면 **local-wins**: 상위 계층이 하위를 덮습니다.
이 때 CLI에 경고가 표시됩니다:

```
Warning: Fragment "constraint-no-hallucination" in local overrides built-in version
```

---

## Adapters

### Claude Code (기본)

CLAUDE.md에 `<!-- aiwright:start/end -->` 마커로 관리합니다.

```bash
aiwright init --adapter claude-code
aiwright apply default
```

적용 후 CLAUDE.md:
```markdown
# My Project

기존 프로젝트 설명...

<!-- aiwright:start -->
## AI Prompt Configuration (managed by aiwright)

당신은 시니어 TypeScript 개발자입니다.

## 제약 조건
확인되지 않은 정보를 생성하지 마세요.

## 출력 형식
Markdown 형식으로 응답하세요.
<!-- aiwright:end -->
```

### Generic (stdout)

어떤 도구에도 적용하지 않고 합성 결과만 출력합니다.

```bash
aiwright apply default --adapter generic
# → stdout에 합성된 프롬프트 텍스트 출력
# → 클립보드에 복사하거나 다른 도구에 활용
```

---

## Scoring

aiwright는 프롬프트 품질을 정량적으로 추적합니다.

### User Signal (수동 평가)

```bash
# 0~1 점수 + 메모
aiwright score my-recipe --set 0.85 --note "리뷰 품질이 좋아졌다"
```

### Heuristic (자동 보조 지표)

Fragment 구조를 자동 분석하여 보조 점수를 제공합니다:

| 메트릭 | 의미 |
|--------|------|
| `structural_completeness` | 필수 slot(system, instruction) 포함 여부 |
| `length_ratio` | 프롬프트 길이 적정성 |
| `variable_coverage` | 선언된 변수의 실제 사용률 |

> Heuristic 점수는 `(auto)` 태그로 표시되며, 참고용입니다.
> 공식 점수는 사용자가 직접 입력한 User Signal입니다.

### LLM-as-Judge (Phase 2)

LLM이 프롬프트 품질을 점수 + 이유와 함께 평가합니다.

---

## Configuration

### aiwright.config.yaml

```yaml
version: "1"
adapter: claude-code

# 전역 변수 (모든 Recipe에서 사용 가능)
vars:
  language: TypeScript
  project_name: my-app

# Fragment 검색 경로
paths:
  local: .aiwright/fragments
  # global: ~/.aiwright/fragments (기본값)

# Recipe 정의
recipes:
  default:
    description: 기본 개발 프롬프트
    fragments:
      - fragment: system-role-engineer
        vars: { role: "senior developer" }
      - fragment: constraint-no-hallucination
      - fragment: output-markdown

  review:
    description: 코드 리뷰 전용
    fragments:
      - fragment: code-review-expert
        vars: { language: "{{language}}" }  # 전역 변수 참조
      - fragment: constraint-no-hallucination
      - fragment: output-json
        enabled: false  # 이 Recipe에서는 비활성
```

### Fragment 변수 (Mustache 템플릿)

Fragment body에서 `{{변수명}}`으로 변수를 사용합니다:

```markdown
---
name: system-role-engineer
variables:
  role:
    type: string
    required: true
    default: "software engineer"
---

당신은 {{role}}입니다.
```

변수 우선순위: `Fragment vars > Recipe vars > Global vars`

---

## Built-in Fragments

aiwright에 기본 포함된 Fragment:

| Fragment | Slot | 용도 |
|----------|------|------|
| `system-role-engineer` | system | 소프트웨어 엔지니어 역할 정의 |
| `constraint-no-hallucination` | constraint | 허위 정보 생성 방지 |
| `constraint-concise` | constraint | 간결한 응답 유도 |
| `output-markdown` | output | Markdown 형식 출력 |
| `output-json` | output | JSON 형식 출력 |

```bash
# 내장 Fragment 추가
aiwright add constraint-no-hallucination
```

---

## Roadmap

- [x] **Phase 1**: Fragment/Recipe, CLI, Claude Code Adapter, Scoring
- [ ] **Phase 2**: LLM-as-Judge, npm Registry, Profile, On/Off Toggle
- [ ] **Phase 3**: TextGrad Diagnosis, Drift Detection, Self-tuning
- [ ] **Phase 4**: Monorepo, Community Sharing, Quality Badges
- [ ] **Phase 5**: Cursor/Copilot/Windsurf Adapters
- [ ] **Phase 6**: Auto-optimization, Dual Evolution, Adaptive Routing

---

## Academic Foundation

aiwright의 설계는 다음 학술 연구에 기반합니다:

| 메커니즘 | 참조 | 적용 |
|---------|------|------|
| Fragment slot 구조 | MPO (arXiv:2601.04055) | 섹션별 독립 최적화 |
| 방향성 피드백 | TextGrad (arXiv:2406.07496) | 어떤 Fragment가 문제인지 진단 |
| 조합 탐색 | MIPROv2 (Stanford NLP) | Bayesian Optimization |
| 성능 이력 | OPRO (ICLR 2024) | 메타 프롬프트 기반 개선 |
| Self-healing | VIGIL (arXiv:2512.07094) | 실행/모니터링 레이어 분리 |

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# 개발 환경 설정
git clone https://github.com/tomtomjskim/aiwright.git
cd aiwright
npm install
npm run build
npm test
```

---

## License

[MIT](LICENSE)

---

<p align="center">
  Made with care by <a href="https://github.com/tomtomjskim">JSNetworkCorp</a>
</p>
