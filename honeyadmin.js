(function () {
  'use strict';

  // 관리자 UID
  const ADMIN_UID = 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2';
  
     // 전역 변수
   let currentUserUid = null;
   let allUsers = [];
   let allBalances = [];
   let allPurchases = [];
   let allLotteryTickets = [];
   let allCoinHistory = [];

  // 숫자 포맷팅 함수
  function formatNumber(num) {
    return Number(num || 0).toLocaleString();
  }

  // 날짜 포맷팅 함수
  function formatDate(timestamp) {
    if (!timestamp) return '-';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return '-';
    }
  }

  // 사용자 정보 표시 함수
  function renderUserInfo(user) {
    const className = user.className || user.class || '미분반';
    const studentNumber = user.studentNumber || user.number || '미번호';
    const name = user.name || user.displayName || '미이름';
    const initials = name.substring(0, 2).toUpperCase();
    
    return `
      <div class="user-info">
        <div class="user-avatar">${initials}</div>
        <div class="user-details">
          <div class="user-name">${name}</div>
          <div class="user-email">${className} ${studentNumber}번</div>
        </div>
      </div>
    `;
  }

  // 접근 권한 확인
  async function checkAdminAccess() {
    try {
      console.log('관리자 접근 권한 확인 시작...');
      
      // Firebase 초기화 확인
      if (!window.firebaseData) {
        console.error('firebaseData가 초기화되지 않았습니다.');
        return false;
      }
      
      // 인증 상태 확인
      const isAuth = await window.firebaseData?.isAuthenticated?.();
      console.log('인증 상태:', isAuth);
      
      if (!isAuth) {
        console.log('로그인되지 않음');
        document.getElementById('accessDenied').style.display = 'block';
        document.getElementById('adminContent').style.display = 'none';
        return false;
      }
      
      const uid = await window.firebaseData?.getCurrentUserUid?.();
      console.log('현재 사용자 UID:', uid);
      console.log('관리자 UID:', ADMIN_UID);
      
      if (uid === ADMIN_UID) {
        console.log('관리자 권한 확인됨');
        currentUserUid = uid;
        document.getElementById('accessDenied').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        return true;
      } else {
        console.log('관리자 권한 없음');
        document.getElementById('accessDenied').style.display = 'block';
        document.getElementById('adminContent').style.display = 'none';
        return false;
      }
    } catch (error) {
      console.error('접근 권한 확인 실패:', error);
      document.getElementById('accessDenied').style.display = 'block';
      document.getElementById('adminContent').style.display = 'none';
      return false;
    }
  }

  // 모든 사용자 정보 가져오기
  async function fetchAllUsers() {
    try {
      console.log('사용자 정보 가져오기 시작...');
      
      const { db } = await window.getFirebaseAppAndDb();
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      
      console.log('Firebase DB 객체:', !!db);
      console.log('현재 관리자 UID:', currentUserUid);
      
      const usersRef = collection(db, 'users');
      console.log('users 컬렉션 참조 생성됨');
      
      const snapshot = await getDocs(usersRef);
      console.log('사용자 스냅샷:', { 
        empty: snapshot.empty, 
        size: snapshot.size,
        docs: snapshot.docs.length 
      });
      
      allUsers = [];
      snapshot.forEach(doc => {
        const userData = doc.data();
        console.log('사용자 문서:', { id: doc.id, data: userData });
        allUsers.push({
          uid: doc.id,
          ...userData
        });
      });
      
      console.log(`총 ${allUsers.length}명의 사용자 정보를 가져왔습니다.`);
      console.log('사용자 목록:', allUsers.map(u => ({ uid: u.uid, name: u.name || u.displayName })));
      return allUsers;
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error);
      console.error('오류 상세:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // 사용자별 잔액 정보 가져오기
  async function fetchAllBalances() {
    try {
      console.log('잔액 정보 가져오기 시작...');
      console.log('처리할 사용자 수:', allUsers.length);
      
      const { db } = await window.getFirebaseAppAndDb();
      const { collection, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      
      allBalances = [];
      
      for (const user of allUsers) {
        try {
          console.log(`사용자 ${user.uid} 잔액 정보 처리 중...`);
          
          // 지갑 정보
          const walletRef = doc(db, 'users', user.uid, 'wallet', 'main');
          const walletSnap = await getDoc(walletRef);
          const wallet = walletSnap.exists() ? walletSnap.data() : { coins: 0, totalCoins: 0 };
          console.log(`사용자 ${user.uid} 지갑 정보:`, wallet);
          
          // 일일 통계 합계 (포인트 계산용)
          const dailyStatsRef = collection(db, 'users', user.uid, 'dailyStats');
          const dailyStatsSnap = await getDocs(dailyStatsRef);
          let totalPoints = 0;
          dailyStatsSnap.forEach(doc => {
            const data = doc.data();
            totalPoints += Number(data.points || 0);
          });
          console.log(`사용자 ${user.uid} 총 포인트:`, totalPoints);
          
          allBalances.push({
            uid: user.uid,
            user: user,
            coins: Number(wallet.coins || 0),
            totalCoins: Number(wallet.totalCoins || 0),
            points: totalPoints
          });
        } catch (error) {
          console.error(`사용자 ${user.uid} 잔액 정보 가져오기 실패:`, error);
        }
      }
      
      console.log(`총 ${allBalances.length}명의 잔액 정보를 가져왔습니다.`);
      return allBalances;
    } catch (error) {
      console.error('잔액 정보 가져오기 실패:', error);
      throw error;
    }
  }

  // 모든 구매 내역 가져오기
  async function fetchAllPurchases() {
    try {
      const { db } = await window.getFirebaseAppAndDb();
      const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      
      allPurchases = [];
      
      for (const user of allUsers) {
        try {
          const purchasesRef = collection(db, 'users', user.uid, 'purchases');
          const purchasesQuery = query(purchasesRef, orderBy('purchasedAt', 'desc'));
          const purchasesSnap = await getDocs(purchasesQuery);
          
          purchasesSnap.forEach(doc => {
            const purchaseData = doc.data();
            allPurchases.push({
              id: doc.id,
              uid: user.uid,
              user: user,
              ...purchaseData
            });
          });
        } catch (error) {
          console.error(`사용자 ${user.uid} 구매 내역 가져오기 실패:`, error);
        }
      }
      
      return allPurchases;
    } catch (error) {
      console.error('구매 내역 가져오기 실패:', error);
      throw error;
    }
  }

     // 모든 로또 내역 가져오기
   async function fetchAllLotteryTickets() {
     try {
       const { db } = await window.getFirebaseAppAndDb();
       const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
       
       allLotteryTickets = [];
       
       for (const user of allUsers) {
         try {
           const lotteryRef = collection(db, 'users', user.uid, 'lotteryTickets');
           const lotteryQuery = query(lotteryRef, orderBy('at', 'desc'));
           const lotterySnap = await getDocs(lotteryQuery);
           
           lotterySnap.forEach(doc => {
             const ticketData = doc.data();
             allLotteryTickets.push({
               id: doc.id,
               uid: user.uid,
               user: user,
               ...ticketData
             });
           });
         } catch (error) {
           console.error(`사용자 ${user.uid} 로또 내역 가져오기 실패:`, error);
         }
       }
       
       return allLotteryTickets;
     } catch (error) {
       console.error('로또 내역 가져오기 실패:', error);
       throw error;
     }
   }

   // 모든 코인 지급 내역 가져오기
   async function fetchAllCoinHistory() {
     try {
       const { db } = await window.getFirebaseAppAndDb();
       const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
       
       allCoinHistory = [];
       
       for (const user of allUsers) {
         try {
           const coinHistoryRef = collection(db, 'users', user.uid, 'coinHistory');
           const coinHistoryQuery = query(coinHistoryRef, orderBy('givenAt', 'desc'));
           const coinHistorySnap = await getDocs(coinHistoryQuery);
           
           coinHistorySnap.forEach(doc => {
             const historyData = doc.data();
             allCoinHistory.push({
               id: doc.id,
               uid: user.uid,
               user: user,
               ...historyData
             });
           });
         } catch (error) {
           console.error(`사용자 ${user.uid} 코인 지급 내역 가져오기 실패:`, error);
         }
       }
       
       return allCoinHistory;
     } catch (error) {
       console.error('코인 지급 내역 가져오기 실패:', error);
       throw error;
     }
   }

  // 통계 업데이트 (사용하지 않음)
  function updateStats() {
    // 통계 카드가 제거되어 사용하지 않음
  }

     // 잔액 테이블 렌더링
   function renderBalancesTable() {
     const tbody = document.getElementById('balancesBody');
     const loading = document.getElementById('balancesLoading');
     const error = document.getElementById('balancesError');
     const table = document.getElementById('balancesTable');
     
     try {
       const sortedBalances = allBalances.sort((a, b) => b.points - a.points);
       
       tbody.innerHTML = sortedBalances.map(balance => `
         <tr>
           <td>${renderUserInfo(balance.user)}</td>
           <td>${formatNumber(balance.points)} pt</td>
           <td>${formatNumber(balance.coins)} coin</td>
           <td>
             <div class="coin-give-form">
               <input type="number" min="1" max="100" placeholder="코인" class="coin-amount" data-uid="${balance.uid}">
               <input type="text" placeholder="사유 (예: 수업 중 활발한 참여)" class="coin-reason" data-uid="${balance.uid}">
               <button class="coin-give-btn" onclick="giveCoin('${balance.uid}')" data-uid="${balance.uid}">지급</button>
             </div>
           </td>
         </tr>
       `).join('');
       
       loading.style.display = 'none';
       error.style.display = 'none';
       table.style.display = 'table';
     } catch (err) {
       loading.style.display = 'none';
       error.style.display = 'block';
       error.textContent = '잔액 정보를 불러오는 중 오류가 발생했습니다.';
       table.style.display = 'none';
     }
   }

  // 구매 내역 테이블 렌더링
  function renderPurchasesTable() {
    const tbody = document.getElementById('purchasesBody');
    const loading = document.getElementById('purchasesLoading');
    const error = document.getElementById('purchasesError');
    const table = document.getElementById('purchasesTable');
    
    try {
      const sortedPurchases = allPurchases.sort((a, b) => {
        const aTime = a.purchasedAt?.toDate ? a.purchasedAt.toDate().getTime() : 0;
        const bTime = b.purchasedAt?.toDate ? b.purchasedAt.toDate().getTime() : 0;
        return bTime - aTime;
      });
      
      tbody.innerHTML = sortedPurchases.map(purchase => `
        <tr>
          <td>${renderUserInfo(purchase.user)}</td>
          <td>${purchase.name || purchase.id || '-'}</td>
          <td>${purchase.category || '-'}</td>
          <td>${formatNumber(purchase.price || 0)} pt</td>
          <td>${formatDate(purchase.purchasedAt)}</td>
        </tr>
      `).join('');
      
      loading.style.display = 'none';
      error.style.display = 'none';
      table.style.display = 'table';
    } catch (err) {
      loading.style.display = 'none';
      error.style.display = 'block';
      error.textContent = '구매 내역을 불러오는 중 오류가 발생했습니다.';
      table.style.display = 'none';
    }
  }

     // 로또 내역 테이블 렌더링
   function renderLotteryTable() {
     const tbody = document.getElementById('lotteryBody');
     const loading = document.getElementById('lotteryLoading');
     const error = document.getElementById('lotteryError');
     const table = document.getElementById('lotteryTable');
     
     try {
       const sortedTickets = allLotteryTickets.sort((a, b) => {
         const aTime = a.at?.toDate ? a.at.toDate().getTime() : 0;
         const bTime = b.at?.toDate ? b.at.toDate().getTime() : 0;
         return bTime - aTime;
       });
       
       tbody.innerHTML = sortedTickets.map(ticket => {
         const nums = Array.isArray(ticket.nums) ? ticket.nums.join(', ') : '-';
         const drawNums = Array.isArray(ticket.drawNums) ? ticket.drawNums.join(', ') : '-';
         const bonus = ticket.drawBonus || '-';
         const hitCount = ticket.hitCount || 0;
         const rank = ticket.rank ? `${ticket.rank}등` : '미당첨';
         
         return `
           <tr>
             <td>${renderUserInfo(ticket.user)}</td>
             <td>${nums}</td>
             <td>${drawNums}</td>
             <td>${bonus}</td>
             <td>${hitCount}개</td>
             <td>${rank}</td>
             <td>${formatDate(ticket.at)}</td>
           </tr>
         `;
       }).join('');
       
       loading.style.display = 'none';
       error.style.display = 'none';
       table.style.display = 'table';
     } catch (err) {
       loading.style.display = 'none';
       error.style.display = 'block';
       error.textContent = '로또 내역을 불러오는 중 오류가 발생했습니다.';
       table.style.display = 'none';
     }
   }

   // 코인 지급 내역 테이블 렌더링
   function renderCoinHistoryTable() {
     const tbody = document.getElementById('coinHistoryBody');
     const loading = document.getElementById('coinHistoryLoading');
     const error = document.getElementById('coinHistoryError');
     const table = document.getElementById('coinHistoryTable');
     
     try {
       const sortedHistory = allCoinHistory.sort((a, b) => {
         const aTime = a.givenAt?.toDate ? a.givenAt.toDate().getTime() : 0;
         const bTime = b.givenAt?.toDate ? b.givenAt.toDate().getTime() : 0;
         return bTime - aTime;
       });
       
       tbody.innerHTML = sortedHistory.map(history => `
         <tr>
           <td>${renderUserInfo(history.user)}</td>
           <td>${formatNumber(history.amount || 0)} coin</td>
           <td>${history.reason || '-'}</td>
           <td>${formatDate(history.givenAt)}</td>
         </tr>
       `).join('');
       
       loading.style.display = 'none';
       error.style.display = 'none';
       table.style.display = 'table';
     } catch (err) {
       loading.style.display = 'none';
       error.style.display = 'block';
       error.textContent = '코인 지급 내역을 불러오는 중 오류가 발생했습니다.';
       table.style.display = 'none';
     }
   }

     // 모든 데이터 새로고침
   async function refreshAllData() {
     try {
       console.log('데이터 새로고침 시작...');
       
       // 로딩 상태 표시
       document.getElementById('balancesLoading').style.display = 'block';
       document.getElementById('purchasesLoading').style.display = 'block';
       document.getElementById('lotteryLoading').style.display = 'block';
       document.getElementById('coinHistoryLoading').style.display = 'block';
       
       document.getElementById('balancesTable').style.display = 'none';
       document.getElementById('purchasesTable').style.display = 'none';
       document.getElementById('lotteryTable').style.display = 'none';
       document.getElementById('coinHistoryTable').style.display = 'none';
       
       // 데이터 가져오기
       console.log('사용자 정보 가져오기...');
       await fetchAllUsers();
       
       console.log('잔액 정보 가져오기...');
       await fetchAllBalances();
       
       console.log('구매 내역 가져오기...');
       await fetchAllPurchases();
       
       console.log('로또 내역 가져오기...');
       await fetchAllLotteryTickets();
       
       console.log('코인 지급 내역 가져오기...');
       await fetchAllCoinHistory();
       
       // 테이블 업데이트
       console.log('테이블 렌더링...');
       renderBalancesTable();
       renderPurchasesTable();
       renderLotteryTable();
       renderCoinHistoryTable();
       
       console.log('데이터 새로고침 완료');
       
     } catch (error) {
       console.error('데이터 새로고침 실패:', error);
       alert('데이터를 새로고침하는 중 오류가 발생했습니다.');
     }
   }

   // 코인 지급 함수
   async function giveCoin(uid) {
     try {
       const amountInput = document.querySelector(`input.coin-amount[data-uid="${uid}"]`);
       const reasonInput = document.querySelector(`input.coin-reason[data-uid="${uid}"]`);
       const button = document.querySelector(`button.coin-give-btn[data-uid="${uid}"]`);
       
       const amount = Number(amountInput.value);
       const reason = reasonInput.value.trim();
       
       if (!amount || amount <= 0) {
         alert('지급할 코인 수량을 입력해주세요.');
         return;
       }
       
       if (!reason) {
         alert('코인 지급 사유를 입력해주세요.');
         return;
       }
       
       if (amount > 100) {
         alert('한 번에 최대 100코인까지만 지급할 수 있습니다.');
         return;
       }
       
       // 버튼 비활성화
       button.disabled = true;
       button.textContent = '처리중...';
       
       const { db } = await window.getFirebaseAppAndDb();
       const { doc, updateDoc, addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
       
       // 사용자 지갑 업데이트
       const walletRef = doc(db, 'users', uid, 'wallet', 'main');
       await updateDoc(walletRef, {
         coins: window.firebaseData.increment(amount),
         totalCoins: window.firebaseData.increment(amount)
       });
       
       // 코인 지급 내역 기록
       const coinHistoryRef = collection(db, 'users', uid, 'coinHistory');
       await addDoc(coinHistoryRef, {
         amount: amount,
         reason: reason,
         givenAt: serverTimestamp(),
         givenBy: currentUserUid
       });
       
       // 입력 필드 초기화
       amountInput.value = '';
       reasonInput.value = '';
       
       // 성공 메시지
       alert(`${amount}코인이 성공적으로 지급되었습니다.`);
       
       // 데이터 새로고침
       await refreshAllData();
       
     } catch (error) {
       console.error('코인 지급 실패:', error);
       alert('코인 지급 중 오류가 발생했습니다.');
       
       // 버튼 재활성화
       const button = document.querySelector(`button.coin-give-btn[data-uid="${uid}"]`);
       if (button) {
         button.disabled = false;
         button.textContent = '지급';
       }
     }
   }

     // 인증 상태 확인 함수
   async function checkAuthStatus() {
     try {
       const authInfo = document.getElementById('authInfo');
       authInfo.textContent = '확인 중...';
       
       if (!window.firebaseData) {
         authInfo.textContent = 'Firebase가 초기화되지 않았습니다.';
         return;
       }
       
       const isAuth = await window.firebaseData?.isAuthenticated?.();
       const uid = await window.firebaseData?.getCurrentUserUid?.();
       
       let status = `로그인 상태: ${isAuth ? '로그인됨' : '로그인 안됨'}`;
       if (uid) {
         status += `\n사용자 UID: ${uid}`;
         status += `\n관리자 UID: ${ADMIN_UID}`;
         status += `\n관리자 권한: ${uid === ADMIN_UID ? '있음' : '없음'}`;
       }
       
       authInfo.textContent = status;
       console.log('인증 상태:', { isAuth, uid, isAdmin: uid === ADMIN_UID });
       
     } catch (error) {
       console.error('인증 상태 확인 실패:', error);
       document.getElementById('authInfo').textContent = `오류: ${error.message}`;
     }
   }

     // 사용자 접근 테스트 함수
   async function testUserAccess() {
     try {
       console.log('사용자 접근 테스트 시작...');
       
       const { db } = await window.getFirebaseAppAndDb();
       const { collection, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
       
       // 1. users 컬렉션 접근 테스트
       console.log('1. users 컬렉션 접근 테스트...');
       const usersRef = collection(db, 'users');
       const usersSnap = await getDocs(usersRef);
       console.log('users 컬렉션 결과:', { empty: usersSnap.empty, size: usersSnap.size });
       
       // 2. 특정 사용자 문서 접근 테스트
       if (!usersSnap.empty) {
         const firstUser = usersSnap.docs[0];
         console.log('2. 첫 번째 사용자 문서 접근 테스트...');
         console.log('첫 번째 사용자:', { id: firstUser.id, data: firstUser.data() });
         
         // 3. 사용자 하위 컬렉션 접근 테스트
         console.log('3. 사용자 하위 컬렉션 접근 테스트...');
         const walletRef = doc(db, 'users', firstUser.id, 'wallet', 'main');
         const walletSnap = await getDoc(walletRef);
         console.log('지갑 정보:', { exists: walletSnap.exists(), data: walletSnap.exists() ? walletSnap.data() : null });
         
         const dailyStatsRef = collection(db, 'users', firstUser.id, 'dailyStats');
         const dailyStatsSnap = await getDocs(dailyStatsRef);
         console.log('일일 통계:', { empty: dailyStatsSnap.empty, size: dailyStatsSnap.size });
       } else {
         console.log('2. users 컬렉션이 비어있음 - 다른 컬렉션 확인');
         
         // 3. 다른 컬렉션들 확인
         console.log('3. 다른 컬렉션들 확인...');
         
         // leaderboard 확인
         try {
           const leaderboardRef = collection(db, 'leaderboard');
           const leaderboardSnap = await getDocs(leaderboardRef);
           console.log('leaderboard 컬렉션:', { empty: leaderboardSnap.empty, size: leaderboardSnap.size });
         } catch (error) {
           console.log('leaderboard 접근 실패:', error.message);
         }
         
         // studyGroups 확인
         try {
           const studyGroupsRef = collection(db, 'studyGroups');
           const studyGroupsSnap = await getDocs(studyGroupsRef);
           console.log('studyGroups 컬렉션:', { empty: studyGroupsSnap.empty, size: studyGroupsSnap.size });
         } catch (error) {
           console.log('studyGroups 접근 실패:', error.message);
         }
         
         // studyGroupsPublic 확인
         try {
           const studyGroupsPublicRef = collection(db, 'studyGroupsPublic');
           const studyGroupsPublicSnap = await getDocs(studyGroupsPublicRef);
           console.log('studyGroupsPublic 컬렉션:', { empty: studyGroupsPublicSnap.empty, size: studyGroupsPublicSnap.size });
         } catch (error) {
           console.log('studyGroupsPublic 접근 실패:', error.message);
         }
       }
       
       alert('사용자 접근 테스트 완료. 콘솔을 확인하세요.');
       
     } catch (error) {
       console.error('사용자 접근 테스트 실패:', error);
       alert(`사용자 접근 테스트 실패: ${error.message}`);
     }
   }

     // 테스트 사용자 생성 함수
   async function createTestUser() {
     try {
       console.log('테스트 사용자 생성 시작...');
       
       const { db } = await window.getFirebaseAppAndDb();
       const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
       
       const testUserId = 'test-user-' + Date.now();
       const testUserData = {
         name: '테스트 사용자',
         displayName: '테스트 사용자',
         className: '테스트반',
         studentNumber: '999',
         createdAt: serverTimestamp()
       };
       
       // 사용자 기본 정보 생성
       await setDoc(doc(db, 'users', testUserId), testUserData);
       console.log('사용자 기본 정보 생성됨:', testUserId);
       
       // 지갑 정보 생성
       await setDoc(doc(db, 'users', testUserId, 'wallet', 'main'), {
         coins: 0,
         totalCoins: 0,
         createdAt: serverTimestamp()
       });
       console.log('지갑 정보 생성됨');
       
       // 일일 통계 생성
       const today = new Date().toISOString().split('T')[0];
       await setDoc(doc(db, 'users', testUserId, 'dailyStats', today), {
         exp: 0,
         points: 0,
         studyExp: 0,
         studyPoints: 0,
         totalExp: 0,
         totalPoints: 0,
         createdAt: serverTimestamp()
       });
       console.log('일일 통계 생성됨');
       
       // 프로필 정보 생성
       await setDoc(doc(db, 'users', testUserId, 'profile', 'main'), {
         nickname: '테스트',
         createdAt: serverTimestamp()
       });
       console.log('프로필 정보 생성됨');
       
       alert(`테스트 사용자가 생성되었습니다.\n사용자 ID: ${testUserId}\n이제 데이터 새로고침을 해보세요.`);
       
     } catch (error) {
       console.error('테스트 사용자 생성 실패:', error);
       alert(`테스트 사용자 생성 실패: ${error.message}`);
     }
   }

     // 전역 함수로 노출
   window.refreshAllData = refreshAllData;
   window.giveCoin = giveCoin;
   window.checkAuthStatus = checkAuthStatus;
   window.testUserAccess = testUserAccess;
   window.createTestUser = createTestUser;

  // 페이지 로드 시 초기화
  window.addEventListener('load', async () => {
    try {
      console.log('관리자 페이지 로드 시작...');
      
      // Firebase 초기화 대기
      console.log('Firebase 초기화 대기 중...');
      await new Promise(resolve => {
        const checkFirebase = () => {
          console.log('Firebase 상태 확인:', {
            getFirebaseAppAndDb: !!window.getFirebaseAppAndDb,
            firebaseData: !!window.firebaseData
          });
          
          if (window.getFirebaseAppAndDb && window.firebaseData) {
            console.log('Firebase 초기화 완료');
            resolve();
          } else {
            console.log('Firebase 초기화 대기 중...');
            setTimeout(checkFirebase, 100);
          }
        };
        checkFirebase();
      });
      
      // 관리자 접근 권한 확인
      console.log('관리자 접근 권한 확인...');
      const hasAccess = await checkAdminAccess();
      if (hasAccess) {
        console.log('초기 데이터 로드 시작...');
        // 초기 데이터 로드
        await refreshAllData();
      } else {
        console.log('관리자 권한 없음 - 데이터 로드 건너뜀');
        // 인증 상태 표시
        await checkAuthStatus();
      }
    } catch (error) {
      console.error('페이지 초기화 실패:', error);
      document.getElementById('accessDenied').style.display = 'block';
      document.getElementById('adminContent').style.display = 'none';
    }
  });
})();
