import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import { apiClient } from '../api/client';
import GlassCard from './ui/GlassCard';
import { RefreshCw, Check, AlertCircle, Timer } from 'lucide-react';

interface GarminConnectProps {
    onSyncComplete?: () => void;
}

const GarminConnect: React.FC<GarminConnectProps> = ({ onSyncComplete }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLinked, setIsLinked] = useState(false);
    const [linkedEmail, setLinkedEmail] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [autoSync, setAutoSync] = useState(false);
    const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        checkStatus();
    }, []);

    // Auto-sync every 10 seconds when enabled
    useEffect(() => {
        if (autoSync && isLinked) {
            // Sync immediately when turned on
            handleSync(true);
            autoSyncRef.current = setInterval(() => {
                handleSync(true);
            }, 10000);
        } else {
            if (autoSyncRef.current) {
                clearInterval(autoSyncRef.current);
                autoSyncRef.current = null;
            }
        }
        return () => {
            if (autoSyncRef.current) {
                clearInterval(autoSyncRef.current);
            }
        };
    }, [autoSync, isLinked]);

    const checkStatus = async () => {
        try {
            const res = await apiClient.get('/garmin/status');
            setIsLinked(res.linked);
            setLinkedEmail(res.email);
        } catch (err) {
            console.error(err);
        }
    };

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await apiClient.post('/garmin/link', { email, password });
            await checkStatus();
            setMessage('Account linked successfully');
            setPassword('');
        } catch (err: any) {
            setError(err.message || 'Failed to link account');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async (silent = false) => {
        if (!silent) {
            setIsLoading(true);
            setError(null);
            setMessage(null);
        }
        try {
            const res = await apiClient.post('/garmin/sync', {});
            if (!silent) setMessage(res.message);
            if (onSyncComplete) onSyncComplete();
        } catch (err: any) {
            if (!silent) setError(err.message || 'Sync failed');
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    return (
        <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text flex items-center gap-2">
                    <span className="bg-sky-500 rounded-full w-2 h-2"></span>
                    Garmin Connect
                </h3>
                <div className="flex items-center gap-2">
                    {isLinked && (
                        <>
                            <button
                                onClick={() => setAutoSync(!autoSync)}
                                className={`text-xs flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${autoSync
                                        ? 'bg-green-500/15 text-green-500 border border-green-500/30'
                                        : 'bg-surface-highlight text-muted hover:text-text border border-border'
                                    }`}
                                title={autoSync ? 'Auto-sync enabled (every 10s)' : 'Enable auto-sync'}
                            >
                                <Timer size={12} />
                                {autoSync ? 'Auto' : 'Auto'}
                            </button>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-500 flex items-center gap-1">
                                <Check size={12} /> Linked
                            </span>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-500/10 text-red-500 text-sm rounded-lg flex items-center gap-2">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {message && (
                <div className="mb-4 p-3 bg-green-500/10 text-green-500 text-sm rounded-lg flex items-center gap-2">
                    <Check size={16} /> {message}
                </div>
            )}

            {!isLinked ? (
                <form onSubmit={handleLink} className="flex flex-col gap-3">
                    <p className="text-sm text-muted mb-2">Link your Garmin account to sync heart rate data.</p>
                    <input
                        type="email"
                        placeholder="Garmin Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="p-2 rounded-lg bg-surface-highlight border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="p-2 rounded-lg bg-surface-highlight border border-border text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn btn-primary w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
                    >
                        {isLoading ? 'Linking...' : 'Link Account'}
                    </button>
                    <p className="text-xs text-muted text-center mt-1">
                        Your credentials are stored locally on your machine.
                    </p>
                </form>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="text-sm text-muted">
                        Linked as <span className="text-text font-medium">{linkedEmail}</span>
                    </div>
                    <button
                        onClick={() => handleSync(false)}
                        disabled={isLoading}
                        className="btn bg-surface-highlight hover:bg-border text-text w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border transition-colors"
                    >
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                        {isLoading ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
            )}
        </GlassCard>
    );
};

export default GarminConnect;
