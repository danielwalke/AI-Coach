import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, User, HeartPulse, Clock, Dumbbell, Gavel } from 'lucide-react';

const BottomNav: React.FC = () => {
    return (
        <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface/80 backdrop-blur-xl z-50 h-20 w-full pb-4">
            <div className="max-w-2xl mx-auto flex justify-around items-center h-full px-2">
                <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center w-12 h-full transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted hover:text-text'
                        }`
                    }
                >
                    <LayoutDashboard size={20} strokeWidth={2} />
                    <span className="text-[9px] font-medium mt-1">Home</span>
                </NavLink>

                <NavLink
                    to="/health-coach"
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center w-12 h-full transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted hover:text-text'
                        }`
                    }
                >
                    <HeartPulse size={20} strokeWidth={2} />
                    <span className="text-[9px] font-medium mt-1">Coach</span>
                </NavLink>

                <NavLink
                    to="/templates"
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center w-12 h-full transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted hover:text-text'
                        }`
                    }
                >
                    <Dumbbell size={20} strokeWidth={2} />
                    <span className="text-[9px] font-medium mt-1">Templates</span>
                </NavLink>

                <NavLink
                    to="/training"
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center -mt-6 transition-transform duration-300 ${isActive ? 'scale-110' : 'hover:scale-105'}`
                    }
                >
                    <div className="rounded-full bg-primary text-white p-3 shadow-lg shadow-primary/30">
                        <PlusCircle size={28} strokeWidth={2} />
                    </div>
                </NavLink>

                <NavLink
                    to="/history"
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center w-12 h-full transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted hover:text-text'
                        }`
                    }
                >
                    <Clock size={20} strokeWidth={2} />
                    <span className="text-[9px] font-medium mt-1">History</span>
                </NavLink>

                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center w-12 h-full transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted hover:text-text'
                        }`
                    }
                >
                    <User size={20} strokeWidth={2} />
                    <span className="text-[9px] font-medium mt-1">Profile</span>
                </NavLink>

                <NavLink
                    to="/impressum"
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center w-12 h-full transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted hover:text-text'
                        }`
                    }
                >
                    <Gavel size={20} strokeWidth={2} />
                    <span className="text-[9px] font-medium mt-1">Impressum</span>
                </NavLink>
            </div>
        </nav>
    );
};

export default BottomNav;

