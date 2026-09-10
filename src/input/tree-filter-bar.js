/** A view of controller filter state. No duplicated query or toggle state. */
export class TreeFilterBar {
  constructor(controller, document) {
    this.controller = controller;
    this.element = document.createElement('div');
    this.element.className = 'vtc-filter';
    this.input = document.createElement('input');
    this.input.type = 'search';
    this.input.placeholder = 'Filter';
    this.input.setAttribute('aria-label', 'Filter rows');
    this.caseButton = this.button(document, 'Aa', 'Match case');
    this.wholeButton = this.button(document, 'W', 'Match whole word');
    this.element.append(this.input, this.caseButton, this.wholeButton);
    this.input.addEventListener('input', this.onInput);
    this.caseButton.addEventListener('click', this.onCase);
    this.wholeButton.addEventListener('click', this.onWhole);
    this.stop = controller.on('filterchange', () => this.sync());
    this.sync();
  }

  button(document, label, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
    return button;
  }

  onInput = () => this.controller.setFilter(this.input.value, this.controller.filterOptions);
  onCase = () => this.toggle('caseSensitive');
  onWhole = () => this.toggle('wholeWord');

  toggle(key) {
    const options = this.controller.filterOptions;
    this.controller.setFilter(this.input.value, { ...options, [key]: !options[key] });
    this.input.focus();
  }

  sync() {
    this.input.value = this.controller.filterQuery;
    this.caseButton.setAttribute('aria-pressed', String(this.controller.filterOptions.caseSensitive));
    this.wholeButton.setAttribute('aria-pressed', String(this.controller.filterOptions.wholeWord));
  }

  setVisible(visible) { this.element.hidden = !visible; }

  destroy() {
    this.stop();
    this.input.removeEventListener('input', this.onInput);
    this.caseButton.removeEventListener('click', this.onCase);
    this.wholeButton.removeEventListener('click', this.onWhole);
    this.element.remove();
  }
}
