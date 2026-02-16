import React from 'react';
import { Dumbbell, X, Zap } from 'lucide-react';
import { useData } from '../../context/DataContext';
import type { WorkoutTemplate } from '../../types/api';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: WorkoutTemplate) => void;
    onSelectEmpty: () => void;
}

const TemplateSelector: React.FC<Props> = ({ isOpen, onClose, onSelectTemplate, onSelectEmpty }) => {
    const { templates } = useData();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-end sm:items-center justify-center p-4">
            <div className="bg-surface w-full max-w-lg rounded-t-xl sm:rounded-xl max-h-[85vh] flex flex-col border border-border">

                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h2 className="text-xl font-bold text-text">Start Workout</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
                    {/* Empty workout option */}
                    <button
                        onClick={() => { onSelectEmpty(); onClose(); }}
                        className="p-4 bg-bg/50 border-2 border-dashed border-border rounded-lg text-left hover:border-primary transition-colors flex items-center gap-3"
                    >
                        <div className="bg-primary/20 p-2 rounded-lg" style={{ backgroundColor: 'rgba(var(--color-primary-rgb, 99, 102, 241), 0.2)' }}>
                            <Zap size={24} className="text-primary" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div>
                            <div className="font-bold text-text">Empty Workout</div>
                            <div className="text-xs text-muted">Start from scratch — add exercises as you go</div>
                        </div>
                    </button>

                    {templates.length > 0 && (
                        <div className="text-xs text-muted uppercase font-bold mt-2 mb-1">Or use a template</div>
                    )}

                    {templates.map(t => (
                        <button
                            key={t.id}
                            onClick={() => { onSelectTemplate(t); onClose(); }}
                            className="p-4 bg-bg/50 border border-border rounded-lg text-left hover:border-primary transition-colors flex items-center gap-3"
                        >
                            <div className="bg-surface p-2 rounded-lg border border-border">
                                <Dumbbell size={24} className="text-primary" style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-text">{t.name}</div>
                                <div className="text-xs text-muted truncate">
                                    {t.exercises.map(ex => ex.exercise.name).join(' · ')}
                                </div>
                            </div>
                            <div className="text-xs text-muted whitespace-nowrap">{t.exercises.length} ex</div>
                        </button>
                    ))}

                    {templates.length === 0 && (
                        <div className="text-center text-muted py-6 text-sm">
                            No templates yet — create one from the Templates page
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default TemplateSelector;
