import Calendar from 'react-calendar';
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
      tileClassName={({ date, view }) =>
        view === 'month' && entriesByDate[toDateKey(date)]
          ? 'react-calendar__tile--has-entry'
          : null
      }
    />
  );
}
