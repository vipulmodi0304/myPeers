// Apply the saved theme before first paint to avoid a flash of the wrong colours.
try {
  var t = localStorage.getItem("mp-theme");
  if (t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}
