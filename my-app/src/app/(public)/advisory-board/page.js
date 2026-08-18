// app/advisory-board/page.tsx (ya wherever your page is)
"use client";

import { useEffect, useState } from "react";
import siteConfigApi from "@/lib/siteConfig/siteConfigApi";
import PageBreadcrumb from "@/components/shared/PageBreadcrumb";
import AdvisoryBoardCards from "@/components/public/advisory-board/AdvisoryBoardCard";

export default function AdvisoryBoardPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    siteConfigApi
      .getAdvisoryBoard()
      .then((data) => {
        if (!active) return;
        setMembers(Array.isArray(data) ? data : []);
      })
      .catch(() => setMembers([]))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="bg-slate-50 min-h-screen">
      <PageBreadcrumb pageKey="advisoryBoard" title="Advisory Board" items={[{ label: "Advisory Board" }]} />

      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-10 text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-700">Leadership</p>
          <h1 className="mt-3 text-3xl font-black text-slate-900 md:text-5xl">Advisory Board</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : (
          <AdvisoryBoardCards members={members} />
        )}
      </div>
    </div>
  );
}