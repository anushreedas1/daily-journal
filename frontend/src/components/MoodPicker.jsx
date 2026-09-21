const MOODS = [
  { value: 'great', emoji: '😄', label: 'Great' },
  { value: 'good', emoji: '🙂', label: 'Good' },
  { value: 'okay', emoji: '😐', label: 'Okay' },
  { value: 'bad', emoji: '🙁', label: 'Bad' },
  { value: 'terrible', emoji: '😞', label: 'Terrible' }
];

export function moodEmoji(value) {
  return MOODS.find((m) => m.value === value)?.emoji || '';
}

export default function MoodPicker({ value, onChange }) {
  return (
    <div className="mood-picker">
      {MOODS.map((m) => (
        <button
          key={m.value}
          type="button"
          title={m.label}
          className={`mood-option ${value === m.value ? 'selected' : ''}`}
          onClick={() => onChange(value === m.value ? null : m.value)}
        >
          <span className="mood-emoji">{m.emoji}</span>
        </button>
      ))}
    </div>
  );
}
