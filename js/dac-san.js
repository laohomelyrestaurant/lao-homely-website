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
    c.appendChild(names(it));
    if (it.price) c.appendChild(el("p", "price", it.price));
    return c;
  }
  function list(v) {
    v = v || {};
    return Object.keys(v).map(function (k) { return { key: k, it: v[k] || {} }; })
      .sort(function (a, b) { return (a.it.at || 0) - (b.it.at || 0); });
  }

  /* trang chu: co mon cua hom nay thi thay, khong co thi giu mon mac dinh */
  function home() {
    var grid = document.getElementById("specials-grid"), d = db();
    if (!grid) return;
    var old = Array.prototype.slice.call(grid.children), admin = false;
    try { admin = localStorage.getItem(ADMIN_KEY) === "1"; } catch (e) {}
    function draw(rows) {
      grid.innerHTML = "";
      (rows.length ? rows.map(function (r) { return card(r.it); }) : old).forEach(function (n) { grid.appendChild(n); });
      if (admin) { var a = el("a", "sp-add", "+ Thêm món"); a.href = "dac-san.html"; grid.appendChild(a); }
    }
    draw([]);
    if (d) d.ref("specials/" + today()).on("value", function (s) { draw(list(s.val())); }, function () {});
  }

  function shrink(file, cb) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var k = Math.min(1, 900 / Math.max(im.width, im.height)), cv = document.createElement("canvas");
      cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); cb(cv.toDataURL("image/jpeg", 0.75));
    };
    im.onerror = function () { cb(null); };
    im.src = url;
  }

  function manage() {
    var form = document.getElementById("sp-form"), d = db();
    if (!form) return;
    try { localStorage.setItem(ADMIN_KEY, "1"); } catch (e) {}
    var day = document.getElementById("sp-day"), msg = document.getElementById("sp-msg"), out = document.getElementById("sp-list");
    var prev = document.getElementById("sp-prev"), photo = null, ref = null;
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
        if (!rows.length) out.appendChild(el("p", "", "Ngày này chưa có món, trang chủ hiện món mặc định."));
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
      var f = this.files[0]; photo = null; prev.hidden = true; if (!f) return;
      say("Đang xử lý ảnh...");
      shrink(f, function (u) { if (!u) { say("Không đọc được ảnh này, chọn ảnh khác."); return; } photo = u; prev.src = u; prev.hidden = false; say(""); });
    };
    form.onsubmit = function (e) {
      e.preventDefault();
      var v = function (id) { return document.getElementById(id).value.trim(); };
      var it = { lo: v("sp-lo"), en: v("sp-en"), vi: v("sp-vi"), price: v("sp-price"), at: Date.now() };
      if (!it.lo && !it.en && !it.vi) { say("Nhập ít nhất một tên món."); return; }
      if (!photo) { say("Chọn ảnh món."); return; }
      it.photo = photo; say("Đang lưu...");
      var keep = day.value;
      d.ref("specials/" + keep).push(it).then(function () {
        form.reset(); day.value = keep; photo = null; prev.hidden = true; say("✓ Đã thêm. Trang chủ hiện món này vào ngày " + keep + ".");
      }).catch(function (er) { say("Không lưu được: " + er.message); });
    };
  }
  document.addEventListener("DOMContentLoaded", function () { home(); manage(); });
})();
