import React from 'react';
import GlassCard from './GlassCard';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    unit?: string;
    icon: LucideIcon;
    iconColor?: string;
    trend?: string;
    trendUp?: boolean;
    className?: string; // Allow passing className for additional customized styling
}

const StatCard: React.FC<StatCardProps> = ({ title, value, unit, icon: Icon, iconColor = 'text-primary', trend, trendUp, className }) => {
    return (
        <GlassCard className={`p-5 flex flex-col justify-between h-full relative overflow-hidden group ${className || ''}`}>
            <div className="flex justify-between items-start z-10">
                <div className={`p-2 rounded-xl bg-surface-highlight/50 ${iconColor}`}>
                    <Icon size={22} />
                </div>
                {trend && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {trend}
                    </span>
                )}
            </div>

            <div className="mt-4 z-10">
                <span className="text-3xl font-bold text-text tracking-tight block">
                    {value} <span className="text-sm font-medium text-muted ml-0.5">{unit}</span>
                </span>
                <span className="text-sm font-medium text-muted">{title}</span>
            </div>

            {/* Subtle background decoration */}
            <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500 scale-150 ${iconColor}`}>
                <Icon size={100} />
            </div>
        </GlassCard>
    );
};

export default StatCard;
