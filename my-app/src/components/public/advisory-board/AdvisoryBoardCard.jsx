"use client";

import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";

export default function AdvisoryBoardCards({ members, className = "" }) {
  if (!members || members.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
        Advisory board details will appear here once configured.
      </div>
    );
  }

  return (
    <div
      className={
        members.length === 1
          ? `flex justify-center ${className}`
          : `grid gap-6 md:grid-cols-2 xl:grid-cols-3 ${className}`
      }
    >
      {members.map((member, index) => (
        <div
          key={`${member.name || "member"}-${index}`}
          className="w-full max-w-md rounded-3xl bg-white p-6 flex flex-col items-center text-center border border-slate-200 hover:shadow-lg transition-shadow"
        >
          {/* Avatar */}
          <div className="relative mb-3">
            {member.image ? (
              <img
                src={member.image}
                alt={member.name}
                className="w-28 h-28 rounded-full object-cover border-2 border-slate-100"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center border-2 border-slate-100 text-3xl font-black text-slate-400">
                {member.name?.charAt(0)?.toUpperCase() || "A"}
              </div>
            )}
          </div>

          {/* Name */}
          <h3 className="text-lg font-bold text-slate-900 leading-tight">
            {member.name || "Advisory Member"}
          </h3>

          {/* Organisation (like Designation) */}
          {member.organisation && (
            <p className="text-blue-600 font-semibold text-sm mt-1">
              {member.organisation}
            </p>
          )}

          {/* LinkedIn (like Email in EmployeeCard) */}
          {member.socialLinks?.linkedin && (
            <Link
              href={member.socialLinks.linkedin}
              target="_blank"
              rel="noreferrer"
              className="mt-4 text-xs text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 justify-center"
            >
              <BriefcaseBusiness size={14} strokeWidth={2.5} />
              <span>LinkedIn</span>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}