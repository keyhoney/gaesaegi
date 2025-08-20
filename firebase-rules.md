// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ===== 사용자 개인 데이터 =====
    // 본인 소유 데이터 전체(프로필, 포인트/코인, 아이템, 구매, 트랜잭션, 학습로그, 답안, 업적, 효과, 챌린지 등)
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // ===== 리더보드 =====
    match /leaderboard/{userId} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.uid == userId
                 && request.resource.data.keys().hasAll(['displayName','nickname','photoURL','totalExp','level','updatedAt'])
        && request.resource.data.totalExp is number
        && request.resource.data.level is number;
    }

    // ===== 로또 =====
    match /lottery/public/stats/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /lottery/tickets/{tid} {
      allow read: if true;
      allow create: if request.auth != null
                 && request.resource.data.keys().hasAll(['uid','drawDate','nums','drawNums','drawBonus','hitCount','rank','at'])
        && request.resource.data.uid == request.auth.uid;
      allow update, delete: if false;
    }
    match /users/{uid}/lotteryTickets/{tid} {
      allow read, create: if request.auth != null && request.auth.uid == uid;
      allow update, delete: if false;
    }

    // ===== 글로벌 오답률 =====
    match /globalWrongRates/{docId} {
      allow read: if true;
      allow write, delete: if false;
    }

    // ===== 거래소(공개 마켓) =====
    // 오더북
    match /market/public/orders/{orderId} {
      // 누구나 읽기
      allow read: if true;

             // 생성: 인증자, 필수 필드/값 검증
       allow create: if request.auth != null
         && request.resource.data.keys().hasAll(['uid','side','price','qty','qtyRemaining','status','createdAt'])
         && request.resource.data.uid == request.auth.uid
         && request.resource.data.side in ['buy','sell']
         && request.resource.data.price is number
         && request.resource.data.qty is number
         && request.resource.data.qty > 0
         && request.resource.data.qtyRemaining == request.resource.data.qty
         && request.resource.data.status == 'open'
         && (request.resource.data.createdAt is timestamp || request.resource.data.createdAt == request.time || request.resource.data.createdAt == null);

      // 업데이트 허용 케이스
      allow update: if request.auth != null && (
                 // 1) 소유자에 의한 취소: open -> cancelled, status/cancelledAt만 변경 허용
         (
           resource.data.uid == request.auth.uid
           && resource.data.status == 'open'
           && request.resource.data.diff(resource.data).changedKeys().hasAll(['status','cancelledAt'])
           && request.resource.data.diff(resource.data).changedKeys().size() == 2
           && request.resource.data.status == 'cancelled'
         ) ||
         // 2) 매칭(체결) 진행: 변경 필드는 qtyRemaining/status만, qtyRemaining 단조감소, status는 open/filled만
         (
           request.resource.data.diff(resource.data).changedKeys().hasAll(['qtyRemaining','status'])
           && request.resource.data.diff(resource.data).changedKeys().size() == 2
           && request.resource.data.qtyRemaining is number
           && request.resource.data.qtyRemaining >= 0
           && request.resource.data.qtyRemaining <= resource.data.qtyRemaining
           && request.resource.data.status in ['open','filled']
         ) ||
         // 3) 매칭 시스템에 의한 업데이트: 인증된 사용자라면 매칭 관련 업데이트 허용 (더 유연한 규칙)
         (
           request.resource.data.diff(resource.data).changedKeys().hasAll(['qtyRemaining','status'])
           && request.resource.data.qtyRemaining is number
           && request.resource.data.qtyRemaining >= 0
           && request.resource.data.status in ['open','filled']
         )
      );

      // 삭제 불허
      allow delete: if false;
    }

    // 체결/정산
    match /market/public/settlements/{sid} {
      allow read: if true;

             // 생성: 인증자, 필수 필드 검증
       allow create: if request.auth != null
         && request.resource.data.keys().hasAll(['buyerUid','sellerUid','price','qty','buyerClaimed','sellerClaimed','at'])
         && request.resource.data.buyerUid is string
         && request.resource.data.sellerUid is string
         && request.resource.data.price is number
         && request.resource.data.qty is number
         && request.resource.data.qty > 0
         && request.resource.data.buyerClaimed == false
         && request.resource.data.sellerClaimed == false
         && (request.resource.data.at is timestamp || request.resource.data.at == request.time || request.resource.data.at == null);

      // 정산: 본인만 자신의 claim 플래그를 true로 변경(해당 필드만 변경) — idempotent 허용
      allow update: if request.auth != null && (
        (
          request.auth.uid == resource.data.buyerUid
                   && request.resource.data.diff(resource.data).changedKeys().hasAll(['buyerClaimed'])
         && request.resource.data.diff(resource.data).changedKeys().size() == 1
         && request.resource.data.buyerClaimed == true
       ) || (
         request.auth.uid == resource.data.sellerUid
         && request.resource.data.diff(resource.data).changedKeys().hasAll(['sellerClaimed'])
         && request.resource.data.diff(resource.data).changedKeys().size() == 1
         && request.resource.data.sellerClaimed == true
                 ) || (
           // 트랜잭션에서 set이 update로 전송되는 경우 허용(생성과 동일 제약)
           request.resource.data.keys().hasAll(['buyerUid','sellerUid','price','qty','buyerClaimed','sellerClaimed','at'])
           && request.resource.data.keys().size() == 7
           && request.resource.data.buyerUid is string
           && request.resource.data.sellerUid is string
           && request.resource.data.price is number
           && request.resource.data.qty is number
           && request.resource.data.qty > 0
           && request.resource.data.buyerClaimed == false
           && request.resource.data.sellerClaimed == false
           && (request.resource.data.at is timestamp || request.resource.data.at == request.time || request.resource.data.at == null)
         )
      );

      allow delete: if false;
    }

    // 티커: 공개 읽기, 인증자 쓰기(필드 제한) — 부분 업데이트 허용
    match /market/public/ticker/{docId} {
      allow read: if true;
      // 부분 업데이트 허용: 변경하려는 키들만 타입 검사
      allow write: if request.auth != null
        && request.resource.data.keys().subsetOf(['lastPrice','prevPrice','changePct','updatedAt'])
        && (
          (!request.resource.data.keys().hasAll(['lastPrice']) || request.resource.data.lastPrice is number) &&
          (!request.resource.data.keys().hasAll(['prevPrice'])  || request.resource.data.prevPrice  is number) &&
          (!request.resource.data.keys().hasAll(['changePct'])  || request.resource.data.changePct  is number) &&
          (!request.resource.data.keys().hasAll(['updatedAt'])  || request.resource.data.updatedAt  is timestamp)
        );
    }

    // 공개 체결 로그(사용 중이면 생성 허용, 아니면 전체 금지로 변경 가능)
    match /market/public/trades/{tid} {
      allow read: if true;
             // 트랜잭션에서 set이 update로 전송되는 경우가 있어 write로 허용하되 필드 제한
       allow write: if request.auth != null
         && request.resource.data.keys().hasAll(['side','price','qty','at'])
         && request.resource.data.side in ['buy','sell','trade']
         && request.resource.data.price is number
         && request.resource.data.qty is number
         && request.resource.data.qty > 0
         && (request.resource.data.at is timestamp || request.resource.data.at == request.time || request.resource.data.at == null);
      allow delete: if false;
    }

    // ===== 스터디 그룹 =====
         function isGroupMember(gid) {
       return request.auth != null
         && exists(/databases/$(database)/documents/studyGroups/$(gid))
         && (request.auth.uid in get(/databases/$(database)/documents/studyGroups/$(gid)).data.members);
     }

    match /studyGroups/{gid} {
      // 그룹원만 조회
      allow read: if isGroupMember(gid);
      // 생성: 소유자=본인, 멤버 배열은 본인 1명으로 시작
             allow create: if request.auth != null
         && request.resource.data.ownerUid == request.auth.uid
         && request.resource.data.members is list
         && request.resource.data.members.size() == 1
         && request.resource.data.members[0] == request.auth.uid
         && request.resource.data.name is string
         && request.resource.data.inviteCode is string
         && (request.resource.data.createdAt is timestamp || request.resource.data.createdAt == request.time || request.resource.data.createdAt == null)
         && (
           (!request.resource.data.keys().hasAll(['desc']) || request.resource.data.desc is string) &&
           (!request.resource.data.keys().hasAll(['weekSolved']) || request.resource.data.weekSolved is number) &&
           (!request.resource.data.keys().hasAll(['challengeTarget']) || request.resource.data.challengeTarget is number) &&
           (!request.resource.data.keys().hasAll(['challengeStartKey']) || request.resource.data.challengeStartKey is string)
         );
      // 업데이트: 그룹원만
      allow update: if isGroupMember(gid);
      // 삭제: 소유자만
      allow delete: if request.auth != null && request.auth.uid == resource.data.ownerUid;
    }

    match /studyGroups/{gid}/chat/{mid} {
      allow read: if isGroupMember(gid);
             allow create: if isGroupMember(gid)
         && request.resource.data.keys().hasAll(['uid','userName','text','at'])
         && request.resource.data.uid == request.auth.uid
         && request.resource.data.text is string
         && (request.resource.data.at is timestamp || request.resource.data.at == request.time || request.resource.data.at == null);
      allow update, delete: if false;
    }

    match /studyGroups/{gid}/gifts/{giftId} {
      allow read: if isGroupMember(gid);
             allow create: if isGroupMember(gid)
         && request.resource.data.keys().hasAll(['from','to','amount','at'])
         && request.resource.data.from == request.auth.uid
         && request.resource.data.amount is number
         && request.resource.data.amount > 0
         && (request.resource.data.to in get(/databases/$(database)/documents/studyGroups/$(gid)).data.members)
         && (request.resource.data.at is timestamp || request.resource.data.at == request.time || request.resource.data.at == null);
      allow update, delete: if false;
    }

    match /studyGroups/{gid}/meta/{docId} {
      allow read: if isGroupMember(gid);
      allow write: if isGroupMember(gid)
                 && request.resource.data.keys().hasAll(['progress','target','startKey','updatedAt'])
                 && (
           (!request.resource.data.keys().hasAll(['progress']) || request.resource.data.progress is number) &&
           (!request.resource.data.keys().hasAll(['target']) || request.resource.data.target is number) &&
           (!request.resource.data.keys().hasAll(['startKey']) || request.resource.data.startKey is string) &&
           (!request.resource.data.keys().hasAll(['updatedAt']) || request.resource.data.updatedAt is timestamp)
         );
    }

    // 공개 목록/현황용 축약 정보
    match /studyGroupsPublic/{gid} {
      // 누구나 읽기 가능 (그룹 탐색/현황 보기)
      allow read: if true;
      // 쓰기는 해당 그룹 멤버만 가능 (더 안전)
      allow write: if isGroupMember(gid)
                 && (
           (!request.resource.data.keys().hasAll(['name']) || request.resource.data.name is string) &&
           (!request.resource.data.keys().hasAll(['desc']) || request.resource.data.desc is string) &&
           (!request.resource.data.keys().hasAll(['memberCount']) || request.resource.data.memberCount is number) &&
           (!request.resource.data.keys().hasAll(['progress']) || request.resource.data.progress is number) &&
           (!request.resource.data.keys().hasAll(['target']) || request.resource.data.target is number) &&
           (!request.resource.data.keys().hasAll(['updatedAt']) || request.resource.data.updatedAt is timestamp)
         );
    }

    // ===== Q&A =====
    match /qaQuestions/{qid} {
      allow read: if true;
             allow create: if request.auth != null
         && request.resource.data.keys().hasAll(['uid','title','body','tags','subject','cat','sub','topic','qid','answers','votes','acceptedAnswerId','createdAt'])
         && request.resource.data.uid == request.auth.uid
         && request.resource.data.title is string
         && request.resource.data.answers is number
         && request.resource.data.votes is number
         && (request.resource.data.createdAt is timestamp || request.resource.data.createdAt == request.time || request.resource.data.createdAt == null);
      allow update: if request.auth != null
        && resource.data.uid == request.auth.uid
        && request.resource.data.diff(resource.data).changedKeys().subsetOf(['title','body','tags','subject','cat','sub','topic','qid','acceptedAnswerId','answers','votes']);
      allow delete: if false;
    }
    match /qaQuestions/{qid}/answers/{aid} {
      allow read: if true;
             allow create: if request.auth != null
         && request.resource.data.keys().hasAll(['uid','body','createdAt'])
         && request.resource.data.uid == request.auth.uid
         && request.resource.data.body is string
         && (request.resource.data.createdAt is timestamp || request.resource.data.createdAt == request.time || request.resource.data.createdAt == null);
             allow update: if request.auth != null
         && resource.data.uid == request.auth.uid
         && request.resource.data.diff(resource.data).changedKeys().hasAll(['body'])
         && request.resource.data.diff(resource.data).changedKeys().size() == 1;
      allow delete: if false;
    }
    match /qaStats/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid
                 && request.resource.data.keys().hasAll(['questions','answers','accepted']);
    }

    // ===== Feedback =====
    match /feedback/{fid} {
      allow read: if true;
             // 작성은 인증자 누구나 가능(작성자=uid 고정)
       allow create: if request.auth != null
         && request.resource.data.keys().hasAll(['uid','title','body','category','status','createdAt'])
         && request.resource.data.uid == request.auth.uid
         && request.resource.data.body is string
         && request.resource.data.category in ['bug','improve','feature']
         && request.resource.data.status in ['open','answered','resolved']
         && (request.resource.data.createdAt is timestamp || request.resource.data.createdAt == request.time || request.resource.data.createdAt == null);
      // 상태 변경은 특정 관리자 UID만 가능
      allow update: if request.auth != null && request.auth.uid == 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2'
        && request.resource.data.diff(resource.data).changedKeys().subsetOf(['title','body','category','status']);
      allow delete: if false;
    }
    match /feedback/{fid}/replies/{rid} {
      allow read: if true;
             // 특정 관리자 UID만 답변 생성 가능
       allow create: if request.auth != null && request.auth.uid == 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2'
         && request.resource.data.keys().hasAll(['body','createdAt'])
         && request.resource.data.body is string
         && (request.resource.data.createdAt is timestamp || request.resource.data.createdAt == request.time || request.resource.data.createdAt == null);
      allow update, delete: if false;
    }
  }
}