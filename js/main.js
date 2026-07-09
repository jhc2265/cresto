/* ============================================================
   CRESTO — shared front-end behavior (progressive enhancement)
   - header action icons (search / account / cart / hamburger)
   - account = login entry (logged-out) or My Page popover (logged-in)
   - mobile drawer menu (built from existing .gnb)
   - search overlay, cart panel
   - client-side auth (login / signup)
   - newsletter form handling, footer SNS links
   ============================================================ */
(function () {
  "use strict";

  var DEMO_LOGIN = { email: "guest@cresto.com", password: "cresto1234" };
  var DEMO_SIGNUP = { name: "Cresto Guest", email: "guest@cresto.com", password: "cresto1234" };
  var DEMO_CART = [
    { id: "rough-wave-plate", name: "Rough Wave Plate", meta: "Ocean Blue · 1", price: 38000 },
    { id: "soft-geometry-bowl", name: "Soft Geometry Bowl", meta: "Ivory · 1", price: 29000 }
  ];
  var ACCT_LINKS = [
    ["my-account.html", "My Account"],
    ["orders.html", "Orders"],
    ["wishlist.html", "Wishlist"]
  ];

  var AUTH = {
    KEY: "cresto_user",
    get: function () {
      try { return JSON.parse(localStorage.getItem(this.KEY)); }
      catch (e) { return null; }
    },
    set: function (u) { localStorage.setItem(this.KEY, JSON.stringify(u)); },
    clear: function () { localStorage.removeItem(this.KEY); }
  };

  /* shopping cart, persisted in localStorage.
     Seeds from DEMO_CART on first visit so the demo always has sample items.
     Each line = { name, meta, price (line total), qty }. */
  var CART = {
    KEY: "cresto_cart",
    get: function () {
      try {
        var raw = localStorage.getItem(this.KEY);
        if (raw === null) {
          return DEMO_CART.map(function (i) {
            return { id: i.id, name: i.name, meta: i.meta, price: i.price, qty: 1 };
          });
        }
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    },
    set: function (items) { try { localStorage.setItem(this.KEY, JSON.stringify(items)); } catch (e) {} },
    add: function (item) {
      var items = this.get(), match = null;
      items.forEach(function (i) { if (i.name === item.name && i.meta === item.meta) match = i; });
      if (match) { match.qty += item.qty; match.price += item.price; }
      else items.push(item);
      this.set(items);
    },
    totalQty: function () { return this.get().reduce(function (s, i) { return s + (i.qty || 1); }, 0); },
    totalPrice: function () { return this.get().reduce(function (s, i) { return s + (i.price || 0); }, 0); },
    removeAt: function (i) { var items = this.get(); items.splice(i, 1); this.set(items); },
    setQtyAt: function (i, qty) {
      var items = this.get();
      if (items[i]) {
        var unit = items[i].price / (items[i].qty || 1);
        items[i].qty = qty;
        items[i].price = unit * qty;
      }
      this.set(items);
    }
  };
  var ORDERS = {
    KEY: "cresto_orders",
    get: function () { return readJSON(this.KEY); },
    set: function (v) { writeJSON(this.KEY, v); },
    create: function (items, shipping) {
      var subtotal = items.reduce(function (s, i) { return s + (i.price || 0); }, 0);
      var ship = subtotal >= 50000 ? 0 : 3000;
      var now = new Date();
      var y = now.getFullYear();
      var m = pad(now.getMonth() + 1);
      var d = pad(now.getDate());
      var order = {
        no: y + m + d + "-" + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()),
        date: y + "." + m + "." + d,
        status: "주문 완료",
        total: subtotal + ship,
        ship: ship,
        ship_to: shipping || null,
        items: items.map(function (it) {
          return {
            id: it.id || "",
            name: it.name,
            meta: it.meta || "기본 옵션",
            qty: it.qty || 1,
            price: it.price || 0,
            img: itemImg(it)
          };
        })
      };
      this.set([order].concat(this.get()).slice(0, 5));
      return order;
    }
  };

  function readJSON(key) { try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : []; } catch (e) { return []; } }
  function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  /* wishlist + recently-viewed, persisted in localStorage.
     Each item = { name, kr, price, img, href }. */
  var WISH = {
    KEY: "cresto_wishlist",
    get: function () { return readJSON(this.KEY); },
    set: function (v) { writeJSON(this.KEY, v); },
    has: function (name) { return this.get().some(function (i) { return i.name === name; }); },
    toggle: function (item) {
      var items = this.get(), idx = -1;
      items.forEach(function (i, k) { if (i.name === item.name) idx = k; });
      if (idx > -1) items.splice(idx, 1); else items.push(item);
      this.set(items);
      return idx === -1; // true = added
    },
    remove: function (name) { this.set(this.get().filter(function (i) { return i.name !== name; })); }
  };
  var RECENT = {
    KEY: "cresto_recent",
    get: function () { return readJSON(this.KEY); },
    set: function (v) { writeJSON(this.KEY, v); },
    push: function (item) {
      var items = this.get().filter(function (i) { return i.name !== item.name; });
      items.unshift(item);
      this.set(items.slice(0, 8));
    }
  };
  /* 마지막으로 입력한 배송지. 주문서에서 재사용해 매번 다시 입력하지 않도록 한다. */
  var SHIP = {
    KEY: "cresto_ship",
    get: function () { try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem(this.KEY, JSON.stringify(v)); } catch (e) {} }
  };

  var cartPanelEl = null;

  /* ============================================================ PRODUCT CATALOG
     단일 진실 공급원. product-detail.html 은 ?id= 로 이 데이터를 렌더한다.
     category: table / bath / fabric / space (Object 하위) */
  var PRODUCTS = [
    {
      id: "rough-wave-plate", name: "Rough Wave Plate", kr: "러프 웨이브 플레이트",
      price: 38000, category: "table", catLabel: "Object · Tableware", tag: "Signature",
      images: ["image/generated/ceramic-object.webp", "image/generated/pages/rough-wave-page.webp", "image/generated/pages/for-table-page.webp", "image/generated/tile-relief.webp"],
      colors: [["Ocean Blue", "#7e9cc0"], ["Ivory", "#ece6da"], ["Sand", "#cdbfa6"]],
      sizes: ["Ø 22cm", "Ø 27cm"],
      lead: "부서지는 파도의 선을 그대로 옮긴 시그니처 플레이트. 거친 듯 부드러운 표면 질감이 음식과 공간을 조용히 받쳐 줍니다.",
      desc: ["러프 웨이브 플레이트는 CRESTO의 시그니처 패턴 ‘Rough Wave’를 입체 표면으로 옮긴 첫 테이블웨어입니다. 유약을 얇게 겹쳐 파도의 결을 손끝으로 느낄 수 있도록 마감했습니다.", "한 점씩 손작업으로 완성되어 미세한 색과 결의 차이가 있을 수 있으며, 이는 손으로 만든 오브제의 고유한 표정입니다."],
      meta: [["소재", "석기질 도자 (Stoneware)"], ["크기", "지름 22cm · 높이 2.5cm"], ["원산지", "대한민국 · 핸드메이드"], ["배송", "주문 후 2–4일 이내 출고"]],
      specs: [["소재", "석기질 도자 (Stoneware), 무연 유약"], ["크기", "Ø 22cm / Ø 27cm"], ["무게", "약 540g (Ø 22cm 기준)"], ["관리", "전자레인지 · 식기세척기 사용 가능"], ["구성", "플레이트 1P · 전용 패키지"]],
      related: ["soft-geometry-bowl", "ocean-mug", "wave-tray"]
    },
    {
      id: "soft-geometry-bowl", name: "Soft Geometry Bowl", kr: "소프트 지오메트리 볼",
      price: 29000, category: "table", catLabel: "Object · Tableware", tag: "Signature",
      images: ["image/generated/products/soft-geometry-bowl-card.png", "image/generated/pages/soft-geometry-page.webp", "image/generated/tile-relief.webp", "image/generated/pages/for-table-page.webp"],
      colors: [["Ivory", "#ece6da"], ["Ocean Blue", "#7e9cc0"], ["Sand", "#cdbfa6"]],
      sizes: ["S · Ø 13cm", "M · Ø 16cm"],
      lead: "부드러운 기하 곡선이 살아 있는 데일리 볼. 한 손에 감기는 균형감으로 매일의 식탁에 어울립니다.",
      desc: ["소프트 지오메트리 볼은 직선과 곡선이 조용히 만나는 ‘Soft Geometry’ 패턴을 담았습니다. 깊이 있는 형태로 면 요리부터 샐러드까지 두루 쓰기 좋습니다.", "유약의 농담이 만들어내는 은은한 음영이 빛에 따라 다르게 보입니다."],
      meta: [["소재", "석기질 도자 (Stoneware)"], ["크기", "지름 16cm · 높이 7cm"], ["원산지", "대한민국 · 핸드메이드"], ["배송", "주문 후 2–4일 이내 출고"]],
      specs: [["소재", "석기질 도자 (Stoneware), 무연 유약"], ["크기", "S Ø 13cm / M Ø 16cm"], ["무게", "약 410g (M 기준)"], ["관리", "전자레인지 · 식기세척기 사용 가능"], ["구성", "볼 1P · 전용 패키지"]],
      related: ["rough-wave-plate", "ocean-mug", "ceramic-bloom-dish"]
    },
    {
      id: "ocean-mug", name: "Ocean Mug", kr: "오션 머그",
      price: 24000, category: "table", catLabel: "Object · Tableware", tag: "Daily",
      images: ["image/generated/products/ocean-mug-card.png", "image/generated/ceramic-object.webp", "image/generated/ocean-light.webp", "image/generated/pages/for-table-page.webp"],
      colors: [["Ocean Blue", "#7e9cc0"], ["Ivory", "#ece6da"]],
      sizes: ["300ml"],
      lead: "손에 감기는 두께감의 데일리 머그. 따뜻한 음료의 온기를 오래 머금습니다.",
      desc: ["오션 머그는 파도의 결을 손잡이까지 이어 빚은 데일리 머그입니다. 입술에 닿는 림을 얇게 마감해 마시는 감각이 부드럽습니다.", "두툼한 바디가 음료의 온도를 오래 지켜 줍니다."],
      meta: [["소재", "석기질 도자 (Stoneware)"], ["용량", "약 300ml"], ["원산지", "대한민국 · 핸드메이드"], ["배송", "주문 후 2–4일 이내 출고"]],
      specs: [["소재", "석기질 도자 (Stoneware), 무연 유약"], ["용량", "약 300ml"], ["무게", "약 320g"], ["관리", "전자레인지 · 식기세척기 사용 가능"], ["구성", "머그 1P · 전용 패키지"]],
      related: ["rough-wave-plate", "soft-geometry-bowl", "wave-tray"]
    },
    {
      id: "ceramic-bloom-dish", name: "Ceramic Bloom Dish", kr: "세라믹 블룸 디쉬",
      price: 32000, category: "table", catLabel: "Object · Tableware", tag: "Signature",
      images: ["image/generated/pages/ceramic-bloom-page.webp", "image/generated/ceramic-object.webp", "image/generated/tile-relief.webp", "image/generated/pages/for-table-page.webp"],
      colors: [["Ivory", "#ece6da"], ["Sand", "#cdbfa6"]],
      sizes: ["Ø 18cm"],
      lead: "피어나는 꽃결을 새긴 디쉬. 작은 안주나 디저트를 담아내기 좋은 깊이입니다.",
      desc: ["세라믹 블룸 디쉬는 ‘Ceramic Bloom’ 패턴의 부드러운 부조를 표면에 담았습니다. 빛을 받으면 결의 음영이 은은하게 살아납니다.", "차분한 아이보리 톤으로 어떤 식탁에도 자연스럽게 어울립니다."],
      meta: [["소재", "석기질 도자 (Stoneware)"], ["크기", "지름 18cm · 높이 3cm"], ["원산지", "대한민국 · 핸드메이드"], ["배송", "주문 후 2–4일 이내 출고"]],
      specs: [["소재", "석기질 도자 (Stoneware), 무연 유약"], ["크기", "Ø 18cm"], ["무게", "약 450g"], ["관리", "전자레인지 · 식기세척기 사용 가능"], ["구성", "디쉬 1P · 전용 패키지"]],
      related: ["soft-geometry-bowl", "rough-wave-plate", "blue-archive-vase"]
    },
    {
      id: "wave-tray", name: "Wave Tray", kr: "웨이브 트레이",
      price: 42000, category: "space", catLabel: "Object · For Space", tag: "Signature",
      images: ["image/generated/pages/for-space-page.webp", "image/generated/tile-relief.webp", "image/generated/ocean-light.webp", "image/generated/ceramic-object.webp"],
      colors: [["Sand", "#cdbfa6"], ["Ocean Blue", "#7e9cc0"]],
      sizes: ["28 × 18cm"],
      lead: "작은 소품을 받치는 표면 오브제. 현관과 책상 위 작은 풍경을 정돈합니다.",
      desc: ["웨이브 트레이는 파도의 결을 넓은 면으로 펼친 표면 오브제입니다. 열쇠나 향초, 주얼리 같은 작은 물건을 모아 두기 좋습니다.", "단단한 무게감으로 공간의 중심을 잡아 줍니다."],
      meta: [["소재", "석기질 도자 (Stoneware)"], ["크기", "28 × 18 × 2.5cm"], ["원산지", "대한민국 · 핸드메이드"], ["배송", "주문 후 2–4일 이내 출고"]],
      specs: [["소재", "석기질 도자 (Stoneware), 무연 유약"], ["크기", "28 × 18 × 2.5cm"], ["무게", "약 780g"], ["관리", "마른 천으로 닦아 관리"], ["구성", "트레이 1P · 전용 패키지"]],
      related: ["rough-wave-plate", "blue-archive-vase", "ocean-mug"]
    },
    {
      id: "blue-archive-vase", name: "Blue Archive Vase", kr: "블루 아카이브 베이스",
      price: 54000, category: "space", catLabel: "Object · For Space", tag: "Signature",
      images: ["image/generated/pages/blue-archive-page.webp", "image/generated/ceramic-object.webp", "image/generated/pages/for-space-page.webp", "image/generated/ocean-light.webp"],
      colors: [["Ocean Blue", "#7e9cc0"], ["Ivory", "#ece6da"]],
      sizes: ["H 22cm"],
      lead: "푸른 톤을 차곡차곡 쌓은 아카이브 베이스. 한 줄기 가지만으로도 공간이 완성됩니다.",
      desc: ["블루 아카이브 베이스는 겹겹의 블루를 쌓아 올린 ‘Blue Archive’ 패턴을 입체로 옮겼습니다. 마른 가지 한 줄, 작은 들꽃 한 송이에도 잘 어울립니다.", "묵직한 바닥이 안정감을 더해 줍니다."],
      meta: [["소재", "석기질 도자 (Stoneware)"], ["크기", "지름 12cm · 높이 22cm"], ["원산지", "대한민국 · 핸드메이드"], ["배송", "주문 후 2–4일 이내 출고"]],
      specs: [["소재", "석기질 도자 (Stoneware), 무연 유약"], ["크기", "Ø 12 × H 22cm"], ["무게", "약 1,050g"], ["관리", "마른 천으로 닦아 관리"], ["구성", "베이스 1P · 전용 패키지"]],
      related: ["wave-tray", "ceramic-bloom-dish", "rough-wave-plate"]
    },
    {
      id: "tidal-bath-mat", name: "Tidal Bath Mat", kr: "타이달 배스 매트",
      price: 45000, category: "bath", catLabel: "Object · For Bath", tag: "Bath",
      images: ["image/generated/pages/for-bath-page.webp", "image/generated/fabric-wave.webp", "image/generated/ocean-light.webp", "image/generated/tile-relief.webp"],
      colors: [["Ivory", "#ece6da"], ["Ocean Blue", "#7e9cc0"]],
      sizes: ["50 × 70cm"],
      lead: "물기를 머금는 규조토 배스 매트. 고요한 욕실의 순간을 정돈합니다.",
      desc: ["타이달 배스 매트는 파도의 결을 표면에 새긴 규조토 매트입니다. 물기를 빠르게 흡수해 욕실을 보송하게 유지합니다.", "은은한 패턴이 욕실에 차분한 리듬을 더합니다."],
      meta: [["소재", "규조토 (Diatomite)"], ["크기", "50 × 70 × 0.9cm"], ["원산지", "대한민국"], ["배송", "주문 후 2–4일 이내 출고"]],
      specs: [["소재", "규조토 (Diatomite)"], ["크기", "50 × 70 × 0.9cm"], ["무게", "약 2,400g"], ["관리", "직사광선 건조 · 사포로 표면 관리"], ["구성", "매트 1P"]],
      related: ["wave-linen-napkin", "rough-wave-plate", "wave-tray"]
    },
    {
      id: "wave-linen-napkin", name: "Wave Linen Napkin", kr: "웨이브 리넨 냅킨",
      price: 18000, category: "fabric", catLabel: "Object · For Fabric", tag: "Fabric",
      images: ["image/generated/pages/for-fabric-page.webp", "image/generated/fabric-wave.webp", "image/generated/tile-relief.webp", "image/generated/ocean-light.webp"],
      colors: [["Ocean Blue", "#7e9cc0"], ["Ivory", "#ece6da"], ["Sand", "#cdbfa6"]],
      sizes: ["45 × 45cm"],
      lead: "천 위로 번지는 부드러운 리듬. 한 장으로 식탁의 분위기를 바꿉니다.",
      desc: ["웨이브 리넨 냅킨은 파도의 결을 직조로 풀어낸 100% 리넨 냅킨입니다. 쓸수록 부드러워지는 결이 매력입니다.", "냅킨, 작은 러너, 감싸개로 두루 쓰기 좋습니다."],
      meta: [["소재", "리넨 100%"], ["크기", "45 × 45cm"], ["원산지", "대한민국"], ["배송", "주문 후 2–4일 이내 출고"]],
      specs: [["소재", "리넨 100%"], ["크기", "45 × 45cm"], ["무게", "약 60g"], ["관리", "찬물 손세탁 · 그늘 건조 권장"], ["구성", "냅킨 1P"]],
      related: ["tidal-bath-mat", "ocean-mug", "soft-geometry-bowl"]
    }
  ];
  function findProduct(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; }
  function productToItem(p) { return { id: p.id, name: p.name, kr: p.kr, price: p.price, img: p.images[0], href: "product-detail.html?id=" + p.id }; }
  /* resolve a thumbnail for a cart line: stored img, else look up by product id */
  function itemImg(it) {
    if (it && it.img) return it.img;
    var p = it && it.id ? findProduct(it.id) : null;
    return p ? p.images[0] : "";
  }
  function getParam(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }

  var ICONS = {
    search:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    account:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/></svg>',
    cart:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h13l-1.2 9.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    menu:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    instagram:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    youtube:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="6" width="19" height="12" rx="3.5"/><path d="M10.5 9.2l4.2 2.8-4.2 2.8z" fill="currentColor" stroke="none"/></svg>',
    pinterest:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7.5c-2 0-3.5 1.5-3.5 3.4 0 .9.4 1.9 1.3 2.2.1 0 .2 0 .2-.1.1-.2.2-.6.2-.8 0-.1 0-.2-.1-.3-.3-.3-.4-.7-.4-1.1 0-1.4 1-2.6 2.6-2.6 1.4 0 2.2.9 2.2 2.1 0 1.5-.7 2.8-1.7 2.8-.5 0-.9-.4-.8-1 .1-.6.4-1.3.4-1.8 0-.4-.2-.8-.7-.8-.6 0-1 .6-1 1.3 0 .5.1.8.1.8s-.6 2.4-.7 2.8c-.2.9 0 1.9.1 2 .1 0 .1.1.2 0 .7-.9 1-1.8 1.1-2.2 0-.1.3-1.1.3-1.1.3.5.9.8 1.6.8 2.1 0 3.4-1.9 3.4-4.1 0-1.8-1.5-3.3-3.7-3.3z" fill="currentColor" stroke="none"/></svg>'
  };

  var SNS = [
    { name: "Instagram", icon: ICONS.instagram, href: "#" },
    { name: "YouTube", icon: ICONS.youtube, href: "#" },
    { name: "Pinterest", icon: ICONS.pinterest, href: "#" }
  ];

  /* home card decks — single source of truth for the hardcoded-in-HTML cards.
     renderHomeCards() builds the markup; wireHomeInteractions() links by the same order. */
  var HOME_PATTERNS = [
    { img: "image/sec01_2.png", title: "Ocean Rhythm", sub: "바다의 울림", href: "rough-wave.html" },
    { img: "image/sec01_3.png", title: "Ceramic Bloom", sub: "클래식과 부드러움", href: "ceramic-bloom.html" },
    { img: "image/sec01_4.png", title: "Blue Repeat", sub: "일상 속 블루", href: "blue-archive.html" },
    { img: "image/sec01_5.png", title: "Soft Geometry", sub: "조화와 균형", href: "soft-geometry.html" }
  ];
  var HOME_COLLECTIONS = [
    { img: "image/sec03_1.webp", title: "Soft Living", sub: "Quiet textures for rest", href: "for-fabric.html" },
    { img: "image/sec03_2.webp", title: "Daily Craft", sub: "Beauty in rituals", href: "for-table.html" },
    { img: "image/sec03_3.webp", title: "Comfort Objects", sub: "Objects for calm moments", href: "for-space.html" }
  ];

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "class") n.className = attrs[k];
        else n.setAttribute(k, attrs[k]);
      }
    }
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()); }
  function deriveName(email) { return String(email).split("@")[0] || "Member"; }
  function pad(n) { return String(n).padStart(2, "0"); }
  function won(n) { return "₩" + n.toLocaleString("ko-KR"); }

  var toastTimer;
  function toast(msg) {
    var t = document.querySelector(".cr-toast");
    if (!t) { t = el("div", { class: "cr-toast" }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2800);
  }

  /* generic popover positioner + outside-click close */
  function attachPopover(panel, anchorBtn) {
    function place() {
      var r = anchorBtn.getBoundingClientRect();
      var panelWidth = panel.offsetWidth || 248;
      var left = r.left + (r.width / 2) - (panelWidth / 2);
      panel.style.top = r.bottom + 12 + "px";
      panel.style.left = Math.max(16, Math.min(left, window.innerWidth - panelWidth - 16)) + "px";
      panel.style.right = "auto";
    }
    anchorBtn._place = place;
    document.addEventListener("click", function (e) {
      if (panel.classList.contains("open") && !panel.contains(e.target) && !anchorBtn.contains(e.target)) {
        panel.classList.remove("open");
      }
    });
    window.addEventListener("resize", function () {
      if (panel.classList.contains("open")) place();
    });
  }
  function togglePopover(panel, anchorBtn) {
    if (!panel) return;
    if (panel.classList.contains("open")) {
      panel.classList.remove("open");
    } else {
      document.querySelectorAll(".cr-popover.open").forEach(function (p) { p.classList.remove("open"); });
      if (anchorBtn._place) anchorBtn._place();
      panel.classList.add("open");
    }
  }

  /* ---------- focus trap (모달·드로어·검색 오버레이 공용) ---------- */
  var _focusTrap = null;
  function focusablesIn(root) {
    return Array.prototype.slice.call(root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (n) { return n.offsetWidth || n.offsetHeight || n === document.activeElement; });
  }
  function trapFocus(root) {
    if (!root) return;
    releaseFocusTrap();
    var prev = document.activeElement;
    function onKey(e) {
      if (e.key !== "Tab") return;
      var f = focusablesIn(root);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    _focusTrap = { root: root, onKey: onKey, prev: prev };
  }
  function releaseFocusTrap(root) {
    if (!_focusTrap) return;
    if (root && _focusTrap.root !== root) return;
    document.removeEventListener("keydown", _focusTrap.onKey, true);
    var prev = _focusTrap.prev;
    _focusTrap = null;
    if (prev && prev.focus) { try { prev.focus(); } catch (e) {} }
  }

  /* ============================================================ HEADER
     전역 내비게이션 단일 소스. 모든 페이지의 .gnb 는 이 데이터로 렌더되므로
     HTML 에 하드코딩된 메뉴/활성표시를 손댈 필요가 없다. */
  var SITE_NAV = [
    { label: "About", href: "about.html", sub: [["design-mood.html", "Design Mood"], ["craft.html", "Craft"], ["archive.html", "Archive"]] },
    { label: "Pattern", href: "pattern.html", sub: [["rough-wave.html", "Rough Wave"], ["soft-geometry.html", "Soft Geometry"], ["ceramic-bloom.html", "Ceramic Bloom"], ["blue-archive.html", "Blue Archive"]] },
    { label: "Object", href: "object.html", sub: [["for-table.html", "For Table"], ["for-bath.html", "For Bath"], ["for-fabric.html", "For Fabric"], ["for-space.html", "For Space"]] },
    { label: "Service", href: "contact.html", sub: [["size-guide.html", "Size Guide"], ["care-service.html", "Care Service"], ["stockist.html", "Stockist"], ["inquiry.html", "Inquiry"]] }
  ];
  function currentPage() { return (location.pathname.split("/").pop() || "index.html").toLowerCase(); }
  /* 현재 페이지가 속한 최상위 섹션을 데이터에서 계산해 active 표시 (파일별 하드코딩 대체) */
  function navGnbHTML() {
    var here = currentPage();
    return SITE_NAV.map(function (item) {
      var active = item.href === here || item.sub.some(function (s) { return s[0] === here; });
      var sub = '<ul class="sub">' + item.sub.map(function (s) {
        return '<li><a href="' + s[0] + '">' + esc(s[1]) + "</a></li>";
      }).join("") + "</ul>";
      return '<li><a class="' + (active ? "active-main" : "") + '" href="' + item.href + '">' + esc(item.label) + "</a>" + sub + "</li>";
    }).join("");
  }

  function buildHeader() {
    var nav = document.querySelector("#header nav");
    if (!nav) return;
    var gnb = nav.querySelector(".gnb");
    if (!gnb) return;

    var user = AUTH.get();

    // 내비게이션은 SITE_NAV 를 단일 소스로 렌더한다. (Login 은 아이콘, Service 는 구매 전후 안내 묶음)
    gnb.innerHTML = navGnbHTML();

    var right = el("div", { class: "nav-right" });
    nav.insertBefore(right, gnb);
    right.appendChild(gnb);

    var actions = el("div", { class: "nav-actions" });

    var searchBtn = el("button", { class: "nav-ic nav-search", type: "button", "aria-label": "검색" }, ICONS.search);
    var acctBtn = el(
      "button",
      { class: "nav-ic nav-account" + (user ? " is-member" : ""), type: "button", "aria-label": user ? "내 계정" : "로그인" },
      ICONS.account
    );
    var burger = el(
      "button",
      { class: "nav-ic nav-burger", type: "button", "aria-label": "메뉴 열기", "aria-expanded": "false" },
      ICONS.menu
    );

    actions.appendChild(searchBtn);
    actions.appendChild(acctBtn);

    // Keep cart visible for the portfolio commerce flow, including guest users.
    var cartBtn = el(
      "button",
      { class: "nav-ic nav-cart", type: "button", "aria-label": "장바구니" },
      ICONS.cart + '<span class="cart-count">' + CART.totalQty() + "</span>"
    );
    actions.appendChild(cartBtn);

    actions.appendChild(burger);
    right.appendChild(actions);

    searchBtn.addEventListener("click", openSearch);
    burger.addEventListener("click", openDrawer);

    if (cartBtn) {
      buildCartPanel(cartBtn, user);
      cartBtn.addEventListener("click", function () { togglePopover(document.querySelector(".cart-panel"), cartBtn); });
    }

    if (user) {
      var acctPanel = buildAccountPanel(acctBtn, user);
      acctBtn.addEventListener("click", function () { togglePopover(acctPanel, acctBtn); });
    } else {
      acctBtn.addEventListener("click", function () { location.href = "login.html"; });
    }
  }

  function normalizeServiceShell() {
    if (!document.body.matches(".page-contact, .page-size-guide, .page-care-service, .page-stockist, .page-inquiry")) return;
    var heroTitle = document.querySelector(".sub-hero h1");
    var heroSubtitle = document.querySelector(".sub-hero .hero-subtitle");
    if (heroTitle) heroTitle.textContent = "Service";
    if (heroSubtitle) heroSubtitle.textContent = "Product & Customer Care";

    var tabs = document.querySelector(".sub-tabs");
    if (!tabs) return;
    var path = (location.pathname.split("/").pop() || "contact.html").toLowerCase();
    var items = [
      ["contact.html", "Service"],
      ["size-guide.html", "Size Guide"],
      ["care-service.html", "Care Service"],
      ["stockist.html", "Stockist"],
      ["inquiry.html", "Inquiry"]
    ];
    tabs.setAttribute("aria-label", "Service submenu");
    tabs.innerHTML = items.map(function (item) {
      return '<a' + (path === item[0] ? ' class="active"' : '') + ' href="' + item[0] + '">' + item[1] + '</a>';
    }).join("");
  }

  /* ---------- account popover (logged-in) ---------- */
  function buildAccountPanel(anchorBtn, user) {
    var links = ACCT_LINKS.map(function (p) {
      return '<li><a href="' + p[0] + '">' + esc(p[1]) + "</a></li>";
    }).join("");
    var panel = el(
      "div",
      { class: "cr-popover acct-panel", role: "dialog", "aria-label": "내 계정" },
      '<div class="acct-head"><strong>' + esc(user.name) + "님</strong><span>" + esc(user.email) + "</span></div>" +
        '<ul class="acct-links">' + links + "</ul>" +
        '<button type="button" class="acct-logout" data-action="logout">로그아웃</button>'
    );
    document.body.appendChild(panel);
    attachPopover(panel, anchorBtn);
    return panel;
  }

  /* ---------- cart panel ---------- */
  function cartPanelHTML(user) {
    var items = CART.get();
    if (!items.length) {
      return '<p class="cart-empty">장바구니가 비어 있어요.</p>' +
        '<a class="cart-cta" href="object.html">오브제 둘러보기 &rsaquo;</a>';
    }
    var shown = items.slice(0, 3);
    var rows = shown.map(function (it, idx) {
      var href = it.id ? "product-detail.html?id=" + it.id : "product-detail.html";
      var im = itemImg(it);
      var thumb = '<span class="cart-thumb"' + (im ? ' style="background-image:url(' + esc(im) + ')"' : '') + '></span>';
      var qty = it.qty || 1;
      return (
        '<div class="cart-item">' +
          '<a class="cart-item-link" href="' + href + '">' + thumb +
          '<span class="cart-meta"><span class="cart-name">' + esc(it.name) + "</span>" +
          '<span class="cart-sub">' + esc(it.meta || "기본 옵션") + "</span></span></a>" +
          '<div class="cart-item-ctrl">' +
            '<div class="cart-qty" role="group" aria-label="수량">' +
              '<button type="button" class="cart-qty-btn" data-cart-q="-1" data-idx="' + idx + '" aria-label="수량 줄이기"' + (qty <= 1 ? " disabled" : "") + ">&minus;</button>" +
              '<span class="cart-qty-val">' + qty + "</span>" +
              '<button type="button" class="cart-qty-btn" data-cart-q="1" data-idx="' + idx + '" aria-label="수량 늘리기">&plus;</button>' +
            "</div>" +
            '<span class="cart-price">' + won(it.price) + "</span>" +
            '<button type="button" class="cart-remove" data-cart-remove data-idx="' + idx + '" aria-label="' + esc(it.name) + ' 삭제">삭제</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
    var more = items.length > shown.length
      ? '<p class="cart-more">외 ' + (items.length - shown.length) + "개가 더 담겨 있어요.</p>"
      : "";
    return '<div class="cart-list">' + rows + "</div>" + more +
      '<div class="cart-foot"><span>상품 합계</span><strong>' + won(CART.totalPrice()) + "</strong></div>" +
      '<a class="cart-cta" href="cart.html">장바구니 보기 &rsaquo;</a>';
  }
  function buildCartPanel(anchorBtn, user) {
    var panel = el("div", { class: "cr-popover cart-panel", role: "dialog", "aria-label": "장바구니" }, cartPanelHTML(user));
    document.body.appendChild(panel);
    attachPopover(panel, anchorBtn);
    cartPanelEl = panel;
    /* delegated so it survives cartPanelHTML re-renders in refreshCartUI */
    panel.addEventListener("click", function (e) {
      var step = e.target.closest("[data-cart-q]");
      if (step) {
        e.preventDefault();
        var qi = parseInt(step.getAttribute("data-idx"), 10);
        var cur = (CART.get()[qi] || {}).qty || 1;
        CART.setQtyAt(qi, Math.max(1, Math.min(99, cur + (parseInt(step.getAttribute("data-cart-q"), 10) || 0))));
        refreshCartUI();
        return;
      }
      var rm = e.target.closest("[data-cart-remove]");
      if (rm) {
        e.preventDefault();
        CART.removeAt(parseInt(rm.getAttribute("data-idx"), 10));
        refreshCartUI();
        toast("장바구니에서 삭제했어요.");
      }
    });
    return panel;
  }
  /* keep header badge + open panel in sync after a cart change */
  function refreshCartUI() {
    var badge = document.querySelector(".nav-cart .cart-count");
    if (badge) badge.textContent = CART.totalQty();
    if (cartPanelEl) cartPanelEl.innerHTML = cartPanelHTML(AUTH.get());
  }

  /* ---------- search overlay ---------- */
  function buildSearchOverlay() {
    var ov = el(
      "div",
      { class: "search-overlay", role: "dialog", "aria-label": "검색" },
      '<form class="search-box">' +
        '<svg class="search-box-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
        '<input type="search" placeholder="찾으시는 패턴이나 오브제를 검색해보세요" aria-label="검색어">' +
        '<button type="button" class="search-close" aria-label="닫기">' + ICONS.close + "</button>" +
        "</form>" +
        '<div class="search-results" aria-live="polite"></div>' +
        '<p class="search-hint">예: Rough Wave · Soft Geometry · For Table</p>'
    );
    document.body.appendChild(ov);
    var form = ov.querySelector(".search-box");
    var input = ov.querySelector("input");
    var results = ov.querySelector(".search-results");
    function update() { renderSearchResults(input.value, results); }
    ov.querySelector(".search-close").addEventListener("click", closeSearch);
    ov.addEventListener("click", function (e) { if (e.target === ov) closeSearch(); });
    input.addEventListener("input", update);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) { input.focus(); return; }
      update();
    });
    results.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (a) closeSearch();
    });
    renderSearchResults("", results);
  }
  function searchItems() {
    var productItems = PRODUCTS.map(function (p) {
      return {
        title: p.name,
        sub: p.kr + " · " + p.catLabel,
        href: "product-detail.html?id=" + p.id,
        img: p.images[0],
        hay: [p.name, p.kr, p.catLabel, p.tag, p.lead, p.category].join(" ")
      };
    });
    return productItems.concat([
      { title: "Rough Wave", sub: "Pattern", href: "rough-wave.html", hay: "rough wave pattern 파도" },
      { title: "Soft Geometry", sub: "Pattern", href: "soft-geometry.html", hay: "soft geometry pattern 기하" },
      { title: "Ceramic Bloom", sub: "Pattern", href: "ceramic-bloom.html", hay: "ceramic bloom pattern 세라믹" },
      { title: "Blue Archive", sub: "Pattern", href: "blue-archive.html", hay: "blue archive pattern 블루" },
      { title: "For Table", sub: "Object Collection", href: "for-table.html", hay: "for table tableware object" },
      { title: "For Space", sub: "Object Collection", href: "for-space.html", hay: "for space object tray vase" }
    ]);
  }
  function renderSearchResults(value, root) {
    if (!root) return;
    var q = String(value || "").trim().toLowerCase();
    var items = searchItems();
    var matches = q ? items.filter(function (it) {
      return it.hay.toLowerCase().indexOf(q) > -1 || it.title.toLowerCase().indexOf(q) > -1 || it.sub.toLowerCase().indexOf(q) > -1;
    }).slice(0, 6) : items.slice(0, 4);
    if (!matches.length) {
      root.innerHTML = '<div class="search-empty">검색 결과가 없습니다.</div>';
      return;
    }
    root.innerHTML = matches.map(function (it) {
      var media = it.img ? '<span class="search-result-img" style="background-image:url(' + esc(it.img) + ')"></span>' : '<span class="search-result-img is-pattern"></span>';
      return '<a class="search-result" href="' + esc(it.href) + '">' + media +
        '<span><b>' + esc(it.title) + '</b><small>' + esc(it.sub) + '</small></span></a>';
    }).join("");
  }
  function openSearch(initialValue) {
    var ov = document.querySelector(".search-overlay");
    if (!ov) return;
    ov.classList.add("open");
    document.body.classList.add("no-scroll");
    trapFocus(ov);
    setTimeout(function () {
      var i = ov.querySelector("input");
      if (!i) return;
      if (typeof initialValue === "string" && initialValue) {
        i.value = initialValue;
        renderSearchResults(initialValue, ov.querySelector(".search-results"));
      }
      i.focus();
    }, 120);
  }
  function closeSearch() {
    var ov = document.querySelector(".search-overlay");
    if (!ov) return;
    releaseFocusTrap(ov);
    ov.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }

  /* ---------- mobile drawer ---------- */
  function buildDrawer() {
    var gnb = document.querySelector("#header nav .gnb");
    if (!gnb) return;
    var user = AUTH.get();

    var backdrop = el("div", { class: "drawer-backdrop" });
    var drawer = el("aside", { class: "drawer", "aria-hidden": "true", "aria-label": "메뉴" });

    var head = el("div", { class: "drawer-head" }, '<span class="drawer-title">Menu</span>');
    var closeBtn = el("button", { class: "drawer-close", type: "button", "aria-label": "메뉴 닫기" }, ICONS.close);
    head.appendChild(closeBtn);
    drawer.appendChild(head);

    if (user) {
      var greeting = el("div", { class: "drawer-greeting" });
      greeting.appendChild(
        el("a", { class: "drawer-greeting-copy", href: "my-account.html" },
          "<strong>" + esc(user.name) + "님</strong><span>" + esc(user.email) + "</span>")
      );
      greeting.appendChild(el("button", { class: "drawer-logout", type: "button", "data-action": "logout" }, "로그아웃"));
      drawer.appendChild(greeting);
    } else {
      drawer.appendChild(el("a", { class: "drawer-login", href: "login.html" }, "로그인 · 회원가입"));
    }

    var list = el("ul", { class: "drawer-nav" });
    gnb.querySelectorAll(":scope > li").forEach(function (li) {
      var topLink = li.querySelector(":scope > a");
      var sub = li.querySelector(":scope > .sub");
      var item = el("li", { class: "drawer-item" });
      if (sub) {
        var row = el("div", { class: "drawer-row" });
        row.appendChild(el("a", { href: topLink.getAttribute("href"), class: "drawer-top" }, topLink.textContent));
        var tog = el(
          "button",
          { class: "drawer-toggle", type: "button", "aria-label": "하위메뉴", "aria-expanded": "false" },
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
        );
        row.appendChild(tog);
        item.appendChild(row);
        var subUl = el("ul", { class: "drawer-sub" });
        sub.querySelectorAll("a").forEach(function (sa) {
          var sli = el("li");
          sli.appendChild(el("a", { href: sa.getAttribute("href") }, sa.textContent));
          subUl.appendChild(sli);
        });
        item.appendChild(subUl);
        tog.addEventListener("click", function () {
          var open = item.classList.toggle("open");
          tog.setAttribute("aria-expanded", open ? "true" : "false");
        });
      } else {
        item.appendChild(el("a", { href: topLink.getAttribute("href"), class: "drawer-top" }, topLink.textContent));
      }
      list.appendChild(item);
    });
    drawer.appendChild(list);

    if (user) {
      var acct = el("div", { class: "drawer-account" });
      ACCT_LINKS.forEach(function (p) { acct.appendChild(el("a", { href: p[0] }, p[1])); });
      drawer.appendChild(acct);
    }

    var ds = el("form", { class: "drawer-search" }, '<input type="search" placeholder="검색" aria-label="검색어">');
    ds.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = ds.querySelector("input").value.trim();
      closeDrawer();
      if (v) { openSearch(v); }
    });
    drawer.appendChild(ds);

    var sns = el("div", { class: "drawer-sns" });
    SNS.forEach(function (s) {
      sns.appendChild(el("a", { href: s.href, "aria-label": s.name, target: "_blank", rel: "noopener", "data-demo": "sns" }, s.icon));
    });
    drawer.appendChild(sns);

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    closeBtn.addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);
    drawer.querySelectorAll('.drawer-sub a, .drawer-item > .drawer-top, .drawer-account a, .drawer-login, .drawer-greeting-copy').forEach(function (a) {
      a.addEventListener("click", function () { closeDrawer(); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeDrawer(); closeSearch(); }
    });
  }
  function openDrawer() {
    var d = document.querySelector(".drawer");
    d.classList.add("open");
    document.querySelector(".drawer-backdrop").classList.add("open");
    document.body.classList.add("no-scroll");
    var b = document.querySelector(".nav-burger");
    if (b) b.setAttribute("aria-expanded", "true");
    d.setAttribute("aria-hidden", "false");
    trapFocus(d);
    var close = d.querySelector(".drawer-close");
    if (close) close.focus();
  }
  function closeDrawer() {
    var d = document.querySelector(".drawer");
    if (!d) return;
    releaseFocusTrap(d);
    d.classList.remove("open");
    d.setAttribute("aria-hidden", "true");
    document.querySelector(".drawer-backdrop").classList.remove("open");
    document.body.classList.remove("no-scroll");
    var b = document.querySelector(".nav-burger");
    if (b) b.setAttribute("aria-expanded", "false");
  }

  /* ---------- logout ---------- */
  function wireLogout() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest('[data-action="logout"]');
      if (!t) return;
      e.preventDefault();
      AUTH.clear();
      toast("로그아웃되었어요.");
      setTimeout(function () { location.href = "index.html"; }, 600);
    });
  }

  /* ---------- auth forms (login.html) ---------- */
  function wireAuthForms() {
    var panel = document.querySelector(".login-form-panel");
    if (!panel) return;
    var tabs = panel.querySelectorAll(".auth-tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (x) { x.classList.remove("active"); });
        tab.classList.add("active");
        panel.querySelectorAll(".auth-form").forEach(function (f) {
          f.hidden = f.getAttribute("data-auth-form") !== tab.dataset.target;
        });
      });
    });
    wireAuthForm(panel.querySelector('[data-auth-form="login"]'), "login");
    wireAuthForm(panel.querySelector('[data-auth-form="signup"]'), "signup");
    panel.querySelectorAll(".auth-form .auth-social").forEach(function (b) {
      b.addEventListener("click", function () {
        var provider = b.textContent.replace("Continue with", "").trim() || "소셜";
        toast(provider + " 로그인 연결을 확인할 수 없습니다.");
      });
    });
  }
  function wireAuthForm(form, kind) {
    if (!form) return;
    form.setAttribute("novalidate", "novalidate");
    var clicks = 0, timer;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var inputs = Array.prototype.slice.call(form.querySelectorAll("input"));
      var filled = inputs.every(function (i) { return i.value.trim() !== ""; });
      if (!filled) {
        clicks++;
        clearTimeout(timer);
        timer = setTimeout(function () { clicks = 0; }, 2000);
        if (clicks >= 5) {
          autofill(form, kind);
          clicks = 0;
          toast("로그인 정보를 자동 입력했어요. 한 번 더 누르면 진행됩니다.");
        } else {
          toast((kind === "login" ? "로그인" : "회원가입") + " 정보를 입력해주세요.");
        }
        return;
      }
      var emailInput = form.querySelector('input[type="email"]');
      var email = emailInput ? emailInput.value.trim() : "";
      if (!isEmail(email)) { toast("올바른 이메일 주소를 입력해주세요."); if (emailInput) emailInput.focus(); return; }
      var nameInput = form.querySelector('input[name="name"]');
      var name = kind === "signup" && nameInput && nameInput.value.trim() ? nameInput.value.trim() : deriveName(email);
      AUTH.set({ name: name, email: email });
      toast(name + "님, 환영합니다.");
      var dest = "index.html";
      try {
        var back = sessionStorage.getItem("cresto_after_login");
        if (back) { dest = back; sessionStorage.removeItem("cresto_after_login"); }
      } catch (e) {}
      setTimeout(function () { location.href = dest; }, 750);
    });
  }
  function autofill(form, kind) {
    var data = kind === "login" ? DEMO_LOGIN : DEMO_SIGNUP;
    form.querySelectorAll("input").forEach(function (i) {
      var type = (i.getAttribute("type") || "text").toLowerCase();
      var nm = i.getAttribute("name");
      if (type === "email") i.value = data.email;
      else if (type === "password") i.value = data.password;
      else if (nm === "name" || type === "text") i.value = data.name || "";
    });
  }

  /* ---------- newsletter / footer / contact ---------- */
  function buildNewsletter() {
    var form = document.querySelector(".join-form");
    if (!form) return;
    form.setAttribute("novalidate", "novalidate");
    var input = form.querySelector('input[type="email"], input');
    function submitJoin() {
      var v = (input && input.value) || "";
      if (!isEmail(v)) { toast("이메일 주소를 입력해주세요."); if (input) input.focus(); return; }
      form.innerHTML = '<p class="join-done">구독 신청이 완료되었어요.<br>새 컬렉션 소식을 가장 먼저 전해드릴게요.</p>';
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); submitJoin(); });
    var btn = form.querySelector("button");
    if (btn) btn.addEventListener("click", function (e) { e.preventDefault(); submitJoin(); });
  }
  /* 전역 푸터 단일 소스. 모든 페이지의 <footer> 는 이 마크업으로 렌더된다. */
  var FOOTER_HTML =
    '<div class="footer-inner">' +
      '<div class="footer-brand">' +
        '<img class="footer-logo" src="image/footer_logo.png" alt="Cresto">' +
        '<p>Born from the broken.<br>Patterns inspired by movement.</p>' +
        '<p class="copyright">© 2026 CRESTO. All rights reserved.</p>' +
      '</div>' +
      '<div class="footer-col"><h4>shop</h4><ul>' +
        '<li><a href="rough-wave.html">a rough wave</a></li>' +
        '<li><a href="object.html">object collection</a></li>' +
      '</ul></div>' +
      '<div class="footer-col"><h4>service</h4><ul>' +
        '<li><a href="size-guide.html">size guide</a></li>' +
        '<li><a href="care-service.html">care service</a></li>' +
        '<li><a href="my-account.html">my account</a></li>' +
      '</ul></div>' +
      '<div class="footer-col footer-info"><h4>information</h4><ul>' +
        '<li>tel : 012 · 3456 · 7890</li>' +
        '<li>email : hello@cresto.com</li>' +
        '<li>address : 경기도 성남시 분당구 판교로 123</li>' +
      '</ul></div>' +
    '</div>';
  function renderFooter() {
    var footer = document.querySelector("footer");
    if (!footer) return;
    footer.innerHTML = FOOTER_HTML;
  }
  function buildFooterSNS() {
    var brand = document.querySelector("footer .footer-brand");
    if (!brand || brand.querySelector(".footer-sns")) return;
    var sns = el("div", { class: "footer-sns" });
    SNS.forEach(function (s) {
      sns.appendChild(el("a", { href: s.href, "aria-label": s.name, "data-demo": "sns" }, s.icon));
    });
    brand.appendChild(sns);
  }
  function wireContactForms() {
    document.querySelectorAll(".contact-form-panel form").forEach(function (form) {
      form.setAttribute("novalidate", "novalidate");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var inputs = Array.prototype.slice.call(form.querySelectorAll("input, textarea"));
        var filled = inputs.every(function (i) { return i.value.trim() !== ""; });
        var email = form.querySelector('input[type="email"]');
        if (!filled) { toast("문의 정보를 모두 입력해주세요."); return; }
        if (email && !isEmail(email.value)) { toast("올바른 이메일 주소를 입력해주세요."); email.focus(); return; }
        var panel = form.closest(".contact-form-panel");
        if (panel) panel.innerHTML = '<p class="form-done">메시지가 접수되었어요.<br>빠른 시일 내에 회신드릴게요.</p>';
      });
    });
  }

  /* 회원 전용 페이지(body.requires-login)는 비로그인 시 로그인으로 보낸다.
     돌아올 위치를 기억해 로그인 후 복귀시키고, 안내는 showPendingNotice로 띄운다. */
  function guardMemberPages() {
    if (!document.body.classList.contains("requires-login")) return false;
    if (AUTH.get()) return false;
    try {
      sessionStorage.setItem("cresto_after_login", location.pathname.split("/").pop() + location.search);
      sessionStorage.setItem("cresto_login_notice", "로그인이 필요한 페이지예요.");
    } catch (e) {}
    location.replace("login.html"); // replace: 가드된 페이지를 히스토리에 안 남겨 뒤로가기 루프 방지
    return true;
  }
  function showPendingNotice() {
    try {
      var msg = sessionStorage.getItem("cresto_login_notice");
      if (msg) { sessionStorage.removeItem("cresto_login_notice"); toast(msg); }
    } catch (e) {}
  }

  /* ---------- reveal ---------- */
  function setupReveal() {
    var els = document.querySelectorAll(".section01 > h3, .sec01-main, .sec01-card, .section02 .sec02-left, .circle-item, .section03 > h3, .col-card, .join-wave, .catalog-card, .shop-card, .method-card, .mood-principle");
    els.forEach(function (node, i) {
      node.classList.add("reveal");
      node.style.setProperty("--reveal-delay", Math.min(i % 6, 5) * 70 + "ms");
    });
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (node) { node.classList.add("reveal-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("reveal-in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (node) { io.observe(node); });
  }

  /* ---------- product detail / listing ---------- */
  var currentProduct = null;
  function productCardHTML(p) {
    return '<article class="shop-card" data-id="' + p.id + '">' +
      '<a class="shop-card-media" href="product-detail.html?id=' + p.id + '" style="background-image:url(' + esc(p.images[0]) + ')">' +
      '<span class="shop-card-badge">' + esc(p.tag || "Object") + '</span></a>' +
      '<div class="shop-card-body">' +
      '<a class="shop-card-title" href="product-detail.html?id=' + p.id + '"><h4>' + esc(p.name) + '</h4></a>' +
      '<span class="shop-card-kr">' + esc(p.kr) + '</span>' +
      '<p class="shop-card-desc">' + esc(p.lead || "").slice(0, 72) + '...</p>' +
      '<span class="shop-card-price">' + won(p.price) + '</span>' +
      '</div>' +
      '<div class="shop-card-actions">' +
      '<a class="btn-line sm" href="product-detail.html?id=' + p.id + '">상세 보기</a>' +
      '<button type="button" class="btn-fill sm" data-quick-add data-id="' + p.id + '">담기</button>' +
      '</div>' +
      '</article>';
  }
  function productInfoHTML(p) {
    var swatches = p.colors.map(function (c, i) {
      return '<label class="swatch' + (i === 0 ? ' is-active' : '') + '"><input type="radio" name="opt-color" value="' + esc(c[0]) + '"' + (i === 0 ? ' checked' : '') + '><span class="swatch-dot" style="--sw:' + c[1] + '" title="' + esc(c[0]) + '"></span></label>';
    }).join("");
    var sizeBlock = (p.sizes && p.sizes.length) ?
      '<div class="product-option"><span class="option-label">Size</span><div class="option-pills" role="radiogroup" aria-label="사이즈">' +
      p.sizes.map(function (s, i) {
        return '<label class="pill' + (i === 0 ? ' is-active' : '') + '"><input type="radio" name="opt-size" value="' + esc(s) + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(s) + '</span></label>';
      }).join("") + '</div></div>' : '';
    var meta = p.meta.map(function (m) { return '<li><span>' + esc(m[0]) + '</span><b>' + esc(m[1]) + '</b></li>'; }).join("");
    return '<span class="product-kicker">' + esc(p.catLabel) + '</span>' +
      '<h1 class="product-title">' + esc(p.name) + '</h1>' +
      '<span class="product-kr">' + esc(p.kr) + '</span>' +
      '<p class="product-price">' + won(p.price) + '</p>' +
      '<p class="product-lead">' + esc(p.lead) + '</p>' +
      '<div class="commerce-note"><span>무료 배송</span><span>핸드메이드 패키지</span><span>7일 교환 안내</span></div>' +
      '<div class="product-option"><span class="option-label">Color <em>' + esc(p.colors[0][0]) + '</em></span><div class="option-swatches" role="radiogroup" aria-label="색상">' + swatches + '</div></div>' +
      sizeBlock +
      '<div class="product-choice" aria-live="polite"><span>선택 옵션</span><strong>' + esc(p.colors[0][0]) + (p.sizes && p.sizes.length ? " · " + esc(p.sizes[0]) : "") + ' · 1개</strong></div>' +
      '<div class="product-buy"><div class="qty-stepper" aria-label="수량"><button type="button" class="qty-btn" data-step="-1" aria-label="수량 줄이기">&minus;</button><span class="qty-value" aria-live="polite">1</span><button type="button" class="qty-btn" data-step="1" aria-label="수량 늘리기">+</button></div>' +
      '<button type="button" class="btn-cart" data-add-to-cart data-id="' + p.id + '" data-name="' + esc(p.name) + '" data-price="' + p.price + '">장바구니 담기</button>' +
      '<button type="button" class="btn-wish" aria-label="위시리스트에 담기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.5 12 20 12 20z"/></svg></button></div>' +
      '<ul class="product-meta">' + meta + '</ul>';
  }
  function productDetailBodyHTML(p) {
    var desc = p.desc.map(function (d) { return '<p>' + esc(d) + '</p>'; }).join("");
    var specs = p.specs.map(function (s) { return '<tr><th>' + esc(s[0]) + '</th><td>' + esc(s[1]) + '</td></tr>'; }).join("");
    var categoryCopy = {
      table: {
        title: "매일 손이 가는 식탁의 오브제",
        text: "음식을 담았을 때 패턴이 과하게 드러나지 않도록 여백과 깊이를 조율했습니다. 단독으로 사용해도, 서로 다른 CRESTO 테이블웨어와 겹쳐도 자연스럽습니다.",
        use: "메인 요리와 디저트, 가벼운 브런치까지 일상의 다양한 상차림에 사용해보세요.",
        useTip: "서로 다른 크기의 접시와 볼을 겹치면 패턴의 흐름이 자연스럽게 이어집니다.",
        material: "고온에서 단단하게 구운 석기질 도자와 식기에 안전한 무연 유약을 사용합니다.",
        care: "전자레인지와 식기세척기 사용이 가능합니다. 급격한 온도 변화는 피해 주세요.",
        points: ["손으로 그린 듯 흐르는 패턴", "음식을 안정적으로 담는 깊이", "브런치부터 한식까지 넓은 활용"],
        size: "작은 사이즈는 디저트와 1인 식사에, 큰 사이즈는 메인 요리와 함께 나누는 샐러드에 잘 어울립니다.",
        sizeTip: "수납장과 식기세척기 내부 치수를 함께 확인하면 크기를 고르기 쉽습니다.",
        before: "손작업과 가마 소성 과정에서 작은 점, 미세한 기포, 색과 패턴의 농담 차이가 생길 수 있습니다. 이는 불량이 아닌 제품 고유의 표정입니다."
      },
      space: {
        title: "공간에 조용한 중심을 만드는 표면",
        text: "빛의 방향과 보는 거리에 따라 표면의 결이 다르게 읽힙니다. 물건을 담는 기능을 넘어 비어 있을 때도 하나의 오브제로 머물도록 만들었습니다.",
        use: "현관, 사이드 테이블, 선반 위에 두고 작은 소품이나 한 줄기 식물과 함께 연출해보세요.",
        useTip: "주변에 여백을 두고 배치하면 오브제의 형태와 표면이 더 또렷하게 드러납니다.",
        material: "묵직한 석기질 도자를 고온 소성해 안정적인 형태와 손끝에 느껴지는 질감을 완성합니다.",
        care: "부드러운 마른 천으로 닦고, 거친 수세미나 강한 충격은 피해 주세요.",
        points: ["빛에 따라 달라지는 표면", "작은 물건을 모으는 안정적인 형태", "비어 있어도 완성되는 오브제"],
        size: "선반과 사이드 테이블 위에 단독으로 두거나, 작은 소품·향·식물과 함께 연출하기 좋은 크기입니다.",
        sizeTip: "배치할 면의 깊이와 주변 오브제 높이를 먼저 확인해 안정적인 비례를 만들어보세요.",
        before: "수작업 도자 오브제는 표면의 농담과 미세한 형태 차이가 있습니다. 설치 전 평평하고 안정적인 면인지 확인해 주세요."
      },
      bath: {
        title: "물과 빛이 머무는 욕실의 리듬",
        text: "젖고 마르는 일상의 흐름 속에서도 표면의 패턴이 차분히 드러나도록 기능과 촉감을 함께 설계했습니다.",
        use: "평평하고 건조한 바닥에 놓아 사용하고, 사용 후에는 통풍이 잘되는 곳에서 말려 주세요.",
        useTip: "물기가 오래 고이지 않도록 벽과 바닥 사이에 충분한 통풍 공간을 확보해 주세요.",
        material: "수분을 빠르게 흡수하고 건조하는 규조토 소재를 사용해 보송한 사용감을 유지합니다.",
        care: "직사광선을 피해 세워 건조하고, 흡수력이 줄면 고운 사포로 표면을 가볍게 정리해 주세요.",
        points: ["빠른 흡수와 건조", "발끝에 닿는 잔잔한 표면", "욕실을 정돈하는 차분한 패턴"],
        size: "세면대 앞이나 욕실 출입구에 놓기 좋은 크기입니다. 문이 열리는 반경과 바닥 단차를 먼저 확인해 주세요.",
        sizeTip: "사용할 자리의 폭과 문 하단 높이를 측정하면 간섭 없이 편안하게 배치할 수 있습니다.",
        before: "천연 광물 소재 특성상 미세한 가루나 색 차이가 있을 수 있습니다. 젖은 상태에서 장시간 바닥에 밀착해 두지 마세요."
      },
      fabric: {
        title: "쓸수록 편안해지는 천의 결",
        text: "파도의 움직임을 직조와 색의 농담으로 풀어냈습니다. 접거나 펼치는 방식에 따라 식탁과 공간에 다른 리듬을 만듭니다.",
        use: "냅킨뿐 아니라 작은 러너, 바스켓 커버, 선물 포장 천으로 다양하게 활용해보세요.",
        useTip: "가볍게 접거나 자연스럽게 늘어뜨리면 리넨 특유의 주름과 패턴이 편안하게 살아납니다.",
        material: "통기성과 흡습성이 좋은 리넨 100% 원단으로 제작해 사용할수록 자연스럽게 부드러워집니다.",
        care: "찬물에 중성세제로 가볍게 세탁하고 비틀어 짜지 않은 채 그늘에서 말려 주세요.",
        points: ["쓸수록 부드러워지는 리넨", "접는 방식에 따라 달라지는 패턴", "식탁과 포장을 넘나드는 활용"],
        size: "한 사람의 테이블 냅킨으로 넉넉하며, 접어서 작은 바스켓 커버나 선물 포장 천으로도 사용할 수 있습니다.",
        sizeTip: "테이블 폭과 원하는 드레이프 길이를 확인한 뒤 접는 방향을 정해 사용해보세요.",
        before: "천연 리넨은 원사 굵기와 직조 결이 일정하지 않을 수 있으며 첫 세탁 후 자연스러운 수축과 주름이 생깁니다."
      }
    };
    var guide = categoryCopy[p.category] || categoryCopy.space;
    var imageOne = p.images[1] || p.images[0];
    var imageTwo = p.images[2] || p.images[0];
    var points = guide.points.map(function (point) {
      return '<li>' + esc(point) + '</li>';
    }).join("");
    var sizes = (p.sizes || []).map(function (size) { return '<span>' + esc(size) + '</span>'; }).join("");
    return '<div class="detail-overview">' +
        '<div class="detail-block"><span class="detail-eyebrow">The object</span><h2>About this piece</h2>' + desc + '</div>' +
        '<div class="detail-block"><span class="detail-eyebrow">Information</span><h2>Specification</h2><table class="spec-table">' + specs + '</table></div>' +
      '</div>' +
      '<section class="detail-editorial">' +
        '<figure class="detail-editorial-main"><img src="' + esc(imageOne) + '" alt="' + esc(p.name) + ' 디테일"></figure>' +
        '<div class="detail-editorial-copy"><span class="detail-eyebrow">Designed for living</span><h2>' + esc(guide.title) + '</h2><p>' + esc(guide.text) + '</p>' +
        '<ul class="detail-editorial-points">' + points + '</ul>' +
        '<figure class="detail-editorial-sub"><img src="' + esc(imageTwo) + '" alt="' + esc(p.name) + ' 사용 장면"></figure></div>' +
      '</section>' +
      '<section class="detail-practical" aria-label="제품 사용 및 구매 안내">' +
        '<div class="detail-practical-head"><span class="detail-eyebrow">Useful information</span><h2>사용하기 전에 알아두세요</h2></div>' +
        '<div class="detail-practical-grid">' +
          '<article><span>01</span><h3>How to use</h3><p>' + esc(guide.use) + '</p><p>' + esc(guide.useTip) + '</p></article>' +
          '<article><span>02</span><h3>Size guide</h3><div class="detail-size-options">' + sizes + '</div><p>' + esc(guide.size) + '</p><p>' + esc(guide.sizeTip) + '</p></article>' +
          '<article><span>03</span><h3>Material &amp; care</h3><p>' + esc(guide.material) + '</p><p>' + esc(guide.care) + '</p></article>' +
          '<article><span>04</span><h3>Before you buy</h3><p>' + esc(guide.before) + '</p><p>배송 중 파손된 경우 수령 후 7일 이내 교환을 도와드립니다.</p></article>' +
        '</div>' +
      '</section>';
  }
  function renderProductDetail() {
    var page = document.querySelector(".page-product");
    if (!page) return;
    var p = findProduct(getParam("id")) || PRODUCTS[0];
    currentProduct = p;
    document.title = p.name + " | Cresto";
    var crumb = page.querySelector(".crumb-current");
    if (crumb) crumb.textContent = p.name;
    var mainImg = document.getElementById("productMainImg");
    if (mainImg) { mainImg.src = p.images[0]; mainImg.alt = p.name; }
    var thumbs = page.querySelector(".product-thumbs");
    if (thumbs) {
      thumbs.innerHTML = p.images.map(function (src, i) {
        return '<li><button type="button" class="product-thumb' + (i === 0 ? ' is-active' : '') + '" data-full="' + src + '" aria-label="이미지 ' + (i + 1) + '"><img src="' + src + '" alt=""></button></li>';
      }).join("");
    }
    var info = page.querySelector(".product-info");
    if (info) info.innerHTML = productInfoHTML(p);
    var body = page.querySelector(".product-detail-body");
    if (body) body.innerHTML = productDetailBodyHTML(p);
    var rel = page.querySelector(".product-related-grid");
    if (rel) {
      rel.innerHTML = (p.related || []).map(function (rid) {
        var rp = findProduct(rid);
        return rp ? productCardHTML(rp) : "";
      }).join("");
    }
  }
  function wireProductPage() {
    var page = document.querySelector(".page-product");
    if (!page) return;
    var mainImg = document.getElementById("productMainImg");
    var stage = page.querySelector(".product-stage");
    page.addEventListener("click", function (e) {
      var t = e.target.closest(".product-thumb");
      if (t) {
        var full = t.getAttribute("data-full");
        if (full && mainImg && mainImg.src.indexOf(full) === -1) {
          mainImg.classList.add("is-switching");
          window.setTimeout(function () {
            mainImg.src = full;
            mainImg.addEventListener("load", function onLoad() {
              mainImg.classList.remove("is-switching");
              mainImg.removeEventListener("load", onLoad);
            });
          }, 120);
        }
        page.querySelectorAll(".product-thumb").forEach(function (x) { x.classList.remove("is-active"); });
        t.classList.add("is-active");
      }
      var q = e.target.closest(".qty-btn");
      if (q) {
        var qtyVal = page.querySelector(".qty-value");
        var step = parseInt(q.getAttribute("data-step"), 10) || 0;
        var cur = parseInt(qtyVal.textContent, 10) || 1;
        qtyVal.textContent = Math.max(1, Math.min(99, cur + step));
        updateProductChoice(page);
      }
    });
    if (stage && mainImg) {
      stage.addEventListener("mousemove", function (e) {
        var r = stage.getBoundingClientRect();
        var x = ((e.clientX - r.left) / r.width - 0.5) * 12;
        var y = ((e.clientY - r.top) / r.height - 0.5) * 12;
        mainImg.style.transform = "scale(1.045) translate(" + (-x) + "px, " + (-y) + "px)";
      });
      stage.addEventListener("mouseleave", function () {
        mainImg.style.transform = "";
      });
    }
    page.addEventListener("change", function (e) {
      var inp = e.target;
      if (inp.name === "opt-color") {
        page.querySelectorAll(".swatch").forEach(function (s) { s.classList.remove("is-active"); });
        inp.closest(".swatch").classList.add("is-active");
        var colorEcho = page.querySelector(".product-option .option-label em");
        if (colorEcho) colorEcho.textContent = inp.value;
        updateProductChoice(page);
      }
      if (inp.name === "opt-size") {
        page.querySelectorAll(".pill").forEach(function (p) { p.classList.remove("is-active"); });
        inp.closest(".pill").classList.add("is-active");
        updateProductChoice(page);
      }
    });
    if (!currentProduct) return;
    var item = productToItem(currentProduct);
    RECENT.push(item);
    var wish = page.querySelector(".btn-wish");
    if (wish) {
      if (WISH.has(item.name)) wish.classList.add("is-active");
      wish.addEventListener("click", function () {
        var added = WISH.toggle(item);
        wish.classList.toggle("is-active", added);
        toast(added ? "위시리스트에 담았어요." : "위시리스트에서 삭제했어요.");
      });
    }
  }
  function updateProductChoice(page) {
    var choice = page.querySelector(".product-choice strong");
    if (!choice) return;
    var color = page.querySelector('input[name="opt-color"]:checked');
    var size = page.querySelector('input[name="opt-size"]:checked');
    var qty = page.querySelector(".qty-value");
    var parts = [];
    if (color) parts.push(color.value);
    if (size) parts.push(size.value);
    parts.push((qty ? qty.textContent : "1") + "개");
    choice.textContent = parts.join(" · ");
    choice.classList.remove("pulse");
    void choice.offsetWidth;
    choice.classList.add("pulse");
  }
  var catalogView = null;
  function renderProductGrids() {
    var b = document.body;
    var map = { "page-new-arrivals": null, "page-object": null, "page-for-table": "table", "page-for-bath": "bath", "page-for-fabric": "fabric", "page-for-space": "space" };
    var category, matched = false;
    for (var cls in map) if (b.classList.contains(cls)) { category = map[cls]; matched = true; break; }
    if (!matched) return;
    var grid = document.querySelector(".catalog-grid");
    if (!grid) return;
    var base = category ? PRODUCTS.filter(function (p) { return p.category === category; }) : PRODUCTS.slice();
    grid.classList.remove("catalog-rich");
    grid.classList.add("shop-grid");
    catalogView = { base: base, grid: grid, allCats: !category, cat: "all", sort: "default" };
    buildCatalogFilterBar();
    applyCatalogView();
  }
  var CAT_LABELS = [["all", "전체"], ["table", "Table"], ["bath", "Bath"], ["fabric", "Fabric"], ["space", "Space"]];
  var SORT_OPTIONS = [["default", "추천순"], ["price-asc", "낮은 가격순"], ["price-desc", "높은 가격순"], ["name", "이름순"]];
  function buildCatalogFilterBar() {
    if (!catalogView || document.querySelector(".catalog-filter")) return;
    var v = catalogView;
    var bar = el("div", { class: "catalog-filter" });

    if (v.allCats) {
      var present = {};
      v.base.forEach(function (p) { present[p.category] = true; });
      var chips = el("div", { class: "catalog-chips", role: "group", "aria-label": "카테고리 필터" });
      CAT_LABELS.filter(function (c) { return c[0] === "all" || present[c[0]]; }).forEach(function (c) {
        var active = c[0] === "all";
        chips.appendChild(el("button", {
          type: "button", class: "catalog-chip" + (active ? " is-active" : ""),
          "data-cat": c[0], "aria-pressed": active ? "true" : "false"
        }, esc(c[1])));
      });
      chips.addEventListener("click", function (e) {
        var chip = e.target.closest(".catalog-chip");
        if (!chip) return;
        chips.querySelectorAll(".catalog-chip").forEach(function (c) { c.classList.remove("is-active"); c.setAttribute("aria-pressed", "false"); });
        chip.classList.add("is-active"); chip.setAttribute("aria-pressed", "true");
        v.cat = chip.getAttribute("data-cat");
        applyCatalogView();
      });
      bar.appendChild(chips);
    }

    var tools = el("div", { class: "catalog-tools" });
    tools.appendChild(el("span", { class: "catalog-count" }, ""));
    var sortWrap = el("label", { class: "catalog-sort" }, '<span class="catalog-sort-label">정렬</span>');
    var sel = el("select", { class: "catalog-sort-select", "aria-label": "정렬 기준" });
    SORT_OPTIONS.forEach(function (o) { sel.appendChild(el("option", { value: o[0] }, o[1])); });
    sel.addEventListener("change", function () { v.sort = sel.value; applyCatalogView(); });
    sortWrap.appendChild(sel);
    tools.appendChild(sortWrap);
    bar.appendChild(tools);

    v.grid.parentNode.insertBefore(bar, v.grid);
  }
  function applyCatalogView() {
    if (!catalogView) return;
    var v = catalogView;
    var list = v.base.slice();
    if (v.allCats && v.cat !== "all") list = list.filter(function (p) { return p.category === v.cat; });
    if (v.sort === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
    else if (v.sort === "price-desc") list.sort(function (a, b) { return b.price - a.price; });
    else if (v.sort === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    v.grid.setAttribute("aria-live", "polite");
    v.grid.innerHTML = list.length
      ? list.map(productCardHTML).join("")
      : '<p class="catalog-empty">해당 조건의 상품이 없어요.</p>';
    var count = document.querySelector(".catalog-count");
    if (count) count.textContent = list.length + "개";
  }
  function wireQuickAdd() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-quick-add]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var p = findProduct(btn.getAttribute("data-id"));
      if (!p) return;
      var meta = [];
      if (p.colors && p.colors.length) meta.push(p.colors[0][0]);
      meta.push("1개");
      CART.add({ id: p.id, name: p.name, meta: meta.join(" · "), price: p.price, qty: 1 });
      refreshCartUI();
      toast(p.name + "을 장바구니에 담았어요.");
    });
  }
  function wireAddToCart() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-add-to-cart]");
      if (!btn) return;
      e.preventDefault();
      var scope = btn.closest(".product-info") || document;
      var id = btn.getAttribute("data-id") || "";
      var name = btn.getAttribute("data-name") || "상품";
      var unit = parseInt(btn.getAttribute("data-price"), 10) || 0;
      var color = scope.querySelector('input[name="opt-color"]:checked');
      var size = scope.querySelector('input[name="opt-size"]:checked');
      var qtyEl = scope.querySelector(".qty-value");
      var qty = qtyEl ? (parseInt(qtyEl.textContent, 10) || 1) : 1;
      var parts = [];
      if (color) parts.push(color.value);
      if (size) parts.push(size.value);
      parts.push(qty + "개");
      CART.add({ id: id, name: name, meta: parts.join(" · "), price: unit * qty, qty: qty });
      refreshCartUI();
      flashAddButton(btn);
      toast(name + "을 장바구니에 담았어요.");
    });
  }
  function flashAddButton(btn) {
    if (!btn) return;
    var original = btn.textContent;
    btn.classList.add("is-added");
    btn.textContent = "장바구니에 담겼어요";
    window.clearTimeout(btn._addTimer);
    btn._addTimer = window.setTimeout(function () {
      btn.classList.remove("is-added");
      btn.textContent = original;
    }, 1500);
  }

  /* ---------- cart / member grids ---------- */
  function renderCartPage() {
    var root = document.querySelector(".cartpage");
    if (!root) return;
    /* 로그인 후 주문서로 복귀(?checkout=1)했고 담긴 상품이 있으면 곧바로 주문서를 연다. */
    if (getParam("checkout") === "1" && AUTH.get() && CART.get().length) {
      renderCheckoutForm(root);
      return;
    }
    var listEl = root.querySelector(".cartpage-list");
    var sumEl = root.querySelector(".cartpage-summary");
    var colsEl = root.querySelector(".cartpage-cols");
    var items = CART.get();
    if (!items.length) {
      root.classList.add("is-empty");
      if (colsEl) colsEl.hidden = true;
      listEl.innerHTML = '<div class="member-empty"><p>장바구니가 비어 있어요.</p><a class="btn-line" href="object.html">오브제 둘러보기</a></div>';
      if (sumEl) sumEl.hidden = true;
      return;
    }
    root.classList.remove("is-empty");
    if (colsEl) colsEl.hidden = false;
    if (sumEl) sumEl.hidden = false;
    listEl.innerHTML = items.map(function (it, i) {
      var href = it.id ? "product-detail.html?id=" + it.id : "product-detail.html";
      var im = itemImg(it);
      return '<div class="cartpage-item" data-idx="' + i + '">' +
        '<a class="ci-thumb" href="' + href + '"' + (im ? ' style="background-image:url(' + esc(im) + ')"' : '') + '></a>' +
        '<div class="ci-info"><a class="ci-name" href="' + href + '">' + esc(it.name) + '</a><span class="ci-meta">' + esc(it.meta || "기본 옵션") + '</span></div>' +
        '<div class="ci-qty"><button type="button" data-q="-1" aria-label="수량 줄이기">&minus;</button><span>' + (it.qty || 1) + '</span><button type="button" data-q="1" aria-label="수량 늘리기">+</button></div>' +
        '<span class="ci-price">' + won(it.price) + '</span><button type="button" class="ci-remove" data-remove aria-label="삭제">&times;</button></div>';
    }).join("");
    var subtotal = CART.totalPrice();
    var ship = subtotal >= 50000 ? 0 : 3000;
    sumEl.innerHTML = '<h3>Order Summary</h3>' +
      '<div class="sum-row"><span>상품 금액</span><b>' + won(subtotal) + '</b></div>' +
      '<div class="sum-row"><span>배송비</span><b>' + (ship === 0 ? '무료' : won(ship)) + '</b></div>' +
      '<p class="sum-note">' + (subtotal >= 50000 ? '5만원 이상 구매로 무료배송이 적용되었어요.' : '5만원 이상 구매 시 무료배송이 적용됩니다.') + '</p>' +
      '<div class="sum-total"><span>결제 예정</span><strong>' + won(subtotal + ship) + '</strong></div>' +
      '<button type="button" class="btn-fill" data-checkout>주문하기</button><a class="btn-line" href="object.html">계속 쇼핑하기</a>';
    listEl.querySelectorAll(".cartpage-item").forEach(function (row) {
      var idx = parseInt(row.getAttribute("data-idx"), 10);
      row.querySelectorAll("[data-q]").forEach(function (b) {
        b.addEventListener("click", function () {
          var cur = (CART.get()[idx] || {}).qty || 1;
          CART.setQtyAt(idx, Math.max(1, Math.min(99, cur + (parseInt(b.getAttribute("data-q"), 10) || 0))));
          renderCartPage(); refreshCartUI();
        });
      });
      var rm = row.querySelector("[data-remove]");
      if (rm) rm.addEventListener("click", function () {
        CART.removeAt(idx); renderCartPage(); refreshCartUI(); toast("장바구니에서 삭제했어요.");
      });
    });
    var co = sumEl.querySelector("[data-checkout]");
    if (co) co.addEventListener("click", function () { startCheckout(root); });
  }

  /* ---------- checkout (배송 정보 + 주문 확인) ---------- */
  /* 주문하기 → 로그인 필요. 비로그인 시 로그인으로 보내고, 로그인 후 주문서로 복귀시킨다. */
  function startCheckout(root) {
    if (!CART.get().length) return;
    if (!AUTH.get()) {
      try {
        sessionStorage.setItem("cresto_after_login", "cart.html?checkout=1");
        sessionStorage.setItem("cresto_login_notice", "주문을 진행하려면 로그인이 필요해요.");
      } catch (e) {}
      location.href = "login.html";
      return;
    }
    renderCheckoutForm(root);
    window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
  }
  /* 저장된 배송지 → 없으면 로그인 사용자 이름으로 프리필 */
  function defaultShipping() {
    var saved = SHIP.get();
    if (saved) return saved;
    var user = AUTH.get();
    return { name: user ? user.name : "", tel: "", addr: "", addr2: "", memo: "" };
  }
  function checkoutFieldsHTML(pre) {
    pre = pre || {};
    function field(label, name, type, ph, auto) {
      return '<label>' + esc(label) +
        '<input type="' + type + '" name="' + name + '" value="' + esc(pre[name.replace("ship-", "")] || "") + '"' +
        (auto ? ' autocomplete="' + auto + '"' : "") + ' placeholder="' + esc(ph) + '"></label>';
    }
    return '<div class="form-grid checkout-form">' +
      field("받는 분", "ship-name", "text", "이름", "name") +
      field("연락처", "ship-tel", "tel", "010-0000-0000", "tel") +
      field("배송지", "ship-addr", "text", "주소를 입력해주세요", "street-address") +
      field("상세 주소", "ship-addr2", "text", "동·호수 등 상세 주소 (선택)", "address-line2") +
      field("배송 메모", "ship-memo", "text", "예: 부재 시 문 앞에 놓아주세요 (선택)", "") +
      '</div>';
  }
  function checkoutPayHTML() {
    var opts = [["card", "신용 · 체크카드"], ["bank", "무통장 입금"], ["kakao", "간편결제"]];
    return '<div class="checkout-pay" role="radiogroup" aria-label="결제 수단">' +
      opts.map(function (o, i) {
        return '<label class="pay-opt' + (i === 0 ? " is-active" : "") + '"><input type="radio" name="pay" value="' + o[0] + '"' + (i === 0 ? " checked" : "") + '><span>' + esc(o[1]) + '</span></label>';
      }).join("") +
      '</div>';
  }
  function checkoutSummaryHTML() {
    var subtotal = CART.totalPrice();
    var ship = subtotal >= 50000 ? 0 : 3000;
    return '<h3>Order Summary</h3>' +
      '<div class="sum-row"><span>상품 금액</span><b>' + won(subtotal) + '</b></div>' +
      '<div class="sum-row"><span>배송비</span><b>' + (ship === 0 ? "무료" : won(ship)) + '</b></div>' +
      '<p class="sum-note">' + (subtotal >= 50000 ? "5만원 이상 구매로 무료배송이 적용되었어요." : "5만원 이상 구매 시 무료배송이 적용됩니다.") + '</p>' +
      '<div class="sum-total"><span>결제 예정</span><strong>' + won(subtotal + ship) + '</strong></div>' +
      '<button type="button" class="btn-fill" data-place-order>결제하기</button>' +
      '<button type="button" class="btn-line" data-checkout-back>장바구니로 돌아가기</button>';
  }
  function renderCheckoutForm(root) {
    var items = CART.get();
    if (!items.length) { history.replaceState(null, "", "cart.html"); renderCartPage(); return; }
    var lines = items.map(function (it) {
      var im = itemImg(it);
      return '<div class="order-line"><span class="ci-thumb"' + (im ? ' style="background-image:url(' + esc(im) + ')"' : "") + '></span>' +
        '<div><b>' + esc(it.name) + '</b><span>' + esc(it.meta || "기본 옵션") + '</span></div>' +
        '<span class="order-line-price">' + won(it.price || 0) + '</span></div>';
    }).join("");
    root.classList.remove("is-empty");
    root.innerHTML =
      '<section class="checkout" aria-label="주문서">' +
        '<ol class="checkout-steps"><li class="is-done">장바구니</li><li class="is-active">주문서 작성</li><li>주문 완료</li></ol>' +
        '<div class="cartpage-grid">' +
          '<div class="cartpage-main">' +
            '<div class="checkout-block"><h3>배송 정보</h3>' + checkoutFieldsHTML(defaultShipping()) + '</div>' +
            '<div class="checkout-block"><h3>결제 수단</h3>' + checkoutPayHTML() + '</div>' +
            '<div class="checkout-block"><h3>주문 상품 <em>' + items.length + '개</em></h3><div class="checkout-lines">' + lines + '</div></div>' +
          '</div>' +
          '<aside class="cartpage-summary">' + checkoutSummaryHTML() + '</aside>' +
        '</div>' +
      '</section>';
    root.querySelectorAll(".pay-opt input").forEach(function (inp) {
      inp.addEventListener("change", function () {
        root.querySelectorAll(".pay-opt").forEach(function (l) { l.classList.remove("is-active"); });
        inp.closest(".pay-opt").classList.add("is-active");
      });
    });
    var back = root.querySelector("[data-checkout-back]");
    if (back) back.addEventListener("click", function () {
      history.replaceState(null, "", "cart.html");
      renderCartPage();
      window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
    });
    var place = root.querySelector("[data-place-order]");
    if (place) place.addEventListener("click", function () { placeOrder(root); });
  }
  function placeOrder(root) {
    var form = root.querySelector(".checkout-form");
    if (!form) return;
    function val(n) { var i = form.querySelector('[name="' + n + '"]'); return i ? i.value.trim() : ""; }
    var required = [["ship-name", "받는 분 이름"], ["ship-tel", "연락처"], ["ship-addr", "배송지 주소"]];
    for (var i = 0; i < required.length; i++) {
      if (!val(required[i][0])) {
        toast(required[i][1] + "을(를) 입력해주세요.");
        var miss = form.querySelector('[name="' + required[i][0] + '"]');
        if (miss) miss.focus();
        return;
      }
    }
    var shipping = { name: val("ship-name"), tel: val("ship-tel"), addr: val("ship-addr"), addr2: val("ship-addr2"), memo: val("ship-memo") };
    SHIP.set(shipping);
    var order = ORDERS.create(CART.get(), shipping);
    CART.set([]);
    refreshCartUI();
    history.replaceState(null, "", "cart.html");
    renderCheckoutComplete(root, order);
    window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
    toast("주문이 완료되었어요.");
  }
  function orderItemsHTML(items) {
    return items.map(function (it) {
      var im = it.img || itemImg(it);
      return '<div class="order-line"><span class="ci-thumb"' + (im ? ' style="background-image:url(' + esc(im) + ')"' : '') + '></span>' +
        '<div><b>' + esc(it.name) + '</b><span>' + esc(it.meta || "기본 옵션") + '</span></div>' +
        '<span class="order-line-price">' + won(it.price || 0) + '</span></div>';
    }).join("");
  }
  function orderCardHTML(order, isNew) {
    return '<article class="order-card' + (isNew ? ' is-new' : '') + '">' +
      '<div class="order-top"><div><span class="order-no">No. ' + esc(order.no) + '</span><span class="order-date">' + esc(order.date) + '</span></div>' +
      '<span class="order-status is-paid">' + esc(order.status || "주문 완료") + '</span></div>' +
      '<div class="order-items">' + orderItemsHTML(order.items || []) + '</div>' +
      '<div class="order-foot"><span>총 결제 금액 <strong>' + won(order.total || 0) + '</strong></span>' +
      '<a class="btn-line sm" href="#" data-order-detail>주문 상세</a></div></article>';
  }
  function shippingLineHTML(s) {
    if (!s) return "";
    var addr = esc(s.addr || "") + (s.addr2 ? " " + esc(s.addr2) : "");
    return '<div class="order-complete-ship">' +
      '<span class="detail-eyebrow">배송지</span>' +
      '<p><strong>' + esc(s.name || "") + '</strong>' + (s.tel ? ' · ' + esc(s.tel) : "") + '</p>' +
      '<p>' + addr + '</p>' +
      (s.memo ? '<p class="order-complete-memo">요청사항 · ' + esc(s.memo) + '</p>' : "") +
      '</div>';
  }
  function renderCheckoutComplete(root, order) {
    root.classList.remove("is-empty");
    root.innerHTML = '<section class="order-complete" aria-live="polite">' +
      '<span class="order-complete-kicker">Checkout</span>' +
      '<h2>주문이 완료되었습니다.</h2>' +
      '<p>입력하신 배송지로 상품을 정성껏 보내드릴게요. 주문 내역은 마이페이지에서 다시 확인할 수 있어요.</p>' +
      '<div class="order-complete-meta"><span>주문번호</span><strong>No. ' + esc(order.no) + '</strong></div>' +
      orderCardHTML(order, true) +
      shippingLineHTML(order.ship_to) +
      '<div class="order-complete-actions"><a class="btn-fill" href="orders.html">주문 내역 보기</a><a class="btn-line" href="object.html">계속 쇼핑하기</a></div>' +
      '</section>';
  }
  function renderOrdersPage() {
    var list = document.querySelector(".orders-list");
    if (!list) return;
    var orders = ORDERS.get();
    if (!orders.length) return;
    list.insertAdjacentHTML("afterbegin", orders.map(function (order, i) {
      return orderCardHTML(order, i === 0);
    }).join(""));
  }
  function shopCardHTML(it, actionsHTML) {
    var href = esc(it.href || "product-detail.html");
    var media = it.img ? '<a class="shop-card-media" href="' + href + '" style="background-image:url(' + esc(it.img) + ')"></a>' : '<a class="shop-card-media is-empty" href="' + href + '"></a>';
    return '<article class="shop-card" data-name="' + esc(it.name) + '">' + media +
      '<div class="shop-card-body"><a class="shop-card-title" href="' + href + '"><h4>' + esc(it.name) + '</h4></a>' +
      (it.kr ? '<span class="shop-card-kr">' + esc(it.kr) + '</span>' : '') +
      '<span class="shop-card-price">' + won(it.price || 0) + '</span></div>' + (actionsHTML || '') + '</article>';
  }
  function renderWishlist() {
    var grid = document.querySelector(".wishlist-grid");
    if (!grid) return;
    var items = WISH.get();
    if (!items.length) { grid.innerHTML = '<div class="member-empty"><p>찜한 오브제가 아직 없어요.</p><a class="btn-line" href="object.html">오브제 둘러보기</a></div>'; return; }
    grid.innerHTML = items.map(function (it) {
      return shopCardHTML(it, '<div class="shop-card-actions"><button type="button" class="btn-fill sm" data-wish-add>장바구니 담기</button><button type="button" class="shop-card-x" data-wish-remove aria-label="삭제">&times;</button></div>');
    }).join("");
  }
  function renderRecent() {
    var grid = document.querySelector(".recent-grid");
    if (!grid) return;
    var items = RECENT.get();
    if (!items.length) { grid.innerHTML = '<div class="member-empty"><p>최근 본 상품이 없어요.</p><a class="btn-line" href="object.html">상품 둘러보기</a></div>'; return; }
    grid.innerHTML = items.map(function (it) { return shopCardHTML(it, '<div class="shop-card-actions"><a class="btn-line sm" href="' + esc(it.href || "product-detail.html") + '">자세히 보기</a></div>'); }).join("");
  }
  function wireProfile() {}
  function wireMemberStats() {
    var user = AUTH.get();
    var nameEl = document.querySelector(".acct-name");
    if (nameEl && user) nameEl.textContent = user.name + " 님";
    /* 마이페이지 요약 숫자를 실제 데이터로 채운다 (주문 · 위시리스트) */
    var stats = document.querySelectorAll(".acct-stats b");
    if (stats.length) {
      if (stats[0]) stats[0].textContent = ORDERS.get().length;
      if (stats[1]) stats[1].textContent = WISH.get().length;
    }
  }
  function wireCatalogLinks() {
    var linkMap = {
      "page-pattern": ["pattern.html", "rough-wave.html", "soft-geometry.html", "ceramic-bloom.html", "blue-archive.html", "object.html"],
      "page-rough-wave": ["rough-wave.html", "rough-wave.html#detail", "object.html", "for-fabric.html", "blue-archive.html", "for-space.html"],
      "page-soft-geometry": ["soft-geometry.html", "soft-geometry.html#repeat", "soft-geometry.html#scale", "for-fabric.html", "soft-geometry.html#tile", "object.html"],
      "page-ceramic-bloom": ["ceramic-bloom.html", "for-table.html", "for-table.html", "ceramic-bloom.html#detail", "blue-archive.html", "ceramic-bloom.html#surface"],
      "page-blue-archive": ["blue-archive.html", "archive.html", "pattern.html", "rough-wave.html", "object.html", "blue-archive.html#season"],
      "page-object": ["for-table.html", "for-bath.html", "for-fabric.html", "for-space.html", "object.html", "object.html"],
      "page-for-table": ["product-detail.html?id=rough-wave-plate", "product-detail.html?id=soft-geometry-bowl", "product-detail.html?id=ocean-mug", "product-detail.html?id=ceramic-bloom-dish", "product-detail.html?id=wave-tray", "object.html"],
      "page-for-bath": ["product-detail.html?id=tidal-bath-mat", "care-service.html", "for-fabric.html", "contact.html", "care-service.html", "size-guide.html"],
      "page-for-fabric": ["product-detail.html?id=wave-linen-napkin", "for-fabric.html", "care-service.html", "blue-archive.html", "archive.html", "craft.html"],
      "page-for-space": ["product-detail.html?id=wave-tray", "product-detail.html?id=blue-archive-vase", "for-space.html", "for-space.html", "for-space.html", "stockist.html"]
    };
    function catalogHref(i) {
      for (var cls in linkMap) if (document.body.classList.contains(cls)) return linkMap[cls][i] || "object.html";
      return "object.html";
    }
    document.querySelectorAll(".catalog-card").forEach(function (card) {
      if (card.dataset.linked || card.tagName === "A" || card.querySelector("a")) return;
      card.dataset.linked = "1";
      card.style.cursor = "pointer";
      var siblings = Array.prototype.slice.call(card.parentNode.querySelectorAll(".catalog-card"));
      makeCardLink(card, catalogHref(siblings.indexOf(card)));
    });
  }
  /* build the home pattern + collection decks from data (single source of truth) */
  function renderHomeCards() {
    var patternDeck = document.querySelector(".sec01-cards");
    if (patternDeck) {
      patternDeck.innerHTML = HOME_PATTERNS.map(function (p) {
        return '<div class="sec01-card">' +
          '<div class="sec01-card-img"><img src="' + esc(p.img) + '" alt="' + esc(p.title) + '" loading="lazy" decoding="async"></div>' +
          "<h4>" + esc(p.title) + "</h4>" +
          "<h5>" + esc(p.sub) + "</h5>" +
        "</div>";
      }).join("");
    }
    var collectionGrid = document.querySelector(".sec03-grid");
    if (collectionGrid) {
      collectionGrid.innerHTML = HOME_COLLECTIONS.map(function (c) {
        return '<div class="col-card">' +
          '<div class="col-card-img"><img src="' + esc(c.img) + '" alt="' + esc(c.title) + '" loading="lazy" decoding="async"></div>' +
          '<div class="col-card-info">' +
            "<div><h4>" + esc(c.title) + "</h4><h5>" + esc(c.sub) + "</h5></div>" +
            '<div class="col-arrow"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg></div>' +
          "</div>" +
        "</div>";
      }).join("");
    }
  }
  function wireHomeInteractions() {
    document.querySelectorAll(".sec01-card").forEach(function (card, i) {
      makeCardLink(card, (HOME_PATTERNS[i] && HOME_PATTERNS[i].href) || "pattern.html");
    });
    var circleLinks = ["design-mood.html", "craft.html", "archive.html"];
    document.querySelectorAll(".circle-item").forEach(function (card, i) {
      makeCardLink(card, circleLinks[i] || "about.html");
    });
    document.querySelectorAll(".col-card").forEach(function (card, i) {
      makeCardLink(card, (HOME_COLLECTIONS[i] && HOME_COLLECTIONS[i].href) || "object.html");
    });
    document.querySelectorAll(".hero-scroll-cue[data-target]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = document.querySelector(btn.dataset.target);
        if (target) window.scrollTo({ top: target.offsetTop, behavior: reduceMotion() ? "auto" : "smooth" });
      });
    });
    setupHomeMotion();
  }
  function makeCardLink(card, href) {
    if (!card || card.dataset.homeLinked) return;
    card.dataset.homeLinked = "1";
    card.setAttribute("role", "link");
    card.setAttribute("tabindex", "0");
    card.addEventListener("click", function () { location.href = href; });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        location.href = href;
      }
    });
  }
  function reduceMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }
  function setupHomeMotion() {
    var hero = document.getElementById("hero");
    if (!hero) return;
    var rm = reduceMotion();
    var progress = hero.querySelector(".hero-progress span");
    var cue = hero.querySelector(".hero-scroll-cue");
    var dots = Array.prototype.slice.call(document.querySelectorAll(".slide-dots .dot"));
    /* 섹션 퀵네비 점: 현재 스크롤 위치에 해당하는 점을 활성화 (index.html 인라인 스크립트에서 통합) */
    function syncDots(y) {
      if (!dots.length) return;
      var active = 0;
      dots.forEach(function (dot, i) {
        var sec = document.querySelector(dot.dataset.target);
        if (sec && y >= sec.offsetTop - window.innerHeight / 2) active = i;
      });
      dots.forEach(function (dot, i) { dot.classList.toggle("active", i === active); });
    }
    function tick() {
      var y = window.scrollY || 0;
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      document.documentElement.style.setProperty("--page-progress", Math.min(1, y / max));
      if (progress) progress.style.transform = "scaleX(" + Math.min(1, y / Math.max(1, hero.offsetHeight)) + ")";
      if (cue) cue.style.opacity = y > 80 ? "0" : "1";
      syncDots(y);
      if (rm) return; // 이하 비디오 패럴럭스·장식 플로팅은 움직임 최소화 설정에서 생략
      var video = hero.querySelector("video");
      if (video) video.style.transform = "scale(" + (1.08 + Math.min(0.06, y / 9000)) + ") translateY(" + (y * 0.035) + "px)";
      document.querySelectorAll(".brand-ornament").forEach(function (img, i) {
        img.style.transform = "translateY(" + (Math.sin((y / 280) + i) * 8) + "px)";
      });
    }
    dots.forEach(function (dot) {
      if (!dot.getAttribute("aria-label") && dot.dataset.label) dot.setAttribute("aria-label", dot.dataset.label + " 섹션으로 이동");
      dot.addEventListener("click", function () {
        var target = document.querySelector(dot.dataset.target);
        if (target) window.scrollTo({ top: target.offsetTop, behavior: rm ? "auto" : "smooth" });
      });
    });
    window.addEventListener("scroll", tick, { passive: true });
    tick();
  }
  function wireDemoLinks() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-demo]");
      if (!t) return;
      e.preventDefault();
      var label = (t.textContent || "").replace(/\s+/g, " ").trim();
      if (label.indexOf("주문 상세") > -1) { openOrderDetail(t); return; }
      if (label.indexOf("배송 조회") > -1) { openDeliveryTracking(t); return; }
      toast(demoToastMessage(t));
    });
    document.addEventListener("click", function (e) {
      var detail = e.target.closest("[data-order-detail]");
      if (!detail) return;
      e.preventDefault();
      openOrderDetail(detail);
    });
    document.querySelectorAll("[data-demo-form]").forEach(function (form) {
      form.setAttribute("novalidate", "novalidate");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = form.querySelector("input");
        var code = input ? input.value.trim() : "";
        if (!code) {
          toast("쿠폰 코드를 입력해주세요.");
          if (input) input.focus();
          return;
        }
        toast("사용할 수 없는 쿠폰 코드입니다.");
      });
    });
  }
  function demoToastMessage(target) {
    var kind = target.getAttribute("data-demo");
    var label = (target.textContent || target.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    if (kind === "sns") return "공식 채널 링크가 아직 연결되지 않았습니다.";
    if (label.indexOf("주문 상세") > -1) return "주문 상세 내역을 불러올 수 없습니다.";
    if (label.indexOf("배송 조회") > -1) return "배송 조회 정보를 확인할 수 없습니다.";
    if (label.indexOf("새 배송지") > -1) return "새 배송지 등록을 진행할 수 없습니다.";
    if (label === "수정") return "배송지 수정 권한을 확인할 수 없습니다.";
    if (label === "삭제") return "선택한 배송지를 삭제할 수 없습니다.";
    return "요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.";
  }
  function readOrderCard(trigger) {
    var card = trigger.closest(".order-card");
    if (!card) return null;
    var lines = Array.prototype.slice.call(card.querySelectorAll(".order-line")).map(function (line) {
      return {
        name: textOf(line.querySelector("b")),
        meta: textOf(line.querySelector("div span")),
        price: textOf(line.querySelector(".order-line-price")),
        img: line.querySelector(".ci-thumb") ? line.querySelector(".ci-thumb").style.backgroundImage : ""
      };
    });
    return {
      no: textOf(card.querySelector(".order-no")),
      date: textOf(card.querySelector(".order-date")),
      status: textOf(card.querySelector(".order-status")),
      total: textOf(card.querySelector(".order-foot strong")),
      items: lines
    };
  }
  function textOf(node) { return node ? node.textContent.replace(/\s+/g, " ").trim() : ""; }
  function ensureOrderModal() {
    var modal = document.querySelector(".order-modal");
    if (modal) return modal;
    modal = el("div", { class: "order-modal", role: "dialog", "aria-modal": "true", "aria-label": "주문 정보" },
      '<div class="order-modal-backdrop" data-order-close></div>' +
      '<section class="order-modal-panel">' +
        '<button type="button" class="order-modal-close" data-order-close aria-label="닫기">&times;</button>' +
        '<div class="order-modal-content"></div>' +
      '</section>'
    );
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-order-close]")) closeOrderModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeOrderModal();
    });
    return modal;
  }
  function openOrderModal(html) {
    var modal = ensureOrderModal();
    modal.querySelector(".order-modal-content").innerHTML = html;
    modal.classList.add("open");
    document.body.classList.add("no-scroll");
    var panel = modal.querySelector(".order-modal-panel");
    trapFocus(panel || modal);
    var close = modal.querySelector(".order-modal-close");
    if (close) close.focus();
  }
  function closeOrderModal() {
    var modal = document.querySelector(".order-modal");
    if (!modal) return;
    releaseFocusTrap(modal.querySelector(".order-modal-panel") || modal);
    modal.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }
  /* 화면의 주문번호(No. 접두어 포함 가능)로 저장된 주문을 찾아 배송지 등 상세를 얻는다 */
  function findStoredOrder(no) {
    var key = String(no || "").replace(/^No\.\s*/, "").trim();
    var list = ORDERS.get();
    for (var i = 0; i < list.length; i++) if (list[i].no === key) return list[i];
    return null;
  }
  function shipAddressText(s) {
    if (!s) return "경기도 성남시 분당구 판교로 123";
    var line = (s.name ? esc(s.name) : "") + (s.tel ? " · " + esc(s.tel) : "");
    var addr = esc(s.addr || "") + (s.addr2 ? " " + esc(s.addr2) : "");
    return (line ? line + "<br>" : "") + addr;
  }
  function openOrderDetail(trigger) {
    var order = readOrderCard(trigger);
    if (!order) return;
    var stored = findStoredOrder(order.no);
    var rows = order.items.map(function (it) {
      return '<div class="order-modal-line"><div><b>' + esc(it.name) + '</b><span>' + esc(it.meta) + '</span></div><strong>' + esc(it.price) + '</strong></div>';
    }).join("");
    openOrderModal(
      '<span class="order-modal-kicker">Order Detail</span>' +
      '<h3>주문 상세</h3>' +
      '<dl class="order-modal-meta"><div><dt>주문번호</dt><dd>' + esc(order.no) + '</dd></div><div><dt>주문일</dt><dd>' + esc(order.date) + '</dd></div><div><dt>상태</dt><dd>' + esc(order.status) + '</dd></div></dl>' +
      '<div class="order-modal-lines">' + rows + '</div>' +
      '<div class="order-modal-total"><span>총 결제 금액</span><strong>' + esc(order.total) + '</strong></div>' +
      '<div class="order-modal-note"><span>배송지</span><p>' + shipAddressText(stored && stored.ship_to) + '</p></div>' +
      '<button type="button" class="btn-fill order-modal-action" data-order-close>확인</button>'
    );
  }
  function openDeliveryTracking(trigger) {
    var order = readOrderCard(trigger);
    if (!order) return;
    var status = order.status || "";
    var active = status.indexOf("완료") > -1 ? 4 : status.indexOf("배송 중") > -1 ? 3 : 2;
    var steps = ["결제 완료", "상품 준비", "배송 중", "배송 완료"].map(function (step, i) {
      return '<li class="' + (i < active ? 'is-active' : '') + '"><span></span><b>' + step + '</b></li>';
    }).join("");
    openOrderModal(
      '<span class="order-modal-kicker">Delivery Tracking</span>' +
      '<h3>배송 조회</h3>' +
      '<dl class="order-modal-meta"><div><dt>주문번호</dt><dd>' + esc(order.no) + '</dd></div><div><dt>배송 상태</dt><dd>' + esc(order.status) + '</dd></div></dl>' +
      '<ol class="tracking-steps">' + steps + '</ol>' +
      '<div class="order-modal-note"><span>택배사</span><p>CRESTO 지정 배송 · 운송장 6021-2048-7710</p></div>' +
      '<button type="button" class="btn-fill order-modal-action" data-order-close>확인</button>'
    );
  }
  function wireAutoplayMedia() {
    document.querySelectorAll("video[autoplay]").forEach(function (video) {
      video.muted = true;
      video.playsInline = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    });
  }

  /* 페이지 전환 오버레이는 제거됨 — 링크는 브라우저 기본대로 즉시 이동한다
     (흰 페이드 + 170ms 지연이 오히려 매 이동을 새로고침처럼 느끼게 했음). */

  function init() {
    if (guardMemberPages()) return;
    buildHeader();
    normalizeServiceShell();
    buildSearchOverlay();
    buildDrawer();
    wireLogout();
    wireAuthForms();
    wireContactForms();
    buildNewsletter();
    renderFooter();
    buildFooterSNS();
    showPendingNotice();
    renderProductDetail();
    wireProductPage();
    wireAddToCart();
    wireQuickAdd();
    renderProductGrids();
    wireCatalogLinks();
    renderHomeCards();
    wireHomeInteractions();
    wireDemoLinks();
    renderCartPage();
    renderOrdersPage();
    renderWishlist();
    renderRecent();
    wireProfile();
    wireMemberStats();
    wireAutoplayMedia();
    setupReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
