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
      const uid = await window.firebaseData?.getCurrentUserUid?.();
      if (uid === ADMIN_UID) {
        currentUserUid = uid;
        document.getElementById('accessDenied').style.display = 'none';
        document.getElementById('adminContent').style.display = 'block';
        return true;
      } else {
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
      const { db } = await window.getFirebaseAppAndDb();
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      allUsers = [];
      snapshot.forEach(doc => {
        const userData = doc.data();
        allUsers.push({
          uid: doc.id,
          ...userData
        });
      });
      
      return allUsers;
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error);
      throw error;
    }
  }

  // 사용자별 잔액 정보 가져오기
  async function fetchAllBalances() {
    try {
      const { db } = await window.getFirebaseAppAndDb();
      const { collection, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      
      allBalances = [];
      
      for (const user of allUsers) {
        try {
          // 지갑 정보
          const walletRef = doc(db, 'users', user.uid, 'wallet', 'main');
          const walletSnap = await getDoc(walletRef);
          const wallet = walletSnap.exists() ? walletSnap.data() : { coins: 0, totalCoins: 0 };
          
          // 일일 통계 합계 (포인트 계산용)
          const dailyStatsRef = collection(db, 'users', user.uid, 'dailyStats');
          const dailyStatsSnap = await getDocs(dailyStatsRef);
          let totalPoints = 0;
          dailyStatsSnap.forEach(doc => {
            const data = doc.data();
            totalPoints += Number(data.points || 0);
          });
          
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

  // 모든 데이터 새로고침
  async function refreshAllData() {
    try {
      // 로딩 상태 표시
      document.getElementById('balancesLoading').style.display = 'block';
      document.getElementById('purchasesLoading').style.display = 'block';
      document.getElementById('lotteryLoading').style.display = 'block';
      
      document.getElementById('balancesTable').style.display = 'none';
      document.getElementById('purchasesTable').style.display = 'none';
      document.getElementById('lotteryTable').style.display = 'none';
      
      // 데이터 가져오기
      await fetchAllUsers();
      await Promise.all([
        fetchAllBalances(),
        fetchAllPurchases(),
        fetchAllLotteryTickets()
      ]);
      
      // 테이블 업데이트
      renderBalancesTable();
      renderPurchasesTable();
      renderLotteryTable();
      
    } catch (error) {
      console.error('데이터 새로고침 실패:', error);
      alert('데이터를 새로고침하는 중 오류가 발생했습니다.');
    }
  }

  // 전역 함수로 노출
  window.refreshAllData = refreshAllData;

  // 페이지 로드 시 초기화
  window.addEventListener('load', async () => {
    try {
      // Firebase 초기화 대기
      await new Promise(resolve => {
        const checkFirebase = () => {
          if (window.getFirebaseAppAndDb && window.firebaseData) {
            resolve();
          } else {
            setTimeout(checkFirebase, 100);
          }
        };
        checkFirebase();
      });
      
      // 관리자 접근 권한 확인
      const hasAccess = await checkAdminAccess();
      if (hasAccess) {
        // 초기 데이터 로드
        await refreshAllData();
      }
    } catch (error) {
      console.error('페이지 초기화 실패:', error);
      document.getElementById('accessDenied').style.display = 'block';
      document.getElementById('adminContent').style.display = 'none';
    }
  });
})();
