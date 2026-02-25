import React from 'react';
import CoachChat from '../../components/CoachChat';

const HealthCoach: React.FC = () => {
    return (
        <div className="w-full mx-auto flex flex-col -mt-6 -mb-24 -mx-6" style={{ width: 'calc(100% + 3rem)', height: 'calc(100dvh - 5rem)' }}>
            {/* AI Coach Chat */}
            <CoachChat className="flex-1 h-full" />
        </div>
    );
};

export default HealthCoach;
