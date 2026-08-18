"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import siteConfigApi from "@/lib/siteConfig/siteConfigApi";
import { uploadImage } from "@/lib/uploadApi";

const inputCls = "w-full text-sm px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-800 font-medium placeholder:font-normal placeholder:text-slate-400 transition-colors";

const defaultMember = () => ({
  name: "",
  organisation: "",
  image: "",
  socialLinks: {
    linkedin: "",
    // facebook: "",
    // instagram: "",
    // x: "",
  },
});

export default function AdvisoryBoardManager() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const fileInputRefs = useRef({});

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

  const save = async () => {
    setSaving(true);
    try {
      const clean = members.map((member) => ({
        ...member,
        name: String(member.name || "").trim(),
        organisation: String(member.organisation || "").trim(),
        image: member.image || "",
        socialLinks: {
          linkedin: member.socialLinks?.linkedin || "",
          // facebook: member.socialLinks?.facebook || "",
          // instagram: member.socialLinks?.instagram || "",
          // x: member.socialLinks?.x || "",
        },
      }));
      await siteConfigApi.saveAdvisoryBoard(clean);
      toast.success("Advisory board saved");
    } catch (error) {
      toast.error(error?.message || "Unable to save advisory board");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file, index) => {
    if (!file) return;
    setUploadingIndex(index);
    try {
      const url = await uploadImage(file, "advisory-board");
      setMembers((prev) => prev.map((member, idx) => idx === index ? { ...member, image: url } : member));
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error?.message || "Image upload failed");
    } finally {
      setUploadingIndex(null);
    }
  };

  const updateMember = (index, updates) => {
    setMembers((prev) => prev.map((member, idx) => idx === index ? { ...member, ...updates } : member));
  };

  const updateSocial = (index, key, value) => {
    setMembers((prev) => prev.map((member, idx) => {
      if (idx !== index) return member;
      return {
        ...member,
        socialLinks: {
          ...(member.socialLinks || {}),
          [key]: value,
        },
      };
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Advisory Board</h2>
          <p className="text-xs text-slate-500">Add members with image, organisation, and social profiles.</p>
        </div>
        <button
          type="button"
          onClick={() => setMembers((prev) => [...prev, defaultMember()])}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-950 px-4 py-2 text-xs font-black text-white"
        >
          <Plus size={14} /> Add member
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
      ) : (
        <div className="space-y-4">
          {members.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No advisory board members yet.
            </div>
          ) : null}

          {members.map((member, index) => (
            <div
              key={`advisory-member-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex justify-between items-start gap-3 mb-4">
                <div className="text-sm font-black text-slate-700">Member #{index + 1}</div>
                <button
                  type="button"
                  onClick={() => setMembers((prev) => prev.filter((_, idx) => idx !== index))}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="space-y-2">
                  <div className="flex items-center justify-center h-40 w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                    {member.image ? (
                      <img src={member.image} alt={member.name || "Member"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center text-xs text-slate-400">No image</div>
                    )}
                  </div>
                  <input
                    ref={(el) => {
                      if (el) fileInputRefs.current[index] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, index);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[index]?.click()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800"
                  >
                    {uploadingIndex === index ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploadingIndex === index ? "Uploading..." : "Upload image"}
                  </button>
                  {member.image && (
                    <button
                      type="button"
                      onClick={() => updateMember(index, { image: "" })}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                    >
                      <X size={14} /> Remove image
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Name</label>
                      <input className={inputCls} value={member.name || ""} onChange={(e) => updateMember(index, { name: e.target.value })} placeholder="Member name" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Organisation</label>
                      <input className={inputCls} value={member.organisation || ""} onChange={(e) => updateMember(index, { organisation: e.target.value })} placeholder="Organisation name" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Social media links</label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input className={inputCls} value={member.socialLinks?.linkedin || ""} onChange={(e) => updateSocial(index, "linkedin", e.target.value)} placeholder="LinkedIn URL" />
                      {/* <input className={inputCls} value={member.socialLinks?.facebook || ""} onChange={(e) => updateSocial(index, "facebook", e.target.value)} placeholder="Facebook URL" />
                      <input className={inputCls} value={member.socialLinks?.instagram || ""} onChange={(e) => updateSocial(index, "instagram", e.target.value)} placeholder="Instagram URL" />
                      <input className={inputCls} value={member.socialLinks?.x || ""} onChange={(e) => updateSocial(index, "x", e.target.value)} placeholder="X / Twitter URL" /> */}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : "Save advisory board"}
        </button>
      </div>
    </div>
  );
}
