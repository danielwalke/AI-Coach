import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import { useData } from '../../context/DataContext';

const ProgressChart: React.FC = () => {
    const { sessions, exercises } = useData();
    const [selectedExerciseId, setSelectedExerciseId] = useState<number | ''>('');

    // Default to first exercise if none selected
    const activeExerciseId = selectedExerciseId === '' && exercises.length > 0 ? exercises[0].id : selectedExerciseId;


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

    if (exercises.length === 0) return <div className="p-4 text-center text-muted">No exercises found.</div>;

    return (
        <div className="card w-full h-72 flex flex-col bg-surface border-none shadow-none p-0">
            <div className="flex justify-between items-center mb-4 px-2">
                <select
                    className="p-2 text-sm bg-surface-highlight rounded-lg text-text font-medium border-none focus:ring-0 w-auto"
                    value={activeExerciseId}
                    onChange={(e) => setSelectedExerciseId(Number(e.target.value))}
                >
                    {exercises.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                </select>
            </div>

            <div className="flex-1 w-full min-h-[300px]" data-testid="chart-container">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="99%">
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
                                isAnimationActive={false} // Disable animation for easier E2E testing
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted text-sm px-8 text-center bg-surface-highlight/30 rounded-2xl mx-2">
                        <Activity className="mb-2 opacity-50" />
                        <p>No data yet.</p>
                        <p className="text-xs mt-1">Complete a {exercises.find(e => e.id === Number(activeExerciseId))?.name} session to visualize progress.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressChart;
