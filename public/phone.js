export function formatPhone(value) {
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (!digits) return '';
  if (digits.length < 3) return `(${digits}`;
  const local = digits.slice(2);
  const split = local.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? '-' + local.slice(split) : ''}`;
}

export function bindPhoneInput(input) {
  input.addEventListener('beforeinput', event => {
    if (input.selectionStart !== input.selectionEnd) return;
    let caret = input.selectionStart;
    if (event.inputType === 'deleteContentBackward') {
      while (caret > 0 && /\D/.test(input.value[caret - 1])) caret--;
    } else if (event.inputType === 'deleteContentForward') {
      while (caret < input.value.length && /\D/.test(input.value[caret])) caret++;
    } else return;
    input.setSelectionRange(caret, caret);
  });
  input.addEventListener('input', () => {
    const value = input.value;
    const caret = input.selectionStart;
    let digitCount = value.slice(0, caret).replace(/\D/g, '').length;
    if (value.replace(/\D/g, '').startsWith('55') && value.replace(/\D/g, '').length > 11) digitCount = Math.max(0, digitCount - 2);
    const formatted = formatPhone(value);
    input.value = formatted;
    let position = 0, seen = 0;
    while (position < formatted.length && seen < digitCount) {
      if (/\d/.test(formatted[position])) seen++;
      position++;
    }
    input.setSelectionRange(position, position);
  });
  input.value = formatPhone(input.value);
}
