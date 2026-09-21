import Calendar from 'react-calendar';
import { moodEmoji } from './MoodPicker';
import 'react-calendar/dist/Calendar.css';

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// entriesByDate: { 'YYYY-MM-DD': { mood, title } }
export default function CalendarView({ entriesByDate, onSelectDate, onActiveMonthChange }) {
  return (
    <Calendar
      onClickDay={(date) => onSelectDate(toDateKey(date))}
      onActiveStartDateChange={({ activeStartDate }) =>
        onActiveMonthChange(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1)
      }
      tileContent={({ date, view }) => {
        if (view !== 'month') return null;
        const key = toDateKey(date);
        const entry = entriesByDate[key];
        if (!entry) return null;
        return (
          <div className="tile-indicator">
            {entry.mood ? (
              <span className="tile-mood">{moodEmoji(entry.mood)}</span>
            ) : (
              <span className="tile-dot">•</span>
            )}
          </div>
        );
      }}
    />
  );
}
