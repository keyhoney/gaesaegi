(function () {
  'use strict';

  const lastPriceEl = document.getElementById('lastPrice');
  const changeEl = document.getElementById('changePct');
  const balancesEl = document.getElementById('balances');
  const publicBox = document.getElementById('publicTrades');
  const myBox = document.getElementById('myTrades');

  function fmt(n) { return Number(n||0).toLocaleString(); }

  let priceChart, volumeChart;
  const candleData = []; // 일봉 OHLC
  const volumeData = []; // 일봉 거래량
  let latestTradePrice = null; // 최신 체결가
  let isMatchingRunning = false; // 매칭 작업 동시 실행 방지
  let matchIntervalMs = 3600000;   // 매칭 실행 주기 (1시간)
  let lastMatchHour = -1;      // 마지막 매칭이 실행된 시간

  function initChart() {
    priceChart = echarts.init(document.getElementById('priceChart'));
    volumeChart = echarts.init(document.getElementById('volumeChart'));
    priceChart.setOption({
      grid: { left: 50, right: 20, top: 10, bottom: 28 },
      xAxis: { type: 'category', boundaryGap: true, data: [] },
      yAxis: { scale: true },
      tooltip: { show: false },
      series: [{
        name:'가격',
        type: 'candlestick',
        data: [],
        itemStyle: {
          color: '#c62828',       // 상승(시가 대비 종가 상승) - 붉은색 (오더북 ask 색상)
          borderColor: '#c62828',
          color0: '#1565c0',      // 하락(시가 대비 종가 하락) - 푸른색 (오더북 bid 색상)
          borderColor0: '#1565c0'
        }
      }],
    });
    volumeChart.setOption({
      grid: { left: 50, right: 20, top: 10, bottom: 10 },
      xAxis: { type: 'category', boundaryGap: true, data: [], axisLabel: { show: false } },
      yAxis: { splitNumber: 2 },
      tooltip: { show: false },
      series: [{ 
        name:'거래량', 
        type: 'bar', 
        data: [],
        itemStyle: {
          color: '#1565c0'  // 오더북 bid 색상과 통일
        }
      }],
    });
  }

  function rebuildCandles(trades) {
    // 일봉 집계(하루 1캔들) - Asia/Seoul 기준, 과거 전체 기록 포함
    function seoulDateKey(ms) {
      try {
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
        return fmt.format(new Date(ms));
      } catch { return new Date(ms).toISOString().slice(0,10); }
    }
    const byDay = new Map();
    for (const t of trades||[]) {
      const ms = t.at?.toDate ? t.at.toDate().getTime() : (t.at? Date.parse(t.at) : Date.now());
      const key = seoulDateKey(ms);
      const price = Number(t.price||0), qty = Number(t.qty||0);
      const v = byDay.get(key) || { o: price, h: price, l: price, c: price, v: 0 };
      if (!byDay.has(key)) {
        v.o = price; v.h = price; v.l = price; v.c = price; v.v = 0;
      }
      // 집계 시 이상치 보정: 음수/NaN 가격은 무시
      if (Number.isFinite(price) && price > 0) {
        v.h = Math.max(v.h, price);
        v.l = Math.min(v.l, price);
        v.c = price; // 마지막 체결가를 종가로
        v.v += Number.isFinite(qty) ? qty : 0;
      }
      byDay.set(key, v);
    }
    // 키(날짜) 오름차순 정렬
    const keys = Array.from(byDay.keys()).sort();
    const xs = keys;
    // ECharts 캔들 표준 순서: [open, close, low, high]
    const kline = keys.map(k => { const v = byDay.get(k); return [v.o, v.c, v.l, v.h]; });
    const vols = keys.map(k => byDay.get(k).v);
    priceChart.setOption({
      xAxis: { data: xs },
      series: [{
        type:'candlestick',
        data: kline,
        name:'가격',
        itemStyle: {
          color: '#c62828',
          borderColor: '#c62828',
          color0: '#1565c0',
          borderColor0: '#1565c0'
        }
      }]
    });
    volumeChart.setOption({ xAxis: { data: xs }, series: [{ type:'bar', data: vols, name:'거래량' }] });
  }

  async function refreshTicker() {
    try {
      // 과거 365일 거래 조회 → 최신 체결가 및 전일 종가 대비 변동률
      const trades365 = await window.firebaseData?.tradingListTradesSinceHours?.(24*365);
      const list = Array.isArray(trades365) ? trades365.slice() : [];
      list.sort((a,b)=>{
        const ta = a.at?.toDate ? a.at.toDate().getTime() : (a.at ? Date.parse(a.at) : 0);
        const tb = b.at?.toDate ? b.at.toDate().getTime() : (b.at ? Date.parse(b.at) : 0);
        return ta - tb;
      });

      // 최신 체결가
      const last = list.length ? list[list.length-1] : null;
      if (last) { latestTradePrice = Number(last.price||0)||0; lastPriceEl.textContent = fmt(latestTradePrice); }
      else { latestTradePrice = null; lastPriceEl.textContent = '-'; }

      // 전일 종가 구하기(Asia/Seoul 일자 기준)
      const dtf = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' });
      const closeByDay = new Map(); // key -> close price
      const volByDay = new Map();   // key -> total volume
      const sumByDay = new Map();   // key -> sum price (평균가 계산용)
      const cntByDay = new Map();   // key -> 거래 수
      for (const tr of list) {
        const ms = tr.at?.toDate ? tr.at.toDate().getTime() : (tr.at ? Date.parse(tr.at) : 0);
        const key = dtf.format(new Date(ms));
        closeByDay.set(key, Number(tr.price||0));
        volByDay.set(key, (volByDay.get(key)||0) + Number(tr.qty||0));
        sumByDay.set(key, (sumByDay.get(key)||0) + Number(tr.price||0));
        cntByDay.set(key, (cntByDay.get(key)||0) + 1);
      }
      const keys = Array.from(closeByDay.keys());
      const lastKey = keys.length ? keys[keys.length-1] : null;
      const prevKey = keys.length>=2 ? keys[keys.length-2] : null;
      const prevClose = prevKey ? Number(closeByDay.get(prevKey)||0) : 0;
      let changePct = 0;
      if (prevClose > 0 && latestTradePrice!=null) {
        changePct = ((latestTradePrice - prevClose) / prevClose) * 100;
      }
      changeEl.textContent = `${changePct.toFixed(2)}%`;
      changeEl.style.background = changePct >= 0 ? 'rgba(111,207,151,0.2)' : 'rgba(198,40,40,0.2)';

      // 차트/통계 갱신
      rebuildCandles(list);
      if (lastKey) {
        const vol = Number(volByDay.get(lastKey)||0);
        const cnt = Number(cntByDay.get(lastKey)||0);
        const sum = Number(sumByDay.get(lastKey)||0);
        document.getElementById('statVol').textContent = fmt(vol);
        document.getElementById('statAvg').textContent = cnt ? fmt((sum/cnt).toFixed(0)) : '-';
      } else {
        document.getElementById('statVol').textContent = '-';
        document.getElementById('statAvg').textContent = '-';
      }
    } catch {}
  }

  async function refreshBalances() {
    const b = await window.firebaseData?.tradingGetBalances?.();
    // 현재 사용 가능한 포인트/코인 표기
    balancesEl.textContent = `보유: ${fmt(b.points)} pt / ${fmt(b.coins)} coin`;
  }

  function renderTrades(box, list) {
    if (!list || list.length === 0) { box.textContent = '기록이 없습니다.'; return; }
    const fmtTime = new Intl.DateTimeFormat('ko-KR', { timeStyle: 'medium' });
    box.innerHTML = list.map(tr => {
      const side = tr.side === 'buy' ? '매수' : '매도';
      return `<div class="row"><div class="line top"><div class="meta">${side}</div></div><div class="line bottom"><div class="id">${fmt(tr.price)} pt · ${fmt(tr.qty)} coin</div><div class="diff">${fmtTime.format(tr.at?.toDate ? tr.at.toDate() : new Date())}</div></div></div>`;
    }).join('');
  }

  async function refreshTrades() {
    const all = await window.firebaseData?.tradingListRecentTrades?.(50);
    renderTrades(publicBox, all);
    // 최근 체결 테이블(zebra)
    try {
      const tbody = document.getElementById('tradesTbody');
      if (tbody) {
        const fmtTime = new Intl.DateTimeFormat('ko-KR',{ timeStyle:'medium' });
        tbody.innerHTML = (all||[]).slice(0,10).map(tr=>{
          const t = tr.at?.toDate ? tr.at.toDate() : new Date();
          return `<tr><td>${fmtTime.format(t)}</td><td>${fmt(tr.price)}</td><td>${fmt(tr.qty)}</td></tr>`;
        }).join('') || '';
      }
    } catch {}
    try {
      const mine = await window.firebaseData?.tradingListMyTrades?.(50);
      renderTrades(myBox, mine||[]);
    } catch { renderTrades(myBox, []); }
  }

  async function placeOrder(side) {
    side = String(side||'');
    const price = Number(document.getElementById('price').value);
    const qty = Number(document.getElementById('qty').value);
    const msg = document.getElementById('orderMsg');
    msg.textContent = '';
    try {
      // 인증 확인
      try {
        const ok = await window.firebaseData?.isAuthenticated?.();
        if (!ok) { msg.textContent = '로그인이 필요합니다.'; msg.style.color = '#c62828'; return; }
      } catch {}
      if (!side || (side !== 'buy' && side !== 'sell')) {
        msg.textContent = '주문 종류를 선택해 주세요.'; msg.style.color = '#c62828'; return;
      }
      if (!Number.isFinite(price) || !Number.isFinite(qty)) {
        msg.textContent = '가격/수량 입력이 올바르지 않습니다.'; msg.style.color = '#c62828'; return;
      }
      const res = await window.firebaseData?.tradingPlaceOrder?.(side, price, qty);
      if (!res?.ok) {
        let m = '주문 실패';
        if (res?.error === 'price-cap') m = '매도 가격은 1,500pt를 초과할 수 없습니다.';
        if (res?.error === 'insufficient-points') m = '포인트가 부족합니다.';
        if (res?.error === 'insufficient-coins') m = '코인이 부족합니다.';
        if (res?.error === 'invalid') m = '가격/수량이 유효하지 않습니다.';
        msg.textContent = m; msg.style.color = '#c62828';
        return;
      }
      msg.textContent = '주문 접수 완료 (체결 대기)'; msg.style.color = 'inherit';
      window.showToast && window.showToast('주문이 접수되었습니다. 호가 일치 시 자동 체결됩니다.', 'info');
      await refreshBalances();
      await refreshOrderbook();
    } catch (e) {
      msg.textContent = `주문 실패: ${e?.message || e}`; msg.style.color = '#c62828';
    }
  }

  function renderOrderbook(ob) {
    const bidsRaw = ob.bids || []; const asksRaw = ob.asks || [];
    // 정렬: 두 쪽 모두 가격이 높을수록 상단에 오도록 내림차순
    const bids = bidsRaw.slice().sort((a,b)=>Number(b[0]) - Number(a[0]));
    const asks = asksRaw.slice().sort((a,b)=>Number(b[0]) - Number(a[0]));
    // 누적 수량 계산
    let cum = 0; const bidsCum = bids.map(([p,q])=>{ cum+=q; return [p,q,cum]; });
    cum = 0; const asksCum = asks.map(([p,q])=>{ cum+=q; return [p,q,cum]; });
    const maxCum = Math.max(1, ...(bidsCum.map(([, ,c])=>c)), ...(asksCum.map(([, ,c])=>c)));

    function obRows(rows, side) {
      return rows.map(([price, qty, cumQty])=>{
        const w = Math.max(0.04, Math.min(1, cumQty / maxCum));
        return `<div class=\"ob-row ${side}\" style=\"--w:${w};\">`
          + `<div class=\"ob-price ${side}\">${fmt(price)} pt</div>`
          + `<div class=\"ob-qty\">${fmt(qty)}</div>`
          + `</div>`;
      }).join('');
    }

    const mid = (()=>{
      const bestBid = bids.length? Number(bids[0][0]) : null; // 최고 매수
      const bestAsk = asks.length? Number(asks[asks.length-1][0]) : null; // 최저 매도 (asks는 내림차순 정렬이므로 마지막이 최저)
      if (bestBid!=null && bestAsk!=null) return Math.round((bestBid+bestAsk)/2);
      return (bestBid!=null? bestBid : (bestAsk!=null? bestAsk : '-'));
    })();

    const tradeCenter = (latestTradePrice!=null)? latestTradePrice : mid;
    const centerHtml = `<div class=\"ob-center\">`
      + `<div>체결가</div><div>${fmt(tradeCenter)} pt</div>`
      + `</div>`;

    const html = `
      <div class="orderbook"> 
        <div class="ob-section">
          <div class="ob-title ask">매도호가창</div>
          <div class="ob-rows">${obRows(asksCum, 'ask') || '<div class="muted">매도 호가 없음</div>'}</div>
        </div>
        ${centerHtml}
        <div class="ob-section">
          <div class="ob-title bid">매수호가창</div>
          <div class="ob-rows">${obRows(bidsCum, 'bid') || '<div class="muted">매수 호가 없음</div>'}</div>
        </div>
      </div>`;
    document.getElementById('orderbook').innerHTML = html;
  }

  async function refreshOrderbook() {
    const ob = await window.firebaseData?.tradingListOrderbook?.(20);
    renderOrderbook(ob||{});
    // 미니 호가(5개) 고정 표시
    try {
      const mini = document.getElementById('miniOrderbook');
      if (mini && ob) {
        const bids = (ob.bids||[]).slice(0,5);
        const asks = (ob.asks||[]).slice(0,5);
        const row = (p,q,cls)=>`<div class="row ${cls}"><div>${fmt(p)} pt</div><div>${fmt(q)} coin</div></div>`;
        mini.innerHTML = [
          ...asks.map(([p,q])=>row(p,q,'ask')).reverse(),
          ...bids.map(([p,q])=>row(p,q,'bid')),
        ].join('') || '호가가 없습니다.';
      }
    } catch {}
  }

  async function refreshMyOrders() {
    const mine = await window.firebaseData?.tradingListMyOrders?.();
    const box = document.getElementById('myOrders');
    if (!mine || mine.length===0) { box.textContent = '오픈 주문이 없습니다.'; return; }
    box.innerHTML = mine.map(o=>`<div class=\"row\"><div class=\"line top\"><div class=\"meta\">${o.side==='buy'?'매수':'매도'} ${fmt(o.price)} pt</div></div><div class=\"line bottom\"><div class=\"id\">잔량 ${fmt(o.qtyRemaining||o.qty)} coin</div><div class=\"actions\"><button class=\"btn small\" data-cancel=\"${o.id}\">취소</button></div></div></div>`).join('');
    box.querySelectorAll('[data-cancel]').forEach(btn=>btn.addEventListener('click', async()=>{ const id=btn.getAttribute('data-cancel'); const r=await window.firebaseData?.tradingCancelOrder?.(id); if(r?.ok){ window.showToast&&window.showToast('주문 취소 완료','success'); refreshMyOrders(); refreshOrderbook(); refreshBalances(); } else { window.showToast&&window.showToast('취소 실패','error'); } }));
  }

  window.addEventListener('load', async () => {
    initChart();
    await refreshBalances();
    await refreshTicker();
    await refreshOrderbook();
    await refreshMyOrders();
    await refreshTrades();
    document.getElementById('placeBuyBtn').addEventListener('click', ()=>placeOrder('buy'));
    document.getElementById('placeSellBtn').addEventListener('click', ()=>placeOrder('sell'));
    if (!window.__gsgIntervalsSet) {
      window.__gsgIntervalsSet = true;
      setInterval(refreshTicker, 8000);
      setInterval(refreshOrderbook, 9000);
      setInterval(refreshMyOrders, 10000);
      setInterval(refreshTrades, 11000);
      // 체결 매칭: 매 시 정각마다 실행
      const attemptMatch = async () => {
        try {
          if (document.hidden) return; // 탭이 백그라운드일 때는 쉬기
          if (isMatchingRunning) return;
          
          const now = new Date();
          const currentHour = now.getHours(); // 현재 시간 (0-23)
          
          // 이미 이번 시간에 매칭을 실행했다면 스킵
          if (lastMatchHour === currentHour) return;
          
          isMatchingRunning = true;
          lastMatchHour = currentHour;

          await window.firebaseData?.tradingMatchOnce?.();
          try {
            const st = await window.firebaseData?.tradingListMySettlements?.();
            const toClaim = [...(st?.buy||[]), ...(st?.sell||[])];
            for (const s of toClaim) { await window.firebaseData?.tradingClaimSettlement?.(s.id); }
            if (toClaim.length>0) { refreshBalances(); refreshTicker(); refreshOrderbook(); refreshMyOrders(); }
          } catch {}

        } catch (e) {
          console.warn('매칭 실행 중 오류:', e);
        } finally {
          isMatchingRunning = false;
        }
      };
      // 매 시 정각마다 매칭 실행 (1초마다 체크)
      setInterval(attemptMatch, 1000);
    }
  });
})();


