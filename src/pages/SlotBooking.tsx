import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { authService } from "../services/api";
import { User, SlotBooking as SlotBookingType } from "../../types";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "../components/FadeIn";
import SlotBookingPanel from "../components/SlotBookingPanel";
import { ArrowLeft } from "lucide-react";
import SlotBookingModal from "../components/SlotBookingModal";

interface Props { user?: User; }

const SlotBooking: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 pt-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-10 lg:px-8">
        {/* Navigation / Header Area */}
        <div className="mb-8 flex items-center justify-between gap-4">
           <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Workspace
           </Link>
           <div className="flex items-center gap-2">
              <span className="hidden text-sm text-slate-500 md:inline">Protocol Status</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
                Active Connection
              </span>
           </div>
        </div>

        <div>
           <SlotBookingPanel 
              onBookClick={() => setIsModalOpen(true)} 
              initialSearch={location.state?.date || ""}
           />
        </div>
      </div>

      <SlotBookingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={user}
        initialDate={location.state?.date || ""}
        onSuccess={() => window.location.reload()}
      />
    </div>
  );
};

export default SlotBooking;
