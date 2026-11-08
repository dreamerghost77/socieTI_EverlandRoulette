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
    timber: Object.freeze({ id: 'special-timber', type: 'special', text: '공식 탑승 사진 촬영 구간에서 양손 브이 포즈 취하기' }),
    river: Object.freeze({ id: 'special-river', type: 'special', text: '하차 후 안전 구역에서 팀원들과 정글 탐험대 포즈로 사진 찍기' }),
    thunder: Object.freeze({ id: 'special-thunder', type: 'special', text: '하차 후 지정된 안전 구역에서 물보라를 피하는 포즈로 사진 찍기' }),
    storm: Object.freeze({ id: 'special-storm', type: 'special', text: '탑승 후 안전 구역에서 오늘의 스릴을 한 문장으로 소개하는 영상 촬영하기' }),
  });

  const generalMissions = Object.freeze([
    Object.freeze({ id: 'general-churros', type: 'general', text: '구매한 츄러스를 한입 먹고 팀원과 먹방 인증 사진 찍기' }),
    Object.freeze({ id: 'general-staff-selfie', type: 'general', text: '직원분의 동의를 얻어 팀 셀카 촬영하기' }),
    Object.freeze({ id: 'general-reels', type: 'general', text: '팀원만 출연하는 릴스 스타일 에버랜드 홍보 영상 촬영하기' }),
    Object.freeze({ id: 'general-card', type: 'general', text: '상대가 동의하면 사회공헌단 명함을 건네고 응원 한마디 전하기' }),
    Object.freeze({ id: 'general-color', type: 'general', text: '팀원 모두가 같은 색을 찾아 손가락으로 가리키며 기념사진 찍기' }),
    Object.freeze({ id: 'general-pose', type: 'general', text: '다섯 명이 각자 다른 동물 포즈를 만들고 단체사진 남기기' }),
    Object.freeze({ id: 'general-slogan', type: 'general', text: '팀 이름과 구호를 정해 함께 외치는 짧은 영상 촬영하기' }),
    Object.freeze({ id: 'general-map', type: 'general', text: '공원 안내 지도를 보고 다음에 가고 싶은 장소를 하나씩 소개하기' }),
    Object.freeze({ id: 'general-thanks', type: 'general', text: '팀원 한 명에게 고마웠던 일을 한 문장으로 말하고 기록하기' }),
    Object.freeze({ id: 'general-photo', type: 'general', text: '촬영에 동의한 팀원만 나오도록 오늘의 기념사진 찍기' }),
  ]);

  const data = Object.freeze({ rides, teams, specialMissions, generalMissions });
  if (typeof window !== 'undefined') window.EverlandEventData = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})();
