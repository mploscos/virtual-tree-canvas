import { TreeView, builtInColumns, darkTheme, lightTheme } from '../src/index.js';

const PRODUCTS = [
    { id: 'BTC', label: 'Bitcoin · BTC' },
    { id: 'ETH', label: 'Ethereum · ETH' },
    { id: 'SOL', label: 'Solana · SOL' },
    { id: 'XRP', label: 'XRP · XRP' },
    { id: 'DOGE', label: 'Dogecoin · DOGE' },
    { id: 'ADA', label: 'Cardano · ADA' }
];
const productIds = new Set(PRODUCTS.map((product) => product.id));
const feedUrl = 'wss://crypto-ai-prices.fly.dev/ws';
const priceFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
const volumeFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const marketThemes = {
    dark: {
        ...darkTheme,
        valueColors: {
            ...darkTheme.valueColors,
            positive: '#4ade80',
            negative: '#fb7185',
            neutral: darkTheme.colors.textMuted
        }
    },
    light: {
        ...lightTheme,
        valueColors: {
            ...lightTheme.valueColors,
            positive: '#15803d',
            negative: '#be123c',
            neutral: lightTheme.colors.textMuted
        }
    }
};
const nameColumn = { ...builtInColumns.tree, label: 'Market' };
const priceColumn = {
    id: 'price', label: 'Price USD', kind: 'value', width: 112, minWidth: 100, align: 'right',
    value: (_node, state) => state.price ?? '',
    format: (value) => typeof value === 'number' ? `$${priceFormat.format(value)}` : '—'
};
const changeColumn = {
    id: 'change', label: '24h %', kind: 'value', width: 86, minWidth: 76, align: 'right',
    value: (_node, state) => state.change ?? '',
    valueType: (value) => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral',
    format: (value) => typeof value === 'number' ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '—'
};
const volumeColumn = {
    id: 'volume', label: '24h vol USD', kind: 'value', width: 112, minWidth: 100, align: 'right',
    value: (_node, state) => state.volume ?? '',
    format: (value) => typeof value === 'number' ? `$${volumeFormat.format(value)}` : '—'
};
const updatedColumn = { ...builtInColumns.updated, label: 'Received', width: 90, minWidth: 80 };
const compactNameColumn = { ...nameColumn, minWidth: 140 };
const compactPriceColumn = { ...priceColumn, width: 96, minWidth: 90 };
const compactChangeColumn = { ...changeColumn, width: 78, minWidth: 74 };
const columnsByWidth = {
    small: [compactNameColumn, compactChangeColumn],
    medium: [compactNameColumn, compactPriceColumn, compactChangeColumn],
    large: [nameColumn, priceColumn, changeColumn, volumeColumn, updatedColumn]
};

/**
 * Mount a streaming crypto ticker without adding network work to the component.
 * @param {HTMLElement} host
 * @param {HTMLElement} status
 * @param {HTMLButtonElement} toggle
 * @param {object} options
 */
export function createMarketDemo(host, status, toggle, options) {
    const view = new TreeView(host, {
        ...options,
        theme: marketThemes[options.theme],
        filter: false,
        editable: false,
        initialExpandDepth: 1,
        columns: columnsByWidth.large
    });
    view.setData([
        { id: 'spot', label: 'Crypto markets · USD', icon: 'network' },
        ...PRODUCTS.map((product) => ({
            id: product.id, parentId: 'spot', label: product.label, icon: 'point'
        }))
    ]);

    let visible = false;
    let paused = false;
    let socket = null;
    let reconnect = 0;
    let frame = 0;
    let size = '';
    let updates = 0;
    let lastUpdate = '';
    let lastStatusAt = 0;
    const pending = new Map();

    const fitColumns = (width) => {
        const next = width < 330 ? 'small' : width < 650 ? 'medium' : 'large';
        const columns = columnsByWidth[next];
        if (next !== size) {
            view.setColumns(columns);
            size = next;
        }
        const otherWidth = columns.slice(1).reduce((sum, column) => sum + column.width, 0);
        const nameWidth = Math.max(columns[0].minWidth, width - view.controller.viewport.scrollbarSize - otherWidth);
        if (view.controller.columnModel.getColumn('name').width !== nameWidth)
            view.controller.resizeColumn('name', nameWidth);
    };

    const flush = () => {
        frame = 0;
        view.setDynamicState([...pending.values()]);
        pending.clear();
        const now = Date.now();
        if (now - lastStatusAt >= 1000) {
            status.textContent = `Streaming · ${updates.toLocaleString()} updates · last ${lastUpdate} · ~15s delayed`;
            lastStatusAt = now;
        }
    };

    const connect = () => {
        if (!visible || document.hidden || paused || socket) return;
        status.textContent = 'Connecting to market feed…';
        const current = new WebSocket(feedUrl);
        socket = current;
        current.onopen = () => {
            if (socket !== current) return;
            current.send(JSON.stringify({
                type: 'subscribe',
                symbols: PRODUCTS.map((product) => product.id)
            }));
            status.textContent = 'Connected · waiting for prices…';
        };
        current.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type !== 'snapshot' && message.type !== 'update') return;
            const receivedAt = Date.now();
            for (const [symbol, quote] of Object.entries(message.prices)) {
                if (!productIds.has(symbol)) continue;
                const price = Number(quote.price);
                if (!Number.isFinite(price)) continue;
                pending.set(symbol, {
                    id: symbol,
                    state: {
                        price,
                        change: Number(quote.change24h),
                        volume: Number(quote.volume24h),
                        updatedAt: receivedAt
                    }
                });
                updates++;
            }
            if (pending.size && !frame) {
                lastUpdate = new Date(receivedAt).toLocaleTimeString();
                frame = requestAnimationFrame(flush);
            }
        };
        current.onerror = () => current.close();
        current.onclose = () => {
            if (socket !== current) return;
            socket = null;
            status.textContent = 'Feed disconnected · reconnecting…';
            reconnect = window.setTimeout(connect, 3000);
        };
    };

    const disconnect = () => {
        window.clearTimeout(reconnect);
        reconnect = 0;
        if (socket) {
            const current = socket;
            socket = null;
            current.close();
        }
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        pending.clear();
    };

    const syncConnection = () => {
        if (paused || document.hidden || !visible) {
            disconnect();
            status.textContent = paused ? 'Feed paused' : 'Feed connects when the table is visible';
        } else connect();
    };
    const onToggle = () => {
        paused = !paused;
        toggle.textContent = paused ? 'Resume feed' : 'Pause feed';
        toggle.setAttribute('aria-pressed', String(paused));
        syncConnection();
    };
    const intersection = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        syncConnection();
    });
    intersection.observe(host);
    const resize = new ResizeObserver(([entry]) => fitColumns(Math.floor(entry.contentRect.width)));
    resize.observe(host);
    document.addEventListener('visibilitychange', syncConnection);
    window.addEventListener('pageshow', syncConnection);
    toggle.addEventListener('click', onToggle);

    return {
        view,
        setTheme(theme) {
            view.setTheme(marketThemes[theme]);
        },
        destroy() {
            disconnect();
            intersection.disconnect();
            resize.disconnect();
            document.removeEventListener('visibilitychange', syncConnection);
            window.removeEventListener('pageshow', syncConnection);
            toggle.removeEventListener('click', onToggle);
        }
    };
}
