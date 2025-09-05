(function () {
  'use strict';

  // 관리자 UID
  const ADMIN_UID = 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2';
  
  // 전역 변수
  let currentUserUid = null;
  let allUsers = [];
  let filteredUsers = [];
  let currentPage = 1;
  const usersPerPage = 20;

  // 하드코딩된 모든 사용자 UID 목록
  const ALL_USER_UIDS = [
    'PGaVHrRQ5OXYjF8cDshbCZygRJP2', 'qQ5TS5R9fWTkw90DxAgLF0iNDyi2', 'WRcdJOZJJCXMpkV3WG0jUTp8I5h1',
    'fkLWvKLKaRT4wZ1j40gia8hmsA72', 'pqCnLsuyZrfJASspMOixTiJWl0g1', 'JjOgt7spmXMpG7tslDz7ROAwJ4P2',
    'O61e0m0q0JOAkv73jk5y81mdEDd2', '4NboR1jFUcRMRm3uLljF1l6UqMY2', '0Eiyl2LGCRfzVCJRqzn4ot8qSy92',
    'M5bNsbKXiVQCi7TuyvWkH3RUNji1', 'jZ7MmTF7eFZCpq1PHmKbNLghlHA3', 'CUOUoM9NTWMvGyZ9YjT6rdUHtVC3',
    'oxp6mue9lUWd2XIoSIlgSIceTB02', 'nswTy2ip82hIEYfOJ1FiMzxcdxi2', 'dR39blRK7sMHcHQ1PlAaQ3AvndQ2',
    'B2ZYgSDjM7Y3DaBIKmsZl8XBXQp1', '51pgFJbj3qYNi2kHJkBSfsOPKYa2', 'VKFJbBedjqML1YkW3jZnBdvtiZU2',
    'ZJ479LfUCMQqpmzYua0HQahgdZk2', 'ZlTHQqBY6pNyzVpb2iU8O5DPO4q2', '36AGvjAeTBYdaKeAqIfpNfHTt5G2',
    'asIYZFIlbWSY1es46bRCMUp9MZr1', 'bF588uRythV6lK3vRwSxTeKCWYf1', 'cb4ab1jtBjeb2P1OwOrVp8vIHh92',
    'lLoc3JZ9OHTtczjZ9vT7Augzyhv1', '6bk72c8s6dfe60zi8Qc54F6Nsat1', 'VUOd0mFb1zVAGsqYbsAGjHSC6d23',
    'Q39Thv2UOST2th3uujNyxLybDV32', 'J6qlUjQrEMZbbZlWDSvB9OpHW2i1', 'dszmx0y2e4e3HCWTV00H1kZ9nB62',
    'aeTcj1IXeuf3ENUcPxe5vmIYwFn2', 'LhQV1IsUIEZZniE3a4QJk52Tft82', 'n9lvyxRp8SQqZEyLNCeYWqYz9zG3',
    'MssfKSgkmJWGY5oP2U3tNEvlWjI3', 'PRJWEPkY0be3mTCSWBFHbGQc12u1', 'k2fH1Ri0QJbNXyvpAvpuWU3EOuF2',
    'FrNwbVDMaIXLlUVdG324RYScTRG2', 'QxNDx7GVytfh5dxxiCpH84BQhli1', 'dM3Rvcwsg8flCKCY6pbiMnjcOrO2',
    '2RkgZx7kaOaVmyK3RzcDceAlysx1', 'X88tTrzkIVYZFYCrP2jpR6xnk2B3', 'bl9A3k2Co5WLBJbYUe98Q4JBooC3',
    'Cn9MV05VeYVyvlQkqZSUoQ5sFlx2', 'r2ABBh4F6DgrMIkkaoFM25oBA5O2', 'zo2h81Ij3lQk3uE4RbSDpJD7IXh2',
    'h0aoOGv68PQBIYWsl4544E5bZvf2', 'VI2IoZETcMgFmhbupWABysQKadu2', 'KhXhhMTo75P8aPHJjBUUxZvrwzs1',
    'g0c1n5J1W2YawNOmREj0oEsORBE3', 'aKNoy2mfa8X5I6Zzrr5BcHPWnRz1', 'oVowmmHMRYaskUj2fWpN8rdeUwh2',
    'o3NeiVAUDZSlUbpG3tMQ1J7UWlq2', 'qBPMabxl9BUj53at6V6UIZPfT6r1', 'cjX8yMlygIgBlGloF2e9Fum2isZ2',
    'fmbB02EY3qUtJFpkeKQqXoKcmkN2', '5E3oLGJO3Wc460s4IcOWoqkY0DB3', 'cdMWPqGerYcCuTXZbAw1gXEWIXt2',
    'xN8HtTXTpId0qWf1AxPypYZlWo63', 'nX5yEhFCZZdpSBDGYQiHA9kSXJh2', 'ejajdQbTF4M8IwFTz1MVnVuuoA22',
    '8XQWGq2O23MVI0tzRid2gdKrnaG2', 'XSeM8AdPCUP810gokNvTazIOX7w2', 'I960Kz1EijNF76638P59SgpomdF2',
    'PCmGu0Kt0HPdhXQUI6zDx6H96yB3', 'TUscOf9J5xfFur2J7EGKbjvqfef2', '9cCgknYXkbQe5CAG1DRlFwWmMUE3',
    'nBElyz9AUASVdsQqeGQPInQdJCo1', 'sb9hNOmrNhPd8KO08DscWCzZxT53', 'bO3dHUde3CPOqScsZFe9JGOJEsi2',
    'VQC1azy1H8Xb9E7nuTW1RyMx5B52', 'SlKVE6tzEOWkhVk3IfEalmmmyzx2', 'l5qENNQkkweMTvQYtzoG4BAZebF3',
    'UauPrKFTBJaRXyLYjMF4znSsi5U2', 'e9Id49Pa6waJFA7g7RHCbiUUdf72', 'm8kg1KbSzdVYbIdCxapCooYVsrR2',
    'HEumHGcKKDVjVdyMQBo5e0pqOv32', '4sPsZvlWUaP3rL6RKZYBrzEaHA93', 'UOgj3L4ZOUQeQreSHzLKhtTQwa82',
    'm1vRmYxl01c4U7nCmP8EK4KooEN2', '7OJyVZFN9Dgw1THf9QgsZPdTQR42', 'VsAWChuPIPeZfy8a62FMJMD9QPG3',
    'l7Xqxsx99KXzTRXRPd7D00jAUTm2', 'y6VTQ7kOMDUeixayVkFZkIRB7xO2', 'ZgIOnf4qVDbLBiVucuuuG7nSfFT2',
    'B7j85Y1HDrhIEP24CwghMLDXcLe2', 'S8PcwCtfV8UfQKi2KpC5kbfCsq83', 'JN4Aj1tLcgSdLbDxJvHXYphEGG12',
    'IlZ8YpkPjmV79WU2itCwPp8Gk6t2', 'jz2W3dOpZmTUw0H3x2DV2QSPet32', 'OyDiGyFxHjUOaXfTKSM49ffSXAE2',
    'vPyKdlAjbfNZIhW9tO2N9fe8Mg22', 'BAdn611CqLXqULS3u8EveX6Bl2v2', 'FoGVZ5bhimMEp7H43OVNA72Nw0b2',
    'YA9rtJMw5zXQPNYuWxslDTKlZoo2', 'hU6thgkjI1gIasdTpUA3YSGVm0h1', 'hkbvHbUC8xRmc9WZisi9vWJtBe82',
    'tt1YSD1HEncK2IhdjqRc41RDfGB2', 'Bc1l3o3zz2T3xjPtdRP83NJipCE2', 'cKipew6dcpeWOHddw6yFxRbHBAh2',
    'grXV9p498Xar1ugyKKGs7ycT2Dr1', '3uvLN9aYtBgOW6h4R5X3aixHMy23', 'jiDQCuRpBGVZjnUrIT0cInXgIVG2',
    'nIFEBVILqgcQSxH5TVrwtglwp7Q2', 'oNP1OtfV9wdHTsgGZO6hkCaCiZK2', 'DRdR9MMiFHOnNK85CBcYWKKglUw1',
    'ZAKL8ukxTyQorl2wZhkG1co6dNw1', 'ZNE7WWO7rAgeQZbFzvJQq3s9wlx2', 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2'
  ];

  // 유틸리티 함수들
  function formatDate(timestamp) {
    if (!timestamp) return '-';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      }).format(date);
    } catch { return '-'; }
  }

  function formatNumber(num) {
    return Number(num || 0).toLocaleString();
  }

  // 사용자 정보 렌더링 함수
  function renderUserInfo(user) {
    const name = user.name || user.displayName || user.nickname || '미이름';
    const initials = name.substring(0, 2).toUpperCase();
    
    return `
      <div class="user-info">
        <div class="user-avatar">${initials}</div>
        <div class="user-details">
          <div class="user-name">${name}</div>
          <div class="user-class">${user.email || '이메일 없음'}</div>
        </div>
      </div>
    `;
  }

  // 접근 권한 확인
  async function checkAdminAccess() {
    try {
      console.log('관리자 접근 권한 확인 시작...');
      
      if (!window.firebaseData) {
        console.error('firebaseData가 초기화되지 않았습니다.');
        return false;
      }
      
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

  // 사용자 정보 가져오기
  async function fetchAllUsers() {
    try {
      console.log('사용자 정보 가져오기 시작...');
      
      const { db } = await window.getFirebaseAppAndDb();
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      
      allUsers = [];
      let loadedCount = 0;
      
      console.log(`총 ${ALL_USER_UIDS.length}명의 사용자 정보를 조회합니다...`);
      
      for (const uid of ALL_USER_UIDS) {
        try {
          let userInfo = {
            uid: uid,
            name: `사용자 ${uid.substring(0, 8)}`,
            className: '미분반',
            studentNumber: 0,
            phone: null,
            email: null,
            updatedAt: null
          };
          
          // 사용자 기본 정보 문서 시도
          try {
            const userDocRef = doc(db, 'users', uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              userInfo = {
                uid: uid,
                name: userData.name || userData.displayName || `사용자 ${uid.substring(0, 8)}`,
                className: userData.className || userData.class || '미분반',
                studentNumber: userData.studentNumber || userData.number || 0,
                email: userData.email || null,
                phone: userData.phone || null,
                updatedAt: userData.updatedAt || null
              };
              loadedCount++;
            }
          } catch (docError) {
            console.warn(`기본 문서 ${uid} 접근 실패:`, docError);
          }
          
          // 프로필 정보 시도
          if (!userInfo.name || userInfo.name.startsWith('사용자')) {
            try {
              const profileRef = doc(db, 'users', uid, 'profile', 'main');
              const profileSnap = await getDoc(profileRef);
              if (profileSnap.exists()) {
                const profileData = profileSnap.data();
                userInfo = {
                  uid: uid,
                  name: profileData.name || profileData.nickname || userInfo.name,
                  className: profileData.classNo ? `${profileData.grade || ''}학년 ${profileData.classNo}반` : userInfo.className,
                  studentNumber: profileData.studentNo || userInfo.studentNumber,
                  grade: profileData.grade || null,
                  classNo: profileData.classNo || null,
                  nickname: profileData.nickname || null,
                  phone: profileData.phone || userInfo.phone,
                  email: userInfo.email,
                  updatedAt: profileData.updatedAt || userInfo.updatedAt
                };
                loadedCount++;
              }
            } catch (profileError) {
              console.warn(`프로필 ${uid} 접근 실패:`, profileError);
            }
          }
          
          allUsers.push(userInfo);
          
          if (allUsers.length % 20 === 0) {
            console.log(`진행 상황: ${allUsers.length}/${ALL_USER_UIDS.length}명 완료`);
            updateStats();
          }
          
        } catch (userError) {
          console.error(`사용자 ${uid} 정보 가져오기 실패:`, userError);
          allUsers.push({
            uid: uid,
            name: `사용자 ${uid.substring(0, 8)}`,
            className: '미분반',
            studentNumber: 0,
            phone: null,
            email: null
          });
        }
      }
      
      console.log(`최종 사용자 목록: 총 ${allUsers.length}명 (실제 데이터: ${loadedCount}명)`);
      
      // 이름순으로 정렬
      allUsers.sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB, 'ko');
      });
      
      return allUsers;
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error);
      throw error;
    }
  }

  // 통계 업데이트
  function updateStats() {
    document.getElementById('totalUsers').textContent = formatNumber(ALL_USER_UIDS.length);
    document.getElementById('loadedUsers').textContent = formatNumber(allUsers.length);
    document.getElementById('filteredUsers').textContent = formatNumber(filteredUsers.length);
  }

  // 검색 필터 적용
  function applySearchFilter() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!searchTerm) {
      filteredUsers = [...allUsers];
    } else {
      filteredUsers = allUsers.filter(user => {
        const name = (user.name || '').toLowerCase();
        const className = (user.className || '').toLowerCase();
        const studentNumber = String(user.studentNumber || 0);
        const phone = (user.phone || '').toLowerCase();
        
        return name.includes(searchTerm) || 
               className.includes(searchTerm) || 
               studentNumber.includes(searchTerm) ||
               phone.includes(searchTerm);
      });
    }
    
    updateStats();
    renderUserTable();
    updateFilterInfo(searchTerm);
  }

  // 필터 정보 업데이트
  function updateFilterInfo(searchTerm) {
    const filterInfo = document.getElementById('filterInfo');
    
    if (searchTerm) {
      filterInfo.innerHTML = `
        🔍 검색어: "${searchTerm}" / 총 ${allUsers.length}명 중 ${filteredUsers.length}명 표시
      `;
      filterInfo.style.display = 'block';
    } else {
      filterInfo.style.display = 'none';
    }
  }

  // 사용자 테이블 렌더링
  function renderUserTable() {
    const tbody = document.getElementById('userTableBody');
    
    // 페이지네이션 제거 - 모든 사용자를 한 번에 표시
    tbody.innerHTML = filteredUsers.map(user => {
      const className = user.className || '미분반';
      const studentNumber = user.studentNumber || 0;
      const phone = user.phone || '-';
      const fullUid = user.uid; // UID 전체 표시
      
      return `
        <tr>
          <td>${renderUserInfo(user)}</td>
          <td>${className}</td>
          <td>${studentNumber}번</td>
          <td>${phone}</td>
          <td><span class="uid-text">${fullUid}</span></td>
        </tr>
      `;
    }).join('');
    
    // 페이지네이션 제거
    document.getElementById('pagination').innerHTML = '';
  }

  // 페이지네이션 렌더링
  function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }
    
    let paginationHTML = '';
    
    paginationHTML += `
      <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
        ◀
      </button>
    `;
    
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
      paginationHTML += `<button onclick="changePage(1)">1</button>`;
      if (startPage > 2) {
        paginationHTML += `<span>...</span>`;
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
        <button onclick="changePage(${i})" ${i === currentPage ? 'class="current"' : ''}>
          ${i}
        </button>
      `;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        paginationHTML += `<span>...</span>`;
      }
      paginationHTML += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    
    paginationHTML += `
      <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
        ▶
      </button>
    `;
    
    pagination.innerHTML = paginationHTML;
  }

  // 엑셀로 내보내기
  function exportToExcel() {
    try {
      console.log('엑셀 내보내기 시작...');
      
      // 현재 필터된 사용자 데이터를 CSV 형식으로 변환
      const headers = ['이름', '반', '번호', '연락처', 'UID'];
      const csvData = [headers];
      
      filteredUsers.forEach(user => {
        const name = user.name || user.displayName || user.nickname || '미이름';
        const className = user.className || '미분반';
        const studentNumber = user.studentNumber || 0;
        const phone = user.phone || '';
        const uid = user.uid;
        
        csvData.push([name, className, `${studentNumber}번`, phone, uid]);
      });
      
      // CSV 문자열 생성 (UTF-8 BOM 추가로 한글 깨짐 방지)
      const csvContent = '\uFEFF' + csvData.map(row => 
        row.map(cell => {
          // 쉼표나 따옴표가 있는 경우 따옴표로 감싸기
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return '"' + cellStr.replace(/"/g, '""') + '"';
          }
          return cellStr;
        }).join(',')
      ).join('\n');
      
      // Blob 생성 및 다운로드
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        
        // 파일명 생성 (현재 날짜와 시간 포함)
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
        const fileName = `사용자_프로필_${dateStr}.csv`;
        
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`엑셀 내보내기 완료: ${fileName}`);
        
        // 성공 메시지 표시
        showExportMessage(`✅ ${filteredUsers.length}명의 사용자 정보를 엑셀 파일로 내보냈습니다.`);
      }
    } catch (error) {
      console.error('엑셀 내보내기 실패:', error);
      showExportMessage('❌ 엑셀 내보내기 중 오류가 발생했습니다.');
    }
  }
  
  // 내보내기 메시지 표시
  function showExportMessage(message) {
    // 기존 메시지가 있으면 제거
    const existingMessage = document.getElementById('exportMessage');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // 새 메시지 생성
    const messageDiv = document.createElement('div');
    messageDiv.id = 'exportMessage';
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px;
      box-shadow: var(--shadow);
      z-index: 1000;
      font-size: 14px;
      max-width: 300px;
    `;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // 3초 후 자동 제거
    setTimeout(() => {
      if (messageDiv && messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 3000);
  }

  // 데이터 로드
  async function loadUserData() {
    try {
      console.log('사용자 데이터 로드 시작...');
      
      document.getElementById('loading').style.display = 'block';
      document.getElementById('error').style.display = 'none';
      document.getElementById('tableContainer').style.display = 'none';
      document.getElementById('loadBtn').disabled = true;
      document.getElementById('loadBtn').textContent = '📋 로딩 중...';
      
      await fetchAllUsers();
      filteredUsers = [...allUsers];
      updateStats();
      renderUserTable();
      
      document.getElementById('loading').style.display = 'none';
      document.getElementById('tableContainer').style.display = 'block';
      document.getElementById('loadBtn').style.display = 'none';
      document.getElementById('refreshBtn').style.display = 'inline-block';
      document.getElementById('exportBtn').style.display = 'inline-block';
      
      console.log('사용자 데이터 로드 완료');
      
    } catch (error) {
      console.error('사용자 데이터 로드 실패:', error);
      
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').style.display = 'block';
      document.getElementById('error').textContent = `❌ 사용자 정보를 불러오는 중 오류가 발생했습니다: ${error.message}`;
      document.getElementById('loadBtn').disabled = false;
      document.getElementById('loadBtn').textContent = '📋 데이터 로드';
    }
  }

  // 데이터 새로고침
  async function refreshUserData() {
    try {
      console.log('사용자 데이터 새로고침 시작...');
      
      document.getElementById('refreshBtn').disabled = true;
      document.getElementById('refreshBtn').textContent = '🔄 새로고침 중...';
      
      await loadUserData();
      
      document.getElementById('refreshBtn').disabled = false;
      document.getElementById('refreshBtn').textContent = '🔄 새로고침';
      
    } catch (error) {
      console.error('데이터 새로고침 실패:', error);
      document.getElementById('refreshBtn').disabled = false;
      document.getElementById('refreshBtn').textContent = '🔄 새로고침';
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

  // 전역 함수로 노출
  window.loadUserData = loadUserData;
  window.refreshUserData = refreshUserData;
  window.checkAuthStatus = checkAuthStatus;
  window.exportToExcel = exportToExcel;

  // 페이지 로드 시 초기화
  window.addEventListener('load', async () => {
    try {
      console.log('프로필 페이지 로드 시작...');
      
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
      if (!hasAccess) {
        console.log('관리자 권한 없음');
        await checkAuthStatus();
          return;
        }
      
      // 이벤트 리스너 등록
      document.getElementById('loadBtn').addEventListener('click', loadUserData);
      document.getElementById('refreshBtn').addEventListener('click', refreshUserData);
      
      // 검색 이벤트
      const searchInput = document.getElementById('searchInput');
      let searchTimeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applySearchFilter, 300);
      });
      
      // 통계 초기 설정
      updateStats();
      
      console.log('프로필 페이지 초기화 완료');
      
    } catch (error) {
      console.error('페이지 초기화 실패:', error);
      document.getElementById('accessDenied').style.display = 'block';
      document.getElementById('adminContent').style.display = 'none';
    }
  });
})();