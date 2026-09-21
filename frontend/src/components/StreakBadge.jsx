import { useEffect, useState } from 'react';
import api from '../api/client';

export default function StreakBadge() {
  const [streak, setStreak] = useState(null);

  useEffect(() => {
    api.get('/entries/streak').then((res) => setStreak(res.data));
  }, []);

  if (!streak) return null;

  return (
    <div className="streak-badge" title={`Longest streak: ${streak.longestStreak} days`}>
      🔥 {streak.currentStreak}-day streak
    </div>
  );
}
