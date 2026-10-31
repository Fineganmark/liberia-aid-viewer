/* Single-choice dropdowns on the page become button groups (house rule: one dropdown is a button group).
   Any <select data-seg> stays in the DOM and keeps its value, so the existing code is unchanged.
   The buttons follow the select's options, including options added later by the page scripts. */
(function () {
  'use strict';
  function build(sel) {
    var g = sel.parentNode.querySelector('.seg[data-for="' + sel.id + '"]');
    // more than the limit (six by default, data-seg-max to change) stays a dropdown: a long list of buttons is hard to use
    var max = +(sel.dataset.segMax || 6);
    if (sel.options.length > max) { if (g) g.remove(); sel.hidden = false; return; }
    if (!g) {
      g = document.createElement('span');
      g.className = 'seg seg-wrap';
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', sel.getAttribute('aria-label') || 'Choose');
      g.dataset.for = sel.id;
      sel.insertAdjacentElement('afterend', g);
    }
    sel.hidden = true;
    g.textContent = '';
    Array.prototype.forEach.call(sel.options, function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.textContent;
      b.dataset.v = o.value;
      b.setAttribute('aria-pressed', String(o.value === sel.value));
      b.addEventListener('click', function () {
        if (sel.value !== o.value) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        sync(sel);
      });
      g.appendChild(b);
    });
  }
  function sync(sel) {
    var g = sel.parentNode.querySelector('.seg[data-for="' + sel.id + '"]');
    if (!g) return;
    Array.prototype.forEach.call(g.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === sel.value)); });
  }
  function init() {
    document.querySelectorAll('select[data-seg]').forEach(function (sel) {
      build(sel);
      sel.addEventListener('change', function () { sync(sel); });
      new MutationObserver(function () { build(sel); }).observe(sel, { childList: true });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
