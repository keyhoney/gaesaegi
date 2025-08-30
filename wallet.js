(function () {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function fmt(n) { return Number(n||0).toLocaleString(); }

  async function loadPoints() {
    try {
      // 상점과 동일한 로직으로 가용 포인트 계산
      const sum = await window.firebaseData?.sumDailyStats?.();
      const base = Number(sum?.totalPoints || 0);
      // 모든 포인트 트랜잭션을 반영 (차감은 음수, 적립은 양수)
      const tx = await window.firebaseData?.listAllTransactions?.();
      const adjust = (tx||[])
        .filter(t => (t.type||'point') === 'point')
        .reduce((s, t) => s + Number(t.amount||0), 0);
      const availPoints = base + adjust;
      el('ptAvail').textContent = fmt(availPoints);
    } catch {}
  }

  async function loadCoins() {
    try {
      const w = await window.firebaseData?.getWallet?.();
      // 현재 사용 가능한 코인(coins) 기준으로 표시
      el('coinAvail').textContent = fmt(w?.coins||0);
    } catch {}
  }

  async function renderBoosterBadge() {
    try {
      const info = await window.firebaseData?.getBoosterInfo?.();
      let badge = document.getElementById('boosterBadge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'boosterBadge';
        badge.className = 'badge';
        badge.style.cssText = 'margin-top:8px; display:inline-block; padding:6px 10px; border-radius:999px; background:rgba(201,166,107,0.15); color:#6B383E; font-weight:700;';
        const container = document.querySelector('.container');
        container && container.insertAdjacentElement('afterbegin', badge);
      }
      if (info?.active) {
        const remainMs = Math.max(0, Number(info.expiresAtMs||0) - Date.now());
        const hours = Math.floor(remainMs/3600000);
        const mins = Math.floor((remainMs%3600000)/60000);
        badge.textContent = `⚡ 2배 부스터 활성화: ${hours}시간 ${mins}분 남음 (포인트/일일한도 2배)`;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    } catch {}
  }

  function itemRow(it) {
    const used = it.used ? '사용됨' : '보유중';
    const actions = it.used ? '' : `
      <div class="actions">
        <button class="btn small" data-use="${it.id}">사용하기</button>
        <button class="btn ghost small" data-refund="${it.id}">환불하기(수수료 10%)</button>
      </div>`;
    return `<div class="row">
      <div class="line top"><div class="meta">${it.name||it.id} · ${used}</div></div>
      <div class="line bottom"><div class="id">가격: ${fmt(it.costPoints||0)}pt / ${fmt(it.costCoins||0)}coin</div>${actions}</div>
    </div>`;
  }

  async function loadItems() {
    try {
      const list = await window.firebaseData?.listMyItems?.();
      const box = el('itemList');
      if (!list || list.length === 0) { box.textContent = '보유 아이템이 없습니다.'; return; }
      box.innerHTML = list.map(itemRow).join('');
      box.querySelectorAll('[data-use]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-use');
        const res = await window.firebaseData?.useItem?.(id);
        if (res?.ok) {
          // 부스터면 효과 활성화
          const it = (await window.firebaseData?.listMyItems?.())?.find(x => x.id === id) || {};
          if (it?.sku === 'booster2x') {
            await window.firebaseData?.activateBooster?.(48);
            window.showToast && window.showToast('부스터 활성화! 48시간 동안 포인트/일일한도 2배', 'success');
          }
          if (it?.sku === 'coin1') { await window.firebaseData?.addCoins?.(1, 'shop:coin1'); window.showToast && window.showToast('코인 1개가 충전되었습니다.', 'success'); }
          loadItems();
        }
        else { window.showToast && window.showToast('아이템 사용에 실패했어요.', 'error'); }
      }));
      box.querySelectorAll('[data-refund]').forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-refund');
        if (!confirm('환불하시겠어요? (수수료 10%)')) return;
        const res = await window.firebaseData?.refundItem?.(id);
        if (res?.ok) {
          window.showToast && window.showToast(`환불 완료: +${fmt(res.refundPoints||0)}pt, +${fmt(res.refundCoins||0)}coin`, 'success');
          loadPoints(); loadCoins(); loadItems();
        } else {
          window.showToast && window.showToast('환불에 실패했어요.', 'error');
        }
      }));
    } catch {}
  }



  window.addEventListener('load', async () => {
          // 자동 포인트 정상화 (지갑 페이지 접속 시) - 조용히 실행
      try {
        const uid = await window.firebaseData?.getCurrentUserUid?.();
        if (uid) {
          const fixResult = await window.firebaseData?.autoFixPointsOnLogin?.();
          if (fixResult?.success && fixResult.adjustment !== 0) {
            console.log('지갑 페이지 자동 포인트 정상화 완료:', fixResult);
            // 사용자에게 알림하지 않고 조용히 처리
          }
        }
      } catch (e) {
        console.error('지갑 페이지 자동 포인트 정상화 오류:', e);
      }
    
    loadPoints(); loadCoins(); loadItems(); renderBoosterBadge();
    setInterval(renderBoosterBadge, 60000);
  });
})();


