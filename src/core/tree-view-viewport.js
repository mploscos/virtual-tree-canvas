export class TreeViewViewport extends EventTarget {
  constructor({ rowHeight = 28, indentWidth = 18, headerHeight = 28 } = {}) {
    super();
    this.rowHeight = rowHeight;
    this.indentWidth = indentWidth;
    this.headerHeight = headerHeight;
    this.renderInsetX = 0;
    this.renderInsetY = 0;
    this.scrollX = 0;
    this.scrollY = 0;
    this.viewportWidth = 1;
    this.viewportHeight = 1;
    this.contentWidth = 1;
    this.contentHeight = 1;
    this.zoom = 1;
    this.scrollbarSize = 0;
    this.verticalScrollbarVisible = false;
    this.horizontalScrollbarVisible = false;
  }

  get contentViewportWidth() {
    return Math.max(1, this.viewportWidth - (this.verticalScrollbarVisible ? this.scrollbarSize : 0));
  }

  get rowViewportHeight() {
    return Math.max(1, this.viewportHeight - this.headerHeight - (this.horizontalScrollbarVisible ? this.scrollbarSize : 0));
  }

  resize(width, height) {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.clamp();
    this.dispatchEvent(new Event('change'));
  }

  setContentSize(width, height) {
    this.contentWidth = Math.max(1, width);
    this.contentHeight = Math.max(1, height);
    this.clamp();
    this.dispatchEvent(new Event('change'));
  }

  setScrollbarState({ size = this.scrollbarSize, vertical = this.verticalScrollbarVisible, horizontal = this.horizontalScrollbarVisible } = {}) {
    const nextSize = Math.max(0, size);
    const nextVertical = Boolean(vertical && nextSize > 0);
    const nextHorizontal = Boolean(horizontal && nextSize > 0);
    const changed =
      this.scrollbarSize !== nextSize ||
      this.verticalScrollbarVisible !== nextVertical ||
      this.horizontalScrollbarVisible !== nextHorizontal;
    this.scrollbarSize = nextSize;
    this.verticalScrollbarVisible = nextVertical;
    this.horizontalScrollbarVisible = nextHorizontal;
    this.clamp();
    return changed;
  }

  scrollBy(dx, dy) {
    this.scrollX += dx;
    this.scrollY += dy;
    this.clamp();
    this.dispatchEvent(new Event('change'));
  }

  scrollTo(x, y) {
    this.scrollX = x;
    this.scrollY = y;
    this.clamp();
    this.dispatchEvent(new Event('change'));
  }

  /** @param {number} rowIndex @param {'start' | 'center' | 'end' | 'nearest'} align */
  scrollRowIntoView(rowIndex, align = 'nearest') {
    const rowTop = rowIndex * this.rowHeight;
    const rowBottom = rowTop + this.rowHeight;
    if (align === 'start') this.scrollY = rowTop;
    else if (align === 'center') this.scrollY = rowTop - (this.rowViewportHeight - this.rowHeight) / 2;
    else if (align === 'end') this.scrollY = rowBottom - this.rowViewportHeight;
    else if (rowTop < this.scrollY) this.scrollY = rowTop;
    else if (rowBottom > this.scrollY + this.rowViewportHeight) this.scrollY = rowBottom - this.rowViewportHeight;
    this.clamp();
    this.dispatchEvent(new Event('change'));
  }

  clamp() {
    const maxX = Math.max(0, this.contentWidth - this.contentViewportWidth);
    const maxY = Math.max(0, this.contentHeight - this.rowViewportHeight);
    this.scrollX = Math.max(0, Math.min(maxX, this.scrollX));
    this.scrollY = Math.max(0, Math.min(maxY, this.scrollY));
  }
}
