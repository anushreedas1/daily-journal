import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// entriesByDate: { 'YYYY-MM-DD': { mood, title } }
export default function CalendarView({ entriesByDate, onSelectDate, onActiveMonthChange, selectedDate, year, month }) {
  return (
    <Calendar
      activeStartDate={new Date(year, month - 1, 1)}
      value={selectedDate ? new Date(`${selectedDate}T12:00:00`) : null}
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
