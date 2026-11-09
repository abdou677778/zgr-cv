(function () {
  // Deliberately classic JavaScript: this screen must also work when the module
  // bundle cannot be parsed by an outdated Android System WebView.
  var shell = document.getElementById("zgr-startup");
  var message = document.getElementById("zgr-startup-message");
  var retry = document.getElementById("zgr-startup-retry");
  if (!shell || !message || !retry) return;
  function failed() {
    if (!document.getElementById("zgr-startup")) return;
    message.textContent =
      "Le démarrage n’a pas abouti. Vérifiez Internet et réessayez. Sur Android, mettez aussi à jour Android System WebView et Chrome depuis le Play Store.";
    retry.hidden = false;
  }
  retry.addEventListener("click", function () {
    var url = new URL(window.location.href);
    url.searchParams.set("_zgr_retry", String(Date.now()));
    window.location.replace(url.href);
  });
  window.addEventListener(
    "error",
    function (event) {
      if (!event.target || event.target === window || event.target.tagName === "SCRIPT") failed();
    },
    true,
  );
  window.addEventListener("unhandledrejection", failed);
  window.setTimeout(failed, 20000);
})();
