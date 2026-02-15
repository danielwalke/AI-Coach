import React, { useState } from 'react';
// @ts-ignore
import { apiClient } from '../../api/client';
import GarminConnect from '../../components/GarminConnect';
import HeartRateChart from '../../components/HeartRateChart';
import CoachChat from '../../components/CoachChat';
import { HeartPulse } from 'lucide-react';

const HealthCoach: React.FC = () => {
    const [lastSync, setLastSync] = useState(0);

    const handleSyncComplete = () => {
        setLastSync(Date.now());
    };

    return (
        <div className="p-4 pb-24 max-w-2xl mx-auto space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <HeartPulse size={28} className="text-primary" />
                <h1 className="text-2xl font-bold text-text">Health Coach</h1>
            </div>

            {/* Garmin Connection */}
            <GarminConnect onSyncComplete={handleSyncComplete} />

            {/* Heart Rate Chart with Day Navigation */}
            <HeartRateChart lastSync={lastSync} />

            {/* AI Coach Chat */}
            <CoachChat />
        </div>
    );
};

export default HealthCoach;
