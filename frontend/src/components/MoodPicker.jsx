export const MOODS = [
  { value: 'great', emoji: '😄', label: 'Great' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'bad', emoji: '🙁', label: 'Bad' },
  { value: 'terrible', emoji: '😞', label: 'Terrible' },
  { value: 'excited', emoji: '🤩', label: 'Excited' },
  { value: 'grateful', emoji: '🥰', label: 'Grateful' },
  { value: 'calm', emoji: '😌', label: 'Calm' },
  { value: 'anxious', emoji: '😰', label: 'Anxious' },
  { value: 'tired', emoji: '😴', label: 'Tired' },
  { value: 'overwhelmed', emoji: '🥴', label: 'Overwhelmed' },
  { value: 'angry', emoji: '😤', label: 'Angry' },
  { value: 'hopeful', emoji: '🌱', label: 'Hopeful' }
];

export function moodEmoji(value) {
  return MOODS.find((m) => m.value === value)?.emoji || '';
}

export default function MoodPicker({ value, onChange }) {
  return (
    <div className="mood-picker" role="group" aria-label="Choose your mood">
      {MOODS.map((m) => (
        <button
          key={m.value}
          type="button"
          title={m.label}
          aria-label={m.label}
          aria-pressed={value === m.value}
          className={`mood-option ${value === m.value ? 'selected' : ''}`}
          onClick={() => onChange(value === m.value ? null : m.value)}
        >
          <span className="mood-emoji">{m.emoji}</span>
        </button>
      ))}
    </div>
  );
}
