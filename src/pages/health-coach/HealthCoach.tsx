import React from 'react';
import CoachChat from '../../components/CoachChat';

const HealthCoach: React.FC = () => {
    return (
        <div className="p-4 pb-24 max-w-2xl mx-auto space-y-4">
            <h1 className="text-2xl font-bold text-text mb-4">AI Health Coach</h1>

            <div className="bg-surface-highlight p-4 rounded-xl border border-border text-sm text-muted mb-4">
                <p>Garmin integration is available on the <code>feature/garmin-integration</code> branch.</p>
            </div>

            {/* AI Coach Chat */}
            <CoachChat />
        </div>
    );
};

export default HealthCoach;
