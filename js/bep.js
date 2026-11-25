(function () {
  function initFirebaseApp() {
    try {
      if (typeof firebase !== "undefined" && window.HOMELY_FIREBASE_CONFIG && !firebase.apps.length) {
        firebase.initializeApp(window.HOMELY_FIREBASE_CONFIG);
      }
    } catch (e) {}
  }

  function fmtPrice(n) {
    return (n || 0).toLocaleString("en-US").replace(/,/g, ".") + " Lak";
  }

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });
  }

  /* chuong: keu 3 giay/lan khi con don moi chua bam Nhan don */
  var audio = null, ringing = false, MAX_AGE = 24 * 3600e3;
  function beep() {
    if (!audio || !ringing) return;
    [0, 0.25, 0.5].forEach(function (t) {
      var o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 988; g.gain.value = 0.5; o.connect(g); g.connect(audio.destination);
      o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.18);
    });
  }
  setInterval(beep, 3000);

  function keepAwake() {
    if (navigator.wakeLock && document.visibilityState === "visible") navigator.wakeLock.request("screen").catch(function () {});
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function fmtTime(ts) {
    var d = new Date(ts || Date.now());
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function orderCode(key, table) {
    return "B" + table + "-" + String(key).slice(-4).toUpperCase();
  }

  function renderOrderCard(key, order) {
    var card = document.createElement("div");
    card.className = "bep-card" + (order.status === "xong" ? " bep-card-done" : "");
    var itemsHtml = (order.items || []).map(function (it) {
      var name = esc(it.nameLo || it.nameEn || it.nameVi) + (it.nameVi ? "<br><small>" + esc(it.nameVi) + "</small>" : "");
      return '<li><span class="bep-item-qty">x' + esc(it.qty) + '</span> <span class="bep-item-name">' + name + '</span></li>';
    }).join("");
    card.innerHTML =
      '<div class="bep-card-head">' +
        '<span class="bep-card-table">ໂຕະ / BÀN ' + esc(order.table) + '</span>' +
        '<span class="bep-card-time">' + fmtTime(order.createdAt) + '</span>' +
      '</div>' +
      '<div class="bep-card-code">Ma: ' + esc(orderCode(key, order.table)) + '</div>' +
      '<ul class="bep-card-items">' + itemsHtml + '</ul>' +
      '<div class="bep-card-total">Tong: ' + fmtPrice(order.total) + '</div>' +
      (order.status === "xong"
        ? '<div class="bep-card-done-label">Da xong</div>'
        : (order.status === "nhan" ? "" : '<button type="button" class="bep-done-btn bep-take-btn" data-act="nhan" data-key="' + esc(key) + '">ຮັບອໍເດີ / Nhận đơn</button>') +
          '<button type="button" class="bep-done-btn" data-act="xong" data-key="' + esc(key) + '">ສຳເລັດ / Đã xong</button>');
    return card;
  }

  function attachDoneHandlers(container, ordersRef) {
    container.querySelectorAll(".bep-done-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-key");
        btn.disabled = true;
        var act = btn.getAttribute("data-act");
        ordersRef.child(key).update(act === "nhan" ? { status: "nhan", acceptedAt: Date.now() } : { status: "xong", doneAt: Date.now() });
      });
    });
  }

  function initKitchenBoard() {
    initFirebaseApp();
    var statusEl = document.getElementById("bep-status");
    if (typeof firebase === "undefined" || !firebase.apps.length) {
      if (statusEl) statusEl.textContent = "Loi ket noi Firebase";
      return;
    }
    var ordersRef = firebase.database().ref("orders");
    var latest = [];
    /* chi bao "da hien tren man hinh bep" khi bep da bat chuong va dang mo trang */
    function markSeen() {
      if (!audio || document.visibilityState !== "visible") return;
      latest.forEach(function (p) {
        if (!p[1].seenAt && p[1].status === "moi") { p[1].seenAt = Date.now(); ordersRef.child(p[0]).update({ seenAt: p[1].seenAt }); }
      });
    }
    var start = document.getElementById("bep-start");
    if (start) start.addEventListener("click", function () {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
      start.textContent = "🔔 ເປີດສຽງແລ້ວ / Chuông đang bật";
      keepAwake(); markSeen();
      var r = ringing; ringing = true; beep(); ringing = r;
    });
    document.addEventListener("visibilitychange", function () {
      if (audio && document.visibilityState === "visible") { audio.resume(); keepAwake(); markSeen(); }
    });

    var pendingList = document.getElementById("bep-pending-list");
    var doneList = document.getElementById("bep-done-list");
    var pendingCount = document.getElementById("bep-pending-count");
    var doneCount = document.getElementById("bep-done-count");
    var pendingEmpty = document.getElementById("bep-pending-empty");

    ordersRef.on("value", function (snapshot) {
      if (statusEl) statusEl.textContent = "Da ket noi - cap nhat theo thoi gian thuc";
      var val = snapshot.val() || {};
      var pending = [];
      var done = [];
      Object.keys(val).forEach(function (key) {
        var order = val[key];
        if (order.status === "xong") done.push([key, order]);
        else if ((order.createdAt || 0) > Date.now() - MAX_AGE) pending.push([key, order]); // don cu hon 24 gio: an, khong xoa
      });
      pending.sort(function (a, b) { return (a[1].createdAt || 0) - (b[1].createdAt || 0); });
      done.sort(function (a, b) { return (b[1].doneAt || b[1].createdAt || 0) - (a[1].doneAt || a[1].createdAt || 0); });

      ringing = pending.some(function (p) { return p[1].status === "moi"; });
      document.title = (ringing ? "(!) " : "") + "Bang bep";
      latest = pending;
      markSeen();
      beep();
      pendingList.innerHTML = "";
      pending.forEach(function (pair) {
        pendingList.appendChild(renderOrderCard(pair[0], pair[1]));
      });
      attachDoneHandlers(pendingList, ordersRef);
      if (pendingEmpty) pendingEmpty.hidden = pending.length > 0;
      if (pendingCount) pendingCount.textContent = pending.length;

      doneList.innerHTML = "";
      done.slice(0, 20).forEach(function (pair) {
        doneList.appendChild(renderOrderCard(pair[0], pair[1]));
      });
      if (doneCount) doneCount.textContent = done.length;
    }, function (err) {
      if (statusEl) statusEl.textContent = "Loi doc du lieu: " + (err && err.message ? err.message : err);
    });

    var clearBtn = document.getElementById("bep-clear-done-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!window.confirm("Xoa tat ca don da hoan thanh?")) return;
        ordersRef.once("value").then(function (snapshot) {
          var val = snapshot.val() || {};
          var updates = {};
          Object.keys(val).forEach(function (key) {
            if (val[key].status === "xong") updates[key] = null;
          });
          ordersRef.update(updates);
        });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initKitchenBoard);
})();
