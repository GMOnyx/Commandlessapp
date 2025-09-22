import { useEffect, useRef } from "react";

/*
  Full-page interactive background: white canvas with soft purple pools that
  drift and react to pointer/clicks. Sits behind all content using fixed
  positioning and pointer-events: none.
*/
const BackgroundPools = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: true })!;

    const pools: Array<{ x: number; y: number; r: number; vx: number; vy: number }>[] = [
      [],
    ];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Seed a few pools
    const seed = () => {
      pools[0].length = 0;
      for (let i = 0; i < 6; i++) {
        pools[0].push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: 200 + Math.random() * 200,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
        });
      }
    };
    seed();

    // Interaction: on move creates subtle attraction; on click a pulse pool
    const handleMove = (e: MouseEvent) => {
      const { clientX: x, clientY: y } = e;
      for (const p of pools[0]) {
        const dx = x - p.x;
        const dy = y - p.y;
        p.vx += dx * 0.00002;
        p.vy += dy * 0.00002;
      }
    };
    const handleClick = (e: MouseEvent) => {
      const { clientX: x, clientY: y } = e;
      pools[0].push({ x, y, r: 60, vx: 0, vy: 0 });
      setTimeout(() => {
        pools[0] = pools[0].filter((p) => !(p.x === x && p.y === y && p.r === 60));
      }, 900);
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("click", handleClick);

    const render = () => {
      // fade previous frame for smoothness
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw a subtle white base but allow underlying page color
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw pools with soft radial gradients
      for (const p of pools[0]) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.995;
        p.vy *= 0.995;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, "hsla(245, 83%, 65%, 0.14)");
        grad.addColorStop(0.6, "hsla(248, 95%, 78%, 0.08)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("click", handleClick);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
};

export default BackgroundPools;


