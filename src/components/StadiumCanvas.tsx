import React, { useEffect, useRef } from 'react';
import {
  BattingHand,
  BowlingSide,
  DeliveryLength,
  DeliveryResolution,
  DeliveryType,
  MatchFormat,
  PitchCondition,
  Team,
} from '../game/types';

export interface BallAnimTrigger {
  id: number;
  deliveryType: DeliveryType;
  deliveryLength: DeliveryLength;
  resolution: DeliveryResolution;
}

interface StadiumCanvasProps {
  isPlaying: boolean;
  isPaused: boolean;
  format?: MatchFormat;
  pitchCondition?: PitchCondition;
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

function computeFieldGeometry(width: number, height: number) {
  const isShortLandscape = height <= 520 && width > height;
  const isMobile = width < 640 && !isShortLandscape;
  const topSafe = isShortLandscape ? 46 : isMobile ? 72 : 68;
  const bottomSafe = isShortLandscape
    ? Math.min(height * 0.35, 138)
    : isMobile
    ? Math.min(height * 0.34, 285)
    : Math.min(height * 0.28, 220);
  const availH = isShortLandscape
    ? Math.max(125, height - topSafe - bottomSafe)
    : Math.max(220, height - topSafe - bottomSafe);
  const cx = width * 0.5;
  const cy = topSafe + availH * 0.5;
  const rx = isShortLandscape
    ? Math.min(width * 0.42, availH * 1.45)
    : isMobile
    ? Math.min(width * 0.46, availH * 0.72)
    : Math.min(width * 0.44, availH * 0.86);
  const ry = isShortLandscape
    ? Math.min(availH * 0.46, rx * 0.54)
    : isMobile
    ? Math.min(availH * 0.46, Math.max(rx * 0.78, availH * 0.38))
    : Math.min(availH * 0.46, rx * 0.56);
  const pitchW = Math.max(isShortLandscape ? 20 : 24, rx * 0.13);
  const pitchH = isShortLandscape ? Math.max(78, ry * 0.94) : Math.max(125, ry * 0.92);
  return { isShortLandscape, cx, cy, rx, ry, pitchW, pitchH };
}

export const StadiumCanvas: React.FC<StadiumCanvasProps> = ({
  isPlaying,
  isPaused,
  format = 'limited',
  pitchCondition = 'hard',
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

  useEffect(() => {
    bgDirtyRef.current = true;
  }, [isPlaying, pitchCondition]);

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
      duration: 1.55,
      notified: false,
      trauma: 0,
      crowdExcitement: 0,
    };
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

      // Night Sky + Emerald Horizon
      const bgGrad = bgCtx.createRadialGradient(
        width * 0.5,
        height * 0.25,
        40,
        width * 0.5,
        height * 0.55,
        Math.max(width, height) * 0.78
      );
      bgGrad.addColorStop(0, '#0a1c3d');
      bgGrad.addColorStop(0.5, '#061529');
      bgGrad.addColorStop(0.85, '#07241a');
      bgGrad.addColorStop(1, '#093418');
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

      // Concentric emerald turf rings
      for (let r = 6; r >= 1; r--) {
        const frac = r / 6;
        bgCtx.fillStyle = r % 2 === 0 ? '#116322' : '#177a2b';
        bgCtx.beginPath();
        bgCtx.ellipse(cx, cy, rx * frac, ry * frac, 0, 0, Math.PI * 2);
        bgCtx.fill();
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

      // Central Pitch colored & textured by pitchCondition
      const pitchX = cx - pitchW / 2;
      const pitchY = cy - pitchH / 2;
      const pitchMode = propsRef.current.pitchCondition;

      if (pitchMode === 'green') {
        bgCtx.fillStyle = '#799a54';
        bgCtx.fillRect(pitchX, pitchY, pitchW, pitchH);
        bgCtx.fillStyle = 'rgba(46, 102, 38, 0.25)';
        bgCtx.fillRect(pitchX + 3, pitchY + 10, pitchW - 6, pitchH - 20);
      } else if (pitchMode === 'dry') {
        bgCtx.fillStyle = '#d7c195';
        bgCtx.fillRect(pitchX, pitchY, pitchW, pitchH);
        bgCtx.fillStyle = 'rgba(130, 92, 48, 0.22)';
        bgCtx.fillRect(pitchX + 3, pitchY + pitchH * 0.62, pitchW * 0.35, 16);
        bgCtx.fillRect(pitchX + pitchW * 0.55, pitchY + pitchH * 0.28, pitchW * 0.35, 14);
      } else {
        bgCtx.fillStyle = '#c8a774';
        bgCtx.fillRect(pitchX, pitchY, pitchW, pitchH);
        bgCtx.fillStyle = 'rgba(139, 90, 43, 0.16)';
        bgCtx.fillRect(pitchX + 4, pitchY + 12, pitchW - 8, pitchH - 24);
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

    const updateSize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bgDirtyRef.current = true;
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
    let rafId = 0;
    let lastDrawTime = 0;
    let drewPausedFrame = false;

    const render = (now: number) => {
      rafId = requestAnimationFrame(render);

      const {
        isPlaying: playing,
        isPaused: paused,
        format: matchFormat,
        pitchCondition: pitchMode,
        battingTeam: batTeam,
        bowlingTeam: bowlTeam,
        onAnimationComplete: onComplete,
      } = propsRef.current;
      const isTestKit = matchFormat === 'test';
      const bowlJersey = isTestKit ? '#f8fafc' : bowlTeam.primaryColor;
      const batJersey = isTestKit ? '#f8fafc' : batTeam.primaryColor;

      const anim = animStateRef.current;
      const hasActiveMotion = anim.active || anim.trauma > 0 || anim.crowdExcitement > 0 || particlesRef.current.some((p) => p.active);

      if (paused && !hasActiveMotion && !bgDirtyRef.current && drewPausedFrame) {
        return;
      }

      // Throttle idle ambience to ~24fps so Playwright/UI stays silky-responsive on software rendering
      if (!hasActiveMotion && now - lastDrawTime < 42) {
        return;
      }
      lastDrawTime = now;
      drewPausedFrame = paused && !hasActiveMotion;

      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      if (!paused) {
        totalTime += dt;
      }

      if (bgDirtyRef.current) {
        buildStaticBackdrop(playing);
        bgDirtyRef.current = false;
      }

      // Draw cached static stadium / sky
      ctx.drawImage(bgCanvas, 0, 0, width, height);

      // Twinkling stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const alpha = 0.35 + 0.55 * Math.abs(Math.sin(totalTime * s.speed + s.phase));
        ctx.fillStyle = `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
        ctx.fillRect(s.x * width, s.y * height * 0.72, s.r * 1.4, s.r * 1.4);
      }

      if (!playing) {
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
      const isWicketShattered =
        Boolean(anim.active && anim.trigger?.resolution.isWicket && tNorm >= 0.45);

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
      let ballRadius = 4.2;
      const ballVisible = anim.active;

      const batContactX = isLeftHanded ? cx - 6 : cx + 6;
      const batContactY = botCreaseY - 4;

      if (anim.active && anim.trigger) {
        const { deliveryType, deliveryLength, resolution } = anim.trigger;
        if (tNorm < 0.2) {
          ballX = ballReleaseX;
          ballY = bowlerY - 4;
        } else if (tNorm < 0.45) {
          const f = (tNorm - 0.2) / 0.25;
          const dryTurnBoost = pitchMode === 'dry' ? 1.55 : pitchMode === 'hard' ? 0.78 : 1.0;
          const greenSeamBoost = pitchMode === 'green' ? 1.48 : 1.0;
          let lateralCurve = 0;

          if (deliveryType === 'swing') {
            lateralCurve = Math.sin(f * Math.PI) * 18 * greenSeamBoost;
          } else if (deliveryType === 'seam') {
            lateralCurve = f > 0.52 ? -11 * greenSeamBoost : 0;
          } else if (deliveryType === 'spin' || deliveryType === 'off_spin') {
            lateralCurve = f > 0.56 ? (f - 0.56) * 34 * dryTurnBoost : 0;
          } else if (deliveryType === 'leg_spin') {
            lateralCurve = f > 0.56 ? -(f - 0.56) * 36 * dryTurnBoost : 0;
          } else if (deliveryType === 'googly') {
            lateralCurve =
              f > 0.6 ? (f - 0.6) * 44 * dryTurnBoost : -Math.sin(f * Math.PI) * 5;
          } else if (deliveryType === 'doosra') {
            lateralCurve =
              f > 0.6 ? -(f - 0.6) * 40 * dryTurnBoost : Math.sin(f * Math.PI) * 5;
          } else if (deliveryType === 'arm_ball') {
            lateralCurve = Math.sin(f * Math.PI) * 5;
          } else if (deliveryType === 'carrom') {
            lateralCurve =
              f > 0.58 ? -(f - 0.58) * 35 * dryTurnBoost : Math.sin(f * Math.PI) * 6;
          }

          ballX = ballReleaseX + (batContactX - ballReleaseX) * f + lateralCurve;
          ballY = bowlerY - 4 + (batContactY - (bowlerY - 4)) * f;
          const bouncePoint =
            deliveryLength === 'full' ? 0.78 : deliveryLength === 'short' ? 0.35 : 0.58;
          const arcScale = Math.abs(Math.sin(((f - bouncePoint) / (1 - bouncePoint)) * Math.PI));
          const bounceBoost = pitchMode === 'hard' ? 1.4 : pitchMode === 'dry' ? 0.85 : 1.0;
          ballRadius = 4.2 + arcScale * 1.4 * bounceBoost;
        } else {
          const f = (tNorm - 0.45) / 0.55;
          const eased = 1 - Math.pow(1 - f, 2.2);
          if (resolution.isWicket) {
            ballX = batContactX - eased * 6;
            ballY = botCreaseY + eased * 18;
          } else {
            const canvasAngle = -Math.PI / 2 + resolution.hitAngleRad;
            const maxDistX = rx * 0.95 * resolution.hitDistanceFactor;
            const maxDistY = ry * 0.95 * resolution.hitDistanceFactor;
            ballX = batContactX + Math.cos(canvasAngle) * maxDistX * eased;
            ballY = batContactY + Math.sin(canvasAngle) * maxDistY * eased;
            if (resolution.isBoundarySix) {
              ballRadius = 4.2 + Math.sin(f * Math.PI) * 4.2;
            }
          }

          if (tNorm < 0.5 && particlesRef.current.every((p) => !p.active)) {
            const burstColor = resolution.isWicket
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
              resolution.isBoundarySix || resolution.isWicket ? 20 : 10
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
        let fx = cx + Math.cos(ang - Math.PI / 2) * rx * FIELDER_RADII[idx];
        let fy = cy + Math.sin(ang - Math.PI / 2) * ry * FIELDER_RADII[idx];
        if (idx === nearestIdx && anim.active && tNorm > 0.48) {
          const chaseFrac = Math.min(0.65, (tNorm - 0.48) * 1.3);
          fx = fx + (ballX - fx) * chaseFrac;
          fy = fy + (ballY - fy) * chaseFrac;
        }
        ctx.fillStyle = bowlJersey;
        ctx.beginPath();
        ctx.arc(fx, fy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isTestKit ? bowlTeam.primaryColor : 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(fx, fy - 7, 4.5, 0, Math.PI * 2);
        ctx.fill();
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
        ctx.ellipse(ballX + 2, ballY + 5, ballRadius * 0.8, ballRadius * 0.4, 0, 0, Math.PI * 2);
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

      ctx.restore();
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
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
