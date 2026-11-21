// 为无法自行设置 HTTP 响应头的静态托管（如 GitHub Pages）补充跨源隔离所需的响应头。
// 同一个文件既作为页面脚本加载（负责注册 Service Worker），也作为 Service Worker 运行（负责补头）。
// 主机已经发送 COOP/COEP 时（页面本身已隔离），不会注册 Service Worker。

if (typeof window === "undefined") {
    // Service Worker 环境：立即接管页面，并为所有同源响应追加隔离响应头。
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
    self.addEventListener("fetch", (event) => {
        const request = event.request;
        // only-if-cached 请求只允许同源，否则浏览器会直接抛错。
        if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

        event.respondWith(
            fetch(request).then((response) => {
                // 不透明响应（status 0）无法改写，原样返回。
                if (response.status === 0) return response;

                const headers = new Headers(response.headers);
                headers.set("Cross-Origin-Embedder-Policy", "require-corp");
                headers.set("Cross-Origin-Opener-Policy", "same-origin");
                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers
                });
            })
        );
    });
} else if (!window.crossOriginIsolated && window.isSecureContext && "serviceWorker" in navigator) {
    // 页面环境：注册自身为 Service Worker，生效后刷新一次以获得隔离环境。
    navigator.serviceWorker.register(document.currentScript.src).then((registration) => {
        const reloadWhenControlled = () => {
            if (!navigator.serviceWorker.controller) window.location.reload();
        };

        if (registration.active) {
            reloadWhenControlled();
        } else {
            registration.addEventListener("updatefound", () => {
                registration.installing?.addEventListener("statechange", (event) => {
                    if (event.target.state === "activated") reloadWhenControlled();
                });
            });
        }
    }, (error) => console.error("无法注册跨源隔离 Service Worker:", error));
}
