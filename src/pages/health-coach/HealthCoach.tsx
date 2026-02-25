import React from 'react';
import CoachChat from '../../components/CoachChat';

const HealthCoach: React.FC = () => {
    return (
        <div className="h-[calc(100vh-6rem)] p-4 w-full mx-auto flex flex-col">
            {/* AI Coach Chat */}
            <CoachChat className="flex-1 h-full" />
        </div>
    );
};

export default HealthCoach;
