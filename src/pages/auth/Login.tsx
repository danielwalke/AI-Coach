import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useData } from '../../context/DataContext';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { login, user } = useData();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setError(null);
        setIsLoading(true);

        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Login failed. Check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="w-full max-w-sm flex flex-col gap-8">
                <div className="text-center">
                    <h1 className="text-4xl font-extrabold text-text mb-2">Welcome</h1>
                    <p className="text-muted">Sign in to sync your fitness journey.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4">
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-surface-highlight border-none py-4 text-text placeholder-text-muted"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="bg-surface-highlight border-none py-4 text-text placeholder-text-muted"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary py-4 text-lg font-bold shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <div className="text-center text-sm">
                    <span className="text-muted">New here? </span>
                    <Link to="/signup" className="text-primary font-bold hover:underline">Create Account</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
