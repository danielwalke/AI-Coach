import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    style?: React.CSSProperties;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick, style }) => {
    return (
        <div
            onClick={onClick}
            style={style}
            className={`
                bg-surface rounded-2xl border border-border hover:border-black/5 
                shadow-sm hover:shadow-md transition-all duration-300 
                ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} 
                ${className}
            `}
        >
            {children}
        </div>
    );
};

export default GlassCard;
