import React, { useState, useEffect } from 'react';
// @ts-ignore
import { apiClient } from '../api/client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import GlassCard from './ui/GlassCard';

interface HeartRateData {
    timestamp: string;
    heart_rate: number;
    time?: string;
    fullTime?: string;
}

interface HeartRateChartProps {
    lastSync: number;
}

const HeartRateChart: React.FC<HeartRateChartProps> = ({ lastSync }) => {
    const [data, setData] = useState<HeartRateData[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    useEffect(() => {
        fetchData(selectedDate);
    }, [lastSync, selectedDate]);

    const fetchData = async (date: Date) => {
        setLoading(true);
        try {
            const dateStr = date.toISOString().split('T')[0];
            const res = await apiClient.get(`/garmin/heart-rate?date_str=${dateStr}`);
            if (Array.isArray(res)) {
                const formatted = res.map((d: any) => ({
                    ...d,
                    time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    fullTime: new Date(d.timestamp).toLocaleString()
                }));
                setData(formatted);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const goToPrevDay = () => {
        setSelectedDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - 1);
            return d;
        });
    };

    const goToNextDay = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setSelectedDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + 1);
            // Don't go past today
            if (d > tomorrow) return prev;
            return d;
        });
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const formatDateLabel = (date: Date) => {
        if (isToday(date)) return 'Today';
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <GlassCard className="p-6 h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text flex items-center gap-2">
                    <Activity size={20} className="text-red-500" />
                    Heart Rate
                </h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={goToPrevDay}
                        className="p-1.5 rounded-lg hover:bg-surface-highlight text-muted hover:text-text transition-colors"
                        title="Previous day"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-medium text-text min-w-[100px] text-center">
                        {formatDateLabel(selectedDate)}
                    </span>
                    <button
                        onClick={goToNextDay}
                        disabled={isToday(selectedDate)}
                        className="p-1.5 rounded-lg hover:bg-surface-highlight text-muted hover:text-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next day"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {loading && data.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted">Loading heart rate data...</div>
            ) : data.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted border-dashed border-2 border-border rounded-xl bg-surface/30 m-2">
                    <Activity className="mb-2 opacity-50" size={32} />
                    <p>No heart rate data for {formatDateLabel(selectedDate).toLowerCase()}</p>
                    <p className="text-xs mt-1">Sync your Garmin device to see data</p>
                </div>
            ) : (
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{
                                top: 10,
                                right: 10,
                                left: 0,
                                bottom: 0,
                            }}
                        >
                            <defs>
                                <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                            <XAxis
                                dataKey="time"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.9)', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                labelStyle={{ color: '#aaa' }}
                                formatter={(value: any) => [value, 'BPM']}
                                labelFormatter={(label: any) => `Time: ${label}`}
                            />
                            <Area
                                type="monotone"
                                dataKey="heart_rate"
                                stroke="#ef4444"
                                fillOpacity={1}
                                fill="url(#colorHr)"
                                name="Heart Rate"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </GlassCard>
    );
};

export default HeartRateChart;
