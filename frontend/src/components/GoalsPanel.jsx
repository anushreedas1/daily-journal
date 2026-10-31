import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const REFLECTIONS = [
  'What felt lighter than you expected today?',
  'Write down one small thing you want to remember.',
  'What helped you feel like yourself today?',
  'Name one thing you handled well, however small.',
  'What would you like to give yourself permission to let go of?',
  'When did you feel most present today?',
  'What is one kind thing you can do for tomorrow-you?'
];

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function accountStorageKey(user, suffix) {
  return `journal_${user?._id || user?.id || user?.email || 'account'}_${suffix}`;
}

function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export default function GoalsPanel() {
  const { user } = useAuth();
  const accountKey = user?._id || user?.id || user?.email || 'account';
  const goalKey = accountStorageKey(user, 'weekly_goal');
  const reminderKey = accountStorageKey(user, 'reminder');
  const challengeKey = accountStorageKey(user, `challenge_${localDateKey(new Date())}`);
  const [goal, setGoal] = useState(() => Number(readStored(goalKey, 3)) || 3);
  const [goalDraft, setGoalDraft] = useState(String(Number(readStored(goalKey, 3)) || 3));
  const [weekDates, setWeekDates] = useState([]);
  const [completedDays, setCompletedDays] = useState(0);
  const [progressError, setProgressError] = useState('');
  const [challengeDone, setChallengeDone] = useState(() => Boolean(readStored(challengeKey, false)));
  const [reminder, setReminder] = useState(() => readStored(reminderKey, { enabled: false, time: '20:00', lastFired: '' }));
  const [reminderMessage, setReminderMessage] = useState('');

  const today = localDateKey(new Date());
  const challenge = useMemo(() => {
    const day = Math.floor((new Date(`${today}T12:00:00`) - new Date(`${today.slice(0, 4)}-01-01T12:00:00`)) / 86400000);
    return REFLECTIONS[day % REFLECTIONS.length];
  }, [today]);

  useEffect(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const from = localDateKey(monday);
    const to = localDateKey(now);
    setWeekDates([from, to]);
    const loadProgress = () => {
      setProgressError('');
      api.get('/entries/search', { params: { from, to } })
        .then((res) => setCompletedDays(new Set((res.data.entries || []).map((entry) => entry.date)).size))
        .catch(() => setProgressError('Weekly progress is temporarily unavailable.'));
    };
    loadProgress();
    window.addEventListener('journal-entry-changed', loadProgress);
    return () => window.removeEventListener('journal-entry-changed', loadProgress);
  }, [accountKey]);

  function saveGoal(event) {
    event.preventDefault();
    const next = Math.max(1, Math.min(7, Number(goalDraft) || 1));
    setGoal(next);
    setGoalDraft(String(next));
    localStorage.setItem(goalKey, JSON.stringify(next));
  }

  function toggleChallenge() {
    const next = !challengeDone;
    setChallengeDone(next);
    localStorage.setItem(challengeKey, JSON.stringify(next));
  }

  async function toggleReminder(enabled) {
    if (enabled && typeof window !== 'undefined' && !('Notification' in window)) {
      setReminderMessage('This browser does not support notifications.');
      return;
    }
    if (enabled && Notification.permission === 'denied') {
      setReminderMessage('Notifications are blocked for this site. Allow them in browser settings to use reminders.');
      return;
    }
    if (enabled && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setReminderMessage('Notifications were not enabled. You can change this in browser settings.');
        setReminder((current) => ({ ...current, enabled: false }));
        return;
      }
    }
    const next = { ...reminder, enabled };
    setReminder(next);
    localStorage.setItem(reminderKey, JSON.stringify(next));
    setReminderMessage(enabled ? 'Reminder is on for this browser.' : 'Reminder turned off.');
  }

  function changeReminderTime(time) {
    const next = { ...reminder, time };
    setReminder(next);
    localStorage.setItem(reminderKey, JSON.stringify(next));
  }

  useEffect(() => {
    if (!reminder.enabled || !('Notification' in window) || Notification.permission !== 'granted') return undefined;
    const checkReminder = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const date = localDateKey(now);
      if (currentTime === reminder.time && reminder.lastFired !== date) {
        new Notification('A moment for your journal', { body: 'Take a few minutes to reflect on your day.' });
        const next = { ...reminder, lastFired: date };
        setReminder(next);
        localStorage.setItem(reminderKey, JSON.stringify(next));
      }
    };
    checkReminder();
    const timer = window.setInterval(checkReminder, 30000);
    return () => window.clearInterval(timer);
  }, [reminder, reminderKey]);

  const progressPercent = Math.min(100, Math.round((completedDays / goal) * 100));

  return (
    <section className="goals-panel" aria-labelledby="goals-heading">
      <div className="goals-intro"><span className="goals-eyebrow">GENTLE ROUTINES</span><h2 id="goals-heading">Goals & reflections</h2><p>A small check-in is enough. Make the goal work for you.</p></div>
      <div className="goals-grid">
        <article className="goal-card">
          <div className="goal-card-heading"><div><span className="goal-card-icon" aria-hidden="true">✍️</span><h3>Weekly journaling goal</h3></div><strong>{completedDays}/{goal}</strong></div>
          <p>{progressError || (weekDates.length ? `${weekDates[0]} to ${weekDates[1]}` : 'This week')}</p>
          <div className="goal-progress" role="progressbar" aria-label="Weekly journaling progress" aria-valuenow={Math.min(completedDays, goal)} aria-valuemin={0} aria-valuemax={goal}><span style={{ width: `${progressPercent}%` }} /></div>
          <div className="goal-progress-caption"><span>{completedDays >= goal ? 'Goal reached. Well done!' : `${Math.max(0, goal - completedDays)} ${goal - completedDays === 1 ? 'day' : 'days'} to your goal`}</span><form onSubmit={saveGoal}><label htmlFor="weekly-goal">Goal</label><input id="weekly-goal" type="number" min="1" max="7" value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} /><button type="submit">Save</button></form></div>
        </article>

        <article className="goal-card reflection-card">
          <div className="goal-card-heading"><div><span className="goal-card-icon" aria-hidden="true">🌿</span><h3>Today’s reflection</h3></div><span className="reflection-day">Daily prompt</span></div>
          <p className="reflection-prompt">{challenge}</p>
          <button type="button" className={`challenge-done ${challengeDone ? 'is-done' : ''}`} onClick={toggleChallenge} aria-pressed={challengeDone}>{challengeDone ? '✓ Done for today' : 'Mark today’s reflection done'}</button>
        </article>

        <article className="goal-card reminder-card">
          <div className="goal-card-heading"><div><span className="goal-card-icon" aria-hidden="true">🔔</span><h3>Optional reminder</h3></div><label className="reminder-toggle"><input type="checkbox" checked={reminder.enabled} onChange={(event) => toggleReminder(event.target.checked)} /><span>On</span></label></div>
          <p>Choose a time for a gentle nudge to write.</p>
          <label className="reminder-time">Reminder time<input type="time" value={reminder.time} onChange={(event) => changeReminderTime(event.target.value)} /></label>
          <small className="reminder-note">Browser notifications work while the journal is open.</small>
          {reminderMessage && <small className="reminder-status" role="status">{reminderMessage}</small>}
        </article>
      </div>
    </section>
  );
}
