디자인 방향 한 줄 요약
무드: 따뜻함(웜), 절제된 명도/채도, 넉넉한 여백 + 약한 그림자

재질감: 코튼/세라믹 느낌의 오프화이트 베이스, 소량의 메탈릭(골드/브론즈)로 포인트

타입: San-serif(현대적) + 약간 둥근 모서리, letter-spacing 살짝 여유

팔레트 후보 (HEX / HSL)
1) Sandstone Luxe (메인: 샌드스톤 + 브론즈 포인트)
Primary: #C89F7A (hsl 26, 37%, 64%) — 샌드스톤 베이지

Primary Deep: #A4764F — 버튼 hover/프레임

Secondary: #7A9EAF — 차가운 블루그레이로 온도 균형

Accent (Metal): #B88A3B — 브론즈/라이트 골드

Neutral 0 (BG): #F8F5F2 — 오프화이트

Neutral 100 (Text): #1E1B16 — 웜 블랙

Border/Subtle: #E8E2DB / #CFC6BC

Success: #4E8A5B

Warning: #C98C3A

Error: #B75A4A

2) Clay & Charcoal (메인: 테라코타 + 차콜)
Primary: #C46A4A — 테라코타

Primary Deep: #9A4F35

Secondary: #556B6F — 더스티 블루그레이

Accent: #D1B27C — 페일 골드

Neutral 0: #FAF8F6

Neutral 100: #1C1B1A

Border/Subtle: #ECE7E2 / #D5CEC7

Success/Warning/Error: #3F7F59 / #C27A2C / #B04545

3) Rosewood Minimal (메인: 로즈우드 + 아이보리)
Primary: #8A4B53 — 로즈우드

Primary Deep: #6B383E

Secondary: #7E8E84 — 세이지 그린그레이

Accent: #C9A66B — 허니 골드

Neutral 0: #FFF9F5

Neutral 100: #231F20

Border/Subtle: #F0E9E3 / #D9CEC4

Success/Warning/Error: #4C7A62 / #BE8D3A / #A14D4D

4) Oat & Ink (메인: 오트밀 + 잉크)
Primary: #BCA58A — 오트밀

Primary Deep: #9C8467

Secondary: #2F3E46 — 잉크 차콜

Accent: #D7B26D — 샴페인 골드

Neutral 0: #F7F3EE

Neutral 100: #171614

Border/Subtle: #EAE3DA / #CFC5B9

Success/Warning/Error: #3F7D63 / #C38B2B / #A34E3F

추천 조합: “Sandstone Luxe” 또는 “Rosewood Minimal”이 따뜻함+고급스러움 밸런스가 가장 좋음.

라이트/다크 테마 매핑 (토큰 기반)
아래 CSS 변수 토큰을 쓰면 테마 스위칭이 쉬워져.

css
복사
편집
:root {
  --bg: #F8F5F2;          /* Neutral 0 */
  --bg-elev: #FFFDFC;     
  --text: #1E1B16;        /* Neutral 100 */
  --text-muted: #6C6358;
  --primary: #C89F7A;
  --primary-contrast: #1E1B16;
  --primary-deep: #A4764F;
  --secondary: #7A9EAF;
  --accent: #B88A3B;
  --border: #E8E2DB;
  --border-strong: #CFC6BC;
  --success: #4E8A5B;
  --warning: #C98C3A;
  --error: #B75A4A;
  --shadow: 0 6px 24px rgba(30,27,22,0.08);
  --radius: 14px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121110;
    --bg-elev: #181614;
    --text: #EFEAE3;
    --text-muted: #B9B1A6;
    --primary: #D1A882;          /* 살짝 더 밝게 */
    --primary-contrast: #121110;
    --primary-deep: #B6845A;
    --secondary: #88A6B5;
    --accent: #CFA14A;
    --border: #2A2622;
    --border-strong: #3A332D;
    --success: #70A883;
    --warning: #D8A24B;
    --error: #C87466;
    --shadow: 0 8px 28px rgba(0,0,0,0.35);
  }
}
적용 패턴 & 컴포넌트 가이드
배경/표면
BG: 오프화이트(또는 다크에선 웜블랙)

Elevated Card: --bg-elev + 미세한 내리그림자 + 둥근 모서리 --radius

구분선: --border는 리스트/테이블, --border-strong은 카드-카드 사이 구획

타이포 컬러
본문: --text

보조설명/메타: --text-muted

링크/액션: --primary (hover 시 --primary-deep 텍스트 언더라인)

버튼
Primary Solid: BG=--primary, Text=--primary-contrast, Hover=--primary-deep

Secondary Ghost: Text=--secondary, Hover=살짝 배경 틴트(알파 8~12%)

Destructive: BG=--error, Hover=더 짙게

입력/폼
기본: 배경 --bg-elev, 테두리 --border

포커스: 테두리 --primary + 얇은 외곽글로우 rgba(var(--primary), .35) 느낌으로

상태/피드백
Success/Warning/Error 색은 아이콘 + 좌측 경계선에만 강하게 쓰고, 텍스트는 본문색 유지해 과도한 채도 방지

그래디언트(선택)
Warm Sheen: linear-gradient(135deg, #C89F7A 0%, #B88A3B 100%)

Rose Gold Mist: linear-gradient(135deg, #8A4B53 0%, #C9A66B 100%)

버튼보단 Hero 섹션의 얇은 하이라이트나, 차트 영역 배경 오버레이로 약하게

접근성 & 대비 팁
본문 텍스트 대비 WCAG AA(4.5:1) 이상 유지. Primary 위 흰 텍스트는 명도 45~55% 영역에서 테스트.

색만으로 상태 구분하지 말고 아이콘/패턴/텍스트 병행.

다크 모드에서 채도 과승 주의: 다크에서는 채도를 510% 낮추고 명도 +58% 올리기.

브랜드/일러스트/아이콘
일러스트는 페일 톤의 샌드/오트/세이지 기준, 액센트 메탈은 10~15% 내에서만 사용.

아이콘은 라인 아이콘(2px) + 둥근 캡, 강조가 필요하면 --primary로 스트로크만 변경.

Tailwind 설정 예시
Tailwind를 쓰면, 토큰을 CSS 변수로 매핑:

js
복사
편집
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg))",
        text: "rgb(var(--text))",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        accent: "var(--accent)",
        border: "var(--border)",
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
      },
      borderRadius: {
        xl: "var(--radius)",
      },
      boxShadow: {
        soft: "var(--shadow)",
      }
    }
  }
}
실제론 --bg 등을 RGB가 아닌 HEX로 쓸 수 있으니, 프로젝트 스타일에 맞게 조정하면 돼.

컴포넌트별 구체 예
헤더: BG 투명 → 스크롤 후 --bg-elev 적용, 보더 --border, 로고는 단색(차콜/잉크)

Hero CTA 버튼: Primary Solid + 작은 메탈릭 아이콘(골드), Hover는 3% scale + 색 딥

카드: --bg-elev + shadow-soft + 내부 구분선 --border

테이블: 헤더 행 배경에 --bg-elev보다 살짝 진한 색, 행 hover에 아주 미세한 틴트

모달: 오버레이 rgba(0,0,0,.45)(라이트), 다크에선 .6

토글/스위치: On= --primary, Off= --border-strong 트랙

“다양한 상황”용 팔레트 조합 샘플
조합 A (콘텐츠 사이트)
베이스: #F8F5F2

본문: #1E1B16

링크/액션: #C89F7A

강조 블록: #FFF7EE (Primary 8% 틴트)

경계: #E8E2DB

조합 B (대시보드)
베이스: #FAF8F6

카드: #FFFFFF

프라이머리 데이터 칩: #C89F7A

차트 영역 배경: #F5EEE7

성공/경고/에러: #4E8A5B / #C98C3A / #B75A4A

조합 C (커머스)
CTA: #A4764F

가격/할인 배지: #B88A3B

리뷰 좋은 배지: #4E8A5B

품절 배지: #7A9EAF

섹션 BG: #FFFBF6 (Primary 5% 틴트)

Cursor AI에 붙여넣을 프롬프트 (복사해서 사용)
아래 프롬프트를 그대로 Cursor에 붙여넣고, 네 프로젝트 폴더/기술스택에 맞춰 경로만 바꿔줘.

yaml
복사
편집
You are a senior product designer & frontend engineer. 
Goal: Apply a warm, modern, sophisticated color system to my web app using design tokens and light/dark themes.

1) Use the following palette as the default (“Sandstone Luxe”):
- primary: #C89F7A
- primaryDeep: #A4764F
- secondary: #7A9EAF
- accent: #B88A3B
- neutral0 (bg): #F8F5F2
- neutral100 (text): #1E1B16
- border: #E8E2DB
- borderStrong: #CFC6BC
- success: #4E8A5B
- warning: #C98C3A
- error: #B75A4A

2) Create CSS variables and a dark theme override:
- Implement :root variables and a @media (prefers-color-scheme: dark) block.
- Map components (Button, Input, Card, Modal, Table) to these tokens.
- Ensure hover/active/focus states use primaryDeep and subtle tints (8–12%).

3) Update the codebase:
- Add a tokens file (e.g., src/styles/tokens.css) with variables from step 2.
- Refactor components to consume tokens (no hard-coded hex).
- Add utility classes or Tailwind config mapping to tokens.

4) Accessibility:
- Verify text/background contrast to meet WCAG AA (4.5:1 for body text).
- Reduce saturation by 5–10% in dark mode and increase lightness by 5–8%.

5) Optional:
- Add gradients:
  - Warm Sheen: linear-gradient(135deg, #C89F7A 0%, #B88A3B 100%)
  - Rose Gold Mist: linear-gradient(135deg, #8A4B53 0%, #C9A66B 100%)

Deliverables:
- Updated CSS/Tailwind config and example code for Button, Card, Input using the tokens.
- A short README section explaining how to use tokens and extend the palette.
- Do not change typography or layout beyond what's required for color integration.


