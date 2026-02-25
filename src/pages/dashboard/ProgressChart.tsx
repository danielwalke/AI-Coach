import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Trophy } from 'lucide-react';
import { useData } from '../../context/DataContext';

const ProgressChart: React.FC = () => {
    const { sessions, exercises } = useData();
    const [selectedExerciseId, setSelectedExerciseId] = useState<number | ''>('');

    // Filter exercises to only those the user has done at least once (with completed sets)
    const completedExercises = useMemo(() => {
        const doneIds = new Set<number>();
        sessions.forEach(session => {
            session.exercises.forEach(ex => {
                const hasCompleted = ex.sets.some(s => s.completed && s.weight > 0);
                if (hasCompleted) doneIds.add(ex.exercise.id);
            });
        });
        return exercises.filter(e => doneIds.has(e.id));
    }, [sessions, exercises]);

    // Default to first completed exercise if none selected
    const activeExerciseId = selectedExerciseId === '' && completedExercises.length > 0 ? completedExercises[0].id : selectedExerciseId;

    const data = useMemo(() => {
        if (activeExerciseId === '') return [];

        const exerciseSessions = sessions.filter(session =>
            session.exercises.some(e => e.exercise.id === Number(activeExerciseId))
        );

        // Sort ascending
        exerciseSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return exerciseSessions.map(session => {
            const exerciseData = session.exercises.find(e => e.exercise.id === Number(activeExerciseId));
            if (!exerciseData || exerciseData.sets.length === 0) return null;

            const validSets = exerciseData.sets.filter(s => s.completed && s.weight > 0);
            if (validSets.length === 0) return null;

            const maxWeight = Math.max(...validSets.map(s => s.weight));

            return {
                date: new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                weight: maxWeight
            };
        }).filter(Boolean);
    }, [sessions, activeExerciseId]);

    // Calculate PR (personal record) for the selected exercise
    const pr = useMemo(() => {
        if (data.length === 0) return null;
        return Math.max(...data.map((d: any) => d.weight));
    }, [data]);

    if (completedExercises.length === 0) {
        return (
            <div className="p-8 text-center text-muted flex flex-col items-center gap-2">
                <Activity className="opacity-30" size={32} />
                <p className="font-medium">No exercise data yet.</p>
                <p className="text-xs">Complete a workout to see your progress here.</p>
            </div>
        );
    }

    return (
        <div className="card w-full flex flex-col bg-surface border-none shadow-none p-0">
            <div className="flex justify-between items-center mb-4 px-2">
                <select
                    className="p-2 text-sm bg-surface-highlight rounded-lg text-text font-medium border-none focus:ring-0 w-auto"
                    value={activeExerciseId}
                    onChange={(e) => setSelectedExerciseId(Number(e.target.value))}
                >
                    {completedExercises.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                </select>
                {pr !== null && (
                    <div className="flex items-center gap-1.5 text-sm font-bold text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/20">
                        <Trophy size={14} />
                        <span>PR: {pr} kg</span>
                    </div>
                )}
            </div>

            <div className="w-full h-[300px]" data-testid="chart-container">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0a84ff" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#0a84ff" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2e" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#8e8e93"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#8e8e93"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1c1c1e', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                                itemStyle={{ color: '#0a84ff' }}
                                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="weight"
                                stroke="#0a84ff"
                                strokeWidth={3}
                                dot={{ fill: '#0a84ff', r: 4, strokeWidth: 2, stroke: '#1c1c1e' }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted text-sm px-8 text-center rounded-2xl mx-2">
                        <Activity className="mb-2 opacity-50" />
                        <p>No data yet for this exercise.</p>
                        <p className="text-xs mt-1">Complete a session with {completedExercises.find(e => e.id === Number(activeExerciseId))?.name} to visualize progress.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressChart;

