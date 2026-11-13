try {
  const { default: init } = await import("./pkg/alice_dioxus_state.js");
  await init();
  document.querySelector("#pilot-boot")?.remove();
} catch {
  document.querySelector("#pilot-boot")?.remove();
  const message = document.createElement("p");
  message.className = "boot-message";
  message.textContent = "No se pudo abrir el piloto WebAssembly. Revisa su compilación y vuelve a cargar esta vista.";
  document.querySelector("#main").replaceChildren(message);
}
