export const treeViewStyles = `
  .vtc-view {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
    background: var(--vtc-background);
    color: var(--vtc-text);
  }

  .vtc-view .vtc-canvas-host {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .vtc-view .vtc-canvas-host > canvas {
    display: block;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }

  .vtc-view .vtc-canvas-host > canvas:focus-visible {
    outline: 1px solid var(--vtc-border);
    outline-offset: -1px;
  }

  .vtc-view .vtc-filter {
    display: flex;
    flex: 0 0 30px;
    box-sizing: border-box;
    gap: 4px;
    padding: 4px 8px;
    min-width: 0;
  }

  .vtc-view .vtc-filter[hidden] {
    display: none;
  }

  .vtc-view .vtc-filter input,
  .vtc-view .vtc-filter button {
    height: 22px;
    box-sizing: border-box;
    border: 1px solid var(--vtc-border);
    border-radius: 4px;
    background: var(--vtc-background);
    color: var(--vtc-text);
    font: 12px var(--vtc-font-family, ui-monospace, monospace);
  }

  .vtc-view .vtc-filter input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0 8px;
  }

  .vtc-view .vtc-filter button {
    flex: 0 0 24px;
    padding: 0;
    cursor: pointer;
  }

  .vtc-view .vtc-filter button:hover {
    border-color: var(--vtc-focus);
  }

  .vtc-view .vtc-filter :focus-visible {
    outline: 1px solid var(--vtc-focus);
    outline-offset: 1px;
  }

  .vtc-view .vtc-filter [aria-pressed='true'] {
    border-color: var(--vtc-focus);
    background: var(--vtc-selected);
  }
`;
