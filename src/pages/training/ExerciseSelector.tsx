import React, { useState } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { useData } from '../../context/DataContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (exerciseId: number) => void;
}

const ExerciseSelector: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
    const { exercises, addExercise } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [newExerciseName, setNewExerciseName] = useState('');

    if (!isOpen) return null;

    const filteredExercises = exercises.filter(ex =>
        ex.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreateExercise = async () => {
        if (!newExerciseName) return;
        await addExercise(newExerciseName, 'Other'); // Default category
        setNewExerciseName('');
        // Re-fetch or rely on live query, but for selection we might need to wait or just close
        // In live query model, it will appear. For now, just clear.
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-end sm:items-center justify-center p-4">
            <div className="bg-surface w-full max-w-lg rounded-t-xl sm:rounded-xl max-h-[85vh] flex flex-col border border-border">

                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-text">Select Exercise</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Search exercise..."
                            className="w-full pl-10 bg-bg border-border focus:border-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Or create new..."
                            className="flex-1 bg-bg border-border focus:border-primary min-w-0"
                            value={newExerciseName}
                            onChange={(e) => setNewExerciseName(e.target.value)}
                        />
                        <button
                            onClick={handleCreateExercise}
                            disabled={!newExerciseName}
                            className="btn btn-primary px-3 py-2 disabled:opacity-50"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-4 pt-0 flex flex-col gap-2">
                    {filteredExercises.map(ex => (
                        <button
                            key={ex.id}
                            onClick={() => { onSelect(ex.id); onClose(); }}
                            className="p-3 bg-bg/50 border border-border rounded text-left hover:border-primary hover:text-primary transition-colors"
                        >
                            <div className="font-medium text-text">{ex.name}</div>
                            <div className="text-xs text-muted">{ex.category}</div>
                        </button>
                    ))}
                    {filteredExercises.length === 0 && (
                        <div className="text-center text-muted py-8">
                            No exercises found. Create one above!
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ExerciseSelector;
