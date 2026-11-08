(() => {
  'use strict';

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const FACE_HEIGHT = 88;
  const FACE_ANGLE = 360 / ALPHABET.length;
  const RADIUS = FACE_HEIGHT / (2 * Math.tan(Math.PI / ALPHABET.length));

  class NameDraw {
    constructor({ element, onComplete, onPhase, onSound } = {}) {
      if (!element) throw new Error('NameDraw requires a screen element.');
      this.element = element;
      this.onComplete = onComplete || (() => {});
      this.onPhase = onPhase || (() => {});
      this.onSound = onSound || (() => {});
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.timers = new Set();
      this.frames = new Set();
      this.transitionCleanups = new Set();
      this.generation = 0;
      this.active = false;
      this.currentPhase = 'idle';
      this.onMotionChange = () => {
        if (this.motionQuery.matches && this.phase === 'spinning') this.skip();
      };
    }

    get phase() { return this.currentPhase; }

    start({ ride, group } = {}) {
      this.cancel();
      if (!group || !/^[A-Z]{2}$/.test(group.initials) || !Array.isArray(group.candidates) || !group.candidates.length || group.candidates.length > 2) {
        throw new Error('NameDraw requires one or two participants with the same two name initials.');
      }
      if (group.candidates.some((person) => person.initials !== group.initials || !/^[A-Z]{2,3}$/.test(person.id))) {
        throw new Error('NameDraw participant initials are invalid.');
      }
      this.active = true;
      this.delivered = false;
      this.choiceMade = false;
      this.group = { initials: group.initials, candidates: group.candidates.slice() };
      this.ride = ride || {};
      this.locked = [false, false];
      this.cardCandidates = [];
      this.render();
      this.setPhase('spinning');
      this.motionQuery.addEventListener('change', this.onMotionChange);
      this.element.querySelector('#owner-heading').focus({ preventScroll: true });
      this.say('알파벳 원통 두 개가 돌아갑니다. 이름 이니셜 두 글자를 뽑고 있어요.');
      this.onSound('tick');
      this.frame(() => {
        void this.element.offsetWidth;
        this.frame(() => this.spin());
      });
    }

    cancel() {
      this.active = false;
      this.generation += 1;
      this.timers.forEach((timer) => window.clearTimeout(timer));
      this.timers.clear();
      this.frames.forEach((frame) => cancelAnimationFrame(frame));
      this.frames.clear();
      this.transitionCleanups.forEach((cleanup) => cleanup());
      this.transitionCleanups.clear();
      this.motionQuery.removeEventListener('change', this.onMotionChange);
      this.currentPhase = 'cancelled';
      this.element.dataset.ownerPhase = 'cancelled';
    }

    skip() {
      if (!this.active || this.phase !== 'spinning') return;
      this.frames.forEach((frame) => cancelAnimationFrame(frame));
      this.frames.clear();
      for (let index = 0; index < 2; index += 1) {
        const reel = this.element.querySelector('#owner-letter-' + index + ' .owner-letter-reel');
        reel.style.transition = 'none';
        reel.style.transform = this.transformFor(index);
        this.lockLetter(index);
      }
    }

    setPhase(phase) {
      if (!this.active) return;
      this.currentPhase = phase;
      this.element.dataset.ownerPhase = phase;
      this.onPhase(phase);
    }

    later(callback, delay) {
      const generation = this.generation;
      const timer = window.setTimeout(() => {
        this.timers.delete(timer);
        if (this.active && generation === this.generation) callback();
      }, delay);
      this.timers.add(timer);
      return timer;
    }

    frame(callback) {
      const generation = this.generation;
      const frame = requestAnimationFrame(() => {
        this.frames.delete(frame);
        if (this.active && generation === this.generation) callback();
      });
      this.frames.add(frame);
    }

    say(message) {
      const status = this.element.querySelector('#owner-status');
      if (status) status.textContent = message;
    }

    render() {
      this.element.innerHTML = `
        <div class="owner-intro">
          <p class="eyebrow"><span class="status-dot"></span> WHO WILL OWN THIS ADVENTURE?</p>
          <h1 id="owner-heading" tabindex="-1">이 티켓은 누구에게?</h1>
          <p class="owner-description" id="owner-description">두 개의 알파벳이 멈추면, 오늘의 티켓 주인이 드러납니다.</p>
          <div class="owner-destination"><svg aria-hidden="true"><use></use></svg><span id="owner-ride-name"></span><span class="owner-destination-label">DESTINATION CONFIRMED</span></div>
        </div>
        <div class="owner-layout">
          <div class="owner-reels-area">
            <div class="owner-machine-meta"><span>NAME INITIALS</span><span>02 LETTERS / 01 OWNER</span></div>
            <div class="owner-reels" aria-label="이름 이니셜 알파벳 원통 두 개">
              <div class="owner-reel-window" id="owner-letter-0" data-locked="false"><div class="owner-letter-reel" aria-hidden="true"></div><span class="owner-reel-selection" aria-hidden="true"></span><span class="owner-reel-shade" aria-hidden="true"></span><output class="sr-only" id="owner-letter-0-result"></output></div>
              <span class="owner-reel-join" aria-hidden="true">✦</span>
              <div class="owner-reel-window" id="owner-letter-1" data-locked="false"><div class="owner-letter-reel" aria-hidden="true"></div><span class="owner-reel-selection" aria-hidden="true"></span><span class="owner-reel-shade" aria-hidden="true"></span><output class="sr-only" id="owner-letter-1-result"></output></div>
            </div>
            <div class="owner-machine-meta owner-machine-bottom"><span id="owner-machine-state">FINDING THE TICKET HOLDER</span><span id="owner-lock-count">0 / 2 LOCKED</span></div>
            <div class="owner-initials-line" id="owner-initials-line" hidden><span>이름 이니셜</span><strong id="owner-initials"></strong><span class="owner-initials-check" aria-hidden="true">✓</span></div>
          </div>
          <div class="owner-choice-area" id="owner-choice-area" hidden>
            <p class="owner-card-eyebrow">ONE CARD, ONE TICKET HOLDER</p>
            <h2 id="surname-heading">성씨 이니셜을 골라주세요.</h2>
            <p class="owner-card-description" id="surname-description">이름 이니셜이 같은 두 사람이 있어요.<br>카드 한 장을 선택하면 티켓 주인이 확정됩니다.</p>
            <div class="surname-cards" id="surname-cards" aria-labelledby="surname-heading"></div>
          </div>
        </div>
        <div class="owner-confirmation" id="owner-confirmation" hidden>
          <span class="owner-confirmed-eyebrow">TICKET HOLDER CONFIRMED</span>
          <h2 id="owner-result" tabindex="-1"></h2>
          <p id="owner-result-detail"></p>
        </div>
        <p class="owner-bottom-note" id="owner-bottom-note"><span aria-hidden="true">✧</span> 한 사람에게 한 장씩, 새로운 모험을 전합니다.</p>
        <p class="sr-only" id="owner-status" role="status" aria-live="polite"></p>`;
      this.element.querySelector('#owner-ride-name').textContent = this.ride.name || '오늘의 모험';
      const theme = typeof this.ride.theme === 'string' && /^[a-z]+$/.test(this.ride.theme) ? this.ride.theme : 'timber';
      this.element.querySelector('.owner-destination use').setAttribute('href', '#icon-' + theme);
      this.element.style.setProperty('--owner-face-height', FACE_HEIGHT + 'px');
      this.element.style.setProperty('--owner-radius', RADIUS + 'px');
      for (let index = 0; index < 2; index += 1) {
        const reel = this.element.querySelector('#owner-letter-' + index + ' .owner-letter-reel');
        for (let letterIndex = 0; letterIndex < ALPHABET.length; letterIndex += 1) {
          const face = document.createElement('span');
          face.className = 'owner-letter-face';
          face.style.setProperty('--letter-angle', letterIndex * FACE_ANGLE + 'deg');
          face.textContent = ALPHABET[letterIndex];
          reel.append(face);
        }
        reel.style.transform = 'translateY(-50%) translateZ(-' + RADIUS + 'px) rotateX(0deg)';
      }
    }

    transformFor(index) {
      const letterIndex = ALPHABET.indexOf(this.group.initials[index]);
      const alignment = (360 - letterIndex * FACE_ANGLE) % 360;
      const turns = index === 0 ? 6 : 9;
      return 'translateY(-50%) translateZ(-' + RADIUS + 'px) rotateX(' + (turns * 360 + alignment) + 'deg)';
    }

    spin() {
      if (!this.active || this.phase !== 'spinning') return;
      for (let index = 0; index < 2; index += 1) {
        const reel = this.element.querySelector('#owner-letter-' + index + ' .owner-letter-reel');
        const duration = this.motionQuery.matches ? 65 + index * 65 : 2700 + index * 900;
        const generation = this.generation;
        const onEnd = (event) => {
          if (event.target === reel && event.propertyName === 'transform' && generation === this.generation) this.lockLetter(index);
        };
        const cleanup = () => {
          reel.removeEventListener('transitionend', onEnd);
          this.transitionCleanups.delete(cleanup);
        };
        this.transitionCleanups.add(cleanup);
        reel.addEventListener('transitionend', onEnd);
        reel.style.transition = 'transform ' + duration + 'ms cubic-bezier(.12,.74,.16,1)';
        reel.style.transform = this.transformFor(index);
        this.later(() => { cleanup(); this.lockLetter(index); }, duration + 140);
      }
    }

    lockLetter(index) {
      if (!this.active || this.phase !== 'spinning' || this.locked[index]) return;
      this.locked[index] = true;
      this.element.querySelector('#owner-letter-' + index).dataset.locked = 'true';
      this.element.querySelector('#owner-letter-' + index + '-result').textContent = this.group.initials[index];
      this.element.querySelector('#owner-lock-count').textContent = this.locked.filter(Boolean).length + ' / 2 LOCKED';
      this.onSound('lock');
      if (!this.locked.every(Boolean)) {
        this.say('첫 번째 알파벳 ' + this.group.initials[0] + '이 정해졌어요. 두 번째 알파벳을 기다려주세요.');
        return;
      }
      this.element.querySelector('#owner-initials').textContent = this.group.initials;
      this.element.querySelector('#owner-initials-line').hidden = false;
      this.element.querySelector('#owner-machine-state').textContent = 'NAME INITIALS LOCKED';
      this.setPhase('initials');
      this.say('이름 이니셜 ' + this.group.initials.split('').join(' ') + '이 정해졌어요.');
      this.later(() => {
        if (this.group.candidates.length === 2) this.presentCards();
        else this.confirm(this.group.candidates[0]);
      }, this.motionQuery.matches ? 110 : 420);
    }

    presentCards() {
      if (!this.active || this.phase !== 'initials') return;
      const candidates = this.group.candidates;
      this.cardCandidates = window.TicketRoster && typeof TicketRoster.shuffled === 'function'
        ? TicketRoster.shuffled(candidates)
        : (Math.random() < .5 ? candidates.slice() : candidates.slice().reverse());
      this.element.querySelector('#owner-choice-area').hidden = false;
      this.element.querySelector('#owner-description').textContent = '이름의 두 글자가 같아요. 마지막 성씨 이니셜은 카드 한 장으로 정합니다.';
      const cards = this.element.querySelector('#surname-cards');
      cards.replaceChildren();
      const generation = this.generation;
      this.cardCandidates.forEach((person, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'surname-card';
        card.setAttribute('aria-label', (index === 0 ? '첫 번째' : '두 번째') + ' 성씨 카드 선택');
        card.innerHTML = '<span class="surname-card-inner"><span class="surname-card-back" aria-hidden="true"><span class="surname-card-number">0' + (index + 1) + '</span><span class="surname-card-star">✦</span><span class="surname-card-caption">THE FINAL<br>INITIAL</span><span class="surname-card-mini">EVERLAND / ADVENTURE PASS</span></span><span class="surname-card-face" aria-hidden="true"><span class="surname-face-label">SURNAME</span><strong></strong><span class="surname-face-footer">YOUR TICKET, CONFIRMED</span></span></span>';
        card.addEventListener('click', () => {
          if (this.active && generation === this.generation) this.chooseCard(index);
        });
        cards.append(card);
      });
      this.setPhase('cards');
      this.say('같은 이름 이니셜을 가진 두 사람이 있어요. 성씨 카드 두 장 중 하나를 선택하세요.');
      cards.querySelector('button').focus({ preventScroll: true });
    }

    chooseCard(index) {
      if (!this.active || this.phase !== 'cards' || this.choiceMade) return;
      const candidate = this.cardCandidates[index];
      if (!candidate) return;
      this.choiceMade = true;
      const cards = Array.from(this.element.querySelectorAll('.surname-card'));
      cards.forEach((card) => { card.disabled = true; });
      const selected = cards[index];
      selected.querySelector('.surname-card-face strong').textContent = candidate.surname;
      selected.setAttribute('aria-label', '선택한 성씨 이니셜 ' + candidate.surname);
      selected.classList.add('is-selected');
      cards[1 - index].classList.add('is-unselected');
      this.setPhase('card-reveal');
      this.element.querySelector('#surname-description').textContent = '선택한 카드가 열립니다. 이 모험의 주인은…';
      this.onSound('card');
      this.say('선택한 카드에서 성씨 이니셜 ' + candidate.surname + '이 나왔어요.');
      this.later(() => this.confirm(candidate), this.motionQuery.matches ? 60 : 620);
    }

    confirm(person) {
      if (!this.active || this.delivered || !['initials', 'card-reveal'].includes(this.phase)) return;
      this.setPhase('confirmed');
      this.element.querySelector('#owner-heading').textContent = '티켓의 주인이 정해졌어요.';
      this.element.querySelector('#owner-description').textContent = person.surname && this.group.candidates.length === 1
        ? '이 이름 이니셜로 남아 있는 참가자가 한 명이라 성씨까지 확정했어요.'
        : '이름과 목적지가 만나, 한 장의 모험 티켓이 완성됐어요.';
      this.element.querySelector('#owner-confirmation').hidden = false;
      this.element.querySelector('#owner-result').textContent = person.id;
      this.element.querySelector('#owner-result-detail').textContent = (this.ride.name || '오늘의 모험') + ' 티켓의 주인';
      this.element.querySelector('#owner-bottom-note').hidden = true;
      if (this.group.candidates.length === 2) {
        this.element.querySelector('#surname-heading').textContent = '성씨 이니셜이 정해졌어요.';
        this.element.querySelector('#surname-description').textContent = person.surname + ' + ' + person.initials + ', 티켓의 주인이 확정됐어요.';
      }
      this.onSound('confirmed');
      this.say('티켓의 주인은 ' + person.id.split('').join(' ') + '입니다. 티켓을 채우고 있어요.');
      this.element.querySelector('#owner-result').focus({ preventScroll: true });
      this.later(() => {
        if (this.delivered) return;
        this.delivered = true;
        this.onComplete(person);
      }, this.motionQuery.matches ? 180 : 1050);
    }
  }

  window.NameDraw = NameDraw;
})();
