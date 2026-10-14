const rides = [
  { name: 'T 익스프레스', label: 'T<br>익스프레스' },
  { name: '아마존 익스프레스', label: '아마존<br>익스프레스' },
  { name: '썬더폴스', label: '썬더<br>폴스' },
  { name: '롤링 엑스트레인', label: '롤링<br>엑스트레인' },
  { name: '허리케인', label: '허리케인' },
  { name: '더블락스핀', label: '더블<br>락스핀' },
  { name: '렛츠 트위스트', label: '렛츠<br>트위스트' },
  { name: '매직스윙', label: '매직<br>스윙' },
];

const missions = [
  { name: '팀원 모두 동의하면 어울리는 포즈로 인증 사진 찍기', label: '포즈<br>인증샷' },
  { name: '이용 전 주의사항 한 가지 확인하기', label: '주의사항<br>확인' },
  { name: '탑승 전 기대감을 한 단어씩 나누기', label: '기대감<br>한 단어' },
  { name: '어트랙션 테마에서 디테일 하나 찾아보기', label: '테마<br>디테일' },
  { name: '이 놀이기구의 별명을 짓고 이유 말하기', label: '별명<br>짓기' },
  { name: '기대되거나 기억에 남은 순간 나누기', label: '기억<br>나누기' },
  { name: '주변을 방해하지 않는 짧은 응원 구호 만들기', label: '조용한<br>응원 구호' },
  { name: '팀의 오늘의 용기상 주인공 한 명 뽑기', label: '오늘의<br>용기상' },
];

const rideWheel = document.querySelector('#ride-wheel');
const missionWheel = document.querySelector('#mission-wheel');
const spinButton = document.querySelector('#spin-button');
const buttonLabel = document.querySelector('#button-label');
const actionHint = document.querySelector('#action-hint');
const resultPlaceholder = document.querySelector('#result-placeholder');
const resultText = document.querySelector('#result-text');

function drawLabels(wheel, entries) {
  const radius = wheel.clientWidth * 0.32;
  const slice = 360 / entries.length;

  wheel.replaceChildren();
  entries.forEach((entry, index) => {
    const angle = (index + 0.5) * slice - 90;
    const radians = (angle * Math.PI) / 180;
    const label = document.createElement('span');
    label.className = 'wheel-label';
    label.innerHTML = entry.label;
    label.style.left = `${50 + (Math.cos(radians) * radius * 100) / wheel.clientWidth}%`;
    label.style.top = `${50 + (Math.sin(radians) * radius * 100) / wheel.clientHeight}%`;
    wheel.append(label);
  });
}

function setupWheel(wheel, entries) {
  drawLabels(wheel, entries);
  const observer = new ResizeObserver(() => drawLabels(wheel, entries));
  observer.observe(wheel);
}

function spinWheel(wheel, entryCount) {
  return new Promise((resolve) => {
    const chosenIndex = Math.floor(Math.random() * entryCount);
    const slice = 360 / entryCount;
    const currentRotation = Number(wheel.dataset.rotation || 0);
    const currentAngle = ((currentRotation % 360) + 360) % 360;
    const desiredAngle = (360 - (chosenIndex + 0.5) * slice + 360) % 360;
    const extraRotation = (desiredAngle - currentAngle + 360) % 360;
    const nextRotation = currentRotation + 5 * 360 + extraRotation;

    wheel.dataset.rotation = String(nextRotation);
    wheel.style.transform = `rotate(${nextRotation}deg)`;
    wheel.addEventListener('transitionend', () => resolve(chosenIndex), { once: true });
  });
}

setupWheel(rideWheel, rides);
setupWheel(missionWheel, missions);

spinButton.addEventListener('click', async () => {
  spinButton.disabled = true;
  buttonLabel.textContent = '두 룰렛이 돌아가는 중';
  actionHint.textContent = '두근두근… 오늘의 조합을 고르고 있어요!';
  resultPlaceholder.hidden = true;
  resultText.hidden = true;

  const [rideIndex, missionIndex] = await Promise.all([
    spinWheel(rideWheel, rides.length),
    spinWheel(missionWheel, missions.length),
  ]);

  resultText.innerHTML = `<strong>${rides[rideIndex].name}</strong>에서<br>${missions[missionIndex].name}`;
  resultText.hidden = false;
  buttonLabel.textContent = '다시 뽑기';
  actionHint.textContent = '마음에 들지 않으면 한 번 더 뽑아도 좋아요.';
  spinButton.disabled = false;
});
