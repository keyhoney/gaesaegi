(function () {
  'use strict';

  const CATEGORIES = [
    { id: 'all', name: '전체' },
    { id: 'voucher', name: '교환권' },
    { id: 'special', name: '특별 아이템' },
  ];

  const PRODUCTS = [
    // 교환권
    { id: 'chicken', category: 'voucher', name: '치킨 교환권', price: 200000, minLevel: 1, icon: '🍗', desc: '치킨 1마리 교환권' },
    { id: 'tteokbokki', category: 'voucher', name: '엽기 떡볶이', price: 150000, minLevel: 1, icon: '🍲', desc: '엽떡 배달 교환권' },
    // 특별 아이템
    { id: 'booster2x', category: 'special', name: '포인트 2배 부스터(48h)', price: 2000, minLevel: 10, icon: '⚡', desc: '사용 후 48시간 동안 포인트 적립 2배' },
    { id: 'coin1', category: 'special', name: '코인 1개', price: 1500, minLevel: 5, icon: '🪙', desc: '지갑에 코인 1개 충전' },
  ];

  function el(id) { return document.getElementById(id); }
  function fmt(n) { return Number(n||0).toLocaleString(); }

  async function getLevel() {
    try {
      const sum = await window.firebaseData?.sumDailyStats?.();
      // 동일 로직으로 레벨 계산 재사용
      const totalExp = Number(sum?.totalExp || 0);
      let level = 1, cap = 0; const need = (l) => 1000 * Math.pow(1.2, Math.max(0, l-1));
      while (totalExp >= cap + need(level)) { cap += need(level); level++; if (level>300) break; }
      return level;
    } catch { return 1; }
  }

  async function getAvailPoints() {
    try {
      // 기본 포인트는 일일 통계 합계(totalPoints)
      const sum = await window.firebaseData?.sumDailyStats?.();
      const base = Number(sum?.totalPoints || 0);
      // 모든 포인트 트랜잭션을 반영 (차감은 음수, 적립은 양수)
      const tx = await window.firebaseData?.listAllTransactions?.();
      const adjust = (tx||[])
        .filter(t => (t.type||'point') === 'point')
        .reduce((s, t) => s + Number(t.amount||0), 0);
      

      
      return base + adjust;
    } catch (error) { 
      console.error('getAvailPoints 오류:', error);
      return 0; 
    }
  }

  function productCard(p, level, pt) {
    const minLv = Number(p.minLevel || 1);
    const canLevel = level >= minLv;
    const canPoint = pt >= p.price;
    const canBuy = canLevel && canPoint;
    const levelReqText = minLv > 1 ? `Lv${minLv} 이상 구매 가능` : '';
    const metaParts = [ `${fmt(p.price)} pt`, levelReqText ].filter(Boolean);
    return `<div class="row">
      <div class="line top"><div class="meta">${p.icon} ${p.name}</div></div>
      <div class="line bottom"><div class="id">${p.desc}</div><div class="diff">${metaParts.join(' · ')}</div><div class="actions"><button class="btn small" data-buy="${p.id}" ${canBuy? '' : 'disabled'}>${canBuy? '구매' : (!canLevel? '레벨 부족' : '포인트 부족')}</button></div></div>
    </div>`;
  }

  function renderTabs() {
    const tabs = el('catTabs');
    tabs.innerHTML = '';
    CATEGORIES.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = `tab${i===0?' active':''}`; b.textContent = c.name; b.dataset.cat = c.id;
      b.addEventListener('click', () => {
        tabs.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        loadProducts(c.id);
      });
      tabs.appendChild(b);
    });
  }

  async function loadHeader() {
    const pt = await getAvailPoints();
    const level = await getLevel();
    el('ptAvail').textContent = fmt(pt);
    el('levelNow').textContent = `Lv. ${level}`;
    return { pt, level };
  }

  async function loadProducts(cat) {
    const { pt, level } = await loadHeader();
    const list = el('productList');
    const items = PRODUCTS.filter(p => !cat || cat === 'all' || p.category === cat);
    // 제목 갱신
    const active = CATEGORIES.find(c => c.id === cat) || CATEGORIES[0];
    const title = el('catTitle');
    if (title) title.textContent = `${active.name} 상품`;
    list.innerHTML = items.map(p => productCard(p, level, pt)).join('') || '상품이 없습니다.';
    list.querySelectorAll('[data-buy]').forEach(btn => btn.addEventListener('click', async () => {
      const pid = btn.getAttribute('data-buy');
      const p = PRODUCTS.find(x => x.id === pid);
      if (!p) return;
      if (!confirm(`${p.name}을(를) ${fmt(p.price)}pt로 구매하시겠어요?`)) return;
      // 포인트 차감 처리: 지갑 트랜잭션 기준(가용 포인트에서 차감)
      try {
        const avail = await getAvailPoints();
        if (avail < p.price) { window.showToast && window.showToast('포인트가 부족합니다.', 'error'); return; }
        const purchaseResult = await window.firebaseData?.addPurchase?.({ id: p.id, name: p.name, category: p.category, price: p.price, icon: p.icon });
        window.showToast && window.showToast('구매가 완료되었습니다.', 'success');
        // 잔고와 상품 목록을 즉시 업데이트
        await loadHeader();
        loadProducts(CATEGORIES.find(x=>el('catTabs').querySelector('.tab.active')?.dataset.cat===x.id)?.id || cat);
        loadPurchases();
      } catch {
        window.showToast && window.showToast('구매 처리 중 오류가 발생했습니다.', 'error');
      }
    }));
  }

  async function loadPurchases() {
    try {
      const list = await window.firebaseData?.listPurchases?.();
      const box = el('purchaseList');
      if (!list || list.length === 0) { box.textContent = '구매 내역이 없습니다.'; return; }
      const fmtTime = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
      box.innerHTML = list.map(p => {
        const when = p.purchasedAt?.toDate ? fmtTime.format(p.purchasedAt.toDate()) : '';
        return `<div class="row"><div class="line top"><div class="meta">${p.icon||'🛒'} ${p.name}</div></div><div class="line bottom"><div class="id">${fmt(p.price)} pt</div><div class="diff">${when}</div></div></div>`;
      }).join('');
    } catch {}
  }

  window.addEventListener('load', async () => {
    renderTabs();
    await loadHeader();
    await loadProducts(CATEGORIES[0].id);
    await loadPurchases();
  });
})();


