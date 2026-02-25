import React, { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';

const CookieBanner: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookie-consent');
        if (!consent) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('cookie-consent', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] p-4 animate-in fade-in slide-in-from-top duration-500">
            <div className="max-w-2xl mx-auto bg-surface/90 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                        <Info size={20} />
                    </div>
                    <p className="text-sm text-text leading-tight">
                        Diese Website verwendet nur technisch notwendige Cookies, um Ihr Erlebnis zu verbessern.
                        <span className="hidden sm:inline"> Wir nutzen kein Tracking für Marketingzwecke.</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAccept}
                        className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors whitespace-nowrap"
                    >
                        Verstanden
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="p-2 text-muted hover:text-text transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieBanner;
