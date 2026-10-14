(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const THEMES = Object.freeze(['timber', 'river', 'thunder', 'neon', 'storm', 'rock', 'twist', 'magic']);
  const PALETTES = Object.freeze({
    timber: { main: '#ffb86b', accent: '#fa6545', light: '#ffe6be' },
    river: { main: '#2eeac2', accent: '#43baff', light: '#c8fff3' },
    thunder: { main: '#a971ff', accent: '#24caff', light: '#e3cfff' },
    neon: { main: '#fe62da', accent: '#65e9ff', light: '#fff1ff' },
    storm: { main: '#ffc65d', accent: '#ff784b', light: '#fff0c5' },
    rock: { main: '#ff5274', accent: '#ffb266', light: '#ffd4df' },
    twist: { main: '#bb88ff', accent: '#ff7fcf', light: '#f4e5ff' },
    magic: { main: '#ff9fd8', accent: '#a991ff', light: '#fff0f8' },
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const point = (x, y) => ({ x, y });

  function cubic(a, b, c, d, t) {
    const inverse = 1 - t;
    return point(
      inverse ** 3 * a.x + 3 * inverse ** 2 * t * b.x + 3 * inverse * t ** 2 * c.x + t ** 3 * d.x,
      inverse ** 3 * a.y + 3 * inverse ** 2 * t * b.y + 3 * inverse * t ** 2 * c.y + t ** 3 * d.y,
    );
  }

  function roundedRect(ctx, x, y, width, height, radius = 5) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  class RideEffects {
    static themes = THEMES;

    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.running = false;
      this.frameId = null;
      this.onResize = () => {
        this.resize();
        if (this.running && this.reducedMotion) this.render(2.6);
      };
      this.onMotionChange = () => {
        this.reducedMotion = this.motionQuery.matches;
        if (!this.running) return;
        this.cancelFrame();
        if (this.reducedMotion) this.render(2.6);
        else {
          this.startedAt = performance.now();
          this.frameId = requestAnimationFrame(this.onFrame);
        }
      };
      this.onFrame = (timestamp) => {
        if (!this.running || this.reducedMotion) return;
        this.render((timestamp - this.startedAt) / 1000);
        this.frameId = requestAnimationFrame(this.onFrame);
      };
    }

    start(theme, { intensity = 1 } = {}) {
      this.stop();
      if (!this.ctx) return;
      this.theme = THEMES.includes(theme) ? theme : 'magic';
      this.palette = PALETTES[this.theme];
      this.intensity = clamp(Number.isFinite(intensity) ? intensity : 1, 0.2, 2);
      this.reducedMotion = this.motionQuery.matches;
      this.particles = Array.from({ length: Math.min(140, Math.round(70 * this.intensity)) }, (_, index) => ({
        angle: Math.random() * TAU,
        radius: 90 + Math.random() * 360,
        phase: Math.random() * TAU,
        speed: 0.25 + Math.random() * 0.7,
        size: 0.8 + Math.random() * 2.2,
        star: index % 5 === 0,
      }));
      this.running = true;
      this.startedAt = performance.now();
      window.addEventListener('resize', this.onResize, { passive: true });
      this.motionQuery.addEventListener?.('change', this.onMotionChange);
      this.resize();
      this.render(this.reducedMotion ? 2.6 : 0);
      if (!this.reducedMotion) this.frameId = requestAnimationFrame(this.onFrame);
    }

    stop() {
      this.running = false;
      this.cancelFrame();
      window.removeEventListener('resize', this.onResize);
      this.motionQuery.removeEventListener?.('change', this.onMotionChange);
      if (this.ctx) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    cancelFrame() {
      if (this.frameId !== null) cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    resize() {
      const bounds = this.canvas.getBoundingClientRect();
      this.width = Math.max(1, bounds.width || window.innerWidth);
      this.height = Math.max(1, bounds.height || window.innerHeight);
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.width * this.pixelRatio);
      this.canvas.height = Math.round(this.height * this.pixelRatio);
      const compact = this.width < 700;
      this.centerX = this.width * (compact ? 0.5 : 0.68);
      this.centerY = this.height * (compact ? 0.28 : 0.38);
      this.scale = Math.min(this.width * (compact ? 0.0016 : 0.0009), this.height * 0.001);
    }

    render(time) {
      const ctx = this.ctx;
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.save();
      ctx.translate(this.centerX, this.centerY);
      ctx.scale(this.scale, this.scale);
      this.drawAtmosphere(time);
      this[`draw${this.theme[0].toUpperCase()}${this.theme.slice(1)}`](time);
      this.drawParticles(time);
      if (!this.reducedMotion) this.drawReveal(time);
      ctx.restore();
    }

    drawAtmosphere(time) {
      const ctx = this.ctx;
      const radius = 470 + Math.sin(time * 0.8) * 12;
      const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, radius);
      glow.addColorStop(0, `${this.palette.main}25`);
      glow.addColorStop(0.55, `${this.palette.main}12`);
      glow.addColorStop(1, `${this.palette.main}00`);
      ctx.fillStyle = glow;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    }

    strokePath(points, color, width = 2, glow = 0, closed = false) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
      ctx.beginPath();
      points.forEach((position, index) => {
        if (index === 0) ctx.moveTo(position.x, position.y);
        else ctx.lineTo(position.x, position.y);
      });
      if (closed) ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    ellipse(x, y, rx, ry, color, width = 2, glow = 0, rotation = 0) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    drawTrack(path, color, accent, wooden = false) {
      const points = Array.from({ length: 100 }, (_, index) => path(index / 99));
      if (wooden) {
        for (let index = 0; index < points.length; index += 7) {
          const current = points[index];
          const floor = Math.max(current.y + 45, 230);
          this.strokePath([current, point(current.x, floor)], '#81513388', 4);
          this.strokePath([current, point(current.x + 55, floor)], '#9b633f55', 2);
        }
      }
      this.strokePath(points, `${color}26`, 24, 18);
      const rails = [-7, 7].map((offset) => points.map((current, index) => {
        const next = points[Math.min(index + 1, points.length - 1)];
        const previous = points[Math.max(index - 1, 0)];
        const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
        return point(current.x - Math.sin(angle) * offset, current.y + Math.cos(angle) * offset);
      }));
      for (let index = 0; index < points.length; index += 3) {
        this.strokePath([rails[0][index], rails[1][index]], wooden ? '#d4935c' : `${accent}99`, wooden ? 4 : 2);
      }
      this.strokePath(rails[0], color, 2.5, 10);
      this.strokePath(rails[1], accent, 2.5, 10);
    }

    drawTrain(path, progress, color, count = 4) {
      const ctx = this.ctx;
      for (let index = count - 1; index >= 0; index -= 1) {
        const positionOnPath = ((progress - index * 0.024) % 1 + 1) % 1;
        const position = path(positionOnPath);
        const next = path((positionOnPath + 0.001) % 1);
        const angle = Math.atan2(next.y - position.y, next.x - position.x);
        ctx.save();
        ctx.translate(position.x, position.y);
        ctx.rotate(angle);
        ctx.shadowBlur = 18;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        roundedRect(ctx, -11, -13, 22, 16, 4);
        ctx.fill();
        ctx.fillStyle = '#fff3e8';
        roundedRect(ctx, -7, -12, 11, 5, 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#17141d';
        for (const x of [-7, 7]) {
          ctx.beginPath();
          ctx.arc(x, 6, 3, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    drawTimber(time) {
      const path = (progress) => progress < 0.58
        ? cubic(point(-410, -50), point(-200, -330), point(-160, -280), point(155, 150), progress / 0.58)
        : cubic(point(155, 150), point(340, 380), point(340, -130), point(465, -75), (progress - 0.58) / 0.42);
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#ce8250';
      for (let index = 0; index < 11; index += 1) {
        const x = -430 + index * 84;
        const height = 55 + Math.sin(index * 2.4) * 25;
        ctx.beginPath();
        ctx.moveTo(x, 248);
        ctx.lineTo(x + 24, 248 - height);
        ctx.lineTo(x + 48, 248);
        ctx.fill();
      }
      ctx.restore();
      this.drawTrack(path, '#fcb96d', '#f47d43', true);
      this.drawTrain(path, (time / 4 + 0.24) % 1, '#ffc980', 5);
      for (let index = 0; index < 9; index += 1) {
        const offset = (time * 110 + index * 73) % 590;
        this.strokePath([point(-430 + offset, -235 + index * 34), point(-398 + offset, -208 + index * 34)], '#ffcb8940', 1.5);
      }
    }

    drawRiver(time) {
      const ctx = this.ctx;
      const river = (progress) => {
        const angle = progress * TAU;
        return point(Math.cos(angle) * 315, Math.sin(angle) * 125 + Math.sin(angle * 3) * 26);
      };
      const riverPoints = Array.from({ length: 100 }, (_, index) => river(index / 99));
      this.strokePath(riverPoints, '#063f3f', 66, 0, true);
      this.strokePath(riverPoints, '#116e71', 50, 20, true);
      this.strokePath(riverPoints, '#2ce3c480', 33, 12, true);
      this.strokePath(riverPoints.map((p) => point(p.x, p.y - 8)), '#8efee56b', 2, 4, true);
      ctx.save();
      ctx.fillStyle = '#14765680';
      for (let index = 0; index < 12; index += 1) {
        const side = index % 2 ? -1 : 1;
        const x = side * (300 + index % 3 * 30);
        const y = -150 + index * 29;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(side * 0.35 + Math.sin(time * 0.6 + index) * 0.03);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-55 * side, -60, -100 * side, -5, -125 * side, -45);
        ctx.bezierCurveTo(-95 * side, 40, -35 * side, 55, 0, 0);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      const raft = river((time / 4 + 0.22) % 1);
      for (let index = 0; index < 3; index += 1) {
        const phase = (time * 0.55 + index / 3) % 1;
        ctx.save();
        ctx.globalAlpha = (1 - phase) * 0.6;
        this.ellipse(raft.x, raft.y, 29 + phase * 60, 16 + phase * 32, '#8df9e2', 1.5);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(raft.x, raft.y);
      ctx.rotate(time * 0.6);
      ctx.fillStyle = '#f5c568';
      ctx.shadowColor = '#62ffd3';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.ellipse(0, 0, 29, 25, 0, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#154d4b';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, TAU);
      ctx.fill();
      for (let index = 0; index < 6; index += 1) {
        const angle = index / 6 * TAU;
        ctx.fillStyle = '#fff1b7';
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 17, Math.sin(angle) * 15, 4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    drawThunder(time) {
      const ctx = this.ctx;
      const phase = (time % 4) / 4;
      const path = (progress) => cubic(point(-340, -240), point(-145, -240), point(220, 245), point(350, 145), progress);
      const track = Array.from({ length: 70 }, (_, index) => path(index / 69));
      this.strokePath(track, '#2a3759', 28);
      this.strokePath(track.map((p) => point(p.x, p.y - 8)), '#8e70e7', 2, 14);
      this.strokePath(track.map((p) => point(p.x, p.y + 8)), '#35bdff', 2, 14);
      this.ellipse(235, 168, 205, 42, '#23aadb66', 25, 20);
      const lightningAlpha = 0.35 + Math.sin(time * 1.6) ** 8 * 0.45;
      ctx.save();
      ctx.globalAlpha = lightningAlpha;
      for (const offset of [-145, 245]) {
        this.strokePath([point(offset, -300), point(offset - 18, -248), point(offset + 12, -245), point(offset - 25, -160), point(offset + 35, -220)], '#d4adff', 3, 24);
      }
      ctx.restore();
      const boatProgress = this.reducedMotion ? 0.88 : Math.min(phase * 1.75, 1);
      const boat = path(boatProgress);
      const next = path(Math.min(boatProgress + 0.01, 1));
      ctx.save();
      ctx.translate(boat.x, boat.y);
      ctx.rotate(Math.atan2(next.y - boat.y, next.x - boat.x));
      ctx.fillStyle = '#e2b083';
      ctx.shadowColor = '#51c9ff';
      ctx.shadowBlur = 16;
      roundedRect(ctx, -30, -15, 60, 20, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#523054';
      for (const x of [-19, -3, 13]) {
        roundedRect(ctx, x, -15, 10, 10, 2);
        ctx.fill();
      }
      ctx.restore();
      const splash = this.reducedMotion ? 0.48 : clamp((phase - 0.36) / 0.45, 0, 1);
      if (splash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.sin(splash * Math.PI) * 0.85;
        for (let index = 0; index < 13; index += 1) {
          const angle = Math.PI + index / 12 * Math.PI;
          const reach = 60 + splash * (105 + index % 3 * 25);
          const end = point(260 + Math.cos(angle) * reach, 155 + Math.sin(angle) * reach * 0.8);
          const control = point(mix(260, end.x, 0.5), end.y - 55);
          const curve = Array.from({ length: 12 }, (_, step) => cubic(point(260, 155), control, control, end, step / 11));
          this.strokePath(curve, index % 2 ? '#6bdfff' : '#36a9ff', 2 + index % 3, 8);
          this.ellipse(end.x, end.y, 3, 6, '#cdf5ff', 2, 5, angle);
        }
        this.ellipse(260, 159, 35 + splash * 150, 9 + splash * 32, '#8eefff', 2, 8);
        ctx.restore();
      }
    }

    drawNeon(time) {
      const ctx = this.ctx;
      const path = (progress) => {
        const angle = progress * TAU;
        return point(340 * Math.cos(angle), 150 * Math.sin(angle) - 70 * Math.sin(angle * 2));
      };
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (let index = 0; index < 7; index += 1) {
        const x = -330 + index * 110;
        this.strokePath([point(x, 115), point(x, 255)], '#555792', 2);
        this.strokePath([point(x - 50, 255), point(x + 50, 255)], '#555792', 1);
      }
      ctx.restore();
      this.drawTrack(path, '#ff65d4', '#62ddff');
      this.drawTrain(path, (time / 4 + 0.65) % 1, '#8cecff', 5);
      for (let index = 0; index < 16; index += 1) {
        const x = 440 - (time * 190 + index * 63) % 870;
        const y = -270 + index * 34;
        this.strokePath([point(x, y), point(x + 45, y)], index % 2 ? '#8ddbff4d' : '#ffa4df40', 1 + index % 2);
      }
      this.ellipse(0, 0, 430, 260, '#9e88ff24', 1, 0, -0.2);
    }

    drawStorm(time) {
      const ctx = this.ctx;
      for (let ribbon = 0; ribbon < 5; ribbon += 1) {
        const ribbonPoints = Array.from({ length: 110 }, (_, index) => {
          const amount = index / 109;
          const angle = amount * TAU * 1.2 + time * 0.65 + ribbon / 5 * TAU;
          const radius = 45 + amount * 280;
          return point(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.57 - amount * 35);
        });
        this.strokePath(ribbonPoints, ribbon % 2 ? '#ffb75688' : '#ffdf9880', 1.7 + ribbon % 2, 11);
      }
      this.strokePath([point(0, -120), point(-37, 180), point(37, 180), point(0, -120)], '#ce855d88', 4);
      this.ellipse(0, 180, 120, 28, '#ba705549', 3);
      for (let arm = 0; arm < 4; arm += 1) {
        const angle = time * 1.2 + arm / 4 * TAU;
        const destination = point(Math.cos(angle) * 205, Math.sin(angle) * 125 - 70);
        this.strokePath([point(0, -60), destination], '#ffc25d', 7, 10);
        ctx.save();
        ctx.translate(destination.x, destination.y);
        ctx.rotate(angle * 0.3);
        ctx.fillStyle = '#ff894f';
        ctx.shadowColor = '#ffc55d';
        ctx.shadowBlur = 18;
        roundedRect(ctx, -24, -11, 48, 24, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
        this.strokePath([point(-16, -7), point(16, -7)], '#ffe0a2', 3);
        ctx.restore();
      }
      this.ellipse(0, -60, 19, 19, '#fff0c3', 5, 18);
    }

    drawRock(time) {
      const ctx = this.ctx;
      this.strokePath([point(-290, 180), point(290, 180)], '#a63b6577', 10, 10);
      for (const side of [-1, 1]) {
        const x = side * 160;
        this.strokePath([point(x, 30), point(x - 75, 180), point(x + 75, 180), point(x, 30)], '#7b415e', 8);
        this.ellipse(x, -10, 103, 103, '#ff5f7945', 2, 10);
        this.ellipse(x, -10, 122, 122, '#ffb67438', 1);
        for (let index = 0; index < 3; index += 1) {
          const angle = side * time * 0.95 + index / 3 * TAU;
          const arm = point(x + Math.cos(angle) * 88, -10 + Math.sin(angle) * 88);
          this.strokePath([point(x, -10), arm], '#fa5477', 10, 13);
        }
        const angle = side * time * 0.95;
        const gondola = point(x + Math.cos(angle) * 88, -10 + Math.sin(angle) * 88);
        ctx.save();
        ctx.translate(gondola.x, gondola.y);
        ctx.rotate(-side * time * 1.65);
        ctx.fillStyle = '#f16982';
        ctx.shadowColor = '#ff7189';
        ctx.shadowBlur = 20;
        roundedRect(ctx, -64, -12, 128, 25, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffe3ca';
        for (let seat = 0; seat < 6; seat += 1) {
          roundedRect(ctx, -55 + seat * 20, -10, 12, 12, 3);
          ctx.fill();
        }
        ctx.restore();
        this.ellipse(x, -10, 17, 17, '#ffd3c4', 5, 18);
      }
      for (let index = 0; index < 16; index += 1) {
        const angle = index / 16 * TAU + time * 0.13;
        const radius = 220 + ((time * 80 + index * 19) % 100);
        this.strokePath([point(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.62), point(Math.cos(angle) * (radius + 14), Math.sin(angle) * (radius + 14) * 0.62)], '#ffbc8280', 1.5, 5);
      }
    }

    drawTwist(time) {
      const ctx = this.ctx;
      this.strokePath([point(-90, 215), point(0, -115), point(90, 215)], '#675299', 9);
      this.ellipse(0, 215, 145, 28, '#a581ee35', 3);
      for (const side of [-1, 1]) {
        const angle = side * (time * 0.7 + 0.35);
        ctx.save();
        ctx.translate(side * 115, -30);
        ctx.rotate(angle);
        this.ellipse(0, 0, 180, 74, side > 0 ? '#ff93d8' : '#b98dff', 4, 20);
        this.ellipse(0, 0, 155, 60, '#e9b7ff55', 1.5, 7);
        for (let index = 0; index < 4; index += 1) {
          const phase = time * 0.9 + index / 4 * TAU;
          const x = Math.cos(phase) * 180;
          const y = Math.sin(phase) * 74;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-angle + phase * 0.3);
          ctx.fillStyle = side > 0 ? '#ffb7e5' : '#d0b3ff';
          ctx.shadowColor = '#b591ff';
          ctx.shadowBlur = 16;
          roundedRect(ctx, -21, -12, 42, 24, 10);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#67509c';
          roundedRect(ctx, -13, -8, 26, 11, 5);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
      this.ellipse(0, -30, 23, 23, '#f8dcff', 4, 20);
      this.ellipse(0, -30, 325, 235, '#9a7bdb25', 1, 0, -0.2);
    }

    drawMagic(time) {
      const ctx = this.ctx;
      const swingAngle = Math.sin(time * TAU / 4) * 0.63;
      const pivot = point(0, -190);
      this.strokePath([point(-210, 220), pivot, point(210, 220)], '#b6a1ef9c', 7, 12);
      this.strokePath([point(-230, -195), point(230, -195)], '#f9b1df', 4, 13);
      const arc = Array.from({ length: 65 }, (_, index) => {
        const angle = mix(-0.82, 0.82, index / 64);
        return point(Math.sin(angle) * 278, -190 + Math.cos(angle) * 278);
      });
      this.strokePath(arc, '#ffb7e24d', 3, 18);
      this.strokePath(arc.map((p) => point(p.x * 1.1, -190 + (p.y + 190) * 1.1)), '#c79dff35', 1.5, 8);
      ctx.save();
      ctx.translate(pivot.x, pivot.y);
      ctx.rotate(swingAngle);
      this.strokePath([point(-24, 8), point(-65, 248)], '#ffe1f1', 2.5, 6);
      this.strokePath([point(24, 8), point(65, 248)], '#ffe1f1', 2.5, 6);
      ctx.fillStyle = '#b576cf';
      ctx.shadowColor = '#ffb7df';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.moveTo(-106, 244);
      ctx.bezierCurveTo(-65, 305, 65, 305, 106, 244);
      ctx.lineTo(75, 260);
      ctx.lineTo(-75, 260);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      this.strokePath([point(-96, 245), point(96, 245)], '#ffd5ec', 4, 8);
      ctx.fillStyle = '#ffe2f3';
      for (let seat = 0; seat < 6; seat += 1) {
        roundedRect(ctx, -72 + seat * 26, 249, 15, 13, 3);
        ctx.fill();
      }
      ctx.restore();
      this.ellipse(0, -190, 13, 13, '#fff0fa', 3, 15);
      for (let index = 0; index < 9; index += 1) {
        const angle = -0.9 + index / 8 * 1.8;
        const x = Math.sin(angle) * 328;
        const y = -190 + Math.cos(angle) * 328;
        const size = 3 + (Math.sin(time * 1.5 + index) + 1) * 2;
        this.strokePath([point(x - size, y), point(x + size, y)], '#ffd9f2', 1.5, 12);
        this.strokePath([point(x, y - size), point(x, y + size)], '#ffd9f2', 1.5, 12);
      }
    }

    drawParticles(time) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = this.palette.light;
      ctx.strokeStyle = this.palette.light;
      ctx.lineWidth = 1;
      for (const particle of this.particles) {
        const drift = this.reducedMotion ? 0 : time * particle.speed;
        const angle = particle.angle + drift * 0.035;
        const x = Math.cos(angle) * particle.radius + Math.sin(drift + particle.phase) * 9;
        const y = Math.sin(angle) * particle.radius * 0.75 - Math.sin(drift * 0.6 + particle.phase) * 12;
        ctx.globalAlpha = 0.15 + (Math.sin(drift * 1.2 + particle.phase) + 1) * 0.24;
        if (particle.star) {
          const size = particle.size * 2;
          ctx.beginPath();
          ctx.moveTo(x - size, y);
          ctx.lineTo(x + size, y);
          ctx.moveTo(x, y - size);
          ctx.lineTo(x, y + size);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, particle.size, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    drawReveal(time) {
      if (time > 1.45) return;
      const ctx = this.ctx;
      const progress = clamp(time / 1.45, 0, 1);
      const radius = 20 + (1 - (1 - progress) ** 3) * 430;
      ctx.save();
      ctx.globalAlpha = (1 - progress) * 0.8;
      ctx.globalCompositeOperation = 'screen';
      this.ellipse(0, 0, radius, radius * 0.68, this.palette.light, 2, 20);
      this.ellipse(0, 0, radius * 0.86, radius * 0.58, this.palette.main, 1, 10);
      for (let index = 0; index < 18; index += 1) {
        const angle = index / 18 * TAU;
        const inner = radius * 0.65;
        this.strokePath([point(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.68), point(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.68)], this.palette.light, 1.5, 12);
      }
      ctx.restore();
    }
  }

  window.RideEffects = RideEffects;
})();
