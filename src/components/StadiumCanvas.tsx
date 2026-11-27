import React, { useEffect, useRef } from 'react';
import {
  clampSpinDegree,
  DEFAULT_SPIN_DEGREE,
  getDeliveryAnimDurationSec,
} from '../game/cricketEngine';
import { getWeatherBallPhysics, getWeatherPitchPalette } from '../game/dls';
import {
  BattingHand,
  BowlingSide,
  DeliveryLength,
  DeliveryResolution,
  DeliveryType,
  MatchFormat,
  PitchCondition,
  Team,
  WeatherCondition,
} from '../game/types';

export interface BallAnimTrigger {
  id: number;
  deliveryType: DeliveryType;
  deliveryLength: DeliveryLength;
  paceSpeedKph?: number;
  spinDegree?: number;
  resolution: DeliveryResolution;
}

interface StadiumCanvasProps {
  isPlaying: boolean;
  isPaused: boolean;
  format?: MatchFormat;
  pitchCondition?: PitchCondition;
  weatherCondition?: WeatherCondition;
  isRainDelay?: boolean;
  strikerHand?: BattingHand;
  bowlingSide?: BowlingSide;
  battingTeam: Team;
  bowlingTeam: Team;
  animTrigger: BallAnimTrigger | null;
  onAnimationComplete?: () => void;
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

interface CrowdDot {
  angle: number;
  ring: number;
  color: string;
  phase: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const FIELDER_ANGLES = [
  -2.65,
  -1.85,
  -1.05,
  -0.38,
  0.38,
  1.05,
  1.78,
  2.48,
  0.0,
];

const FIELDER_RADII = [0.64, 0.56, 0.68, 0.44, 0.44, 0.66, 0.54, 0.66, 0.80];

function measureHudInsets(width: number, height: number) {
  const isShortLandscape = height <= 520 && width > height;
  const isPortrait = height > width;
  const isMobile = width < 640 && !isShortLandscape;
  let headerBottom = isShortLandscape ? 42 : isMobile ? 74 : 62;
  let footerTop = height - (isShortLandscape ? 160 : isMobile ? 280 : 230);

  if (typeof document !== 'undefined') {
    const hdr = document.querySelector('header');
    const ftr = document.querySelector('footer');
    if (hdr) {
      const r = hdr.getBoundingClientRect();
      if (r.height > 0) headerBottom = r.bottom;
    }
    if (ftr) {
      const r = ftr.getBoundingClientRect();
      if (r.height > 0) footerTop = r.top;
    }
  }

  const topPad = isShortLandscape ? 24 : 36;
  const bottomPad = isShortLandscape ? 26 : isPortrait && width < 768 ? 64 : 36;
  return {
    isShortLandscape,
    isPortrait,
    isMobile,
    headerBottom,
    footerTop,
    topSafe: headerBottom + topPad,
    bottomSafe: Math.max(0, height - footerTop) + bottomPad,
  };
}

function computeFieldGeometry(width: number, height: number) {
  const { isShortLandscape, isPortrait, isMobile, topSafe, bottomSafe } = measureHudInsets(
    width,
    height
  );
  const availH = Math.max(isShortLandscape ? 115 : 180, height - topSafe - bottomSafe);
  const cx = width * 0.5;
  const cy = topSafe + availH * 0.5;
  const rx = isShortLandscape
    ? Math.min(width * 0.42, availH * 1.48)
    : isPortrait
    ? Math.min(width * 0.45, availH * 0.78)
    : Math.min(width * 0.43, availH * 0.88);
  const ry = isShortLandscape
    ? Math.min(availH * 0.44, rx * 0.52)
    : isPortrait
    ? Math.min(availH * 0.45, rx * (isMobile ? 0.92 : 0.84))
    : Math.min(availH * 0.45, rx * 0.56);
  const pitchW = Math.max(isShortLandscape ? 18 : 22, rx * 0.13);
  const pitchH = isShortLandscape ? Math.max(72, ry * 0.92) : Math.max(116, ry * 0.92);
  return { isShortLandscape, cx, cy, rx, ry, pitchW, pitchH };
}

export const StadiumCanvas: React.FC<StadiumCanvasProps> = ({
  isPlaying,
  isPaused,
  format = 'limited',
  pitchCondition = 'hard',
  weatherCondition = 'clear',
  isRainDelay = false,
  strikerHand = 'right',
  bowlingSide = 'over',
  battingTeam,
  bowlingTeam,
  animTrigger,
  onAnimationComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({
    isPlaying,
    isPaused,
    format,
    pitchCondition,
    weatherCondition,
    isRainDelay,
    strikerHand,
    bowlingSide,
    battingTeam,
    bowlingTeam,
    onAnimationComplete,
  });
  propsRef.current = {
    isPlaying,
    isPaused,
    format,
    pitchCondition,
    weatherCondition,
    isRainDelay,
    strikerHand,
    bowlingSide,
    battingTeam,
    bowlingTeam,
    onAnimationComplete,
  };

  const animStateRef = useRef<{
    active: boolean;
    trigger: BallAnimTrigger | null;
    elapsed: number;
    duration: number;
    notified: boolean;
    trauma: number;
    crowdExcitement: number;
  }>({
    active: false,
    trigger: null,
    elapsed: 0,
    duration: 1.55,
    notified: false,
    trauma: 0,
    crowdExcitement: 0,
  });

  const bgDirtyRef = useRef(true);
  const scheduleFrameRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    bgDirtyRef.current = true;
    scheduleFrameRef.current?.();
  }, [isPlaying, pitchCondition, weatherCondition, isRainDelay]);

  useEffect(() => {
    scheduleFrameRef.current?.();
  }, [isPaused, strikerHand, bowlingSide, battingTeam, bowlingTeam]);

  const particlesRef = useRef<Particle[]>(
    Array.from({ length: 36 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.4,
      color: '#facc15',
      size: 3,
    }))
  );
  const particleCursorRef = useRef(0);

  useEffect(() => {
    if (!animTrigger) return;
    animStateRef.current = {
      active: true,
      trigger: animTrigger,
      elapsed: 0,
      duration: getDeliveryAnimDurationSec(
        animTrigger.deliveryType,
        animTrigger.paceSpeedKph,
        propsRef.current.weatherCondition,
        propsRef.current.isRainDelay
      ),
      notified: false,
      trauma: 0,
      crowdExcitement: 0,
    };
    scheduleFrameRef.current?.();
  }, [animTrigger]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bgCanvas = document.createElement('canvas');
    const bgCtx = bgCanvas.getContext('2d');

    const stars: Star[] = Array.from({ length: 85 }, (_, i) => ({
      x: ((i * 197.3) % 1000) / 1000,
      y: ((i * 313.7) % 1000) / 1000,
      r: i % 3 === 0 ? 1.6 : 1.0,
      phase: i * 0.7,
      speed: 1.1 + (i % 5) * 0.35,
    }));

    const crowdPalette = ['#facc15', '#38bdf8', '#f87171', '#4ade80', '#f472b6', '#ffffff'];
    const crowd: CrowdDot[] = Array.from({ length: 120 }, (_, i) => ({
      angle: (i / 120) * Math.PI * 2,
      ring: i % 2 === 0 ? 1.03 : 1.07,
      color: crowdPalette[i % crowdPalette.length],
      phase: i * 0.53,
    }));

    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const buildStaticBackdrop = (playing: boolean) => {
      if (!bgCtx) return;
      bgCanvas.width = Math.max(1, Math.floor(width * dpr));
      bgCanvas.height = Math.max(1, Math.floor(height * dpr));
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Night Sky + Emerald Horizon (adjusted for weather atmosphere)
      const weatherMode = propsRef.current.weatherCondition;
      const rainDelay = propsRef.current.isRainDelay;
      const isGloomy = weatherMode === 'overcast' || weatherMode === 'drizzle' || rainDelay;
      const bgGrad = bgCtx.createRadialGradient(
        width * 0.5,
        height * 0.25,
        40,
        width * 0.5,
        height * 0.55,
        Math.max(width, height) * 0.78
      );
      bgGrad.addColorStop(0, isGloomy ? '#0f172a' : '#0a1c3d');
      bgGrad.addColorStop(0.5, isGloomy ? '#0a1324' : '#061529');
      bgGrad.addColorStop(0.85, isGloomy ? '#0a1f1b' : '#07241a');
      bgGrad.addColorStop(1, isGloomy ? '#0a2b18' : '#093418');
      bgCtx.fillStyle = bgGrad;
      bgCtx.fillRect(0, 0, width, height);

      if (!playing) return;

      const { cx, cy, rx, ry, pitchW, pitchH } = computeFieldGeometry(width, height);

      // Floodlights
      const towers = [
        { x: cx - rx * 0.9, y: cy - ry * 0.85 },
        { x: cx + rx * 0.9, y: cy - ry * 0.85 },
        { x: cx - rx * 1.02, y: cy + ry * 0.15 },
        { x: cx + rx * 1.02, y: cy + ry * 0.15 },
      ];
      towers.forEach((tw) => {
        bgCtx.strokeStyle = 'rgba(203, 213, 225, 0.65)';
        bgCtx.lineWidth = 3;
        bgCtx.beginPath();
        bgCtx.moveTo(tw.x, tw.y + 42);
        bgCtx.lineTo(tw.x, tw.y);
        bgCtx.stroke();

        const glow = bgCtx.createRadialGradient(tw.x, tw.y, 2, tw.x, tw.y, 44);
        glow.addColorStop(0, 'rgba(254, 249, 195, 0.95)');
        glow.addColorStop(0.3, 'rgba(253, 224, 71, 0.28)');
        glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
        bgCtx.fillStyle = glow;
        bgCtx.beginPath();
        bgCtx.arc(tw.x, tw.y, 44, 0, Math.PI * 2);
        bgCtx.fill();

        bgCtx.fillStyle = '#fef9c3';
        bgCtx.beginPath();
        bgCtx.arc(tw.x, tw.y, 5, 0, Math.PI * 2);
        bgCtx.fill();
      });

      const pitchMode = propsRef.current.pitchCondition;
      const pitchPalette = getWeatherPitchPalette(pitchMode, weatherMode, rainDelay);

      // Concentric emerald turf rings (darkened in overcast / damp rain conditions)
      for (let r = 6; r >= 1; r--) {
        const frac = r / 6;
        bgCtx.fillStyle =
          r % 2 === 0 ? pitchPalette.outfieldEvenColor : pitchPalette.outfieldOddColor;
        bgCtx.beginPath();
        bgCtx.ellipse(cx, cy, rx * frac, ry * frac, 0, 0, Math.PI * 2);
        bgCtx.fill();
      }

      // Wet outfield rain puddles in drizzle / rain delay
      if (pitchPalette.puddleOpacity > 0) {
        const puddles = [
          { dx: -0.42, dy: -0.28, prx: 24, pry: 11 },
          { dx: 0.46, dy: 0.22, prx: 28, pry: 12 },
          { dx: -0.34, dy: 0.44, prx: 20, pry: 9 },
          { dx: 0.3, dy: -0.45, prx: 22, pry: 10 },
        ];
        bgCtx.fillStyle = `rgba(147, 197, 253, ${pitchPalette.puddleOpacity.toFixed(2)})`;
        puddles.forEach((pd) => {
          bgCtx.beginPath();
          bgCtx.ellipse(cx + rx * pd.dx, cy + ry * pd.dy, pd.prx, pd.pry, 0.2, 0, Math.PI * 2);
          bgCtx.fill();
        });
      }

      // Boundary rope
      bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
      bgCtx.lineWidth = 2;
      bgCtx.beginPath();
      bgCtx.ellipse(cx, cy, rx * 0.96, ry * 0.96, 0, 0, Math.PI * 2);
      bgCtx.stroke();

      // 30-yard circle
      bgCtx.save();
      bgCtx.setLineDash([6, 6]);
      bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
      bgCtx.lineWidth = 1.4;
      bgCtx.beginPath();
      bgCtx.ellipse(cx, cy, rx * 0.56, ry * 0.56, 0, 0, Math.PI * 2);
      bgCtx.stroke();
      bgCtx.restore();

      // Central Pitch colored & textured dynamically by pitchCondition + weatherCondition
      const pitchX = cx - pitchW / 2;
      const pitchY = cy - pitchH / 2;

      bgCtx.fillStyle = pitchPalette.baseColor;
      bgCtx.fillRect(pitchX, pitchY, pitchW, pitchH);

      bgCtx.fillStyle = pitchPalette.accentColor;
      if (pitchMode === 'dry') {
        bgCtx.fillRect(pitchX + 3, pitchY + pitchH * 0.62, pitchW * 0.35, 16);
        bgCtx.fillRect(pitchX + pitchW * 0.55, pitchY + pitchH * 0.28, pitchW * 0.35, 14);
      } else {
        bgCtx.fillRect(pitchX + 3, pitchY + 10, pitchW - 6, pitchH - 20);
      }

      if (pitchPalette.moistureSheenColor) {
        const sheenGrad = bgCtx.createLinearGradient(pitchX, pitchY, pitchX, pitchY + pitchH);
        sheenGrad.addColorStop(0, pitchPalette.moistureSheenColor);
        sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
        sheenGrad.addColorStop(1, pitchPalette.moistureSheenColor);
        bgCtx.fillStyle = sheenGrad;
        bgCtx.fillRect(pitchX, pitchY, pitchW, pitchH);
      }

      if (pitchPalette.puddleOpacity > 0) {
        bgCtx.fillStyle = `rgba(147, 197, 253, ${(pitchPalette.puddleOpacity * 0.6).toFixed(2)})`;
        bgCtx.beginPath();
        bgCtx.ellipse(cx, pitchY + pitchH * 0.38, pitchW * 0.32, 6, 0, 0, Math.PI * 2);
        bgCtx.fill();
        bgCtx.beginPath();
        bgCtx.ellipse(cx, pitchY + pitchH * 0.66, pitchW * 0.28, 5, 0, 0, Math.PI * 2);
        bgCtx.fill();
      }

      const topCreaseY = pitchY + pitchH * 0.14;
      const botCreaseY = pitchY + pitchH * 0.86;

      bgCtx.strokeStyle = '#f8fafc';
      bgCtx.lineWidth = 2;
      bgCtx.beginPath();
      bgCtx.moveTo(pitchX - 10, topCreaseY);
      bgCtx.lineTo(pitchX + pitchW + 10, topCreaseY);
      bgCtx.moveTo(pitchX - 10, botCreaseY);
      bgCtx.lineTo(pitchX + pitchW + 10, botCreaseY);
      bgCtx.stroke();

      bgCtx.save();
      bgCtx.setLineDash([4, 4]);
      bgCtx.strokeStyle = 'rgba(255,255,255,0.65)';
      bgCtx.beginPath();
      bgCtx.moveTo(pitchX - 8, topCreaseY - 9);
      bgCtx.lineTo(pitchX + pitchW + 8, topCreaseY - 9);
      bgCtx.moveTo(pitchX - 8, botCreaseY + 9);
      bgCtx.lineTo(pitchX + pitchW + 8, botCreaseY + 9);
      bgCtx.stroke();
      bgCtx.restore();
    };

    let lastInsetKey = '';
    const updateSize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bgDirtyRef.current = true;
      scheduleFrameRef.current?.();
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);

    const spawnBurst = (x: number, y: number, color: string, count: number) => {
      const pool = particlesRef.current;
      for (let i = 0; i < count; i++) {
        const idx = particleCursorRef.current % pool.length;
        particleCursorRef.current += 1;
        const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.2;
        const speed = 70 + ((i * 37) % 120);
        pool[idx].active = true;
        pool[idx].x = x;
        pool[idx].y = y;
        pool[idx].vx = Math.cos(angle) * speed;
        pool[idx].vy = Math.sin(angle) * speed;
        pool[idx].life = 0;
        pool[idx].maxLife = 0.35 + (i % 4) * 0.08;
        pool[idx].color = color;
        pool[idx].size = 2.5 + (i % 3);
      }
    };

    let lastTime = performance.now();
    let totalTime = 0;
    let impactSpawnedForId = -1;
    let catchSpawnedForId = -1;
    let rafId = 0;
    let timerId = 0;
    let rafPending = false;
    let drewPausedFrame = false;

    const scheduleImmediate = () => {
      if (timerId) {
        window.clearTimeout(timerId);
        timerId = 0;
      }
      if (!rafPending) {
        rafPending = true;
        rafId = requestAnimationFrame(render);
      }
    };

    scheduleFrameRef.current = () => {
      drewPausedFrame = false;
      scheduleImmediate();
    };

    const scheduleTail = () => {
      const {
        isPlaying: playingNow,
        isPaused: pausedNow,
        weatherCondition: weatherNow,
        isRainDelay: rainNow,
      } = propsRef.current;
      const animNow = animStateRef.current;
      const hasBurst =
        !pausedNow &&
        (animNow.active ||
          animNow.trauma > 0 ||
          animNow.crowdExcitement > 0 ||
          particlesRef.current.some((p) => p.active));

      if (pausedNow && !hasBurst && !bgDirtyRef.current) {
        return;
      }
      if (hasBurst) {
        scheduleImmediate();
        return;
      }
      if (!timerId && !rafPending) {
        const delay = !playingNow
          ? 240
          : weatherNow === 'drizzle' || weatherNow === 'windy' || rainNow
          ? 70
          : 180;
        timerId = window.setTimeout(() => {
          timerId = 0;
          scheduleImmediate();
        }, delay);
      }
    };

    const render = (now: number) => {
      rafPending = false;

      const {
        isPlaying: playing,
        isPaused: paused,
        format: matchFormat,
        pitchCondition: pitchMode,
        weatherCondition: weatherMode,
        isRainDelay: rainDelayActive,
        battingTeam: batTeam,
        bowlingTeam: bowlTeam,
        onAnimationComplete: onComplete,
      } = propsRef.current;
      const isTestKit = matchFormat === 'test';
      const bowlJersey = isTestKit ? '#f8fafc' : bowlTeam.primaryColor;
      const batJersey = isTestKit ? '#f8fafc' : batTeam.primaryColor;

      const anim = animStateRef.current;
      const hasActiveMotion =
        !paused &&
        (anim.active ||
          anim.trauma > 0 ||
          anim.crowdExcitement > 0 ||
          weatherMode === 'drizzle' ||
          weatherMode === 'windy' ||
          rainDelayActive ||
          particlesRef.current.some((p) => p.active));

      if (paused && !hasActiveMotion && !bgDirtyRef.current && drewPausedFrame) {
        return;
      }

      drewPausedFrame = paused && !hasActiveMotion;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      if (!paused) {
        totalTime += dt;
      }

      if (playing) {
        const { headerBottom, footerTop } = measureHudInsets(width, height);
        const insetKey = `${Math.round(headerBottom)}:${Math.round(footerTop)}`;
        if (insetKey !== lastInsetKey) {
          lastInsetKey = insetKey;
          bgDirtyRef.current = true;
        }
      }

      if (bgDirtyRef.current) {
        buildStaticBackdrop(playing);
        bgDirtyRef.current = false;
      }

      // Draw cached static stadium / sky
      ctx.drawImage(bgCanvas, 0, 0, width, height);

      // Twinkling stars (dimmed under overcast / drizzle clouds)
      const starDim = weatherMode === 'drizzle' ? 0.2 : weatherMode === 'overcast' ? 0.35 : 1;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const alpha = (0.35 + 0.55 * Math.abs(Math.sin(totalTime * s.speed + s.phase))) * starDim;
        ctx.fillStyle = `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
        ctx.fillRect(s.x * width, s.y * height * 0.72, s.r * 1.4, s.r * 1.4);
      }

      if (!playing) {
        scheduleTail();
        return;
      }

      let shakeX = 0;
      let shakeY = 0;

      if (anim.active && !paused && anim.trigger) {
        anim.elapsed += dt;
        const tNorm = Math.min(1, anim.elapsed / anim.duration);

        if (tNorm >= 0.45 && impactSpawnedForId !== anim.trigger.id) {
          impactSpawnedForId = anim.trigger.id;
          const res = anim.trigger.resolution;
          if (res.isWicket) {
            anim.trauma = 0.65;
            anim.crowdExcitement = 1.0;
          } else if (res.isBoundarySix) {
            anim.trauma = 0.55;
            anim.crowdExcitement = 1.0;
          } else if (res.isBoundaryFour) {
            anim.trauma = 0.35;
            anim.crowdExcitement = 0.8;
          } else if (res.runs > 0) {
            anim.trauma = 0.12;
            anim.crowdExcitement = 0.3;
          }
        }

        if (tNorm >= 1 && !anim.notified) {
          anim.notified = true;
          anim.active = false;
          onComplete?.();
        }
      }

      if (anim.trauma > 0) {
        anim.trauma = Math.max(0, anim.trauma - dt * 1.9);
        const mag = anim.trauma * anim.trauma * 10;
        shakeX = Math.sin(totalTime * 68) * mag;
        shakeY = Math.cos(totalTime * 59) * mag;
      }
      if (anim.crowdExcitement > 0) {
        anim.crowdExcitement = Math.max(0, anim.crowdExcitement - dt * 0.7);
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      const { isShortLandscape, cx, cy, rx, ry, pitchH } = computeFieldGeometry(width, height);

      // Animated Stadium Crowd Dots
      const exciteBoost = 1 + anim.crowdExcitement * 3.5;
      ctx.globalAlpha = 0.72;
      for (let i = 0; i < crowd.length; i++) {
        const c = crowd[i];
        const bob = Math.sin(totalTime * 2.8 * exciteBoost + c.phase) * (1.2 + anim.crowdExcitement * 3.2);
        const px = cx + Math.cos(c.angle) * (rx * c.ring);
        const py = cy + Math.sin(c.angle) * (ry * c.ring) + bob;
        ctx.fillStyle = c.color;
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      const pitchY = cy - pitchH / 2;
      const topCreaseY = pitchY + pitchH * 0.14;
      const botCreaseY = pitchY + pitchH * 0.86;

      const drawStumps = (sx: number, sy: number, shattered: boolean) => {
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 2.6;
        [-5, 0, 5].forEach((dx, idx) => {
          ctx.save();
          ctx.translate(sx + dx, sy);
          if (shattered) {
            ctx.rotate((idx - 1) * 0.55);
            ctx.translate((idx - 1) * 4, idx === 1 ? -4 : 3);
          }
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -14);
          ctx.stroke();
          ctx.restore();
        });
        if (!shattered) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(sx - 6, sy - 15, 12, 2.5);
        }
      };

      const tNorm = anim.active && anim.trigger ? Math.min(1, anim.elapsed / anim.duration) : 0;
      const wicketKindNow = anim.trigger?.resolution.wicketKind;
      const isCaughtWicket = Boolean(
        anim.active && anim.trigger?.resolution.isWicket && wicketKindNow === 'Caught'
      );
      const isStumpShatteringWicket = Boolean(
        anim.active &&
          anim.trigger?.resolution.isWicket &&
          (wicketKindNow === 'Bowled' || wicketKindNow === 'Stumped')
      );
      const isWicketShattered = Boolean(isStumpShatteringWicket && tNorm >= 0.45);

      drawStumps(cx, topCreaseY, false);
      drawStumps(cx, botCreaseY + 12, isWicketShattered);

      let bowlerYOffset = -28;
      if (anim.active) {
        if (tNorm < 0.2) {
          bowlerYOffset = -28 + (tNorm / 0.2) * 26;
        } else if (tNorm < 0.35) {
          bowlerYOffset = -2 + ((tNorm - 0.2) / 0.15) * 6;
        } else {
          bowlerYOffset = 4;
        }
      }

      // Bowler side (Over vs Around the Wicket, respecting LHB/RHB)
      const isLeftHanded = propsRef.current.strikerHand === 'left';
      const isAroundWicket = propsRef.current.bowlingSide === 'round';
      const bowlerOnRight = isLeftHanded ? !isAroundWicket : isAroundWicket;
      const bowlerX = bowlerOnRight ? cx + 14 : cx - 14;
      const bowlerY = topCreaseY + bowlerYOffset;
      const ballReleaseX = bowlerOnRight ? bowlerX - 6 : bowlerX + 6;
      ctx.fillStyle = bowlJersey;
      ctx.beginPath();
      ctx.roundRect(bowlerX - 6, bowlerY - 8, 12, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(bowlerX, bowlerY - 12, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isTestKit ? bowlTeam.primaryColor : bowlTeam.secondaryColor;
      ctx.beginPath();
      ctx.arc(bowlerX, bowlerY - 14, 5.5, Math.PI, 0);
      ctx.fill();

      // Wicketkeeper
      const wkX = cx;
      const wkY = botCreaseY + (isShortLandscape ? 18 : 34);
      ctx.fillStyle = bowlJersey;
      ctx.beginPath();
      ctx.arc(wkX, wkY, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(wkX, wkY - 7, 4.5, 0, Math.PI * 2);
      ctx.fill();

      let ballX = ballReleaseX;
      let ballY = bowlerY - 4;
      let ballShadowX = ballX + 2;
      let ballShadowY = ballY + 5;
      let ballRadius = 4.2;
      const ballVisible = anim.active;

      const batContactX = isLeftHanded ? cx - 6 : cx + 6;
      const batContactY = botCreaseY - 4;

      // Resolve catcher target cleanly when wicketKind === 'Caught'
      let caughtFielderIdx = -1;
      let catchTargetX = cx;
      let catchTargetY = cy;
      if (anim.active && anim.trigger && isCaughtWicket) {
        const resAngle = -Math.PI / 2 + anim.trigger.resolution.hitAngleRad;
        const hitDx = Math.cos(resAngle);
        const hitDy = Math.sin(resAngle);
        let bestDot = -Infinity;
        FIELDER_ANGLES.forEach((ang, idx) => {
          const fAng = ang - Math.PI / 2;
          const dot = hitDx * Math.cos(fAng) + hitDy * Math.sin(fAng);
          if (dot > bestDot) {
            bestDot = dot;
            caughtFielderIdx = idx;
          }
        });
        const fAng = FIELDER_ANGLES[caughtFielderIdx] - Math.PI / 2;
        const homeDistFrac = FIELDER_RADII[caughtFielderIdx];
        const homeFx = cx + Math.cos(fAng) * rx * homeDistFrac;
        const homeFy = cy + Math.sin(fAng) * ry * homeDistFrac;
        const interceptDistFrac = Math.max(0.36, homeDistFrac * 0.84);
        const lineX = batContactX + hitDx * rx * interceptDistFrac;
        const lineY = batContactY + hitDy * ry * interceptDistFrac;
        catchTargetX = homeFx * 0.34 + lineX * 0.66;
        catchTargetY = homeFy * 0.34 + lineY * 0.66;
      }

      if (anim.active && anim.trigger) {
        const { deliveryType, deliveryLength, resolution } = anim.trigger;
        const weatherPhysics = getWeatherBallPhysics(weatherMode, rainDelayActive);

        if (tNorm < 0.2) {
          ballX = ballReleaseX;
          ballY = bowlerY - 4;
          ballShadowX = ballX + 2;
          ballShadowY = ballY + 5;
        } else if (tNorm < 0.45) {
          const f = (tNorm - 0.2) / 0.25;
          const dryTurnBoost = pitchMode === 'dry' ? 1.55 : pitchMode === 'hard' ? 0.78 : 1.0;
          const spinDegVal = clampSpinDegree(anim.trigger.spinDegree ?? DEFAULT_SPIN_DEGREE);
          const spinTurnScale = 0.42 + (spinDegVal / 12) * 1.18;
          const greenSeamBoost = pitchMode === 'green' ? 1.48 : 1.0;
          const weatherSwingScale = weatherPhysics.swingMultiplier;
          let lateralCurve = 0;

          if (deliveryType === 'swing') {
            lateralCurve = Math.sin(f * Math.PI) * 19 * greenSeamBoost * weatherSwingScale;
          } else if (deliveryType === 'seam') {
            lateralCurve = f > 0.52 ? -12 * greenSeamBoost * weatherSwingScale : 0;
          } else if (deliveryType === 'fast' || deliveryType === 'yorker' || deliveryType === 'bouncer') {
            lateralCurve = Math.sin(f * Math.PI) * 8 * (weatherSwingScale - 1);
          } else if (deliveryType === 'spin' || deliveryType === 'off_spin') {
            lateralCurve = f > 0.56 ? (f - 0.56) * 34 * dryTurnBoost * spinTurnScale : 0;
          } else if (deliveryType === 'leg_spin') {
            lateralCurve = f > 0.56 ? -(f - 0.56) * 36 * dryTurnBoost * spinTurnScale : 0;
          } else if (deliveryType === 'googly') {
            lateralCurve =
              f > 0.6 ? (f - 0.6) * 44 * dryTurnBoost * spinTurnScale : -Math.sin(f * Math.PI) * 5;
          } else if (deliveryType === 'doosra') {
            lateralCurve =
              f > 0.6 ? -(f - 0.6) * 40 * dryTurnBoost * spinTurnScale : Math.sin(f * Math.PI) * 5;
          } else if (deliveryType === 'arm_ball') {
            lateralCurve = Math.sin(f * Math.PI) * (3 + spinDegVal * 0.45);
          } else if (deliveryType === 'carrom') {
            lateralCurve =
              f > 0.58 ? -(f - 0.58) * 35 * dryTurnBoost * spinTurnScale : Math.sin(f * Math.PI) * 6;
          }

          ballX = ballReleaseX + (batContactX - ballReleaseX) * f + lateralCurve;
          ballY = bowlerY - 4 + (batContactY - (bowlerY - 4)) * f;
          const bouncePoint =
            deliveryLength === 'full' ? 0.78 : deliveryLength === 'short' ? 0.35 : 0.58;
          const arcScale = Math.abs(Math.sin(((f - bouncePoint) / (1 - bouncePoint)) * Math.PI));
          const bounceBoost =
            (pitchMode === 'hard' ? 1.4 : pitchMode === 'dry' ? 0.85 : 1.0) *
            weatherPhysics.bounceMultiplier;
          ballRadius = 4.2 + arcScale * 1.4 * bounceBoost;
          ballShadowX = ballX + 2;
          ballShadowY = ballY + 4 + arcScale * 2 * weatherPhysics.bounceMultiplier;
        } else {
          const f = (tNorm - 0.45) / 0.55;
          const eased = 1 - Math.pow(1 - f, 2.2);
          if (isCaughtWicket) {
            if (f < 0.65) {
              const cf = f / 0.65;
              const flightEase = 1 - Math.pow(1 - cf, 1.35);
              const gx = batContactX + (catchTargetX - batContactX) * flightEase;
              const gy = batContactY + (catchTargetY - batContactY) * flightEase;
              const loftHeight = Math.sin(cf * Math.PI) * 34;
              ballShadowX = gx + 2;
              ballShadowY = gy + 4;
              ballX = gx;
              ballY = gy - loftHeight;
              ballRadius = 4.2 + Math.sin(cf * Math.PI) * 3.8;
            } else {
              ballX = catchTargetX;
              ballY = catchTargetY - 9;
              ballShadowX = catchTargetX + 1;
              ballShadowY = catchTargetY + 3;
              ballRadius = 4.2;
              if (catchSpawnedForId !== anim.trigger.id) {
                catchSpawnedForId = anim.trigger.id;
                spawnBurst(catchTargetX, catchTargetY - 8, '#38bdf8', 18);
                spawnBurst(catchTargetX, catchTargetY - 8, '#facc15', 10);
                anim.crowdExcitement = 1.0;
                anim.trauma = Math.max(anim.trauma, 0.35);
              }
            }
          } else if (resolution.isWicket) {
            ballX = batContactX - eased * 6;
            ballY = botCreaseY + eased * 18;
            ballShadowX = ballX + 2;
            ballShadowY = ballY + 5;
          } else {
            const canvasAngle = -Math.PI / 2 + resolution.hitAngleRad;
            const wetSlowFactor =
              resolution.isBoundarySix || resolution.isBoundaryFour
                ? 1
                : rainDelayActive
                ? 0.78
                : weatherMode === 'drizzle'
                ? 0.86
                : 1.0;
            const maxDistX = rx * 0.95 * resolution.hitDistanceFactor * wetSlowFactor;
            const maxDistY = ry * 0.95 * resolution.hitDistanceFactor * wetSlowFactor;
            ballX = batContactX + Math.cos(canvasAngle) * maxDistX * eased;
            ballY = batContactY + Math.sin(canvasAngle) * maxDistY * eased;
            ballShadowX = ballX + 2;
            ballShadowY = ballY + (resolution.isBoundarySix ? 6 + Math.sin(f * Math.PI) * 14 : 5);
            if (resolution.isBoundarySix) {
              ballRadius = 4.2 + Math.sin(f * Math.PI) * 4.2;
            }
          }

          if (tNorm < 0.5 && particlesRef.current.every((p) => !p.active)) {
            const burstColor = isCaughtWicket
              ? '#fbbf24'
              : resolution.isWicket
              ? '#ef4444'
              : resolution.isBoundarySix
              ? '#facc15'
              : resolution.isBoundaryFour
              ? '#38bdf8'
              : '#f8fafc';
            spawnBurst(
              batContactX,
              batContactY,
              burstColor,
              resolution.isBoundarySix || resolution.isWicket ? 18 : 10
            );
          }
        }
      }

      // Outfielders
      let nearestIdx = -1;
      let nearestDist = Infinity;
      if (anim.active && anim.trigger && tNorm > 0.48 && !anim.trigger.resolution.isWicket) {
        FIELDER_ANGLES.forEach((ang, idx) => {
          const fx = cx + Math.cos(ang - Math.PI / 2) * rx * FIELDER_RADII[idx];
          const fy = cy + Math.sin(ang - Math.PI / 2) * ry * FIELDER_RADII[idx];
          const d = Math.hypot(ballX - fx, ballY - fy);
          if (d < nearestDist) {
            nearestDist = d;
            nearestIdx = idx;
          }
        });
      }

      FIELDER_ANGLES.forEach((ang, idx) => {
        const homeFx = cx + Math.cos(ang - Math.PI / 2) * rx * FIELDER_RADII[idx];
        const homeFy = cy + Math.sin(ang - Math.PI / 2) * ry * FIELDER_RADII[idx];
        let fx = homeFx;
        let fy = homeFy;
        const isCatcher = isCaughtWicket && idx === caughtFielderIdx && anim.active && tNorm >= 0.45;
        let isCatchComplete = false;

        if (isCatcher) {
          const f = (tNorm - 0.45) / 0.55;
          const runProg = Math.min(1, f / 0.65);
          const easedRun = 1 - Math.pow(1 - runProg, 1.5);
          fx = homeFx + (catchTargetX - homeFx) * easedRun;
          fy = homeFy + (catchTargetY - homeFy) * easedRun;
          isCatchComplete = f >= 0.65;

          if (!isCatchComplete) {
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
            ctx.lineWidth = 1.6;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(homeFx, homeFy);
            ctx.lineTo(fx, fy);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else if (idx === nearestIdx && anim.active && tNorm > 0.48) {
          const chaseFrac = Math.min(0.65, (tNorm - 0.48) * 1.3);
          fx = homeFx + (ballX - homeFx) * chaseFrac;
          fy = homeFy + (ballY - homeFy) * chaseFrac;
        }

        if (isCatchComplete) {
          const pulse = 13 + Math.sin(totalTime * 16) * 2.5;
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(fx, fy - 2, pulse, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = bowlJersey;
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.moveTo(fx - 4, fy - 2);
          ctx.lineTo(fx - 7, fy - 12);
          ctx.moveTo(fx + 4, fy - 2);
          ctx.lineTo(fx + 7, fy - 12);
          ctx.stroke();
        }

        ctx.fillStyle = bowlJersey;
        ctx.beginPath();
        ctx.arc(fx, fy, isCatcher ? 7.6 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isCatchComplete
          ? '#facc15'
          : isTestKit
          ? bowlTeam.primaryColor
          : 'rgba(255,255,255,0.65)';
        ctx.lineWidth = isCatchComplete ? 2 : 1.4;
        ctx.stroke();
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(fx, fy - 7, 4.5, 0, Math.PI * 2);
        ctx.fill();

        if (isCatchComplete) {
          const badgeX = Math.max(40, Math.min(width - 40, fx));
          const badgeY = Math.max(24, fy - 28);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.beginPath();
          ctx.roundRect(badgeX - 30, badgeY - 10, 60, 18, 6);
          ctx.fill();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.fillStyle = '#fde047';
          ctx.font = '800 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('CAUGHT!', badgeX, badgeY - 0.5);
        }
      });

      // Striker Batsman (Right-Handed vs Left-Handed Stance)
      const batX = isLeftHanded ? cx - 14 : cx + 14;
      const batY = botCreaseY - 4;
      const swingAngle =
        anim.active && tNorm >= 0.4 && tNorm <= 0.65
          ? isLeftHanded
            ? 0.7 + Math.sin(((tNorm - 0.4) / 0.25) * Math.PI) * 1.45
            : -0.7 + Math.sin(((tNorm - 0.4) / 0.25) * Math.PI) * -1.45
          : isLeftHanded
          ? 0.55
          : -0.55;

      ctx.fillStyle = '#fef9c3';
      ctx.fillRect(batX - 5, batY + 5, 4, 10);
      ctx.fillRect(batX + 1, batY + 5, 4, 10);
      ctx.fillStyle = batJersey;
      ctx.beginPath();
      ctx.roundRect(batX - 6, batY - 8, 12, 14, 4);
      ctx.fill();
      ctx.fillStyle = batTeam.primaryColor;
      ctx.beginPath();
      ctx.arc(batX, batY - 12, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(isLeftHanded ? batX - 1 : batX - 4, batY - 12, 5, 2.5);

      ctx.save();
      ctx.translate(isLeftHanded ? batX + 4 : batX - 4, batY);
      ctx.rotate(swingAngle);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-2, -18, 4.5, 18);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-1.5, -17, 2, 14);
      ctx.restore();

      // Ball
      if (ballVisible) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(ballShadowX, ballShadowY, ballRadius * 0.8, ballRadius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isTestKit ? '#dc2626' : '#f8fafc';
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isTestKit ? '#fef2f2' : '#dc2626';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }

      // Pooled Particles
      const pool = particlesRef.current;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.active) continue;
        if (!paused) {
          p.life += dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.94;
          p.vy *= 0.94;
        }
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        const alpha = 1 - p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // Weather Atmosphere Overlay (visibility haze, wind streaks, or rain shower)
      if (weatherMode === 'overcast' || weatherMode === 'humid' || weatherMode === 'drizzle' || rainDelayActive) {
        ctx.fillStyle =
          rainDelayActive
            ? 'rgba(15, 23, 42, 0.34)'
            : weatherMode === 'drizzle'
            ? 'rgba(15, 23, 42, 0.24)'
            : weatherMode === 'overcast'
            ? 'rgba(30, 41, 59, 0.16)'
            : 'rgba(148, 163, 184, 0.10)';
        ctx.fillRect(0, 0, width, height);
      }

      if (weatherMode === 'windy') {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.22)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 14; i++) {
          const sx = (((i * 173 + totalTime * 210) % (width + 120)) - 60);
          const sy = ((i * 89) % height);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 44, sy - 6);
          ctx.stroke();
        }
      }

      if (weatherMode === 'drizzle' || rainDelayActive) {
        const dropCount = rainDelayActive ? 44 : 26;
        ctx.strokeStyle = rainDelayActive
          ? 'rgba(147, 197, 253, 0.52)'
          : 'rgba(147, 197, 253, 0.34)';
        ctx.lineWidth = rainDelayActive ? 1.5 : 1.1;
        for (let i = 0; i < dropCount; i++) {
          const rxPos = ((i * 97 + totalTime * 115) % (width + 60)) - 30;
          const ryPos = ((i * 67 + totalTime * 420) % (height + 40)) - 20;
          ctx.beginPath();
          ctx.moveTo(rxPos, ryPos);
          ctx.lineTo(rxPos - 7, ryPos + (rainDelayActive ? 18 : 12));
          ctx.stroke();
        }
      }

      ctx.restore();
      scheduleTail();
    };

    scheduleImmediate();
    return () => {
      scheduleFrameRef.current = null;
      cancelAnimationFrame(rafId);
      if (timerId) window.clearTimeout(timerId);
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="stadium-canvas"
      className="fixed inset-0 w-full h-full block pointer-events-none"
    />
  );
};
