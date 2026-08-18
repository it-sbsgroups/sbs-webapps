"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PageBreadcrumb from "@/components/shared/PageBreadcrumb";
import CertificateCarousel from "@/components/public/CertificateCarousel";
import apiClient, { toStaticUrl } from "@/lib/client";

const stripHtml = (html) => {
  if (!html) return "";
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, "").trim();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
};

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/certificates")
      .then((data) => setCertificates(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <PageBreadcrumb pageKey="certificates" title="Certificates" items={[{ label: "Certificates" }]} />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">Credentials</p>
          <h1 className="mt-3 text-3xl md:text-4xl font-black text-slate-900">Our Certificates</h1>
        </div>

        {/* <CertificateCarousel /> */}

        {certificates.length === 0 ? (
          <p className="text-slate-500 mt-8">No certificates uploaded yet.</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((cert) => (
              <Link
                key={cert.id}
                href={`/certificates/${cert.id}`}
                className="group block text-left bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition"
              >
                <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                  <img
                    src={toStaticUrl(cert.imageUrl)}
                    alt={cert.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-base font-bold text-slate-900">{cert.name}</h3>
                  {cert.description && (
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                      {stripHtml(cert.description)}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center text-xs font-black text-blue-700">
                    View details
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}