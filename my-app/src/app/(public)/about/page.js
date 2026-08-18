"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import siteConfigApi from "@/lib/siteConfig/siteConfigApi";
import apiClient from "@/lib/client";
import clientsApi from "@/lib/clientsApi";
import PageBreadcrumb from "@/components/shared/PageBreadcrumb";
import RichTextRenderer from "@/components/shared/RichTextRenderer";
import * as Icons from "lucide-react";
import FounderSimple from "@/components/public/FounderSimple";
import OurJourney from "@/components/public/OurJourney";
import SafetyHelmet from "@/components/icons/SafetyHelmet";
import LazySection from "@/components/shared/LazySection";
import EmployeesShowcase from "@/components/shared/EmployeesShowcase";
import AdvisoryBoardCards from "@/components/public/advisory-board/AdvisoryBoardCard";
import CoreValues from "@/components/public/CoreValues";
import ProtectionProven from "@/components/public/ProtectionProven";

// ─── Page Settings ──────────────────────────────────────────────────────────
const pageSettings = {
  logoSize: "w-24 h-24",
  logoFit: "object-contain",
  logoBg: "bg-white",
  cardHoverEffect: true,
  cardShadow: "shadow-sm hover:shadow-2xl",
  cardTransition: "transition-all duration-300",
  cardHoverTransform: "hover:-translate-y-1 hover:scale-[1.02]",
  cardBorder: "border-slate-200/80 hover:border-blue-900/40",
  gridCols: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  gap: "gap-5 md:gap-6",
  showCoreValues: true,
  showProtectionProven: true,
};

// ─── Constants ──────────────────────────────────────────────────────────────
const YEARS_SINCE = 2005;
const COMPANY_NAME = "SBS Groups";
const TAGLINE = "Engineered for Trust. Built for Industry.";

// ─── Section Heading Component ─────────────────────────────────────────────
function SectionHeading({ title, highlight }) {
  return (
    <h1 className="text-5xl font-bold text-blue-950 text-center">
      {title} <span className="text-lime-600">{highlight}</span>
    </h1>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────
function SectionSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto" />
      <div className="h-24 bg-slate-100 rounded-2xl" />
    </div>
  );
}

// ─── Vision/Mission Card ──────────────────────────────────────────────────
function VisionMissionCard({ icon, title, children }) {
  return (
    <div className="bg-white rounded-lg shadow-[0_18px_45px_rgba(0,0,0,0.12)] p-10 lg:p-12 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-10">
        <div className="w-full lg:w-72 flex flex-col justify-center items-center text-center border-b lg:border-b-0 lg:border-r border-gray-200 pb-8 lg:pb-0 lg:pr-8">
          {icon}
          <h2 className="mt-6 text-[42px] leading-none font-black uppercase tracking-tight text-blue-950">
            {title}
          </h2>
        </div>
        <div className="flex-1 flex flex-col justify-center space-y-6 text-[17px] text-gray-700 leading-8">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Fallback Vision/Mission Data ──────────────────────────────────────────
const DEFAULT_VISION_MISSION = [
  {
    type: "vision",
    icon: "Eye",
    iconSize: 90,
    iconColor: "#557b00",
    title: "Our Vision",
    description:
      "<p>Quality product with prompt service is our principle. We initiated to serve towards the growing concern for safety needs in the present industrial scenario at the power capital of India.</p>",
  },
  {
    type: "mission",
    icon: "Goal",
    iconSize: 90,
    iconColor: "#557b00",
    title: "Our Mission",
    description:
      "<p>To deliver quality industrial products and prompt service, creating value not just commercially but also by respecting and fulfilling our commitments to customers, partners, and stakeholders.</p>",
  },
];

// ─── Main Page Component ──────────────────────────────────────────────────
export default function PublicAboutPage() {
  const [branding, setBranding] = useState({});
  const [about, setAbout] = useState({});
  const [founders, setFounders] = useState({});
  const [loading, setLoading] = useState(true);

  // Advisory Board
  const [advisoryMembers, setAdvisoryMembers] = useState([]);
  const [advisoryLoading, setAdvisoryLoading] = useState(true);

  // Live stats
  const yearsOfExperience = new Date().getFullYear() - YEARS_SINCE;
  const [stats, setStats] = useState({ brands: 0, products: 0, clients: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Fetch Stats ──────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      apiClient.get("/brands/public/list").then((r) => (Array.isArray(r) ? r : r?.data ?? [])).catch(() => []),
      apiClient.get("/products", { page: 1, pageSize: 1, isActive: "true" }).then((r) => r?.meta?.total ?? 0).catch(() => 0),
      clientsApi.getPublic(),
    ])
      .then(([brandsList, productsTotal, clientsList]) => {
        setStats({
          brands: Array.isArray(brandsList) ? brandsList.length : 0,
          products: productsTotal || 0,
          clients: Array.isArray(clientsList) ? clientsList.length : 0,
        });
      })
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, []);

  // ── Fetch Page Content ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      siteConfigApi.getBranding(),
      siteConfigApi.getAbout(),
      siteConfigApi.getFounders(),
      siteConfigApi.getAdvisoryBoard(),
    ])
      .then(([b, a, f, advisory]) => {
        setBranding(b || {});
        setAbout(a || {});
        setFounders(f || {});
        setAdvisoryMembers(Array.isArray(advisory) ? advisory : []);
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setAdvisoryLoading(false);
      });
  }, []);

  const companyName = branding.companyName || COMPANY_NAME;
  const tagline = branding.tagline || TAGLINE;
  const visionMission = about?.visionMission || [];

  return (
    <div className="bg-white min-h-screen font-sans text-slate-800 antialiased">
      <PageBreadcrumb pageKey="about" title="About Us" items={[{ label: "About Us" }]} />

      {/* ─── Hero Story Section ─────────────────────────────────────────────── */}
      <section id="story" className="relative overflow-hidden bg-white py-24">
        {/* Decorative elements (unchanged) */}
        <svg className="absolute left-6 top-16 w-20 opacity-70 hidden lg:block" viewBox="0 0 120 120" fill="none">
          {[...Array(10)].map((_, row) =>
            [...Array(6)].map((_, col) => (
              <circle key={`${row}-${col}`} cx={12 + col * 18} cy={12 + row * 18} r="2.8" fill="#EF4444" />
            ))
          )}
        </svg>
        <div className="absolute right-10 top-12 w-36 opacity-90 hidden lg:block inline-block rotate-33">
          <SafetyHelmet size={144} color="#ffd500" stroke="#d4b500" strokeWidth={3} />
        </div>
        <svg className="absolute left-6 top-72 w-10 opacity-30 hidden lg:block" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" stroke="#ef4444" strokeWidth="3" fill="none" />
        </svg>
        <svg className="absolute left-0 bottom-36 w-16 opacity-20 hidden lg:block" viewBox="0 0 100 100">
          <polygon points="10,90 60,10 90,95" stroke="#ef4444" strokeWidth="3" fill="none" />
        </svg>
        <svg className="absolute right-8 bottom-28 w-32 opacity-20 hidden lg:block" viewBox="0 0 200 180">
          <polygon points="100,10 190,160 20,130" stroke="#ef4444" strokeWidth="3" fill="none" />
        </svg>

        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div>
              <h2 className="mt-6 text-4xl md:text-5xl font-black Capitalize text-blue-950 leading-tight">About Us</h2>
              <div className="mt-8 h-1 w-24 rounded-full bg-[#557b00]" />
              {loading ? (
                <SectionSkeleton />
              ) : about.richContent ? (
                <div className="max-w-3xl mx-auto text-center space-y-4">
                  <div
                    className="prose prose-slate prose-sm md:prose-base mx-auto text-left prose-headings:font-black prose-headings:text-slate-900 prose-a:text-blue-700"
                    dangerouslySetInnerHTML={{ __html: about.richContent }}
                  />
                </div>
              ) : null}
              <div className="mt-12 flex items-center gap-6">
                <div>
                  <p className="text-[#557b00] font-bold uppercase tracking-wider">Since</p>
                  <h3 className="text-6xl font-black text-blue-950">2005</h3>
                </div>
                <div className="h-20 w-px bg-gray-300" />
                <p className="text-gray-600 leading-7">
                  Proudly serving industries with innovative safety products, reliable support, and uncompromising quality
                  standards.
                </p>
              </div>
            </div>

            {/* Right Image */}
            <div className="relative">
              <div className="absolute -left-5 -top-5 h-full w-full border-2 border-red-500 rounded-xl" />
              <div className="relative overflow-hidden rounded-xl shadow-2xl">
                <img
                  src="https://res.cloudinary.com/dhrnoojwo/image/upload/v1786091367/ChatGPT_Image_Aug_7_2026_01_58_44_PM_yzsnwd.png"
                  alt="About Us"
                  className="h-[600px] w-full object-fill filter transition duration-700 hover:scale-105 brightness-90 hover:brightness-100"
                />
              </div>
              <div className="absolute -bottom-8 left-8 rounded-xl bg-white p-6 shadow-2xl border">
                <h3 className="text-3xl font-black text-red-600">{yearsOfExperience}+</h3>
                <p className="text-gray-600">Years of Excellence</p>
              </div>
              <svg className="absolute -left-10 bottom-12 w-20 opacity-70" viewBox="0 0 120 120">
                {[...Array(7)].map((_, row) =>
                  [...Array(6)].map((_, col) => (
                    <circle key={`${row}${col}`} cx={12 + col * 18} cy={12 + row * 18} r="2.5" fill="#000" />
                  ))
                )}
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Mission Hero ───────────────────────────────────────────────────── */}
      <div id="mission" className="relative text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-[1] brightness-90"
          style={{
            backgroundImage:
              "url('https://res.cloudinary.com/dhrnoojwo/image/upload/v1786091523/ChatGPT_Image_Aug_6_2026_06_37_17_PM_ljm7ua.png')",
          }}
        />
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-28 text-center space-y-5 relative">
          <span className="text-[15px] font-black text-white bg-[#557b00] border border-lime-400/30 px-3 py-1 rounded-full uppercase tracking-widest">
            About {companyName}
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight max-w-3xl mx-auto">{tagline}</h1>
          <p className="text-sm md:text-base text-white font-medium max-w-xl mx-auto">
            Every product we supply, every partnership we build, is held to one standard — reliability our clients can
            plan their operations around.
          </p>
        </div>
      </div>

      {/* ─── Our Journey ────────────────────────────────────────────────────── */}
      <LazySection id="our-journey" minHeight={480} className="w-full my-16">
        <OurJourney />
      </LazySection>

      {/* ─── Centered Sections (Stats, Founders, Advisory, Employees, Vision, Core) ─── */}
      <div className="max-w-6xl mx-auto px-4">
        {/* Stats */}
        <LazySection id="trust-stats" minHeight={150} className="my-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200">
            {[
              { number: `${yearsOfExperience}+`, label: "Years of Experience" },
              { number: statsLoading ? "—" : `${stats.brands}+`, label: "Brand Distributorships" },
              { number: statsLoading ? "—" : `${stats.products}+`, label: "Products Delivered" },
              { number: statsLoading ? "—" : `${stats.clients}+`, label: "Clients We Serve" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-black text-blue-950">{stat.number}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </LazySection>

        {/* Founders */}
        {!loading && (
          <LazySection id="founders" minHeight={300} className="my-16">
            <SectionHeading title="Our" highlight="Leaders" />
            <p className="text-center text-gray-600 mt-4" />
            <br />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              <FounderSimple person={founders.founder} />
              <FounderSimple person={founders.coFounder} />
            </div>
          </LazySection>
        )}

        {/* Advisory Board */}
        <LazySection id="advisory-board" className="my-16">
          {advisoryLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              <SectionHeading title="Our" highlight="Advisory Board" />
              <div className="mt-10">
                <AdvisoryBoardCards members={advisoryMembers} />
              </div>
            </>
          )}
        </LazySection>

        {/* Employees */}
        <LazySection id="employees" className="my-16">
          <SectionHeading title="Our Valuable" highlight="Team" />
          <p className="text-center text-gray-600 mt-4">Meet the dedicated professionals who drive our success.</p>
          <br />
          <EmployeesShowcase showFilters showPagination pageSize={8} />
        </LazySection>

        {/* Vision & Mission */}
        <LazySection id="vision-mission" minHeight={600} className="my-16">
          <section className="relative">
            <div className="h-40 bg-cover bg-center">
              <div className="absolute inset-0" />
            </div>
            <div className="relative -mt-44 max-w-6xl mx-auto px-5 pb-0">
              {loading ? (
                <>
                  <div className="bg-white rounded-lg shadow-[0_18px_45px_rgba(0,0,0,0.12)] p-10 lg:p-12 mb-10">
                    <SectionSkeleton />
                  </div>
                  <div className="bg-white rounded-lg shadow-[0_18px_45px_rgba(0,0,0,0.12)] p-10 lg:p-12 mb-10">
                    <SectionSkeleton />
                  </div>
                </>
              ) : (
                (visionMission.length > 0 ? visionMission : DEFAULT_VISION_MISSION).map((vm, i) => {
                  const DynamicIcon = (vm.icon && Icons[vm.icon]) || Icons.Sparkles;
                  const title = vm.title || (vm.type === "mission" ? "Our Mission" : "Our Vision");
                  return (
                    <VisionMissionCard
                      key={i}
                      title={title}
                      icon={
                        <DynamicIcon size={vm.iconSize || 90} color={vm.iconColor || "#7ccf00"} />
                      }
                    >
                      <div className="text-xl leading-relaxed text-gray-700">
                        <RichTextRenderer html={vm.description} />
                      </div>
                    </VisionMissionCard>
                  );
                })
              )}
            </div>
          </section>
        </LazySection>

        {/* Core Values - controlled by pageSettings */}
        {pageSettings.showCoreValues && (
          <LazySection id="core-values" minHeight={150} className="my-16">
            <CoreValues />
          </LazySection>
        )}
      </div>

      {/* ✅ Protection Proven - Full Width (Outside max-w-6xl) */}
      {pageSettings.showProtectionProven && (
        <LazySection id="protection-proven" minHeight={150} className="my-16">
          <ProtectionProven />
        </LazySection>
      )}

      {/* ─── CTA - Centered ──────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4">
        <LazySection id="contact-cta" minHeight={200} className="my-16">
          <div className="bg-gradient-to-r from-blue-950 to-blue-900 rounded-3xl p-8 md:p-12 text-center text-white space-y-4">
            <h2 className="text-2xl md:text-3xl font-black">Get in touch with {companyName}?</h2>
            <Link href="/contact">
              <button className="bg-[#557b00] text-white font-black text-xs px-8 py-4 rounded-xl uppercase tracking-wider hover:bg-blue-950 transition-colors">
                Contact Us Today →
              </button>
            </Link>
          </div>
        </LazySection>
      </div>
    </div>
  );
}