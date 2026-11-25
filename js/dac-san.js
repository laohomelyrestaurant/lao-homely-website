/* Dac san hom nay: doc/ghi nhanh "specials" tren Firebase, theo ngay (gio Lao). */
(function () {
  var ADMIN_KEY = "homely_admin";
  function today() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function db() {
    if (typeof firebase === "undefined" || !window.HOMELY_FIREBASE_CONFIG) return null;
    if (!firebase.apps.length) firebase.initializeApp(window.HOMELY_FIREBASE_CONFIG);
    return firebase.database();
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function okImg(u) { return typeof u === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(u); }
  function names(it) {
    var lo = it.lo || it.vi || it.en || "", en = it.en || it.vi || it.lo || "", vi = it.vi || it.en || it.lo || "";
    var h = el("h3");
    h.appendChild(el("span", "lang-lo", lo)); h.appendChild(el("span", "lang-en", en)); h.appendChild(el("span", "lang-vi", vi));
    return h;
  }
  function card(it) {
    var c = el("div", "card");
    if (okImg(it.photo)) { var im = el("img", "sp-photo"); im.src = it.photo; im.alt = ""; c.appendChild(im); }
    if (it.lo || it.en || it.vi) c.appendChild(names(it));
    if (it.price) c.appendChild(el("p", "price", it.price));
    return c;
  }
  function list(v) {
    v = v || {};
    return Object.keys(v).map(function (k) { return { key: k, it: v[k] || {} }; })
      .sort(function (a, b) { return (a.it.at || 0) - (b.it.at || 0); });
  }

  var SLOTS = 4; // so o mon dac biet moi ngay
  var EMPTY = [["ລໍຖ້າເມນູພິເສດ", "Chef's surprise, coming soon", "Món mới sắp có"]];
  var CLOCHE = '<svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="15" r="3"/><path d="M10 42a22 22 0 0 1 44 0z"/><path d="M5 47h54"/><path d="M12 52h40"/><path d="M18 37a14 14 0 0 1 9-9"/></svg>';

  function slot(admin) {
    var c = el(admin ? "a" : "div", "sp-empty" + (admin ? " sp-live" : ""));
    var ic = el("div", "sp-ic"); ic.innerHTML = CLOCHE; c.appendChild(ic);
    if (admin) { c.href = "dac-san.html"; c.appendChild(el("b", "", "+ Thêm món")); return c; }
    var t = el("p"), w = EMPTY[0];
    t.appendChild(el("span", "lang-lo", w[0])); t.appendChild(el("span", "lang-en", w[1])); t.appendChild(el("span", "lang-vi", w[2]));
    c.appendChild(t);
    return c;
  }

  /* trang chu: luon du 4 o; o chua co mon hien hinh nap dia. May da mo dac-san.html thay nut them mon */
  function home() {
    var grid = document.getElementById("specials-grid"), d = db(), admin = false;
    if (!grid) return;
    try { admin = localStorage.getItem(ADMIN_KEY) === "1"; } catch (e) {}
    function draw(rows) {
      grid.innerHTML = "";
      rows = rows.slice(0, SLOTS);
      rows.forEach(function (r) { grid.appendChild(card(r.it)); });
      for (var i = rows.length; i < SLOTS; i++) grid.appendChild(slot(admin));
    }
    draw([]);
    var title = document.querySelector("#today-specials h2"), taps = 0, last = 0;
    if (title) title.addEventListener("click", function () {
      var now = Date.now(); taps = now - last < 1500 ? taps + 1 : 1; last = now;
      if (taps >= 5) location.href = "dac-san.html";
    });
    if (d) d.ref("specials/" + today()).on("value", function (s) { draw(list(s.val())); }, function () {});
  }

  /* ve ra JPEG nho, giam dan den khi duoi ~450 KB */
  function draw2(im) {
    var w = im.naturalWidth, h = im.naturalHeight, side = 1000, q = 0.78, u = "";
    if (!w || !h) return null;
    for (var i = 0; i < 5; i++) {
      var k = Math.min(1, side / Math.max(w, h)), cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      var g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(im, 0, 0, cv.width, cv.height);
      u = cv.toDataURL("image/jpeg", q);
      if (u.length < 600000) break;
      side *= 0.8; q -= 0.06;
    }
    return okImg(u) ? u : null;
  }
  function load(blob, ok, fail) {
    var url = URL.createObjectURL(blob), im = new Image();
    im.onload = function () { var u = null; try { u = draw2(im); } catch (e) {} URL.revokeObjectURL(url); u ? ok(u) : fail(); };
    im.onerror = function () { URL.revokeObjectURL(url); fail(); };
    im.src = url;
  }
  /* anh HEIC cua iPhone mo tren may tinh: tai bo chuyen doi khi can */
  function heic(file, ok, fail) {
    function go() { window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 }).then(function (r) { load(Array.isArray(r) ? r[0] : r, ok, fail); }, fail); }
    if (window.heic2any) return go();
    var sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js"; sc.onload = go; sc.onerror = fail;
    document.head.appendChild(sc);
  }
  function shrink(file, cb) {
    load(file, cb, function () {
      if (/hei[cf]/i.test(file.type + " " + file.name)) heic(file, cb, function () { cb(null); });
      else cb(null);
    });
  }

  /* ghi bang HTTPS (khong qua websocket): han 25 giay, thu lai toi da 3 lan, cung khoa nen khong bi trung */
  function save(path, data, tries) {
    var ac = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ac) ac.abort(); }, 25000);
    return fetch(window.HOMELY_FIREBASE_CONFIG.databaseURL + "/" + path + ".json", { method: "PUT", body: JSON.stringify(data), signal: ac ? ac.signal : undefined })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error("máy chủ trả lỗi " + r.status); })
      .catch(function (e) { clearTimeout(t); if (tries > 1) return save(path, data, tries - 1); throw e; });
  }

  function manage() {
    var form = document.getElementById("sp-form"), d = db();
    if (!form) return;
    try { localStorage.setItem(ADMIN_KEY, "1"); } catch (e) {}
    var day = document.getElementById("sp-day"), msg = document.getElementById("sp-msg"), out = document.getElementById("sp-list");
    var prev = document.getElementById("sp-prev"), photo = null, ref = null, count = 0, seq = 0, busy = false;
    var add = form.querySelector("button[type=submit]");
    function say(t) { msg.textContent = t; }
    if (!d) { say("Không kết nối được, kiểm tra mạng."); return; }
    day.value = today();
    function watch() {
      if (ref) ref.off();
      if (!day.value) return;
      var cur = day.value;
      ref = d.ref("specials/" + cur);
      ref.on("value", function (s) {
        out.innerHTML = "";
        var rows = list(s.val());
        count = rows.length; add.disabled = count >= SLOTS;
        document.getElementById("sp-count").textContent = count + "/" + SLOTS + (count >= SLOTS ? " - đã đủ, xóa bớt để thêm món khác" : "");
        if (!rows.length) out.appendChild(el("p", "", "Ngày này chưa có món, 4 ô ở trang chủ để trống."));
        rows.forEach(function (r) {
          var c = card(r.it), b = el("button", "btn btn-outline btn-sm", "Xóa món này");
          b.type = "button";
          b.onclick = function () { if (confirm("Xóa món này?")) d.ref("specials/" + cur + "/" + r.key).remove().catch(function (e) { say("Lỗi: " + e.message); }); };
          c.appendChild(b); out.appendChild(c);
        });
      }, function (e) { say("Lỗi đọc: " + e.message); });
    }
    day.onchange = watch; watch();
    document.getElementById("sp-file").onchange = function () {
      var f = this.files[0]; var my = ++seq; photo = null; prev.hidden = true; if (!f) return; busy = true;
      say("Đang xử lý ảnh...");
      shrink(f, function (u) { if (my !== seq) return; busy = false; if (!u) { say("Không đọc được ảnh này (" + f.name + "). Chọn ảnh JPG, PNG hoặc chụp màn hình ảnh đó rồi chọn lại."); return; } photo = u; prev.src = u; prev.hidden = false; say("✓ Đã có ảnh. Bấm nút + Thêm món để lưu."); });
    };
    form.onsubmit = function (e) {
      e.preventDefault();
      var v = function (id) { return document.getElementById(id).value.trim(); };
      var it = { lo: v("sp-lo"), en: v("sp-en"), vi: v("sp-vi"), price: v("sp-price"), at: Date.now() };
      if (count >= SLOTS) { say("Ngày này đã đủ " + SLOTS + " món."); return; }
      if (busy) { say("Ảnh đang xử lý, chờ vài giây rồi bấm lại."); return; }
      if (!photo) { say("Chưa có ảnh. Bấm ô Chọn ảnh món ở trên."); return; }
      it.photo = photo; say("Đang lưu..."); add.disabled = true;
      var slow = setTimeout(function () { say("Mạng chậm, vẫn đang lưu..."); }, 8000);
      var keep = day.value;
      save("specials/" + keep + "/" + d.ref("specials").push().key, it, 3).then(function () {
        clearTimeout(slow); add.disabled = count >= SLOTS; form.reset(); day.value = keep; photo = null; prev.hidden = true; say("✓ Đã thêm. Trang chủ hiện món này vào ngày " + keep + ".");
      }).catch(function (er) { clearTimeout(slow); add.disabled = false; say("Không lưu được: " + er.message); });
    };
  }
  document.addEventListener("DOMContentLoaded", function () { home(); manage(); });
})();
