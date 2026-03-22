import { useEffect, useState } from 'react';
import { Confetti } from './confetti';

export interface Milestone {
  id: string;
  title: string;
  description: string;
  icon: string;
  reward: string;
}

export interface CelebrationPopupProps {
  milestone: Milestone | null;
  onClose: () => void;
}

const MILESTONES: Record<string, Milestone> = {
  '3_referrals': {
    id: '3_referrals',
    title: '🎉 First Milestone!',
    description: 'You invited 3 friends!',
    icon: '👥',
    reward: 'GHS 5 credit'
  },
  '10_referrals': {
    id: '10_referrals',
    title: '🌟 Super Referrer!',
    description: 'You invited 10 friends!',
    icon: '⭐',
    reward: 'GHS 20 credit'
  },
  '25_referrals': {
    id: '25_referrals',
    title: '🏆 Referral Champion!',
    description: 'You invited 25 friends!',
    icon: '🏆',
    reward: 'Commission discount'
  },
  '50_referrals': {
    id: '50_referrals',
    title: '👑 Ambassador!',
    description: 'You invited 50 friends!',
    icon: '👑',
    reward: 'VIP status'
  },
  'first_sale': {
    id: 'first_sale',
    title: '💰 First Sale!',
    description: 'Congratulations on your first sale!',
    icon: '💵',
    reward: 'Keep it up!'
  },
  'first_purchase': {
    id: 'first_purchase',
    title: '🛍️ First Purchase!',
    description: 'Welcome to White Market!',
    icon: '🎁',
    reward: 'Happy shopping!'
  },
  'verified': {
    id: 'verified',
    title: '✅ Verified!',
    description: 'Your account is now verified!',
    icon: '✅',
    reward: 'Full access unlocked'
  },
  'seller_level_up': {
    id: 'seller_level_up',
    title: '📈 Level Up!',
    description: 'You\'ve reached a new seller level!',
    icon: '🚀',
    reward: 'Higher limits'
  }
};

export function CelebrationPopup({ milestone, onClose }: CelebrationPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (milestone) {
      // Trigger animations
      setTimeout(() => setIsVisible(true), 100);
      setTimeout(() => setShowConfetti(true), 500);
      
      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [milestone]);

  const handleClose = () => {
    setIsVisible(false);
    setShowConfetti(false);
    setTimeout(onClose, 300); // Wait for animation
  };

  if (!milestone) return null;

  const milestoneData = MILESTONES[milestone.id] || milestone;

  return (
    <>
      {/* Confetti effect */}
      {showConfetti && <Confetti />}
      
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      >
        {/* Popup */}
        <div 
          className={`relative mx-4 w-full max-w-sm transform transition-all duration-500 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-50 translate-y-10'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 opacity-75 blur-xl animate-pulse"></div>
          
          {/* Main card */}
          <div className="relative rounded-xl bg-white p-6 text-center shadow-2xl">
            {/* Close button */}
            <button 
              onClick={handleClose}
              aria-label="Close celebration"
              className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Icon with animation */}
            <div className="mb-4 flex justify-center">
              <div className="animate-bounce text-6xl">
                {milestoneData.icon}
              </div>
            </div>

            {/* Title */}
            <h2 className="mb-2 bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 bg-clip-text text-2xl font-bold text-transparent">
              {milestoneData.title}
            </h2>

            {/* Description */}
            <p className="mb-4 text-slate-600">
              {milestoneData.description}
            </p>

            {/* Reward badge */}
            <div className="inline-flex items-center rounded-full bg-gradient-to-r from-green-400 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              <span className="mr-2">🎁</span>
              {milestoneData.reward}
            </div>

            {/* Progress indicator */}
            <div className="mt-6 flex justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i}
                  className={`h-2 w-6 rounded-full ${
                    i < 3 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 animate-pulse' 
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>

            {/* Footer */}
            <p className="mt-4 text-xs text-slate-400">
              Keep referring to unlock more rewards!
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}

// Hook to use celebration
export function useCelebration() {
  const [celebration, setCelebration] = useState<Milestone | null>(null);

  const celebrate = (milestoneId: string) => {
    const milestone = MILESTONES[milestoneId];
    if (milestone) {
      setCelebration(milestone);
    }
  };

  const celebrateCustom = (milestone: Milestone) => {
    setCelebration(milestone);
  };

  const close = () => {
    setCelebration(null);
  };

  return { celebration, celebrate, celebrateCustom, close };
}

export default CelebrationPopup;
