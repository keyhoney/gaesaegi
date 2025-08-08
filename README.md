# 송현여고 수학 학습 시스템
## Tailwind 정식 빌드 적용 안내

본 프로젝트는 따뜻하고 모던한 Sandstone Luxe 팔레트 기반 디자인 토큰과 Tailwind를 함께 사용하도록 준비되었습니다.

### 추가된 파일
- `tailwind.config.js`: CSS 변수(토큰)를 Tailwind 색/섀도/반경 등에 매핑, `hocus` variant 추가
- `postcss.config.cjs`: PostCSS 플러그인 구성(Tailwind, Autoprefixer)
- `src/styles/tokens.css`: 컬러/반경/섀도/그라데이션/포커스 링 토큰
- `src/styles/util.css`: 포커스 링 유틸리티 클래스

### 설치 및 빌드
1) 의존성 설치
```
npm i -D tailwindcss postcss autoprefixer
```

2) 전역 CSS에 Tailwind 지시문 추가(예: `styles.css` 최상단 또는 별도 `src/index.css`)
```
@tailwind base;
@tailwind components;
@tailwind utilities;
```

3) 토큰/유틸 import (HTML `<head>`에 링크 또는 번들에 포함)
```
<link rel="stylesheet" href="src/styles/tokens.css">
<link rel="stylesheet" href="src/styles/util.css">
```

4) Tailwind 빌드 (예시)
```
npx tailwindcss -c tailwind.config.js -i ./styles.css -o ./dist/tailwind.css --minify
```

5) HTML에서 산출물 로드
```
<link rel="stylesheet" href="dist/tailwind.css">
```

### 사용 팁
- 색상/섀도/반경 등은 CSS 변수로 제어되므로, 테마 전환이 쉽습니다.
- 유틸리티는 기존 클래스와 혼용해 점진적으로 적용하세요.

### 디자인 토큰 빠른 가이드
- **색상(주요)**
  - `--primary-color`, `--primary-light`, `--primary-dark`
  - `--secondary-color`, `--accent-color`
  - `--success-color`, `--warning-color`, `--error-color`, `--info-color`
  - `--text-primary`, `--text-secondary`, `--text-light`
  - `--bg-primary`, `--bg-secondary`, `--bg-tertiary`
  - `--border-color`, `--border-light`
- **그라디언트**
  - `--gradient-primary`, `--gradient-bg`
- **섀도**
  - `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`
- **라운드**
  - `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-full`
- **포커스 링**
  - `--ring`

예시
```html
<!-- 버튼 -->
<button class="btn" style="background: var(--primary-color); box-shadow: var(--shadow-md);">
  확인
</button>

<!-- 카드 -->
<div class="card" style="background: var(--bg-secondary); border:1px solid var(--border-color); border-radius: var(--radius-lg);">
  내용
</div>
```

### 화면별 권장 토큰 조합 표

| 컴포넌트 | 배경 | 텍스트 | 보더 | 그라디언트/포커스 | 섀도/라운드 |
|---|---|---|---|---|---|
| 기본 버튼(Primary) | `--primary-color` | `white` | color-mix(in oklab, var(--primary-color) 45%, transparent) | hover: `--primary-dark`, focus: `--ring` | `--shadow-md`, `--radius-lg` |
| 보조 버튼(Secondary) | `--bg-secondary` | `--text-secondary` | `--border-color` | hover: color-mix(in oklab, var(--primary-light) 12%, var(--bg-secondary)) | `--shadow-sm`, `--radius-lg` |
| 카드(Card) | `--bg-secondary` | `--text-primary` | `--border-color` | 상단바: `--gradient-primary`(선택) | `--shadow-md`, `--radius-xl` |
| 모달(Modal) | `--bg-secondary` | `--text-primary` | `--border-color` | focus: `--ring` | `--shadow-xl`, `--radius-xl` |
| 테이블 헤더 | color-mix(in oklab, var(--primary-color) 10%, var(--bg-secondary)) | `--text-primary` | `--border-color` | - | - |
| 배지 Success | `--success-light` | `--success-color` | color-mix(in oklab, var(--success-color) 35%, transparent) | - | `--radius-md` |
| 배지 Warning | `--warning-light` | `--warning-color` | color-mix(in oklab, var(--warning-color) 35%, transparent) | - | `--radius-md` |
| 배지 Error | `--error-light` | `--error-color` | color-mix(in oklab, var(--error-color) 35%, transparent) | - | `--radius-md` |
| 입력(Input) | `--bg-primary` | `--text-primary` | `--border-color` | focus: `--ring` | `--radius-md` |
| 히어로/헤더 | `--bg-secondary` 또는 `--gradient-bg` | `--text-primary` | `--border-color` | 상단바: `--gradient-primary` | `--shadow-lg`, `--radius-xl` |
| 채팅 말풍선(상대) | `--bg-secondary` | `--text-primary` | `--border-color` | - | `--shadow-sm`, `--radius-md` |
| 채팅 말풍선(내 메시지) | `--primary-color` | `white` | color-mix(in oklab, var(--primary-color) 45%, transparent) | - | `--radius-md` |

참고: 다크 모드에서는 동일한 토큰을 사용하되, `@media (prefers-color-scheme: dark)` 하에서 대비를 color-mix 비율로 보정합니다.

# 송현여고 수학 학습 시스템

여학생을 위한 전문적인 수학 학습 웹 애플리케이션입니다. 개념별 기출문제를 통해 체계적인 수학 학습을 지원합니다.

## 🔒 보안 강화사항

### 환경변수 기반 설정
- Firebase API 키를 환경변수로 관리
- 하드코딩된 보안 정보 제거
- API 키 제한 설정 지원

### 환경변수 설정 방법

1. **환경변수 파일 생성**
   ```bash
   # env.example 파일을 .env로 복사
   cp env.example .env
   ```

2. **Firebase 설정값 입력**
   ```bash
   # .env 파일 편집
   FIREBASE_API_KEY=your_actual_api_key_here
   FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   FIREBASE_APP_ID=your_app_id
   FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

3. **Firebase Console에서 API 키 제한 설정**
   - Firebase Console → 프로젝트 설정 → 일반
   - API 키 제한 설정
   - 허용된 도메인: `localhost`, `gaesaegi-math.firebaseapp.com`
   - 허용된 IP 주소 설정 (선택사항)

### 에러 처리 개선
- 구체적인 에러 메시지 제공
- 사용자 친화적인 에러 표시
- 보안 관련 에러 분류 및 처리

### 데이터 접근 제한
- 사용자별 데이터 접근 권한 확인
- API 요청 제한 설정
- 메모리 사용량 모니터링

## 🎨 개선된 UI/UX 특징

### 여학생 친화적 디자인
- **핑크 계열 색상 팔레트**: 여학생들이 선호하는 따뜻하고 친근한 색상 사용
- **부드러운 그라데이션**: 시각적 매력도를 높이는 모던한 그라데이션 효과
- **직관적인 인터페이스**: 복잡하지 않고 사용하기 쉬운 UI 구성

### 전문적인 사용자 경험
- **반응형 디자인**: 모든 디바이스에서 최적화된 경험 제공
- **부드러운 애니메이션**: 자연스러운 전환 효과와 인터랙션
- **접근성 고려**: 고대비 모드, 다크 모드 지원
- **터치 친화적**: 모바일에서도 편리한 터치 인터페이스

### 고급 기능
- **실시간 학습 분석**: 개인별 맞춤 통계 및 차트
- **즐겨찾기 시스템**: 중요한 문제를 쉽게 저장하고 관리
- **학습 노트**: 문제별 메모 기능으로 개인화된 학습
- **이미지 확대**: 문제 이미지를 자세히 볼 수 있는 줌 기능

## 🚀 주요 기능

### 1. 로그인 시스템
- 구글 계정을 통한 간편 로그인
- 안전한 인증 시스템
- 자동 로그인 상태 유지
- 구체적인 에러 메시지 제공

### 2. 문제 학습
- **개념별 분류**: 수학 개념에 따른 체계적인 문제 분류
- **기출문제 중심**: 실제 시험 유형의 문제 제공
- **단계별 학습**: 난이도에 따른 학습 진행
- **이미지 최적화**: 지연 로딩 및 캐싱으로 성능 향상

### 3. 학습 분석 대시보드
- **개인 통계**: 총 문제 수, 정답률, 학습 시간 등
- **시각적 차트**: 일별/주별 학습 추이, 단원별 성취도
- **학습 패턴 분석**: 요일별, 시간대별 학습 패턴 파악

### 4. 인터랙티브 기능
- **즉시 채점**: 답안 제출 후 즉시 정답 확인
- **해설 제공**: 오답 시 상세한 해설 및 풀이 과정
- **진행 상황 추적**: 학습한 문제와 남은 문제 파악

### 5. 코인 시스템
- **레벨업 보상**: 레벨업 시 코인 지급
- **배지 보상**: 배지 획득 시 코인 지급
- **특별 업적**: 특별한 업적 달성 시 코인 보상
- **거래 시스템**: 코인 거래소를 통한 코인 거래
- **로또 시스템**: 코인을 사용한 추첨 게임

## 📱 반응형 디자인

### 데스크톱
- 넓은 화면을 활용한 효율적인 레이아웃
- 사이드바를 통한 쉬운 문제 탐색
- 고해상도 차트와 상세한 통계 정보

### 태블릿
- 터치 친화적 인터페이스
- 적응형 레이아웃으로 최적화된 경험

## 💰 코인 시스템 설정

### 초기 설정
코인 시스템을 사용하기 위해서는 Firebase 데이터베이스 초기화가 필요합니다.

1. **간단한 초기화**
   ```
   initialize-coin-system.html 파일을 브라우저에서 열어서 초기화를 실행하세요.
   ```

2. **관리자 초기화 (상세)**
   ```
   admin-database-init.html 파일을 브라우저에서 열어서 상세한 초기화 옵션을 사용하세요.
   ```

### 데이터베이스 구조
초기화 후 다음 컬렉션들이 생성됩니다:

- **users**: 사용자 정보 (coins 필드 추가)
- **coins**: 코인 잔고 및 통계 정보
- **coin_transactions**: 코인 거래 내역
- **orders**: 거래소 주문 정보
- **trades**: 거래소 거래 기록

### 보안 규칙
Firebase 보안 규칙이 자동으로 설정되어 사용자별 데이터 접근을 제한합니다.
- 손가락 터치에 최적화된 버튼 크기

### 모바일
- 세로 화면에 최적화된 레이아웃
- 스와이프 제스처 지원
- 간소화된 메뉴 구조
- 에러 메시지 모바일 최적화

## 🎯 사용자 경험 개선사항

### 시각적 개선
- **모던한 디자인 시스템**: 일관된 색상, 타이포그래피, 간격
- **미세한 애니메이션**: 호버 효과, 로딩 애니메이션, 전환 효과
- **직관적인 아이콘**: 기능을 쉽게 이해할 수 있는 아이콘 사용

### 사용성 개선
- **명확한 네비게이션**: 어디에 있는지, 어디로 갈 수 있는지 명확히 표시
- **즉각적인 피드백**: 사용자 액션에 대한 즉시 반응
- **오류 방지**: 실수할 수 있는 상황을 미리 방지

### 접근성 개선
- **키보드 네비게이션**: 마우스 없이도 모든 기능 사용 가능
- **스크린 리더 지원**: 시각 장애인을 위한 음성 안내
- **고대비 모드**: 시각적 대비가 낮은 사용자를 위한 지원

## 🛠 기술 스택

### 프론트엔드
- **HTML5**: 시맨틱 마크업으로 구조화
- **CSS3**: 모던한 스타일링과 애니메이션
- **JavaScript (ES6+)**: 인터랙티브 기능 구현
- **Chart.js**: 데이터 시각화

### 백엔드 & 인프라
- **Firebase Authentication**: 안전한 사용자 인증
- **Firebase Firestore**: 실시간 데이터베이스
- **Firebase Hosting**: 안정적인 웹 호스팅

### 디자인 시스템
- **CSS 변수**: 일관된 디자인 토큰
- **Flexbox & Grid**: 현대적인 레이아웃 시스템
- **CSS 애니메이션**: 부드러운 전환 효과

## 📊 성능 최적화

### 로딩 성능
- **이미지 최적화**: 적절한 크기와 포맷 사용
- **지연 로딩**: 필요한 이미지만 로드
- **캐싱 전략**: 브라우저 캐시 활용
- **메모리 관리**: 주기적인 메모리 정리

### 사용자 경험
- **스켈레톤 로딩**: 로딩 중에도 시각적 피드백
- **점진적 향상**: 기본 기능부터 고급 기능까지 단계적 제공
- **오프라인 지원**: 네트워크 없이도 기본 기능 사용 가능

### 성능 모니터링
- **로딩 시간 측정**: 페이지 로드 성능 추적
- **메모리 사용량**: 메모리 누수 방지
- **에러 추적**: 사용자 경험에 영향을 주는 에러 모니터링

## 🔧 설치 및 실행

### 필수 요구사항
- Node.js 14.0 이상
- Firebase 프로젝트 설정
- 환경변수 설정

### 환경변수 설정
1. `.env.example` 파일을 `.env`로 복사
2. Firebase 프로젝트 설정값으로 업데이트
3. API 키 제한 설정 (Firebase Console)

### 로컬 개발
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

### 배포
```bash
# 프로덕션 빌드
npm run build

# Firebase 배포
firebase deploy
```

## 🔒 보안 설정

### Firebase 보안 규칙
```javascript
// Firestore 보안 규칙
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자별 데이터 접근 제한
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 답안 데이터 접근 제한
    match /answers/{answerId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // 즐겨찾기 데이터 접근 제한
    match /favorites/{favoriteId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

### API 키 제한 설정
1. Firebase Console에서 프로젝트 설정
2. API 키 제한 설정
3. 허용된 도메인 및 IP 주소 설정

## 📈 성능 모니터링

### 메트릭 수집
- 페이지 로드 시간
- 이미지 로딩 성능
- 메모리 사용량
- 에러 발생률

### 최적화 전략
- 이미지 압축 및 최적화
- 코드 분할 및 지연 로딩
- 캐싱 전략 개선
- 메모리 누수 방지

## 🐛 문제 해결

### 일반적인 문제
1. **로그인 실패**: 팝업 차단 확인
2. **이미지 로딩 실패**: 네트워크 연결 확인
3. **성능 저하**: 브라우저 캐시 정리

### 디버깅
- 브라우저 개발자 도구 활용
- 콘솔 로그 확인
- 네트워크 탭에서 요청 상태 확인

## 📝 업데이트 로그

### v2.0.0 (최신)
- 🔒 보안 강화: 환경변수 기반 설정
- 🚀 성능 최적화: 메모리 관리 개선
- 🎨 UI/UX 개선: 에러 메시지 시스템
- 📱 모바일 최적화: 반응형 디자인 강화
- 🛠 코드 품질: 클래스 기반 구조로 리팩토링

### v1.0.0
- 초기 버전 릴리즈
- 기본 학습 기능 구현
- Firebase 연동

## 📞 지원

문제가 발생하거나 개선사항이 있으시면 이슈를 등록해 주세요.

---

**송현여고 수학 학습 시스템** - 여학생을 위한 전문적인 수학 학습 플랫폼 