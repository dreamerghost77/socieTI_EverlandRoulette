(() => {
  'use strict';

  const rides = Object.freeze([
    {
      name: 'T 익스프레스', theme: 'timber', difficulty: '상',
      tag: 'WOODEN THRILL / 숨 멎는 급강하',
      description: '나무 레일을 타고 하늘 끝에서 아래로. 오늘은 심장이 먼저 달려가는 모험이에요.',
      accent: '#ffb86b', rgb: '255, 184, 107',
    },
    {
      name: '아마존 익스프레스', theme: 'river', difficulty: '중',
      tag: 'JUNGLE RIVER / 예측불가 급류',
      description: '물결을 따라 정글 속으로. 어느 쪽으로 흘러갈지 모르는 이야기가 기다려요.',
      accent: '#2eeac2', rgb: '46, 234, 194',
    },
    {
      name: '썬더폴스', theme: 'thunder', difficulty: '중',
      tag: 'THUNDER SPLASH / 거대한 물보라',
      description: '고요한 물길 끝에 기다리는 짜릿한 낙하. 물보라가 터지는 순간, 모험이 시작돼요.',
      accent: '#a971ff', rgb: '169, 113, 255',
    },
    {
      name: '허리케인', theme: 'storm', difficulty: '상',
      tag: 'INTO THE STORM / 폭풍 속으로',
      description: '바람이 모이고, 몸이 떠오르는 순간. 한가운데로 뛰어드는 대담한 모험이 찾아왔어요.',
      accent: '#ffc65d', rgb: '255, 198, 93',
    },
  ]);

  const teams = Object.freeze([
    Object.freeze({ id: 'high-1', difficulty: '상', label: '상 난이도 1팀', number: 1, kind: 'random' }),
    Object.freeze({ id: 'high-2', difficulty: '상', label: '상 난이도 2팀', number: 2, kind: 'random' }),
    Object.freeze({ id: 'medium-1', difficulty: '중', label: '중 난이도 1팀', number: 1, kind: 'fixed', members: Object.freeze(['BJ', 'MYJ', 'JT', 'KW', 'CYJ']) }),
  ]);

  // Keep one ride-specific special mission per attraction so the association is easy to edit.
  const specialMissions = Object.freeze({
    timber: Object.freeze({ id: 'special-timber', type: 'special', text: '공식 사진 구간에서 양손 브이 포즈로 사진찍히기' }),
    river: Object.freeze({ id: 'special-river', type: 'special', text: '탑승 이후 제일 물 많이 맞은 사람으로 지목되기' }),
    thunder: Object.freeze({ id: 'special-thunder', type: 'special', text: '탑승 이후 제일 물 많이 맞은 사람으로 지목되기' }),
    storm: Object.freeze({ id: 'special-storm', type: 'special', text: '탑승 전 1~100 사이 숫자 5개 뽑기 이후 탑승 이후 기억력테스트 성공하기' }),
  });

  const generalMissions = Object.freeze([
    Object.freeze({ id: 'general-01', type: 'general', text: '본인 포함 팀원 3명 이상 츄러스 사먹기' }),
    Object.freeze({ id: 'general-02', type: 'general', text: '직원의 동의를 구한 뒤 셀카 찍기' }),
    Object.freeze({ id: 'general-03', type: 'general', text: '릴스 형식의 에버랜드 홍보 영상 찍기' }),
    Object.freeze({ id: 'general-04', type: 'general', text: '모르는 사람에게 사회공헌단 명함 건네고 응원받기' }),
    Object.freeze({ id: 'general-05', type: 'general', text: '에버랜드에서 빨주노초파남보 색깔 7가지 찾아오기' }),
    Object.freeze({ id: 'general-06', type: 'general', text: '본인이 중앙을 차지한 단체사진 3개 이상 찍기' }),
    Object.freeze({ id: 'general-07', type: 'general', text: '사회공헌 활동 이후 인증(예: 쓰레기 주워 분리수거)' }),
    Object.freeze({ id: 'general-08', type: 'general', text: '본인이 낙오된 단체사진 한 장 이상 찍기' }),
    Object.freeze({ id: 'general-09', type: 'general', text: '모두가 정면을 바라보지 않는 단체사진 1장 이상 찍기' }),
    Object.freeze({ id: 'general-10', type: 'general', text: '본인 제외 다른 팀원들의 단독사진 1장씩 찍어오기' }),
    Object.freeze({ id: 'general-11', type: 'general', text: '틈내서 김홍종 미적분학 연습문제 3개 풀기' }),
    Object.freeze({ id: 'general-12', type: 'general', text: '다른 팀 만나서 사진찍기' }),
    Object.freeze({ id: 'general-13', type: 'general', text: '다른 단원 한 명을 지목해 1분 동안 공주님·왕자님처럼 모시기' }),
    Object.freeze({ id: 'general-14', type: 'general', text: '에버랜드 머리띠 쓰고 2시간 이상 돌아다니기' }),
    Object.freeze({ id: 'general-15', type: 'general', text: '에버랜드에서 공주님·왕자님 콘셉트로 인생샷 찍기' }),
    Object.freeze({ id: 'general-16', type: 'general', text: '팀원들이 정해준 별명으로 1시간 동안 불리기' }),
    Object.freeze({ id: 'general-17', type: 'general', text: '에버랜드에서 혼자 패션 화보 3장 찍기' }),
    Object.freeze({ id: 'general-18', type: 'general', text: '다른 단원 한 명과 연애 프로그램 첫 만남 장면 연기하기' }),
  ]);

  const data = Object.freeze({ rides, teams, specialMissions, generalMissions });
  if (typeof window !== 'undefined') window.EverlandEventData = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})();
