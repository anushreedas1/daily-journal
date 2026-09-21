import jsPDF from 'jspdf';
import { moodEmoji } from './MoodPicker';

function htmlToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.textContent || div.innerText || '';
}

// entries: array of { date, title, mood, body }
export function exportEntriesToPdf(entries, filename = 'journal-export.pdf') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  let y = 60;

  entries.forEach((entry, idx) => {
    if (idx > 0) {
      doc.addPage();
      y = 60;
    }

    doc.setFontSize(16);
    doc.text(entry.date, marginX, y);
    y += 22;

    if (entry.mood) {
      doc.setFontSize(11);
      doc.text(`Mood: ${entry.mood} ${moodEmoji(entry.mood)}`, marginX, y);
      y += 20;
    }

    if (entry.title) {
      doc.setFontSize(14);
      doc.text(entry.title, marginX, y);
      y += 20;
    }

    doc.setFontSize(11);
    const bodyText = htmlToPlainText(entry.body);
    const lines = doc.splitTextToSize(bodyText, maxWidth);

    lines.forEach((line) => {
      if (y > pageHeight - 48) {
        doc.addPage();
        y = 60;
      }
      doc.text(line, marginX, y);
      y += 16;
    });
  });

  doc.save(filename);
}

export default function ExportPdfButton({ entries, label = 'Export to PDF', filename }) {
  return (
    <button
      type="button"
      className="export-pdf-button"
      disabled={!entries || entries.length === 0}
      onClick={() => exportEntriesToPdf(entries, filename)}
    >
      {label}
    </button>
  );
}
