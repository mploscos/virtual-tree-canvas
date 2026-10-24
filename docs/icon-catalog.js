const search = document.querySelector('#search');
const size = document.querySelector('#size');
const count = document.querySelector('#icon-count');
const icons = [...document.querySelectorAll('#icon-grid article')];

search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const icon of icons) {
        icon.hidden = !icon.dataset.search.includes(query);
        if (!icon.hidden) visible++;
    }
    count.value = `${visible} / ${icons.length} icons`;
});
size.addEventListener('change', () => {
    document.documentElement.style.setProperty('--icon-size', `${size.value}px`);
});
count.value = `${icons.length} icons`;
