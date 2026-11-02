import React from 'react';
import { Lightbulb, Globe, Users, ArrowRight, Linkedin, Mail, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FadeIn } from '../components/FadeIn';
import { avatarUrl } from "../utils/avatar";

/* ── Team Data ── */
const FACULTY = [
  { name: "Dr. P. Shyama Raju", role: "Chancellor", image: "/img/team/shyama-raju.png", designation: "Chief Patron", email: "chancellor@reva.edu.in", linkedin: "#" },
  { name: "Dr. M. Dhanamjaya", role: "Vice Chancellor", image: "/img/team/dhanamjaya.webp", designation: "Patron", email: "vc@reva.edu.in", linkedin: "#" },
  { name: "Dr. Rajashekhar C. Biradar", role: "Pro-Vice Chancellor", image: "/img/team/rajashekhar-biradar.webp", designation: "Chief Mentor", email: "pvc@reva.edu.in", linkedin: "#" },
  { name: "Dr. Manjula R. Bharamagoudra", role: "Professor", image: "/img/team/manjula-bharamagoudra.webp", designation: "Faculty Coordinator", email: "manjula.rb@reva.edu.in", linkedin: "#" },
  { name: "Dr. S.Sudhagara Rajan", role: "Associate Professor", image: "/img/team/sudhagara-rajan.webp", designation: "Tech Guru", email: "adithya@reva.edu.in", linkedin: "#" },
  { name: "Prof. Karthik E C", role: "Assistant Professor", image: "/img/team/karthik-ec.webp", designation: "Tech Guru", email: "adithya@reva.edu.in", linkedin: "#" },
  { name: "Dr. Nikhath Tabassum", role: "Assistant Professor", image: "/img/team/nikhath-tabassum.webp", designation: "Tech Guru", email: "adithya@reva.edu.in", linkedin: "#" },
];

const STUDENTS = [
  { name: "Madhavan R", role: "Student Ambassador", image: "/img/team/madhavan-r.png", designation: "Web Lead", email: "sarah@reva.edu.in", linkedin: "#" },
  { name: "Suryansh Singh", role: "Student Ambassador", image: avatarUrl("Suryansh Singh"), designation: "Operations", email: "rahul@reva.edu.in", linkedin: "#" },
  { name: "Amit Patel", role: "Hardware Lead", image: avatarUrl("Amit Patel"), designation: "Electronics", email: "amit@reva.edu.in", linkedin: "#" },
];


const TeamMemberCard: React.FC<{ member: any }> = ({ member }) => (
    <div className="group h-full w-full max-w-[300px]">
        <div className="h-full rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md hover:border-slate-300">
            {/* Simple Portrait Frame */}
            <div className="mx-auto h-28 w-28 md:h-32 md:w-32">
                <div className="h-full w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                    <img
                        src={member.image}
                        onError={(e) => {
                          // Photo not copied to public/img/team yet: show initials instead.
                          const img = e.currentTarget;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = "1";
                            img.src = avatarUrl(member.name);
                          }
                        }}
                        alt={member.name}
                        className="h-full w-full object-cover object-[center_20%] transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                </div>
            </div>

            {/* Info */}
            <h3 className="mt-5 font-display text-lg font-semibold text-slate-900">
                {member.name}
            </h3>
            <p className="mt-1 text-sm font-medium text-brand-600">
                {member.role}
            </p>
            <div className="mx-auto my-4 h-px w-8 bg-slate-200" aria-hidden="true" />
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {member.designation}
            </p>

            {/* Socials */}
            <div className="mt-4 flex justify-center gap-2">
                <a href={member.linkedin} aria-label={`${member.name} on LinkedIn`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
                    <Linkedin className="h-4 w-4" aria-hidden="true" />
                </a>
                <a href={`mailto:${member.email}`} aria-label={`Email ${member.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                </a>
            </div>
        </div>
    </div>
);

const About: React.FC = () => {


    return (
        <div className="min-h-screen bg-white">
            {/* ── Page header ── */}
            <section className="border-b border-slate-200 bg-white pt-24 pb-10 md:pt-28 md:pb-12">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <FadeIn>
                        <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">
                            <Globe className="h-4 w-4" aria-hidden="true" /> Established 2026
                        </span>
                        <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
                            The Heart of <br />
                            <span className="text-brand-600">Making.</span>
                        </h1>
                        <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">
                            REVA University's IDEA Lab is a flagship manufacturing hub dedicated to fostering innovation through industrial-grade tools and hands-on expertise.
                        </p>
                    </FadeIn>
                </div>
            </section>

            {/* Mission / Vision */}
            <section className="bg-white py-16 md:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-10 lg:gap-16 lg:grid-cols-2 items-center">
                        <FadeIn>
                            <div className="space-y-10">
                                <div className="relative pl-5">
                                    <div className="absolute left-0 top-1 h-10 w-1 rounded-full bg-brand-500" aria-hidden="true" />
                                    <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">Our Mission</h2>
                                    <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
                                        To provide a world-class collaborative workspace where student-led groups, faculty, and industry pioneers utilize advanced machinery to bridge the gap between classroom theory and real-world mastery.
                                    </p>
                                </div>
                                <div className="relative pl-5">
                                    <div className="absolute left-0 top-1 h-10 w-1 rounded-full bg-brand-500" aria-hidden="true" />
                                    <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">Our Vision</h2>
                                    <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
                                        To empower the next generation of creators, entrepreneurs, and dreamers with the tools and mentorship required to turn their biggest ideas into tangible, impactful solutions.
                                    </p>
                                </div>
                            </div>
                        </FadeIn>
                        <FadeIn delay={0.1}>
                            <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                <img
                                    src="/img/comp/DSC09532.JPG"
                                    alt="Idea Lab"
                                    loading="lazy"
                                    width="800"
                                    height="800"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        </FadeIn>
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="bg-slate-50 py-16 md:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-6 md:grid-cols-3">
                        {[
                            { icon: Lightbulb, title: "Innovate", desc: "Pushing the boundaries of what is possible through rapid prototyping." },
                            { icon: Users, title: "Collaborate", desc: "Creating a cross-disciplinary junction for diverse student groups." },
                            { icon: Rocket, title: "Accelerate", desc: "Turning local ideas into industrial solutions with speed." }
                        ].map((item: any, idx) => (
                            <FadeIn key={idx} delay={idx * 0.05} className="h-full">
                                <div className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                                        <item.icon className="h-5 w-5" aria-hidden="true" />
                                    </div>
                                    <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">{item.title}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* Team Section */}
            <section id="team" className="bg-white py-16 md:py-24">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-14">
                    <FadeIn>
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">Meet The Architects</h2>
                            <p className="mt-4 text-base sm:text-lg leading-relaxed text-slate-600">The visionary faculty and student leaders behind the REVA IDEA Lab.</p>
                        </div>
                    </FadeIn>

                    {/* Faculty Section */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-6">
                            <h3 className="whitespace-nowrap text-sm font-semibold uppercase tracking-wider text-brand-600">Leadership</h3>
                            <div className="h-px w-full bg-slate-200" aria-hidden="true" />
                        </div>

                        {/* Desktop: Grid | Tablet/Mobile: Carousel */}
                        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-8">
                            {FACULTY.map((m, i) => <div key={i} className="flex justify-center"><TeamMemberCard member={m} /></div>)}
                        </div>
                        <div
                            className="flex lg:hidden overflow-x-auto gap-6 pb-4 snap-x snap-mandatory scrollbar-hide"
                        >
                            {FACULTY.map((m, i) => <div key={i} className="snap-center shrink-0 w-[280px]"><TeamMemberCard member={m} /></div>)}
                        </div>
                    </div>

                    {/* Students Section */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-6">
                            <h3 className="whitespace-nowrap text-sm font-semibold uppercase tracking-wider text-brand-600">Student Leads</h3>
                            <div className="h-px w-full bg-slate-200" aria-hidden="true" />
                        </div>

                        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-8 max-w-5xl mx-auto">
                            {STUDENTS.map((m, i) => <div key={i} className="flex justify-center"><TeamMemberCard member={m} /></div>)}
                        </div>

                        <div
                            className="flex lg:hidden overflow-x-auto gap-6 pb-4 snap-x snap-mandatory scrollbar-hide"
                        >
                            {STUDENTS.map((m, i) => <div key={i} className="snap-center shrink-0 w-[280px]"><TeamMemberCard member={m} /></div>)}
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="bg-slate-50 py-16 md:py-24 text-center">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <FadeIn>
                        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">Ready to Build?</h2>
                        <p className="mx-auto mt-4 max-w-md text-base sm:text-lg leading-relaxed text-slate-600">Your transformation from student to innovator starts here.</p>
                        <Link to="/login" className="group mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
                            GET STARTED <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                    </FadeIn>
                </div>
            </section>
        </div>
    );
};

export default About;
