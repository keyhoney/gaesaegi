// Firestore Security Rules 진단 프로브
// 브라우저 콘솔에서 실행하여 어떤 경로가 403 오류를 발생시키는지 확인

async function probe() {
  const db = window.firebase?.firestore?.(); // 프로젝트 초기화에서 쓰는 db 참조로 교체
  const uid = (await window.firebaseData?.getUid?.()) || 'YOUR_UID';

  console.log('🔍 Firestore 규칙 진단 시작...');
  console.log('사용자 UID:', uid);

  const tests = [
    {
      name: 'orders update (2개 필드)',
      ref: db.doc('market/public/orders/y8cWB7Bija1pHwpaV9G2'),
      op: () => db.doc('market/public/orders/y8cWB7Bija1pHwpaV9G2')
                  .update({ qtyRemaining: 0, status: 'filled' })
    },
    {
      name: 'settlement upsert(update + transform)',
      ref: db.doc('market/public/settlements/_probe_1'),
      op: () => db.doc('market/public/settlements/_probe_1').set({
        buyerUid: uid, sellerUid: uid, price: 1000, qty: 1,
        buyerClaimed: false, sellerClaimed: false
      }, { merge: true }).then(()=>db.doc('market/public/settlements/_probe_1')
          .update({ /* no data */ }, { /* no options */ }))
    },
    {
      name: 'trades write (transform at)',
      ref: db.doc('market/public/trades/_probe_1'),
      op: () => db.doc('market/public/trades/_probe_1').set({
        side:'trade', price:1000, qty:1
      }, { merge:true })
    },
    {
      name: 'ticker partial update',
      ref: db.doc('market/public/ticker/main'),
      op: () => db.doc('market/public/ticker/main').set({ lastPrice: 1000 }, { merge: true })
    },
    {
      name: 'user trades (owner path)',
      ref: db.doc(`users/${uid}/trades/_probe_1`),
      op: () => db.doc(`users/${uid}/trades/_probe_1`).set({ side:'buy', price:1000, qty:1 }, { merge:true })
    }
  ];

  for (const t of tests) {
    try { 
      await t.op(); 
      console.log('✅ [OK]', t.name); 
    }
    catch (e) { 
      console.warn('❌ [DENY]', t.name, e?.code, e?.message); 
    }
  }
  
  console.log('🔍 진단 완료');
}

// 실행
probe();
