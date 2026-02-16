import React, { useState } from 'react';
import { Plus, Trash2, Download, Upload, Edit3, ChevronDown, ChevronRight, X, Save, Dumbbell } from 'lucide-react';
import { useData } from '../../context/DataContext';
import type { WorkoutTemplate, CreateWorkoutTemplate } from '../../types/api';
import ExerciseSelector from './ExerciseSelector';

interface TemplateSetForm {
    goal_weight: number;
    goal_reps: number;
}

interface TemplateExerciseForm {
    exercise_id: number;
    sets: TemplateSetForm[];
}

const TemplateManager: React.FC = () => {
    const { templates, exercises, addTemplate, updateTemplate, deleteTemplate, exportTemplate, importTemplate } = useData();

    // Editor state
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [templateExercises, setTemplateExercises] = useState<TemplateExerciseForm[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);

    // Import state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importYaml, setImportYaml] = useState('');

    const getExerciseName = (id: number) => exercises.find(e => e.id === id)?.name || 'Unknown';

    const startCreate = () => {
        setIsEditing(true);
        setEditingId(null);
        setTemplateName('');
        setTemplateExercises([]);
    };

    const startEdit = (t: WorkoutTemplate) => {
        setIsEditing(true);
        setEditingId(t.id);
        setTemplateName(t.name);
        setTemplateExercises(t.exercises.map(ex => ({
            exercise_id: ex.exercise.id,
            sets: ex.sets.map(s => ({
                goal_weight: s.goal_weight,
                goal_reps: s.goal_reps
            }))
        })));
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setEditingId(null);
    };

    const addExerciseToTemplate = (exerciseId: number) => {
        setTemplateExercises(prev => [
            ...prev,
            { exercise_id: exerciseId, sets: [{ goal_weight: 0, goal_reps: 10 }] }
        ]);
    };

    const removeExerciseFromTemplate = (index: number) => {
        setTemplateExercises(prev => prev.filter((_, i) => i !== index));
    };

    const addSetToExercise = (exIndex: number) => {
        setTemplateExercises(prev => prev.map((ex, i) => {
            if (i !== exIndex) return ex;
            const lastSet = ex.sets[ex.sets.length - 1];
            return {
                ...ex,
                sets: [...ex.sets, { goal_weight: lastSet?.goal_weight || 0, goal_reps: lastSet?.goal_reps || 10 }]
            };
        }));
    };

    const removeSetFromExercise = (exIndex: number, setIndex: number) => {
        setTemplateExercises(prev => prev.map((ex, i) => {
            if (i !== exIndex) return ex;
            return { ...ex, sets: ex.sets.filter((_, j) => j !== setIndex) };
        }));
    };

    const updateSet = (exIndex: number, setIndex: number, field: 'goal_weight' | 'goal_reps', value: number) => {
        setTemplateExercises(prev => prev.map((ex, i) => {
            if (i !== exIndex) return ex;
            return {
                ...ex,
                sets: ex.sets.map((s, j) => j === setIndex ? { ...s, [field]: value } : s)
            };
        }));
    };

    const saveTemplate = async () => {
        if (!templateName.trim()) return;
        const data: CreateWorkoutTemplate = {
            name: templateName.trim(),
            exercises: templateExercises
        };
        if (editingId) {
            await updateTemplate(editingId, data);
        } else {
            await addTemplate(data);
        }
        cancelEdit();
    };

    const handleExport = async (t: WorkoutTemplate) => {
        const yaml = await exportTemplate(t.id);
        const blob = new Blob([yaml], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${t.name.replace(/\s+/g, '-').toLowerCase()}.yaml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImport = async () => {
        if (!importYaml.trim()) return;
        const ok = await importTemplate(importYaml);
        if (ok) {
            setShowImportModal(false);
            setImportYaml('');
        } else {
            alert('Import failed. Check your YAML format.');
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm('Delete this template?')) {
            await deleteTemplate(id);
        }
    };

    // --- Editor UI ---
    if (isEditing) {
        return (
            <div className="pb-20">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-bold text-text">{editingId ? 'Edit Template' : 'New Template'}</h1>
                    <div className="flex gap-2">
                        <button onClick={cancelEdit} className="btn bg-surface text-muted border border-border">Cancel</button>
                        <button onClick={saveTemplate} className="btn btn-primary flex items-center gap-2" disabled={!templateName.trim()}>
                            <Save size={16} /> Save
                        </button>
                    </div>
                </div>

                <input
                    type="text"
                    className="w-full mb-6 text-lg font-bold bg-bg border-border focus:border-primary"
                    placeholder="Template name (e.g. Push Day)"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    autoFocus
                />

                <div className="flex flex-col gap-4">
                    {templateExercises.map((ex, exIndex) => (
                        <div key={exIndex} className="card">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-text">{getExerciseName(ex.exercise_id)}</h3>
                                <button onClick={() => removeExerciseFromTemplate(exIndex)} className="text-muted hover:text-danger p-1">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-12 gap-2 mb-2 text-xs text-muted uppercase font-bold text-center">
                                <div className="col-span-1">#</div>
                                <div className="col-span-4">Goal kg</div>
                                <div className="col-span-4">Goal Reps</div>
                                <div className="col-span-3"></div>
                            </div>

                            {ex.sets.map((s, sIndex) => (
                                <div key={sIndex} className="grid grid-cols-12 gap-2 items-center mb-1">
                                    <div className="col-span-1 text-center text-xs text-muted">{sIndex + 1}</div>
                                    <div className="col-span-4">
                                        <input type="number" className="w-full text-center px-1" value={s.goal_weight || ''} placeholder="0"
                                            onChange={e => updateSet(exIndex, sIndex, 'goal_weight', Number(e.target.value))} />
                                    </div>
                                    <div className="col-span-4">
                                        <input type="number" className="w-full text-center px-1" value={s.goal_reps || ''} placeholder="0"
                                            onChange={e => updateSet(exIndex, sIndex, 'goal_reps', Number(e.target.value))} />
                                    </div>
                                    <div className="col-span-3 flex justify-center">
                                        <button onClick={() => removeSetFromExercise(exIndex, sIndex)} className="text-muted hover:text-danger">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <button onClick={() => addSetToExercise(exIndex)}
                                className="w-full mt-2 py-1.5 border border-border rounded text-sm text-primary hover:bg-gray-800 flex items-center justify-center gap-1"
                                style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}>
                                <Plus size={14} /> Add Set
                            </button>
                        </div>
                    ))}

                    <button onClick={() => setIsSelectorOpen(true)}
                        className="w-full py-4 border-2 border-dashed border-gray-700 rounded-lg text-muted hover:border-primary hover:text-primary transition-colors flex flex-col items-center justify-center gap-2">
                        <Plus size={24} />
                        <span>Add Exercise</span>
                    </button>
                </div>

                <ExerciseSelector
                    isOpen={isSelectorOpen}
                    onClose={() => setIsSelectorOpen(false)}
                    onSelect={(id) => { addExerciseToTemplate(id); setIsSelectorOpen(false); }}
                />
            </div>
        );
    }

    // --- List UI ---
    return (
        <div className="pb-20">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-text flex items-center gap-2">
                    <Dumbbell size={24} className="text-primary" style={{ color: 'var(--color-primary)' }} />
                    Templates
                </h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowImportModal(true)} className="btn bg-surface text-muted border border-border flex items-center gap-1 text-sm" title="Import YAML">
                        <Upload size={16} />
                    </button>
                    <button onClick={startCreate} className="btn btn-primary flex items-center gap-2">
                        <Plus size={16} /> New
                    </button>
                </div>
            </div>

            {templates.length === 0 && (
                <div className="text-center text-muted py-16">
                    <Dumbbell size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg mb-2">No templates yet</p>
                    <p className="text-sm">Create a workout template to get started</p>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {templates.map(t => (
                    <div key={t.id} className="card">
                        <div className="flex justify-between items-center cursor-pointer"
                            onClick={() => setExpandedTemplate(expandedTemplate === t.id ? null : t.id)}>
                            <div className="flex items-center gap-2">
                                {expandedTemplate === t.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                <div>
                                    <h3 className="font-bold text-text">{t.name}</h3>
                                    <p className="text-xs text-muted">{t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                <button onClick={() => handleExport(t)} className="p-2 text-muted hover:text-primary rounded" title="Export YAML">
                                    <Download size={16} />
                                </button>
                                <button onClick={() => startEdit(t)} className="p-2 text-muted hover:text-primary rounded" title="Edit">
                                    <Edit3 size={16} />
                                </button>
                                <button onClick={() => handleDelete(t.id)} className="p-2 text-muted hover:text-danger rounded" title="Delete">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {expandedTemplate === t.id && (
                            <div className="mt-3 pt-3 border-t border-border">
                                {t.exercises.map((ex, i) => (
                                    <div key={i} className="mb-2">
                                        <div className="font-medium text-sm text-text">{ex.exercise.name}</div>
                                        <div className="text-xs text-muted ml-4">
                                            {ex.sets.map((s, j) => (
                                                <span key={j}>{j > 0 ? ' · ' : ''}{s.goal_weight}kg × {s.goal_reps}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
                    <div className="bg-surface w-full max-w-lg rounded-xl border border-border p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-text">Import Template (YAML)</h2>
                            <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                                <X size={20} />
                            </button>
                        </div>
                        <textarea
                            className="w-full h-64 bg-bg border border-border rounded p-3 text-sm font-mono text-text resize-none focus:border-primary"
                            placeholder={`name: Push Day\nexercises:\n  - name: Bench Press\n    sets:\n      - { weight: 80, reps: 8 }\n      - { weight: 80, reps: 8 }`}
                            value={importYaml}
                            onChange={e => setImportYaml(e.target.value)}
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowImportModal(false)} className="btn bg-surface text-muted border border-border">Cancel</button>
                            <button onClick={handleImport} className="btn btn-primary" disabled={!importYaml.trim()}>Import</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateManager;
