/* Single-choice dropdowns on the page become button groups (house rule: one dropdown is a button group).
   Any <select data-seg> stays in the DOM and keeps its value, so the existing code is unchanged.
   The buttons follow the select's options, including options added later by the page scripts.
   With data-seg-group, the options sit in <optgroup>s: one row of group buttons, then only the buttons of the
   group that holds the current choice. */
(function () {
  'use strict';
  var state = {};

  function holder(sel) { return sel.parentNode.querySelector('.seg[data-for="' + sel.id + '"]'); }

  function pill(label, value, pressed, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.v = value;
    b.setAttribute('aria-pressed', String(pressed));
    b.addEventListener('click', onClick);
    return b;
  }

  function choose(sel, value) {
    if (sel.value !== value) { sel.value = value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    build(sel);
  }

  function build(sel) {
    var g = holder(sel);
    if (!g) {
      g = document.createElement('span');
      g.className = 'seg seg-wrap';
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', sel.getAttribute('aria-label') || 'Choose');
      g.dataset.for = sel.id;
      sel.insertAdjacentElement('afterend', g);
    }
    // more than the limit (six by default, data-seg-max to change) stays a dropdown
    var max = +(sel.dataset.segMax || 6);
    if (sel.options.length > max) { g.remove(); sel.hidden = false; return; }
    sel.hidden = true;
    g.textContent = '';

    if (sel.dataset.segGroup !== undefined && sel.querySelector('optgroup')) {
      var groups = Array.prototype.slice.call(sel.querySelectorAll('optgroup'));
      var cur = sel.value;
      var curGroup = groups.filter(function (og) { return Array.prototype.some.call(og.querySelectorAll('option'), function (o) { return o.value === cur; }); })[0] || groups[0];
      var row = document.createElement('span');
      row.className = 'seg-row seg-groups';
      groups.forEach(function (og) {
        row.appendChild(pill(og.label, og.label, og === curGroup, function () {
          var first = og.querySelector('option');
          var keep = Array.prototype.some.call(og.querySelectorAll('option'), function (o) { return o.value === sel.value; });
          choose(sel, keep ? sel.value : first.value);
        }));
      });
      g.appendChild(row);
      var row2 = document.createElement('span');
      row2.className = 'seg-row seg-items';
      Array.prototype.forEach.call(curGroup.querySelectorAll('option'), function (o) {
        row2.appendChild(pill(o.textContent, o.value, o.value === sel.value, function () { choose(sel, o.value); }));
      });
      g.appendChild(row2);
      return;
    }

    Array.prototype.forEach.call(sel.options, function (o) {
      g.appendChild(pill(o.textContent, o.value, o.value === sel.value, function () { choose(sel, o.value); }));
    });
  }

  function init() {
    document.querySelectorAll('select[data-seg]').forEach(function (sel) {
      build(sel);
      sel.addEventListener('change', function () { build(sel); });
      new MutationObserver(function () { build(sel); }).observe(sel, { childList: true, subtree: true });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
