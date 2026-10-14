const rides = [
  'T 익스프레스',
  '아마존 익스프레스',
  '썬더폴스',
  '롤링 엑스트레인',
  '허리케인',
  '더블락스핀',
  '렛츠 트위스트',
  '매직스윙',
];

const missions = [
  '탑승 전, 팀원 모두 동의하면 어울리는 포즈로 인증 사진 찍기',
  '이용 전 주의사항 한 가지 확인하기',
  '탑승 전 기대감을 한 단어씩 나누기',
  '어트랙션 테마에서 디테일 하나 찾아보기',
  '이 놀이기구의 별명을 짓고 이유 말하기',
  '기대되거나 기억에 남은 순간 나누기',
  '주변을 방해하지 않는 짧은 응원 구호 만들기',
  '팀의 오늘의 용기상 주인공 한 명 뽑기',
];

const selections = { ride: null, mission: null };

function makeMachine(key, entries, fallbackAbove, fallbackCurrent, fallbackBelow) {
  return {
    key,
    entries,
    card: document.querySelector('#' + key + '-card'),
    previous: document.querySelector('#' + key + '-prev'),
    current: document.querySelector('#' + key + '-current'),
    next: document.querySelector('#' + key + '-next'),
    button: document.querySelector('#' + key + '-button'),
    buttonLabel: document.querySelector('#' + key + '-button-label'),
    meta: document.querySelector('#' + key + '-meta'),
    fallbacks: [fallbackAbove, fallbackCurrent, fallbackBelow],
    spinning: false,
  };
}

const machines = [
  makeMachine('ride', rides, '오늘의 목적지는?', '돌려서 정하기', '준비됐나요?'),
  makeMachine('mission', missions, '오늘의 도전은?', '돌려서 정하기', '준비됐나요?'),
];

const passRide = document.querySelector('#pass-ride');
const passMission = document.querySelector('#pass-mission');
const pairResult = document.querySelector('#pair-result');
const resetButton = document.querySelector('#reset-button');

function renderMachine(machine, chosenIndex) {
  if (chosenIndex === null) {
    machine.previous.textContent = machine.fallbacks[0];
    machine.current.textContent = machine.fallbacks[1];
    machine.next.textContent = machine.fallbacks[2];
    return;
  }

  const count = machine.entries.length;
  machine.previous.textContent = machine.entries[(chosenIndex - 1 + count) % count];
  machine.current.textContent = machine.entries[chosenIndex];
  machine.next.textContent = machine.entries[(chosenIndex + 1) % count];
}

function updatePass() {
  const ride = selections.ride;
  const mission = selections.mission;
  const isSpinning = machines.some((machine) => machine.spinning);

  passRide.textContent = ride || '목적지를 기다리는 중';
  passMission.textContent = mission || '미션을 기다리는 중';
  passRide.closest('.route-stop').classList.toggle('is-picked', Boolean(ride));
  passMission.closest('.route-stop').classList.toggle('is-picked', Boolean(mission));

  if (ride && mission) {
    pairResult.textContent = ride + '에서 ' + mission;
  } else if (ride) {
    pairResult.textContent = '목적지를 정했어요. 미션은 원할 때 따로 뽑아 보세요.';
  } else if (mission) {
    pairResult.textContent = '미션을 정했어요. 놀이기구는 나중에 골라도 괜찮아요.';
  } else {
    pairResult.textContent = '둘 다 뽑으면 오늘의 조합이 완성돼요.';
  }

  resetButton.disabled = (!ride && !mission) || isSpinning;
}

function spin(machine) {
  if (machine.spinning) return;

  machine.spinning = true;
  machine.card.classList.add('is-spinning');
  machine.button.disabled = true;
  machine.buttonLabel.textContent = '돌아가는 중';
  machine.meta.textContent = 'SPINNING';
  updatePass();

  const targetIndex = Math.floor(Math.random() * machine.entries.length);
  const startedAt = performance.now();
  const duration = 1750;
  let nextTickAt = startedAt;

  function animate(now) {
    if (now - startedAt >= duration) {
      renderMachine(machine, targetIndex);
      selections[machine.key] = machine.entries[targetIndex];
      machine.spinning = false;
      machine.card.classList.remove('is-spinning');
      machine.button.disabled = false;
      machine.buttonLabel.textContent = '다시 뽑기';
      machine.meta.textContent = 'PICKED #' + String(targetIndex + 1).padStart(2, '0');
      updatePass();
      return;
    }

    if (now >= nextTickAt) {
      const rollingIndex = Math.floor(Math.random() * machine.entries.length);
      renderMachine(machine, rollingIndex);
      const progress = (now - startedAt) / duration;
      nextTickAt = now + 42 + progress * progress * 190;
    }

    window.requestAnimationFrame(animate);
  }

  window.requestAnimationFrame(animate);
}

machines.forEach((machine) => {
  renderMachine(machine, null);
  machine.button.addEventListener('click', () => spin(machine));
});

resetButton.addEventListener('click', () => {
  selections.ride = null;
  selections.mission = null;

  machines.forEach((machine) => {
    renderMachine(machine, null);
    machine.buttonLabel.textContent = machine.key === 'ride' ? '목적지 뽑기' : '미션 뽑기';
    machine.meta.textContent = 'READY';
  });

  updatePass();
});

updatePass();
