export function printPage() {
  const prev = document.title;
  document.title = '';
  const restore = () => {
    document.title = prev;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  requestAnimationFrame(() => window.print());
}

export function printInvoice() {
  const style = document.createElement('style');
  style.textContent = '@media print { @page { size: A5; margin: 0; } }';
  document.head.appendChild(style);
  document.body.classList.add('invoice-print');
  const prev = document.title;
  document.title = '';
  const restore = () => {
    document.body.classList.remove('invoice-print');
    style.remove();
    document.title = prev;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  requestAnimationFrame(() => window.print());
}
