import { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  delay: number;
  duration: number;
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -20 - Math.random() * 20,
    rotation: Math.random() * 360,
    scale: 0.5 + Math.random() * 0.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2
  }));
}

export function Confetti() {
  const [pieces] = useState(() => generateConfetti(50));

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti"
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            transform: `rotate(${piece.rotation}deg) scale(${piece.scale})`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill={piece.color}>
            <circle cx="6" cy="6" r="6" />
          </svg>
        </div>
      ))}

      {/* Additional geometric shapes */}
      {pieces.slice(0, 25).map((piece) => (
        <div
          key={`rect-${piece.id}`}
          className="absolute animate-confetti-rect"
          style={{
            left: `${piece.x + 20}%`,
            top: `${piece.y + 10}%`,
            transform: `rotate(${piece.rotation}deg) scale(${piece.scale})`,
            animationDelay: `${piece.delay + 0.2}s`,
            animationDuration: `${piece.duration}s`
          }}
        >
          <svg width="8" height="10" viewBox="0 0 8 10" fill={piece.color}>
            <rect width="8" height="10" rx="1" />
          </svg>
        </div>
      ))}

      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg) scale(0.5);
            opacity: 0;
          }
        }
        @keyframes confetti-rect {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(-540deg) scale(0.3);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
        .animate-confetti-rect {
          animation: confetti-rect 3.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default Confetti;
