/**
 * ECOS DE SOPOCACHI - CONFETTI CELEBRATION ENGINE
 * Animación de confeti pura y ligera en canvas HTML5 sin dependencias externas.
 */

export function triggerConfetti(canvasElement) {
  if (!canvasElement) return;

  const ctx = canvasElement.getContext("2d");
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;

  const confettiCount = 120;
  const particles = [];
  const colors = ["#f59e0b", "#10b981", "#06b6d4", "#ec4899", "#8b5cf6", "#fbbf24", "#ffffff"];

  for (let i = 0; i < confettiCount; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.7) * 18 - 4,
      rotation: Math.random() * 360,
      vRotation: (Math.random() - 0.5) * 12,
      opacity: 1,
      gravity: 0.35,
      friction: 0.98
    });
  }

  let animationId = null;
  const startTime = Date.now();

  function render() {
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    let activeParticles = 0;
    const elapsed = Date.now() - startTime;

    for (let p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.rotation += p.vRotation;

      if (elapsed > 2000) {
        p.opacity -= 0.015;
      }

      if (p.opacity > 0 && p.y < canvasElement.height + 20) {
        activeParticles++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    }

    if (activeParticles > 0) {
      animationId = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      cancelAnimationFrame(animationId);
    }
  }

  render();
}
