import Script from "next/script";
import type { Rastreamento as R } from "@/db/schema";

/** Google Analytics 4 e Pixel da Meta, quando a loja configurou */
export function Rastreamento({ r }: { r: R }) {
  return (
    <>
      {r.googleAnalytics && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${r.googleAnalytics}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${r.googleAnalytics}');`}
          </Script>
        </>
      )}
      {r.metaPixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${r.metaPixel}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
