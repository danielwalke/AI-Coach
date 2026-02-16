import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { Eye, EyeOff } from 'lucide-react';

const Signup: React.FC = () => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [age, setAge] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { register, user } = useData();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !name || !password) return;

        setError(null);
        setIsLoading(true);

        try {
            await register(name, email, password, Number(age));
            // Navigation handled by DataContext reload or we can rely on it here if reload wasn't used
            // but DataContext does reload, so this might be race-y if we don't wait. 
            // Actually DataContext.register does not return anything, it reloads. 
            // So we might not need navigate('/dashboard') here if the app reloads.
            // But let's keep it consistent.
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full pt-10">
            <div className="card w-full max-w-md p-8 bg-surface border border-border">
                <h1 className="text-2xl font-bold mb-2 text-center text-primary">Create Account</h1>
                <p className="text-muted text-center mb-6">Start your AI-Coach journey</p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-2 rounded mb-4 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="name" className="text-sm font-medium">Name</label>
                        <input
                            type="text"
                            id="name"
                            placeholder="Your Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="bg-bg border-border focus:border-primary"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="email" className="text-sm font-medium">Email</label>
                        <input
                            type="email"
                            id="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="bg-bg border-border focus:border-primary"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="password" className="text-sm font-medium">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-bg border-border focus:border-primary w-full pr-12"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="age" className="text-sm font-medium">Age</label>
                        <input
                            type="number"
                            id="age"
                            placeholder="25"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            className="bg-bg border-border focus:border-primary"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary mt-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <span className="text-muted">Already have an account? </span>
                    <Link to="/login" className="text-primary hover:underline hover:text-primary-dark">Sign in</Link>
                </div>
            </div>
        </div>
    );
};

export default Signup;
