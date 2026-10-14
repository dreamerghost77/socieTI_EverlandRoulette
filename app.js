const choices = {
  ride: {
    heading: '놀이기구 룰렛',
    kicker: '축하해요! 오늘의 놀이기구',
    detail: '오늘의 목적지가 정해졌어요. 안전 수칙을 확인하고 즐겨보세요.',
    entries: [
      { name: 'T 익스프레스', label: 'T 익스프레스' },
      { name: '아마존 익스프레스', label: '아마존 익스프레스' },
      { name: '썬더폴스', label: '썬더폴스' },
      { name: '롤링 엑스트레인', label: '롤링 엑스트레인' },
      { name: '허리케인', label: '허리케인' },
      { name: '더블락스핀', label: '더블락스핀' },
      { name: '렛츠 트위스트', label: '렛츠 트위스트' },
      { name: '매직스윙', label: '매직스윙' },
    ],
  },
  mission: {
    heading: '미션 룰렛',
    kicker: '축하해요! 오늘의 미션',
    detail: '함께하는 사람과 현장 안내를 존중하며 도전해 보세요.',
    entries: [
      { name: '탑승 전, 팀원 모두 동의하면 어울리는 포즈로 인증 사진 찍기', label: '포즈 인증샷' },
      { name: '이용 전 주의사항 한 가지 확인하기', label: '안전 수칙 확인' },
      { name: '탑승 전 기대감을 한 단어씩 나누기', label: '기대 한마디' },
      { name: '어트랙션 테마에서 디테일 하나 찾아보기', label: '테마 디테일' },
      { name: '이 놀이기구의 별명을 짓고 이유 말하기', label: '별명 짓기' },
      { name: '기대되거나 기억에 남은 순간 나누기', label: '추억 나누기' },
      { name: '주변을 방해하지 않는 짧은 응원 구호 만들기', label: '조용한 응원' },
      { name: '팀의 오늘의 용기상 주인공 한 명 뽑기', label: '오늘의 용기상' },
    ],
  },
};

const homeScreen = document.querySelector('#home-screen');
const rouletteScreen = document.querySelector('#roulette-screen');
const wheel = document.querySelector('#roulette-wheel');
const heading = document.querySelector('#roulette-heading');
const spinHint = document.querySelector('#spin-hint');
const winnerOverlay = document.querySelector('#winner-overlay');
const winnerKicker = document.querySelector('#winner-kicker');
const winnerTitle = document.querySelector('#winner-title');
const winnerDetail = document.querySelector('#winner-detail');
const confettiLayer = document.querySelector('#confetti-layer');
const spinAgainButton = document.querySelector('#spin-again');
const backHomeButton = document.querySelector('#back-home');

let activeKind = null;
let finishTimer = null;

function buildWheel(entries) {
  const size = wheel.clientWidth;
  const slice = 360 / entries.length;
  const radius = size * 0.34;
  const palette = ['#191919', '#242424', '#151515', '#202020'];
  const slices = entries.map((entry, index) => {
    const start = index * slice;
    const end = (index + 1) * slice;
    return palette[index % palette.length] + ' ' + start + 'deg ' + end + 'deg';
  });

  wheel.replaceChildren();
  wheel.style.setProperty('--slice-angle', slice + 'deg');
  wheel.style.background = 'conic-gradient(' + slices.join(',') + ')';
  wheel.setAttribute('aria-label', entries.map((entry) => entry.name).join(', '));

  entries.forEach((entry, index) => {
    const angle = (index + 0.5) * slice - 90;
    const radians = (angle * Math.PI) / 180;
    const label = document.createElement('span');
    label.className = 'wheel-label';
    label.textContent = entry.label;
    label.style.left = (50 + (Math.cos(radians) * radius * 100) / size) + '%';
    label.style.top = (50 + (Math.sin(radians) * radius * 100) / size) + '%';
    wheel.append(label);
  });
}

function showConfetti() {
  confettiLayer.replaceChildren();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colors = ['#ffd36a', '#fa765f', '#5dd3bf', '#f8f8f5', '#b38bff', '#ff91c8'];
  const shapes = ['', 'round', 'streamer'];
  for (let index = 0; index < 96; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece ' + shapes[Math.floor(Math.random() * shapes.length)];
    piece.style.left = Math.random() * 100 + '%';
    piece.style.backgroundColor = colors[index % colors.length];
    piece.style.setProperty('--delay', Math.random() * 0.45 + 's');
    piece.style.setProperty('--duration', 2.5 + Math.random() * 1.5 + 's');
    piece.style.setProperty('--drift', (Math.random() * 240 - 120) + 'px');
    piece.style.setProperty('--spin', (Math.random() * 1080 - 540) + 'deg');
    confettiLayer.append(piece);
  }

  window.setTimeout(() => confettiLayer.replaceChildren(), 5000);
}

function finishSpin(selectedIndex) {
  const current = choices[activeKind];
  const selected = current.entries[selectedIndex];
  winnerKicker.textContent = current.kicker;
  winnerTitle.textContent = selected.name;
  winnerTitle.classList.toggle('long-title', activeKind === 'mission');
  winnerDetail.textContent = current.detail;
  spinHint.textContent = '선정 완료!';
  winnerOverlay.hidden = false;
  showConfetti();
}

function spinWheel() {
  const entries = choices[activeKind].entries;
  const selectedIndex = Math.floor(Math.random() * entries.length);
  const slice = 360 / entries.length;
  const centerAngle = (selectedIndex + 0.5) * slice;
  const alignment = (360 - centerAngle + 360) % 360;
  const finalRotation = 6 * 360 + alignment;
  let finished = false;

  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
  void wheel.offsetWidth;
  wheel.style.transition = '';

  function finishOnce() {
    if (finished) return;
    finished = true;
    window.clearTimeout(finishTimer);
    wheel.removeEventListener('transitionend', onTransitionEnd);
    finishSpin(selectedIndex);
  }

  function onTransitionEnd(event) {
    if (event.target === wheel && event.propertyName === 'transform') finishOnce();
  }

  wheel.addEventListener('transitionend', onTransitionEnd);
  finishTimer = window.setTimeout(finishOnce, 5500);
  spinHint.textContent = '돌아가는 중...';
  wheel.style.transform = 'rotate(' + finalRotation + 'deg)';
}

function startRoulette(kind) {
  activeKind = kind;
  const current = choices[kind];
  homeScreen.hidden = true;
  rouletteScreen.hidden = false;
  winnerOverlay.hidden = true;
  rouletteScreen.classList.remove('has-winner');
  heading.textContent = current.heading;
  wheel.setAttribute('aria-label', current.heading);
  buildWheel(current.entries);
  requestAnimationFrame(spinWheel);
}

function showHome() {
  window.clearTimeout(finishTimer);
  confettiLayer.replaceChildren();
  winnerOverlay.hidden = true;
  rouletteScreen.hidden = true;
  homeScreen.hidden = false;
  activeKind = null;
}

document.querySelectorAll('.home-button').forEach((button) => {
  button.addEventListener('click', () => startRoulette(button.dataset.kind));
});

spinAgainButton.addEventListener('click', () => {
  winnerOverlay.hidden = true;
  confettiLayer.replaceChildren();
  requestAnimationFrame(spinWheel);
});

backHomeButton.addEventListener('click', showHome);
