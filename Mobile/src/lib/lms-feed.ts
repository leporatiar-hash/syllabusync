// Finds the signed-in student's own calendar feed link from inside their LMS session, so they
// never have to hunt for "Subscribe" and copy anything. Runs as injected JS in our WebView and
// reports back with window.ReactNativeWebView.postMessage. Only reads the student's own read-only
// feed (the same link the LMS shows under Subscribe); nothing is changed in the LMS. It never
// touches the sign-in form or password fields, and only the feed link leaves the phone.

export type FeedMessage =
  | { type: 'feed'; url: string; source: string; tried: string[] }
  | { type: 'miss'; tried: string[]; path: string; calendar?: string | null }
  | { type: 'page'; path: string; signedIn: boolean }
  | { type: 'ready' };

const COMMON = `
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  // SSO pages finish "loading" before their form is drawn. Tell the app once there's something to use.
  (function () {
    var n = 0;
    var t = setInterval(function () {
      n++;
      var els = document.querySelectorAll('input:not([type=hidden]), button, [role=button]');
      var visible = false;
      for (var i = 0; i < els.length && !visible; i++) { var r = els[i].getBoundingClientRect(); visible = r.width > 0 && r.height > 0; }
      if (visible || n > 40) { clearInterval(t); post({ type: 'ready' }); }
    }, 150);
  })();
  var RX = /(?:https?|webcal):\\/\\/[^"'\\s<>]*?\\.ics(?:\\?[^"'\\s<>]*)?/i;
  var clean = function (s) { return s.replace(/&amp;/g, '&').replace(/\\\\u0026/g, '&').replace(/\\\\\\//g, '/'); };
  var find = function (text) { if (!text) return null; var m = clean(text).match(RX); return m ? m[0] : null; };
  // Fallback: if the student opens Subscribe themselves, grab the link the moment it renders.
  // Only runs after sign-in, and never reads password fields: just text boxes that could hold a link.
  var watchInputs = function (tried) {
    var n = 0;
    var t = setInterval(function () {
      n++;
      var els = document.querySelectorAll('input[type=text], input[type=url], input:not([type]), textarea');
      for (var i = 0; i < els.length; i++) {
        var u = find(els[i].value || '');
        if (u) { clearInterval(t); post({ type: 'feed', url: u, source: 'subscribe-dialog', tried: tried }); return; }
      }
      if (n > 240) clearInterval(t);
    }, 500);
  };
`;

/** D2L Brightspace (OAKS). Uses XHR (some D2L pages wrap window.fetch) and discovers the org unit
 *  id from the signed-in page instead of guessing it. */
export const D2L_SCRIPT = `(function () {
  ${COMMON}
  if (window.__cmFeedRun) return;
  var get = function (url) {
    return new Promise(function (resolve) {
      try {
        var x = new XMLHttpRequest();
        x.open('GET', url, true);
        x.withCredentials = true;
        x.onload = function () { resolve({ status: x.status, text: x.responseText || '', url: x.responseURL || url }); };
        x.onerror = function () { resolve({ status: 0, text: '', err: 'network' }); };
        x.send();
      } catch (e) { resolve({ status: 0, text: '', err: String(e && e.message || e) }); }
    });
  };
  // /d2l/home also serves a tiny redirect stub before SSO, so the path alone doesn't mean signed in.
  // Ask D2L who we are; only a 200 from whoami counts.
  var attempts = 0;
  var check = async function () {
    attempts++;
    var path = location.pathname;
    if (!/\\/d2l\\//.test(path) || /login|\\/auth\\/|\\/error\\//i.test(path) || document.readyState !== 'complete') {
      post({ type: 'page', path: path, signedIn: false });
      if (attempts < 40) setTimeout(check, 1500);
      return;
    }
    var who = await get('/d2l/api/lp/1.0/users/whoami');
    if (who.status !== 200) {
      post({ type: 'page', path: path, signedIn: false });
      if (attempts < 40) setTimeout(check, 1500);
      return;
    }
    if (window.__cmFeedRun) return;
    window.__cmFeedRun = true;
    post({ type: 'page', path: path, signedIn: true });
    run(path);
  };
  var run = async function (path) {
    var tried = ['whoami#200'];
    var html = document.documentElement.outerHTML;
    var url = find(html); tried.push('page:' + (url ? 'hit' : 'miss'));
    var ous = [];
    var add = function (v) { if (v && ous.indexOf(String(v)) < 0) ous.push(String(v)); };
    var info = await get('/d2l/api/lp/1.0/organization/info');
    tried.push('orginfo#' + info.status + (info.err ? ':' + info.err : ''));
    try { if (info.status === 200) add(JSON.parse(info.text).Identifier); } catch (e) {}
    [/\\/d2l\\/le\\/calendar\\/(\\d+)/, /\\/d2l\\/home\\/(\\d+)/, /[?&]ou=(\\d+)/, /"OrgUnitId"\\s*:\\s*"?(\\d+)/i, /data-org-unit-id="(\\d+)"/].forEach(function (rx) {
      var m = html.match(rx); if (m) add(m[1]);
    });
    tried.push('ous=' + ous.join(','));
    for (var a = 0; a < ous.length && !url; a++) {
      var o = ous[a];
      var paths = [
        '/d2l/le/calendar/' + o + '/subscribe/subscribeDialogLaunch?subscriptionOptionId=-1',
        '/d2l/le/calendar/' + o + '/subscribe/subscribeDialog?subscriptionOptionId=-1',
        '/d2l/le/calendar/' + o,
      ];
      for (var b = 0; b < paths.length && !url; b++) {
        var r = await get(paths[b]);
        url = find(r.text);
        var snip = url ? '' : (r.text.match(/subscri[^<"']{0,60}/i) || [''])[0].slice(0, 60);
        tried.push(paths[b].replace(/\\?.*/, '') + '#' + r.status + (r.err ? ':' + r.err : '') + ':' + (url ? 'hit' : 'miss') + (snip ? ' [' + snip + ']' : ''));
      }
    }
    var calendar = ous.length ? '/d2l/le/calendar/' + ous[0] : null;
    if (url) post({ type: 'feed', url: url, source: 'auto', tried: tried });
    else { post({ type: 'miss', tried: tried, path: path, calendar: calendar }); watchInputs(tried); }
  };
  check();
})(); true;`;

/** Canvas: the profile API returns the student's calendar feed URL. */
export const CANVAS_SCRIPT = `(function () {
  ${COMMON}
  var path = location.pathname;
  var signedIn = !/login|saml|sso|auth/i.test(path) && /instructure|canvas/i.test(location.host + path) ;
  post({ type: 'page', path: path, signedIn: signedIn });
  if (window.__cmFeedRun) return;
  (async function () {
    var tried = [];
    try {
      var r = await fetch('/api/v1/users/self/profile', { credentials: 'include', headers: { Accept: 'application/json' } });
      tried.push('profile:' + r.status);
      if (r.ok) {
        var j = JSON.parse((await r.text()).replace(/^while\\(1\\);/, ''));
        if (j && j.calendar && j.calendar.ics) { window.__cmFeedRun = true; post({ type: 'feed', url: j.calendar.ics, source: 'auto', tried: tried }); return; }
      }
    } catch (e) { tried.push('profile:err'); }
    if (signedIn) { post({ type: 'miss', tried: tried, path: path }); watchInputs(tried); }
  })();
})(); true;`;

/** Strip the secret token before anything is logged. */
export const redactFeed = (u: string) => u.replace(/(token|user_)[=_][^&]+/gi, '$1=…');
