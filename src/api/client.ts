let BASE_URL = import.meta.env.VITE_API_URL;
if (!BASE_URL) {
    if (import.meta.env.DEV) {
        BASE_URL = 'http://127.0.0.1:8000';
    } else {
        BASE_URL = '/api'; // Nginx proxy routes this to backend:9061
    }
}

export const apiClient = {
    async request(endpoint: string, options: RequestInit = {}) {
        const token = localStorage.getItem('fitness_auth_token');
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        };

        let response;
        try {
            response = await fetch(`${BASE_URL}${endpoint}`, {
                ...options,
                headers,
            });
        } catch (error) {
            throw new Error(`NetworkError: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (!response.ok) {
            // Only redirect on 401 if it's NOT a login request
            if (response.status === 401 && !endpoint.includes('/auth/token')) {
                // Determine if we should redirect to login or just throw
                localStorage.removeItem('fitness_auth_token');
                window.location.href = '/login';
            }
            if (response.status >= 500) {
                throw new Error(`ServerError: ${response.status} ${response.statusText}`);
            }
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(error.detail || `Request failed: ${response.statusText}`);
        }

        return response.json();
    },

    get(endpoint: string) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint: string, body: any) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    delete(endpoint: string) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

// Start a heartbeat to keep ngrok tunnels alive during long workouts
// Pings the backend every 5 minutes
setInterval(() => {
    // We do a raw fetch to avoid throwing errors and triggering redirect logic
    fetch(`${BASE_URL}/exercises/`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('fitness_auth_token') || ''}`
        }
    }).catch(() => {
        // Ignore network errors in the heartbeat
    });
}, 5 * 60 * 1000);
