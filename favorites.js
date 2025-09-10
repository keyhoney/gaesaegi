(function () {
  'use strict';

  // Firebase만 사용

  const $tabs = document.querySelectorAll('.tab');
  const $favTab = document.getElementById('favTab');
  const $wrongTab = document.getElementById('wrongTab');
  const $favList = document.getElementById('favList');
  const $wrongList = document.getElementById('wrongList');

  async function listFavIds() { try { return await window.firebaseData?.listFavorites?.() || []; } catch (_) { return []; } }
  async function listWrongIds() { try { return await window.firebaseData?.listWrongs?.() || []; } catch (_) { return []; } }
  async function getAllFavoriteMemos() { try { return await window.firebaseData?.getAllFavoriteMemos?.() || {}; } catch (_) { return {}; } }

  function loadData() {
    return fetch('questions.json', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('로드 실패'); return r.json(); });
  }

  function findQuestionMetaIndex(dataset) {
    // id -> {과목,대분류,중분류,소분류,난이도,문항주소,해설주소}
    const map = new Map();
    dataset.forEach(bucket => {
      const subject = bucket['과목'];
      const cat = bucket['대분류'];
      const sub = bucket['중분류'];
      const topic = bucket['소분류'];
      (bucket['문항들'] || []).forEach(q => {
        map.set(q['문항번호'], {
          subject, cat, sub, topic,
          difficulty: q['난이도'] || '',
          img: q['문항주소'] || '',
          solution: q['해설주소'] || ''
        });
      });
    });
    return map;
  }

  function makeLink(m, id) {
    const q = new URLSearchParams({
      subject: m.subject,
      cat: m.cat,
      sub: m.sub,
      topic: m.topic,
      qid: id,
    });
    return `individual-study.html?${q.toString()}`;
  }

  async function renderFav(list, meta, memos = {}) {
    $favList.innerHTML = '';
    if (list.size === 0) { $favList.textContent = '즐겨찾기한 문항이 없습니다.'; return; }
    list.forEach(id => {
      const m = meta.get(id);
      if (!m) return;
      const memo = memos[id] || '';
      const hasMemo = memo.trim().length > 0;
      const row = document.createElement('div');
      row.className = `row ${hasMemo ? 'has-memo' : ''}`;
      row.innerHTML = `
        <div class="line top">
          <div class="meta">${m.subject} / ${m.cat} / ${m.sub} / ${m.topic}</div>
          ${hasMemo ? '<div class="memo-indicator" title="메모 있음">📝</div>' : ''}
        </div>
        <div class="line bottom">
          <div class="id">${id}</div>
          <div class="diff">${m.difficulty}</div>
          <div class="actions">
            <a class="btn ghost small" href="${makeLink(m, id)}" target="_self">문제 보기</a>
            <button type="button" class="btn small memo-btn" data-id="${id}">메모</button>
            <button type="button" class="btn small remove-fav" data-id="${id}">삭제</button>
          </div>
        </div>
        ${hasMemo ? `<div class="memo-preview">${memo}</div>` : ''}
        <div class="memo-editor" style="display: none;">
          <div class="memo-editor-content">
            <textarea class="memo-textarea" placeholder="틀린 이유, 중요한 단서, 복습 포인트 등을 기록하세요..." maxlength="500">${memo}</textarea>
            <div class="memo-editor-footer">
              <div class="memo-char-count">0/500</div>
              <div class="memo-editor-actions">
                <button type="button" class="btn ghost small memo-cancel">취소</button>
                <button type="button" class="btn small memo-save">저장</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      const rm = row.querySelector('.remove-fav');
      rm.addEventListener('click', async () => {
        await window.firebaseData?.removeFavorite?.(id);
        const ids = await listFavIds();
        const memos = await getAllFavoriteMemos();
        renderFav(new Set(ids), meta, memos);
      });
      
      const memoBtn = row.querySelector('.memo-btn');
      const memoEditor = row.querySelector('.memo-editor');
      const textarea = row.querySelector('.memo-textarea');
      const charCount = row.querySelector('.memo-char-count');
      const saveBtn = row.querySelector('.memo-save');
      const cancelBtn = row.querySelector('.memo-cancel');
      
      // 글자 수 업데이트
      function updateCharCount() {
        const count = textarea.value.length;
        charCount.textContent = `${count}/500`;
        charCount.style.color = count > 450 ? 'var(--danger)' : 'var(--muted)';
      }
      
      textarea.addEventListener('input', updateCharCount);
      updateCharCount();
      
      // 메모 버튼 클릭
      memoBtn.addEventListener('click', () => {
        // 다른 모든 메모 에디터 닫기
        document.querySelectorAll('.memo-editor').forEach(editor => {
          if (editor !== memoEditor) {
            editor.style.display = 'none';
          }
        });
        
        // 현재 메모 에디터 토글
        const isVisible = memoEditor.style.display !== 'none';
        memoEditor.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
          textarea.focus();
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      });
      
      // 저장 버튼 클릭
      saveBtn.addEventListener('click', async () => {
        const newMemo = textarea.value.trim();
        const success = await window.firebaseData?.saveFavoriteMemo?.(id, newMemo);
        
        if (success) {
          showToast(newMemo ? '메모가 저장되었습니다.' : '메모가 삭제되었습니다.');
          memoEditor.style.display = 'none';
          
          // 목록 새로고침
          const ids = await listFavIds();
          const memos = await getAllFavoriteMemos();
          renderFav(new Set(ids), meta, memos);
        } else {
          showToast('메모 저장에 실패했습니다.', 'error');
        }
      });
      
      // 취소 버튼 클릭
      cancelBtn.addEventListener('click', () => {
        textarea.value = memo; // 원래 값으로 복원
        updateCharCount();
        memoEditor.style.display = 'none';
      });
      
      $favList.appendChild(row);
    });
  }

  function renderWrong(list, meta) {
    $wrongList.innerHTML = '';
    if (list.size === 0) { $wrongList.textContent = '오답 문항이 없습니다.'; return; }
    list.forEach(id => {
      const m = meta.get(id);
      if (!m) return;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="line top"><div class="meta">${m.subject} / ${m.cat} / ${m.sub} / ${m.topic}</div></div>
        <div class="line bottom"><div class="id">${id}</div><div class="diff">${m.difficulty}</div><div class="actions"><a class="btn ghost small" href="${makeLink(m, id)}" target="_self">문제 보기</a></div></div>
      `;
      $wrongList.appendChild(row);
    });
  }

  
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toastContainer') || document.body;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function wireTabs() {
    $tabs.forEach(btn => btn.addEventListener('click', () => {
      $tabs.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const fav = tab === 'fav';
      $favTab.hidden = !fav; $wrongTab.hidden = fav;
    }));
  }

  (async function init() {
    wireTabs();
    const dataset = await loadData();
    const meta = findQuestionMetaIndex(dataset);
    const favIds = await listFavIds();
    const wrongIds = await listWrongIds();
    const memos = await getAllFavoriteMemos();
    renderFav(new Set(favIds), meta, memos);
    renderWrong(new Set(wrongIds), meta);
  })();
})();


