# CRESTO 🌊

> Born from the broken — 부서짐의 끝에서 태어나다.

<br> 파도와 균열의 리듬에서 출발한 **패턴 · 오브제 · 공예적 생활 소품**을 선보이는 가상의 리빙 브랜드샵입니다. 브랜드 스토리와 패턴 아카이브부터 **상품 → 장바구니 → 주문서 → 주문 완료**로 이어지는 쇼핑 흐름, 마이페이지·고객 안내까지 담은 반응형 웹 사이트입니다.
<br>

<br> 🔗 **데모**
- GitHub Pages: https://jhc2265.github.io/cresto/
- 로그인 또는 회원가입 화면에서 **버튼을 5번 연속 탭** → 테스트용 계정의 폼이 자동 입력됩니다.

---

## ✨ 주요 기능

- **메인 히어로 & 스크롤 모션** — Swiper 기반 히어로 영상, 섹션 퀵네비게이션 점(dot), 스크롤 진행바·패럴럭스, `IntersectionObserver` 등장 애니메이션 (`prefers-reduced-motion` 존중)
- **패턴(Pattern)** — Rough Wave · Soft Geometry · Ceramic Bloom · Blue Archive 4개 시그니처 패턴 페이지
- **오브제(Object)** — For Table · For Bath · For Fabric · For Space 컬렉션 · 카테고리 필터 · 정렬 · 표시 개수
- **상품 상세** — 다중 이미지 썸네일 갤러리, 색상·사이즈·수량 옵션, 장바구니·위시리스트, **스펙표 · 에디토리얼(스토리) · 사용 안내 4단 · 추천 상품**
- **장바구니 → 주문서 → 완료** — 수량·금액·배송비 실시간 계산(5만원 이상 무료배송), **배송지 입력 · 결제수단 선택 · 주문 요약**을 거치는 주문서 단계, 주문 완료 화면
- **주문 내역** — 주문 상세 · 배송 조회 모달 (마이페이지 연동)
- **로그인 / 회원가입** — 데모 인증(버튼 5탭 자동입력), 로그인 상태에 따른 헤더 전환(계정 팝오버 · 장바구니 · 로그아웃)
- **마이페이지(회원 전용)** — 주문내역 · 위시리스트 · 쿠폰 · 적립금 · 배송지 · 최근 본 상품 · 프로필
- **About / Service** — Design Mood · Craft · Archive / Size Guide · Care Service · Stockist · Inquiry · Contact
- **검색** — 헤더 검색 오버레이(한글·영문 지원) · 포커스 트랩 · 실시간 결과
- **뉴스레터 & 푸터** — “Join the wave” 구독 폼 · 푸터 SNS
- **완전 반응형** — 모바일 햄버거 드로어 · Grid/Flexbox 레이아웃 · 카드 호버 인터랙션 (가로 스크롤 0)

---

## 🧪 테스트 계정 (둘러보기용)

회원 정보를 직접 입력하지 않아도 기능을 체험할 수 있어요.

- 로그인 또는 회원가입 화면에서 **버튼을 5번 연속 탭**(2초 내) → 폼이 자동 입력됩니다.
- 이메일 `guest@cresto.com` / 비밀번호 `cresto1234`
- 이메일 형식만 맞으면 **아무 이메일·비밀번호로도** 데모 로그인이 됩니다.
- 로그인 후 주문을 진행하면 마이페이지의 **주문 내역**에 바로 반영됩니다.

---

## 🛠 기술 스택

- **Frontend** — HTML / CSS / JavaScript (빌드 도구 없는 정적 사이트)
- **상태/인터랙션** — Vanilla JS · `localStorage`(계정·장바구니·주문·위시리스트·최근 본 상품·배송지) · `IntersectionObserver`
- **UI 라이브러리** — Swiper 12 (히어로 슬라이더, CDN)
- **웹폰트** — Cormorant Garamond(영문 세리프 디스플레이) · Pretendard(본문) · Jeju Myeongjo(국문 명조 헤드라인) — Google Fonts / CDN
- **이미지** — 상품·페이지 이미지 **WebP 최적화**
- **호스팅** — GitHub Pages (정적 사이트)

> 내비게이션과 푸터는 각 HTML에 복붙하지 않고 **`js/main.js`의 단일 소스**(`SITE_NAV`, `FOOTER_HTML`)에서 렌더됩니다. 메뉴·푸터를 바꾸려면 이 한 곳만 수정하면 전 페이지에 반영됩니다.

---

## 🚀 실행 방법

### 로컬 서버로 보기 (권장)
```bash
# 둘 중 아무거나
python -m http.server 8000        # → http://localhost:8000
# 또는 VS Code의 "Live Server" 확장 사용
```
> `file://`(더블클릭)에서도 대부분 동작하지만, 히어로 영상·웹폰트 등 일부 기능은 로컬 서버에서 더 안정적입니다.

> 💡 CSS/JS는 캐시 무효화를 위해 `?v=YYYYMMDD` 쿼리를 붙여 로드합니다. `css/style.css`·`js/main.js`를 수정하면 모든 HTML의 버전 문자열(`?v=`)을 함께 올려야 재방문자에게 최신본이 반영됩니다.

---

## 🌐 배포 (GitHub Pages)

정적 사이트라 GitHub Pages로 바로 배포할 수 있습니다.

1. 이 폴더(`index.html`이 최상단이 되도록)를 GitHub 저장소에 푸시
2. **Settings → Pages → Build and deployment**
3. Source를 **Deploy from a branch**, 브랜치를 `main` / 루트(`/`)로 지정
4. 발급된 URL로 접속

---

## 📁 폴더 구조

```
cresto/                          # 사이트 루트
├── index.html                   # 메인 (히어로 · 패턴 · 스토리 · 컬렉션)
├── about.html / design-mood.html / craft.html / archive.html    # 브랜드
├── pattern.html                 # 패턴 개요
│   ├── rough-wave.html / soft-geometry.html
│   └── ceramic-bloom.html / blue-archive.html
├── object.html                  # 오브제 개요
│   └── for-table.html / for-bath.html / for-fabric.html / for-space.html
├── product-detail.html          # 상품 상세 (?id= 로 렌더)
├── cart.html                    # 장바구니 · 주문서 · 주문 완료
├── login.html                   # 로그인 · 회원가입
├── my-account.html              # 마이페이지 허브 (회원 전용)
│   ├── orders.html / wishlist.html / recent-view.html
│   ├── coupon.html / address.html / profile.html
├── contact.html / size-guide.html / care-service.html          # Service
│   └── stockist.html / inquiry.html
├── css/
│   ├── style.css                # 전체 스타일 (공통·메인·상세·반응형)
│   ├── reset.css                # 리셋
│   └── font.css
├── js/
│   └── main.js                  # 전체 로직 (상품 데이터·장바구니·주문·검색·인증·모션·내비/푸터)
├── image/                       # 이미지 (WebP 최적화)
│   └── generated/pages · generated/products
└── video/                       # 히어로 영상
```

---

## ⚠️ 데모 한계 (참고)

- 백엔드가 없어 **로그인·주문·위시리스트·문의**는 브라우저 `localStorage` 기반 데모입니다. 기기/브라우저 간 공유되지 않고, 저장소 데이터 삭제 시 초기화됩니다.
- 실제 **결제·배송**은 이뤄지지 않으며, 주문·배송 조회는 데모 화면입니다.
- 상품·후기·배송지 등은 데모용으로 생성·입력된 값입니다.
- 소셜 로그인, SNS 링크 등 일부 버튼은 안내 토스트만 표시하는 데모입니다.

---

## 📝 라이선스 / 권리

- 개인 **학습·포트폴리오** 목적의 가상 리빙 브랜드샵입니다. 실재하는 브랜드가 아닙니다.
- 사용한 라이브러리·폰트는 각 제공처의 라이선스를 따릅니다 (Swiper · Pretendard · Cormorant Garamond · Jeju Myeongjo 등).
- 상품·배경 이미지는 데모용 예시 자산입니다. 상업적 사용을 금합니다.
