/* Liberia aid data viewer: register / sign-in (Firebase Authentication, email and password).
   Same Firebase project, and so the same accounts, as the Irish Aid data viewer.
   Signed out, visitors see the header, the Overview and About the data. Donors, Sectors, Channels, Projects and
   the IATI section need an account with a confirmed email address.
   Project settings live in auth-config.js. Users are managed in the Firebase console (Authentication › Users). */
(function () {
  var cfg = window.IA_AUTH || {};
  var html = document.documentElement;
  var root = document.getElementById('root');
  var LOCKED = [['donors', 'every donor, its sectors and projects'], ['sectors', 'the sector breakdown'], ['channels', 'how the aid is delivered'], ['grants', 'the project search'], ['iati', 'the latest IATI figures'], ['ireland', 'the map of Ireland\'s projects']];
  html.classList.add('ia-guest');

  // ---- the sign-in dialog ----
  var gate = document.createElement('div');
  gate.id = 'ia-gate'; gate.hidden = true;
  gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-modal', 'true'); gate.setAttribute('aria-labelledby', 'ig-title');
  gate.innerHTML =
    '<div class="ig-card">' +
    '<button type="button" class="ig-close" id="ig-close" aria-label="Close and go back to the overview">×</button>' +
    '<h1 class="ig-title" id="ig-title">Liberia Assistance data viewer</h1>' +
    '<p class="ig-lead" id="ig-lead"></p>' +
    '<div class="ig-tabs" role="tablist" id="ig-tabs">' +
    '<button type="button" role="tab" data-mode="signin" aria-selected="true">Sign in</button>' +
    '<button type="button" role="tab" data-mode="register" aria-selected="false">Register</button></div>' +
    '<form id="ig-form" novalidate>' +
    '<label>Email<input type="email" id="ig-email" autocomplete="email" required></label>' +
    '<label>Password<input type="password" id="ig-pass" autocomplete="current-password" minlength="8" required></label>' +
    '<label id="ig-pass2-l" hidden>Confirm password<input type="password" id="ig-pass2" autocomplete="new-password" minlength="8"></label>' +
    '<button type="submit" class="ig-go" id="ig-go">Sign in</button>' +
    '<button type="button" class="ig-link" id="ig-forgot">Forgot your password?</button>' +
    '</form>' +
    '<div id="ig-verify" hidden>' +
    '<p>We\'ve sent a link to <b id="ig-vemail"></b>. Open it to confirm your email address, then come back here.</p>' +
    '<button type="button" class="ig-go" id="ig-checked">I\'ve confirmed my email</button>' +
    '<button type="button" class="ig-link" id="ig-resend">Send the link again</button>' +
    '<button type="button" class="ig-link" id="ig-out2">Use a different email</button>' +
    '</div>' +
    '<p class="ig-msg" id="ig-msg" role="status"></p>' +
    '<p class="ig-note">The overview is open to everyone. An account gives access to the donor, sector, channel and project views. Accounts are shared with the Irish Aid data viewer.</p>' +
    '</div>';
  document.body.appendChild(gate);

  var $ = function (id) { return document.getElementById(id); };
  var mode = 'signin', auth = null, lastFocus = null;
  var say = function (t) { $('ig-msg').textContent = t || ''; };
  var setMode = function (m) {
    mode = m; say('');
    [].forEach.call($('ig-tabs').children, function (b) { b.setAttribute('aria-selected', String(b.dataset.mode === m)); });
    $('ig-pass2-l').hidden = m !== 'register';
    $('ig-pass').setAttribute('autocomplete', m === 'register' ? 'new-password' : 'current-password');
    $('ig-go').textContent = m === 'register' ? 'Register' : 'Sign in';
    $('ig-forgot').hidden = m === 'register';
    $('ig-lead').textContent = m === 'register' ? 'Create an account with your email and a password of at least 8 characters.' : 'Sign in to see donor, sector and project detail. Your Irish Aid data viewer account works here too.';
  };
  [].forEach.call($('ig-tabs').children, function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
  var panel = function (which) { // 'form' | 'verify' | 'none'
    $('ig-tabs').hidden = which !== 'form'; $('ig-form').hidden = which !== 'form'; $('ig-verify').hidden = which !== 'verify';
  };
  var openGate = function (m) {
    if (gate.hidden) lastFocus = document.activeElement;
    var u = auth && auth.currentUser;
    if (!auth) { panel('none'); $('ig-lead').textContent = 'Sign-in is not set up yet.'; }
    else if (u && !u.emailVerified) { panel('verify'); $('ig-vemail').textContent = u.email; $('ig-lead').textContent = 'One more step: confirm your email address.'; }
    else { panel('form'); setMode(m || mode); }
    gate.hidden = false; html.classList.add('ig-open');
    var f = gate.querySelector(auth && !(u && !u.emailVerified) ? '#ig-email' : '#ig-close'); if (f) f.focus();
  };
  var closeGate = function () {
    gate.hidden = true; html.classList.remove('ig-open'); say('');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };
  $('ig-close').addEventListener('click', closeGate);
  gate.addEventListener('click', function (ev) { if (ev.target === gate) closeGate(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !gate.hidden) closeGate(); });

  // ---- what a signed-out visitor sees in place of the locked sections ----
  LOCKED.forEach(function (l) {
    var sec = document.getElementById(l[0]); if (!sec) return;
    var card = document.createElement('div');
    card.className = 'ig-lockcard';
    card.innerHTML = '<p><b>Sign in to see ' + l[1] + '.</b> Registering is free and only needs an email address.</p>' +
      '<div class="ig-lockbtns"><button type="button" class="ig-go" data-open="signin">Sign in</button><button type="button" class="ig-ghost" data-open="register">Register</button></div>';
    var head = sec.querySelector('summary'); // under the section's heading
    sec.insertBefore(card, head ? head.nextSibling : sec.firstChild);
  });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-open]');
    if (b && b.closest('.ig-lockcard, .mast')) { ev.preventDefault(); openGate(b.dataset.open); }
  });

  // masthead: "Sign in" when signed out, "Sign out" when signed in
  var links = root && root.querySelector('.mast .links');
  var acct = document.createElement('a');
  acct.href = '#'; acct.id = 'ig-acct';
  if (links) links.appendChild(acct);
  var setAcct = function (user) {
    if (user && user.emailVerified) { acct.textContent = 'Sign out'; acct.title = 'Signed in as ' + user.email; acct.removeAttribute('data-open'); }
    else { acct.textContent = 'Sign in'; acct.title = ''; acct.setAttribute('data-open', 'signin'); }
  };
  acct.addEventListener('click', function (ev) {
    if (acct.hasAttribute('data-open')) return; // opens the dialog (handler above)
    ev.preventDefault(); ev.stopPropagation(); mode = 'signin'; auth.signOut();
  });

  var member = function (user) {
    html.classList.remove('ia-guest'); setAcct(user);
    if (!gate.hidden) closeGate();
    window.dispatchEvent(new Event('resize'));
  };
  var guest = function () {
    html.classList.add('ia-guest'); setAcct(null);
    window.dispatchEvent(new Event('lbr-guest'));
  };

  guest();
  if (!cfg.apiKey || !window.firebase) return;
  firebase.initializeApp(cfg);
  auth = firebase.auth();

  var errText = function (e) {
    var c = (e && e.code) || '';
    if (c === 'auth/invalid-email') return 'That email address doesn\'t look right.';
    if (c === 'auth/email-already-in-use') return 'There is already an account with that email. Use Sign in instead.';
    if (c === 'auth/weak-password') return 'Please choose a password of at least 8 characters.';
    if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials') return 'The email or password is wrong.';
    if (c === 'auth/user-disabled') return 'This account has been switched off.';
    if (c === 'auth/too-many-requests') return 'Too many attempts. Please wait a few minutes and try again.';
    if (c === 'auth/network-request-failed') return 'You seem to be offline. Please check your connection.';
    return 'Something went wrong (' + (c || 'unknown') + '). Please try again.';
  };

  auth.onAuthStateChanged(function (user) {
    if (user && user.emailVerified) return member(user);
    guest();
    if (!gate.hidden) openGate(); // e.g. just registered: show the confirm-your-email step
  });

  $('ig-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = $('ig-email').value.trim(), pass = $('ig-pass').value;
    if (!email || !pass) return say('Please enter your email and password.');
    if (mode === 'register') {
      if (pass.length < 8) return say('Please choose a password of at least 8 characters.');
      if (pass !== $('ig-pass2').value) return say('The two passwords don\'t match.');
      say('Creating your account…');
      auth.createUserWithEmailAndPassword(email, pass)
        .then(function (c) { return c.user.sendEmailVerification(); })
        .then(function () { say(''); openGate(); })
        .catch(function (e) { say(errText(e)); });
    } else {
      say('Signing in…');
      auth.signInWithEmailAndPassword(email, pass).then(function () { say(''); }).catch(function (e) { say(errText(e)); });
    }
  });
  $('ig-forgot').addEventListener('click', function () {
    var email = $('ig-email').value.trim();
    if (!email) { say('Type your email above first, then press "Forgot your password?" again.'); $('ig-email').focus(); return; }
    auth.sendPasswordResetEmail(email)
      .then(function () { say('If there is an account for ' + email + ', a link to reset the password is on its way.'); })
      .catch(function (e) { say(errText(e)); });
  });
  $('ig-checked').addEventListener('click', function () {
    var u = auth.currentUser; if (!u) return;
    say('Checking…');
    u.reload().then(function () {
      if (auth.currentUser.emailVerified) { say(''); member(auth.currentUser); }
      else say('Your email isn\'t confirmed yet. Open the link in the email we sent (check spam too).');
    }).catch(function (e) { say(errText(e)); });
  });
  $('ig-resend').addEventListener('click', function () {
    var u = auth.currentUser; if (!u) return;
    u.sendEmailVerification().then(function () { say('Sent again. Check your inbox and spam folder.'); }).catch(function (e) { say(errText(e)); });
  });
  $('ig-out2').addEventListener('click', function () { mode = 'signin'; auth.signOut(); });
})();
