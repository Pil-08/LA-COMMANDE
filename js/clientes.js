(function () {
if (window.lcc_ok) return;
window.lcc_ok = 1;
document.addEventListener('click', function (ev) {
var el = ev.target;
var card = el && el.closest ? el.closest('.lcc-card') : null;
if (!card) return;
card.classList.remove('is-go');
void card.offsetWidth;
card.classList.add('is-go');
clearTimeout(card.lcc_t);
card.lcc_t = setTimeout(function () { card.classList.remove('is-go'); }, 1700);
}, false);
})();