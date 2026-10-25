// Service worker do Elo: só recebe notificações push e abre o app ao tocar nelas. Não guarda páginas em cache e não
// faz o site funcionar sem internet.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

function caminhoInterno(href) {
  return typeof href === "string" && /^\/(?!\/)[^\s\\]*$/.test(href) ? href : "/calendario";
}

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = {};
  }
  const href = caminhoInterno(dados.href);
  evento.waitUntil(
    self.registration.showNotification(typeof dados.titulo === "string" && dados.titulo ? dados.titulo : "Lembrete", {
      body: typeof dados.texto === "string" ? dados.texto : "",
      icon: "/icones/192",
      badge: "/icones/192",
      tag: href,
      data: { href },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(caminhoInterno(evento.notification.data && evento.notification.data.href), self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && "navigate" in janela) {
          return janela.focus().then(() => janela.navigate(destino));
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
