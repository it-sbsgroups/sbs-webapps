"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import PageBreadcrumb from "@/components/shared/PageBreadcrumb";
import apiClient, { toStaticUrl } from "@/lib/client";

export default function CertificateDetailPage() {
  const params = useParams();
  const certificateId = params?.id;
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!certificateId) {
        setLoading(false);
        return;
      }

      try {
        const list = await apiClient.get("/certificates");
        const found = Array.isArray(list)
          ? list.find((item) => String(item.id) === String(certificateId))
          : null;
        setCertificate(found || null);
      } catch (error) {
        console.error("Failed to fetch certificate detail", error);
        setCertificate(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [certificateId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!certificate) {
    notFound();
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <PageBreadcrumb pageKey="certificates" title={certificate.name} items={[{ label: "Certificates", href: "/certificates" }, { label: certificate.name }]} />

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <img
              src={toStaticUrl(certificate.imageUrl)}
              alt={certificate.name}
              className="w-full max-h-[75vh] object-contain bg-slate-100"
            />
          </div>

          <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-700">Certificate</p>
            <h1 className="text-3xl font-black text-slate-900">{certificate.name}</h1>

            {certificate.description ? (
              <div
                className="prose prose-sm max-w-none text-slate-600"
                dangerouslySetInnerHTML={{ __html: certificate.description }}
              />
            ) : (
              <p className="text-slate-500">No description provided for this certificate.</p>
            )}

            <Link
              href="/certificates"
              className="inline-flex items-center rounded-xl bg-blue-950 px-4 py-2 text-sm font-bold text-white hover:bg-blue-900"
            >
              Back to certificates
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
