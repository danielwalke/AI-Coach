import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

const Layout: React.FC = () => {
    return (
        <div className="min-h-screen bg-bg text-text font-sans relative">
            <main className="pb-24 p-6 mx-auto max-w-2xl">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    );
};

export default Layout;
