import React, { useRef } from 'react';
import { useData } from '../context/DataContext';
import { User, LogOut, Trash2, Download, Upload } from 'lucide-react';

const Profile: React.FC = () => {
    const { user, logout, exportData, importData } = useData();
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!user) return null;

    const handleClearData = async () => {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            logout();
            window.location.reload();
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (content) {
                if (confirm('This will OVERWRITE existing data for this user ID. Continue?')) {
                    const success = await importData(content);
                    if (success) alert('Data imported successfully!');
                }
            }
        };
        reader.readAsText(file);
        // Reset inputs
        e.target.value = '';
    };

    return (
        <div className="max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-text">Profile</h1>

            <div className="card p-6 flex flex-col gap-6 bg-surface border-border">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-primary">
                        <User size={32} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-text">{user.name}</h2>
                        <p className="text-muted text-sm">Joined {new Date(user.joinedAt).toLocaleDateString()}</p>
                        <p className="text-muted text-xs">{user.email}</p>
                        {user.age && <p className="text-muted text-xs">Age: {user.age}</p>}
                    </div>
                </div>

                <div className="border-t border-border pt-6">
                    <h3 className="font-bold mb-4 text-text">Data Management</h3>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => exportData()}
                            className="btn bg-blue-600 hover:bg-blue-700 text-white w-full flex items-center justify-center gap-2"
                        >
                            <Download size={18} /> Export Data (Backup)
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="btn bg-gray-700 hover:bg-gray-600 text-white w-full flex items-center justify-center gap-2"
                        >
                            <Upload size={18} /> Import Data
                        </button>
                        <input
                            type="file"
                            accept=".json"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImport}
                        />
                    </div>
                </div>

                <div className="border-t border-border pt-6">
                    <h3 className="font-bold mb-4 text-text">Account Actions</h3>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={logout}
                            className="btn btn-secondary w-full flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} /> Sign Out
                        </button>

                        <button
                            onClick={handleClearData}
                            className="btn btn-danger w-full flex items-center justify-center gap-2"
                        >
                            <Trash2 size={18} /> Clear Data (Local)
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-center text-xs text-muted">
                <p>FitTrack v2.1.0</p>
                <p>Powered by IndexedDB</p>
            </div>
        </div>
    );
};

export default Profile;
