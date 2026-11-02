
import React from 'react';
import { Mail, Phone, MapPin, Instagram, Twitter, Linkedin, Github } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  const LOGO = "/img/logo_orange_new.png";
  const linkClass = "text-sm text-slate-600 transition-colors hover:text-brand-600";
  const socialClass = "inline-flex h-10 w-10 items-center justify-center text-slate-400 transition-colors hover:text-slate-700";

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div>
            <img
              src={LOGO}
              alt="REVA University"
              className="h-10 w-auto"
            />
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Empowering the next generation of innovators with cutting-edge tools, mentorship, and a collaborative ecosystem designed for breakthroughs.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Quick Links</h4>
            <ul className="mt-4 space-y-3">
              <li><Link to="/about" className={linkClass}>About Us</Link></li>
              <li><Link to="/team" className={linkClass}>Our Team</Link></li>
              <li><Link to="/projects" className={linkClass}>Project Showcase</Link></li>
              <li><Link to="/testimonials" className={linkClass}>Testimonials</Link></li>
              <li><Link to="/resources" className={linkClass}>Resources</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Contact</h4>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
                <span>AICTE IDEA Lab, REVA University,<br/>Rukmini Knowledge Park, Kattigenahalli,<br/>Yelahanka, Bengaluru, Karnataka 560064</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
                <span>idealab@reva.edu.in</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
                <span>+91 80 4696 6966</span>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Stay Updated</h4>
            <p className="mt-4 text-sm text-slate-600">Subscribe to our newsletter for the latest workshop alerts.</p>
            <form className="mt-4 space-y-3">
              <input
                type="email"
                placeholder="Enter your email"
                aria-label="Email address"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 text-sm text-slate-500 md:flex-row">
          <div className="text-center md:text-left">
            © 2024 AICTE IDEA Lab, REVA University. All rights reserved.
          </div>
          <div className="flex gap-2">
            <a href="#" aria-label="Instagram" className={socialClass}><Instagram className="h-5 w-5" aria-hidden="true" /></a>
            <a href="#" aria-label="Twitter" className={socialClass}><Twitter className="h-5 w-5" aria-hidden="true" /></a>
            <a href="#" aria-label="LinkedIn" className={socialClass}><Linkedin className="h-5 w-5" aria-hidden="true" /></a>
            <a href="#" aria-label="GitHub" className={socialClass}><Github className="h-5 w-5" aria-hidden="true" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
