"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import apiClient, { toStaticUrl } from "@/lib/client";

export default function CertificateCarousel() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiClient
      .get("/certificates")
      .then((data) => {
        if (!active) return;
        setCertificates(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("Failed to fetch certificates for carousel", error);
        if (active) setCertificates([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const repeatedCertificates = useMemo(() => {
    if (!certificates.length) return [];
    if (certificates.length === 1) return certificates;
    return [...certificates, ...certificates];
  }, [certificates]);

  if (loading) return null;
  if (certificates.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white py-6 shadow-sm">
      <div className="mb-5 px-6">
        <h2 className="text-xl font-black uppercase tracking-[0.2em] text-slate-700">Featured credentials</h2>
      </div>

      <div className="relative flex w-full overflow-hidden" suppressHydrationWarning>
        <div className="flex animate-scroll gap-5 px-5" style={{ willChange: "transform" }}>
          {repeatedCertificates.map((certificate, index) => (
            <Link
              key={`${certificate.id}-${index}`}
              href={`/certificates/${certificate.id}`}
              className="group relative block min-w-[260px] max-w-[260px] rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:shadow-md"
            >
              <div className="overflow-hidden rounded-xl bg-white">
                <img
                  src={toStaticUrl(certificate.imageUrl)}
                  alt={certificate.name}
                  className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
              <div className="mt-3">
                <h3 className="line-clamp-2 text-sm font-black text-slate-900">{certificate.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <style jsx>{`
        .animate-scroll {
          animation: scroll 30s linear infinite;
          will-change: transform;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
        @keyframes scroll {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </section>
  );
}
