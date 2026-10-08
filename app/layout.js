import "./globals.css";

export const metadata = {
  title: "Signal Lab",
  description: "Rule-based technical signal tracker for Gold and Bitcoin. Local-only, no backend.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}

function RegisterSW() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js').catch(function(e) {
                console.log('SW registration failed', e);
              });
            });
          }
        `,
      }}
    />
  );
}
