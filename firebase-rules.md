// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ===== 사용자 개인 데이터 =====
    // 본인 소유 데이터 전체(프로필, 포인트/코인, 아이템, 구매, 트랜잭션, 학습로그, 답안, 업적, 효과, 챌린지 등)
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
         // 코인 지급 내역 - 관리자만 생성 가능
     match /users/{userId}/coinHistory/{historyId} {
       allow read: if request.auth != null && request.auth.uid == userId;
       allow create: if request.auth != null && request.auth.uid == 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2'
         && request.resource.data.keys().hasAll(['amount','reason','givenAt','givenBy'])
         && request.resource.data.amount is number
         && request.resource.data.amount > 0
         && request.resource.data.reason is string
         && (request.resource.data.givenAt is timestamp || request.resource.data.givenAt == request.time || request.resource.data.givenAt == null)
         && request.resource.data.givenBy == 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2';
       allow update, delete: if false;
     }
     
     // 관리자 페이지용 사용자 데이터 읽기 권한
     match /users/{userId} {
       allow read: if request.auth != null && request.auth.uid == 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2';
     }
     
     // 관리자 페이지용 사용자 하위 컬렉션 읽기 권한
     match /users/{userId}/wallet/{docId} {
       allow read: if request.auth != null && request.auth.uid == 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2';
     }
     
     match /users/{userId}/dailyStats/{docId} {
       allow read: if request.auth != null && request.auth.uid == 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2';
     }
     
     match /users/{userId}/purchases/{docId} {
       allow read: if request.auth != null && request.auth.uid == 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2';
     }
     
     match /users/{userId}/lotteryTickets/{docId} {
       allow read: if request.auth != null && request.auth.uid == 'zcaWS7Kl8xSeBoWrVY5w2LpMwsj2';
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
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.side in ['buy','sell']
        && request.resource.data.price is number
        && request.resource.data.qty is number
        && request.resource.data.qty > 0;

      // 업데이트: 매칭 시스템을 위한 매우 완화된 규칙
      allow update: if request.auth != null;

      // 삭제 불허
      allow delete: if false;
    }

    // 체결/정산
    match /market/public/settlements/{sid} {
      allow read: if true;

      // 생성: 인증자, 필수 필드 검증 (완화된 규칙)
      allow create: if request.auth != null;

      // 정산: 매우 완화된 업데이트 규칙
      allow update: if request.auth != null;

      allow delete: if false;
    }

    // 티커: 공개 읽기, 인증자 쓰기
    match /market/public/ticker/{docId} {
      allow read: if true;
      // 매칭 시스템을 위한 매우 완화된 규칙
      allow write: if request.auth != null;
    }

    // 공개 체결 로그
    match /market/public/trades/{tid} {
      allow read: if true;
      // 매칭 시스템을 위한 매우 완화된 규칙
      allow write: if request.auth != null;
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
           (!request.resource.data.keys().hasAll(['updatedAt']) || request.resource.data.updatedAt is timestamp) &&
           (!request.resource.data.keys().hasAll(['rewardGiven']) || request.resource.data.rewardGiven is bool)
         );
    }

    // 보상 기록 컬렉션
    match /studyGroups/{gid}/rewards/{rewardId} {
      allow read: if isGroupMember(gid);
      allow create: if isGroupMember(gid)
                 && request.resource.data.keys().hasAll(['type','progress','memberCount','rewardedAt'])
                 && request.resource.data.type == 'weekly_challenge'
                 && request.resource.data.progress is number
                 && request.resource.data.memberCount is number
                 && (request.resource.data.rewardedAt is timestamp || request.resource.data.rewardedAt == request.time || request.resource.data.rewardedAt == null)
                 && (
           (!request.resource.data.keys().hasAll(['topContributor']) || request.resource.data.topContributor is string) &&
           (!request.resource.data.keys().hasAll(['topContribution']) || request.resource.data.topContribution is number)
         );
      allow update, delete: if false;
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